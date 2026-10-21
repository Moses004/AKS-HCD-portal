import { getSupabaseClient, isSupabaseUnreachable } from '../lib/supabase';
import { isNetworkFetchError } from './supabaseService';
import {
  StateHCDActivity,
  StateHCDActivityActionItem,
  StateHCDPublicActionItem,
  HCDActivityReportingOverview,
  StateActivityCategory,
  StateActivityStatus,
  ActionItemStatus,
  UserSession,
  STATE_CATEGORY_LABELS,
  STATE_STATUS_LABELS,
  ACTION_ITEM_STATUS_LABELS,
} from '../types';
import {
  generateSafeStoragePath,
  cleanStoragePath,
  resolveActivityMedia,
  EVIDENCE_BUCKET,
} from './mediaService';

export interface StateActivityFilters {
  category?: StateActivityCategory | 'all';
  status?: StateActivityStatus | 'all';
  leadInstitution?: string;
  year?: number | 'all';
  search?: string;
}

export interface StateActionItemFilters {
  status?: ActionItemStatus | 'overdue' | 'all';
  activityId?: string | 'all';
  leadInstitution?: string;
  search?: string;
}

/**
 * Neutralize potential spreadsheet formula injection in CSV exports
 */
export const sanitizeCsvCell = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (str.length === 0) return '';
  // Check if string begins with dangerous spreadsheet formula triggers
  const firstChar = str.charAt(0);
  if (firstChar === '=' || firstChar === '+' || firstChar === '@') {
    return `'${str}`;
  }
  // For negative numbers, if it's purely a valid negative number, keep it; if it looks like a formula e.g. -SUM(A1), escape it
  if (firstChar === '-') {
    const isPureNumber = !isNaN(Number(str));
    if (!isPureNumber) {
      return `'${str}`;
    }
  }
  return str;
};

export const escapeCsvRow = (cells: (string | number | null | undefined)[]): string => {
  return cells
    .map((cell) => {
      const sanitized = sanitizeCsvCell(cell);
      // If cell contains commas, quotes, or newlines, wrap in quotes and escape internal quotes
      if (/[",\n\r]/.test(sanitized)) {
        return `"${sanitized.replace(/"/g, '""')}"`;
      }
      return sanitized;
    })
    .join(',');
};

class StateActivitiesService {
  /**
   * Fetch state-level activities with optional filters
   */
  async fetchStateActivities(filters?: StateActivityFilters): Promise<{
    success: boolean;
    data: StateHCDActivity[];
    count: number;
    error?: string;
  }> {
    if (isSupabaseUnreachable()) {
      return { success: true, data: [], count: 0 };
    }
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, data: [], count: 0, error: 'Database client unavailable' };
    }

    try {
      let query = client
        .from('state_hcd_activities')
        .select('*', { count: 'exact' })
        .order('activity_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.category && filters.category !== 'all') {
        query = query.eq('category', filters.category);
      }

      if (filters?.leadInstitution && filters.leadInstitution.trim()) {
        query = query.ilike('lead_institution', `%${filters.leadInstitution.trim()}%`);
      }

      if (filters?.year && filters.year !== 'all') {
        const yearNum = Number(filters.year);
        query = query
          .gte('activity_date', `${yearNum}-01-01`)
          .lte('activity_date', `${yearNum}-12-31`);
      }

      if (filters?.search && filters.search.trim()) {
        const term = filters.search.trim();
        query = query.or(
          `title.ilike.%${term}%,description.ilike.%${term}%,activity_code.ilike.%${term}%,location.ilike.%${term}%,lead_institution.ilike.%${term}%`
        );
      }

      const { data, count, error } = await query;

      if (error) {
        if (
          isNetworkFetchError(error) ||
          error.code === '42501' ||
          error.message?.toLowerCase().includes('permission denied')
        ) {
          return { success: true, data: [], count: 0 };
        }
        console.debug('fetchStateActivities notice:', error.message);
        return { success: false, data: [], count: 0, error: error.message };
      }

      return {
        success: true,
        data: (data || []) as StateHCDActivity[],
        count: count ?? (data?.length || 0),
      };
    } catch (err: any) {
      if (isNetworkFetchError(err)) {
        return { success: true, data: [], count: 0 };
      }
      console.debug('fetchStateActivities exception:', err);
      return { success: false, data: [], count: 0, error: err.message || 'Failed to fetch state activities' };
    }
  }

  /**
   * Fetch a single state activity by ID
   */
  async getStateActivityById(id: string): Promise<{
    success: boolean;
    data?: StateHCDActivity;
    error?: string;
  }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Database client unavailable' };

    try {
      const { data, error } = await client
        .from('state_hcd_activities')
        .select('*')
        .eq('id', id)
        .single();

      if (error) return { success: false, error: error.message };
      return { success: true, data: data as StateHCDActivity };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Save a state-level activity (draft or pending)
   */
  async saveStateActivity(
    activity: Partial<StateHCDActivity>,
    userSession?: UserSession
  ): Promise<{
    success: boolean;
    data?: StateHCDActivity;
    error?: string;
  }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Database client unavailable' };

    try {
      const isNew = !activity.id;
      const now = new Date().toISOString();
      const activityId = activity.id || crypto.randomUUID();

      // Ensure participating_stakeholders is always a valid array
      const stakeholders = Array.isArray(activity.participating_stakeholders)
        ? activity.participating_stakeholders
        : [];

      // Ensure evidence_files is always a valid array
      const evidenceFiles = Array.isArray(activity.evidence_files)
        ? activity.evidence_files
        : [];

      if (isNew) {
        // Generate formatted activity code: STA-YYYY-XXXX
        const year = activity.activity_date ? activity.activity_date.slice(0, 4) : new Date().getFullYear();
        const rand = Math.floor(1000 + Math.random() * 9000);
        const code = activity.activity_code || `STA-${year}-${rand}`;

        const payload = {
          id: activityId,
          activity_code: code,
          title: activity.title || '',
          category: activity.category || 'monitoring_evaluation',
          activity_date: activity.activity_date || new Date().toISOString().split('T')[0],
          activity_end_date: activity.activity_end_date || null,
          location: activity.location || 'Akwa Ibom State',
          lead_institution: activity.lead_institution || 'Directorate of HCD',
          lead_unit: activity.lead_unit || null,
          participating_stakeholders: stakeholders,
          description: activity.description || '',
          key_outcomes: activity.key_outcomes || null,
          decisions_resolutions: activity.decisions_resolutions || null,
          status: activity.status || 'draft',
          submission_notes: activity.submission_notes || null,
          evidence_files: evidenceFiles,
          created_by: userSession?.id || null,
          updated_by: userSession?.id || null,
          created_at: now,
          updated_at: now,
        };

        const { data, error } = await client
          .from('state_hcd_activities')
          .insert(payload)
          .select()
          .single();

        if (error) {
          console.warn('Create state activity error:', error);
          return { success: false, error: error.message };
        }

        return { success: true, data: data as StateHCDActivity };
      } else {
        // Update existing record
        const updatePayload: Record<string, any> = {
          updated_by: userSession?.id || null,
          updated_at: now,
        };

        if (activity.title !== undefined) updatePayload.title = activity.title;
        if (activity.category !== undefined) updatePayload.category = activity.category;
        if (activity.activity_date !== undefined) updatePayload.activity_date = activity.activity_date;
        if (activity.activity_end_date !== undefined) updatePayload.activity_end_date = activity.activity_end_date;
        if (activity.location !== undefined) updatePayload.location = activity.location;
        if (activity.lead_institution !== undefined) updatePayload.lead_institution = activity.lead_institution;
        if (activity.lead_unit !== undefined) updatePayload.lead_unit = activity.lead_unit;
        if (activity.participating_stakeholders !== undefined) {
          updatePayload.participating_stakeholders = stakeholders;
        }
        if (activity.description !== undefined) updatePayload.description = activity.description;
        if (activity.key_outcomes !== undefined) updatePayload.key_outcomes = activity.key_outcomes;
        if (activity.decisions_resolutions !== undefined) {
          updatePayload.decisions_resolutions = activity.decisions_resolutions;
        }
        if (activity.status !== undefined) updatePayload.status = activity.status;
        if (activity.submission_notes !== undefined) updatePayload.submission_notes = activity.submission_notes;
        if (activity.evidence_files !== undefined) updatePayload.evidence_files = evidenceFiles;

        const { data, error } = await client
          .from('state_hcd_activities')
          .update(updatePayload)
          .eq('id', activity.id)
          .select()
          .single();

        if (error) {
          console.warn('Update state activity error:', error);
          return { success: false, error: error.message };
        }

        return { success: true, data: data as StateHCDActivity };
      }
    } catch (err: any) {
      console.warn('saveStateActivity exception:', err);
      return { success: false, error: err.message || 'Operation failed' };
    }
  }

  /**
   * Submit activity for review / publication
   */
  async submitForReview(
    activityId: string,
    submissionNotes?: string,
    userSession?: UserSession
  ): Promise<{ success: boolean; data?: StateHCDActivity; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Database client unavailable' };

    try {
      const { data, error } = await client
        .from('state_hcd_activities')
        .update({
          status: 'pending_approval',
          submission_notes: submissionNotes || null,
          updated_by: userSession?.id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activityId)
        .select()
        .single();

      if (error) return { success: false, error: error.message };
      return { success: true, data: data as StateHCDActivity };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Review state activity: publish or return as rejected draft
   */
  async reviewStateActivity(params: {
    activityId: string;
    decision: 'publish' | 'reject';
    rejectionReason?: string;
    userSession?: UserSession;
  }): Promise<{ success: boolean; data?: StateHCDActivity; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Database client unavailable' };

    try {
      const now = new Date().toISOString();
      const reviewerId = params.userSession?.id || null;

      if (params.decision === 'publish') {
        const { data, error } = await client
          .from('state_hcd_activities')
          .update({
            status: 'published',
            reviewed_by: reviewerId,
            reviewed_at: now,
            published_at: now,
            rejection_reason: null,
            updated_by: reviewerId,
            updated_at: now,
          })
          .eq('id', params.activityId)
          .select()
          .single();

        if (error) return { success: false, error: error.message };
        return { success: true, data: data as StateHCDActivity };
      } else {
        const { data, error } = await client
          .from('state_hcd_activities')
          .update({
            status: 'rejected_draft',
            reviewed_by: reviewerId,
            reviewed_at: now,
            rejection_reason: params.rejectionReason || 'Returned for necessary revision',
            updated_by: reviewerId,
            updated_at: now,
          })
          .eq('id', params.activityId)
          .select()
          .single();

        if (error) return { success: false, error: error.message };
        return { success: true, data: data as StateHCDActivity };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Secure upload of supporting evidence to hcd-evidence-vault
   * File path pattern: state-level/<activity-uuid>/<timestamp>_<filename>
   */
  async uploadStateEvidence(
    file: File | Blob,
    fileName: string,
    activityId: string
  ): Promise<{
    success: boolean;
    storagePath?: string;
    signedUrl?: string;
    fileSize?: number;
    fileType?: string;
    error?: string;
  }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Storage client unavailable' };

    // Validation: 25MB maximum
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return { success: false, error: 'File size exceeds maximum permitted limit of 25MB.' };
    }

    // Supported formats
    const validTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (file.type && !validTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Invalid file format. Accepted formats: PDF, Word, Excel, JPEG, PNG, WEBP.',
      };
    }

    try {
      const storagePath = generateSafeStoragePath('state-level', activityId, fileName);

      const { data, error } = await client.storage
        .from(EVIDENCE_BUCKET)
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        console.warn('Storage upload error:', error.message);
        return { success: false, error: error.message };
      }

      // Generate signed URL (valid 1 hr) for authorized preview
      const { data: signData, error: signError } = await client.storage
        .from(EVIDENCE_BUCKET)
        .createSignedUrl(data.path, 3600);

      return {
        success: true,
        storagePath: data.path,
        signedUrl: signData?.signedUrl,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Evidence upload failed' };
    }
  }

  /**
   * Get signed URL for an existing evidence file in hcd-evidence-vault
   * Leverages resolveActivityMedia for memory caching and deduplication
   */
  async getEvidenceSignedUrl(storagePath: string): Promise<string | null> {
    try {
      const res = await resolveActivityMedia({ storagePath });
      return res.url;
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // ACTION ITEMS REGISTER
  // ==========================================================================

  /**
   * Fetch action items
   * - If privileged: reads from public.state_hcd_activity_action_items
   * - If public/unauthenticated: reads from public.state_hcd_public_action_items
   */
  async fetchActionItems(
    filters?: StateActionItemFilters,
    isPrivileged: boolean = true
  ): Promise<{
    success: boolean;
    data: StateHCDActivityActionItem[];
    error?: string;
  }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, data: [], error: 'Database client unavailable' };

    try {
      if (!isPrivileged) {
        // Anonymous/public: read from public view
        let query = client
          .from('state_hcd_public_action_items')
          .select('*')
          .order('due_date', { ascending: true });

        if (filters?.activityId && filters.activityId !== 'all') {
          query = query.eq('activity_id', filters.activityId);
        }

        if (filters?.status && filters.status !== 'all' && filters.status !== 'overdue') {
          query = query.eq('status', filters.status);
        }

        const { data, error } = await query;
        if (error) {
          if (error.code === '42501' || error.message?.includes('permission denied')) {
            return { success: true, data: [] };
          }
          return { success: false, data: [], error: error.message };
        }

        return { success: true, data: (data || []) as StateHCDActivityActionItem[] };
      }

      // Privileged state admin query
      let query = client
        .from('state_hcd_activity_action_items')
        .select('*')
        .order('due_date', { ascending: true });

      if (filters?.activityId && filters.activityId !== 'all') {
        query = query.eq('activity_id', filters.activityId);
      }

      if (filters?.status && filters.status !== 'all' && filters.status !== 'overdue') {
        query = query.eq('status', filters.status);
      }

      if (filters?.leadInstitution && filters.leadInstitution.trim()) {
        query = query.ilike('responsible_institution', `%${filters.leadInstitution.trim()}%`);
      }

      if (filters?.search && filters.search.trim()) {
        const term = filters.search.trim();
        query = query.or(
          `action_title.ilike.%${term}%,action_description.ilike.%${term}%,responsible_institution.ilike.%${term}%,responsible_person.ilike.%${term}%`
        );
      }

      const { data, error } = await query;

      if (error) {
        if (isNetworkFetchError(error)) {
          return { success: true, data: [] };
        }
        // If RLS prevents access, try public view as fallback
        console.debug('state_hcd_activity_action_items read notice:', error.message);
        const pub = await client.from('state_hcd_public_action_items').select('*');
        if (!pub.error && pub.data) {
          return { success: true, data: pub.data as StateHCDActivityActionItem[] };
        }
        return { success: false, data: [], error: error.message };
      }

      return {
        success: true,
        data: (data || []) as StateHCDActivityActionItem[],
      };
    } catch (err: any) {
      if (isNetworkFetchError(err)) {
        return { success: true, data: [] };
      }
      return { success: false, data: [], error: err.message };
    }
  }

  /**
   * Save or update an action item
   */
  async saveActionItem(
    item: Partial<StateHCDActivityActionItem>,
    userSession?: UserSession
  ): Promise<{
    success: boolean;
    data?: StateHCDActivityActionItem;
    error?: string;
  }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Database client unavailable' };

    try {
      const isNew = !item.id;
      const now = new Date().toISOString();
      const itemId = item.id || crypto.randomUUID();

      if (isNew) {
        const payload = {
          id: itemId,
          activity_id: item.activity_id,
          action_title: item.action_title || '',
          action_description: item.action_description || null,
          responsible_institution: item.responsible_institution || '',
          responsible_person: item.responsible_person || null,
          due_date: item.due_date || new Date().toISOString().split('T')[0],
          status: item.status || 'open',
          completion_notes: item.completion_notes || null,
          completed_at: item.status === 'completed' ? now : null,
          created_by: userSession?.id || null,
          updated_by: userSession?.id || null,
          created_at: now,
          updated_at: now,
        };

        const { data, error } = await client
          .from('state_hcd_activity_action_items')
          .insert(payload)
          .select()
          .single();

        if (error) return { success: false, error: error.message };
        return { success: true, data: data as StateHCDActivityActionItem };
      } else {
        const updatePayload: Record<string, any> = {
          updated_by: userSession?.id || null,
          updated_at: now,
        };

        if (item.action_title !== undefined) updatePayload.action_title = item.action_title;
        if (item.action_description !== undefined) updatePayload.action_description = item.action_description;
        if (item.responsible_institution !== undefined) {
          updatePayload.responsible_institution = item.responsible_institution;
        }
        if (item.responsible_person !== undefined) updatePayload.responsible_person = item.responsible_person;
        if (item.due_date !== undefined) updatePayload.due_date = item.due_date;
        if (item.status !== undefined) {
          updatePayload.status = item.status;
          if (item.status === 'completed') {
            updatePayload.completed_at = now;
          } else if (item.status === 'open' || item.status === 'in_progress') {
            updatePayload.completed_at = null;
          }
        }
        if (item.completion_notes !== undefined) updatePayload.completion_notes = item.completion_notes;

        const { data, error } = await client
          .from('state_hcd_activity_action_items')
          .update(updatePayload)
          .eq('id', item.id)
          .select()
          .single();

        if (error) return { success: false, error: error.message };
        return { success: true, data: data as StateHCDActivityActionItem };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ==========================================================================
  // CONSOLIDATED REPORTING OVERVIEW (LGA + STATE)
  // ==========================================================================

  /**
   * Fetch consolidated reporting overview view (public.hcd_activity_reporting_overview)
   */
  async fetchConsolidatedOverview(filters?: {
    reportingLevel?: 'all' | 'lga' | 'state';
    status?: string;
  }): Promise<{
    success: boolean;
    data: HCDActivityReportingOverview[];
    error?: string;
  }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, data: [], error: 'Database client unavailable' };

    try {
      let query = client
        .from('hcd_activity_reporting_overview')
        .select('*')
        .order('activity_date', { ascending: false });

      if (filters?.reportingLevel && filters.reportingLevel !== 'all') {
        query = query.eq('reporting_level', filters.reportingLevel);
      }

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('activity_status', filters.status);
      }

      const { data, error } = await query;
      if (error) return { success: false, data: [], error: error.message };

      return {
        success: true,
        data: (data || []) as HCDActivityReportingOverview[],
      };
    } catch (err: any) {
      return { success: false, data: [], error: err.message };
    }
  }

  // ==========================================================================
  // EXPORT BUILDERS (Formula Sanitized)
  // ==========================================================================

  /**
   * Export state activities to CSV with formula injection defense
   */
  exportStateActivitiesCsv(activities: StateHCDActivity[]): string {
    const headers = [
      'Activity Code',
      'Title',
      'Category',
      'Activity Date',
      'End Date',
      'Location / Venue',
      'Lead Institution',
      'Lead Unit',
      'Status',
      'Participating Stakeholders Count',
      'Key Outcomes',
      'Decisions & Resolutions',
      'Evidence Count',
      'Created At',
      'Published At',
    ];

    const rows = activities.map((a) => {
      const categoryLabel = STATE_CATEGORY_LABELS[a.category] || a.category;
      const statusLabel = STATE_STATUS_LABELS[a.status] || a.status;
      const stakeholderCount = Array.isArray(a.participating_stakeholders)
        ? a.participating_stakeholders.length
        : 0;
      const evidenceCount = Array.isArray(a.evidence_files) ? a.evidence_files.length : 0;

      return escapeCsvRow([
        a.activity_code,
        a.title,
        categoryLabel,
        a.activity_date,
        a.activity_end_date || '',
        a.location,
        a.lead_institution,
        a.lead_unit || '',
        statusLabel,
        stakeholderCount,
        a.key_outcomes || '',
        a.decisions_resolutions || '',
        evidenceCount,
        a.created_at ? a.created_at.slice(0, 10) : '',
        a.published_at ? a.published_at.slice(0, 10) : '',
      ]);
    });

    return [headers.join(','), ...rows].join('\r\n');
  }

  /**
   * Export action points to CSV with formula injection defense
   */
  exportActionItemsCsv(
    items: StateHCDActivityActionItem[],
    activitiesMap?: Map<string, StateHCDActivity>
  ): string {
    const headers = [
      'Action ID',
      'Parent Activity Code',
      'Parent Activity Title',
      'Action Title',
      'Description',
      'Responsible Institution',
      'Responsible Person',
      'Due Date',
      'Status',
      'Completion Notes',
      'Completed At',
      'Created At',
    ];

    const rows = items.map((item) => {
      const parent = activitiesMap?.get(item.activity_id);
      const parentCode = parent?.activity_code || item.parent_activity_code || item.activity_id;
      const parentTitle = parent?.title || item.parent_activity_title || '';
      const statusLabel = ACTION_ITEM_STATUS_LABELS[item.status] || item.status;

      return escapeCsvRow([
        item.id,
        parentCode,
        parentTitle,
        item.action_title,
        item.action_description || '',
        item.responsible_institution,
        item.responsible_person || '',
        item.due_date,
        statusLabel,
        item.completion_notes || '',
        item.completed_at ? item.completed_at.slice(0, 10) : '',
        item.created_at ? item.created_at.slice(0, 10) : '',
      ]);
    });

    return [headers.join(','), ...rows].join('\r\n');
  }

  /**
   * Export consolidated overview to CSV
   */
  exportConsolidatedOverviewCsv(items: HCDActivityReportingOverview[]): string {
    const headers = [
      'Reporting Level',
      'Activity ID',
      'Title',
      'Activity Date',
      'Category / Pillar',
      'LGA',
      'Location',
      'Status',
      'Total Beneficiaries',
      'Budget (NGN)',
      'Overall Progress (%)',
      'Updated At',
    ];

    const rows = items.map((i) =>
      escapeCsvRow([
        i.reporting_level.toUpperCase(),
        i.activity_id,
        i.title,
        i.activity_date,
        i.activity_category,
        i.lga_name || 'State-Wide',
        i.location || '',
        i.activity_status,
        i.beneficiaries_total || 0,
        i.budget_ngn || 0,
        i.overall_progress || 0,
        i.updated_at ? i.updated_at.slice(0, 10) : '',
      ])
    );

    return [headers.join(','), ...rows].join('\r\n');
  }
}

export const stateActivitiesService = new StateActivitiesService();
