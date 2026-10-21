import React from 'react';
import {
  StateHCDActivity,
  StateHCDActivityActionItem,
  StateActivityCategory,
  StateActivityStatus,
  ActionItemStatus,
  STATE_CATEGORY_LABELS,
  STATE_STATUS_LABELS,
  ACTION_ITEM_STATUS_LABELS,
} from '../../../types';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  Compass,
  Globe2,
  Award,
  Layers,
  Sparkles,
  Calendar,
  Filter,
  ArrowRight,
  PlusCircle,
  RefreshCw,
  Search,
} from 'lucide-react';

interface OverviewTabProps {
  activities: StateHCDActivity[];
  actionItems: StateHCDActivityActionItem[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onNavigateTab: (tab: 'all' | 'create' | 'actions' | 'reports') => void;
  onViewActivity: (activity: StateHCDActivity) => void;
  selectedCategory: StateActivityCategory | 'all';
  setSelectedCategory: (c: StateActivityCategory | 'all') => void;
  selectedStatus: StateActivityStatus | 'all';
  setSelectedStatus: (s: StateActivityStatus | 'all') => void;
  selectedYear: number | 'all';
  setSelectedYear: (y: number | 'all') => void;
  selectedLeadInstitution: string;
  setSelectedLeadInstitution: (inst: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  activities,
  actionItems,
  isLoading,
  error,
  onRefresh,
  onNavigateTab,
  onViewActivity,
  selectedCategory,
  setSelectedCategory,
  selectedStatus,
  setSelectedStatus,
  selectedYear,
  setSelectedYear,
  selectedLeadInstitution,
  setSelectedLeadInstitution,
  searchTerm,
  setSearchTerm,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // Calculate Action points metrics
  const openActionPoints = actionItems.filter((i) => i.status === 'open' || i.status === 'in_progress');
  const overdueActionPoints = actionItems.filter(
    (i) => i.status !== 'completed' && i.status !== 'cancelled' && i.due_date < todayStr
  );
  const completedActionPoints = actionItems.filter((i) => i.status === 'completed');

  // Category counts
  const meCount = activities.filter((a) => a.category === 'monitoring_evaluation').length;
  const partnershipsCount = activities.filter((a) => a.category === 'partnerships_stakeholder_engagement').length;
  const nationalCount = activities.filter((a) => a.category === 'national_level_engagements').length;
  const councilCount = activities.filter((a) => a.category === 'state_hcd_council_meetings').length;
  const workingGroupCount = activities.filter((a) => a.category === 'state_hcd_working_group_activities').length;
  const otherCount = activities.filter((a) => a.category === 'other_state_level_initiatives').length;

  // Status counts
  const draftCount = activities.filter((a) => a.status === 'draft').length;
  const pendingCount = activities.filter((a) => a.status === 'pending_approval').length;
  const publishedCount = activities.filter((a) => a.status === 'published').length;
  const rejectedCount = activities.filter((a) => a.status === 'rejected_draft').length;

  // Recent activities (top 5)
  const recentActivities = [...activities].slice(0, 5);

  // Urgent action items (top 5 upcoming or overdue)
  const urgentActionItems = [...actionItems]
    .filter((i) => i.status !== 'completed' && i.status !== 'cancelled')
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 5);

  // Available years from activities
  const availableYears = Array.from(
    new Set(
      activities
        .map((a) => (a.activity_date ? new Date(a.activity_date).getFullYear() : null))
        .filter((y): y is number => y !== null && !isNaN(y))
    )
  ).sort((a, b) => b - a);

  if (!availableYears.includes(new Date().getFullYear())) {
    availableYears.unshift(new Date().getFullYear());
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-slate-900 rounded-2xl p-6 text-white shadow-md border border-emerald-700/40">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-700/60 text-emerald-200 text-xs font-semibold uppercase tracking-wider mb-2 border border-emerald-500/40">
              <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
              State Executive Governance
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              State-Level Activities & Strategic Initiatives
            </h2>
            <p className="text-emerald-100/90 text-sm max-w-2xl mt-1">
              Authoritative registry and tracking of executive M&E missions, inter-ministerial council meetings, development partnerships, and follow-up action points across Akwa Ibom State.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onNavigateTab('create')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#D4AF37] text-slate-950 font-bold text-xs hover:bg-[#E5C158] transition-all shadow-sm cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-slate-950" />
              <span>Record State Activity</span>
            </button>
            <button
              onClick={() => onNavigateTab('actions')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors border border-white/20 cursor-pointer"
            >
              <Clock className="w-4 h-4 text-amber-300" />
              <span>Action Points ({actionItems.length})</span>
            </button>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/20 cursor-pointer disabled:opacity-50"
              title="Refresh Records"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Global Filter Toolbar */}
        <div className="mt-6 pt-4 border-t border-emerald-700/40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search title, venue, code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#D4AF37]"
            />
          </div>

          {/* Year Filter */}
          <div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-xs text-white focus:outline-hidden focus:ring-1 focus:ring-[#D4AF37]"
            >
              <option value="all">All Reporting Years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  Year {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any)}
              className="w-full px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-xs text-white focus:outline-hidden focus:ring-1 focus:ring-[#D4AF37]"
            >
              <option value="all">All 6 Categories</option>
              <option value="monitoring_evaluation">Monitoring & Evaluation</option>
              <option value="partnerships_stakeholder_engagement">Partnerships & Stakeholder</option>
              <option value="national_level_engagements">National-Level Engagements</option>
              <option value="state_hcd_council_meetings">State HCD Council Meetings</option>
              <option value="state_hcd_working_group_activities">Working Group Activities</option>
              <option value="other_state_level_initiatives">Other State Initiatives</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-xs text-white focus:outline-hidden focus:ring-1 focus:ring-[#D4AF37]"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft ({draftCount})</option>
              <option value="pending_approval">Pending Review ({pendingCount})</option>
              <option value="published">Published ({publishedCount})</option>
              <option value="rejected_draft">Returned Draft ({rejectedCount})</option>
            </select>
          </div>

          {/* Lead Institution */}
          <div>
            <input
              type="text"
              placeholder="Filter by Lead MDA..."
              value={selectedLeadInstitution}
              onChange={(e) => setSelectedLeadInstitution(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#D4AF37]"
            />
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <p className="text-xs font-semibold">{error}</p>
          </div>
          <button
            onClick={onRefresh}
            className="px-3 py-1 rounded bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Primary KPI Summary Cards (The 13 required metrics) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-700" />
            Strategic Activity & Governance Overview (13 Official Metrics)
          </h3>
          <span className="text-xs text-slate-500 font-medium">
            Active Filter Set: {activities.length} Activities · {actionItems.length} Action Points
          </span>
        </div>

        {/* 13 Summary Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
          {/* 1. Total State-Level Activities */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Activities</span>
              <FileText className="w-4 h-4 text-slate-700" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{activities.length}</span>
              <span className="text-[10px] text-slate-500 font-medium">Official Records</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 truncate">All categories combined</div>
          </div>

          {/* 2. Draft Activities */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Draft Activities</span>
              <FileText className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-700">{draftCount}</span>
              <span className="text-[10px] text-slate-500 font-medium">In Preparation</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">Unsubmitted working drafts</div>
          </div>

          {/* 3. Awaiting Review / Publication */}
          <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs bg-amber-50/20 hover:border-amber-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Pending Review</span>
              <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-900">{pendingCount}</span>
              <span className="text-[10px] text-amber-700 font-medium">Needs Action</span>
            </div>
            <div className="mt-1 text-[11px] text-amber-700 font-semibold">Executive approval queue</div>
          </div>

          {/* 4. Published Activities */}
          <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs bg-emerald-50/20 hover:border-emerald-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Published</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-900">{publishedCount}</span>
              <span className="text-[10px] text-emerald-700 font-medium">Publicly Eligible</span>
            </div>
            <div className="mt-1 text-[11px] text-emerald-700">Official state transparency</div>
          </div>

          {/* 5. Monitoring & Evaluation (M&E) */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">M&E Activities</span>
              <Compass className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-indigo-950">{meCount}</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 truncate">Field reviews & assessments</div>
          </div>

          {/* 6. Partnerships & Stakeholder Engagements */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Partnerships</span>
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-blue-950">{partnershipsCount}</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 truncate">CSOs, Dev Partners, Private</div>
          </div>

          {/* 7. National-Level Engagements */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-purple-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">National Level</span>
              <Globe2 className="w-4 h-4 text-purple-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-purple-950">{nationalCount}</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 truncate">NEC, Federal HCD & Summits</div>
          </div>

          {/* 8. State HCD Council Meetings */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Council Meetings</span>
              <Award className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-950">{councilCount}</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 truncate">High-level Steering Council</div>
          </div>

          {/* 9. State HCD Working Group Activities */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-teal-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider">Working Groups</span>
              <Layers className="w-4 h-4 text-teal-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-teal-950">{workingGroupCount}</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 truncate">Technical sub-committees</div>
          </div>

          {/* 10. Other State-Level Initiatives */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-amber-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Other Initiatives</span>
              <Sparkles className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-950">{otherCount}</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 truncate">Special ARISE directives</div>
          </div>

          {/* 11. Open Action Points */}
          <div className="bg-white p-4 rounded-xl border border-sky-200 shadow-xs bg-sky-50/20 hover:border-sky-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider">Open Actions</span>
              <Clock className="w-4 h-4 text-sky-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-sky-950">{openActionPoints.length}</span>
              <span className="text-[10px] text-sky-700 font-medium">In Progress</span>
            </div>
            <div className="mt-1 text-[11px] text-sky-700">Follow-up resolutions</div>
          </div>

          {/* 12. Overdue Action Points */}
          <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-xs bg-rose-50/20 hover:border-rose-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Overdue Actions</span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-700">{overdueActionPoints.length}</span>
              <span className="text-[10px] text-rose-600 font-bold">Past Due</span>
            </div>
            <div className="mt-1 text-[11px] text-rose-600 font-semibold">Requires escalation</div>
          </div>

          {/* 13. Completed Action Points */}
          <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs bg-emerald-50/20 hover:border-emerald-300 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Completed Actions</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-900">{completedActionPoints.length}</span>
              <span className="text-[10px] text-emerald-700 font-medium">Finalised</span>
            </div>
            <div className="mt-1 text-[11px] text-emerald-700">Delivered commitments</div>
          </div>
        </div>
      </div>

      {/* Two-Column Detail Section: Recent Activities & Urgent Action Points */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Recent State Activities */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-700" />
                Recent State-Level Activities
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">Latest official registrations and reviews</p>
            </div>
            <button
              onClick={() => onNavigateTab('all')}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>View All ({activities.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentActivities.length === 0 ? (
            <div className="text-center py-10 px-4 rounded-xl bg-slate-50 border border-dashed border-slate-200">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600">No state activities recorded yet</p>
              <p className="text-[11px] text-slate-400 mt-1">
                State administrators can record executive activities, M&E missions, and working sessions.
              </p>
              <button
                onClick={() => onNavigateTab('create')}
                className="mt-3 px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 cursor-pointer"
              >
                Record New Activity
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((act) => {
                const statusBadge =
                  act.status === 'published'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : act.status === 'pending_approval'
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : act.status === 'rejected_draft'
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300';

                return (
                  <div
                    key={act.id}
                    onClick={() => onViewActivity(act)}
                    className="activity-card p-3.5 rounded-xl border border-slate-200 shadow-2xs transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md hover:shadow-emerald-950/10 hover:border-emerald-300 hover:bg-emerald-50/30 cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {act.activity_code}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge}`}>
                            {STATE_STATUS_LABELS[act.status] || act.status}
                          </span>
                        </div>
                        <h5 className="text-xs font-bold text-slate-900 group-hover:text-emerald-900 line-clamp-1">
                          {act.title}
                        </h5>
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {act.lead_institution} · {STATE_CATEGORY_LABELS[act.category]}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1 justify-end">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {act.activity_date}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-1">
                          {act.evidence_files?.length || 0} evidence files
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Urgent Follow-Up Action Points */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-700" />
                Urgent Action Points & Commitments
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">Actionable resolutions pending fulfillment</p>
            </div>
            <button
              onClick={() => onNavigateTab('actions')}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>View All ({actionItems.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {urgentActionItems.length === 0 ? (
            <div className="text-center py-10 px-4 rounded-xl bg-slate-50 border border-dashed border-slate-200">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600">No pending urgent action items</p>
              <p className="text-[11px] text-slate-400 mt-1">
                All assigned follow-up commitments are currently completed or none have been assigned yet.
              </p>
              <button
                onClick={() => onNavigateTab('actions')}
                className="mt-3 px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 cursor-pointer"
              >
                Create Action Point
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {urgentActionItems.map((item) => {
                const isOverdue = item.due_date < todayStr;
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-amber-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {isOverdue ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5" /> Overdue
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                              {ACTION_ITEM_STATUS_LABELS[item.status]}
                            </span>
                          )}
                          <span className="text-[11px] font-medium text-slate-500">
                            Due: {item.due_date}
                          </span>
                        </div>
                        <h5 className="text-xs font-bold text-slate-900">{item.action_title}</h5>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Responsible: <span className="font-semibold">{item.responsible_institution}</span>
                          {item.responsible_person && ` (${item.responsible_person})`}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
