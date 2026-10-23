import React, { useState } from 'react';
import {
  StateHCDActivity,
  StateHCDActivityActionItem,
  STATE_CATEGORY_LABELS,
  STATE_STATUS_LABELS,
  ACTION_ITEM_STATUS_LABELS,
} from '../../../types';
import { stateActivitiesService } from '../../../services/stateActivitiesService';
import {
  X,
  FileText,
  Calendar,
  Building,
  Users,
  Award,
  Paperclip,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Edit3,
  Send,
  Plus,
  Loader2,
  Download,
  Printer,
} from 'lucide-react';
import { HcdLogo } from '../../common/Logos';
import { exportStateActivitySinglePdfDossier } from '../../../utils/reportLogoHelper';

interface StateActivityDetailModalProps {
  activity: StateHCDActivity;
  actionItems: StateHCDActivityActionItem[];
  onClose: () => void;
  onEdit: (activity: StateHCDActivity) => void;
  onSubmitForReview: (activity: StateHCDActivity) => void;
  onPublish: (activity: StateHCDActivity) => void;
  onReject: (activity: StateHCDActivity, reason: string) => void;
  onAddActionPoint: (activity: StateHCDActivity) => void;
}

export const StateActivityDetailModal: React.FC<StateActivityDetailModalProps> = ({
  activity,
  actionItems,
  onClose,
  onEdit,
  onSubmitForReview,
  onPublish,
  onReject,
  onAddActionPoint,
}) => {
  const [openingStoragePath, setOpeningStoragePath] = useState<string | null>(null);
  const [rejectPromptOpen, setRejectPromptOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Associated action points
  const associatedActions = actionItems.filter((i) => i.activity_id === activity.id);

  // Status badge style
  const statusBadge =
    activity.status === 'published'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
      : activity.status === 'pending_approval'
      ? 'bg-amber-100 text-amber-800 border-amber-300'
      : activity.status === 'rejected_draft'
      ? 'bg-rose-100 text-rose-800 border-rose-300'
      : 'bg-slate-100 text-slate-700 border-slate-300';

  const handleOpenEvidence = async (storagePath: string) => {
    setOpeningStoragePath(storagePath);
    setEvidenceError(null);
    try {
      const signedUrl = await stateActivitiesService.getEvidenceSignedUrl(storagePath);
      if (signedUrl) {
        const link = document.createElement('a');
        link.href = signedUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setEvidenceError('Unable to generate secure access token for this evidence file. Object may be missing.');
      }
    } catch {
      setEvidenceError('Error accessing evidence storage vault.');
    } finally {
      setOpeningStoragePath(null);
    }
  };

  const handleConfirmReject = () => {
    if (!rejectReason.trim()) {
      setRejectError('Please specify an official reason for returning this draft.');
      return;
    }
    setRejectError(null);
    onReject(activity, rejectReason.trim());
    setRejectPromptOpen(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 my-8">
        {/* Modal Header */}
        <div className="sticky top-0 z-10 print-keep-header bg-white border-b border-slate-200 p-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-1 rounded-xl border border-[#D4AF37] bg-white shadow-2xs shrink-0">
              <HcdLogo className="w-10 h-10" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="font-mono text-xs font-bold text-emerald-950 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                  {activity.activity_code}
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusBadge}`}>
                  {STATE_STATUS_LABELS[activity.status] || activity.status}
                </span>
                <span className="text-xs text-slate-500 font-semibold">
                  {STATE_CATEGORY_LABELS[activity.category]}
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900">{activity.title}</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="no-print p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Rejection notice banner if returned draft */}
          {activity.status === 'rejected_draft' && activity.rejection_reason && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs text-rose-700">
                <AlertCircle className="w-4 h-4" />
                <span>Returned for Revision</span>
              </div>
              <p className="text-xs">{activity.rejection_reason}</p>
            </div>
          )}

          {/* Key Activity Metadata Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                Date & Duration
              </div>
              <div className="mt-1 font-bold text-slate-900 text-xs">
                {activity.activity_date}
                {activity.activity_end_date && ` to ${activity.activity_end_date}`}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                <Building className="w-3.5 h-3.5 text-emerald-700" />
                Lead MDA & Unit
              </div>
              <div className="mt-1 font-bold text-slate-900 text-xs truncate" title={activity.lead_institution}>
                {activity.lead_institution}
              </div>
              {activity.lead_unit && (
                <div className="text-[11px] text-slate-500 truncate">{activity.lead_unit}</div>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                <span>📍</span>
                Venue & Location
              </div>
              <div className="mt-1 font-bold text-slate-900 text-xs truncate" title={activity.location}>
                {activity.location}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Activity Description & Mandate
            </h4>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 whitespace-pre-line leading-relaxed">
              {activity.description}
            </div>
          </div>

          {/* Participating Stakeholders */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-700" />
                Participating Stakeholders ({activity.participating_stakeholders?.length || 0})
              </h4>
            </div>

            {!activity.participating_stakeholders || activity.participating_stakeholders.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No external stakeholders recorded.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activity.participating_stakeholders.map((sh, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-slate-200 bg-white space-y-1 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 text-xs truncate">
                        {sh.organization_name}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                        {sh.stakeholder_type}
                      </span>
                    </div>
                    {sh.role && (
                      <p className="text-[11px] text-slate-600">
                        <strong>Role:</strong> {sh.role}
                      </p>
                    )}
                    {sh.notes && (
                      <p className="text-[11px] text-slate-500 italic">
                        &quot;{sh.notes}&quot;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Key Outcomes & Decisions */}
          {(activity.key_outcomes || activity.decisions_resolutions) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activity.key_outcomes && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-emerald-700" />
                    Key Outcomes Achieved
                  </h4>
                  <div className="p-3.5 rounded-xl bg-emerald-50/40 border border-emerald-200/80 text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                    {activity.key_outcomes}
                  </div>
                </div>
              )}

              {activity.decisions_resolutions && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    Decisions & Resolutions
                  </h4>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                    {activity.decisions_resolutions}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Supporting Evidence Files */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-emerald-700" />
              Attached Evidence Files ({activity.evidence_files?.length || 0})
            </h4>

            {evidenceError && (
              <div className="p-3 mb-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
                <span>{evidenceError}</span>
                <button
                  onClick={() => setEvidenceError(null)}
                  className="text-rose-900 font-bold ml-2 cursor-pointer hover:opacity-75"
                >
                  ×
                </button>
              </div>
            )}

            {!activity.evidence_files || activity.evidence_files.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No evidence files attached.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activity.evidence_files.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white shadow-2xs hover:border-emerald-300 transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span className="text-xs font-medium text-slate-900 truncate" title={file.file_name}>
                        {file.file_name}
                      </span>
                    </div>

                    <button
                      onClick={() => handleOpenEvidence(file.file_path)}
                      disabled={openingStoragePath === file.file_path}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1 shrink-0 border border-emerald-200"
                    >
                      {openingStoragePath === file.file_path ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <ExternalLink className="w-3 h-3" />
                      )}
                      <span>View</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Follow-Up Action Points */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-700" />
                Follow-Up Action Items ({associatedActions.length})
              </h4>
              <button
                onClick={() => {
                  onAddActionPoint(activity);
                  onClose();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-bold transition-colors cursor-pointer border border-amber-200"
              >
                <Plus className="w-3 h-3" />
                <span>Add Action Point</span>
              </button>
            </div>

            {associatedActions.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No action points assigned to this activity yet.</p>
            ) : (
              <div className="space-y-2">
                {associatedActions.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                          {ACTION_ITEM_STATUS_LABELS[item.status]}
                        </span>
                        <span className="text-xs font-bold text-slate-900">{item.action_title}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Responsible: {item.responsible_institution} · Due: {item.due_date}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="sticky bottom-0 no-print bg-white border-t border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={() => void exportStateActivitySinglePdfDossier(activity, associatedActions)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF Dossier</span>
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {(activity.status === 'draft' || activity.status === 'rejected_draft') && (
              <>
                <button
                  onClick={() => {
                    onEdit(activity);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-bold hover:bg-slate-50 cursor-pointer shadow-xs"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Draft</span>
                </button>
                <button
                  onClick={() => {
                    onSubmitForReview(activity);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 cursor-pointer shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit for Review</span>
                </button>
              </>
            )}

            {activity.status === 'pending_approval' && (
              <>
                <button
                  onClick={() => setRejectPromptOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-50 text-rose-800 border border-rose-300 text-xs font-bold hover:bg-rose-100 cursor-pointer"
                >
                  <span>Return for Revision</span>
                </button>
                <button
                  onClick={() => {
                    onPublish(activity);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 cursor-pointer shadow-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve & Publish</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Return draft dialog */}
      {rejectPromptOpen && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 max-w-md w-full space-y-3 shadow-xl">
            <h4 className="font-bold text-slate-900 text-sm">Return Draft for Revision</h4>
            {rejectError && (
              <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
                {rejectError}
              </p>
            )}
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value);
                if (rejectError) setRejectError(null);
              }}
              placeholder="State revision comments or required evidence..."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectPromptOpen(false)}
                className="px-3 py-1.5 rounded text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-3.5 py-1.5 rounded bg-rose-600 text-white text-xs font-bold hover:bg-rose-700"
              >
                Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
