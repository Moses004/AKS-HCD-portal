import React, { useState } from 'react';
import {
  StateHCDActivity,
  StateActivityCategory,
  StateActivityStatus,
  STATE_CATEGORY_LABELS,
  STATE_STATUS_LABELS,
} from '../../../types';
import {
  Search,
  Filter,
  PlusCircle,
  Eye,
  Edit3,
  Send,
  CheckCircle2,
  XCircle,
  FileText,
  Calendar,
  Building,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Paperclip,
  Check,
  AlertCircle,
} from 'lucide-react';

interface AllActivitiesTabProps {
  activities: StateHCDActivity[];
  isLoading: boolean;
  onRefresh: () => void;
  onViewActivity: (activity: StateHCDActivity) => void;
  onEditActivity: (activity: StateHCDActivity) => void;
  onSubmitForReview: (activity: StateHCDActivity) => void;
  onPublishActivity: (activity: StateHCDActivity) => void;
  onRejectActivity: (activity: StateHCDActivity, reason: string) => void;
  onAddActionPoint: (activity: StateHCDActivity) => void;
  onCreateNew: () => void;
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

export const AllActivitiesTab: React.FC<AllActivitiesTabProps> = ({
  activities,
  isLoading,
  onRefresh,
  onViewActivity,
  onEditActivity,
  onSubmitForReview,
  onPublishActivity,
  onRejectActivity,
  onAddActionPoint,
  onCreateNew,
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
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Review modal state
  const [rejectingActivity, setRejectingActivity] = useState<StateHCDActivity | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState<string | null>(null);

  // Pagination calculation
  const totalPages = Math.ceil(activities.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedActivities = activities.slice(startIndex, startIndex + pageSize);

  const handleConfirmReject = () => {
    if (!rejectingActivity) return;
    if (!rejectionReason.trim()) {
      setRejectionError('Please state a reason for returning this draft for revision.');
      return;
    }
    setRejectionError(null);
    onRejectActivity(rejectingActivity, rejectionReason.trim());
    setRejectingActivity(null);
    setRejectionReason('');
  };

  return (
    <div className="space-y-4">
      {/* Search and Action Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex-1 w-full flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, code, venue..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value as any);
                setCurrentPage(1);
              }}
              className="text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">All Categories</option>
              <option value="monitoring_evaluation">Monitoring & Evaluation</option>
              <option value="partnerships_stakeholder_engagement">Partnerships & Stakeholder</option>
              <option value="national_level_engagements">National-Level Engagements</option>
              <option value="state_hcd_council_meetings">Council Meetings</option>
              <option value="state_hcd_working_group_activities">Working Group Activities</option>
              <option value="other_state_level_initiatives">Other State Initiatives</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as any);
                setCurrentPage(1);
              }}
              className="text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="pending_approval">Pending Review</option>
              <option value="published">Published</option>
              <option value="rejected_draft">Returned Draft</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-800 text-white font-bold text-xs hover:bg-emerald-900 transition-colors shadow-xs cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Record New Activity</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Activity Code & Date</th>
                <th className="px-4 py-3">Title & Category</th>
                <th className="px-4 py-3">Lead MDA & Unit</th>
                <th className="px-4 py-3 text-center">Stakeholders</th>
                <th className="px-4 py-3 text-center">Evidence</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    <div className="flex items-center justify-center gap-2 text-xs">
                      <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading state activities from Supabase...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedActivities.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-500">
                    <div className="max-w-md mx-auto text-center">
                      <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-700">No state activities found</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Try adjusting your filters or record a new state-level activity.
                      </p>
                      <button
                        onClick={onCreateNew}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-800 cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4" />
                        Record State Activity
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedActivities.map((act) => {
                  const statusBadge =
                    act.status === 'published'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : act.status === 'pending_approval'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : act.status === 'rejected_draft'
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : 'bg-slate-100 text-slate-700 border-slate-300';

                  const stakeholderCount = Array.isArray(act.participating_stakeholders)
                    ? act.participating_stakeholders.length
                    : 0;

                  const evidenceCount = Array.isArray(act.evidence_files)
                    ? act.evidence_files.length
                    : 0;

                  return (
                    <tr key={act.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Code & Date */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-emerald-950 bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200/80 block w-max">
                          {act.activity_code}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{act.activity_date}</span>
                        </div>
                      </td>

                      {/* Title & Category */}
                      <td className="px-4 py-3.5 max-w-xs">
                        <button
                          onClick={() => onViewActivity(act)}
                          className="font-bold text-slate-900 hover:text-emerald-800 text-left line-clamp-1 cursor-pointer"
                          title={act.title}
                        >
                          {act.title}
                        </button>
                        <span className="text-[10px] text-slate-500 block mt-0.5 line-clamp-1">
                          {STATE_CATEGORY_LABELS[act.category]}
                        </span>
                        {act.location && (
                          <span className="text-[10px] text-slate-400 block line-clamp-1">
                            📍 {act.location}
                          </span>
                        )}
                      </td>

                      {/* Lead Institution */}
                      <td className="px-4 py-3.5 max-w-[180px]">
                        <span className="font-semibold text-slate-800 block line-clamp-1">
                          {act.lead_institution}
                        </span>
                        {act.lead_unit && (
                          <span className="text-[10px] text-slate-500 block line-clamp-1">
                            Unit: {act.lead_unit}
                          </span>
                        )}
                      </td>

                      {/* Stakeholders Count */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {stakeholderCount} orgs
                        </span>
                      </td>

                      {/* Evidence Files Count */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <Paperclip className="w-2.5 h-2.5 text-slate-500" />
                          {evidenceCount} files
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge}`}>
                          {STATE_STATUS_LABELS[act.status] || act.status}
                        </span>
                        {act.status === 'rejected_draft' && act.rejection_reason && (
                          <span
                            className="block text-[10px] text-rose-600 truncate max-w-[140px] mt-0.5"
                            title={act.rejection_reason}
                          >
                            Reason: {act.rejection_reason}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View button */}
                          <button
                            onClick={() => onViewActivity(act)}
                            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                            title="View Full Activity"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Edit Draft (available for draft or rejected_draft) */}
                          {(act.status === 'draft' || act.status === 'rejected_draft') && (
                            <button
                              onClick={() => onEditActivity(act)}
                              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                              title="Edit Activity Draft"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Submit for review button (if draft or rejected) */}
                          {(act.status === 'draft' || act.status === 'rejected_draft') && (
                            <button
                              onClick={() => onSubmitForReview(act)}
                              className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-700 transition-colors cursor-pointer"
                              title="Submit for Review"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          )}

                          {/* Review controls (if pending_approval) */}
                          {act.status === 'pending_approval' && (
                            <>
                              <button
                                onClick={() => onPublishActivity(act)}
                                className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                                title="Approve and Publish to Official Transparency Area"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Publish</span>
                              </button>
                              <button
                                onClick={() => setRejectingActivity(act)}
                                className="px-2 py-1 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold transition-colors cursor-pointer inline-flex items-center gap-1 border border-rose-300"
                                title="Return Draft for Revision"
                              >
                                <XCircle className="w-3 h-3 text-rose-600" />
                                <span>Return</span>
                              </button>
                            </>
                          )}

                          {/* Add Action Point */}
                          <button
                            onClick={() => onAddActionPoint(act)}
                            className="p-1.5 rounded-md hover:bg-amber-50 text-amber-700 transition-colors cursor-pointer"
                            title="Add Follow-Up Action Item"
                          >
                            <PlusCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {activities.length > pageSize && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div>
              Showing {startIndex + 1} to {Math.min(startIndex + pageSize, activities.length)} of{' '}
              {activities.length} records
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5 inline mr-1" />
                Previous
              </button>
              <span className="font-bold text-slate-800">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Return/Reject Draft Modal */}
      {rejectingActivity && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-700 border-b border-slate-100 pb-3">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <div>
                <h4 className="font-black text-slate-900 text-sm">Return Draft for Revision</h4>
                <p className="text-xs text-slate-500">
                  Activity: {rejectingActivity.activity_code} — {rejectingActivity.title}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reason for Rejection / Requested Revisions <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={4}
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value);
                  if (rejectionError) setRejectionError(null);
                }}
                placeholder="State clearly the required corrections, missing evidence files, or updates needed before this activity can be officially published..."
                className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
              />
              {rejectionError && (
                <p className="text-xs font-semibold text-rose-600 mt-1.5">{rejectionError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setRejectingActivity(null);
                  setRejectionReason('');
                  setRejectionError(null);
                }}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 cursor-pointer"
              >
                Confirm & Return Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
