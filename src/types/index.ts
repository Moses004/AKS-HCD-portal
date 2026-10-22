export type Role = 'public' | 'lga_admin' | 'state_admin';

export type PillarId = 
  | 'education' 
  | 'health' 
  | 'vocational' 
  | 'agriculture'
  | 'cross_cutting_enablers'
  | 'values_ethics_social_behaviour';

export type ReportingCategory =
  | 'Education'
  | 'Health'
  | 'Skill and labour'
  | 'Cross-cutting Enablers'
  | 'Values/Ethics/Social behaviour'
  | 'HCD Settings'
  | 'education'
  | 'health'
  | 'vocational'
  | 'cross_cutting_enablers'
  | 'values_ethics_social_behaviour'
  | 'agriculture';

export type PillarSegment =
  | 'gender'
  | 'governance'
  | 'climate_change'
  | 'demography_youth_investment';

export interface HCDPillar {
  pillar_code: string;
  display_name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PillarInfo {
  id: PillarId;
  name: string;
  tagline: string;
  description: string;
  iconName: string;
  color: string;
  subCategories: string[]; // Presets for project description
}

export type SenatorialDistrict = 
  | 'Uyo (Akwa Ibom North-East)'
  | 'Ikot Ekpene (Akwa Ibom North-West)'
  | 'Eket (Akwa Ibom South)';

export interface LGA {
  id: string; // slug e.g. 'uyo', 'eket'
  name: string;
  headquarters: string;
  senatorialDistrict: SenatorialDistrict;
  populationEstimate: number;
  centerCoordinates: {
    lat: number;
    lng: number;
  };
  svgData: {
    x: number;
    y: number;
    w: number;
    h: number;
    labelX?: number;
    labelY?: number;
    path?: string;
  };
}

export type ActivityStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'PUBLISHED' | 'REJECTED_DRAFT';

export type MilestoneStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface ProjectMilestone {
  id: string;
  phaseNumber: number;
  title: string;
  description?: string;
  targetDate: string;
  completionPercentage: number; // 0 - 100
  status: MilestoneStatus;
  completedDate?: string;
  keyDeliverable?: string;
}

export type CoordinateProvenance =
  | 'exif_gps'
  | 'manual_entry'
  | 'activity_location'
  | 'none';

export type ExifVerificationStatus =
  | 'verified_exif'
  | 'exif_warning'
  | 'exif_out_of_bounds'
  | 'no_exif_gps'
  | 'manual_coordinates'
  | 'activity_coordinates'
  | 'not_applicable';

export interface VerificationMedia {
  id: string;
  type: 'photo' | 'document' | 'video';
  url: string;
  storagePath?: string;
  caption: string;
  fileName: string;
  fileSize: string;
  mimeType?: string;
  exifVerified?: boolean;
  coordinateSource?: CoordinateProvenance;
  exifStatus?: ExifVerificationStatus;
  exifMessage?: string;
  exifDeviceMake?: string;
  exifDeviceModel?: string;
  exifCapturedAt?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  uploadTimestamp: string;
}

export interface HCDActivity {
  id: string;
  lgaId: string; // Tenant isolation key
  lgaName: string;
  title: string;
  pillar: PillarId;
  projectDescription: string;
  subCategory?: string; // Backward compatibility alias
  category?: ReportingCategory | string | null;
  pillarSegment?: PillarSegment | null;
  community: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  beneficiariesTotal: number;
  beneficiariesMale: number;
  beneficiariesFemale: number;
  youthBeneficiaries: number;
  budgetNgn: number;
  startDate: string;
  completionDate: string;
  leadOfficer: string;
  officerContact: string;
  status: ActivityStatus;
  milestones?: ProjectMilestone[];
  overallProgress?: number; // 0 - 100%
  mediaAssets: VerificationMedia[];
  attendanceRegistryUrl?: string;
  attendanceSheetFileName?: string;
  submissionNotes?: string;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  isOfflineCreated?: boolean;
  syncStatus?: 'synced' | 'pending_sync';
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface UserProfileRecord {
  user_id: string;
  display_name: string;
  staff_identifier?: string;
  department?: string;
  role: Role;
  lga_id?: string | null;
  requested_role?: Role | null;
  requested_lga_id?: string | null;
  approval_status: ApprovalStatus;
  active: boolean;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: Role;
  assignedLgaId?: string; // Set when approved & active role === 'lga_admin'
  assignedLgaName?: string;
  department?: string;
  staffIdentifier?: string;
  requestedRole?: Role;
  requestedLgaId?: string;
  approvalStatus?: ApprovalStatus;
  isActive?: boolean;
  isAuthenticated: boolean;
  isPrivileged?: boolean; // TRUE only when profile is approved and active for lga_admin or state_admin
  profileStatus?: 'active' | 'pending' | 'rejected' | 'suspended' | 'missing' | 'inactive';
  lastSignInAt?: string;
  isDemo?: boolean;
}

export type AuditActionType =
  | 'CREATED_DRAFT'
  | 'SUBMITTED'
  | 'APPROVED_PUBLISHED'
  | 'REJECTED'
  | 'REVERTED_TO_DRAFT'
  | 'DELETED'
  | 'MODIFIED'
  | 'TARGET_CONFIGURED'
  | 'TARGET_APPROVED'
  | 'TARGET_RETIRED'
  | 'USER_ACCESS_CHANGED'
  | 'STATE_ACTIVITY_GOVERNANCE'
  | 'CROSS_TENANT_VIOLATION_BLOCKED';

export interface AuditLog {
  id: string;
  timestamp: string;
  activityId?: string;
  activityTitle?: string;
  lgaId?: string;
  performedBy: string;
  actorUserId?: string;
  role: Role;
  action: AuditActionType | string;
  notes?: string;
  persistedToCloud?: boolean;
  changeCategory?: 'activity_lifecycle' | 'budget_demographics' | 'target_governance' | 'access_control' | 'state_executive' | 'security_policy';
  severity?: 'info' | 'elevated' | 'critical';
}

export interface HCDReportingIndicator {
  indicator_code: string;
  reporting_category: string;
  pillar: string;
  segment: string | null;
  indicator_name: string;
  definition: string;
  required_data_fields: string[];
  measurement_unit: string;
  calculation_method: string;
  collection_method: string;
  recommended_source: string;
  reporting_frequency: string;
  disaggregation_dimensions: string[];
  evidence_required: string[];
  is_active: boolean;
  aggregation_method?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ActivityMeasurement {
  id?: string;
  activity_id: string;
  indicator_code: string;
  reporting_period_start: string;
  reporting_period_end: string;
  value_numeric?: number | null;
  value_text?: string | null;
  numerator?: number | null;
  denominator?: number | null;
  disaggregation?: Record<string, any>;
  data_source?: string | null;
  evidence_reference?: string | null;
  notes?: string | null;
  entered_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type TargetDirection = 'higher_is_better' | 'lower_is_better' | 'maintain';
export type TargetMetricType = 'count' | 'percentage' | 'rate' | 'currency' | 'score' | 'other';
export type TargetStatus = 'draft' | 'approved' | 'retired';

export interface HCDIndicatorTarget {
  id?: string;
  lga_id: string;
  lga_name: string;
  indicator_code: string;
  reporting_year: number;
  period_start: string;
  period_end: string;
  baseline_year?: number | null;
  baseline_value?: number | null;
  target_value: number;
  target_direction: TargetDirection;
  target_metric_type: TargetMetricType;
  measurement_unit: string;
  target_status: TargetStatus;
  target_notes?: string | null;
  source_reference?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface HCDLgaTargetPerformance {
  id?: string;
  target_id?: string;
  lga_id: string;
  lga_name: string;
  indicator_code: string;
  indicator_name?: string;
  reporting_category?: string;
  pillar?: string;
  reporting_year: number;
  period_start: string;
  period_end: string;
  baseline_year?: number | null;
  baseline_value?: number | null;
  target_value: number;
  target_direction: TargetDirection;
  target_metric_type: TargetMetricType;
  measurement_unit: string;
  target_status?: TargetStatus;
  actual_value?: number | null;
  achievement_rate?: number | null;
  achievement_status?: 'achieved' | 'on_track' | 'lagging' | 'critical' | 'no_data' | 'compare_to_target' | 'target_zero_review' | string;
  activity_count?: number;
  measurement_count?: number;
  target_notes?: string | null;
  source_reference?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// STATE-LEVEL ACTIVITIES REPORTING MODULE TYPES
// ============================================================================

export type StateActivityCategory =
  | 'monitoring_evaluation'
  | 'partnerships_stakeholder_engagement'
  | 'national_level_engagements'
  | 'state_hcd_council_meetings'
  | 'state_hcd_working_group_activities'
  | 'other_state_level_initiatives';

export interface StateCategoryDefinition {
  value: StateActivityCategory;
  label: string;
  description: string;
}

export const STATE_ACTIVITY_CATEGORIES: StateCategoryDefinition[] = [
  {
    value: 'monitoring_evaluation',
    label: 'Monitoring and Evaluation (M&E)',
    description: 'Field missions, tracking assessments, baseline reviews, and oversight operations across MDAs and LGAs',
  },
  {
    value: 'partnerships_stakeholder_engagement',
    label: 'Partnerships and Stakeholder Engagement',
    description: 'Collaborations with development partners, CSOs, private sector, and multilateral agencies',
  },
  {
    value: 'national_level_engagements',
    label: 'National-Level Engagements and Meetings',
    description: 'National NEC HCD core working group sessions, inter-state summits, and federal ministerial dialogues',
  },
  {
    value: 'state_hcd_council_meetings',
    label: 'State HCD Council Meetings',
    description: 'High-level steering council convocations presided over by State Leadership and Cabinet members',
  },
  {
    value: 'state_hcd_working_group_activities',
    label: 'State HCD Working Group Activities',
    description: 'Technical working group working sessions, pillar sub-committees, and multi-agency harmonisations',
  },
  {
    value: 'other_state_level_initiatives',
    label: 'Other State-Level Initiatives',
    description: 'Cross-cutting state-wide human capital development campaigns, conferences, and executive milestones',
  },
];

export const STATE_CATEGORY_LABELS: Record<StateActivityCategory, string> = {
  monitoring_evaluation: 'Monitoring and Evaluation (M&E)',
  partnerships_stakeholder_engagement: 'Partnerships and Stakeholder Engagement',
  national_level_engagements: 'National-Level Engagements and Meetings',
  state_hcd_council_meetings: 'State HCD Council Meetings',
  state_hcd_working_group_activities: 'State HCD Working Group Activities',
  other_state_level_initiatives: 'Other State-Level Initiatives',
};

export type StateActivityStatus =
  | 'draft'
  | 'pending_approval'
  | 'published'
  | 'rejected_draft'
  | 'archived';

export const STATE_STATUS_LABELS: Record<StateActivityStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Review / Publication',
  published: 'Published',
  rejected_draft: 'Returned Draft',
  archived: 'Archived',
};

export type StakeholderType = 'MDA' | 'CSO' | 'development_partner' | 'private_sector' | 'other';

export const STAKEHOLDER_TYPES: { value: StakeholderType; label: string }[] = [
  { value: 'MDA', label: 'State MDA (Ministry, Department, Agency)' },
  { value: 'development_partner', label: 'Development Partner (UN, World Bank, etc.)' },
  { value: 'CSO', label: 'Civil Society Organization / NGO' },
  { value: 'private_sector', label: 'Private Sector Entity' },
  { value: 'other', label: 'Other Stakeholder' },
];

export interface StateStakeholder {
  organization_name: string;
  stakeholder_type: StakeholderType;
  role: string;
  notes?: string;
}

export interface StateEvidenceFile {
  file_name: string;
  file_path: string;
  file_size?: number | string;
  file_type?: string;
  uploaded_at: string;
  title?: string;
}

export interface StateHCDActivity {
  id: string;
  activity_code: string;
  title: string;
  category: StateActivityCategory;
  activity_date: string;
  activity_end_date?: string | null;
  location: string;
  lead_institution: string;
  lead_unit?: string | null;
  participating_stakeholders: StateStakeholder[];
  description: string;
  key_outcomes?: string | null;
  decisions_resolutions?: string | null;
  status: StateActivityStatus;
  submission_notes?: string | null;
  rejection_reason?: string | null;
  evidence_files: StateEvidenceFile[];
  created_by?: string | null;
  updated_by?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type ActionItemStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';

export const ACTION_ITEM_STATUS_LABELS: Record<ActionItemStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export interface StateHCDActivityActionItem {
  id: string;
  activity_id: string;
  action_title: string;
  action_description?: string | null;
  responsible_institution: string;
  responsible_person?: string | null;
  due_date: string;
  status: ActionItemStatus;
  completion_notes?: string | null;
  completed_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  // Join enrichment fields for display
  parent_activity_title?: string;
  parent_activity_code?: string;
}

export interface StateHCDPublicActionItem {
  id: string;
  activity_id: string;
  action_title: string;
  action_description?: string | null;
  responsible_institution: string;
  due_date: string;
  status: ActionItemStatus;
  created_at?: string;
  updated_at?: string;
}

export interface HCDActivityReportingOverview {
  reporting_level: 'lga' | 'state';
  activity_id: string;
  title: string;
  activity_date: string;
  activity_category: string;
  pillar_code?: string | null;
  lga_id?: string | null;
  lga_name?: string | null;
  location?: string | null;
  activity_status: string;
  activity_description?: string | null;
  beneficiaries_total?: number | null;
  budget_ngn?: number | null;
  overall_progress?: number | null;
  created_at?: string;
  updated_at?: string;
}
