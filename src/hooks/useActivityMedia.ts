import { useState, useEffect, useCallback, useRef } from 'react';
import {
  resolveActivityMedia,
  invalidateMediaCache,
  ResolvedMediaResult,
  MediaResolutionStatus,
  ResolvableMediaInput,
  FALLBACK_MEDIA_PLACEHOLDER_SIGNAL,
  FallbackPlaceholderSignal,
} from '../lib/mediaResolver';

export interface UseActivityMediaOptions {
  autoResolve?: boolean;
  expiresInSeconds?: number;
}

export interface UseActivityMediaReturn {
  result: ResolvedMediaResult;
  url: string | null;
  status: MediaResolutionStatus;
  fallbackPlaceholder: FallbackPlaceholderSignal;
  useFallbackPlaceholder: boolean;
  isLoading: boolean;
  isError: boolean;
  isDocument: boolean;
  isGeotagValid: boolean;
  retry: () => Promise<void>;
  handleImageError: () => void;
}

const DEFAULT_RESULT: ResolvedMediaResult = {
  status: 'idle',
  url: null,
  signedUrl: null,
  storagePath: null,
  fallbackPlaceholder: null,
  useFallbackPlaceholder: false,
  isDocument: false,
  isPrivateStorage: false,
  isGeotagValid: false,
};

// Shared hook-level memoization map so multiple components or React StrictMode mounts
// rendering the same media item do not trigger duplicate initial resolution calls
const initialHookResolutionCache = new Map<string, Promise<ResolvedMediaResult>>();

function getMediaIdentityKey(media?: ResolvableMediaInput): string {
  if (!media) return '';
  if (typeof media === 'string') return media.trim();
  const storagePath =
    ('storagePath' in media && media.storagePath) ||
    ('file_path' in media && media.file_path) ||
    '';
  const url = ('url' in media && media.url) || '';
  const fileName =
    ('fileName' in media && media.fileName) ||
    ('file_name' in media && media.file_name) ||
    '';
  const type = ('type' in media && media.type) || '';
  return `${storagePath}|${url}|${fileName}|${type}`;
}

export function useActivityMedia(
  media?: ResolvableMediaInput,
  options: UseActivityMediaOptions = {}
): UseActivityMediaReturn {
  const [result, setResult] = useState<ResolvedMediaResult>(DEFAULT_RESULT);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const errorRetryAttemptedRef = useRef<boolean>(false);
  const mediaRef = useRef<ResolvableMediaInput>(media);
  mediaRef.current = media;

  const mediaKey = getMediaIdentityKey(media);

  const resolve = useCallback(
    async (forceRefresh = false) => {
      const currentMedia = mediaRef.current;
      if (!currentMedia || !mediaKey) {
        setResult({
          status: 'empty',
          url: null,
          signedUrl: null,
          storagePath: null,
          fallbackPlaceholder: FALLBACK_MEDIA_PLACEHOLDER_SIGNAL,
          useFallbackPlaceholder: true,
          isDocument: false,
          isPrivateStorage: false,
          isGeotagValid: false,
        });
        return;
      }

      setIsLoading(true);
      try {
        let resolutionPromise: Promise<ResolvedMediaResult>;
        if (!forceRefresh && initialHookResolutionCache.has(mediaKey)) {
          resolutionPromise = initialHookResolutionCache.get(mediaKey)!;
        } else {
          if (forceRefresh) {
            initialHookResolutionCache.delete(mediaKey);
          }
          resolutionPromise = resolveActivityMedia(currentMedia, {
            forceRefresh,
            expiresInSeconds: options.expiresInSeconds,
          });
          if (!forceRefresh) {
            initialHookResolutionCache.set(mediaKey, resolutionPromise);
          }
        }

        const res = await resolutionPromise;
        setResult(res);
      } catch (err: any) {
        setResult({
          status: 'error',
          url: null,
          signedUrl: null,
          storagePath: null,
          fallbackPlaceholder: FALLBACK_MEDIA_PLACEHOLDER_SIGNAL,
          useFallbackPlaceholder: true,
          isDocument: false,
          isPrivateStorage: false,
          error: err.message || 'Media resolution failed',
          isGeotagValid: false,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [mediaKey, options.expiresInSeconds]
  );

  useEffect(() => {
    if (options.autoResolve !== false) {
      errorRetryAttemptedRef.current = false;
      resolve(false);
    }
  }, [resolve, options.autoResolve]);

  const retry = useCallback(async () => {
    if (result.storagePath) {
      invalidateMediaCache(result.storagePath);
    }
    if (mediaKey) {
      initialHookResolutionCache.delete(mediaKey);
    }
    await resolve(true);
  }, [resolve, result.storagePath, mediaKey]);

  // Handler for <img onError>: attempt 1 token refresh if storagePath is present; otherwise fail permanently to prevent infinite loops
  const handleImageError = useCallback(() => {
    if (result.storagePath && !errorRetryAttemptedRef.current) {
      errorRetryAttemptedRef.current = true;
      invalidateMediaCache(result.storagePath);
      if (mediaKey) {
        initialHookResolutionCache.delete(mediaKey);
      }
      resolve(true);
    } else {
      // Switch permanently to error/missing status without triggering more image loads
      setResult((prev) => ({
        ...prev,
        status: 'error',
        url: null,
        signedUrl: null,
        fallbackPlaceholder: FALLBACK_MEDIA_PLACEHOLDER_SIGNAL,
        useFallbackPlaceholder: true,
        error: 'Image failed to load in browser.',
      }));
    }
  }, [result.storagePath, resolve, mediaKey]);

  const isError =
    result.status === 'error' ||
    result.status === 'missing_file' ||
    result.status === 'unauthorized' ||
    result.status === 'legacy_local_invalid';

  return {
    result,
    url: result.url,
    status: result.status,
    fallbackPlaceholder: result.fallbackPlaceholder ?? (result.url ? null : FALLBACK_MEDIA_PLACEHOLDER_SIGNAL),
    useFallbackPlaceholder: Boolean(result.useFallbackPlaceholder || !result.url),
    isLoading,
    isError,
    isDocument: result.isDocument,
    isGeotagValid: result.isGeotagValid,
    retry,
    handleImageError,
  };
}
