import React, { useState } from 'react';
import {
  StateHCDActivity,
  StateActivityCategory,
  StateActivityStatus,
  StateStakeholder,
  StakeholderType,
  StateEvidenceFile,
  STATE_ACTIVITY_CATEGORIES,
  STAKEHOLDER_TYPES,
  STATE_STATUS_LABELS,
} from '../../../types';
import { stateActivitiesService } from '../../../services/stateActivitiesService';
import { useAuth } from '../../../context/AuthContext';
import {
  Save,
  Send,
  X,
  Plus,
  Trash2,
  UploadCloud,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  FileText,
  Calendar,
  Building,
  Users,
  Award,
  Paperclip,
  Loader2,
  ExternalLink,
} from 'lucide-react';

interface CreateEditActivityTabProps {
  initialActivity?: StateHCDActivity | null;
  onSaved: (activity: StateHCDActivity, message: string) => void;
  onCancel: () => void;
}

export const CreateEditActivityTab: React.FC<CreateEditActivityTabProps> = ({
  initialActivity,
  onSaved,
  onCancel,
}) => {
  const { currentUser } = useAuth();
  const isEditing = Boolean(initialActivity?.id);

  // Stable activity UUID (generated upfront if new so uploads attach to proper state-level/<activity-uuid>/ path)
  const [activityId] = useState<string>(() => initialActivity?.id || crypto.randomUUID());

  // Section A: Basic Activity Information
  const [title, setTitle] = useState(initialActivity?.title || '');
  const [category, setCategory] = useState<StateActivityCategory>(
    initialActivity?.category || 'monitoring_evaluation'
  );
  const [activityDate, setActivityDate] = useState(
    initialActivity?.activity_date || new Date().toISOString().split('T')[0]
  );
  const [activityEndDate, setActivityEndDate] = useState(initialActivity?.activity_end_date || '');
  const [location, setLocation] = useState(initialActivity?.location || 'Uyo, Akwa Ibom State');
  const [leadInstitution, setLeadInstitution] = useState(
    initialActivity?.lead_institution || 'Directorate of Human Capital Development'
  );
  const [leadUnit, setLeadUnit] = useState(initialActivity?.lead_unit || '');
  const [description, setDescription] = useState(initialActivity?.description || '');

  // Section B: Participating Stakeholders
  const [stakeholders, setStakeholders] = useState<StateStakeholder[]>(() => {
    if (initialActivity?.participating_stakeholders && Array.isArray(initialActivity.participating_stakeholders)) {
      return initialActivity.participating_stakeholders;
    }
    return [];
  });

  // Section C: Outcomes and Decisions
  const [keyOutcomes, setKeyOutcomes] = useState(initialActivity?.key_outcomes || '');
  const [decisionsResolutions, setDecisionsResolutions] = useState(
    initialActivity?.decisions_resolutions || ''
  );
  const [commitmentsMade, setCommitmentsMade] = useState('');
  const [challengesEscalation, setChallengesEscalation] = useState('');

  // Section D: Supporting Documentation
  const [evidenceFiles, setEvidenceFiles] = useState<StateEvidenceFile[]>(() => {
    if (initialActivity?.evidence_files && Array.isArray(initialActivity.evidence_files)) {
      return initialActivity.evidence_files;
    }
    return [];
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Section E: Save & Submission Controls
  const [submissionNotes, setSubmissionNotes] = useState(initialActivity?.submission_notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Stakeholder helper
  const handleAddStakeholder = () => {
    setStakeholders((prev) => [
      ...prev,
      {
        organization_name: '',
        stakeholder_type: 'MDA',
        role: '',
        notes: '',
      },
    ]);
  };

  const handleUpdateStakeholder = (index: number, field: keyof StateStakeholder, value: any) => {
    setStakeholders((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveStakeholder = (index: number) => {
    setStakeholders((prev) => prev.filter((_, i) => i !== index));
  };

  // Evidence upload helper (Uploads into state-level/<activity-uuid>/<timestamp>_<filename>)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadError(null);
    setIsUploading(true);

    try {
      const newFiles: StateEvidenceFile[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await stateActivitiesService.uploadStateEvidence(file, file.name, activityId);

        if (!res.success || !res.storagePath) {
          throw new Error(res.error || `Failed to upload ${file.name}`);
        }

        newFiles.push({
          file_name: file.name,
          file_path: res.storagePath,
          file_size: file.size,
          file_type: file.type || 'application/octet-stream',
          uploaded_at: new Date().toISOString(),
          title: file.name,
        });
      }

      setEvidenceFiles((prev) => [...prev, ...newFiles]);
    } catch (err: any) {
      setUploadError(err.message || 'Error uploading file(s)');
    } finally {
      setIsUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleRemoveEvidence = (index: number) => {
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Form Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!title.trim()) {
      errors.title = 'Activity title is required.';
    } else if (title.trim().length < 5) {
      errors.title = 'Title must be at least 5 characters.';
    }

    if (!activityDate) {
      errors.activityDate = 'Activity date is required.';
    }

    if (!location.trim()) {
      errors.location = 'Location or venue is required.';
    }

    if (!leadInstitution.trim()) {
      errors.leadInstitution = 'Lead institution / MDA is required.';
    }

    if (!description.trim()) {
      errors.description = 'Activity description and purpose is required.';
    }

    // Validate stakeholders
    for (let i = 0; i < stakeholders.length; i++) {
      if (!stakeholders[i].organization_name.trim()) {
        errors[`stakeholder_${i}`] = `Stakeholder #${i + 1} organization name is required.`;
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save handler (Draft vs Submit for review)
  const handleSave = async (targetStatus: 'draft' | 'pending_approval') => {
    setFormError(null);

    if (!validateForm()) {
      setFormError('Please resolve the validation errors highlighted below before proceeding.');
      return;
    }

    setIsSaving(true);

    try {
      // Assemble combined resolutions/commitments into decisions_resolutions if present
      let finalDecisions = decisionsResolutions.trim();
      if (commitmentsMade.trim()) {
        finalDecisions += (finalDecisions ? '\n\n' : '') + `[Commitments Made]\n${commitmentsMade.trim()}`;
      }
      if (challengesEscalation.trim()) {
        finalDecisions += (finalDecisions ? '\n\n' : '') + `[Challenges & Escalations]\n${challengesEscalation.trim()}`;
      }

      const payload: Partial<StateHCDActivity> = {
        id: activityId,
        title: title.trim(),
        category,
        activity_date: activityDate,
        activity_end_date: activityEndDate ? activityEndDate : null,
        location: location.trim(),
        lead_institution: leadInstitution.trim(),
        lead_unit: leadUnit.trim() || null,
        participating_stakeholders: stakeholders,
        description: description.trim(),
        key_outcomes: keyOutcomes.trim() || null,
        decisions_resolutions: finalDecisions || null,
        status: targetStatus,
        submission_notes: submissionNotes.trim() || null,
        evidence_files: evidenceFiles,
      };

      const result = await stateActivitiesService.saveStateActivity(payload, currentUser);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to save state activity to database.');
      }

      const successMsg =
        targetStatus === 'pending_approval'
          ? `State activity "${result.data.title}" successfully submitted for executive review & publication!`
          : `State activity draft "${result.data.title}" saved successfully.`;

      onSaved(result.data, successMsg);
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 max-w-5xl mx-auto space-y-8">
      {/* Form Header */}
      <div className="border-b border-slate-200 pb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
              State-Level Activities Module
            </span>
            {initialActivity?.activity_code && (
              <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                {initialActivity.activity_code}
              </span>
            )}
            {initialActivity?.status && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                Current: {STATE_STATUS_LABELS[initialActivity.status]}
              </span>
            )}
          </div>
          <h2 className="text-xl font-black text-slate-900">
            {isEditing ? 'Edit State-Level Activity' : 'Record New State-Level Activity'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Document strategic executive engagements, M&E assessments, council resolutions, and evidence files.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Form Global Error */}
      {formError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h5 className="text-xs font-bold">Unable to complete save operation</h5>
            <p className="text-xs mt-0.5">{formError}</p>
          </div>
        </div>
      )}

      {/* SECTION A: Basic Activity Information */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-2">
          <FileText className="w-4 h-4 text-emerald-700" />
          <h3 className="text-sm font-bold uppercase tracking-wider">
            Section A — Basic Activity Information
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Title */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Activity Title <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Akwa Ibom State HCD Steering Council Inaugural Harmonisation Session"
              className={`w-full px-3 py-2 text-xs rounded-lg border ${
                validationErrors.title ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
              } focus:outline-hidden focus:ring-1 focus:ring-emerald-500`}
            />
            {validationErrors.title && (
              <p className="text-[11px] text-rose-600 mt-1">{validationErrors.title}</p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Activity Category <span className="text-rose-600">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as StateActivityCategory)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            >
              {STATE_ACTIVITY_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              {STATE_ACTIVITY_CATEGORIES.find((c) => c.value === category)?.description}
            </p>
          </div>

          {/* Location / Venue */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Location / Venue <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Executive Council Chambers, Government House, Uyo"
              className={`w-full px-3 py-2 text-xs rounded-lg border ${
                validationErrors.location ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
              } focus:outline-hidden focus:ring-1 focus:ring-emerald-500`}
            />
            {validationErrors.location && (
              <p className="text-[11px] text-rose-600 mt-1">{validationErrors.location}</p>
            )}
          </div>

          {/* Activity Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Activity Date (Start) <span className="text-rose-600">*</span>
            </label>
            <input
              type="date"
              value={activityDate}
              onChange={(e) => setActivityDate(e.target.value)}
              className={`w-full px-3 py-2 text-xs rounded-lg border ${
                validationErrors.activityDate ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
              } focus:outline-hidden focus:ring-1 focus:ring-emerald-500`}
            />
            {validationErrors.activityDate && (
              <p className="text-[11px] text-rose-600 mt-1">{validationErrors.activityDate}</p>
            )}
          </div>

          {/* Optional End Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Activity End Date <span className="text-slate-400 font-normal">(Optional for multi-day)</span>
            </label>
            <input
              type="date"
              value={activityEndDate}
              min={activityDate}
              onChange={(e) => setActivityEndDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Lead Institution */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Lead Institution / Ministry / Department <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={leadInstitution}
              onChange={(e) => setLeadInstitution(e.target.value)}
              placeholder="e.g., Ministry of Health / Directorate of HCD"
              className={`w-full px-3 py-2 text-xs rounded-lg border ${
                validationErrors.leadInstitution ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
              } focus:outline-hidden focus:ring-1 focus:ring-emerald-500`}
            />
            {validationErrors.leadInstitution && (
              <p className="text-[11px] text-rose-600 mt-1">{validationErrors.leadInstitution}</p>
            )}
          </div>

          {/* Lead Unit */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Responsible Department / Unit / Working Group <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={leadUnit}
              onChange={(e) => setLeadUnit(e.target.value)}
              placeholder="e.g., M&E Division, Education Pillar Technical Committee"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Description & Purpose */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Activity Description & Strategic Purpose <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a comprehensive summary of the state-level engagement, executive mandate, objectives, and agenda..."
              className={`w-full px-3 py-2 text-xs rounded-lg border ${
                validationErrors.description ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
              } focus:outline-hidden focus:ring-1 focus:ring-emerald-500`}
            />
            {validationErrors.description && (
              <p className="text-[11px] text-rose-600 mt-1">{validationErrors.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* SECTION B: Participating Stakeholders */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2 text-slate-900">
            <Users className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm font-bold uppercase tracking-wider">
              Section B — Participating Stakeholders
            </h3>
          </div>
          <button
            type="button"
            onClick={handleAddStakeholder}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer border border-emerald-200"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Stakeholder</span>
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Record institutions, development partners, CSOs, or private sector organisations participating in this activity. Note: Do not collect personal phone numbers or sensitive personal details.
        </p>

        {stakeholders.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center">
            <p className="text-xs text-slate-500">
              No external or inter-agency stakeholders added yet. Click &quot;Add Stakeholder&quot; to include participating organizations.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {stakeholders.map((sh, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Stakeholder #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveStakeholder(idx)}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Remove Stakeholder"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Organization / Agency Name <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={sh.organization_name}
                      onChange={(e) => handleUpdateStakeholder(idx, 'organization_name', e.target.value)}
                      placeholder="e.g., UNICEF, Akwa Ibom State Primary Healthcare Dev Agency"
                      className="w-full px-2.5 py-1.5 text-xs rounded-md border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Stakeholder Type
                    </label>
                    <select
                      value={sh.stakeholder_type}
                      onChange={(e) => handleUpdateStakeholder(idx, 'stakeholder_type', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-md border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                    >
                      {STAKEHOLDER_TYPES.map((st) => (
                        <option key={st.value} value={st.value}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Role / Contribution
                    </label>
                    <input
                      type="text"
                      value={sh.role}
                      onChange={(e) => handleUpdateStakeholder(idx, 'role', e.target.value)}
                      placeholder="e.g., Technical Advisory, Funding Partner, Co-convener"
                      className="w-full px-2.5 py-1.5 text-xs rounded-md border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Participation Notes <span className="text-slate-400 font-normal">(Optional non-sensitive remarks)</span>
                    </label>
                    <input
                      type="text"
                      value={sh.notes || ''}
                      onChange={(e) => handleUpdateStakeholder(idx, 'notes', e.target.value)}
                      placeholder="e.g., Pledged 3-year maternal healthcare support grant"
                      className="w-full px-2.5 py-1.5 text-xs rounded-md border border-slate-300 bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION C: Outcomes, Decisions & Resolutions */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-2">
          <Award className="w-4 h-4 text-emerald-700" />
          <h3 className="text-sm font-bold uppercase tracking-wider">
            Section C — Outcomes, Decisions & Resolutions
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Key Outcomes Achieved
            </label>
            <textarea
              rows={4}
              value={keyOutcomes}
              onChange={(e) => setKeyOutcomes(e.target.value)}
              placeholder="Outline concrete results delivered: baseline targets affirmed, consensus reached, technical protocols established..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Decisions & Resolutions Adopted
            </label>
            <textarea
              rows={4}
              value={decisionsResolutions}
              onChange={(e) => setDecisionsResolutions(e.target.value)}
              placeholder="Official resolutions passed by the council or working group for MDA follow-up execution..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Institutional Commitments Made <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={3}
              value={commitmentsMade}
              onChange={(e) => setCommitmentsMade(e.target.value)}
              placeholder="Commitments by MDAs or development partners (e.g., funding disbursements, equipment allocations)..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Challenges or Escalations <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={3}
              value={challengesEscalation}
              onChange={(e) => setChallengesEscalation(e.target.value)}
              placeholder="Bottlenecks, policy conflicts, or logistical constraints requiring executive governor escalation..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* SECTION D: Supporting Documentation */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-slate-900 border-b border-slate-100 pb-2">
          <Paperclip className="w-4 h-4 text-emerald-700" />
          <h3 className="text-sm font-bold uppercase tracking-wider">
            Section D — Supporting Evidence & Official Documentation
          </h3>
        </div>

        <p className="text-xs text-slate-500">
          Upload activity reports, minutes, communique, signed attendance registers, or mission photos to the secure vault (<span className="font-mono text-emerald-700">hcd-evidence-vault</span>). Maximum 25MB per file.
        </p>

        {uploadError && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Upload Dropzone */}
        <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 text-center bg-slate-50/50 hover:bg-emerald-50/20 transition-all">
          <input
            type="file"
            id="state-evidence-file-input"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
          />
          <label
            htmlFor="state-evidence-file-input"
            className="cursor-pointer flex flex-col items-center justify-center"
          >
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                <span className="text-xs font-bold text-slate-700">
                  Uploading evidence to state vault...
                </span>
              </div>
            ) : (
              <>
                <UploadCloud className="w-8 h-8 text-slate-400 mb-2 group-hover:text-emerald-600 transition-colors" />
                <span className="text-xs font-bold text-slate-700">
                  Click to select evidence files or drag & drop
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  PDF, DOCX, XLSX, JPEG, PNG (Vault Path: <span className="font-mono">state-level/{activityId}/</span>)
                </span>
              </>
            )}
          </label>
        </div>

        {/* Uploaded Evidence Files List */}
        {evidenceFiles.length > 0 && (
          <div className="space-y-2 mt-3">
            <span className="text-xs font-bold text-slate-700">
              Attached Evidence Files ({evidenceFiles.length}):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {evidenceFiles.map((f, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-white shadow-2xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-medium text-slate-800 truncate" title={f.file_name}>
                      {f.file_name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveEvidence(idx)}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer shrink-0"
                    title="Remove evidence"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION E: Save & Submission Controls */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex items-center gap-2 text-slate-900">
          <Send className="w-4 h-4 text-emerald-700" />
          <h3 className="text-sm font-bold uppercase tracking-wider">
            Section E — Save and Submission Controls
          </h3>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Submission Notes / Remarks for Reviewer <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            type="text"
            value={submissionNotes}
            onChange={(e) => setSubmissionNotes(e.target.value)}
            placeholder="Add context for the state executive reviewer (e.g., 'Includes full attendance register and communique in attached PDF')..."
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="w-full sm:w-auto px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {/* Save as Draft */}
            <button
              type="button"
              onClick={() => handleSave('draft')}
              disabled={isSaving || isUploading}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5 text-slate-600" />
              <span>{isEditing ? 'Update Draft' : 'Save Draft'}</span>
            </button>

            {/* Submit for Review or Publication / Resubmit Rejected Draft */}
            <button
              type="button"
              onClick={() => handleSave('pending_approval')}
              disabled={isSaving || isUploading}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50 transition-colors"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving to State Cloud...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {initialActivity?.status === 'rejected_draft'
                      ? 'Resubmit Rejected Draft'
                      : 'Submit for Review'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
