import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { ALL_31_LGAS, PILLARS, getLgaById } from '../../data/lgas';
import { HCDActivity, ActivityStatus } from '../../types';
import { LgaReportExportCentre } from '../reports/LgaReportExportCentre';
import { HcdSettingsDashboard } from '../dashboard/HcdSettingsDashboard';
import { ActivityDraftEditorModal } from './ActivityDraftEditorModal';
import { ActivityMediaImage } from '../common/ActivityMediaImage';
import {
  Building2,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  Trash2,
  Send,
  Eye,
  ShieldAlert,
  MapPin,
  FileText,
  Lock,
  ArrowRight,
  Flag,
  FileSpreadsheet,
} from 'lucide-react';

interface LgaDashboardProps {
  onOpenCreateWizard: () => void;
  onOpenRoleSwitcher: () => void;
  onViewActivity: (activity: HCDActivity) => void;
}

export const LgaDashboard: React.FC<LgaDashboardProps> = ({
  onOpenCreateWizard,
  onOpenRoleSwitcher,
  onViewActivity,
}) => {
  const { currentUser } = useAuth();
  const { activities, submitActivityForReview, deleteActivity, getPillarDisplayName } = useData();
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<HCDActivity | null>(null);

  // Selected LGA to view in workspace
  // An approved LGA Desk Worker is strictly locked to their approved assignedLgaId
  const [selectedLgaIdForExecutive, setSelectedLgaIdForExecutive] = useState<string>(
    currentUser.assignedLgaId || 'uyo'
  );

  const activeLgaId =
    currentUser.role === 'lga_admin' && currentUser.assignedLgaId
      ? currentUser.assignedLgaId
      : selectedLgaIdForExecutive;

  const [statusFilter, setStatusFilter] = useState<'ALL' | ActivityStatus>('ALL');
  const [crossTenantAlert, setCrossTenantAlert] = useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<'records' | 'hcd_settings'>('records');

  const currentLga = getLgaById(activeLgaId) || ALL_31_LGAS[0];
  const isAssignedTenant =
    currentUser.role === 'state_admin' ||
    (currentUser.role === 'lga_admin' && currentUser.assignedLgaId === currentLga.id);

  // Filter activities strictly belonging to this LGA
  const lgaActivities = activities.filter((a) => a.lgaId === currentLga.id);

  const filteredActivities = lgaActivities.filter((a) => {
    if (statusFilter === 'ALL') return true;
    return a.status === statusFilter;
  });

  // Calculate stats
  const publishedCount = lgaActivities.filter((a) => a.status === 'PUBLISHED').length;
  const pendingCount = lgaActivities.filter((a) => a.status === 'PENDING_APPROVAL').length;
  const draftCount = lgaActivities.filter((a) => a.status === 'DRAFT').length;
  const rejectedCount = lgaActivities.filter((a) => a.status === 'REJECTED_DRAFT').length;
  const totalBeneficiaries = lgaActivities
    .filter((a) => a.status === 'PUBLISHED')
    .reduce((acc, curr) => acc + curr.beneficiariesTotal, 0);

  const handleSubmitDraft = async (id: string) => {
    const res = await submitActivityForReview(id);
    if (!res.success) {
      setCrossTenantAlert(res.error || 'Failed to submit draft.');
    } else {
      setCrossTenantAlert(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this activity record?')) {
      const res = await deleteActivity(id);
      if (!res.success) {
        setCrossTenantAlert(res.error || 'Failed to delete record.');
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-dashboard-x sm:px-dashboard-x-sm lg:px-dashboard-x-lg py-dashboard-y space-y-section">
      {/* Workspace Header & Tenant Banner */}
      <div className="bg-white rounded-2xl p-card-pad sm:p-card-pad-lg border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/70 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" />
              Local Government Area Workspace
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Senatorial District: {currentLga.senatorialDistrict}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            {currentLga.name} Local Government Council
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
            Autonomous tenancy desk for documenting grassroots human capital development, uploading verified attendance registries, and monitoring approval queues.
          </p>
        </div>

        {/* Tenant selector and Action */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {currentUser.role === 'lga_admin' ? (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-950 shadow-xs">
              <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{currentLga.name} LGA (Authorized Jurisdiction)</span>
              <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1" />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                Viewing LGA:
              </label>
              <select
                value={activeLgaId}
                onChange={(e) => {
                  setSelectedLgaIdForExecutive(e.target.value);
                  setCrossTenantAlert(null);
                }}
                className="text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              >
                {ALL_31_LGAS.map((lga) => (
                  <option key={lga.id} value={lga.id}>
                    {lga.name} LGA
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 whitespace-nowrap cursor-pointer"
            title="Download Comprehensive LGA Report"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Export LGA Report</span>
          </button>

          {isAssignedTenant && (
            <button
              onClick={onOpenCreateWizard}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 whitespace-nowrap"
            >
              <PlusCircle className="w-4 h-4" />
              New Activity Entry
            </button>
          )}
        </div>
      </div>

      {/* Tenant Boundary Guard Warning (if user is viewing another LGA) */}
      {!isAssignedTenant && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-amber-950 font-bold">
                Read-Only Sandbox View (Tenant Isolation Active):
              </strong>
              You are authenticated as <strong>{currentUser.name}</strong> ({currentUser.assignedLgaName || 'Public'} scope).
              Write operations, draft creation, and mutations targeting <strong>{currentLga.name} LGA</strong> are structurally restricted.
            </div>
          </div>
          <button
            onClick={onOpenRoleSwitcher}
            className="text-xs font-bold underline text-amber-800 hover:text-amber-950 whitespace-nowrap"
          >
            Switch Account
          </button>
        </div>
      )}

      {crossTenantAlert && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
            <span>{crossTenantAlert}</span>
          </div>
          <button
            onClick={() => setCrossTenantAlert(null)}
            className="text-xs font-bold text-red-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Workspace View Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setWorkspaceTab('records')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            workspaceTab === 'records'
              ? 'bg-emerald-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Grassroots Activities & Milestones</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/20 text-white">
            {lgaActivities.length}
          </span>
        </button>

        <button
          onClick={() => setWorkspaceTab('hcd_settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            workspaceTab === 'hcd_settings'
              ? 'bg-emerald-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Flag className="w-4 h-4 text-amber-300" />
          <span>HCD Settings Initiative Dashboard</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            4 Settings
          </span>
        </button>
      </div>

      {workspaceTab === 'hcd_settings' ? (
        <HcdSettingsDashboard
          defaultLgaId={currentLga.id}
          onRecordInitiative={() => onOpenCreateWizard()}
        />
      ) : (
        <>
          {/* Metric Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-card-gap lg:gap-card-gap-lg">
        <div className="bg-white p-card-pad-sm sm:p-card-pad rounded-2xl border border-slate-200/90 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Verified Beneficiaries
          </span>
          <span className="text-2xl font-black text-emerald-900 font-mono tabular-nums block mt-1">
            {totalBeneficiaries.toLocaleString()}
          </span>
          <span className="text-[11px] text-emerald-700 font-medium mt-1 block">
            Published & audited
          </span>
        </div>

        <div className="bg-white p-card-pad-sm sm:p-card-pad rounded-2xl border border-slate-200/90 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Published Records
          </span>
          <span className="text-2xl font-black text-slate-900 font-mono tabular-nums block mt-1">
            {publishedCount}
          </span>
          <span className="text-[11px] text-slate-500 font-medium mt-1 block">
            Live on State Portal
          </span>
        </div>

        <div className="bg-white p-card-pad-sm sm:p-card-pad rounded-2xl border border-slate-200/90 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            State Review Queue
          </span>
          <span className="text-2xl font-black text-blue-900 font-mono tabular-nums block mt-1">
            {pendingCount}
          </span>
          <span className="text-[11px] text-blue-600 font-medium mt-1 block">
            Pending Super-Admin sign-off
          </span>
        </div>

        <div className="bg-white p-card-pad-sm sm:p-card-pad rounded-2xl border border-slate-200/90 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Internal Drafts / Issues
          </span>
          <span className="text-2xl font-black text-amber-900 font-mono tabular-nums block mt-1">
            {draftCount + rejectedCount}
          </span>
          <span className="text-[11px] text-amber-700 font-medium mt-1 block">
            {rejectedCount > 0 ? `${rejectedCount} returned with feedback` : 'Local working drafts'}
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            All Records ({lgaActivities.length})
          </button>
          <button
            onClick={() => setStatusFilter('PUBLISHED')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              statusFilter === 'PUBLISHED' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Published ({publishedCount})
          </button>
          <button
            onClick={() => setStatusFilter('PENDING_APPROVAL')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              statusFilter === 'PENDING_APPROVAL' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Pending Review ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter('DRAFT')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              statusFilter === 'DRAFT' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Drafts ({draftCount})
          </button>
          {rejectedCount > 0 && (
            <button
              onClick={() => setStatusFilter('REJECTED_DRAFT')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                statusFilter === 'REJECTED_DRAFT' ? 'bg-white text-red-900 shadow-xs' : 'text-red-700 hover:text-red-900'
              }`}
            >
              Returned ({rejectedCount})
            </button>
          )}
        </div>

        <span className="text-xs text-slate-500">
          Showing {filteredActivities.length} activity record(s) in {currentLga.name}
        </span>
      </div>

      {/* Activities Grid */}
      {filteredActivities.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="text-base font-bold text-slate-800">No activity records in this view</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Get started by creating the first human capital initiative for {currentLga.name} LGA.
          </p>
          {isAssignedTenant && (
            <button
              onClick={onOpenCreateWizard}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Create First Entry
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredActivities.map((activity) => {
            const pillar = PILLARS[activity.pillar];
            const isDraft = activity.status === 'DRAFT';
            const isPending = activity.status === 'PENDING_APPROVAL';
            const isPublished = activity.status === 'PUBLISHED';
            const isRejected = activity.status === 'REJECTED_DRAFT';

            return (
              <div
                key={activity.id}
                className="activity-card bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col justify-between transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-950/10 hover:border-emerald-700/30 group"
              >
                <div>
                  {/* Card Media Preview with Secure Resolver & Neutral Fallback */}
                  <ActivityMediaImage
                    media={activity.mediaAssets && activity.mediaAssets.length > 0 ? activity.mediaAssets[0] : null}
                    activityTitle={activity.title}
                    pillar={activity.pillar}
                    lgaName={activity.lgaName}
                    community={activity.community}
                    aspectRatioClass="h-44 w-full"
                    canReupload={true}
                    onReuploadRequested={() => onViewActivity(activity)}
                  />

                  {/* Card Details */}
                  <div className="p-5 space-y-3">
                    {/* Status and Unboxed Metadata */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                        <span>{getPillarDisplayName(activity.pillar)}</span>
                        <span>·</span>
                        <span>{new Date(activity.completionDate).toLocaleDateString()}</span>
                      </div>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          isPublished
                            ? 'bg-emerald-100 text-emerald-800'
                            : isPending
                            ? 'bg-blue-100 text-blue-800'
                            : isRejected
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {activity.status.replace('_', ' ')}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
                      {activity.title}
                    </h4>

                    {/* Feedback box if rejected */}
                    {isRejected && activity.rejectionReason && (
                      <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900 space-y-1">
                        <span className="font-bold text-[10px] uppercase text-red-800 block">
                          State Cabinet Review Feedback:
                        </span>
                        <p className="text-[11px] leading-relaxed">
                          "{activity.rejectionReason}"
                        </p>
                      </div>
                    )}

                    {/* Demographic metrics summary */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Beneficiaries</span>
                        <strong className="text-slate-900 font-mono tabular-nums text-sm">
                          {activity.beneficiariesTotal.toLocaleString()}
                        </strong>
                        <span className="text-[10px] text-slate-500 block">
                          (♂ {activity.beneficiariesMale} · ♀ {activity.beneficiariesFemale})
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Budget Incurred</span>
                        <strong className="text-slate-900 font-mono tabular-nums text-sm">
                          ₦ {(activity.budgetNgn / 1000000).toFixed(1)}M
                        </strong>
                        <span className="text-[10px] text-slate-500 block truncate">
                          Officer: {activity.leadOfficer}
                        </span>
                      </div>
                    </div>

                    {/* Milestone Phased Progress Bar */}
                    <div className="pt-2 border-t border-slate-100 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium flex items-center gap-1">
                          <Flag className="w-3 h-3 text-emerald-700" />
                          Phased Progress (
                          {activity.milestones?.length || 3} Phases)
                        </span>
                        <span className="font-bold text-emerald-900 font-mono">
                          {activity.overallProgress !== undefined
                            ? `${activity.overallProgress}%`
                            : activity.status === 'PUBLISHED'
                            ? '100%'
                            : '40%'}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-700 h-1.5 rounded-full transition-all"
                          style={{
                            width: `${
                              activity.overallProgress !== undefined
                                ? activity.overallProgress
                                : activity.status === 'PUBLISHED'
                                ? 100
                                : 40
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onViewActivity(activity)}
                      className="flex items-center gap-1 font-semibold text-slate-700 hover:text-slate-900 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Inspect Proof
                    </button>
                    {(isDraft || isRejected) && isAssignedTenant && (
                      <button
                        onClick={() => setEditingActivity(activity)}
                        className="flex items-center gap-1 font-semibold text-emerald-800 hover:text-emerald-950 transition-colors"
                        aria-label={`Edit draft ${activity.title}`}
                      >
                        <FileEdit className="w-3.5 h-3.5" />
                        Edit draft
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* If Draft or Rejected, can submit to state queue */}
                    {(isDraft || isRejected) && isAssignedTenant && (
                      <button
                        onClick={() => handleSubmitDraft(activity.id)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-emerald-800 hover:bg-emerald-900 text-white rounded-md font-semibold text-[11px] transition-colors"
                      >
                        <Send className="w-3 h-3" />
                        Submit
                      </button>
                    )}

                    {isPublished && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800">
                        <Lock className="w-3 h-3" />
                        Immutable
                      </span>
                    )}

                    {(isDraft || isRejected) && isAssignedTenant && (
                      <button
                        onClick={() => handleDelete(activity.id)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                        title="Delete Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {editingActivity && (
        <ActivityDraftEditorModal
          activity={editingActivity}
          onClose={() => setEditingActivity(null)}
          onSaved={() => setEditingActivity(null)}
        />
      )}

      {/* Comprehensive LGA Report Export Centre Modal */}
      <LgaReportExportCentre
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        defaultLgaId={activeLgaId}
      />
    </div>
  );
};
