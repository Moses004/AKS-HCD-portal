import React, { useState, useEffect } from 'react';
import {
  StateHCDActivity,
  StateHCDActivityActionItem,
  StateActivityCategory,
  StateActivityStatus,
} from '../../../types';
import { stateActivitiesService } from '../../../services/stateActivitiesService';
import { useAuth } from '../../../context/AuthContext';
import { OverviewTab } from './OverviewTab';
import { AllActivitiesTab } from './AllActivitiesTab';
import { CreateEditActivityTab } from './CreateEditActivityTab';
import { ActionPointsTab } from './ActionPointsTab';
import { ReportsExportsTab } from './ReportsExportsTab';
import { StateActivityDetailModal } from './StateActivityDetailModal';
import { CreateActionItemModal } from './CreateActionItemModal';
import {
  Layers,
  FileText,
  PlusCircle,
  Clock,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Building2,
  ShieldCheck,
} from 'lucide-react';

export type StateWorkspaceTab = 'overview' | 'all' | 'create' | 'actions' | 'reports';

interface StateActivitiesWorkspaceProps {
  initialSubTab?: StateWorkspaceTab;
}

export const StateActivitiesWorkspace: React.FC<StateActivitiesWorkspaceProps> = ({
  initialSubTab = 'overview',
}) => {
  const { currentUser } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<StateWorkspaceTab>(initialSubTab);
  const [activities, setActivities] = useState<StateHCDActivity[]>([]);
  const [actionItems, setActionItems] = useState<StateHCDActivityActionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Filters shared across overview and list
  const [selectedCategory, setSelectedCategory] = useState<StateActivityCategory | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<StateActivityStatus | 'all'>('all');
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedLeadInstitution, setSelectedLeadInstitution] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Editing state
  const [editingActivity, setEditingActivity] = useState<StateHCDActivity | null>(null);

  // Modals state
  const [viewingActivity, setViewingActivity] = useState<StateHCDActivity | null>(null);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionModalParentId, setActionModalParentId] = useState<string | undefined>(undefined);

  // Load state activities & action items from live Supabase
  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [actRes, actItemRes] = await Promise.all([
        stateActivitiesService.fetchStateActivities({
          category: selectedCategory,
          status: selectedStatus,
          leadInstitution: selectedLeadInstitution,
          year: selectedYear,
          search: searchTerm,
        }),
        stateActivitiesService.fetchActionItems({}, true),
      ]);

      if (actRes.success) {
        setActivities(actRes.data);
      } else {
        setError(actRes.error || 'Failed to fetch state activities.');
      }

      if (actItemRes.success) {
        setActionItems(actItemRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred loading state activities.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategory, selectedStatus, selectedYear, selectedLeadInstitution, searchTerm]);

  const showFeedback = (msg: string) => {
    setFeedbackNotice(msg);
    setTimeout(() => setFeedbackNotice(null), 5000);
  };

  // Workflow Handlers
  const handleEditActivity = (activity: StateHCDActivity) => {
    setEditingActivity(activity);
    setActiveSubTab('create');
  };

  const handleCreateNew = () => {
    setEditingActivity(null);
    setActiveSubTab('create');
  };

  const handleSavedActivity = (activity: StateHCDActivity, message: string) => {
    showFeedback(message);
    setEditingActivity(null);
    setActiveSubTab('all');
    loadData();
  };

  const handleSubmitForReview = async (activity: StateHCDActivity) => {
    try {
      const res = await stateActivitiesService.submitForReview(
        activity.id,
        'Submitted for executive review',
        currentUser
      );
      if (res.success) {
        showFeedback(`Activity "${activity.title}" submitted for review successfully.`);
        loadData();
      } else {
        setError(res.error || 'Failed to submit activity.');
      }
    } catch {
      setError('Error submitting activity.');
    }
  };

  const handlePublishActivity = async (activity: StateHCDActivity) => {
    try {
      const res = await stateActivitiesService.reviewStateActivity({
        activityId: activity.id,
        decision: 'publish',
        userSession: currentUser,
      });
      if (res.success) {
        showFeedback(`Activity "${activity.title}" published successfully to official state transparency.`);
        loadData();
      } else {
        setError(res.error || 'Failed to publish activity.');
      }
    } catch {
      setError('Error publishing activity.');
    }
  };

  const handleRejectActivity = async (activity: StateHCDActivity, reason: string) => {
    try {
      const res = await stateActivitiesService.reviewStateActivity({
        activityId: activity.id,
        decision: 'reject',
        rejectionReason: reason,
        userSession: currentUser,
      });
      if (res.success) {
        showFeedback(`Activity "${activity.title}" returned for revision.`);
        loadData();
      } else {
        setError(res.error || 'Failed to return activity.');
      }
    } catch {
      setError('Error returning activity.');
    }
  };

  const handleOpenAddActionModal = (activity?: StateHCDActivity | string) => {
    if (typeof activity === 'string') {
      setActionModalParentId(activity);
    } else if (activity && 'id' in activity) {
      setActionModalParentId(activity.id);
    } else {
      setActionModalParentId(undefined);
    }
    setActionModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-card-pad flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              State Executive Governance · Dedicated Reporting Module
            </span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            State-Level Activities & Follow-Up Action Points
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Distinct from 31-LGA operational interventions · Authorized executive register for Akwa Ibom State
          </p>
        </div>

        {/* Navigation Tabs (The 5 Required Sections) */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold overflow-x-auto w-full md:w-auto">
          {/* 1. Overview */}
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'overview'
                ? 'bg-white text-emerald-950 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-emerald-700" />
            <span>Overview</span>
          </button>

          {/* 2. All Activities */}
          <button
            onClick={() => setActiveSubTab('all')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'all'
                ? 'bg-white text-emerald-950 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-emerald-700" />
            <span>All Activities ({activities.length})</span>
          </button>

          {/* 3. Create Activity */}
          <button
            onClick={handleCreateNew}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'create'
                ? 'bg-white text-emerald-950 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-700" />
            <span>{editingActivity ? 'Edit Activity' : 'Create Activity'}</span>
          </button>

          {/* 4. Action Points */}
          <button
            onClick={() => setActiveSubTab('actions')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'actions'
                ? 'bg-white text-emerald-950 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Action Points ({actionItems.length})</span>
          </button>

          {/* 5. Reports and Exports */}
          <button
            onClick={() => setActiveSubTab('reports')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'reports'
                ? 'bg-white text-emerald-950 font-bold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>Reports & Exports</span>
          </button>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {feedbackNotice && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center justify-between text-xs font-semibold shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackNotice}</span>
          </div>
          <button
            onClick={() => setFeedbackNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Tab Rendering */}
      <div>
        {activeSubTab === 'overview' && (
          <OverviewTab
            activities={activities}
            actionItems={actionItems}
            isLoading={isLoading}
            error={error}
            onRefresh={loadData}
            onNavigateTab={(tab) => {
              if (tab === 'create') setEditingActivity(null);
              setActiveSubTab(tab);
            }}
            onViewActivity={(act) => setViewingActivity(act)}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            selectedStatus={selectedStatus}
            setSelectedStatus={setSelectedStatus}
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            selectedLeadInstitution={selectedLeadInstitution}
            setSelectedLeadInstitution={setSelectedLeadInstitution}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
          />
        )}

        {activeSubTab === 'all' && (
          <AllActivitiesTab
            activities={activities}
            isLoading={isLoading}
            onRefresh={loadData}
            onViewActivity={(act) => setViewingActivity(act)}
            onEditActivity={handleEditActivity}
            onSubmitForReview={handleSubmitForReview}
            onPublishActivity={handlePublishActivity}
            onRejectActivity={handleRejectActivity}
            onAddActionPoint={(act) => handleOpenAddActionModal(act)}
            onCreateNew={handleCreateNew}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            selectedStatus={selectedStatus}
            setSelectedStatus={setSelectedStatus}
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            selectedLeadInstitution={selectedLeadInstitution}
            setSelectedLeadInstitution={setSelectedLeadInstitution}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
          />
        )}

        {activeSubTab === 'create' && (
          <CreateEditActivityTab
            initialActivity={editingActivity}
            onSaved={handleSavedActivity}
            onCancel={() => {
              setEditingActivity(null);
              setActiveSubTab('all');
            }}
          />
        )}

        {activeSubTab === 'actions' && (
          <ActionPointsTab
            actionItems={actionItems}
            activities={activities}
            isLoading={isLoading}
            onRefresh={loadData}
            onOpenCreateActionModal={(activityId) => handleOpenAddActionModal(activityId)}
          />
        )}

        {activeSubTab === 'reports' && (
          <ReportsExportsTab
            activities={activities}
            actionItems={actionItems}
          />
        )}
      </div>

      {/* Detail Inspection Modal */}
      {viewingActivity && (
        <StateActivityDetailModal
          activity={viewingActivity}
          actionItems={actionItems}
          onClose={() => setViewingActivity(null)}
          onEdit={(act) => {
            setViewingActivity(null);
            handleEditActivity(act);
          }}
          onSubmitForReview={(act) => handleSubmitForReview(act)}
          onPublish={(act) => handlePublishActivity(act)}
          onReject={(act, reason) => handleRejectActivity(act, reason)}
          onAddActionPoint={(act) => handleOpenAddActionModal(act)}
        />
      )}

      {/* Create Action Point Modal */}
      {actionModalOpen && (
        <CreateActionItemModal
          activities={activities}
          initialActivityId={actionModalParentId}
          onClose={() => setActionModalOpen(false)}
          onSuccess={(item, message) => {
            showFeedback(message);
            loadData();
          }}
        />
      )}
    </div>
  );
};
