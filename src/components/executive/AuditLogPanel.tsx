import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { ALL_31_LGAS, getLgaById } from '../../data/lgas';
import { AuditLog, HCDActivity, Role } from '../../types';
import {
  ShieldCheck,
  Search,
  Filter,
  Download,
  RefreshCw,
  Clock,
  UserCheck,
  Building2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trash2,
  Edit3,
  Lock,
  Unlock,
  Target,
  Layers,
  Eye,
  X,
  PlusCircle,
  Database,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ExternalLink,
  SlidersHorizontal,
} from 'lucide-react';
import { HcdLogo } from '../common/Logos';
import { exportAuditTrailPdfReport } from '../../utils/reportLogoHelper';
import { supabaseService } from '../../services/supabaseService';

interface AuditLogPanelProps {
  onViewActivity?: (activity: HCDActivity) => void;
}

interface EnrichedAuditLog extends AuditLog {
  sourceType: 'direct_ledger' | 'activity_provenance';
  lgaDisplayName: string;
  severityLevel: 'normal' | 'elevated' | 'critical';
  categoryLabel: string;
}

const ACTION_METADATA: Record<
  string,
  {
    label: string;
    categoryLabel: string;
    badgeClass: string;
    severity: 'normal' | 'elevated' | 'critical';
  }
> = {
  APPROVED_PUBLISHED: {
    label: 'Approved & Published',
    categoryLabel: 'Executive Validation',
    badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-300',
    severity: 'elevated',
  },
  SUBMITTED: {
    label: 'Submitted for Review',
    categoryLabel: 'LGA Submission Pipeline',
    badgeClass: 'bg-blue-50 text-blue-900 border-blue-300',
    severity: 'normal',
  },
  CREATED_DRAFT: {
    label: 'Created Draft Record',
    categoryLabel: 'Field Data Entry',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    severity: 'normal',
  },
  MODIFIED: {
    label: 'Sensitive Data Modified',
    categoryLabel: 'Attribute / Budget Change',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-300',
    severity: 'elevated',
  },
  REJECTED: {
    label: 'Returned for Revision',
    categoryLabel: 'Executive Review Action',
    badgeClass: 'bg-rose-50 text-rose-900 border-rose-300',
    severity: 'elevated',
  },
  REVERTED_TO_DRAFT: {
    label: 'Unlocked Published Record',
    categoryLabel: 'Immutability Override',
    badgeClass: 'bg-purple-50 text-purple-900 border-purple-300',
    severity: 'critical',
  },
  DELETED: {
    label: 'Record Deleted',
    categoryLabel: 'Destructive Action',
    badgeClass: 'bg-rose-100 text-rose-950 border-rose-400',
    severity: 'critical',
  },
  TARGET_CONFIGURED: {
    label: 'Annual Target Configured',
    categoryLabel: 'Target Governance',
    badgeClass: 'bg-teal-50 text-teal-900 border-teal-300',
    severity: 'elevated',
  },
  TARGET_APPROVED: {
    label: 'Annual Target Approved',
    categoryLabel: 'Target Governance',
    badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-300',
    severity: 'elevated',
  },
  TARGET_RETIRED: {
    label: 'Annual Target Retired',
    categoryLabel: 'Target Governance',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    severity: 'elevated',
  },
  USER_ACCESS_CHANGED: {
    label: 'Officer RBAC / Access Changed',
    categoryLabel: 'Security & Access Control',
    badgeClass: 'bg-indigo-50 text-indigo-900 border-indigo-300',
    severity: 'critical',
  },
  STATE_ACTIVITY_GOVERNANCE: {
    label: 'State-Level Activity Action',
    categoryLabel: 'State Secretariat Module',
    badgeClass: 'bg-emerald-50 text-emerald-950 border-emerald-300',
    severity: 'elevated',
  },
  CROSS_TENANT_VIOLATION_BLOCKED: {
    label: 'Cross-Tenant Violation Blocked',
    categoryLabel: 'Security Policy Enforcement',
    badgeClass: 'bg-rose-100 text-rose-950 border-rose-400',
    severity: 'critical',
  },
};

const getActionMeta = (action: string) => {
  return (
    ACTION_METADATA[action] || {
      label: action.replace(/_/g, ' '),
      categoryLabel: 'Administrative Event',
      badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
      severity: 'normal' as const,
    }
  );
};

// Sanitize CSV cells against spreadsheet formula injection (=, +, -, @)
const sanitizeCsvCell = (val: unknown): string => {
  const raw = String(val ?? '').replace(/"/g, '""');
  if (/^[=+\-@]/.test(raw)) {
    return `"'${raw}"`;
  }
  return `"${raw}"`;
};

export const AuditLogPanel: React.FC<AuditLogPanelProps> = ({ onViewActivity }) => {
  const { currentUser } = useAuth();
  const {
    auditLogs,
    activities,
    refreshAuditLogs,
    recordAuditEvent,
    isOnline,
    isSupabaseActive,
  } = useData();

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [lgaFilter, setLgaFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [dateRangePreset, setDateRangePreset] = useState<'ALL' | 'TODAY' | '7D' | '30D' | 'CUSTOM'>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [includeDerivedHistory, setIncludeDerivedHistory] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Interactive States
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedLog, setSelectedLog] = useState<EnrichedAuditLog | null>(null);

  // Server-Side Range Pagination Archive States
  const [archivedCloudLogs, setArchivedCloudLogs] = useState<AuditLog[]>([]);
  const [cloudTotalCount, setCloudTotalCount] = useState<number | null>(null);
  const [hasMoreCloudLogs, setHasMoreCloudLogs] = useState<boolean>(true);
  const [isLoadingMoreCloud, setIsLoadingMoreCloud] = useState<boolean>(false);

  // Manual Compliance Attestation Modal State
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteLgaId, setNoteLgaId] = useState('state-level');
  const [noteActionType, setNoteActionType] = useState<'MODIFIED' | 'STATE_ACTIVITY_GOVERNANCE' | 'USER_ACCESS_CHANGED'>('STATE_ACTIVITY_GOVERNANCE');
  const [noteDetails, setNoteDetails] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  const resolveLgaLabel = (lgaId?: string): string => {
    if (!lgaId || lgaId === 'state-level') return 'State-Wide Executive';
    const found = getLgaById(lgaId);
    return found ? `${found.name} LGA` : lgaId.toUpperCase();
  };

  // Combine direct audit logs + server-paginated archive logs with verified activity lifecycle provenance
  const unifiedLogs = useMemo<EnrichedAuditLog[]>(() => {
    const directIds = new Set<string>();
    const directActivityActions = new Set<string>();

    const combinedDirectSource = [...auditLogs, ...archivedCloudLogs];
    const mappedDirect: EnrichedAuditLog[] = [];

    for (const log of combinedDirectSource) {
      if (directIds.has(log.id)) continue;
      directIds.add(log.id);
      if (log.activityId) {
        directActivityActions.add(`${log.activityId}:${log.action}`);
      }
      const meta = getActionMeta(log.action);
      mappedDirect.push({
        ...log,
        sourceType: 'direct_ledger',
        lgaDisplayName: resolveLgaLabel(log.lgaId),
        severityLevel: meta.severity,
        categoryLabel: meta.categoryLabel,
      });
    }

    if (!includeDerivedHistory) {
      return mappedDirect.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }

    const derivedLogs: EnrichedAuditLog[] = [];

    for (const act of activities) {
      // 1. Creation / Initial Submission Provenance
      const createKey = `${act.id}:CREATED_DRAFT`;
      const submitKey = `${act.id}:SUBMITTED`;
      if (!directActivityActions.has(createKey) && !directActivityActions.has(submitKey)) {
        const initAction = act.status === 'DRAFT' ? 'CREATED_DRAFT' : 'SUBMITTED';
        const meta = getActionMeta(initAction);
        derivedLogs.push({
          id: `prov-create-${act.id}`,
          timestamp: act.createdAt || new Date().toISOString(),
          activityId: act.id,
          activityTitle: act.title,
          lgaId: act.lgaId,
          performedBy: act.leadOfficer || `${act.lgaName} Desk Officer`,
          role: 'lga_admin',
          action: initAction,
          notes: `Initial project dossier registered for ${act.lgaName} (${act.community}) · Beneficiaries: ${act.beneficiariesTotal.toLocaleString()} (M: ${act.beneficiariesMale.toLocaleString()}, F: ${act.beneficiariesFemale.toLocaleString()}) · Budget: ₦${act.budgetNgn.toLocaleString()}.`,
          persistedToCloud: act.syncStatus === 'synced',
          sourceType: 'activity_provenance',
          lgaDisplayName: `${act.lgaName} LGA`,
          severityLevel: meta.severity,
          categoryLabel: meta.categoryLabel,
        });
      }

      // 2. Executive Approval & Publication Provenance
      if (act.status === 'PUBLISHED' && !directActivityActions.has(`${act.id}:APPROVED_PUBLISHED`)) {
        const meta = getActionMeta('APPROVED_PUBLISHED');
        derivedLogs.push({
          id: `prov-pub-${act.id}`,
          timestamp: act.reviewedAt || act.updatedAt || act.createdAt,
          activityId: act.id,
          activityTitle: act.title,
          lgaId: act.lgaId,
          performedBy: act.reviewedBy || 'State HCD Executive Reviewer',
          role: 'state_admin',
          action: 'APPROVED_PUBLISHED',
          notes:
            act.submissionNotes ||
            `Verified and published "${act.title}" (${act.lgaName}) to the State Public Register · Verified Beneficiaries: ${act.beneficiariesTotal.toLocaleString()} · Budget: ₦${act.budgetNgn.toLocaleString()}.`,
          persistedToCloud: true,
          sourceType: 'activity_provenance',
          lgaDisplayName: `${act.lgaName} LGA`,
          severityLevel: meta.severity,
          categoryLabel: meta.categoryLabel,
        });
      }

      // 3. Executive Rejection Provenance
      if (act.status === 'REJECTED_DRAFT' && !directActivityActions.has(`${act.id}:REJECTED`)) {
        const meta = getActionMeta('REJECTED');
        derivedLogs.push({
          id: `prov-rej-${act.id}`,
          timestamp: act.reviewedAt || act.updatedAt,
          activityId: act.id,
          activityTitle: act.title,
          lgaId: act.lgaId,
          performedBy: act.reviewedBy || 'State HCD Executive Reviewer',
          role: 'state_admin',
          action: 'REJECTED',
          notes: `Returned to ${act.lgaName} Desk Officer for revision · Reason: "${act.rejectionReason || 'Requires verification update'}"`,
          persistedToCloud: true,
          sourceType: 'activity_provenance',
          lgaDisplayName: `${act.lgaName} LGA`,
          severityLevel: meta.severity,
          categoryLabel: meta.categoryLabel,
        });
      }
    }

    return [...mappedDirect, ...derivedLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [auditLogs, archivedCloudLogs, activities, includeDerivedHistory]);

  const handleLoadOlderCloudArchive = async () => {
    if (!isOnline || isLoadingMoreCloud) return;
    setIsLoadingMoreCloud(true);
    setFeedbackBanner(null);
    try {
      const currentDirectCount = new Set([...auditLogs, ...archivedCloudLogs].map((l) => l.id)).size;
      const res = await supabaseService.fetchAuditLogsPaginated({
        offset: currentDirectCount,
        limit: 100,
        lgaId: lgaFilter !== 'ALL' && lgaFilter !== 'state-level' ? lgaFilter : undefined,
        action: actionFilter !== 'ALL' && actionFilter !== 'TARGET_ALL' ? actionFilter : undefined,
        searchQuery: searchQuery.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        userSession: currentUser,
      });

      if (res.success) {
        setArchivedCloudLogs((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const additions = res.data.filter((r) => !existingIds.has(r.id));
          return [...prev, ...additions];
        });
        setCloudTotalCount(res.totalCount);
        setHasMoreCloudLogs(res.hasMore);
        setFeedbackBanner({
          type: 'success',
          message:
            res.data.length > 0
              ? `Loaded ${res.data.length} additional cloud audit log record(s) (Total Cloud Ledger: ${res.totalCount}).`
              : `All ${res.totalCount} cloud audit ledger records are already loaded.`,
        });
      } else {
        setFeedbackBanner({
          type: 'error',
          message: res.error || 'Unable to query older cloud archive pages.',
        });
      }
      setTimeout(() => setFeedbackBanner(null), 4000);
    } finally {
      setIsLoadingMoreCloud(false);
    }
  };

  // Apply multi-dimensional filters
  const filteredLogs = useMemo(() => {
    const now = new Date();
    return unifiedLogs.filter((log) => {
      // 1. Action Filter
      if (actionFilter !== 'ALL') {
        if (actionFilter === 'TARGET_ALL') {
          if (
            log.action !== 'TARGET_CONFIGURED' &&
            log.action !== 'TARGET_APPROVED' &&
            log.action !== 'TARGET_RETIRED'
          ) {
            return false;
          }
        } else if (log.action !== actionFilter) {
          return false;
        }
      }

      // 2. Jurisdiction / LGA Filter
      if (lgaFilter !== 'ALL') {
        if (lgaFilter === 'state-level') {
          if (log.lgaId && log.lgaId !== 'state-level') return false;
        } else if (log.lgaId !== lgaFilter) {
          return false;
        }
      }

      // 3. Actor Role Filter
      if (roleFilter !== 'ALL' && log.role !== roleFilter) {
        return false;
      }

      // 4. Severity Filter
      if (severityFilter !== 'ALL' && log.severityLevel !== severityFilter) {
        return false;
      }

      // 5. Date Range Preset / Custom
      const logTime = new Date(log.timestamp);
      if (!isNaN(logTime.getTime())) {
        if (dateRangePreset === 'TODAY') {
          if (logTime.toDateString() !== now.toDateString()) return false;
        } else if (dateRangePreset === '7D') {
          const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
          if (logTime.getTime() < cutoff) return false;
        } else if (dateRangePreset === '30D') {
          const cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000;
          if (logTime.getTime() < cutoff) return false;
        } else if (dateRangePreset === 'CUSTOM') {
          if (startDate) {
            const start = new Date(`${startDate}T00:00:00`);
            if (logTime < start) return false;
          }
          if (endDate) {
            const end = new Date(`${endDate}T23:59:59`);
            if (logTime > end) return false;
          }
        }
      }

      // 6. Free-Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchActor = (log.performedBy || '').toLowerCase().includes(q);
        const matchUid = (log.actorUserId || '').toLowerCase().includes(q);
        const matchTitle = (log.activityTitle || '').toLowerCase().includes(q);
        const matchId = (log.activityId || '').toLowerCase().includes(q) || log.id.toLowerCase().includes(q);
        const matchLga = log.lgaDisplayName.toLowerCase().includes(q);
        const matchNotes = (log.notes || '').toLowerCase().includes(q);
        const matchAction = log.action.toLowerCase().includes(q);
        if (!matchActor && !matchUid && !matchTitle && !matchId && !matchLga && !matchNotes && !matchAction) {
          return false;
        }
      }

      return true;
    });
  }, [
    unifiedLogs,
    actionFilter,
    lgaFilter,
    roleFilter,
    severityFilter,
    dateRangePreset,
    startDate,
    endDate,
    searchQuery,
  ]);

  // Summary Accountability KPIs
  const summaryStats = useMemo(() => {
    const totalEvents = unifiedLogs.length;
    const directCount = unifiedLogs.filter((l) => l.sourceType === 'direct_ledger').length;
    const approvalsCount = unifiedLogs.filter(
      (l) => l.action === 'APPROVED_PUBLISHED' || l.action === 'TARGET_APPROVED'
    ).length;
    const sensitiveModsCount = unifiedLogs.filter(
      (l) =>
        l.action === 'MODIFIED' ||
        l.action === 'REVERTED_TO_DRAFT' ||
        l.action === 'DELETED' ||
        l.action === 'REJECTED' ||
        l.action === 'TARGET_CONFIGURED' ||
        l.action === 'TARGET_RETIRED'
    ).length;
    const securityAndAccessCount = unifiedLogs.filter(
      (l) =>
        l.action === 'USER_ACCESS_CHANGED' ||
        l.action === 'CROSS_TENANT_VIOLATION_BLOCKED' ||
        l.action === 'STATE_ACTIVITY_GOVERNANCE'
    ).length;
    const criticalCount = unifiedLogs.filter((l) => l.severityLevel === 'critical').length;

    return {
      totalEvents,
      directCount,
      approvalsCount,
      sensitiveModsCount,
      securityAndAccessCount,
      criticalCount,
    };
  }, [unifiedLogs]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedLogs = useMemo(() => {
    const startIdx = (safePage - 1) * pageSize;
    return filteredLogs.slice(startIdx, startIdx + pageSize);
  }, [filteredLogs, safePage]);

  const handleRefreshLedger = async () => {
    setIsRefreshing(true);
    setFeedbackBanner(null);
    try {
      const res = await refreshAuditLogs();
      if (res.success) {
        setFeedbackBanner({
          type: 'success',
          message: `Audit trail synchronized with State Cloud Ledger (${unifiedLogs.length} total accountability records verified).`,
        });
      } else {
        setFeedbackBanner({
          type: 'error',
          message: res.error || 'Could not synchronize cloud audit logs; displaying verified local & provenance ledger.',
        });
      }
      setTimeout(() => setFeedbackBanner(null), 4000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRecordComplianceNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteDetails.trim()) return;

    setIsSubmittingNote(true);
    try {
      const res = await recordAuditEvent(noteActionType, {
        activityId: `exec-audit-${Date.now()}`,
        activityTitle: noteTitle.trim(),
        lgaId: noteLgaId === 'state-level' ? undefined : noteLgaId,
        notes: noteDetails.trim(),
      });
      if (res.success) {
        setFeedbackBanner({
          type: 'success',
          message: `Executive compliance entry "${noteTitle.trim()}" recorded in the official audit trail.`,
        });
        setNoteTitle('');
        setNoteDetails('');
        setIsNoteModalOpen(false);
        setCurrentPage(1);
        setTimeout(() => setFeedbackBanner(null), 4500);
      }
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleExportAuditCsv = () => {
    const headers = [
      'Audit Event ID',
      'Timestamp (ISO-8601)',
      'Date & Time (WAT)',
      'Action Classification',
      'Severity Level',
      'Actor Name',
      'Actor UID',
      'Actor Role',
      'Jurisdiction / LGA',
      'Target Record ID',
      'Target Record Title',
      'Detailed Change & Verification Notes',
      'Ledger Source',
      'Cloud Synced',
    ];

    const rows = filteredLogs.map((log) => {
      const d = new Date(log.timestamp);
      const localFormatted = isNaN(d.getTime())
        ? log.timestamp
        : `${d.toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: '2-digit' })} ${d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
      const meta = getActionMeta(log.action);
      return [
        sanitizeCsvCell(log.id),
        sanitizeCsvCell(log.timestamp),
        sanitizeCsvCell(localFormatted),
        sanitizeCsvCell(meta.label),
        sanitizeCsvCell(log.severityLevel.toUpperCase()),
        sanitizeCsvCell(log.performedBy),
        sanitizeCsvCell(log.actorUserId || 'System / Verified Officer'),
        sanitizeCsvCell(log.role),
        sanitizeCsvCell(log.lgaDisplayName),
        sanitizeCsvCell(log.activityId || 'N/A'),
        sanitizeCsvCell(log.activityTitle || 'State Administrative Action'),
        sanitizeCsvCell(log.notes || ''),
        sanitizeCsvCell(log.sourceType === 'direct_ledger' ? 'Direct Audit Ledger' : 'Verified Activity Provenance'),
        sanitizeCsvCell(log.persistedToCloud ? 'YES' : 'SESSION_LEDGER'),
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.map((h) => `"${h}"`).join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `AKS_HCD_Executive_Audit_Ledger_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAuditPdf = async () => {
    const rows = filteredLogs.map((log) => ({
      id: log.id,
      timestamp: log.timestamp,
      actionLabel: getActionMeta(log.action).label,
      severityLevel: log.severityLevel,
      performedBy: log.performedBy,
      role: log.role,
      lgaDisplayName: log.lgaDisplayName,
      activityTitle: log.activityTitle,
      notes: log.notes,
    }));
    await exportAuditTrailPdfReport(
      rows,
      `${lgaFilter === 'ALL' ? 'All 31 LGAs' : lgaFilter} • ${actionFilter === 'ALL' ? 'All Actions' : actionFilter}`
    );
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return { dateStr: iso, timeStr: '', relativeStr: '' };
      const dateStr = d.toLocaleDateString('en-NG', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      });
      const timeStr = d.toLocaleTimeString('en-NG', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
      let relativeStr = 'Just now';
      if (diffSec < 60) relativeStr = 'Just now';
      else if (diffSec < 3600) relativeStr = `${Math.floor(diffSec / 60)}m ago`;
      else if (diffSec < 86400) relativeStr = `${Math.floor(diffSec / 3600)}h ago`;
      else relativeStr = `${Math.floor(diffSec / 86400)}d ago`;
      return { dateStr, timeStr, relativeStr };
    } catch {
      return { dateStr: iso, timeStr: '', relativeStr: '' };
    }
  };

  const resetAllFilters = () => {
    setSearchQuery('');
    setActionFilter('ALL');
    setLgaFilter('ALL');
    setRoleFilter('ALL');
    setSeverityFilter('ALL');
    setDateRangePreset('ALL');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const linkedActivityForModal = useMemo(() => {
    if (!selectedLog?.activityId) return null;
    return activities.find((a) => a.id === selectedLog.activityId) || null;
  }, [selectedLog, activities]);

  return (
    <div className="space-y-6">
      {/* Top Executive Accountability Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-card-pad sm:p-card-pad-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-1.5 rounded-xl border border-[#D4AF37] bg-white shadow-2xs shrink-0 mt-0.5">
              <HcdLogo className="w-11 h-11" />
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  Immutable Accountability & Governance Ledger
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Akwa Ibom State Administration · Department of Human Capital Development
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Sensitive Data Change & Executive Audit Trail
              </h3>
              <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
                Tracks every sensitive data mutation across all 31 Local Government Areas and the State Secretariat — including project approvals, budget & beneficiary modifications, immutability unlocks, annual target changes, and officer RBAC credentials.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {currentUser.role === 'state_admin' && (
              <button
                onClick={() => setIsNoteModalOpen(true)}
                className="px-3.5 py-2.5 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-[#D4AF37]" />
                <span>Log Compliance Attestation</span>
              </button>
            )}

            <button
              onClick={handleRefreshLedger}
              disabled={isRefreshing || !isOnline}
              className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-700' : ''}`} />
              <span>{isRefreshing ? 'Syncing Ledger...' : 'Sync Cloud Ledger'}</span>
            </button>

            <button
              onClick={handleExportAuditPdf}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Download Official Logo-Embedded PDF Audit Ledger"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Export Audit PDF ({filteredLogs.length})</span>
            </button>

            <button
              onClick={handleExportAuditCsv}
              className="px-3.5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-emerald-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Audit CSV ({filteredLogs.length})</span>
            </button>
          </div>
        </div>

        {feedbackBanner && (
          <div
            className={`mt-4 p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 ${
              feedbackBanner.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackBanner.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              )}
              <span>{feedbackBanner.message}</span>
            </div>
            <button
              onClick={() => setFeedbackBanner(null)}
              className="text-slate-500 hover:text-slate-800 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 4 Accountability KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-card-gap">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Logged Events
            </span>
            <Database className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tabular-nums">
            {summaryStats.totalEvents.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500">
            <strong className="text-slate-800 tabular-nums">{summaryStats.directCount}</strong> direct mutation logs ·{' '}
            <strong className="text-slate-800 tabular-nums">
              {summaryStats.totalEvents - summaryStats.directCount}
            </strong>{' '}
            provenance records
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Executive Approvals
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-800 font-mono tabular-nums">
            {summaryStats.approvalsCount.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500">
            Verified publications & annual LGA target approvals
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Data Edits & Reversals
            </span>
            <Edit3 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-700 font-mono tabular-nums">
            {summaryStats.sensitiveModsCount.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500">
            Budget/beneficiary edits, rejections, unlocks & deletions
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              RBAC & Security Governance
            </span>
            <Lock className="w-4 h-4 text-indigo-700" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-indigo-900 font-mono tabular-nums">
            {summaryStats.securityAndAccessCount.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500">
            <strong className="text-rose-700 tabular-nums">{summaryStats.criticalCount}</strong> high-sensitivity actions tracked
          </p>
        </div>
      </div>

      {/* Multi-Dimensional Filter Console */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search audit trail by officer name, UID, project title, LGA, action, or field change notes..."
              className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          {/* Date Range Presets */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            {(
              [
                { id: 'ALL', label: 'All Dates' },
                { id: 'TODAY', label: 'Today' },
                { id: '7D', label: 'Last 7 Days' },
                { id: '30D', label: 'Last 30 Days' },
                { id: 'CUSTOM', label: 'Custom Range' },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  setDateRangePreset(preset.id);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  dateRangePreset === preset.id
                    ? 'bg-white text-emerald-950 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Pickers if CUSTOM selected */}
        {dateRangePreset === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-semibold text-slate-700">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs"
              />
            </div>
          </div>
        )}

        {/* Dropdown Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Action Type Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Action Classification
            </label>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-700"
            >
              <option value="ALL">All Sensitive Actions ({unifiedLogs.length})</option>
              <option value="APPROVED_PUBLISHED">Approved & Published (Executive)</option>
              <option value="SUBMITTED">Submitted for State Review</option>
              <option value="CREATED_DRAFT">Created Draft Record</option>
              <option value="MODIFIED">Field / Budget / Attribute Modified</option>
              <option value="REJECTED">Returned / Rejected with Feedback</option>
              <option value="REVERTED_TO_DRAFT">Unlocked Published Record (Revert)</option>
              <option value="DELETED">Record Deleted</option>
              <option value="TARGET_ALL">Annual LGA Target Governance</option>
              <option value="USER_ACCESS_CHANGED">Officer RBAC & Access Provisioning</option>
              <option value="STATE_ACTIVITY_GOVERNANCE">State-Level Activity Governance</option>
              <option value="CROSS_TENANT_VIOLATION_BLOCKED">Security Policy / Tenant Violations</option>
            </select>
          </div>

          {/* Jurisdiction / LGA Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Jurisdiction / LGA Scope
            </label>
            <select
              value={lgaFilter}
              onChange={(e) => {
                setLgaFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-700"
            >
              <option value="ALL">All 31 LGAs & State Executive</option>
              <option value="state-level">State-Wide Executive Secretariat</option>
              {ALL_31_LGAS.map((lga) => (
                <option key={lga.id} value={lga.id}>
                  {lga.name} LGA
                </option>
              ))}
            </select>
          </div>

          {/* Actor Role Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Actor Clearance Role
            </label>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-700"
            >
              <option value="ALL">All Administrative Roles</option>
              <option value="state_admin">State Super-Administrator (state_admin)</option>
              <option value="lga_admin">LGA Desk Officer (lga_admin)</option>
            </select>
          </div>

          {/* Sensitivity / Severity Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Sensitivity Level
            </label>
            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-700"
            >
              <option value="ALL">All Sensitivity Tiers</option>
              <option value="critical">Critical (Unlocks, Deletions, RBAC, Security)</option>
              <option value="elevated">Elevated (Approvals, Edits, Rejections, Targets)</option>
              <option value="normal">Routine (Drafts & Submissions)</option>
            </select>
          </div>
        </div>

        {/* Filter Status Bar & Provenance Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-slate-600 font-medium">
              Showing <strong className="text-slate-900 font-mono tabular-nums">{filteredLogs.length}</strong> of{' '}
              <strong className="text-slate-900 font-mono tabular-nums">{unifiedLogs.length}</strong> accountability events
            </span>

            <label className="inline-flex items-center gap-2 cursor-pointer select-none text-slate-700 font-medium bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                checked={includeDerivedHistory}
                onChange={(e) => {
                  setIncludeDerivedHistory(e.target.checked);
                  setCurrentPage(1);
                }}
                className="rounded border-slate-300 text-emerald-800 focus:ring-emerald-700"
              />
              <span>Include verified activity lifecycle provenance</span>
            </label>
          </div>

          {(searchQuery ||
            actionFilter !== 'ALL' ||
            lgaFilter !== 'ALL' ||
            roleFilter !== 'ALL' ||
            severityFilter !== 'ALL' ||
            dateRangePreset !== 'ALL') && (
            <button
              onClick={resetAllFilters}
              className="text-xs font-bold text-rose-700 hover:text-rose-900 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Audit Trail Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4">Timestamp (WAT)</th>
                <th className="py-3.5 px-4">Action & Category</th>
                <th className="py-3.5 px-4">Actor & Clearance</th>
                <th className="py-3.5 px-4">Jurisdiction</th>
                <th className="py-3.5 px-4">Target Record & Sensitive Change Details</th>
                <th className="py-3.5 px-4 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-xs">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 px-6 text-center text-slate-500">
                    <div className="max-w-md mx-auto space-y-2">
                      <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="font-bold text-slate-800 text-sm">
                        No Audit Events Match Current Filter Criteria
                      </p>
                      <p className="text-xs text-slate-500">
                        Adjust your search query, date range, or action classification filter to inspect historical state administration logs.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const ts = formatTimestamp(log.timestamp);
                  const meta = getActionMeta(log.action);
                  const linkedActivity = log.activityId
                    ? activities.find((a) => a.id === log.activityId)
                    : undefined;

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-50/90 transition-colors cursor-pointer group"
                    >
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900 tabular-nums">
                          {ts.dateStr}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 tabular-nums flex items-center gap-1.5 mt-0.5">
                          <span>{ts.timeStr}</span>
                          {ts.relativeStr && (
                            <span className="text-[10px] font-sans font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              {ts.relativeStr}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action Badge */}
                      <td className="py-3.5 px-4 align-top">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                        <div className="text-[10px] font-semibold text-slate-500 mt-1">
                          {meta.categoryLabel}
                        </div>
                      </td>

                      {/* Actor & Role */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-bold text-slate-900">{log.performedBy}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                              log.role === 'state_admin'
                                ? 'bg-emerald-950 text-[#D4AF37] border-emerald-800'
                                : 'bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                          >
                            {log.role === 'state_admin' ? 'State Super-Admin' : 'LGA Desk Officer'}
                          </span>
                        </div>
                      </td>

                      {/* Jurisdiction */}
                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                          <Building2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          {log.lgaDisplayName}
                        </span>
                      </td>

                      {/* Target Record & Change Notes */}
                      <td className="py-3.5 px-4 align-top max-w-md">
                        <div className="font-bold text-slate-900 line-clamp-1">
                          {log.activityTitle || 'State Executive Governance Operation'}
                        </div>
                        {log.notes && (
                          <p className="text-slate-600 text-[11px] leading-relaxed mt-0.5 line-clamp-2">
                            {log.notes}
                          </p>
                        )}
                        {log.activityId && (
                          <span className="inline-block font-mono text-[10px] text-slate-400 mt-1 tabular-nums">
                            ID: {log.activityId}
                          </span>
                        )}
                      </td>

                      {/* Verification & Inspect */}
                      <td
                        className="py-3.5 px-4 align-top text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex flex-col items-end gap-1.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              log.persistedToCloud
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                          >
                            {log.persistedToCloud ? 'Cloud Verified' : 'Session Ledger'}
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:border-emerald-600 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-950 text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Dossier</span>
                            </button>

                            {linkedActivity && onViewActivity && (
                              <button
                                onClick={() => onViewActivity(linkedActivity)}
                                className="px-2 py-1 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                title="Open linked project dossier"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-600 font-medium font-mono tabular-nums">
              Page {safePage} of {totalPages} · Showing{' '}
              {filteredLogs.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–
              {Math.min(safePage * pageSize, filteredLogs.length)} of {filteredLogs.length} events
            </span>
            {cloudTotalCount !== null && (
              <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 tabular-nums">
                Cloud Total: {cloudTotalCount}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {isSupabaseActive && isOnline && hasMoreCloudLogs && (
              <button
                onClick={handleLoadOlderCloudArchive}
                disabled={isLoadingMoreCloud}
                className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 font-bold disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                title="Fetch older historical pages from Supabase audit_logs using server-side range pagination"
              >
                <Database className={`w-3.5 h-3.5 text-emerald-700 ${isLoadingMoreCloud ? 'animate-spin' : ''}`} />
                <span>{isLoadingMoreCloud ? 'Fetching Archive...' : 'Load Cloud Archive (+100)'}</span>
              </button>
            )}
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold disabled:opacity-40 flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold disabled:opacity-40 flex items-center gap-1 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal 1: Audit Event Inspection Dossier */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-dossier-title"
          >
            <div className="bg-gradient-to-r from-emerald-950 via-[#0B4619] to-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] block">
                  Official State Audit Dossier
                </span>
                <h3 id="audit-dossier-title" className="text-base font-bold text-white mt-0.5">
                  {getActionMeta(selectedLog.action).label}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="w-8 h-8 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs max-h-[80vh] overflow-y-auto">
              {/* Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Audit Event ID
                  </span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {selectedLog.id}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Exact Timestamp (ISO-8601)
                  </span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {selectedLog.timestamp}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Executed By Officer
                  </span>
                  <span className="font-bold text-slate-900">{selectedLog.performedBy}</span>
                  {selectedLog.actorUserId && (
                    <span className="block font-mono text-[10px] text-slate-500">
                      UID: {selectedLog.actorUserId}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Role & Jurisdiction Scope
                  </span>
                  <span className="font-bold text-emerald-900">
                    {selectedLog.role === 'state_admin' ? 'State Super-Admin' : 'LGA Desk Officer'} ·{' '}
                    {selectedLog.lgaDisplayName}
                  </span>
                </div>
              </div>

              {/* Target Record & Notes */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Target Record & Sensitive Change Summary
                </span>
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2">
                  <div className="font-bold text-sm text-slate-900">
                    {selectedLog.activityTitle || 'State Executive Governance Action'}
                  </div>
                  {selectedLog.activityId && (
                    <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                      Record Reference ID: {selectedLog.activityId}
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-100 text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {selectedLog.notes || 'No supplementary change notes recorded.'}
                  </div>
                </div>
              </div>

              {/* Linked Activity Live Snapshot if available */}
              {linkedActivityForModal && (
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                      Current Live Record Snapshot ({linkedActivityForModal.lgaName} LGA)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-emerald-900 border border-emerald-300">
                      Status: {linkedActivityForModal.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Total Beneficiaries</span>
                      <strong className="font-mono text-slate-900 tabular-nums">
                        {linkedActivityForModal.beneficiariesTotal.toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Budget Allocation</span>
                      <strong className="font-mono text-slate-900 tabular-nums">
                        ₦{linkedActivityForModal.budgetNgn.toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Lead Officer</span>
                      <strong className="text-slate-900">
                        {linkedActivityForModal.leadOfficer}
                      </strong>
                    </div>
                  </div>
                  {onViewActivity && (
                    <button
                      onClick={() => {
                        const target = linkedActivityForModal;
                        setSelectedLog(null);
                        onViewActivity(target);
                      }}
                      className="w-full py-2 rounded-lg bg-emerald-900 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Inspect Full Project Dossier</span>
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end pt-2 border-t border-slate-200">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
                >
                  Close Dossier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Log Manual Executive Compliance Attestation */}
      {isNoteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsNoteModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="compliance-note-title"
          >
            <div className="bg-gradient-to-r from-emerald-950 via-[#0B4619] to-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] block">
                  State Administration Accountability
                </span>
                <h3 id="compliance-note-title" className="text-base font-bold text-white mt-0.5">
                  Record Executive Compliance Attestation
                </h3>
              </div>
              <button
                onClick={() => setIsNoteModalOpen(false)}
                className="w-8 h-8 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordComplianceNote} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Attestation / Audit Subject Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="e.g., Q3 State-Wide Demographic Verification Sign-Off"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Governance Classification
                  </label>
                  <select
                    value={noteActionType}
                    onChange={(e) => setNoteActionType(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="STATE_ACTIVITY_GOVERNANCE">State Executive Governance</option>
                    <option value="MODIFIED">Data Audit / Reconciliation Note</option>
                    <option value="USER_ACCESS_CHANGED">Security / Access Audit Note</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Jurisdiction Scope
                  </label>
                  <select
                    value={noteLgaId}
                    onChange={(e) => setNoteLgaId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white"
                  >
                    <option value="state-level">State-Wide Executive</option>
                    {ALL_31_LGAS.map((lga) => (
                      <option key={lga.id} value={lga.id}>
                        {lga.name} LGA
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Detailed Audit Observation / Resolution Notes <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={noteDetails}
                  onChange={(e) => setNoteDetails(e.target.value)}
                  placeholder="Document the sensitive change, verification finding, or executive authorization details..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNoteModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNote}
                  className="px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white font-bold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingNote ? 'Recording...' : 'Commit to Audit Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
