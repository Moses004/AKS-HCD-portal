/**
 * AKS-HCD Secure Media & Evidence Resolver Utility (`src/lib/mediaResolver.ts`)
 *
 * Responsibilities:
 * 1. Treat `storagePath` as the canonical reference for private uploaded files in `hcd-evidence-vault`.
 * 2. Generate short-lived signed URLs via `storage.from('hcd-evidence-vault').createSignedUrl()`.
 * 3. In-memory memoization (expiry-aware caching) and concurrent in-flight request deduplication
 *    to prevent redundant network requests.
 * 4. Robust, non-crashing error handling and structured diagnostic logging for missing files
 *    (404/NoSuchKey), expired tokens (JWT `exp` / 401 / 403), unauthorized access, and legacy
 *    local `/src/assets/...` paths, returning `url: null` and an explicit fallback placeholder signal
 *    when URL generation fails.
 * 5. Retry circuit-breaker (max 3 attempts per 30s window) to prevent infinite retry loops.
 */

import { getSupabaseClient, isSupabaseUnreachable } from './supabase';
import { VerificationMedia, StateEvidenceFile, HCDActivity, UserSession } from '../types';

export const EVIDENCE_BUCKET = 'hcd-evidence-vault';
export const DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour short-lived signed URL
export const EXPIRY_REFRESH_BUFFER_MS = 60 * 1000; // Refresh 60s prior to expiration
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_WINDOW_MS = 30 * 1000; // 30 seconds retry window

/**
 * Explicit fallback signal returned when URL generation fails so UI components can safely
 * render a branded fallback placeholder instead of a broken image or crashing.
 */
export const FALLBACK_MEDIA_PLACEHOLDER_SIGNAL = 'FALLBACK_MEDIA_PLACEHOLDER' as const;
export type FallbackPlaceholderSignal = typeof FALLBACK_MEDIA_PLACEHOLDER_SIGNAL | null;

export type MediaResolutionStatus =
  | 'idle'
  | 'loading'
  | 'resolved'
  | 'missing_file'
  | 'unauthorized'
  | 'network_error'
  | 'legacy_local_invalid'
  | 'document'
  | 'empty'
  | 'error';

export interface ResolvedMediaResult {
  status: MediaResolutionStatus;
  url: string | null;
  signedUrl: string | null;
  storagePath: string | null;
  fallbackPlaceholder?: FallbackPlaceholderSignal;
  useFallbackPlaceholder?: boolean;
  fileName?: string;
  fileSize?: string;
  isDocument: boolean;
  mimeType?: string;
  caption?: string;
  isPrivateStorage: boolean;
  error?: string;
  isGeotagValid: boolean;
  coordinates?: { lat: number; lng: number };
  exifVerified?: boolean;
}

export type ResolvableMediaInput =
  | string
  | VerificationMedia
  | StateEvidenceFile
  | {
      storagePath?: string | null;
      url?: string | null;
      type?: string;
      fileName?: string;
      file_name?: string;
      file_path?: string;
      file_size?: number | string;
      caption?: string;
      mimeType?: string;
      exifVerified?: boolean;
      coordinates?: { lat: number; lng: number };
    }
  | null
  | undefined;

interface CacheEntry {
  url: string;
  expiresAt: number;
  fetchedAt: number;
}

interface RetryTracker {
  count: number;
  lastAttemptAt: number;
}

// Memoization cache for resolved signed URLs
const signedUrlCache = new Map<string, CacheEntry>();

// Negative resolution cache for missing files (404) or unauthorized objects (401/403)
// Prevents repeated network calls and retry-throttling floods for non-existent storage paths
const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const negativeResolutionCache = new Map<string, { result: ResolvedMediaResult; expiresAt: number }>();

// In-flight promise deduplication map to prevent duplicate simultaneous requests
const inFlightRequests = new Map<string, Promise<ResolvedMediaResult>>();

// Retry circuit-breaker tracker to prevent infinite retry loops
const retryTrackers = new Map<string, RetryTracker>();

export interface MediaResolutionDiagnosticEntry {
  issueType: string;
  target: string;
  detail: string;
  timestamp: string;
}

const diagnosticLogBuffer: MediaResolutionDiagnosticEntry[] = [];
const loggedIssueKeys = new Set<string>();

export function getMediaResolutionDiagnostics(): MediaResolutionDiagnosticEntry[] {
  return [...diagnosticLogBuffer];
}

/**
 * Non-throwing structured diagnostic logger for media resolution failures
 * (missing files, expired tokens, unauthorized access, legacy local paths, network errors).
 * Deduplicates repeated notices per target and avoids `console.error` so browser preview
 * error overlays are never triggered by handled missing files or expired tokens.
 */
function logMediaResolutionIssue(
  issueType:
    | 'missing_file'
    | 'expired_token'
    | 'unauthorized'
    | 'legacy_local_invalid'
    | 'retry_throttled'
    | 'network_error'
    | 'storage_error',
  target: string | null | undefined,
  detail: string
): void {
  try {
    const safeTarget = target || 'unknown_target';
    const dedupeKey = `${issueType}:${safeTarget}`;
    if (loggedIssueKeys.has(dedupeKey)) {
      return;
    }
    loggedIssueKeys.add(dedupeKey);

    const entry: MediaResolutionDiagnosticEntry = {
      issueType,
      target: safeTarget,
      detail,
      timestamp: new Date().toISOString(),
    };
    diagnosticLogBuffer.push(entry);
    if (diagnosticLogBuffer.length > 100) {
      diagnosticLogBuffer.shift();
    }

    const prefix = `[AKS-HCD mediaResolver][${issueType}]`;
    if (typeof window !== 'undefined') {
      // Use console.debug in browser runtime so handled fallbacks do not trigger global error overlays
      console.debug(`${prefix} (${safeTarget}): ${detail}`);
    } else {
      console.info(`${prefix} (${safeTarget}): ${detail}`);
    }
  } catch {
    // Never allow logging to throw or interrupt UI rendering
  }
}

/**
 * Validate latitude and longitude within Akwa Ibom State geographic boundaries:
 * Latitude: ~4.4°N to ~5.6°N
 * Longitude: ~7.4°E to ~8.5°E
 */
export function isAkwaIbomCoordinates(coords?: { lat?: number | null; lng?: number | null }): boolean {
  if (!coords || coords.lat == null || coords.lng == null) return false;
  const lat = Number(coords.lat);
  const lng = Number(coords.lng);
  if (isNaN(lat) || isNaN(lng)) return false;
  return lat >= 4.4 && lat <= 5.6 && lng >= 7.4 && lng <= 8.5;
}

/**
 * Normalize and clean a Supabase storage path:
 * - Strip leading slashes
 * - Avoid duplicating bucket name if passed
 * - Normalize backslashes to forward slashes
 */
export function cleanStoragePath(rawPath: string): string {
  let cleaned = rawPath.trim().replace(/\\/g, '/');
  if (cleaned.startsWith('/')) {
    cleaned = cleaned.replace(/^\/+/, '');
  }
  const bucketPrefix = `${EVIDENCE_BUCKET}/`;
  if (cleaned.startsWith(bucketPrefix)) {
    cleaned = cleaned.substring(bucketPrefix.length);
  }
  return cleaned;
}

/**
 * Attempt to extract a canonical storage path from an expired Supabase signed URL
 * e.g., https://.../storage/v1/object/sign/hcd-evidence-vault/uyo/activity-123/file.jpg?token=...
 */
export function extractStoragePathFromSignedUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  try {
    const match = url.match(/\/storage\/v[0-9]+\/object\/sign\/([^/?]+)\/([^?]+)/);
    if (match && match[1] === EVIDENCE_BUCKET && match[2]) {
      return decodeURIComponent(match[2]);
    }
  } catch {
    // ignore parse failure
  }
  return null;
}

/**
 * Inspects a Supabase Storage signed URL (`?token=eyJ...`) to determine whether its embedded JWT token has expired.
 */
export function isSignedUrlTokenExpired(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const tokenMatch = url.match(/[?&]token=([^&]+)/);
    if (!tokenMatch || !tokenMatch[1]) return false;
    const parts = tokenMatch[1].split('.');
    if (parts.length !== 3) return false;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload =
      typeof atob === 'function'
        ? atob(base64)
        : Buffer.from(base64, 'base64').toString('utf-8');
    const payload = JSON.parse(jsonPayload);
    if (typeof payload.exp === 'number') {
      return Date.now() >= payload.exp * 1000 - EXPIRY_REFRESH_BUFFER_MS;
    }
  } catch {
    return true;
  }
  return false;
}

/**
 * Checks if a string is a legacy local development path like '/src/assets/...'
 */
export function isLegacyLocalAssetPath(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('/src/') || url.includes('/src/assets/') || url.startsWith('src/');
}

/**
 * Determines whether a file represents a document (PDF, DOC, etc.) rather than an image
 */
export function isDocumentMedia(media?: { type?: string; fileName?: string; mimeType?: string }): boolean {
  if (!media) return false;
  if (media.type === 'document') return true;
  const lowerName = (media.fileName || '').toLowerCase();
  const lowerMime = (media.mimeType || '').toLowerCase();
  if (lowerName.endsWith('.pdf') || lowerMime.includes('pdf')) return true;
  if (
    lowerName.endsWith('.doc') ||
    lowerName.endsWith('.docx') ||
    lowerName.endsWith('.xls') ||
    lowerName.endsWith('.xlsx')
  ) {
    return true;
  }
  return false;
}

/**
 * Validates a file before uploading:
 * - MIME type whitelist: JPEG, PNG, WEBP, PDF, MP4
 * - Extension matching MIME type
 * - Size limit: 25MB ceiling
 */
export function validateMediaFile(file: File | Blob, customFileName?: string): { valid: boolean; error?: string } {
  const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
  if (file.size > MAX_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${sizeMb} MB) exceeds maximum permitted limit of 25MB.`,
    };
  }

  const name = customFileName || ('name' in file ? (file as File).name : '');
  const lowerName = name.toLowerCase();

  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.mp4'];
  const hasAllowedExt = allowedExtensions.some((ext) => lowerName.endsWith(ext));

  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'video/mp4',
  ];

  if (file.type && !allowedMimes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file format (${file.type}). Permitted formats: JPEG, PNG, WEBP, PDF, and MP4.`,
    };
  }

  if (name && !hasAllowedExt) {
    return {
      valid: false,
      error: 'Invalid file extension. Permitted extensions: .jpg, .jpeg, .png, .webp, .pdf, .mp4.',
    };
  }

  return { valid: true };
}

/**
 * Generate a collision-resistant, compliant storage path:
 * LGA convention: `${lgaId}/${activityId}/${timestamp}_${uniqueId}_${sanitizedFilename}`
 * State convention: `state-level/${activityId}/${timestamp}_${uniqueId}_${sanitizedFilename}`
 */
export function generateSafeStoragePath(
  scope: string, // e.g. lgaId or 'state-level'
  activityId: string,
  fileName: string
): string {
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const cleanScope = scope.trim().replace(/^\/+|\/+$/g, '');
  const cleanActId = activityId.trim().replace(/^\/+|\/+$/g, '');
  return `${cleanScope}/${cleanActId}/${timestamp}_${randomSuffix}_${sanitizedName}`;
}

/**
 * Build a standardized fallback result when URL generation fails or media is unavailable,
 * returning `url: null`, `signedUrl: null`, and `fallbackPlaceholder: 'FALLBACK_MEDIA_PLACEHOLDER'`.
 */
function createFallbackMediaResult(params: {
  status: MediaResolutionStatus;
  storagePath?: string | null;
  fileName?: string;
  caption?: string;
  isDocument?: boolean;
  isPrivateStorage?: boolean;
  error?: string;
  isGeotagValid?: boolean;
  coordinates?: { lat: number; lng: number };
  exifVerified?: boolean;
}): ResolvedMediaResult {
  return {
    status: params.status,
    url: null,
    signedUrl: null,
    storagePath: params.storagePath ?? null,
    fallbackPlaceholder: FALLBACK_MEDIA_PLACEHOLDER_SIGNAL,
    useFallbackPlaceholder: true,
    fileName: params.fileName,
    caption: params.caption,
    isDocument: Boolean(params.isDocument),
    isPrivateStorage: Boolean(params.isPrivateStorage),
    error: params.error,
    isGeotagValid: Boolean(params.isGeotagValid),
    coordinates: params.coordinates,
    exifVerified: params.exifVerified,
  };
}

/**
 * Resolve a `storagePath` string or an activity media object into a short-lived signed URL
 * from `storage.from('hcd-evidence-vault').createSignedUrl()`, with memoization,
 * structured error logging for missing files or expired tokens, and safe fallback placeholder
 * signaling (`url: null`, `fallbackPlaceholder: 'FALLBACK_MEDIA_PLACEHOLDER'`) when URL generation fails.
 */
export async function resolveActivityMedia(
  mediaOrPath?: ResolvableMediaInput,
  options: {
    forceRefresh?: boolean;
    expiresInSeconds?: number;
  } = {}
): Promise<ResolvedMediaResult> {
  try {
    if (!mediaOrPath || (typeof mediaOrPath === 'string' && !mediaOrPath.trim())) {
      return createFallbackMediaResult({
        status: 'empty',
        storagePath: null,
        isDocument: false,
        isPrivateStorage: false,
        isGeotagValid: false,
      });
    }

    // Normalize string input (direct storagePath or legacy URL string) into media object structure
    const media =
      typeof mediaOrPath === 'string'
        ? isLegacyLocalAssetPath(mediaOrPath) ||
          mediaOrPath.startsWith('http://') ||
          mediaOrPath.startsWith('https://') ||
          mediaOrPath.startsWith('blob:')
          ? {
              url: mediaOrPath,
              storagePath: extractStoragePathFromSignedUrl(mediaOrPath),
              fileName: mediaOrPath.split('/').pop()?.split('?')[0] || 'evidence_asset',
            }
          : {
              storagePath: mediaOrPath,
              fileName: mediaOrPath.split('/').pop() || 'evidence_asset',
            }
        : mediaOrPath;

    const rawStoragePath =
      ('storagePath' in media && media.storagePath) ||
      ('file_path' in media && media.file_path) ||
      null;

    const rawUrl = 'url' in media ? media.url : null;
    const fileName =
      ('fileName' in media && media.fileName) ||
      ('file_name' in media && media.file_name) ||
      'evidence_asset';

    const caption = 'caption' in media ? media.caption : undefined;
    const isDoc = isDocumentMedia({
      type: 'type' in media ? media.type : undefined,
      fileName,
      mimeType: 'mimeType' in media ? media.mimeType : undefined,
    });

    const exifVerified = 'exifVerified' in media ? Boolean(media.exifVerified) : false;
    const coordinates = 'coordinates' in media ? media.coordinates : undefined;
    const isGeotagValid = exifVerified && isAkwaIbomCoordinates(coordinates);

    // Determine canonical storage path:
    // 1. Direct storagePath
    // 2. Or extract from legacy signed URL if missing
    let storagePath: string | null = rawStoragePath ? cleanStoragePath(rawStoragePath) : null;
    if (!storagePath && rawUrl) {
      const extracted = extractStoragePathFromSignedUrl(rawUrl);
      if (extracted) {
        storagePath = cleanStoragePath(extracted);
        if (isSignedUrlTokenExpired(rawUrl)) {
          logMediaResolutionIssue(
            'expired_token',
            storagePath,
            'Detected expired signed URL token; recovering and refreshing via canonical storagePath.'
          );
        }
      }
    }

    // Check for legacy local development path like '/src/assets/...'
    if (!storagePath && rawUrl && isLegacyLocalAssetPath(rawUrl)) {
      const errMsg = 'Legacy local development path cannot be resolved as cloud evidence in production.';
      logMediaResolutionIssue('legacy_local_invalid', rawUrl, errMsg);
      return createFallbackMediaResult({
        status: 'legacy_local_invalid',
        storagePath: null,
        fileName,
        caption,
        isDocument: isDoc,
        isPrivateStorage: false,
        error: errMsg,
        isGeotagValid: false,
      });
    }

    // If we have a canonical storage path, resolve via Supabase Storage createSignedUrl
    if (storagePath) {
      const cacheKey = `${EVIDENCE_BUCKET}:${storagePath}`;

      // 1. Check memoized in-memory cache if not forcing refresh
      if (!options.forceRefresh) {
        const cached = signedUrlCache.get(cacheKey);
        if (cached) {
          if (Date.now() < cached.expiresAt - EXPIRY_REFRESH_BUFFER_MS && !isSignedUrlTokenExpired(cached.url)) {
            return {
              status: isDoc ? 'document' : 'resolved',
              url: cached.url,
              signedUrl: cached.url,
              storagePath,
              fallbackPlaceholder: null,
              useFallbackPlaceholder: false,
              fileName,
              caption,
              isDocument: isDoc,
              isPrivateStorage: true,
              isGeotagValid,
              coordinates,
              exifVerified,
            };
          }
          // Evict expired token from memoization cache and log diagnostic notice
          logMediaResolutionIssue(
            'expired_token',
            storagePath,
            'Memoized signed URL token expired or reached refresh buffer; evicting cache entry to generate a fresh signed URL.'
          );
          signedUrlCache.delete(cacheKey);
        }

        const negCached = negativeResolutionCache.get(cacheKey);
        if (negCached) {
          if (Date.now() < negCached.expiresAt) {
            return negCached.result;
          }
          negativeResolutionCache.delete(cacheKey);
        }
      } else {
        negativeResolutionCache.delete(cacheKey);
      }

      // 2. Check retry circuit breaker
      const tracker = retryTrackers.get(cacheKey) || { count: 0, lastAttemptAt: 0 };
      const now = Date.now();
      if (now - tracker.lastAttemptAt < RETRY_WINDOW_MS && tracker.count >= MAX_RETRY_ATTEMPTS) {
        const throttleMsg = 'Too many retry attempts. Resolution throttled to prevent network flood.';
        logMediaResolutionIssue('retry_throttled', storagePath, throttleMsg);
        return createFallbackMediaResult({
          status: 'error',
          storagePath,
          fileName,
          caption,
          isDocument: isDoc,
          isPrivateStorage: true,
          error: throttleMsg,
          isGeotagValid,
        });
      }

      // 3. Deduplicate simultaneous in-flight requests for the same storagePath
      if (inFlightRequests.has(cacheKey)) {
        return inFlightRequests.get(cacheKey)!;
      }

      // 4. Request short-lived signed URL from Supabase Storage ('hcd-evidence-vault')
      const fetchPromise = (async (): Promise<ResolvedMediaResult> => {
        tracker.count += 1;
        tracker.lastAttemptAt = Date.now();
        retryTrackers.set(cacheKey, tracker);

        const client = getSupabaseClient();
        if (!client || isSupabaseUnreachable()) {
          if (rawUrl && (rawUrl.startsWith('https://') || rawUrl.startsWith('http://')) && !isSignedUrlTokenExpired(rawUrl)) {
            return {
              status: isDoc ? 'document' : 'resolved',
              url: rawUrl,
              signedUrl: rawUrl,
              storagePath,
              fallbackPlaceholder: null,
              useFallbackPlaceholder: false,
              fileName,
              caption,
              isDocument: isDoc,
              isPrivateStorage: false,
              isGeotagValid,
              coordinates,
              exifVerified,
            };
          }
          const clientErr = 'Supabase storage offline — using local fallback.';
          logMediaResolutionIssue('network_error', storagePath, clientErr);
          return createFallbackMediaResult({
            status: 'network_error',
            storagePath,
            fileName,
            caption,
            isDocument: isDoc,
            isPrivateStorage: true,
            error: clientErr,
            isGeotagValid,
          });
        }

        try {
          const expiry = options.expiresInSeconds || DEFAULT_SIGNED_URL_EXPIRY_SECONDS;
          const { data, error } = await client.storage
            .from('hcd-evidence-vault')
            .createSignedUrl(storagePath, expiry);

          if (error || !data?.signedUrl) {
            const errCode = (error as any)?.statusCode || (error as any)?.status || '';
            const errMsg = error?.message || 'Storage error';
            const lowerMsg = errMsg.toLowerCase();

            // Distinguish 404 / NoSuchKey (Missing file)
            if (
              errCode === 404 ||
              errCode === '404' ||
              errMsg.includes('Object not found') ||
              errMsg.includes('NoSuchKey') ||
              lowerMsg.includes('not found') ||
              (error as any)?.code === 'NoSuchKey'
            ) {
              const missingMsg = 'Evidence file not found in storage vault. Re-upload required.';
              logMediaResolutionIssue('missing_file', storagePath, `${missingMsg} (Supabase: ${errMsg})`);
              const missingResult = createFallbackMediaResult({
                status: 'missing_file',
                storagePath,
                fileName,
                caption,
                isDocument: isDoc,
                isPrivateStorage: true,
                error: missingMsg,
                isGeotagValid,
              });
              negativeResolutionCache.set(cacheKey, {
                result: missingResult,
                expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS,
              });
              return missingResult;
            }

            // Distinguish Expired Token vs Unauthorized / RLS Permission Denied (401 / 403)
            if (lowerMsg.includes('expired') || lowerMsg.includes('jwt')) {
              const expiredMsg =
                'Access denied or token expired: session or storage token has expired while requesting signed URL.';
              logMediaResolutionIssue('expired_token', storagePath, `${expiredMsg} (Supabase: ${errMsg})`);
              const expiredResult = createFallbackMediaResult({
                status: 'unauthorized',
                storagePath,
                fileName,
                caption,
                isDocument: isDoc,
                isPrivateStorage: true,
                error: expiredMsg,
                isGeotagValid,
              });
              negativeResolutionCache.set(cacheKey, {
                result: expiredResult,
                expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS,
              });
              return expiredResult;
            }

            if (
              errCode === 401 ||
              errCode === 403 ||
              lowerMsg.includes('permission denied') ||
              lowerMsg.includes('unauthorized')
            ) {
              const authMsg =
                'Access denied or token expired: caller does not have authorization to view this evidence dossier.';
              logMediaResolutionIssue('unauthorized', storagePath, `${authMsg} (Supabase: ${errMsg})`);
              const authResult = createFallbackMediaResult({
                status: 'unauthorized',
                storagePath,
                fileName,
                caption,
                isDocument: isDoc,
                isPrivateStorage: true,
                error: authMsg,
                isGeotagValid,
              });
              negativeResolutionCache.set(cacheKey, {
                result: authResult,
                expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS,
              });
              return authResult;
            }

            logMediaResolutionIssue('storage_error', storagePath, errMsg);
            return createFallbackMediaResult({
              status: 'error',
              storagePath,
              fileName,
              caption,
              isDocument: isDoc,
              isPrivateStorage: true,
              error: errMsg,
              isGeotagValid,
            });
          }

          // Memoize resolved short-lived URL in memory
          const expiresAt = Date.now() + expiry * 1000;
          signedUrlCache.set(cacheKey, {
            url: data.signedUrl,
            expiresAt,
            fetchedAt: Date.now(),
          });

          // Reset retry tracker on success
          retryTrackers.delete(cacheKey);

          return {
            status: isDoc ? 'document' : 'resolved',
            url: data.signedUrl,
            signedUrl: data.signedUrl,
            storagePath,
            fallbackPlaceholder: null,
            useFallbackPlaceholder: false,
            fileName,
            caption,
            isDocument: isDoc,
            isPrivateStorage: true,
            isGeotagValid,
            coordinates,
            exifVerified,
          };
        } catch (err: any) {
          const netMsg = err?.message || 'Network exception while resolving signed URL.';
          logMediaResolutionIssue('network_error', storagePath, netMsg);
          return createFallbackMediaResult({
            status: 'network_error',
            storagePath,
            fileName,
            caption,
            isDocument: isDoc,
            isPrivateStorage: true,
            error: netMsg,
            isGeotagValid,
          });
        } finally {
          inFlightRequests.delete(cacheKey);
        }
      })();

      inFlightRequests.set(cacheKey, fetchPromise);
      return fetchPromise;
    }

    // If no storage path exists, check if there's a valid trusted HTTP/blob URL
    if (rawUrl) {
      if (rawUrl.startsWith('blob:')) {
        return {
          status: isDoc ? 'document' : 'resolved',
          url: rawUrl,
          signedUrl: rawUrl,
          storagePath: null,
          fallbackPlaceholder: null,
          useFallbackPlaceholder: false,
          fileName,
          caption,
          isDocument: isDoc,
          isPrivateStorage: false,
          isGeotagValid,
          coordinates,
          exifVerified,
        };
      }

      if (rawUrl.startsWith('https://') || rawUrl.startsWith('http://')) {
        if (isSignedUrlTokenExpired(rawUrl)) {
          const expiredUrlMsg =
            'Signed URL token has expired and no canonical storagePath was provided to refresh it.';
          logMediaResolutionIssue('expired_token', rawUrl, expiredUrlMsg);
          return createFallbackMediaResult({
            status: 'error',
            storagePath: null,
            fileName,
            caption,
            isDocument: isDoc,
            isPrivateStorage: true,
            error: expiredUrlMsg,
            isGeotagValid: false,
          });
        }
        return {
          status: isDoc ? 'document' : 'resolved',
          url: rawUrl,
          signedUrl: rawUrl,
          storagePath: null,
          fallbackPlaceholder: null,
          useFallbackPlaceholder: false,
          fileName,
          caption,
          isDocument: isDoc,
          isPrivateStorage: false,
          isGeotagValid,
          coordinates,
          exifVerified,
        };
      }
    }

    return createFallbackMediaResult({
      status: 'empty',
      storagePath: null,
      fileName,
      caption,
      isDocument: isDoc,
      isPrivateStorage: false,
      isGeotagValid: false,
    });
  } catch (unexpectedErr: any) {
    const fallbackErrorMsg =
      unexpectedErr?.message || 'Unexpected error during activity media resolution.';
    logMediaResolutionIssue('storage_error', typeof mediaOrPath === 'string' ? mediaOrPath : null, fallbackErrorMsg);
    return createFallbackMediaResult({
      status: 'error',
      storagePath: null,
      isDocument: false,
      isPrivateStorage: false,
      error: fallbackErrorMsg,
      isGeotagValid: false,
    });
  }
}

/**
 * Convenience helper that resolves a `storagePath` or media input directly to a signed URL string,
 * or returns `null` when URL generation fails (missing file, expired token, or network error).
 */
export async function resolveActivityMediaUrl(
  mediaOrPath?: ResolvableMediaInput,
  options: {
    forceRefresh?: boolean;
    expiresInSeconds?: number;
  } = {}
): Promise<string | null> {
  const result = await resolveActivityMedia(mediaOrPath, options);
  return result.url;
}

/**
 * Invalidate memoized signed URL cache for a given storagePath (or clear all)
 */
export function invalidateMediaCache(storagePath?: string | null): void {
  if (!storagePath) {
    signedUrlCache.clear();
    negativeResolutionCache.clear();
    retryTrackers.clear();
    return;
  }
  const clean = cleanStoragePath(storagePath);
  const cacheKey = `${EVIDENCE_BUCKET}:${clean}`;
  signedUrlCache.delete(cacheKey);
  negativeResolutionCache.delete(cacheKey);
  retryTrackers.delete(cacheKey);
}

/**
 * Pure, idempotent utility to repair legacy media assets metadata:
 * - Strips expired signed URLs and temporary blob: URLs from `url` field
 * - Strips `/src/...` legacy local paths
 * - Recovers `storagePath` if embedded in legacy signed URL
 * - Preserves all metadata (caption, fileName, coordinates, coordinateSource, uploadTimestamp, exifVerified, etc.)
 */
export function repairActivityMediaMetadata(
  mediaList?: VerificationMedia[] | null
): VerificationMedia[] {
  if (!Array.isArray(mediaList)) return [];

  return mediaList.map((item) => {
    let storagePath = item.storagePath ? cleanStoragePath(item.storagePath) : undefined;
    let url = item.url;

    if (url && !storagePath) {
      const extracted = extractStoragePathFromSignedUrl(url);
      if (extracted) {
        storagePath = cleanStoragePath(extracted);
      }
    }

    // Never persist temporary browser blob URLs, expired signed URLs, or /src/... development paths
    if (url) {
      if (
        url.startsWith('blob:') ||
        isLegacyLocalAssetPath(url) ||
        url.includes('/storage/v1/object/sign/') ||
        url.includes('token=')
      ) {
        url = '';
      }
    }

    return {
      ...item,
      storagePath,
      url: url || '',
      type: item.type || (isDocumentMedia(item) ? 'document' : 'photo'),
    };
  });
}

/**
 * Validate a replacement or newly uploaded Beneficiary Attendance Registry PDF file.
 * Strictly requires PDF format (.pdf extension and application/pdf MIME type) within the 25MB limit.
 */
export function validateAttendanceRegistryPdf(
  file: File | Blob,
  customFileName?: string
): { valid: boolean; error?: string } {
  const baseValidation = validateMediaFile(file, customFileName);
  if (!baseValidation.valid) {
    return baseValidation;
  }

  const name = (customFileName || ('name' in file ? (file as File).name : '') || '').toLowerCase();
  const mime = (file.type || '').toLowerCase();

  if (name && !name.endsWith('.pdf')) {
    return {
      valid: false,
      error: 'Attendance Registry must be a PDF document (.pdf extension required).',
    };
  }

  if (mime && mime !== 'application/pdf') {
    return {
      valid: false,
      error: `Attendance Registry must be an authentic PDF document (received ${file.type}).`,
    };
  }

  return { valid: true };
}

/**
 * Extracts a canonical private vault storagePath from an attendanceRegistryUrl or path string.
 * Returns null if the reference is a placeholder ('#attendance-registry-file'), blob URL, or empty.
 */
export function extractCanonicalAttendanceStoragePath(ref?: string | null): string | null {
  if (!ref || typeof ref !== 'string') return null;
  const trimmed = ref.trim();
  if (
    !trimmed ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('blob:') ||
    isLegacyLocalAssetPath(trimmed)
  ) {
    return null;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return extractStoragePathFromSignedUrl(trimmed);
  }

  const cleaned = cleanStoragePath(trimmed);
  // Canonical paths have at least "{scope}/{activityId}/{filename}"
  if (cleaned.includes('/') && !cleaned.startsWith('http')) {
    return cleaned;
  }
  return null;
}

/**
 * Checks whether an attendance registry URL or storage reference points to a canonical object in hcd-evidence-vault.
 */
export function isCanonicalStorageReference(ref?: string | null): boolean {
  return extractCanonicalAttendanceStoragePath(ref) !== null;
}

/**
 * Pure helper to replace ONLY the selected attachment in an activity's mediaAssets array,
 * preserving all unrelated attachments in their exact order and sanitizing temporary URLs.
 */
export function replaceVerificationAssetInList(
  currentAssets: VerificationMedia[],
  targetAssetId: string,
  replacementAsset: VerificationMedia
): {
  updatedAssets: VerificationMedia[];
  supersededAsset: VerificationMedia | null;
  replaced: boolean;
} {
  let supersededAsset: VerificationMedia | null = null;
  let replaced = false;

  const updatedAssets = (currentAssets || []).map((asset) => {
    if (asset.id === targetAssetId && !replaced) {
      supersededAsset = asset;
      replaced = true;
      return {
        ...replacementAsset,
        id: targetAssetId, // Preserve stable slot ID or use replacement ID
        storagePath: replacementAsset.storagePath
          ? cleanStoragePath(replacementAsset.storagePath)
          : undefined,
        url: '', // Never persist temporary blob or signed URLs in the database payload
      };
    }
    return {
      ...asset,
      storagePath: asset.storagePath ? cleanStoragePath(asset.storagePath) : undefined,
      url:
        asset.url &&
        (asset.url.startsWith('blob:') ||
          asset.url.includes('/storage/v1/object/sign/') ||
          asset.url.includes('token=') ||
          isLegacyLocalAssetPath(asset.url))
          ? ''
          : asset.url,
    };
  });

  return { updatedAssets, supersededAsset, replaced };
}

/**
 * Pure helper to remove a single obsolete attachment from an activity's mediaAssets array
 * while preserving all unrelated attachments.
 */
export function removeVerificationAssetFromList(
  currentAssets: VerificationMedia[],
  targetAssetId: string
): {
  updatedAssets: VerificationMedia[];
  removedAsset: VerificationMedia | null;
} {
  let removedAsset: VerificationMedia | null = null;
  const updatedAssets = (currentAssets || []).filter((asset) => {
    if (asset.id === targetAssetId && !removedAsset) {
      removedAsset = asset;
      return false;
    }
    return true;
  });
  return { updatedAssets, removedAsset };
}

export interface ActivityEditPermission {
  canEdit: boolean;
  reasonCode:
    | 'ALLOWED'
    | 'UNAUTHENTICATED'
    | 'UNPRIVILEGED'
    | 'CROSS_LGA'
    | 'STATUS_PENDING_APPROVAL'
    | 'STATUS_PUBLISHED';
  title: string;
  explanation: string;
}

/**
 * Evaluates whether a user is authorized to edit an activity draft or returned report.
 * Enforces:
 * 1. Approved & active LGA Desk Worker can edit only records belonging to their assigned LGA.
 * 2. State Executive users may edit records as permitted by authorization rules.
 * 3. Only DRAFT and REJECTED_DRAFT records may be edited through the draft editor.
 * 4. PENDING_APPROVAL and PUBLISHED records are strictly read-only in the draft editor.
 */
export function evaluateActivityEditPermission(
  activity: Pick<HCDActivity, 'id' | 'lgaId' | 'lgaName' | 'status'>,
  user?: UserSession | null
): ActivityEditPermission {
  if (!user || !user.isAuthenticated) {
    return {
      canEdit: false,
      reasonCode: 'UNAUTHENTICATED',
      title: 'Authentication Required (Read-Only)',
      explanation:
        'You must be signed in with an approved government account to edit LGA activity drafts or verification evidence.',
    };
  }

  if (!user.isPrivileged || (user.role !== 'lga_admin' && user.role !== 'state_admin')) {
    return {
      canEdit: false,
      reasonCode: 'UNPRIVILEGED',
      title: 'Clearance Pending (Read-Only)',
      explanation:
        'Your government account does not have active desk editing clearance. Contact the State Executive Secretariat.',
    };
  }

  if (user.role === 'lga_admin' && user.assignedLgaId !== activity.lgaId) {
    return {
      canEdit: false,
      reasonCode: 'CROSS_LGA',
      title: `Cross-LGA Jurisdiction Lock (${activity.lgaName} LGA)`,
      explanation: `You are assigned to ${user.assignedLgaName || user.assignedLgaId} LGA. Tenant isolation policy strictly prohibits editing drafts or replacing verification files belonging to ${activity.lgaName} LGA.`,
    };
  }

  if (activity.status === 'PENDING_APPROVAL') {
    return {
      canEdit: false,
      reasonCode: 'STATUS_PENDING_APPROVAL',
      title: 'Record Locked — In State Executive Review Queue',
      explanation:
        'This report has been submitted for State Executive review (PENDING_APPROVAL) and is read-only in the draft editor so the dossier remains consistent during cabinet verification.',
    };
  }

  if (activity.status === 'PUBLISHED') {
    return {
      canEdit: false,
      reasonCode: 'STATUS_PUBLISHED',
      title: 'Record Locked — Published & Immutable',
      explanation:
        'Published records (PUBLISHED) are cryptographically and policy-locked on the State Transparency Portal. To revise this entry, a State Super-Administrator must first unlock and revert it to DRAFT.',
    };
  }

  return {
    canEdit: true,
    reasonCode: 'ALLOWED',
    title:
      activity.status === 'REJECTED_DRAFT'
        ? 'Editable Returned Report (Correction Mode)'
        : 'Editable LGA Activity Draft',
    explanation:
      activity.status === 'REJECTED_DRAFT'
        ? 'This report was returned by State Reviewers. You can update fields, replace individual verification files, and save your corrections.'
        : 'Authorized draft mode. Changes are saved directly to this existing activity record without duplicating the entry.',
  };
}

/**
 * Delete an evidence object from Supabase storage (for cleanup on failed database writes or superseded asset replacement).
 * Never deletes objects in live storage when in Demo mode.
 * Distinguishes storage RLS policy restrictions so callers can safely report administrative cleanup without failing.
 */
export async function deleteEvidenceFromStorage(
  storagePath: string,
  userSession?: UserSession
): Promise<{ success: boolean; policyRestricted?: boolean; demoBlocked?: boolean; error?: string }> {
  if (userSession?.isDemo) {
    return {
      success: false,
      demoBlocked: true,
      error: 'Demo Mode: Live Supabase storage deletion is disabled in sandbox demo mode.',
    };
  }
  // Storage mutation helpers must fail closed when caller identity/privilege is absent.
  if (!userSession || !userSession.isAuthenticated || !userSession.isPrivileged) {
    return {
      success: false,
      policyRestricted: true,
      error: 'Unauthorized: active government clearance is required to delete evidence.',
    };
  }
  const client = getSupabaseClient();
  if (!client || isSupabaseUnreachable()) {
    return { success: false, error: 'Supabase storage unavailable' };
  }
  try {
    const clean = cleanStoragePath(storagePath);
    if (!clean) {
      return { success: false, error: 'Empty storage path' };
    }
    if (userSession.role === 'lga_admin' && userSession.assignedLgaId) {
      const pathLga = clean.split('/')[0];
      if (pathLga !== userSession.assignedLgaId && pathLga !== 'state-level') {
        return {
          success: false,
          policyRestricted: true,
          error: `Cross-LGA deletion violation: Desk worker for ${userSession.assignedLgaId} cannot delete evidence from ${pathLga}.`,
        };
      }
    }
    const { error } = await client.storage.from('hcd-evidence-vault').remove([clean]);
    if (error) {
      const lower = (error.message || '').toLowerCase();
      const status = String((error as any).statusCode || (error as any).status || '');
      const isPolicy =
        status === '401' ||
        status === '403' ||
        status === '42501' ||
        lower.includes('permission') ||
        lower.includes('policy') ||
        lower.includes('row-level security') ||
        lower.includes('unauthorized') ||
        lower.includes('not allowed');

      return {
        success: false,
        policyRestricted: isPolicy,
        error: isPolicy
          ? `Storage policy retains superseded object (${clean}) for administrative cleanup.`
          : error.message,
      };
    }
    invalidateMediaCache(clean);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to delete storage file' };
  }
}

