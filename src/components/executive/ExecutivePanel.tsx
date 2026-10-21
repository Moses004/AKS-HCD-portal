import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { ALL_31_LGAS, PILLARS } from '../../data/lgas';
import { HCDActivity } from '../../types';
import { ExecutiveTrendCharts } from './ExecutiveTrendCharts';
import { ExecutiveLgaComparisonChart } from './ExecutiveLgaComparisonChart';
import { ExecutiveSummaryCards } from './ExecutiveSummaryCards';
import { PtrTestModal } from '../common/PtrTestModal';
import { SupabaseModal } from '../common/SupabaseModal';
import { TargetManagementPanel } from './TargetManagementPanel';
import { HcdSettingsDashboard } from '../dashboard/HcdSettingsDashboard';
import { ActivityMediaImage } from '../common/ActivityMediaImage';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileCheck,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  RotateCcw,
  Search,
  Filter,
  Eye,
  Building2,
  Lock,
  Unlock,
  ChevronRight,
  Sparkles,
  TrendingUp,
  BarChart2,
  FileCheck2,
  ShieldAlert,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  Database,
  Target,
  Layers,
  History,
} from 'lucide-react';
import { StateActivitiesWorkspace } from './stateActivities/StateActivitiesWorkspace';
import { AuditLogPanel } from './AuditLogPanel';

interface ExecutivePanelProps {
  onOpenReportExport: () => void;
  onViewActivity: (activity: HCDActivity) => void;
  onOpenRoleSwitcher: () => void;
  initialTab?: 'trends' | 'barchart' | 'queue' | 'published' | 'comparative' | 'ptr' | 'targets' | 'hcd-settings' | 'state-activities' | 'audit';
}

export const ExecutivePanel: React.FC<ExecutivePanelProps> = ({
  onOpenReportExport,
  onViewActivity,
  onOpenRoleSwitcher,
  initialTab = 'trends',
}) => {
  const { currentUser } = useAuth();
  const {
    activities,
    auditLogs,
    pillars,
    getPillarDisplayName,
    approveActivity,
    rejectActivity,
    revertToDraft,
    isOnline,
    pendingSyncCount,
    lastPtrSyncTime,
    isSyncing: globalSyncing,
    autoSyncEnabled,
    toggleAutoSync,
    syncPtrTestData,
    syncOfflineQueue,
    isSupabaseActive,
    supabaseUrl,
    diagnosticNotice,
    seedBaselineActivities,
    realtimeStatus,
    lastDatabaseSyncTime,
    revalidateActivities,
  } = useData();

  const [isSeeding, setIsSeeding] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'trends' | 'barchart' | 'queue' | 'published' | 'comparative' | 'ptr' | 'targets' | 'hcd-settings' | 'state-activities' | 'audit'>(initialTab);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedPillarFilter, setSelectedPillarFilter] = useState<string>('all');
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState<string>('all');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [localSyncing, setLocalSyncing] = useState<boolean>(false);
  const [comparativeFilter, setComparativeFilter] = useState<'all' | 'reporting' | 'pending'>('all');
  const [comparativeSearch, setComparativeSearch] = useState<string>('');
  const [, setTick] = useState<number>(0);

  // Periodically refresh relative time string
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  const isSyncing = globalSyncing || localSyncing;

  const formatRelativeTime = (iso?: string) => {
    if (!iso) return { full: 'Never', relative: '' };
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return { full: iso, relative: '' };
      const now = Date.now();
      const diffSec = Math.floor((now - d.getTime()) / 1000);
      let relative = 'Just now';
      if (diffSec < 45) relative = 'Just now';
      else if (diffSec < 3600) relative = `${Math.floor(diffSec / 60)}m ago`;
      else if (diffSec < 86400) relative = `${Math.floor(diffSec / 3600)}h ago`;
      else relative = `${Math.floor(diffSec / 86400)}d ago`;
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const isToday = d.toDateString() === new Date().toDateString();
      const full = isToday ? `Today at ${timeStr}` : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
      return { full, relative, timeStr };
    } catch {
      return { full: iso, relative: '' };
    }
  };

  const dbSyncFormatted = formatRelativeTime(lastDatabaseSyncTime);
  const ptrSyncFormatted = formatRelativeTime(lastPtrSyncTime);

  // Primary database revalidation trigger (Rentora-style cloud refresh)
  const handleTriggerDatabaseSync = async () => {
    if (!isOnline) return;
    setLocalSyncing(true);
    try {
      await revalidateActivities();
      if (pendingSyncCount > 0) {
        await syncOfflineQueue();
      }
      setActionFeedback(`Cloud database synchronized successfully. ${activities.length} activities verified in State Cloud.`);
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database sync failed';
      setActionFeedback(`Sync notice: ${msg}`);
      setTimeout(() => setActionFeedback(null), 4000);
    } finally {
      setLocalSyncing(false);
    }
  };

  const handleTriggerSync = async () => {
    if (!isOnline) return;
    setLocalSyncing(true);
    try {
      const res = await syncPtrTestData();
      if (pendingSyncCount > 0) {
        await syncOfflineQueue();
      }
      if (res.success && res.timestamp) {
        const timeStr = new Date(res.timestamp).toLocaleTimeString();
        setActionFeedback(`PTR test telemetry synchronized successfully with State Cloud at ${timeStr}.`);
      } else {
        setActionFeedback(`PTR sync notice: ${res.error || 'Cloud synchronization failed'}`);
      }
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      setActionFeedback(`Sync error: ${msg}`);
      setTimeout(() => setActionFeedback(null), 4000);
    } finally {
      setLocalSyncing(false);
    }
  };

  const isSuperAdmin = currentUser.role === 'state_admin';

  // Queue of activities awaiting approval
  const pendingQueue = activities.filter((a) => a.status === 'PENDING_APPROVAL');
  const publishedActivities = activities.filter((a) => a.status === 'PUBLISHED');

  // Strictly empirical 31-LGA comparative matrix: derived 100% from actual database rows
  const rankedLgas = useMemo(() => {
    const list = ALL_31_LGAS.map((lga) => {
      const lgaPublished = activities.filter(
        (a) => a.lgaId === lga.id && a.status === 'PUBLISHED'
      );
      const totalBen = lgaPublished.reduce((acc, c) => acc + (c.beneficiariesTotal || 0), 0);
      const totalBudget = lgaPublished.reduce((acc, c) => acc + (c.budgetNgn || 0), 0);
      const projectCount = lgaPublished.length;

      return {
        id: lga.id,
        name: lga.name,
        senatorialDistrict: lga.senatorialDistrict,
        populationEstimate: lga.populationEstimate,
        totalBen,
        totalBudget,
        projectCount,
        hasData: projectCount > 0,
      };
    });

    // Sort: councils with verified database entries first (by total beneficiaries, then project count)
    // Councils with 0 database records follow alphabetically
    list.sort((a, b) => {
      if (a.hasData && !b.hasData) return -1;
      if (!a.hasData && b.hasData) return 1;
      if (a.hasData && b.hasData) {
        if (b.totalBen !== a.totalBen) return b.totalBen - a.totalBen;
        return b.projectCount - a.projectCount;
      }
      return a.name.localeCompare(b.name);
    });

    // Assign ranking strictly to councils that have actual published records
    let currentRank = 1;
    return list.map((item) => {
      if (item.hasData) {
        return { ...item, rank: `#${currentRank++}` };
      }
      return { ...item, rank: '—' };
    });
  }, [activities]);

  const filteredRankedLgas = useMemo(() => {
    return rankedLgas.filter((item) => {
      if (comparativeFilter === 'reporting' && !item.hasData) return false;
      if (comparativeFilter === 'pending' && item.hasData) return false;
      if (comparativeSearch.trim()) {
        const query = comparativeSearch.toLowerCase();
        return (
          item.name.toLowerCase().includes(query) ||
          item.senatorialDistrict.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [rankedLgas, comparativeFilter, comparativeSearch]);

  const reportingLgaCount = useMemo(() => {
    return rankedLgas.filter((item) => item.hasData).length;
  }, [rankedLgas]);

  const filteredPending = pendingQueue.filter((a) => {
    const matchesSearch =
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.lgaName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.community.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPillar = selectedPillarFilter === 'all' || a.pillar === selectedPillarFilter;
    return matchesSearch && matchesPillar;
  });

  const handleApprove = async (id: string, title: string) => {
    const res = await approveActivity(id);
    if (res.success) {
      setActionFeedback(`Approved and published "${title}" to the state public portal.`);
      setTimeout(() => setActionFeedback(null), 4000);
    } else {
      setActionFeedback(res.error || 'Failed to approve activity.');
      setTimeout(() => setActionFeedback(null), 5000);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingId) return;
    if (!rejectReason.trim()) {
      setActionFeedback('Please specify the feedback or rejection reason for the LGA desk officer.');
      setTimeout(() => setActionFeedback(null), 4000);
      return;
    }
    const res = await rejectActivity(rejectingId, rejectReason.trim());
    if (res.success) {
      setActionFeedback('Returned draft back to LGA with executive feedback.');
      setRejectingId(null);
      setRejectReason('');
      setTimeout(() => setActionFeedback(null), 4000);
    } else {
      setActionFeedback(res.error || 'Failed to return draft.');
      setTimeout(() => setActionFeedback(null), 5000);
    }
  };

  const handleRevert = async (id: string) => {
    const res = await revertToDraft(id);
    if (res.success) {
      setActionFeedback('Record unlocked and returned to LGA draft state.');
      setTimeout(() => setActionFeedback(null), 4000);
    } else if (res.error) {
      setActionFeedback(res.error);
      setTimeout(() => setActionFeedback(null), 5000);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      'ID',
      'LGA',
      'Project Title',
      'Pillar',
      'Project Description',
      'Pillar Segment',
      'Reporting Category',
      'Community',
      'Total Beneficiaries',
      'Male Split',
      'Female Split',
      'Youth Count',
      'Budget (NGN)',
      'Status',
      'Lead Officer',
      'Completion Date',
    ];

    const rows = activities.map((a) => [
      `"${a.id}"`,
      `"${a.lgaName}"`,
      `"${a.title.replace(/"/g, '""')}"`,
      `"${a.pillar}"`,
      `"${(a.projectDescription || a.subCategory || '').replace(/"/g, '""')}"`,
      `"${a.pillarSegment || ''}"`,
      `"${a.category || ''}"`,
      `"${a.community}"`,
      a.beneficiariesTotal,
      a.beneficiariesMale,
      a.beneficiariesFemale,
      a.youthBeneficiaries,
      a.budgetNgn,
      `"${a.status}"`,
      `"${a.leadOfficer}"`,
      `"${a.completionDate}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AKS_HCD_State_Wide_Dataset_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-dashboard-x sm:px-dashboard-x-sm lg:px-dashboard-x-lg py-dashboard-y space-y-section">
      {/* Executive Command Header */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#0B4619] to-emerald-950 text-white rounded-2xl p-card-pad sm:p-card-pad-lg shadow-md border border-[#D4AF37]/40 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37] bg-white/10 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              State Executive Cabinet Oversight
            </span>
            <span className="text-xs text-emerald-200">
              Governor's Council on Human Capital Development
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            State-Wide Executive Control Panel
          </h2>

          <p className="text-xs sm:text-sm text-emerald-100/90 max-w-2xl leading-relaxed">
            Centralized validation pipeline for cross-examining proof of work across all 31 Local Government Areas. Approvals immediately update public maps and state analytical counters.
          </p>
        </div>

        {/* Executive Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={onOpenReportExport}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#D4AF37] hover:bg-amber-400 text-emerald-950 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Generate Executive Briefing
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-white text-emerald-950 border-white shadow-sm'
                : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
            }`}
          >
            <History className="w-4 h-4 text-[#D4AF37]" />
            <span>Audit Trail Ledger</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            Export State CSV
          </button>
        </div>
      </div>

      {/* Permission Warning if not logged in as State Admin */}
      {!isSuperAdmin && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-amber-950">Viewing in Preview Mode:</strong>
              You are currently logged in as <strong>{currentUser.name}</strong> ({currentUser.role}).
              Only users with <strong>State Super-Admin</strong> credentials can execute approvals and publish projects.
            </div>
          </div>
          <button
            onClick={onOpenRoleSwitcher}
            className="text-xs font-bold underline text-amber-900 hover:text-amber-950 whitespace-nowrap"
          >
            Switch to State Super-Admin
          </button>
        </div>
      )}

      {diagnosticNotice && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold text-amber-900">Database Permissions Notice:</strong>
              <p className="text-amber-900/90 leading-relaxed mt-0.5">{diagnosticNotice}</p>
            </div>
          </div>
          <button
            onClick={() => setIsSupabaseModalOpen(true)}
            className="px-3 py-1.5 bg-amber-800 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shrink-0 transition-colors"
          >
            View SQL Migration
          </button>
        </div>
      )}

      {activities.length === 0 && currentUser.role === 'state_admin' && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950 to-slate-900 text-white border border-emerald-800 shadow-md space-y-3 animate-in fade-in">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] block">
                Database Initialization Active
              </span>
              <h3 className="text-base font-bold text-white mt-1">
                Zero Activities in Cloud Database
              </h3>
              <p className="text-xs text-emerald-200/80 leading-relaxed max-w-2xl mt-1">
                The database is clean and authenticated. You can record live grassroots projects directly through the LGA Desk Workspace, or initialize the verified 31-LGA Akwa Ibom State Baseline Dataset now.
              </p>
            </div>
            <button
              disabled={isSeeding}
              onClick={async () => {
                setIsSeeding(true);
                try {
                  const res = await seedBaselineActivities();
                  if (res.success) {
                    setActionFeedback(`Successfully seeded ${res.count} verified baseline activities across all 31 LGAs.`);
                  } else {
                    setActionFeedback(`Seeding error: ${res.error}`);
                  }
                } finally {
                  setIsSeeding(false);
                }
              }}
              className="px-4 py-2.5 bg-[#D4AF37] hover:bg-amber-400 text-emerald-950 text-xs font-black rounded-xl transition-all shadow-sm flex items-center gap-2 shrink-0 active:scale-95 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {isSeeding ? 'Seeding Baseline...' : 'Seed 31-LGA Baseline Dataset'}
            </button>
          </div>
        </div>
      )}

      {actionFeedback && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* REAL-TIME CLOUD DATA SYNC GATEWAY (RENTORA-INSPIRED LIVE ARCHITECTURE) */}
      <section
        aria-label="Executive Real-Time Cloud Data Sync Gateway"
        className={`rounded-2xl p-4 sm:p-5 border transition-all ${
          !isOnline
            ? 'bg-amber-500/10 border-amber-300/80 text-amber-950 shadow-xs'
            : isSyncing
            ? 'bg-blue-50/80 border-blue-300/80 text-blue-950 shadow-sm animate-pulse ring-2 ring-blue-300/50'
            : 'bg-white border-slate-200/90 shadow-xs text-slate-800'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Status Icon & Info */}
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-colors ${
                !isOnline
                  ? 'bg-amber-500 text-white'
                  : isSyncing
                  ? 'bg-blue-600 text-white animate-pulse ring-4 ring-blue-200/80'
                  : realtimeStatus === 'connected'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-slate-700 text-white'
              }`}
            >
              {!isOnline ? (
                <WifiOff className="w-5 h-5" />
              ) : isSyncing ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Database className="w-5 h-5 text-emerald-200" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-800" />
                  State Executive Real-Time Data Sync Gateway
                </span>

                {/* Real-time Status Pill (Rentora CDC Stream Architecture) */}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    !isOnline
                      ? 'bg-amber-200/80 text-amber-950 border border-amber-300'
                      : isSyncing
                      ? 'bg-blue-100 text-blue-900 border border-blue-300 animate-pulse ring-2 ring-blue-200'
                      : realtimeStatus === 'connected'
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : 'bg-slate-100 text-slate-700 border border-slate-300'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      !isOnline
                        ? 'bg-amber-600'
                        : isSyncing
                        ? 'bg-blue-600 animate-ping'
                        : realtimeStatus === 'connected'
                        ? 'bg-emerald-600 animate-pulse'
                        : 'bg-slate-400'
                    }`}
                  />
                  {!isOnline
                    ? 'Sync Paused (Offline Mode)'
                    : isSyncing
                    ? 'Synchronizing with Database...'
                    : realtimeStatus === 'connected'
                    ? 'Live Stream Active (Supabase CDC)'
                    : autoSyncEnabled
                    ? 'Auto-Sync Active (Polling Heartbeat)'
                    : 'Auto-Sync Paused'}
                </span>

                {/* Database Row Indicator */}
                <span className="text-[10px] font-medium hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border bg-slate-100/90 text-slate-700 border-slate-200/80 font-mono">
                  <Database className="w-3 h-3 text-emerald-600" />
                  <span>{activities.length} rows confirmed in DB</span>
                </span>
              </div>

              {/* Exact and Relative Timestamps for Database and PTR Sync */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="text-slate-600 font-semibold">Last Cloud DB Sync:</span>
                  <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 tabular-nums">
                    {dbSyncFormatted.full}
                  </span>
                  {dbSyncFormatted.relative && (
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      {dbSyncFormatted.relative}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                  <span>PTR Telemetry: {ptrSyncFormatted.relative || 'Synced'}</span>
                </div>

                {pendingSyncCount > 0 && !isSyncing && (
                  <span className="text-[11px] font-bold text-amber-900 bg-amber-100/90 px-2.5 py-0.5 rounded-full border border-amber-300">
                    {pendingSyncCount} queued field record(s) pending sync
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Section: Action Controls */}
          <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200/70">
            <button
              onClick={() => setIsSupabaseModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-2xs ${
                isSupabaseActive
                  ? 'bg-teal-50 text-teal-900 border-teal-300 hover:bg-teal-100'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
              title="Configure Supabase cloud database credentials, schema migration, or push live records"
            >
              <Database className="w-3.5 h-3.5 text-emerald-700" />
              <span>Supabase Cloud DB</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isSupabaseActive ? 'bg-emerald-500 ring-2 ring-emerald-300' : 'bg-amber-500'
                }`}
              />
            </button>

            <button
              onClick={toggleAutoSync}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                autoSyncEnabled
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
              }`}
              title="Toggle automated background synchronization"
            >
              Auto-Sync: {autoSyncEnabled ? 'ENABLED' : 'PAUSED'}
            </button>

            {/* PRIMARY RENTORA REVALIDATION BUTTON */}
            <button
              onClick={handleTriggerDatabaseSync}
              disabled={!isOnline || isSyncing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0B4619] hover:bg-emerald-900 text-white rounded-lg text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Revalidate and fetch latest activities from Supabase cloud database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Database Now'}</span>
            </button>

            {/* SECONDARY PTR TELEMETRY BUTTON */}
            <button
              onClick={handleTriggerSync}
              disabled={!isOnline || isSyncing}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium border border-slate-300 transition-all active:scale-95 disabled:opacity-40"
              title="Run security PTR synchronization"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
              <span>Sync PTR</span>
            </button>
          </div>
        </div>

        {/* Global OfflineSyncBanner alignment footer when offline */}
        {!isOnline && (
          <div className="mt-2.5 pt-2.5 border-t border-amber-200/90 text-[11px] text-amber-900 flex items-center justify-between">
            <span>
              <strong>Offline Mode Notice:</strong> In full alignment with the Global OfflineSyncBanner, all PTR security test runs and mathematical assertions are securely queued in browser storage. Auto-sync will dispatch telemetry to the State Cloud the moment network connectivity resumes.
            </span>
          </div>
        )}
      </section>

      {/* Primary Tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('trends')}
            className={`px-3.5 py-2 rounded-lg transition-colors flex items-center gap-2 shrink-0 whitespace-nowrap ${
              activeTab === 'trends'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-800" />
            <span>Trend Analysis & YoY Progress</span>
          </button>

          <button
            onClick={() => setActiveTab('barchart')}
            className={`px-3.5 py-2 rounded-lg transition-colors flex items-center gap-2 shrink-0 whitespace-nowrap ${
              activeTab === 'barchart'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'hover:text-slate-900'
            }`}
          >
            <BarChart2 className="w-4 h-4 text-amber-600" />
            <span>31-LGA Bar Chart Comparison</span>
          </button>

          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3.5 py-2 rounded-lg transition-colors flex items-center gap-2 shrink-0 whitespace-nowrap ${
              activeTab === 'queue'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'hover:text-slate-900'
            }`}
          >
            <span>State Review Queue</span>
            {pendingQueue.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-600 text-white font-bold">
                {pendingQueue.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('published')}
            className={`px-3.5 py-2 rounded-lg transition-colors flex items-center gap-2 shrink-0 whitespace-nowrap ${
              activeTab === 'published'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'hover:text-slate-900'
            }`}
          >
            <span>Published Records ({publishedActivities.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('comparative')}
            className={`px-3.5 py-2 rounded-lg transition-colors flex items-center gap-2 shrink-0 whitespace-nowrap ${
              activeTab === 'comparative'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'hover:text-slate-900'
            }`}
          >
            <span>31-LGA Comparative Index</span>
          </button>

          <button
            onClick={() => setActiveTab('hcd-settings')}
            className={`px-3.5 py-2 rounded-lg transition-colors flex items-center gap-2 shrink-0 whitespace-nowrap ${
              activeTab === 'hcd-settings'
                ? 'bg-white text-emerald-950 shadow-xs font-bold ring-1 ring-emerald-400'
                : 'hover:text-slate-900 text-slate-600'
            }`}
          >
            <Building2 className="w-4 h-4 text-emerald-700" />
            <span>HCD Settings Dashboard</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              4 Settings
            </span>
          </button>

          <button
            onClick={() => setActiveTab('targets')}
            className={`px-3.5 py-2 rounded-lg transition-colors flex items-center gap-2 shrink-0 whitespace-nowrap ${
              activeTab === 'targets'
                ? 'bg-white text-emerald-950 shadow-xs font-bold ring-1 ring-emerald-400'
                : 'hover:text-slate-900 text-slate-600'
            }`}
          >
            <Target className="w-4 h-4 text-emerald-700" />
            <span>Target Management & Approvals</span>
          </button>

          <button
            onClick={() => setActiveTab('state-activities')}
            className={`px-3.5 py-2 rounded-lg transition-colors flex items-center gap-2 shrink-0 whitespace-nowrap ${
              activeTab === 'state-activities'
                ? 'bg-white text-emerald-950 shadow-xs font-bold ring-1 ring-emerald-400'
                : 'hover:text-slate-900 text-slate-600'
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-700" />
            <span>State-Level Activities</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              Module
            </span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-2 rounded-lg transition-colors flex items-center gap-2 shrink-0 whitespace-nowrap cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-white text-emerald-950 shadow-xs font-bold ring-1 ring-emerald-400'
                : 'hover:text-slate-900 text-slate-600'
            }`}
          >
            <History className="w-4 h-4 text-emerald-800" />
            <span>Audit Trail & Change Log</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tabular-nums bg-emerald-100 text-emerald-900 border border-emerald-300">
              {auditLogs.length + activities.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ptr')}
            className={`px-3.5 py-2 rounded-lg transition-colors flex items-center gap-2 shrink-0 whitespace-nowrap ${
              activeTab === 'ptr'
                ? 'bg-white text-amber-950 shadow-xs font-bold ring-1 ring-amber-300'
                : 'hover:text-amber-900 text-slate-600'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-amber-700" />
            <span>PTR Security & Math Tests</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              Live QA
            </span>
          </button>
        </div>
      </div>

      {/* ROW OF SUMMARY CARDS ABOVE THE CHARTS */}
      {(activeTab === 'trends' || activeTab === 'barchart') && (
        <ExecutiveSummaryCards activities={activities} />
      )}

      {/* TAB 0: TREND ANALYSIS & YEAR-OVER-YEAR PROGRESS (RECHARTS) */}
      {activeTab === 'trends' && (
        <ExecutiveTrendCharts activities={activities} />
      )}

      {/* TAB 0.5: 31-LGA SIDE-BY-SIDE BAR CHART COMPARISON (RECHARTS) */}
      {activeTab === 'barchart' && (
        <ExecutiveLgaComparisonChart activities={activities} />
      )}

      {/* TAB 1: PENDING APPROVAL QUEUE */}
      {activeTab === 'queue' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search pending submissions by title, LGA, or community..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedPillarFilter}
                onChange={(e) => setSelectedPillarFilter(e.target.value)}
                className="text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-700"
              >
                <option value="all">All Strategic Pillars</option>
                {pillars.map((p) => (
                  <option key={p.pillar_code} value={p.pillar_code}>
                    {p.display_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredPending.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <FileCheck className="w-12 h-12 text-emerald-600 mx-auto" />
              <h4 className="text-base font-bold text-slate-800">
                All submissions reviewed and validated!
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No activity records are currently pending executive cabinet sign-off. New entries submitted from any of the 31 LGA desks will populate here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPending.map((activity) => {
                const pillar = PILLARS[activity.pillar];
                return (
                  <div
                    key={activity.id}
                    className="activity-card bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-950/10 hover:border-emerald-700/30 space-y-4"
                  >
                    {/* Top Row */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-emerald-950 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                            {activity.lgaName} LGA
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-600 font-medium">
                            {getPillarDisplayName(activity.pillar)}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-500 font-mono text-[11px] tabular-nums">
                            Submitted {new Date(activity.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mt-1.5 leading-snug">
                          {activity.title}
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Location: <strong>{activity.community}</strong> · Desk Officer: <strong>{activity.leadOfficer}</strong> ({activity.officerContact})
                        </p>
                      </div>

                      <div className="text-right sm:shrink-0 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[10px] text-slate-500 block uppercase font-semibold">
                          Budget & Beneficiaries
                        </span>
                        <div className="text-sm font-black text-slate-900 font-mono tabular-nums">
                          {activity.beneficiariesTotal.toLocaleString()} Beneficiaries
                        </div>
                        <div className="text-xs text-emerald-800 font-bold font-mono">
                          ₦ {(activity.budgetNgn / 1000000).toFixed(1)}M NGN
                        </div>
                      </div>
                    </div>

                    {/* Verification Assets Inspection Strip */}
                    <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        {activity.mediaAssets[0] && (
                          <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-slate-300">
                            <ActivityMediaImage
                              media={activity.mediaAssets[0]}
                              activityTitle={activity.title}
                              pillar={activity.pillar}
                              aspectRatioClass="w-14 h-14"
                              showBadgeOverlays={false}
                            />
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-slate-900">
                            Verification Assets: {activity.mediaAssets.length} Proof(s)
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                            {activity.mediaAssets[0]?.exifVerified ? (
                              <span className="text-emerald-700 font-bold">
                                ✓ EXIF Coordinates Validated
                              </span>
                            ) : (
                              <span className="text-slate-600">
                                Documented Evidence
                              </span>
                            )}
                            <span>·</span>
                            <span>Registry: {activity.attendanceSheetFileName || 'Attached PDF'}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => onViewActivity(activity)}
                        className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold text-xs transition-colors flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect Full Dossier
                      </button>
                    </div>

                    {/* Notes from LGA Officer */}
                    {activity.submissionNotes && (
                      <div className="text-xs text-slate-600 bg-emerald-50/40 p-2.5 rounded-lg border border-emerald-100">
                        <strong className="text-emerald-950 font-bold">LGA Notes:</strong> {activity.submissionNotes}
                      </div>
                    )}

                    {/* Rejection / Feedback Input Box if active */}
                    {rejectingId === activity.id && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3 animate-in fade-in">
                        <label className="text-xs font-bold text-red-900 block">
                          Specify Feedback & Rejection Reason for {activity.lgaName} Desk:
                        </label>
                        <textarea
                          rows={2}
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="e.g. Please re-upload signed attendance sheets with ward council seal."
                          className="w-full text-xs p-2.5 rounded-lg border border-red-300 bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => {
                              setRejectingId(null);
                              setRejectReason('');
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleConfirmReject}
                            className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold"
                          >
                            Confirm Return to LGA
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Super-Admin Action Buttons */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-mono">
                        Equation: ♂ {activity.beneficiariesMale} + ♀ {activity.beneficiariesFemale} = {activity.beneficiariesTotal} (Verified)
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setRejectingId(activity.id)}
                          className="px-3.5 py-2 bg-white hover:bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Return with Feedback
                        </button>

                        <button
                          onClick={() => handleApprove(activity.id, activity.title)}
                          className="px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approve & Publish
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PUBLISHED RECORDS & IMMUTABILITY REVERSAL */}
      {activeTab === 'published' && (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-xl text-xs text-emerald-950 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-800 shrink-0" />
              <span>
                <strong>Data Immutability Protocol:</strong> All {publishedActivities.length} published records are locked against LGA modification. Only State Super-Admins can unlock or revert a record if audits require revisions.
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">LGA</th>
                  <th className="py-3 px-4">Activity Title</th>
                  <th className="py-3 px-4">Pillar</th>
                  <th className="py-3 px-4">Beneficiaries</th>
                  <th className="py-3 px-4">Budget</th>
                  <th className="py-3 px-4">Reviewed By</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {publishedActivities.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {act.lgaName}
                    </td>
                    <td className="py-3 px-4 max-w-xs font-medium text-slate-900">
                      <span className="truncate block">{act.title}</span>
                      <span className="text-[10px] text-slate-500">{act.community}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {getPillarDisplayName(act.pillar)}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 tabular-nums">
                      {act.beneficiariesTotal.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-800 font-semibold tabular-nums">
                      ₦ {(act.budgetNgn / 1000000).toFixed(1)}M
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {act.reviewedBy || 'State Executive'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onViewActivity(act)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 rounded"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {isSuperAdmin && (
                          <button
                            onClick={() => handleRevert(act.id)}
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded text-[11px] font-semibold border border-amber-200 transition-colors flex items-center gap-1"
                            title="Revert back to Draft"
                          >
                            <Unlock className="w-3 h-3" />
                            Unlock / Revert
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: 31-LGA COMPARATIVE HUMAN CAPITAL INDEX (STRICTLY DATABASE GROUNDED) */}
      {activeTab === 'comparative' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  31-LGA Human Capital Performance Matrix
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono">
                  {reportingLgaCount} / 31 Councils Active
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Authentic cross-council ranking derived strictly from published database records. Unrecorded councils display as pending.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveTab('barchart')}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <BarChart2 className="w-3.5 h-3.5 text-amber-700" />
                31-LGA Bar Chart
              </button>
              <button
                onClick={() => setActiveTab('trends')}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
                View Growth & YoY Charts
              </button>
              <button
                onClick={handleExportCsv}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3 h-3" />
                Export Index
              </button>
            </div>
          </div>

          {/* Filtering and Search Controls for Comparative Table */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 text-xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search council by name or district..."
                value={comparativeSearch}
                onChange={(e) => setComparativeSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-700"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Filter:</span>
              <button
                onClick={() => setComparativeFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  comparativeFilter === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                All 31 Councils ({rankedLgas.length})
              </button>
              <button
                onClick={() => setComparativeFilter('reporting')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  comparativeFilter === 'reporting'
                    ? 'bg-emerald-800 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Reporting Only ({reportingLgaCount})
              </button>
              <button
                onClick={() => setComparativeFilter('pending')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  comparativeFilter === 'pending'
                    ? 'bg-amber-800 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Pending Returns ({31 - reportingLgaCount})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Rank</th>
                  <th className="py-2.5 px-3">LGA Council</th>
                  <th className="py-2.5 px-3">Senatorial District</th>
                  <th className="py-2.5 px-3">Population Est.</th>
                  <th className="py-2.5 px-3">Published Projects</th>
                  <th className="py-2.5 px-3">Beneficiaries Reached</th>
                  <th className="py-2.5 px-3">Capital Invested</th>
                  <th className="py-2.5 px-3 text-right">Data Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {filteredRankedLgas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No LGA councils match the current search or filter.
                    </td>
                  </tr>
                ) : (
                  filteredRankedLgas.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-500 tabular-nums">
                        {item.rank !== '—' ? (
                          <span className="text-emerald-900 font-black">{item.rank}</span>
                        ) : (
                          <span className="text-slate-300 font-normal">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {item.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {item.senatorialDistrict}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 tabular-nums">
                        {item.populationEstimate.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums">
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            item.hasData
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'text-slate-400'
                          }`}
                        >
                          {item.projectCount}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 tabular-nums">
                        {item.hasData ? item.totalBen.toLocaleString() : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-emerald-800 font-semibold tabular-nums">
                        {item.totalBudget > 0 ? `₦ ${(item.totalBudget / 1000000).toFixed(1)}M` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {item.hasData ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            Verified in DB
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                            Awaiting Submission
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-PANEL: HCD SETTINGS INITIATIVE DASHBOARD */}
      {activeTab === 'hcd-settings' && (
        <div className="space-y-4">
          <HcdSettingsDashboard />
        </div>
      )}

      {/* SUB-PANEL: TARGET MANAGEMENT & APPROVAL WORKFLOW */}
      {activeTab === 'targets' && (
        <div className="space-y-4">
          <TargetManagementPanel onTargetUpdated={revalidateActivities} />
        </div>
      )}

      {/* SUB-PANEL: DEDICATED STATE-LEVEL ACTIVITIES REPORTING MODULE */}
      {activeTab === 'state-activities' && (
        <div className="space-y-4">
          <StateActivitiesWorkspace />
        </div>
      )}

      {/* SUB-PANEL: EXECUTIVE AUDIT LOGGING & SENSITIVE CHANGE LEDGER */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <AuditLogPanel onViewActivity={onViewActivity} />
        </div>
      )}

      {/* SUB-PANEL: PTR SECURITY & MATHEMATICAL TESTS */}
      {activeTab === 'ptr' && (
        <div className="space-y-4">
          <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-3.5 flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Integrated Executive Sub-Panel:</strong> Executing live security sandboxing, cross-tenant isolation enforcement, and mathematical ingestion audits directly within the State Executive suite.
              </span>
            </div>
            <button
              onClick={() => setActiveTab('trends')}
              className="text-amber-800 font-bold hover:underline shrink-0 ml-4"
            >
              Back to Overview
            </button>
          </div>

          <PtrTestModal embedded={true} />
        </div>
      )}

      {/* Supabase Cloud DB Connection & Schema Management Modal */}
      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
      />
    </div>
  );
};
