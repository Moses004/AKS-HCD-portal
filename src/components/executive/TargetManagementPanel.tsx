import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { ALL_31_LGAS } from '../../data/lgas';
import {
  HCDIndicatorTarget,
  TargetDirection,
  TargetMetricType,
  TargetStatus,
  HCDReportingIndicator,
} from '../../types';
import { supabaseService } from '../../services/supabaseService';
import {
  Target,
  Plus,
  CheckCircle2,
  Clock,
  Archive,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  Info,
  Calendar,
  Building2,
  FileText,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  X,
  Edit2,
  Trash2,
  ExternalLink,
  BookOpen,
} from 'lucide-react';

interface TargetManagementPanelProps {
  onTargetUpdated?: () => void;
}

export const TargetManagementPanel: React.FC<TargetManagementPanelProps> = ({
  onTargetUpdated,
}) => {
  const { currentUser } = useAuth();
  const { indicators, pillars, getPillarDisplayName } = useData();

  const isStateAdmin =
    currentUser.isAuthenticated && currentUser.isPrivileged && currentUser.role === 'state_admin';
  const isLgaAdmin =
    currentUser.isAuthenticated && currentUser.isPrivileged && currentUser.role === 'lga_admin';

  // Target records state
  const [targets, setTargets] = useState<HCDIndicatorTarget[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Filter states
  const [selectedLgaFilter, setSelectedLgaFilter] = useState<string>(() => {
    if (isLgaAdmin && currentUser.assignedLgaId) return currentUser.assignedLgaId;
    return 'all';
  });
  const [selectedYearFilter, setSelectedYearFilter] = useState<number>(new Date().getFullYear());
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingTarget, setEditingTarget] = useState<HCDIndicatorTarget | null>(null);
  const [viewingTarget, setViewingTarget] = useState<HCDIndicatorTarget | null>(null);
  const [inspectingIndicator, setInspectingIndicator] = useState<HCDReportingIndicator | null>(null);

  // Form states for Create / Edit
  const [formLgaId, setFormLgaId] = useState<string>('uyo');
  const [formIndicatorCode, setFormIndicatorCode] = useState<string>('');
  const [formReportingYear, setFormReportingYear] = useState<number>(new Date().getFullYear());
  const [formPeriodStart, setFormPeriodStart] = useState<string>(`${new Date().getFullYear()}-01-01`);
  const [formPeriodEnd, setFormPeriodEnd] = useState<string>(`${new Date().getFullYear()}-12-31`);
  const [formBaselineYear, setFormBaselineYear] = useState<string>('');
  const [formBaselineValue, setFormBaselineValue] = useState<string>('');
  const [formTargetValue, setFormTargetValue] = useState<string>('');
  const [formTargetDirection, setFormTargetDirection] = useState<TargetDirection>('higher_is_better');
  const [formTargetMetricType, setFormTargetMetricType] = useState<TargetMetricType>('percentage');
  const [formMeasurementUnit, setFormMeasurementUnit] = useState<string>('percent');
  const [formSourceReference, setFormSourceReference] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [duplicateTargetWarning, setDuplicateTargetWarning] = useState<HCDIndicatorTarget | null>(null);

  // Fetch targets from database
  const loadTargets = async () => {
    setIsLoading(true);
    setErrorNotice(null);
    try {
      const res = await supabaseService.fetchTargets({
        lgaId: selectedLgaFilter !== 'all' ? selectedLgaFilter : undefined,
        reportingYear: selectedYearFilter || undefined,
        status: selectedStatusFilter !== 'all' ? (selectedStatusFilter as TargetStatus) : undefined,
        userSession: currentUser,
      });

      if (!res.success) {
        setErrorNotice(res.error || 'Failed to load targets from Supabase');
        setTargets([]);
      } else {
        setTargets(res.data);
      }
    } catch (err: any) {
      setErrorNotice(err.message || 'Error communicating with Supabase');
      setTargets([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTargets();
  }, [selectedLgaFilter, selectedYearFilter, selectedStatusFilter]);

  // Set default indicator code on modal open if available
  useEffect(() => {
    if (indicators.length > 0 && !formIndicatorCode) {
      setFormIndicatorCode(indicators[0].indicator_code);
    }
  }, [indicators, formIndicatorCode]);

  // Sync indicator metadata when indicator selected in form
  const selectedFormIndicator = useMemo(() => {
    return indicators.find((ind) => ind.indicator_code === formIndicatorCode);
  }, [indicators, formIndicatorCode]);

  useEffect(() => {
    if (selectedFormIndicator && !editingTarget) {
      // Suggest measurement unit from catalogue
      setFormMeasurementUnit(selectedFormIndicator.measurement_unit || 'percent');
      if (selectedFormIndicator.measurement_unit.toLowerCase().includes('percent')) {
        setFormTargetMetricType('percentage');
      } else if (selectedFormIndicator.measurement_unit.toLowerCase().includes('ngn') || selectedFormIndicator.measurement_unit.toLowerCase().includes('naira')) {
        setFormTargetMetricType('currency');
      } else if (selectedFormIndicator.measurement_unit.toLowerCase().includes('rate')) {
        setFormTargetMetricType('rate');
      } else {
        setFormTargetMetricType('count');
      }
    }
  }, [selectedFormIndicator, editingTarget]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = targets.length;
    const approved = targets.filter((t) => t.target_status === 'approved').length;
    const draft = targets.filter((t) => t.target_status === 'draft').length;
    const retired = targets.filter((t) => t.target_status === 'retired').length;
    return { total, approved, draft, retired };
  }, [targets]);

  // Filtered target list
  const filteredTargets = useMemo(() => {
    return targets.filter((t) => {
      if (selectedLgaFilter !== 'all' && t.lga_id !== selectedLgaFilter) return false;
      if (selectedYearFilter && t.reporting_year !== Number(selectedYearFilter)) return false;
      if (selectedStatusFilter !== 'all' && t.target_status !== selectedStatusFilter) return false;

      // Indicator lookup for category filter
      const ind = indicators.find((i) => i.indicator_code === t.indicator_code);
      if (selectedCategoryFilter !== 'all') {
        if (!ind || ind.reporting_category.toLowerCase() !== selectedCategoryFilter.toLowerCase()) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const lgaName = t.lga_name?.toLowerCase() || '';
        const code = t.indicator_code.toLowerCase();
        const indName = ind?.indicator_name.toLowerCase() || '';
        const notes = t.target_notes?.toLowerCase() || '';
        if (!lgaName.includes(q) && !code.includes(q) && !indName.includes(q) && !notes.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [targets, selectedLgaFilter, selectedYearFilter, selectedStatusFilter, selectedCategoryFilter, searchQuery, indicators]);

  // Reset form
  const resetForm = () => {
    setFormLgaId(isLgaAdmin && currentUser.assignedLgaId ? currentUser.assignedLgaId : 'uyo');
    setFormIndicatorCode(indicators[0]?.indicator_code || 'EDU-01');
    const year = new Date().getFullYear();
    setFormReportingYear(year);
    setFormPeriodStart(`${year}-01-01`);
    setFormPeriodEnd(`${year}-12-31`);
    setFormBaselineYear('');
    setFormBaselineValue('');
    setFormTargetValue('');
    setFormTargetDirection('higher_is_better');
    setFormTargetMetricType('percentage');
    setFormMeasurementUnit(indicators[0]?.measurement_unit || 'percent');
    setFormSourceReference('');
    setFormNotes('');
    setFormError(null);
    setDuplicateTargetWarning(null);
    setEditingTarget(null);
  };

  // Open Edit Modal prefilled
  const openEditModal = (target: HCDIndicatorTarget) => {
    setEditingTarget(target);
    setFormLgaId(target.lga_id);
    setFormIndicatorCode(target.indicator_code);
    setFormReportingYear(target.reporting_year);
    setFormPeriodStart(target.period_start);
    setFormPeriodEnd(target.period_end);
    setFormBaselineYear(target.baseline_year ? String(target.baseline_year) : '');
    setFormBaselineValue(target.baseline_value !== null && target.baseline_value !== undefined ? String(target.baseline_value) : '');
    setFormTargetValue(String(target.target_value));
    setFormTargetDirection(target.target_direction);
    setFormTargetMetricType(target.target_metric_type);
    setFormMeasurementUnit(target.measurement_unit);
    setFormSourceReference(target.source_reference || '');
    setFormNotes(target.target_notes || '');
    setFormError(null);
    setDuplicateTargetWarning(null);
    setIsCreateModalOpen(true);
  };

  // Form submission handler
  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setDuplicateTargetWarning(null);

    if (!isStateAdmin) {
      setFormError('Target management is strictly restricted to authorized State Executive Administrators.');
      return;
    }

    if (!formLgaId) {
      setFormError('Please select a Local Government Area.');
      return;
    }
    if (!formIndicatorCode) {
      setFormError('Please select an active catalogue indicator.');
      return;
    }
    if (!formReportingYear || formReportingYear < 2020 || formReportingYear > 2040) {
      setFormError('Please provide a valid 4-digit reporting year (e.g. 2026).');
      return;
    }
    if (!formPeriodStart || !formPeriodEnd) {
      setFormError('Reporting period start and end dates are required.');
      return;
    }
    if (new Date(formPeriodStart) > new Date(formPeriodEnd)) {
      setFormError('Reporting period start date cannot be after the end date.');
      return;
    }

    // Verify reporting period matches reporting year
    const startYear = new Date(formPeriodStart).getFullYear();
    const endYear = new Date(formPeriodEnd).getFullYear();
    if (startYear !== Number(formReportingYear) && endYear !== Number(formReportingYear)) {
      setFormError(`Reporting period dates must correspond to reporting year ${formReportingYear}.`);
      return;
    }

    const targetVal = parseFloat(formTargetValue);
    if (isNaN(targetVal) || targetVal < 0) {
      setFormError('Target value must be a valid non-negative number.');
      return;
    }

    let baselineVal: number | null = null;
    if (formBaselineValue.trim() !== '') {
      baselineVal = parseFloat(formBaselineValue);
      if (isNaN(baselineVal) || baselineVal < 0) {
        setFormError('Baseline value must be a valid non-negative number.');
        return;
      }
    }

    let baselineYearNum: number | null = null;
    if (formBaselineYear.trim() !== '') {
      baselineYearNum = parseInt(formBaselineYear, 10);
      if (isNaN(baselineYearNum) || baselineYearNum < 2000 || baselineYearNum > formReportingYear) {
        setFormError(`Baseline year must be a valid year up to ${formReportingYear}.`);
        return;
      }
    }

    if (!formMeasurementUnit.trim()) {
      setFormError('Measurement unit is required.');
      return;
    }

    const lgaInfo = ALL_31_LGAS.find((l) => l.id === formLgaId);
    const lgaName = lgaInfo?.name || formLgaId;

    setIsSubmitting(true);

    try {
      if (editingTarget?.id) {
        // Update existing target
        const res = await supabaseService.updateTarget(
          editingTarget.id,
          {
            lga_id: formLgaId,
            lga_name: lgaName,
            indicator_code: formIndicatorCode,
            reporting_year: Number(formReportingYear),
            period_start: formPeriodStart,
            period_end: formPeriodEnd,
            baseline_year: baselineYearNum,
            baseline_value: baselineVal,
            target_value: targetVal,
            target_direction: formTargetDirection,
            target_metric_type: formTargetMetricType,
            measurement_unit: formMeasurementUnit.trim(),
            source_reference: formSourceReference.trim() || null,
            target_notes: formNotes.trim() || null,
          },
          currentUser
        );

        if (!res.success) {
          setFormError(res.error || 'Failed to update target');
        } else {
          setSuccessNotice(`Target for ${lgaName} (${formIndicatorCode}) updated successfully.`);
          setIsCreateModalOpen(false);
          resetForm();
          loadTargets();
          onTargetUpdated?.();
        }
      } else {
        // Insert new draft target
        const res = await supabaseService.insertTarget(
          {
            lga_id: formLgaId,
            lga_name: lgaName,
            indicator_code: formIndicatorCode,
            reporting_year: Number(formReportingYear),
            period_start: formPeriodStart,
            period_end: formPeriodEnd,
            baseline_year: baselineYearNum,
            baseline_value: baselineVal,
            target_value: targetVal,
            target_direction: formTargetDirection,
            target_metric_type: formTargetMetricType,
            measurement_unit: formMeasurementUnit.trim(),
            source_reference: formSourceReference.trim() || null,
            target_notes: formNotes.trim() || null,
          },
          currentUser
        );

        if (!res.success) {
          if (res.code === '23505' && res.data) {
            setDuplicateTargetWarning(res.data);
            setFormError(res.error || 'A target already exists for this LGA and indicator.');
          } else {
            setFormError(res.error || 'Failed to create target');
          }
        } else {
          setSuccessNotice(`New draft target for ${lgaName} (${formIndicatorCode}) saved successfully.`);
          setIsCreateModalOpen(false);
          resetForm();
          loadTargets();
          onTargetUpdated?.();
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Target approval handler
  const handleApproveTarget = async (id: string, targetName: string) => {
    if (!isStateAdmin) return;

    try {
      const res = await supabaseService.approveTarget(id, currentUser);
      if (!res.success) {
        setErrorNotice(res.error || 'Failed to approve target');
      } else {
        setSuccessNotice(`Target ${targetName} approved successfully and published to official performance reports.`);
        loadTargets();
        onTargetUpdated?.();
      }
    } catch (err: any) {
      setErrorNotice(err.message || 'Error approving target');
    }
  };

  // Target retirement handler
  const handleRetireTarget = async (id: string, targetName: string) => {
    if (!isStateAdmin) return;

    try {
      const res = await supabaseService.retireTarget(id, currentUser);
      if (!res.success) {
        setErrorNotice(res.error || 'Failed to retire target');
      } else {
        setSuccessNotice(`Target ${targetName} retired successfully.`);
        loadTargets();
        onTargetUpdated?.();
      }
    } catch (err: any) {
      setErrorNotice(err.message || 'Error retiring target');
    }
  };

  // Target deletion handler (Drafts only)
  const handleDeleteDraft = async (id: string, targetName: string) => {
    if (!isStateAdmin) return;

    try {
      const res = await supabaseService.deleteTarget(id, currentUser);
      if (!res.success) {
        setErrorNotice(res.error || 'Failed to delete draft target');
      } else {
        setSuccessNotice(`Draft target ${targetName} deleted.`);
        loadTargets();
        onTargetUpdated?.();
      }
    } catch (err: any) {
      setErrorNotice(err.message || 'Error deleting draft target');
    }
  };

  return (
    <div className="space-y-subsection">
      {/* Top Banner & Header */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-card-pad sm:p-card-pad-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-900 text-white flex items-center justify-center shrink-0 shadow-md">
              <Target className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Annual LGA Target Management & Approval
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Live Supabase Layer
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                Establish approved indicator baselines, annual targets, and performance directions across all 31 Local Government Areas. Governed by multi-role RLS and security-invoker calculations.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={loadTargets}
              disabled={isLoading}
              className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-700' : ''}`} />
              <span>Refresh</span>
            </button>

            {isStateAdmin && (
              <button
                onClick={() => {
                  resetForm();
                  setIsCreateModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#D4AF37]" />
                <span>Define Annual Target</span>
              </button>
            )}
          </div>
        </div>

        {/* Notices */}
        {errorNotice && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorNotice}</span>
            </div>
            <button
              onClick={() => setErrorNotice(null)}
              className="text-rose-500 hover:text-rose-700 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successNotice && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successNotice}</span>
            </div>
            <button
              onClick={() => setSuccessNotice(null)}
              className="text-emerald-500 hover:text-emerald-700 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-100">
          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Targets
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-0.5 block">
              {metrics.total}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Across all LGAs & indicators</span>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
              Approved & Active
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-900 font-mono mt-0.5 block">
              {metrics.approved}
            </span>
            <span className="text-[10px] text-emerald-700 mt-0.5 block">Used for performance tracking</span>
          </div>

          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
              Drafts Awaiting Approval
            </span>
            <span className="text-xl sm:text-2xl font-black text-amber-900 font-mono mt-0.5 block">
              {metrics.draft}
            </span>
            <span className="text-[10px] text-amber-700 mt-0.5 block">Pending executive review</span>
          </div>

          <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Retired Targets
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-600 font-mono mt-0.5 block">
              {metrics.retired}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Archived reporting periods</span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* LGA Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>Local Government Area</span>
            </label>
            <select
              value={selectedLgaFilter}
              onChange={(e) => setSelectedLgaFilter(e.target.value)}
              disabled={isLgaAdmin}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            >
              {!isLgaAdmin && <option value="all">All 31 Local Government Areas</option>}
              {ALL_31_LGAS.map((lga) => (
                <option key={lga.id} value={lga.id}>
                  {lga.name} ({lga.senatorialDistrict.split(' ')[0]})
                </option>
              ))}
            </select>
          </div>

          {/* Reporting Year */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-700" />
              <span>Reporting Year</span>
            </label>
            <select
              value={selectedYearFilter}
              onChange={(e) => setSelectedYearFilter(Number(e.target.value))}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            >
              {[2026, 2025, 2024, 2023].map((y) => (
                <option key={y} value={y}>
                  Fiscal Year {y}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-emerald-700" />
              <span>Target Status</span>
            </label>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            >
              <option value="all">All Statuses ({metrics.total})</option>
              <option value="approved">Approved & Active ({metrics.approved})</option>
              <option value="draft">Drafts ({metrics.draft})</option>
              <option value="retired">Retired ({metrics.retired})</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
              <span>Reporting Category</span>
            </label>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="Education">Education</option>
              <option value="Health">Health</option>
              <option value="Skill and labour">Skill and labour</option>
              <option value="Cross-cutting Enablers">Cross-cutting Enablers</option>
              <option value="Values/Ethics/Social behaviour">Values/Ethics/Social behaviour</option>
              <option value="HCD Settings">HCD Settings</option>
            </select>
          </div>

          {/* Search Query */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-emerald-700" />
              <span>Search Target or Code</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search LGA, code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Target Register Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <span>Annual Target Register</span>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {filteredTargets.length} record{filteredTargets.length !== 1 ? 's' : ''}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Governed by public.hcd_indicator_targets table with unique constraint on LGA, indicator code, and year.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-800 animate-spin mx-auto" />
            <p className="text-xs text-slate-600 font-medium">Loading target records from Supabase...</p>
          </div>
        ) : filteredTargets.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Target className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-800">No Target Records Found</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {targets.length === 0
                ? 'No annual targets have been defined in public.hcd_indicator_targets yet. State administrators can establish annual targets using the "Define Annual Target" button above.'
                : 'No targets matched the selected filters. Try broadening the LGA, category, or status selection.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 w-12 text-center">#</th>
                  <th className="py-3 px-3 w-32">LGA</th>
                  <th className="py-3 px-3 w-28">Code</th>
                  <th className="py-3 px-4 min-w-[200px]">Indicator Name</th>
                  <th className="py-3 px-3 w-20 text-center">Year</th>
                  <th className="py-3 px-3 w-28 text-right">Baseline</th>
                  <th className="py-3 px-4 w-32 text-right">Target</th>
                  <th className="py-3 px-3 w-24 text-center">Direction</th>
                  <th className="py-3 px-3 w-28 text-center">Status</th>
                  <th className="py-3 px-4 min-w-[120px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTargets.map((t, idx) => {
                  const ind = indicators.find((i) => i.indicator_code === t.indicator_code);
                  const isDraft = t.target_status === 'draft';
                  const isApproved = t.target_status === 'approved';
                  const isRetired = t.target_status === 'retired';

                  return (
                    <tr key={t.id || `${t.lga_id}-${t.indicator_code}-${t.reporting_year}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-center font-mono text-slate-400 text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-900">
                        {t.lga_name || t.lga_id}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {t.indicator_code}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 block">
                          {ind?.indicator_name || t.indicator_code}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          {ind?.reporting_category || 'Category'} · Pillar: {getPillarDisplayName(ind?.pillar)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-semibold text-slate-800">
                        {t.reporting_year}
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        {t.baseline_value !== null && t.baseline_value !== undefined ? (
                          <div>
                            <span className="font-bold text-slate-900 block">
                              {t.baseline_value.toLocaleString()} {t.measurement_unit}
                            </span>
                            {t.baseline_year && (
                              <span className="text-[10px] text-slate-400 block font-normal">
                                Year {t.baseline_year}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No baseline</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        <span className="font-extrabold text-emerald-950 text-xs block">
                          {t.target_value.toLocaleString()} {t.measurement_unit}
                        </span>
                        <span className="text-[10px] text-slate-500 block font-normal capitalize">
                          {t.target_metric_type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {t.target_direction === 'higher_is_better' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <TrendingUp className="w-3 h-3" />
                            <span>Higher</span>
                          </span>
                        )}
                        {t.target_direction === 'lower_is_better' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                            <TrendingDown className="w-3 h-3" />
                            <span>Lower</span>
                          </span>
                        )}
                        {t.target_direction === 'maintain' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <Minus className="w-3 h-3" />
                            <span>Maintain</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            Approved
                          </span>
                        )}
                        {isDraft && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <Clock className="w-3 h-3 text-amber-700" />
                            Draft
                          </span>
                        )}
                        {isRetired && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                            <Archive className="w-3 h-3" />
                            Retired
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View details */}
                          <button
                            onClick={() => setViewingTarget(t)}
                            className="p-1 rounded-md text-slate-600 hover:text-emerald-800 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="View target approval metadata"
                          >
                            <Info className="w-4 h-4" />
                          </button>

                          {/* State Admin actions */}
                          {isStateAdmin && isDraft && t.id && (
                            <>
                              <button
                                onClick={() => handleApproveTarget(t.id!, `${t.lga_name} (${t.indicator_code})`)}
                                className="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Approve and publish target"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => openEditModal(t)}
                                className="p-1 rounded-md text-slate-600 hover:text-blue-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Edit draft"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteDraft(t.id!, `${t.lga_name} (${t.indicator_code})`)}
                                className="p-1 rounded-md text-slate-600 hover:text-rose-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Delete draft"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                          {isStateAdmin && isApproved && t.id && (
                            <button
                              onClick={() => handleRetireTarget(t.id!, `${t.lga_name} (${t.indicator_code})`)}
                              className="px-2 py-1 rounded border border-slate-300 hover:bg-slate-100 text-slate-700 text-[10px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                              title="Retire approved target"
                            >
                              <Archive className="w-3 h-3 text-slate-500" />
                              <span>Retire</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Target Creation / Edit Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl my-8 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-950 via-[#0B4619] to-emerald-900 text-white p-5 sm:p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/10 border border-white/20 text-[#D4AF37]">
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-white">
                    {editingTarget ? 'Edit Target Definition' : 'Define New Annual Target'}
                  </h3>
                  <p className="text-xs text-emerald-200">
                    Saves to public.hcd_indicator_targets in draft status pending executive approval.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  resetForm();
                }}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTarget} className="p-6 space-y-5">
              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Validation Error</span>
                    <span>{formError}</span>
                  </div>
                </div>
              )}

              {duplicateTargetWarning && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1">
                  <span className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Existing Target Detected
                  </span>
                  <p>
                    A target already exists for {duplicateTargetWarning.lga_name} on indicator {duplicateTargetWarning.indicator_code} for {duplicateTargetWarning.reporting_year}. Current target value is {duplicateTargetWarning.target_value} {duplicateTargetWarning.measurement_unit} (Status: {duplicateTargetWarning.target_status}).
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* LGA Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Local Government Area *
                  </label>
                  <select
                    value={formLgaId}
                    onChange={(e) => setFormLgaId(e.target.value)}
                    disabled={!!editingTarget}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  >
                    {ALL_31_LGAS.map((lga) => (
                      <option key={lga.id} value={lga.id}>
                        {lga.name} ({lga.senatorialDistrict.split(' ')[0]})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Indicator Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Target Indicator (Active Catalogue) *
                  </label>
                  <select
                    value={formIndicatorCode}
                    onChange={(e) => setFormIndicatorCode(e.target.value)}
                    disabled={!!editingTarget}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  >
                    {indicators.map((ind) => (
                      <option key={ind.indicator_code} value={ind.indicator_code}>
                        {ind.indicator_code} — {ind.indicator_name.slice(0, 40)}...
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Indicator Detail Drawer */}
              {selectedFormIndicator && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900">
                      {selectedFormIndicator.indicator_code}: {selectedFormIndicator.indicator_name}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                      {selectedFormIndicator.reporting_category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    <strong>Definition:</strong> {selectedFormIndicator.definition}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                    <div>
                      <span className="font-bold text-slate-700 block">Unit:</span>
                      <span>{selectedFormIndicator.measurement_unit}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-700 block">Method:</span>
                      <span className="line-clamp-1">{selectedFormIndicator.calculation_method}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-700 block">Frequency:</span>
                      <span>{selectedFormIndicator.reporting_frequency}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Period & Year */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Reporting Year *
                  </label>
                  <input
                    type="number"
                    min="2020"
                    max="2040"
                    value={formReportingYear}
                    onChange={(e) => {
                      const y = parseInt(e.target.value, 10) || new Date().getFullYear();
                      setFormReportingYear(y);
                      setFormPeriodStart(`${y}-01-01`);
                      setFormPeriodEnd(`${y}-12-31`);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 font-mono font-bold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Period Start Date *
                  </label>
                  <input
                    type="date"
                    value={formPeriodStart}
                    onChange={(e) => setFormPeriodStart(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Period End Date *
                  </label>
                  <input
                    type="date"
                    value={formPeriodEnd}
                    onChange={(e) => setFormPeriodEnd(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Baseline & Target Values */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Baseline Year (Optional)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 2025"
                    value={formBaselineYear}
                    onChange={(e) => setFormBaselineYear(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Baseline Value (Optional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 45"
                    value={formBaselineValue}
                    onChange={(e) => setFormBaselineValue(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Approved Annual Target *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 80"
                    value={formTargetValue}
                    onChange={(e) => setFormTargetValue(e.target.value)}
                    required
                    className="w-full bg-white border-2 border-emerald-600 rounded-lg p-2.5 text-xs text-slate-900 font-mono font-bold focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>
              </div>

              {/* Target Direction, Metric Type & Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Target Direction *
                  </label>
                  <select
                    value={formTargetDirection}
                    onChange={(e) => setFormTargetDirection(e.target.value as TargetDirection)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  >
                    <option value="higher_is_better">Higher is Better (e.g. Enrolment, Output)</option>
                    <option value="lower_is_better">Lower is Better (e.g. Dropout, Morbidity)</option>
                    <option value="maintain">Maintain Target (Fixed Tolerance)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Target Metric Type *
                  </label>
                  <select
                    value={formTargetMetricType}
                    onChange={(e) => setFormTargetMetricType(e.target.value as TargetMetricType)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="count">Count (Absolute Number)</option>
                    <option value="rate">Rate / Ratio</option>
                    <option value="currency">Currency (NGN)</option>
                    <option value="score">Score / Index</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Measurement Unit *
                  </label>
                  <input
                    type="text"
                    value={formMeasurementUnit}
                    onChange={(e) => setFormMeasurementUnit(e.target.value)}
                    placeholder="e.g. percent, schools, NGN"
                    required
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Source Reference & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Source Document / Authority Reference
                  </label>
                  <input
                    type="text"
                    value={formSourceReference}
                    onChange={(e) => setFormSourceReference(e.target.value)}
                    placeholder="e.g. 2026 Akwa Ibom State Approved HCD Blueprint, Min. of Health"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Explanatory Notes
                  </label>
                  <textarea
                    rows={2}
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Any specific calculation caveats or milestone targets..."
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    resetForm();
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Target...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>{editingTarget ? 'Save Changes' : 'Save as Draft Target'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Target Details / Approval History Modal */}
      {viewingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="font-extrabold text-sm text-white">Target Approval & Metadata</h3>
              </div>
              <button
                onClick={() => setViewingTarget(null)}
                className="text-white/70 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-700">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 text-sm">
                    {viewingTarget.lga_name} — {viewingTarget.indicator_code}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    viewingTarget.target_status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : viewingTarget.target_status === 'draft'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {viewingTarget.target_status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-200">
                  <div>
                    <span className="text-slate-400 block">Reporting Year:</span>
                    <strong className="text-slate-800">{viewingTarget.reporting_year}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Period:</span>
                    <strong className="text-slate-800">{viewingTarget.period_start} to {viewingTarget.period_end}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Annual Target:</span>
                    <strong className="text-emerald-900 font-mono text-sm">{viewingTarget.target_value} {viewingTarget.measurement_unit}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Baseline:</span>
                    <strong className="text-slate-800 font-mono">{viewingTarget.baseline_value !== null ? `${viewingTarget.baseline_value} ${viewingTarget.measurement_unit}` : 'None'}</strong>
                  </div>
                </div>
              </div>

              {/* Approval Metadata */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <span className="font-bold text-slate-900 block">Governance Audit Trail</span>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                  <div>
                    <span className="text-slate-400 block">Created By:</span>
                    <span className="font-mono text-[10px] truncate block">{viewingTarget.created_by || 'System'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Created At:</span>
                    <span>{viewingTarget.created_at ? new Date(viewingTarget.created_at).toLocaleString() : '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Approved By:</span>
                    <span className="font-mono text-[10px] truncate block">{viewingTarget.approved_by || 'Pending Executive Approval'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Approved At:</span>
                    <span>{viewingTarget.approved_at ? new Date(viewingTarget.approved_at).toLocaleString() : 'Pending'}</span>
                  </div>
                </div>
              </div>

              {viewingTarget.source_reference && (
                <div className="border-t border-slate-100 pt-3">
                  <span className="font-bold text-slate-900 block">Source Reference</span>
                  <p className="text-[11px] text-slate-600">{viewingTarget.source_reference}</p>
                </div>
              )}

              {viewingTarget.target_notes && (
                <div className="border-t border-slate-100 pt-3">
                  <span className="font-bold text-slate-900 block">Target Notes</span>
                  <p className="text-[11px] text-slate-600">{viewingTarget.target_notes}</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 text-right">
              <button
                onClick={() => setViewingTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
