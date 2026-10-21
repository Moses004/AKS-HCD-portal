import React, { useState } from 'react';
import {
  StateHCDActivityActionItem,
  StateHCDActivity,
  ActionItemStatus,
  ACTION_ITEM_STATUS_LABELS,
} from '../../../types';
import { stateActivitiesService } from '../../../services/stateActivitiesService';
import { useAuth } from '../../../context/AuthContext';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Calendar,
  Building,
  User,
  Check,
  Edit,
  ExternalLink,
  Download,
  AlertCircle,
  X,
  FileText,
} from 'lucide-react';

interface ActionPointsTabProps {
  actionItems: StateHCDActivityActionItem[];
  activities: StateHCDActivity[];
  isLoading: boolean;
  onRefresh: () => void;
  onOpenCreateActionModal: (activityId?: string) => void;
}

export const ActionPointsTab: React.FC<ActionPointsTabProps> = ({
  actionItems,
  activities,
  isLoading,
  onRefresh,
  onOpenCreateActionModal,
}) => {
  const { currentUser } = useAuth();
  const todayStr = new Date().toISOString().split('T')[0];

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [institutionFilter, setInstitutionFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activityFilter, setActivityFilter] = useState<string>('all');

  // Complete action modal state
  const [completingItem, setCompletingItem] = useState<StateHCDActivityActionItem | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);

  // Map of activity ID to activity
  const activitiesMap = new Map(activities.map((a) => [a.id, a]));

  // Filtering
  const filteredItems = actionItems.filter((item) => {
    const isOverdue = item.due_date < todayStr && item.status !== 'completed' && item.status !== 'cancelled';

    if (statusFilter === 'overdue') {
      if (!isOverdue) return false;
    } else if (statusFilter !== 'all') {
      if (item.status !== statusFilter) return false;
    }

    if (activityFilter !== 'all' && item.activity_id !== activityFilter) {
      return false;
    }

    if (institutionFilter.trim()) {
      if (!item.responsible_institution.toLowerCase().includes(institutionFilter.toLowerCase().trim())) {
        return false;
      }
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const matchTitle = item.action_title.toLowerCase().includes(term);
      const matchDesc = item.action_description?.toLowerCase().includes(term) ?? false;
      const matchPerson = item.responsible_person?.toLowerCase().includes(term) ?? false;
      const matchInst = item.responsible_institution.toLowerCase().includes(term);
      if (!matchTitle && !matchDesc && !matchPerson && !matchInst) return false;
    }

    return true;
  });

  const handleCompleteSubmit = async () => {
    if (!completingItem) return;
    setIsSubmittingCompletion(true);
    setCompletionError(null);

    try {
      const res = await stateActivitiesService.saveActionItem(
        {
          id: completingItem.id,
          status: 'completed',
          completion_notes: completionNotes.trim() || 'Action fulfilled as verified by state executive.',
        },
        currentUser
      );

      if (!res.success) {
        throw new Error(res.error || 'Failed to update action point.');
      }

      setCompletingItem(null);
      setCompletionNotes('');
      onRefresh();
    } catch (err: any) {
      setCompletionError(err.message || 'Error completing action point');
    } finally {
      setIsSubmittingCompletion(false);
    }
  };

  const handleExportCsv = () => {
    const csv = stateActivitiesService.exportActionItemsCsv(filteredItems, activitiesMap);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `state-hcd-action-points-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Action Points Header & Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-700" />
              State-Level Follow-Up Action Points & Institutional Commitments
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Track resolutions, assignments to MDAs, target completion dates, and fulfillment notes.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleExportCsv}
              disabled={filteredItems.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => onOpenCreateActionModal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Action Point</span>
            </button>
          </div>
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search action or person..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">All Action Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="overdue">Overdue Only</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">All Parent Activities</option>
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.activity_code}: {a.title.slice(0, 35)}...
                </option>
              ))}
            </select>
          </div>

          <div>
            <input
              type="text"
              placeholder="Filter by MDA..."
              value={institutionFilter}
              onChange={(e) => setInstitutionFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Main Action Items List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading action points...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">No action points found</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Create actionable follow-ups from council resolutions and M&E activities.
            </p>
            <button
              onClick={() => onOpenCreateActionModal()}
              className="mt-3 px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 cursor-pointer"
            >
              Create First Action Point
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredItems.map((item) => {
              const isOverdue =
                item.due_date < todayStr && item.status !== 'completed' && item.status !== 'cancelled';
              const parent = activitiesMap.get(item.activity_id);

              return (
                <div
                  key={item.id}
                  className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Status badge */}
                      {isOverdue ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Overdue ({item.due_date})
                        </span>
                      ) : item.status === 'completed' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Completed
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                          {ACTION_ITEM_STATUS_LABELS[item.status]}
                        </span>
                      )}

                      {/* Parent Activity Reference */}
                      {parent && (
                        <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                          <FileText className="w-3 h-3 text-slate-400" />
                          <span className="font-mono font-bold text-slate-700">{parent.activity_code}</span>: {parent.title.slice(0, 40)}...
                        </span>
                      )}

                      {/* Due Date */}
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        Target Due: <span className="font-semibold text-slate-700">{item.due_date}</span>
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-900">{item.action_title}</h4>

                    {item.action_description && (
                      <p className="text-[11px] text-slate-600 line-clamp-2">
                        {item.action_description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-0.5">
                      <span className="flex items-center gap-1">
                        <Building className="w-3 h-3 text-slate-400" />
                        Responsible MDA: <strong className="text-slate-700">{item.responsible_institution}</strong>
                      </span>
                      {item.responsible_person && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          Officer: <span className="text-slate-700">{item.responsible_person}</span>
                        </span>
                      )}
                      {item.completed_at && (
                        <span className="text-emerald-700 font-semibold">
                          Completed on: {item.completed_at.slice(0, 10)}
                        </span>
                      )}
                    </div>

                    {item.completion_notes && (
                      <div className="p-2 rounded bg-emerald-50/60 border border-emerald-200/60 text-[11px] text-emerald-900 mt-1">
                        <strong>Completion Notes:</strong> {item.completion_notes}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {item.status !== 'completed' && item.status !== 'cancelled' && (
                      <button
                        onClick={() => {
                          setCompletingItem(item);
                          setCompletionNotes('');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Mark Completed</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Complete Action Modal */}
      {completingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h4 className="font-bold text-slate-900 text-sm">Mark Action Point as Completed</h4>
              </div>
              <button
                onClick={() => setCompletingItem(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-700">Action:</p>
              <p className="text-xs text-slate-900 font-bold mt-0.5">{completingItem.action_title}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Responsible MDA: {completingItem.responsible_institution}
              </p>
            </div>

            {completionError && (
              <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {completionError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Completion Notes / Deliverable Remarks
              </label>
              <textarea
                rows={3}
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Describe how the commitment was delivered, references to transmitted documents, or verification outcomes..."
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCompletingItem(null)}
                disabled={isSubmittingCompletion}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCompleteSubmit}
                disabled={isSubmittingCompletion}
                className="px-4 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm Completion</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
