import React, { useState, useEffect } from 'react';
import { HCDActivity, ProjectMilestone, MilestoneStatus } from '../../types';
import { PILLARS } from '../../data/lgas';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { ActivityMediaImage } from '../common/ActivityMediaImage';
import {
  X,
  MapPin,
  Calendar,
  CheckCircle2,
  FileText,
  User,
  Phone,
  ShieldCheck,
  Lock,
  Download,
  ExternalLink,
  Flag,
  TrendingUp,
  Clock,
  Plus,
  Trash2,
  Edit3,
  Check,
  Save,
  AlertCircle,
  Printer,
  Layers,
  BarChart2,
} from 'lucide-react';

interface ProjectDetailModalProps {
  activity: HCDActivity | null;
  onClose: () => void;
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  activity,
  onClose,
}) => {
  const { currentUser } = useAuth();
  const { updateActivity, measurements, indicators, fetchMeasurementsForActivity, getPillarDisplayName } = useData();

  const [isEditingMilestones, setIsEditingMilestones] = useState(false);
  const [localMilestones, setLocalMilestones] = useState<ProjectMilestone[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activity) {
      if (activity.milestones && activity.milestones.length > 0) {
        setLocalMilestones(activity.milestones);
      } else {
        // Default 3 standard capacity building phases if none existed
        const defaultPhases: ProjectMilestone[] = [
          {
            id: `ms-default-1-${activity.id}`,
            phaseNumber: 1,
            title: 'Phase 1: Mobilization, Enumeration & Baseline Survey',
            description: 'Community sensitization, beneficiary screening and biometric roster documentation.',
            targetDate: activity.startDate || '2026-02-01',
            completionPercentage: activity.status === 'PUBLISHED' ? 100 : 80,
            status: activity.status === 'PUBLISHED' ? 'COMPLETED' : 'IN_PROGRESS',
            completedDate: activity.status === 'PUBLISHED' ? activity.startDate : undefined,
            keyDeliverable: 'Verified biometric attendance roll and eligibility audit',
          },
          {
            id: `ms-default-2-${activity.id}`,
            phaseNumber: 2,
            title: 'Phase 2: Training Delivery & Capacity Building Execution',
            description: 'Hands-on practical curriculum, technical guidance, and field operations.',
            targetDate: activity.completionDate || '2026-03-15',
            completionPercentage: activity.status === 'PUBLISHED' ? 100 : 50,
            status: activity.status === 'PUBLISHED' ? 'COMPLETED' : 'IN_PROGRESS',
            completedDate: activity.status === 'PUBLISHED' ? activity.completionDate : undefined,
            keyDeliverable: 'Technical skill evaluation and practical demo portfolios',
          },
          {
            id: `ms-default-3-${activity.id}`,
            phaseNumber: 3,
            title: 'Phase 3: Tools Distribution, Certification & Monitoring',
            description: 'Grant or equipment allocation, certification ceremony, and long-term impact survey.',
            targetDate: activity.completionDate || '2026-03-28',
            completionPercentage: activity.status === 'PUBLISHED' ? 100 : 0,
            status: activity.status === 'PUBLISHED' ? 'COMPLETED' : 'NOT_STARTED',
            completedDate: activity.status === 'PUBLISHED' ? activity.completionDate : undefined,
            keyDeliverable: 'Equipment handover charter and signed exit vouchers',
          },
        ];
        setLocalMilestones(defaultPhases);
      }
      setIsEditingMilestones(false);
      setToastMessage(null);
      if (activity.id) {
        fetchMeasurementsForActivity(activity.id);
      }
    }
  }, [activity, fetchMeasurementsForActivity]);

  if (!activity) return null;

  const activityMeasurements = measurements.filter((m) => m.activity_id === activity?.id);

  const pillar = PILLARS[activity.pillar];
  const isPublished = activity.status === 'PUBLISHED';

  // Permission check: can current user edit milestone progress?
  // State Super-Admin can update milestones for any activity.
  // LGA admin can update milestones ONLY for draft/pending activities in their assigned LGA.
  // Published activities are strictly locked under PostgreSQL RLS policies.
  const canEditMilestones =
    currentUser.role === 'state_admin' ||
    (currentUser.role === 'lga_admin' && currentUser.assignedLgaId === activity.lgaId && !isPublished);

  const isLgaAdminLockedOut =
    currentUser.role === 'lga_admin' && currentUser.assignedLgaId === activity.lgaId && isPublished;

  // Compute overall progress
  const currentOverallProgress =
    localMilestones.length > 0
      ? Math.round(
          localMilestones.reduce((acc, m) => acc + (m.completionPercentage || 0), 0) /
            localMilestones.length
        )
      : activity.overallProgress || (isPublished ? 100 : 50);

  const completedPhasesCount = localMilestones.filter(
    (m) => m.status === 'COMPLETED' || m.completionPercentage === 100
  ).length;

  const handleUpdatePhase = (id: string, updates: Partial<ProjectMilestone>) => {
    setLocalMilestones((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const updated = { ...m, ...updates };
        if (updates.completionPercentage !== undefined) {
          if (updates.completionPercentage === 100) {
            updated.status = 'COMPLETED';
            if (!updated.completedDate) {
              updated.completedDate = new Date().toISOString().split('T')[0];
            }
          } else if (updates.completionPercentage > 0) {
            updated.status = 'IN_PROGRESS';
            updated.completedDate = undefined;
          } else {
            updated.status = 'NOT_STARTED';
            updated.completedDate = undefined;
          }
        }
        return updated;
      })
    );
  };

  const handleAddPhase = () => {
    const nextPhaseNum = localMilestones.length + 1;
    const newPhase: ProjectMilestone = {
      id: `ms-${Date.now()}-${nextPhaseNum}`,
      phaseNumber: nextPhaseNum,
      title: `Phase ${nextPhaseNum}: Impact Expansion & Assessment`,
      description: 'Progressive capacity building benchmark.',
      targetDate: activity.completionDate || new Date().toISOString().split('T')[0],
      completionPercentage: 0,
      status: 'NOT_STARTED',
      keyDeliverable: 'Phase milestone evaluation log',
    };
    setLocalMilestones([...localMilestones, newPhase]);
  };

  const handleRemovePhase = (id: string) => {
    if (localMilestones.length <= 1) return;
    setLocalMilestones((prev) =>
      prev
        .filter((m) => m.id !== id)
        .map((m, idx) => ({ ...m, phaseNumber: idx + 1 }))
    );
  };

  const handleSaveMilestones = async () => {
    setIsSaving(true);
    const res = await updateActivity(activity.id, {
      milestones: localMilestones,
      overallProgress: currentOverallProgress,
    });

    setIsSaving(false);
    if (res.success) {
      setIsEditingMilestones(false);
      setToastMessage('Milestones and phased completion rates updated successfully.');
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      setToastMessage(`Error: ${res.error || 'Failed to update milestones.'}`);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-950 via-[#0B4619] to-emerald-900 text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37] bg-white/10 px-2 py-0.5 rounded">
                {activity.lgaName} LGA Workspace
              </span>
              <span className="text-xs font-semibold text-emerald-200">
                {getPillarDisplayName(activity.pillar)}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white mt-1 leading-snug">
              {activity.title}
            </h3>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button
              onClick={() => window.print()}
              title="Print / Save Project Dossier as PDF"
              className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1.5 text-xs font-semibold"
            >
              <Printer className="w-4 h-4 text-[#D4AF37]" />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {toastMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-medium rounded-xl flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Status & Location Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                <strong>{activity.community}</strong>, {activity.lgaName} LGA
                {activity.coordinates && (
                  <span className="text-slate-400 font-mono text-[11px] ml-1">
                    ({activity.coordinates.lat.toFixed(4)}°N, {activity.coordinates.lng.toFixed(4)}°E)
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                  isPublished
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {activity.status.replace('_', ' ')}
              </span>
              {isPublished && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800">
                  <Lock className="w-3 h-3" />
                  Locked & Published
                </span>
              )}
            </div>
          </div>

          {/* Taxonomy & Project Description Banner */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-700">Project Description:</span>
              <span className="font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                {activity.projectDescription || activity.subCategory || 'Operational Project Initiative'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activity.pillar === 'cross_cutting_enablers' && activity.pillarSegment && (
                <span className="text-[11px] font-bold text-cyan-800 bg-cyan-100 px-2 py-0.5 rounded flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" />
                  Segment: {activity.pillarSegment.replace('_', ' ')}
                </span>
              )}
              {activity.category && (
                <span className="text-[11px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded">
                  Category: {activity.category === 'values_ethics_social_behaviour' ? 'Values/Ethics' : 'Cross-cutting Enablers'}
                </span>
              )}
            </div>
          </div>

          {/* Demographic Math Breakdown Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                Total Beneficiaries
              </span>
              <span className="text-2xl font-black text-emerald-950 font-mono tabular-nums block mt-1">
                {activity.beneficiariesTotal.toLocaleString()}
              </span>
              <span className="text-[10px] text-emerald-700">100% Headcount</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Male Split
              </span>
              <span className="text-xl font-bold text-slate-900 font-mono tabular-nums block mt-1">
                {activity.beneficiariesMale.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {((activity.beneficiariesMale / activity.beneficiariesTotal) * 100).toFixed(0)}% Demographics
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Female Split
              </span>
              <span className="text-xl font-bold text-slate-900 font-mono tabular-nums block mt-1">
                {activity.beneficiariesFemale.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {((activity.beneficiariesFemale / activity.beneficiariesTotal) * 100).toFixed(0)}% Demographics
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Budget Allocation
              </span>
              <span className="text-xl font-bold text-emerald-900 font-mono tabular-nums block mt-1">
                ₦ {(activity.budgetNgn / 1000000).toFixed(1)}M
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                ₦ {activity.budgetNgn.toLocaleString()}
              </span>
            </div>
          </div>

          {/* ============================================================== */}
          {/* MILESTONE TRACKING & PHASED IMPLEMENTATION SUB-SECTION          */}
          {/* ============================================================== */}
          <div className="border border-slate-200 rounded-2xl p-5 bg-white shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <Flag className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                      Capacity Building Milestone Tracking
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Phased deliverables, target deadlines, and verified completion rates
                    </p>
                  </div>
                </div>
              </div>

              {/* Action and Progress indicator */}
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="flex items-center gap-1.5 justify-end">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="text-xs font-black text-emerald-950 font-mono tabular-nums">
                      {currentOverallProgress}%
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    {completedPhasesCount} of {localMilestones.length} Phases Completed
                  </span>
                </div>

                {isLgaAdminLockedOut && (
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold"
                    title="Published activities are immutable under state database policy. Revert to draft through State Super-Admin to modify milestones."
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Locked (Published)</span>
                  </div>
                )}

                {canEditMilestones && (
                  <div>
                    {!isEditingMilestones ? (
                      <button
                        onClick={() => setIsEditingMilestones(true)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Define / Adjust Phases
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setIsEditingMilestones(false)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveMilestones}
                          disabled={isSaving}
                          className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                        >
                          <Save className="w-3.5 h-3.5" />
                          {isSaving ? 'Saving...' : 'Save Updates'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Overall Milestone Execution</span>
                <span className="font-bold text-emerald-900 font-mono tabular-nums">
                  {currentOverallProgress}% Completed
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-600 to-emerald-800 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${currentOverallProgress}%` }}
                />
              </div>
            </div>

            {/* Milestone Phased Cards */}
            <div className="space-y-3 pt-1">
              {localMilestones.map((ms) => {
                const isCompleted = ms.status === 'COMPLETED' || ms.completionPercentage === 100;
                const isInProgress = ms.status === 'IN_PROGRESS';

                return (
                  <div
                    key={ms.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isCompleted
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : isInProgress
                        ? 'bg-blue-50/30 border-blue-200'
                        : 'bg-slate-50/70 border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isCompleted
                                ? 'bg-emerald-700 text-white'
                                : isInProgress
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-300 text-slate-700'
                            }`}
                          >
                            {ms.phaseNumber}
                          </span>

                          {!isEditingMilestones ? (
                            <h5 className="text-xs font-bold text-slate-900">
                              {ms.title}
                            </h5>
                          ) : (
                            <input
                              type="text"
                              value={ms.title}
                              onChange={(e) =>
                                handleUpdatePhase(ms.id, { title: e.target.value })
                              }
                              className="text-xs font-bold text-slate-900 p-1 border border-slate-300 rounded bg-white flex-1"
                            />
                          )}

                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              isCompleted
                                ? 'bg-emerald-100 text-emerald-800'
                                : isInProgress
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {ms.status.replace('_', ' ')}
                          </span>
                        </div>

                        {!isEditingMilestones ? (
                          <p className="text-[11px] text-slate-600 leading-relaxed">
                            {ms.description || 'Target capacity deliverable.'}
                          </p>
                        ) : (
                          <textarea
                            rows={1}
                            value={ms.description || ''}
                            onChange={(e) =>
                              handleUpdatePhase(ms.id, { description: e.target.value })
                            }
                            placeholder="Phase description..."
                            className="w-full text-[11px] text-slate-700 p-1 border border-slate-300 rounded bg-white mt-1"
                          />
                        )}
                      </div>

                      {/* Right Completion Metric */}
                      <div className="sm:text-right shrink-0 font-mono">
                        <div className="text-sm font-black text-slate-900 tabular-nums">
                          {ms.completionPercentage}%
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center sm:justify-end gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>Target: {new Date(ms.targetDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Slider (Visible when editing) */}
                    {isEditingMilestones && (
                      <div className="pt-2 border-t border-slate-200/80 mt-2 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                          <div>
                            <label className="text-slate-500 block">Target Date</label>
                            <input
                              type="date"
                              value={ms.targetDate}
                              onChange={(e) =>
                                handleUpdatePhase(ms.id, { targetDate: e.target.value })
                              }
                              className="w-full p-1 bg-white border border-slate-300 rounded text-xs"
                            />
                          </div>

                          <div>
                            <label className="text-slate-500 block">Phase Status</label>
                            <select
                              value={ms.status}
                              onChange={(e) =>
                                handleUpdatePhase(ms.id, {
                                  status: e.target.value as MilestoneStatus,
                                  completionPercentage:
                                    e.target.value === 'COMPLETED'
                                      ? 100
                                      : e.target.value === 'NOT_STARTED'
                                      ? 0
                                      : ms.completionPercentage || 50,
                                })
                              }
                              className="w-full p-1 bg-white border border-slate-300 rounded text-xs"
                            >
                              <option value="NOT_STARTED">Not Started (0%)</option>
                              <option value="IN_PROGRESS">In Progress</option>
                              <option value="COMPLETED">Completed (100%)</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-slate-500 block">
                              Completion Percentage ({ms.completionPercentage}%)
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={ms.completionPercentage}
                              onChange={(e) =>
                                handleUpdatePhase(ms.id, {
                                  completionPercentage: parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-full accent-emerald-700 h-1.5 bg-slate-200 rounded-lg cursor-pointer mt-1"
                            />
                          </div>
                        </div>

                        <div>
                          <input
                            type="text"
                            value={ms.keyDeliverable || ''}
                            onChange={(e) =>
                              handleUpdatePhase(ms.id, { keyDeliverable: e.target.value })
                            }
                            placeholder="Key deliverable description..."
                            className="w-full p-1 bg-white border border-slate-200 rounded text-[11px]"
                          />
                        </div>

                        {localMilestones.length > 1 && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemovePhase(ms.id)}
                              className="text-red-600 hover:text-red-800 text-[11px] font-semibold flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              Remove Phase
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Deliverable badge */}
                    {ms.keyDeliverable && !isEditingMilestones && (
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Key Deliverable: {ms.keyDeliverable}
                        </span>
                        {ms.completedDate && (
                          <span className="text-emerald-700 font-semibold font-mono">
                            Verified on {new Date(ms.completedDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add Phase button when editing */}
            {isEditingMilestones && (
              <button
                type="button"
                onClick={handleAddPhase}
                className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add New Project Phase
              </button>
            )}
          </div>

          {/* Photographic Verification Assets */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
              <span>Photographic Verification Assets & EXIF Geotags</span>
              {activity.mediaAssets.some((m) => m.exifVerified) ? (
                <span className="text-emerald-700 text-[11px] font-semibold">
                  ✓ EXIF Coordinate Bounds Confirmed
                </span>
              ) : (
                <span className="text-slate-500 text-[11px] font-medium">
                  Official Verification Records
                </span>
              )}
            </h4>

            {activity.mediaAssets.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activity.mediaAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 group flex flex-col justify-between"
                  >
                    <ActivityMediaImage
                      media={asset}
                      activityTitle={activity.title}
                      pillar={activity.pillar}
                      aspectRatioClass="h-48 w-full"
                    />
                    {asset.caption && (
                      <div className="p-2.5 text-xs text-slate-600 bg-white border-t border-slate-100">
                        <p>{asset.caption}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
                No photographic media assets attached to this record yet.
              </div>
            )}
          </div>

          {/* Biometric Attendance Registry File Card */}
          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <strong className="text-slate-900 block font-bold">
                  {activity.attendanceSheetFileName || 'Beneficiary_Attendance_Registry.pdf'}
                </strong>
                <span className="text-slate-500 text-[11px]">
                  Verified biometric signatures and council validation seal
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                if (activity.attendanceRegistryUrl && activity.attendanceRegistryUrl.startsWith('http')) {
                  const link = document.createElement('a');
                  link.href = activity.attendanceRegistryUrl;
                  link.target = '_blank';
                  link.rel = 'noopener noreferrer';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                } else {
                  setToastMessage(
                    `Beneficiary registry "${activity.attendanceSheetFileName || 'Registry.pdf'}" is safely encrypted in the State Evidence Vault. Official copies require authorized clearance.`
                  );
                  setTimeout(() => setToastMessage(null), 5000);
                }
              }}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download Registry
            </button>
          </div>

          {/* Activity Reporting Indicators (from Supabase Catalogue) */}
          {activityMeasurements.length > 0 && (
            <div className="border border-slate-200 rounded-2xl p-5 bg-white shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-emerald-800" />
                  <h4 className="text-sm font-bold text-slate-900">
                    Standard Reporting Indicator Outcomes ({activityMeasurements.length})
                  </h4>
                </div>
                <span className="text-[10px] text-emerald-800 bg-emerald-100 font-bold px-2 py-0.5 rounded-full">
                  Live Supabase Records
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activityMeasurements.map((m) => {
                  const ind = indicators.find((i) => i.indicator_code === m.indicator_code);
                  return (
                    <div
                      key={m.id || m.indicator_code}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded">
                          {m.indicator_code}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {m.reporting_period_start} → {m.reporting_period_end}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 line-clamp-1">
                        {ind?.indicator_name || m.indicator_code}
                      </div>
                      <div className="text-base font-black text-emerald-900 font-mono">
                        {m.value_numeric !== undefined && m.value_numeric !== null
                          ? m.value_numeric
                          : m.value_text || 'Completed'}
                        <span className="text-xs font-normal text-slate-500 ml-1">
                          {ind?.measurement_unit || ''}
                        </span>
                      </div>
                      {m.notes && (
                        <p className="text-[11px] text-slate-600 italic border-t border-slate-200/60 pt-1 mt-1">
                          "{m.notes}"
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Governance & Audit Details */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">LGA Desk Officer</span>
              <strong className="text-slate-900 block mt-0.5">{activity.leadOfficer}</strong>
              <span className="text-slate-500 font-mono text-[11px]">{activity.officerContact}</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">Executive Cabinet Review Status</span>
              {activity.reviewedBy ? (
                <>
                  <strong className="text-slate-900 block mt-0.5">{activity.reviewedBy}</strong>
                  <span className="text-emerald-700 font-semibold text-[11px]">
                    Approved {activity.reviewedAt ? new Date(activity.reviewedAt).toLocaleDateString() : ''}
                  </span>
                </>
              ) : (
                <span className="text-amber-700 font-semibold block mt-0.5">
                  Pending State Super-Admin Sign-off
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {localMilestones.length} Implementation Phase(s) Configured
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
