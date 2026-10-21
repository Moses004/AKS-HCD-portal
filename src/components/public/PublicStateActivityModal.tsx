import React from 'react';
import {
  StateHCDActivity,
  StateHCDPublicActionItem,
  STATE_CATEGORY_LABELS,
  STATE_STATUS_LABELS,
  ACTION_ITEM_STATUS_LABELS,
} from '../../types';
import {
  X,
  Calendar,
  Building,
  Users,
  Award,
  Paperclip,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Sparkles,
  MapPin,
  FileText,
} from 'lucide-react';

interface PublicStateActivityModalProps {
  activity: StateHCDActivity | null;
  actionItems: StateHCDPublicActionItem[];
  onClose: () => void;
}

export const PublicStateActivityModal: React.FC<PublicStateActivityModalProps> = ({
  activity,
  actionItems,
  onClose,
}) => {
  if (!activity) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const associatedActions = actionItems.filter((i) => i.activity_id === activity.id);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 my-4 sm:my-8">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 p-4 sm:p-5 flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="font-mono text-[11px] sm:text-xs font-bold text-emerald-950 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                {activity.activity_code}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" />
                Published & Verified
              </span>
              <span className="text-[11px] text-slate-500 font-semibold">
                {STATE_CATEGORY_LABELS[activity.category]}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
              {activity.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            title="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Metadata Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                Activity Timeline
              </div>
              <div className="mt-1 font-bold text-slate-900 text-xs">
                {activity.activity_date}
                {activity.activity_end_date && ` to ${activity.activity_end_date}`}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <Building className="w-3.5 h-3.5 text-emerald-700" />
                Lead Institution
              </div>
              <div className="mt-1 font-bold text-slate-900 text-xs truncate" title={activity.lead_institution}>
                {activity.lead_institution}
              </div>
              {activity.lead_unit && (
                <div className="text-[11px] text-slate-500 truncate">{activity.lead_unit}</div>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                Official Venue
              </div>
              <div className="mt-1 font-bold text-slate-900 text-xs truncate" title={activity.location}>
                {activity.location || 'Akwa Ibom State'}
              </div>
            </div>
          </div>

          {/* Description & Purpose */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-700" />
              Executive Purpose & Context
            </h4>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
              {activity.description}
            </div>
          </div>

          {/* Key Outcomes & Decisions */}
          {(activity.key_outcomes || activity.decisions_resolutions) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activity.key_outcomes && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                    Key Strategic Outcomes
                  </h4>
                  <div className="p-4 rounded-xl bg-emerald-50/40 border border-emerald-200 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {activity.key_outcomes}
                  </div>
                </div>
              )}

              {activity.decisions_resolutions && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-amber-700" />
                    Resolutions & Commitments
                  </h4>
                  <div className="p-4 rounded-xl bg-amber-50/40 border border-amber-200 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {activity.decisions_resolutions}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Participating Stakeholders */}
          {Array.isArray(activity.participating_stakeholders) &&
            activity.participating_stakeholders.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-700" />
                  Participating Stakeholders ({activity.participating_stakeholders.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {activity.participating_stakeholders.map((sh, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-slate-200 bg-white text-xs space-y-0.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{sh.organization_name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold uppercase">
                          {sh.stakeholder_type}
                        </span>
                      </div>
                      {sh.role && (
                        <p className="text-[11px] text-slate-500">
                          Role: <span className="font-medium text-slate-700">{sh.role}</span>
                        </p>
                      )}
                      {sh.notes && (
                        <p className="text-[10px] text-slate-400 italic mt-0.5">{sh.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Associated Public Action Items */}
          {associatedActions.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-700" />
                Tracked Action Commitments ({associatedActions.length})
              </h4>
              <div className="space-y-2">
                {associatedActions.map((item) => {
                  const isOverdue =
                    item.due_date < todayStr && item.status !== 'completed' && item.status !== 'cancelled';

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{item.action_title}</span>
                          {isOverdue ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5" /> Overdue
                            </span>
                          ) : item.status === 'completed' ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Completed
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                              {ACTION_ITEM_STATUS_LABELS[item.status] || item.status}
                            </span>
                          )}
                        </div>
                        {item.action_description && (
                          <p className="text-[11px] text-slate-600">{item.action_description}</p>
                        )}
                        <p className="text-[10px] text-slate-500">
                          Responsible Agency: <strong className="text-slate-700">{item.responsible_institution}</strong> · Deadline: {item.due_date}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Evidence Dossier Metadata */}
          {Array.isArray(activity.evidence_files) && activity.evidence_files.length > 0 && (
            <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-emerald-700 shrink-0" />
                <div>
                  <span className="font-bold text-emerald-950">
                    Official Supporting Evidence Attached ({activity.evidence_files.length} Files)
                  </span>
                  <p className="text-[11px] text-emerald-800/80">
                    Meeting minutes, communique registers, and photographic documentation held in the Akwa Ibom State Evidence Vault.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex items-center justify-between gap-3">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Dossier Brief</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
