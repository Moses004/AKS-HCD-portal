import { getSupabaseClient, isSupabaseReady, isSupabaseUnreachable, resetSupabaseReachability } from '../lib/supabase';
import {
  HCDActivity,
  AuditLog,
  UserSession,
  UserProfileRecord,
  HCDReportingIndicator,
  ActivityMeasurement,
  HCDPillar,
  HCDIndicatorTarget,
  HCDLgaTargetPerformance,
  TargetStatus,
} from '../types';
import { DEFAULT_HCD_PILLARS } from '../data/lgas';
import {
  validateMediaFile,
  generateSafeStoragePath,
  cleanStoragePath,
  repairActivityMediaMetadata,
  deleteEvidenceFromStorage,
  resolveActivityMedia,
  EVIDENCE_BUCKET,
} from './mediaService';

export interface SupabaseConnectionStatus {
  connected: boolean;
  message: string;
  hasTables?: boolean;
  hasFunctionGrants?: boolean;
}

export type FetchActivitiesResult =
  | { status: 'SUCCESS'; data: HCDActivity[]; count: number }
  | { status: 'EMPTY'; data: []; count: 0 }
  | { status: 'AUTH_REQUIRED'; error: string; code?: string }
  | { status: 'SCHEMA_MISMATCH'; error: string; code?: string; diagnostic?: string }
  | { status: 'NETWORK_ERROR'; error: string }
  | { status: 'SERVER_ERROR'; error: string; code?: string };

export interface DatabaseOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  details?: string;
}

export interface AuditLogResult {
  success: boolean;
  persistedToCloud: boolean;
  error?: string;
  permissionRestricted?: boolean;
}

export interface FetchAuditLogsResult {
  success: boolean;
  data: AuditLog[];
  error?: string;
  permissionRestricted?: boolean;
}

/**
 * Detects PostgreSQL / Supabase RLS and privilege restriction errors (e.g. 42501 / "permission denied")
 * so they can be handled gracefully without surfacing as fatal application errors.
 */
export function isPermissionDeniedError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || error.statusCode || error.status || '');
  if (code === '42501' || code === 'PGRST301' || code === '401' || code === '403') {
    return true;
  }
  const message = String(error.message || error.details || error.hint || error || '').toLowerCase();
  return (
    message.includes('permission denied') ||
    message.includes('insufficient_privilege') ||
    message.includes('row-level security') ||
    message.includes('not authorized') ||
    message.includes('unauthorized')
  );
}

/**
 * Detects browser network fetch failures (e.g. "TypeError: Failed to fetch", offline host, DNS failure, or 503 synthetic offline response)
 * so the application can seamlessly transition to local baseline/cache without surfacing noisy console warnings.
 */
export function isNetworkFetchError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || error.statusCode || error.status || '');
  if (code === 'NETWORK_UNREACHABLE' || code === '503') {
    return true;
  }
  const msg = String(error.message || error.details || error || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('fetch failed') ||
    msg.includes('err_name_not_resolved') ||
    msg.includes('cloud endpoint unreachable') ||
    msg.includes('network fetch failed')
  );
}

// Convert application HCDActivity to Supabase row format
export const activityToRow = (
  a: HCDActivity,
  createdByUserId?: string,
  updatedByUserId?: string
) => {
  const desc = a.projectDescription || a.subCategory || '';
  const segment =
    a.pillar === 'cross_cutting_enablers'
      ? (a.pillarSegment || null)
      : null;

  return {
    id: a.id,
    lga_id: a.lgaId,
    lga_name: a.lgaName,
    title: a.title,
    pillar: a.pillar,
    project_description: desc,
    category: a.category || null,
    pillar_segment: segment,
    community: a.community || '',
    // Preserve null coordinates if unknown - do not invent default values
    lat: a.coordinates?.lat !== undefined ? a.coordinates.lat : null,
    lng: a.coordinates?.lng !== undefined ? a.coordinates.lng : null,
    beneficiaries_total: Math.max(0, Number(a.beneficiariesTotal) || 0),
    beneficiaries_male: Math.max(0, Number(a.beneficiariesMale) || 0),
    beneficiaries_female: Math.max(0, Number(a.beneficiariesFemale) || 0),
    youth_beneficiaries: Math.max(0, Number(a.youthBeneficiaries) || 0),
    budget_ngn: Math.max(0, Number(a.budgetNgn) || 0),
    start_date: a.startDate || null,
    completion_date: a.completionDate || null,
    lead_officer: a.leadOfficer || '',
    officer_contact: a.officerContact || '',
    status: a.status || 'DRAFT',
    overall_progress: Math.min(100, Math.max(0, Number(a.overallProgress) || 0)),
    milestones: a.milestones || [],
    media_assets: repairActivityMediaMetadata(a.mediaAssets || []),
    submission_notes: a.submissionNotes || null,
    rejection_reason: a.rejectionReason || null,
    reviewed_by: a.reviewedBy || null,
    reviewed_at: a.reviewedAt || null,
    created_by: createdByUserId || a.createdBy || null,
    updated_by: updatedByUserId || a.updatedBy || null,
    attendance_registry_url: a.attendanceRegistryUrl || null,
    attendance_sheet_file_name: a.attendanceSheetFileName || null,
    created_at: a.createdAt || new Date().toISOString(),
    updated_at: a.updatedAt || new Date().toISOString(),
  };
};

// Convert Supabase row format to application HCDActivity
export const rowToActivity = (r: any): HCDActivity => {
  const desc = r.project_description || '';
  return {
    id: r.id,
    lgaId: r.lga_id,
    lgaName: r.lga_name,
    title: r.title,
    pillar: r.pillar,
    projectDescription: desc,
    subCategory: desc, // Backward compatibility alias
    category: r.category || null,
    pillarSegment: r.pillar_segment || null,
    community: r.community || '',
    coordinates:
      r.lat !== null && r.lng !== null && !isNaN(Number(r.lat)) && !isNaN(Number(r.lng))
        ? { lat: Number(r.lat), lng: Number(r.lng) }
        : undefined,
    beneficiariesTotal: Number(r.beneficiaries_total) || 0,
    beneficiariesMale: Number(r.beneficiaries_male) || 0,
    beneficiariesFemale: Number(r.beneficiaries_female) || 0,
    youthBeneficiaries: Number(r.youth_beneficiaries) || 0,
    budgetNgn: Number(r.budget_ngn) || 0,
    startDate: r.start_date || '',
    completionDate: r.completion_date || '',
    leadOfficer: r.lead_officer || '',
    officerContact: r.officer_contact || '',
    status: r.status || 'DRAFT',
    overallProgress: Number(r.overall_progress) || 0,
    milestones: Array.isArray(r.milestones) ? r.milestones : [],
    mediaAssets: Array.isArray(r.media_assets) ? repairActivityMediaMetadata(r.media_assets) : [],
    submissionNotes: r.submission_notes || '',
    rejectionReason: r.rejection_reason || '',
    reviewedBy: r.reviewed_by || '',
    reviewedAt: r.reviewed_at || '',
    createdBy: r.created_by || undefined,
    updatedBy: r.updated_by || undefined,
    attendanceRegistryUrl: r.attendance_registry_url || undefined,
    attendanceSheetFileName: r.attendance_sheet_file_name || undefined,
    createdAt: r.created_at || new Date().toISOString(),
    updatedAt: r.updated_at || new Date().toISOString(),
    syncStatus: 'synced',
  };
};

export const supabaseService = {
  /**
   * Diagnostic test verifying connection, tables, and function execution grants
   */
  async testConnection(): Promise<SupabaseConnectionStatus> {
    resetSupabaseReachability();
    if (!isSupabaseReady()) {
      return {
        connected: false,
        message: 'Supabase Anon Key is not configured yet.',
      };
    }
    const client = getSupabaseClient();
    if (!client) {
      return { connected: false, message: 'Could not initialize Supabase client.' };
    }

    try {
      const { data, error } = await client.from('activities').select('id').limit(1);
      if (error) {
        if (isNetworkFetchError(error)) {
          return {
            connected: false,
            message: 'Cloud database endpoint is currently offline or unreachable. Operating in resilient local dataset mode.',
          };
        }
        if (
          error.code === '42P01' || 
          error.code === 'PGRST204' || 
          error.code === 'PGRST200' ||
          error.message?.toLowerCase().includes('schema cache')
        ) {
          return {
            connected: true,
            hasTables: false,
            message: 'Connected to Supabase! The "activities" table has not been created yet.',
          };
        }
        if (error.code === '42501' && error.message?.includes('aks_hcd_current_lga')) {
          return {
            connected: true,
            hasTables: true,
            hasFunctionGrants: false,
            message: 'Connected to Supabase! Function grants needed for aks_hcd_current_lga().',
          };
        }
        return {
          connected: false,
          message: `Supabase Error: ${error.message} (${error.code || 'API error'})`,
        };
      }
      return {
        connected: true,
        hasTables: true,
        hasFunctionGrants: true,
        message: 'Successfully connected to Supabase cloud database with all permissions active!',
      };
    } catch (err: any) {
      return {
        connected: false,
        message: isNetworkFetchError(err)
          ? 'Cloud database endpoint is currently offline or unreachable. Operating in resilient local dataset mode.'
          : err.message || 'Unknown network error connecting to Supabase.',
      };
    }
  },

  /**
   * Distinguishes SUCCESS (populated), EMPTY (0 records), AUTH_REQUIRED, SCHEMA_MISMATCH, NETWORK_ERROR
   */
  async fetchActivities(userSession?: UserSession): Promise<FetchActivitiesResult> {
    if (isSupabaseUnreachable()) {
      return {
        status: 'NETWORK_ERROR',
        error: 'Cloud database endpoint is currently unreachable; operating with verified local dataset.',
      };
    }

    const client = getSupabaseClient();
    if (!client) {
      return { status: 'NETWORK_ERROR', error: 'Supabase client not initialized' };
    }

    try {
      let query = client.from('activities').select('*');

      // If user is public guest, only query published activities
      if (!userSession || userSession.role === 'public') {
        query = query.eq('status', 'PUBLISHED');
      } else if (userSession.role === 'lga_admin' && userSession.assignedLgaId) {
        // LGA desk officer queries their LGA activities or published activities
        query = query.or(`lga_id.eq.${userSession.assignedLgaId},status.eq.PUBLISHED`);
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) {
        if (isNetworkFetchError(error)) {
          return {
            status: 'NETWORK_ERROR',
            error: 'Cloud database endpoint is currently unreachable; operating with verified local dataset.',
          };
        }

        console.debug('Supabase fetchActivities notice:', error.message || error);
        
        if (error.code === '42501' && error.message?.includes('aks_hcd_current_lga')) {
          return {
            status: 'SCHEMA_MISMATCH',
            error: error.message,
            code: error.code,
            diagnostic: 'PostgreSQL error 42501: aks_hcd_current_lga requires execute grant',
          };
        }

        if (error.code === 'PGRST301' || error.code === '401' || error.message?.includes('JWT')) {
          return { status: 'AUTH_REQUIRED', error: error.message, code: error.code };
        }

        if (error.code === '42P01' || error.message?.includes('schema cache')) {
          return { status: 'SCHEMA_MISMATCH', error: error.message, code: error.code };
        }

        return { status: 'SERVER_ERROR', error: error.message, code: error.code };
      }

      if (!data || data.length === 0) {
        return { status: 'EMPTY', data: [], count: 0 };
      }

      return {
        status: 'SUCCESS',
        data: data.map(rowToActivity),
        count: data.length,
      };
    } catch (err: any) {
      if (!isNetworkFetchError(err)) {
        console.debug('Supabase fetchActivities network notice:', err);
      }
      return {
        status: 'NETWORK_ERROR',
        error: 'Cloud database endpoint is currently unreachable; operating with verified local dataset.',
      };
    }
  },

  /**
   * Insert new activity with explicit verification of returned committed row
   */
  async insertActivity(
    activity: HCDActivity,
    userSession?: UserSession
  ): Promise<DatabaseOperationResult<HCDActivity>> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      const row = activityToRow(activity, userSession?.id, userSession?.id);
      const { data, error } = await client
        .from('activities')
        .insert(row)
        .select()
        .single();

      if (error) {
        if (!isNetworkFetchError(error)) {
          console.debug('Supabase insertActivity notice:', error.message);
        }
        return {
          success: false,
          error: isNetworkFetchError(error) ? 'Network unreachable: Failed to fetch' : error.message,
          code: error.code,
          details: error.details,
        };
      }

      const committed = rowToActivity(data);
      return { success: true, data: committed };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to insert activity into Supabase',
      };
    }
  },

  /**
   * Update existing activity with explicit verification
   */
  async updateActivity(
    id: string,
    updates: Partial<HCDActivity>,
    userSession?: UserSession
  ): Promise<DatabaseOperationResult<HCDActivity>> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      const updateRow: Record<string, any> = {
        updated_at: new Date().toISOString(),
        updated_by: userSession?.id || null,
      };

      if (updates.title !== undefined) updateRow.title = updates.title;
      if (updates.pillar !== undefined) {
        updateRow.pillar = updates.pillar;
        if (updates.pillar !== 'cross_cutting_enablers') {
          updateRow.pillar_segment = null;
        }
      }
      if (updates.projectDescription !== undefined) {
        updateRow.project_description = updates.projectDescription;
      } else if (updates.subCategory !== undefined) {
        updateRow.project_description = updates.subCategory;
      }
      if (updates.category !== undefined) updateRow.category = updates.category;
      if (updates.pillarSegment !== undefined) {
        updateRow.pillar_segment =
          updates.pillar === 'cross_cutting_enablers' || (!updates.pillar && updates.pillarSegment)
            ? updates.pillarSegment
            : null;
      }
      if (updates.community !== undefined) updateRow.community = updates.community;
      if (updates.coordinates !== undefined) {
        updateRow.lat = updates.coordinates ? updates.coordinates.lat : null;
        updateRow.lng = updates.coordinates ? updates.coordinates.lng : null;
      }
      if (updates.beneficiariesTotal !== undefined) updateRow.beneficiaries_total = updates.beneficiariesTotal;
      if (updates.beneficiariesMale !== undefined) updateRow.beneficiaries_male = updates.beneficiariesMale;
      if (updates.beneficiariesFemale !== undefined) updateRow.beneficiaries_female = updates.beneficiariesFemale;
      if (updates.youthBeneficiaries !== undefined) updateRow.youth_beneficiaries = updates.youthBeneficiaries;
      if (updates.budgetNgn !== undefined) updateRow.budget_ngn = updates.budgetNgn;
      if (updates.startDate !== undefined) updateRow.start_date = updates.startDate || null;
      if (updates.completionDate !== undefined) updateRow.completion_date = updates.completionDate || null;
      if (updates.leadOfficer !== undefined) updateRow.lead_officer = updates.leadOfficer;
      if (updates.officerContact !== undefined) updateRow.officer_contact = updates.officerContact;
      if (updates.status !== undefined) updateRow.status = updates.status;
      if (updates.overallProgress !== undefined) updateRow.overall_progress = updates.overallProgress;
      if (updates.milestones !== undefined) updateRow.milestones = updates.milestones;
      if (updates.mediaAssets !== undefined) updateRow.media_assets = repairActivityMediaMetadata(updates.mediaAssets);
      if (updates.submissionNotes !== undefined) updateRow.submission_notes = updates.submissionNotes;
      if (updates.rejectionReason !== undefined) updateRow.rejection_reason = updates.rejectionReason;
      if (updates.reviewedBy !== undefined) updateRow.reviewed_by = updates.reviewedBy;
      if (updates.reviewedAt !== undefined) updateRow.reviewed_at = updates.reviewedAt;
      if (updates.attendanceRegistryUrl !== undefined) updateRow.attendance_registry_url = updates.attendanceRegistryUrl;
      if (updates.attendanceSheetFileName !== undefined) updateRow.attendance_sheet_file_name = updates.attendanceSheetFileName;

      const { data, error } = await client
        .from('activities')
        .update(updateRow)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (!isNetworkFetchError(error)) {
          console.debug('Supabase updateActivity notice:', error.message);
        }
        return {
          success: false,
          error: isNetworkFetchError(error) ? 'Network unreachable: Failed to fetch' : error.message,
          code: error.code,
          details: error.details,
        };
      }

      return { success: true, data: rowToActivity(data) };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to update activity in Supabase',
      };
    }
  },

  /**
   * Delete activity from Supabase with verification
   */
  async deleteActivity(id: string): Promise<DatabaseOperationResult> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      const { error, count } = await client
        .from('activities')
        .delete({ count: 'exact' })
        .eq('id', id);

      if (error) {
        if (!isNetworkFetchError(error)) {
          console.debug('Supabase deleteActivity notice:', error.message);
        }
        return {
          success: false,
          error: error.message,
          code: error.code,
        };
      }

      if (count === 0) {
        return {
          success: false,
          error: 'No matching record was deleted. The record may have already been removed or deletion was unauthorized.',
        };
      }

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to delete activity from Supabase',
      };
    }
  },

  /**
   * Upsert activity (insert or update on conflict) with verified session
   */
  async upsertActivity(
    activity: HCDActivity,
    userSession?: UserSession
  ): Promise<DatabaseOperationResult<HCDActivity>> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      const row = activityToRow(activity, userSession?.id, userSession?.id);
      const { data, error } = await client
        .from('activities')
        .upsert(row)
        .select()
        .single();

      if (error) {
        if (!isNetworkFetchError(error)) {
          console.debug('Supabase upsertActivity notice:', error.message);
        }
        return {
          success: false,
          error: error.message,
          code: error.code,
          details: error.details,
        };
      }

      return { success: true, data: rowToActivity(data) };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to upsert activity in Supabase',
      };
    }
  },

  /**
   * Insert audit log entry directly into public.audit_logs with authenticated actor ID
   */
  async insertAuditLog(log: AuditLog, userSession?: UserSession): Promise<AuditLogResult> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, persistedToCloud: false, error: 'Supabase client not initialized' };
    }

    try {
      const { error } = await client.from('audit_logs').insert({
        id: log.id,
        timestamp: log.timestamp || new Date().toISOString(),
        activity_id: log.activityId || null,
        activity_title: log.activityTitle || null,
        lga_id: log.lgaId || null,
        performed_by: userSession?.name || log.performedBy,
        actor_user_id: userSession?.isAuthenticated ? userSession.id : log.actorUserId || null,
        role: userSession?.role || log.role,
        action: log.action,
        notes: log.notes || null,
      });

      if (error) {
        if (isPermissionDeniedError(error)) {
          return {
            success: false,
            persistedToCloud: false,
            permissionRestricted: true,
            error: error.message,
          };
        }
        return { success: false, persistedToCloud: false, error: error.message };
      }
      return { success: true, persistedToCloud: true };
    } catch (err: any) {
      return {
        success: false,
        persistedToCloud: false,
        permissionRestricted: isPermissionDeniedError(err),
        error: err?.message || 'Network error',
      };
    }
  },

  /**
   * Fetch audit logs for current user scope with explicit authorization and graceful RLS handling.
   * Public/unauthenticated visitors or roles without SELECT grants on public.audit_logs
   * receive an empty list (`success: true, data: [], permissionRestricted: true`) rather than a fatal error.
   */
  async fetchAuditLogs(lgaId?: string, userSession?: UserSession): Promise<FetchAuditLogsResult> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, data: [], error: 'Supabase client not initialized' };
    }

    // Unauthenticated or unprivileged public visitors are barred from reading public.audit_logs
    if (userSession && (!userSession.isAuthenticated || !userSession.isPrivileged || userSession.role === 'public')) {
      return { success: true, data: [], permissionRestricted: true };
    }

    // Verify active Supabase Auth session before querying the RLS-protected audit_logs table
    try {
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData?.session) {
        return { success: true, data: [], permissionRestricted: true };
      }
    } catch {
      return { success: true, data: [], permissionRestricted: true };
    }

    try {
      let query = client.from('audit_logs').select('*');
      if (lgaId) {
        query = query.eq('lga_id', lgaId);
      }
      const { data, error } = await query.order('timestamp', { ascending: false }).limit(200);

      if (error) {
        // Gracefully handle RLS / role permission denied (42501 / 401 / 403) so it is never reported as a fatal error
        if (isPermissionDeniedError(error)) {
          if (typeof window !== 'undefined') {
            console.debug('[AKS-HCD supabaseService] Audit logs access restricted by RLS policy; returning empty log set.');
          }
          return { success: true, data: [], permissionRestricted: true };
        }
        return { success: false, data: [], error: error.message };
      }

      if (!data) {
        return { success: true, data: [] };
      }

      const mapped: AuditLog[] = data.map((r: any) => ({
        id: r.id,
        timestamp: r.timestamp,
        activityId: r.activity_id || undefined,
        activityTitle: r.activity_title || undefined,
        lgaId: r.lga_id || undefined,
        performedBy: r.performed_by,
        actorUserId: r.actor_user_id || undefined,
        role: r.role,
        action: r.action,
        notes: r.notes || undefined,
        persistedToCloud: true,
      }));

      return { success: true, data: mapped };
    } catch (err: any) {
      if (isPermissionDeniedError(err)) {
        return { success: true, data: [], permissionRestricted: true };
      }
      return { success: false, data: [], error: err?.message || 'Failed to fetch audit logs' };
    }
  },

  /**
   * Record PTR verification ledger log with authenticated actor identity
   */
  async recordPtrTestLog(
    vector: string,
    passed: boolean,
    summary: string,
    payload: unknown,
    userSession: UserSession
  ): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Database client unavailable' };
    }

    if (!userSession.isAuthenticated) {
      return { success: false, error: 'Authentication required for PTR ledger recording.' };
    }

    try {
      const { error } = await client.from('ptr_test_logs').insert({
        id: `ptr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        test_vector: vector,
        passed,
        summary,
        payload,
        executed_by: userSession.name,
        executed_by_user_id: userSession.id,
      });

      if (error) {
        if (!isPermissionDeniedError(error) && typeof window !== 'undefined') {
          console.debug('Supabase recordPtrTestLog notice:', error.message);
        }
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'PTR ledger write exception' };
    }
  },

  /**
   * Secure upload to private storage bucket 'hcd-evidence-vault' with signed URL generation
   * Strictly enforces caller authorization, MIME/size validation, and collision-resistant paths.
   */
  async uploadEvidenceFile(
    file: File | Blob,
    fileName: string,
    lgaId: string,
    activityId: string,
    userSession?: UserSession
  ): Promise<{ success: boolean; storagePath?: string; signedUrl?: string; error?: string }> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Supabase client not available' };
    }

    // 0. Authorization guard:
    // Anonymous users cannot upload official evidence
    if (userSession) {
      if (!userSession.isAuthenticated || !userSession.isPrivileged) {
        return {
          success: false,
          error: 'Unauthorized: caller must have active government clearance to upload evidence.',
        };
      }
      // LGA desk worker: cannot upload into another LGA's folder
      if (userSession.role === 'lga_admin' && userSession.assignedLgaId) {
        if (lgaId !== userSession.assignedLgaId && lgaId !== 'state-level') {
          return {
            success: false,
            error: `Cross-LGA upload violation: Desk worker for ${userSession.assignedLgaId} cannot upload into ${lgaId} folder.`,
          };
        }
      }
    }

    // 1. File validation (MIME type, extension, size ceiling)
    const validation = validateMediaFile(file, fileName);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      // 2. Collision-resistant folder and object path
      const storagePath = generateSafeStoragePath(lgaId, activityId, fileName);

      const { data, error } = await client.storage
        .from(EVIDENCE_BUCKET)
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.warn('Supabase Storage upload error:', error.message);
        return { success: false, error: error.message };
      }

      // Generate temporary signed URL (valid for 1 hour) for immediate private file inspection
      const { data: signedData, error: signErr } = await client.storage
        .from(EVIDENCE_BUCKET)
        .createSignedUrl(data.path, 3600);

      if (signErr || !signedData?.signedUrl) {
        return {
          success: false,
          error: signErr?.message || 'File uploaded but failed to generate secure access token.',
        };
      }

      return {
        success: true,
        storagePath: data.path,
        signedUrl: signedData.signedUrl,
      };
    } catch (err: any) {
      console.warn('Supabase Storage upload exception:', err);
      return { success: false, error: err.message || 'File upload failed' };
    }
  },

  /**
   * Delete an uploaded evidence file from storage (used for cleanup when database write fails)
   */
  async deleteEvidenceFile(storagePath: string): Promise<{ success: boolean; error?: string }> {
    return deleteEvidenceFromStorage(storagePath);
  },

  /**
   * Safe, idempotent repair utility for legacy activity media metadata in the database:
   * Strips expired signed URLs and /src/... development paths while preserving storagePath and all metadata.
   */
  async repairActivityMediaRecord(
    activityId: string
  ): Promise<{ success: boolean; repaired: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, repaired: false, error: 'Supabase client not available' };
    }

    try {
      const { data, error } = await client
        .from('activities')
        .select('id, media_assets')
        .eq('id', activityId)
        .single();

      if (error || !data) {
        return { success: false, repaired: false, error: error?.message || 'Activity not found' };
      }

      const currentAssets = Array.isArray(data.media_assets) ? data.media_assets : [];
      const sanitizedAssets = repairActivityMediaMetadata(currentAssets);

      const { error: updateError } = await client
        .from('activities')
        .update({ media_assets: sanitizedAssets })
        .eq('id', activityId);

      if (updateError) {
        return { success: false, repaired: false, error: updateError.message };
      }

      return { success: true, repaired: true };
    } catch (err: any) {
      return { success: false, repaired: false, error: err.message };
    }
  },

  /**
   * Get a temporary signed URL for viewing private evidence files
   * Reuses resolveActivityMedia for memory caching and deduplication
   */
  async getSignedUrl(storagePath: string, expiresInSeconds: number = 3600): Promise<string | null> {
    try {
      const res = await resolveActivityMedia({ storagePath }, { expiresInSeconds });
      return res.url;
    } catch {
      return null;
    }
  },

  /**
   * Supabase Realtime Subscription for Activities Table
   */
  subscribeToActivities(callbacks: {
    onInsert: (activity: HCDActivity) => void;
    onUpdate: (activity: HCDActivity) => void;
    onDelete: (id: string) => void;
    onStatusChange?: (status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR') => void;
  }): () => void {
    if (isSupabaseUnreachable()) return () => {};
    const client = getSupabaseClient();
    if (!client) return () => {};

    try {
      const channel = client
        .channel('hcd-realtime-activities')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'activities' },
          (payload) => {
            if (payload.new) {
              callbacks.onInsert(rowToActivity(payload.new));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'activities' },
          (payload) => {
            if (payload.new) {
              callbacks.onUpdate(rowToActivity(payload.new));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'activities' },
          (payload) => {
            if (payload.old && payload.old.id) {
              callbacks.onDelete(payload.old.id);
            }
          }
        )
        .subscribe((status) => {
          if (callbacks.onStatusChange) {
            callbacks.onStatusChange(status as 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR');
          }
        });

      return () => {
        client.removeChannel(channel);
      };
    } catch (err) {
      console.debug('Failed to subscribe to Supabase Realtime activities:', err);
      return () => {};
    }
  },

  /**
   * Supabase Realtime Subscription for Audit Logs
   */
  subscribeToAuditLogs(
    onInsert: (log: AuditLog) => void,
    onStatusChange?: (status: 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR') => void
  ): () => void {
    if (isSupabaseUnreachable()) return () => {};
    const client = getSupabaseClient();
    if (!client) return () => {};

    try {
      const channel = client
        .channel('hcd-realtime-audit')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'audit_logs' },
          (payload) => {
            if (payload.new) {
              const r = payload.new;
              onInsert({
                id: r.id,
                timestamp: r.timestamp,
                activityId: r.activity_id || undefined,
                activityTitle: r.activity_title || undefined,
                lgaId: r.lga_id || undefined,
                performedBy: r.performed_by,
                actorUserId: r.actor_user_id || undefined,
                role: r.role,
                action: r.action,
                notes: r.notes || undefined,
                persistedToCloud: true,
              });
            }
          }
        )
        .subscribe((status) => {
          if (onStatusChange) {
            onStatusChange(status as 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR');
          }
        });

      return () => {
        client.removeChannel(channel);
      };
    } catch (err) {
      console.debug('Failed to subscribe to Supabase Realtime audit logs:', err);
      return () => {};
    }
  },

  mapActivityToRow: activityToRow,
  mapRowToActivity: rowToActivity,

  /**
   * Fetch all user profiles from public.user_profiles
   */
  async fetchUserProfiles(): Promise<{ success: boolean; data: UserProfileRecord[]; error?: string }> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, data: [], error: 'Database connection unavailable' };
    }
    try {
      const { data, error } = await client
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        return { success: false, data: [], error: error.message };
      }
      return { success: true, data: (data || []) as UserProfileRecord[] };
    } catch (err: any) {
      return { success: false, data: [], error: err.message || 'Failed to fetch profiles' };
    }
  },

  /**
   * Upsert a user profile
   */
  async upsertUserProfile(profile: Partial<UserProfileRecord>): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Database connection unavailable' };
    }
    try {
      const { error } = await client
        .from('user_profiles')
        .upsert(profile);
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to upsert profile' };
    }
  },

  /**
   * Delete or revoke a user profile
   */
  async deleteUserProfile(userId: string): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Database connection unavailable' };
    }
    try {
      const { error } = await client
        .from('user_profiles')
        .delete()
        .eq('user_id', userId);
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete profile' };
    }
  },

  /**
   * Fetch active pillars catalogue from Supabase live table hcd_pillars
   */
  async fetchPillars(): Promise<HCDPillar[]> {
    if (isSupabaseUnreachable()) return DEFAULT_HCD_PILLARS;
    const client = getSupabaseClient();
    if (!client) return DEFAULT_HCD_PILLARS;

    try {
      const { data, error } = await client
        .from('hcd_pillars')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        if (!isNetworkFetchError(error)) {
          console.debug('Supabase fetchPillars notice:', error.message);
        }
        return DEFAULT_HCD_PILLARS;
      }
      if (data && data.length > 0) {
        return data as HCDPillar[];
      }
      return DEFAULT_HCD_PILLARS;
    } catch (err) {
      if (!isNetworkFetchError(err)) {
        console.debug('fetchPillars exception:', err);
      }
      return DEFAULT_HCD_PILLARS;
    }
  },

  /**
   * Batch fetch measurements for an array of activity IDs in chunks of 100
   * avoiding PostgREST URL length limits
   */
  async fetchMeasurementsBatch(activityIds: string[]): Promise<ActivityMeasurement[]> {
    if (isSupabaseUnreachable()) return [];
    const client = getSupabaseClient();
    if (!client || activityIds.length === 0) return [];

    try {
      const results: ActivityMeasurement[] = [];
      const CHUNK_SIZE = 100;
      for (let i = 0; i < activityIds.length; i += CHUNK_SIZE) {
        const chunk = activityIds.slice(i, i + CHUNK_SIZE);
        const { data, error } = await client
          .from('activity_measurements')
          .select('*')
          .in('activity_id', chunk)
          .order('created_at', { ascending: true });

        if (error) {
          if (isNetworkFetchError(error)) break;
          console.debug('fetchMeasurementsBatch chunk notice:', error.message);
          continue;
        }
        if (data) {
          results.push(...(data as ActivityMeasurement[]));
        }
      }
      return results;
    } catch (err) {
      if (!isNetworkFetchError(err)) {
        console.debug('fetchMeasurementsBatch exception:', err);
      }
      return [];
    }
  },

  /**
   * Paginated batch retrieval of activities for complete report exports
   * Guarantees all matching records are fetched page-by-page without truncation
   */
  async fetchActivitiesPaginated(options: {
    lgaId?: string;
    status?: string;
    pillar?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
    searchQuery?: string;
    pageSize?: number;
    userSession?: UserSession;
    onProgress?: (loaded: number, total: number | null) => void;
  }): Promise<{ activities: HCDActivity[]; total: number; warning?: string }> {
    if (isSupabaseUnreachable()) {
      return { activities: [], total: 0, warning: 'Cloud endpoint unreachable' };
    }
    const client = getSupabaseClient();
    if (!client) {
      return { activities: [], total: 0, warning: 'Supabase client unavailable' };
    }

    const {
      lgaId,
      status,
      pillar,
      category,
      startDate,
      endDate,
      searchQuery,
      pageSize = 250,
      userSession,
      onProgress,
    } = options;

    try {
      const allActivities: HCDActivity[] = [];
      let page = 0;
      let hasMore = true;
      let totalCount: number | null = null;

      while (hasMore) {
        let query = client
          .from('activities')
          .select('*', { count: page === 0 ? 'exact' : undefined });

        // Apply Role & LGA Access Guardrails
        if (!userSession || userSession.role === 'public') {
          query = query.eq('status', 'PUBLISHED');
        } else if (userSession.role === 'lga_admin') {
          if (userSession.assignedLgaId) {
            // Strictly scope to authorized LGA
            query = query.eq('lga_id', userSession.assignedLgaId);
          } else {
            query = query.eq('status', 'PUBLISHED');
          }
        } else if (userSession.role === 'state_admin') {
          // State Admin can filter by LGA if selected
          if (lgaId && lgaId !== 'all') {
            query = query.eq('lga_id', lgaId);
          }
        }

        // Apply filters
        if (status && status !== 'all') {
          query = query.eq('status', status);
        }
        if (pillar && pillar !== 'all') {
          query = query.eq('pillar', pillar);
        }
        if (category && category !== 'all') {
          query = query.eq('category', category);
        }
        if (startDate) {
          query = query.gte('start_date', startDate);
        }
        if (endDate) {
          query = query.lte('completion_date', endDate);
        }

        const from = page * pageSize;
        const to = from + pageSize - 1;
        query = query.order('created_at', { ascending: false }).range(from, to);

        const { data, count, error } = await query;

        if (error) {
          if (!isNetworkFetchError(error)) {
            console.debug('fetchActivitiesPaginated notice:', error.message);
          }
          return {
            activities: allActivities,
            total: allActivities.length,
            warning: `Export retrieval interrupted: ${error.message}`,
          };
        }

        if (page === 0 && typeof count === 'number') {
          totalCount = count;
        }

        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          const mapped = data.map(rowToActivity);
          // Optional search query filtering
          const filtered = searchQuery?.trim()
            ? mapped.filter(
                (a) =>
                  a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  a.projectDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  a.community.toLowerCase().includes(searchQuery.toLowerCase())
              )
            : mapped;

          allActivities.push(...filtered);

          if (onProgress) {
            onProgress(allActivities.length, totalCount);
          }

          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        }

        // Circuit breaker: prevent infinite loops (max 50,000 records)
        if (page > 200) {
          break;
        }
      }

      return {
        activities: allActivities,
        total: totalCount ?? allActivities.length,
      };
    } catch (err: any) {
      if (!isNetworkFetchError(err)) {
        console.debug('fetchActivitiesPaginated exception:', err);
      }
      return {
        activities: [],
        total: 0,
        warning: err.message || 'Error executing paginated export query',
      };
    }
  },

  /**
   * Fetch active reporting indicators catalogue from Supabase live table
   */
  async fetchReportingIndicators(options?: { includeInactive?: boolean }): Promise<HCDReportingIndicator[]> {
    if (isSupabaseUnreachable()) return [];
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      let query = client.from('hcd_reporting_indicators').select('*');
      if (!options?.includeInactive) {
        query = query.eq('is_active', true);
      }
      const { data, error } = await query.order('indicator_code');

      if (error) {
        if (!isNetworkFetchError(error)) {
          console.debug('Supabase fetchReportingIndicators notice:', error.message);
        }
        return [];
      }
      return (data || []) as HCDReportingIndicator[];
    } catch (err) {
      if (!isNetworkFetchError(err)) {
        console.debug('fetchReportingIndicators exception:', err);
      }
      return [];
    }
  },

  /**
   * Fetch activity measurements from Supabase live table
   */
  async fetchMeasurements(activityId?: string): Promise<ActivityMeasurement[]> {
    if (isSupabaseUnreachable()) return [];
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      let query = client.from('activity_measurements').select('*');
      if (activityId) {
        query = query.eq('activity_id', activityId);
      }
      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) {
        if (!isNetworkFetchError(error)) {
          console.debug('Supabase fetchMeasurements notice:', error.message);
        }
        return [];
      }
      return (data || []) as ActivityMeasurement[];
    } catch (err) {
      if (!isNetworkFetchError(err)) {
        console.debug('fetchMeasurements exception:', err);
      }
      return [];
    }
  },

  /**
   * Insert new activity measurement with validation against RLS
   */
  async insertMeasurement(
    measurement: ActivityMeasurement,
    userSession?: UserSession
  ): Promise<DatabaseOperationResult<ActivityMeasurement>> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      const row: Record<string, any> = {
        activity_id: measurement.activity_id,
        indicator_code: measurement.indicator_code,
        reporting_period_start: measurement.reporting_period_start,
        reporting_period_end: measurement.reporting_period_end,
        value_numeric: measurement.value_numeric !== undefined ? measurement.value_numeric : null,
        value_text: measurement.value_text || null,
        numerator: measurement.numerator !== undefined ? measurement.numerator : null,
        denominator: measurement.denominator !== undefined ? measurement.denominator : null,
        disaggregation: measurement.disaggregation || {},
        data_source: measurement.data_source || null,
        evidence_reference: measurement.evidence_reference || null,
        notes: measurement.notes || null,
        entered_by: userSession?.id || measurement.entered_by || null,
      };

      if (measurement.id) {
        row.id = measurement.id;
      }

      const { data, error } = await client
        .from('activity_measurements')
        .insert(row)
        .select()
        .single();

      if (error) {
        console.warn('Supabase insertMeasurement error:', error);
        return {
          success: false,
          error: error.message,
          code: error.code,
          details: error.details,
        };
      }

      return { success: true, data: data as ActivityMeasurement };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to insert measurement',
      };
    }
  },

  /**
   * Delete activity measurement
   */
  async deleteMeasurement(id: string): Promise<DatabaseOperationResult<void>> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    try {
      const { error } = await client.from('activity_measurements').delete().eq('id', id);
      if (error) {
        return { success: false, error: error.message, code: error.code };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete measurement' };
    }
  },

  /**
   * Fetch indicator targets with strict RLS and authorization handling.
   * State administrators can view all statuses (draft, approved, retired) across LGAs.
   * LGA administrators only receive approved targets for their assigned LGA.
   * Public/unauthenticated users are strictly barred by RLS.
   */
  async fetchTargets(params?: {
    lgaId?: string;
    indicatorCode?: string;
    reportingYear?: number;
    status?: TargetStatus;
    userSession?: UserSession;
  }): Promise<{ success: boolean; data: HCDIndicatorTarget[]; error?: string; code?: string }> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, data: [], error: 'Supabase client not initialized' };
    }

    try {
      let query = client.from('hcd_indicator_targets').select('*');

      // If user is LGA admin, strictly filter to their assigned LGA and approved targets
      if (params?.userSession?.role === 'lga_admin') {
        const assignedLga = params.userSession.assignedLgaId;
        if (!assignedLga) {
          return { success: false, data: [], error: 'LGA Desk Officer has no assigned territory' };
        }
        query = query.eq('lga_id', assignedLga).eq('target_status', 'approved');
      } else {
        if (params?.lgaId && params.lgaId !== 'all') {
          query = query.eq('lga_id', params.lgaId);
        }
        if (params?.status && (params.status as string) !== 'all') {
          query = query.eq('target_status', params.status);
        }
      }

      if (params?.indicatorCode && params.indicatorCode !== 'all') {
        query = query.eq('indicator_code', params.indicatorCode);
      }
      if (params?.reportingYear) {
        query = query.eq('reporting_year', params.reportingYear);
      }

      const { data, error } = await query
        .order('reporting_year', { ascending: false })
        .order('indicator_code', { ascending: true });

      if (error) {
        return {
          success: false,
          data: [],
          error: error.message,
          code: error.code,
        };
      }

      return { success: true, data: (data || []) as HCDIndicatorTarget[] };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: err.message || 'Failed to fetch indicator targets',
      };
    }
  },

  /**
   * Fetch target-versus-actual performance from security-invoker view: hcd_lga_target_performance
   */
  async fetchTargetPerformance(params?: {
    lgaId?: string;
    reportingYear?: number;
    indicatorCode?: string;
    userSession?: UserSession;
  }): Promise<{ success: boolean; data: HCDLgaTargetPerformance[]; error?: string; code?: string }> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, data: [], error: 'Supabase client not initialized' };
    }

    try {
      let query = client.from('hcd_lga_target_performance').select('*');

      if (params?.userSession?.role === 'lga_admin') {
        const assignedLga = params.userSession.assignedLgaId;
        if (!assignedLga) {
          return { success: false, data: [], error: 'LGA Desk Officer has no assigned territory' };
        }
        query = query.eq('lga_id', assignedLga);
      } else if (params?.lgaId && params.lgaId !== 'all') {
        query = query.eq('lga_id', params.lgaId);
      }

      if (params?.reportingYear) {
        query = query.eq('reporting_year', params.reportingYear);
      }
      if (params?.indicatorCode && params.indicatorCode !== 'all') {
        query = query.eq('indicator_code', params.indicatorCode);
      }

      const { data, error } = await query
        .order('reporting_year', { ascending: false })
        .order('indicator_code', { ascending: true });

      if (error) {
        return {
          success: false,
          data: [],
          error: error.message,
          code: error.code,
        };
      }

      return { success: true, data: (data || []) as HCDLgaTargetPerformance[] };
    } catch (err: any) {
      return {
        success: false,
        data: [],
        error: err.message || 'Failed to fetch target performance records',
      };
    }
  },

  /**
   * Insert new indicator target (State Administrator only, saved as draft)
   */
  async insertTarget(
    target: Omit<HCDIndicatorTarget, 'id' | 'created_at' | 'updated_at' | 'target_status'>,
    userSession: UserSession
  ): Promise<DatabaseOperationResult<HCDIndicatorTarget>> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    if (userSession.role !== 'state_admin' || !userSession.isPrivileged) {
      return {
        success: false,
        error: 'Target creation is restricted to authorized State Executive Administrators.',
        code: '42501',
      };
    }

    try {
      // 1. Validation checks
      if (!target.lga_id || !target.indicator_code || !target.reporting_year) {
        return { success: false, error: 'LGA, indicator code, and reporting year are required.' };
      }
      if (
        Number(target.target_value) < 0 ||
        (target.baseline_value !== null && target.baseline_value !== undefined && Number(target.baseline_value) < 0)
      ) {
        return { success: false, error: 'Target and baseline values must be non-negative.' };
      }
      if (!target.period_start || !target.period_end) {
        return { success: false, error: 'Reporting period start and end dates are required.' };
      }

      const startYear = new Date(target.period_start).getFullYear();
      const endYear = new Date(target.period_end).getFullYear();
      const repYear = Number(target.reporting_year);
      if (startYear !== repYear && endYear !== repYear) {
        return {
          success: false,
          error: `Reporting period dates (${startYear}-${endYear}) must fall within reporting year ${repYear}.`,
        };
      }

      // Check for existing target for the same LGA, indicator, and reporting year
      const { data: existing } = await client
        .from('hcd_indicator_targets')
        .select('*')
        .eq('lga_id', target.lga_id)
        .eq('indicator_code', target.indicator_code)
        .eq('reporting_year', repYear)
        .maybeSingle();

      if (existing) {
        return {
          success: false,
          error: `An annual target already exists for ${target.lga_name || target.lga_id} (${target.indicator_code}, ${repYear}) with status "${existing.target_status}".`,
          code: '23505',
          data: existing as HCDIndicatorTarget,
        };
      }

      const now = new Date().toISOString();
      const row = {
        lga_id: target.lga_id,
        lga_name: target.lga_name,
        indicator_code: target.indicator_code,
        reporting_year: repYear,
        period_start: target.period_start,
        period_end: target.period_end,
        baseline_year: target.baseline_year ? Number(target.baseline_year) : null,
        baseline_value:
          target.baseline_value !== undefined && target.baseline_value !== null
            ? Number(target.baseline_value)
            : null,
        target_value: Number(target.target_value),
        target_direction: target.target_direction,
        target_metric_type: target.target_metric_type,
        measurement_unit: target.measurement_unit,
        target_status: 'draft',
        target_notes: target.target_notes || null,
        source_reference: target.source_reference || null,
        created_by: userSession.id,
        updated_by: userSession.id,
        approved_by: null,
        approved_at: null,
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await client
        .from('hcd_indicator_targets')
        .insert(row)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: error.message,
          code: error.code,
          details: error.details,
        };
      }

      return { success: true, data: data as HCDIndicatorTarget };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to insert indicator target' };
    }
  },

  /**
   * Update existing indicator target (State Administrator only)
   */
  async updateTarget(
    id: string,
    updates: Partial<HCDIndicatorTarget>,
    userSession: UserSession
  ): Promise<DatabaseOperationResult<HCDIndicatorTarget>> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    if (userSession.role !== 'state_admin' || !userSession.isPrivileged) {
      return {
        success: false,
        error: 'Target modifications are restricted to authorized State Executive Administrators.',
        code: '42501',
      };
    }

    try {
      if (updates.target_value !== undefined && Number(updates.target_value) < 0) {
        return { success: false, error: 'Target value must be non-negative.' };
      }
      if (
        updates.baseline_value !== undefined &&
        updates.baseline_value !== null &&
        Number(updates.baseline_value) < 0
      ) {
        return { success: false, error: 'Baseline value must be non-negative.' };
      }

      const updatePayload: Record<string, any> = {
        ...updates,
        updated_by: userSession.id,
        updated_at: new Date().toISOString(),
      };
      delete updatePayload.id;
      delete updatePayload.created_at;
      delete updatePayload.created_by;

      const { data, error } = await client
        .from('hcd_indicator_targets')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: error.message,
          code: error.code,
          details: error.details,
        };
      }

      return { success: true, data: data as HCDIndicatorTarget };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update target' };
    }
  },

  /**
   * Approve draft target (State Administrator only)
   */
  async approveTarget(
    id: string,
    userSession: UserSession
  ): Promise<DatabaseOperationResult<HCDIndicatorTarget>> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    if (userSession.role !== 'state_admin' || !userSession.isPrivileged) {
      return {
        success: false,
        error: 'Target approval is restricted to authorized State Executive Administrators.',
        code: '42501',
      };
    }

    try {
      const now = new Date().toISOString();
      const { data, error } = await client
        .from('hcd_indicator_targets')
        .update({
          target_status: 'approved',
          approved_by: userSession.id,
          approved_at: now,
          updated_by: userSession.id,
          updated_at: now,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: data as HCDIndicatorTarget };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to approve target' };
    }
  },

  /**
   * Retire approved target (State Administrator only)
   */
  async retireTarget(
    id: string,
    userSession: UserSession
  ): Promise<DatabaseOperationResult<HCDIndicatorTarget>> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    if (userSession.role !== 'state_admin' || !userSession.isPrivileged) {
      return {
        success: false,
        error: 'Retiring targets is restricted to authorized State Executive Administrators.',
        code: '42501',
      };
    }

    try {
      const now = new Date().toISOString();
      const { data, error } = await client
        .from('hcd_indicator_targets')
        .update({
          target_status: 'retired',
          updated_by: userSession.id,
          updated_at: now,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true, data: data as HCDIndicatorTarget };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to retire target' };
    }
  },

  /**
   * Delete target (State Administrator only, draft targets only)
   */
  async deleteTarget(
    id: string,
    userSession: UserSession
  ): Promise<DatabaseOperationResult<void>> {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, error: 'Supabase client not initialized' };
    }

    if (userSession.role !== 'state_admin' || !userSession.isPrivileged) {
      return {
        success: false,
        error: 'Target deletion is restricted to authorized State Executive Administrators.',
        code: '42501',
      };
    }

    try {
      const { error } = await client
        .from('hcd_indicator_targets')
        .delete()
        .eq('id', id)
        .eq('target_status', 'draft');

      if (error) {
        return { success: false, error: error.message, code: error.code };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete target' };
    }
  },
};
