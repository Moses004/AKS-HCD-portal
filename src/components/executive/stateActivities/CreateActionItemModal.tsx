import React, { useState } from 'react';
import {
  StateHCDActivity,
  StateHCDActivityActionItem,
  ActionItemStatus,
  ACTION_ITEM_STATUS_LABELS,
} from '../../../types';
import { stateActivitiesService } from '../../../services/stateActivitiesService';
import { useAuth } from '../../../context/AuthContext';
import { X, Clock, AlertCircle, Check, Loader2 } from 'lucide-react';

interface CreateActionItemModalProps {
  activities: StateHCDActivity[];
  initialActivityId?: string;
  onClose: () => void;
  onSuccess: (item: StateHCDActivityActionItem, message: string) => void;
}

export const CreateActionItemModal: React.FC<CreateActionItemModalProps> = ({
  activities,
  initialActivityId,
  onClose,
  onSuccess,
}) => {
  const { currentUser } = useAuth();

  const [activityId, setActivityId] = useState(
    initialActivityId || (activities.length > 0 ? activities[0].id : '')
  );
  const [actionTitle, setActionTitle] = useState('');
  const [actionDescription, setActionDescription] = useState('');
  const [responsibleInstitution, setResponsibleInstitution] = useState('');
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14); // 2 weeks default
    return d.toISOString().split('T')[0];
  });
  const [status, setStatus] = useState<ActionItemStatus>('open');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!activityId) {
      setFormError('Please select a parent state-level activity.');
      return;
    }
    if (!actionTitle.trim()) {
      setFormError('Action point title is required.');
      return;
    }
    if (!responsibleInstitution.trim()) {
      setFormError('Responsible MDA / institution is required.');
      return;
    }
    if (!dueDate) {
      setFormError('Fulfillment due date is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: Partial<StateHCDActivityActionItem> = {
        activity_id: activityId,
        action_title: actionTitle.trim(),
        action_description: actionDescription.trim() || null,
        responsible_institution: responsibleInstitution.trim(),
        responsible_person: responsiblePerson.trim() || null,
        due_date: dueDate,
        status,
      };

      const res = await stateActivitiesService.saveActionItem(payload, currentUser);

      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to save action point.');
      }

      onSuccess(res.data, `Action point "${res.data.action_title}" recorded successfully.`);
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Error saving action item');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-700" />
            <h3 className="font-bold text-slate-900 text-sm">Add Follow-Up Action Item</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {formError && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Parent Activity */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Parent State Activity <span className="text-rose-600">*</span>
            </label>
            <select
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Select Activity...</option>
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.activity_code}: {a.title}
                </option>
              ))}
            </select>
          </div>

          {/* Action Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Action Title / Commitment <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={actionTitle}
              onChange={(e) => setActionTitle(e.target.value)}
              placeholder="e.g., Deliver Maternal Health Clinic Cold-Chain Refrigerator Audit"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Action Description & Terms of Reference <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={2}
              value={actionDescription}
              onChange={(e) => setActionDescription(e.target.value)}
              placeholder="Specific deliverables, parameters, or instructions..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Responsible Institution */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Responsible MDA / Institution <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={responsibleInstitution}
                onChange={(e) => setResponsibleInstitution(e.target.value)}
                placeholder="e.g., Ministry of Health"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Responsible Person */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Focal Officer / Lead <span className="text-slate-400 font-normal">(Internal)</span>
              </label>
              <input
                type="text"
                value={responsiblePerson}
                onChange={(e) => setResponsiblePerson(e.target.value)}
                placeholder="e.g., Director of Medical Services"
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Due Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Target Due Date <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Initial Status */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ActionItemStatus)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Recording...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Action Point</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
