import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { ALL_31_LGAS } from '../../data/lgas';
import {
  exportLgaExcelWorkbook,
  exportLgaPdfReport,
  exportActivitiesCsv,
  exportMeasurementsCsv,
  exportTargetPerformanceCsv,
  evaluateDataCompleteness,
  ExportDataPayload,
} from '../../services/lgaReportExportService';
import { supabaseService } from '../../services/supabaseService';
import {
  HCD_REPORTING_CATEGORIES,
  joinIndicatorsToMeasurements,
  groupRowsByCategory,
  JoinedIndicatorRow,
} from '../../utils/indicatorUtils';
import {
  HCDLgaTargetPerformance,
  TargetDirection,
  TargetMetricType,
  TargetStatus,
} from '../../types';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
  Building2,
  Calendar,
  Search,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  Database,
  Info,
  Clock,
  Layers,
  GraduationCap,
  HeartPulse,
  Wrench,
  Sparkles,
  BarChart3,
  ExternalLink,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Archive,
  BookOpen,
  Eye,
  Plus,
  ShieldAlert,
} from 'lucide-react';

interface LgaReportExportCentreProps {
  isOpen?: boolean;
  onClose?: () => void;
  defaultLgaId?: string;
  isPageMode?: boolean;
}

export const LgaReportExportCentre: React.FC<LgaReportExportCentreProps> = ({
  isOpen = true,
  onClose,
  defaultLgaId,
  isPageMode = false,
}) => {
  const { currentUser } = useAuth();
  const { pillars, indicators, getPillarDisplayName } = useData();

  // Role and access boundaries
  const isStateAdmin =
    currentUser.isAuthenticated && currentUser.isPrivileged && currentUser.role === 'state_admin';
  const isLgaAdmin =
    currentUser.isAuthenticated && currentUser.isPrivileged && currentUser.role === 'lga_admin';
  const userAssignedLgaId = currentUser.assignedLgaId;

  // Filter States
  const [selectedLgaId, setSelectedLgaId] = useState<string>(() => {
    if (isLgaAdmin && userAssignedLgaId) return userAssignedLgaId;
    return defaultLgaId || (isStateAdmin ? 'all' : 'all');
  });

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPillar, setSelectedPillar] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedIndicator, setSelectedIndicator] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Target Performance states (Section F & G)
  const [activeReportTab, setActiveReportTab] = useState<'catalogue' | 'performance'>('catalogue');
  const [selectedReportingYear, setSelectedReportingYear] = useState<number | string>(new Date().getFullYear());
  const [selectedTargetStatus, setSelectedTargetStatus] = useState<string>('all');
  const [targetPerformanceList, setTargetPerformanceList] = useState<HCDLgaTargetPerformance[]>([]);
  const [isLoadingTargets, setIsLoadingTargets] = useState<boolean>(false);
  const [selectedTargetDetail, setSelectedTargetDetail] = useState<HCDLgaTargetPerformance | null>(null);

  // UI state for expandable indicator details
  const [expandedIndicatorCodes, setExpandedIndicatorCodes] = useState<Set<string>>(new Set());

  // Execution & Data States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportType, setExportType] = useState<'excel' | 'pdf' | 'csv_act' | 'csv_meas' | 'csv_target' | null>(null);
  const [progressText, setProgressText] = useState<string>('');
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Loaded Records from Supabase
  const [loadedActivities, setLoadedActivities] = useState<any[]>([]);
  const [loadedMeasurements, setLoadedMeasurements] = useState<any[]>([]);
  const [completenessWarnings, setCompletenessWarnings] = useState<string[]>([]);
  const [generationTimestamp, setGenerationTimestamp] = useState<string>(() => new Date().toISOString());

  // Allowed LGAs based on user role
  const availableLgas = useMemo(() => {
    if (isLgaAdmin && userAssignedLgaId) {
      return ALL_31_LGAS.filter((lga) => lga.id === userAssignedLgaId);
    }
    return ALL_31_LGAS;
  }, [isLgaAdmin, userAssignedLgaId]);

  // Keep LGA aligned with permissions
  useEffect(() => {
    if (isLgaAdmin && userAssignedLgaId && selectedLgaId !== userAssignedLgaId) {
      setSelectedLgaId(userAssignedLgaId);
    }
  }, [isLgaAdmin, userAssignedLgaId, selectedLgaId]);

  // Synchronize category selection with indicator options
  const availableIndicators = useMemo(() => {
    if (selectedCategory === 'all') return indicators;
    return indicators.filter(
      (ind) => ind.reporting_category.toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [indicators, selectedCategory]);

  // Fetch report records
  const fetchReportData = async () => {
    setIsLoading(true);
    setErrorNotice(null);
    setSuccessNotice(null);
    setProgressText('Retrieving authorized records from Supabase...');

    try {
      // 1. Fetch paginated activities with role enforcement
      const effectiveLga = isLgaAdmin ? userAssignedLgaId : selectedLgaId;

      const actResult = await supabaseService.fetchActivitiesPaginated({
        lgaId: effectiveLga,
        status: selectedStatus,
        pillar: selectedPillar,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        searchQuery: searchQuery || undefined,
        userSession: currentUser,
        onProgress: (loaded, total) => {
          setProgressText(
            total ? `Retrieved ${loaded} of ${total} activities...` : `Retrieved ${loaded} activities...`
          );
        },
      });

      if (actResult.warning) {
        setErrorNotice(actResult.warning);
      }

      setLoadedActivities(actResult.activities);

      // 2. Fetch measurements linked to the retrieved activities
      const actIds = actResult.activities.map((a) => a.id);
      setProgressText(`Fetching indicator measurements for ${actIds.length} activities...`);

      let measurementsData = await supabaseService.fetchMeasurementsBatch(actIds);

      // Filter measurements by indicator if selected
      if (selectedIndicator && selectedIndicator !== 'all') {
        measurementsData = measurementsData.filter((m) => m.indicator_code === selectedIndicator);
      }

      setLoadedMeasurements(measurementsData);

      // 3. Evaluate data quality & completeness
      const warnings = evaluateDataCompleteness(actResult.activities, measurementsData);
      setCompletenessWarnings(warnings);

      // 4. Fetch target performance records from public.hcd_lga_target_performance (Section F & G)
      if (currentUser.isAuthenticated && currentUser.isPrivileged) {
        setIsLoadingTargets(true);
        const perfResult = await supabaseService.fetchTargetPerformance({
          lgaId: effectiveLga !== 'all' ? effectiveLga : undefined,
          reportingYear: selectedReportingYear !== 'all' ? Number(selectedReportingYear) : undefined,
          indicatorCode: selectedIndicator !== 'all' ? selectedIndicator : undefined,
          userSession: currentUser,
        });
        if (perfResult.success) {
          setTargetPerformanceList(perfResult.data);
        }
        setIsLoadingTargets(false);
      }

      const timestamp = new Date().toISOString();
      setGenerationTimestamp(timestamp);
      setProgressText('');
    } catch (err: any) {
      console.error('Error in fetchReportData:', err);
      setErrorNotice(err.message || 'Failed to retrieve report data');
      setProgressText('');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load when opened
  useEffect(() => {
    if (isOpen) {
      fetchReportData();
    }
  }, [isOpen]);

  const handleClearFilters = () => {
    if (isLgaAdmin && userAssignedLgaId) {
      setSelectedLgaId(userAssignedLgaId);
    } else {
      setSelectedLgaId('all');
    }
    setStartDate('');
    setEndDate('');
    setSelectedCategory('all');
    setSelectedPillar('all');
    setSelectedStatus('all');
    setSelectedIndicator('all');
    setSelectedReportingYear(new Date().getFullYear());
    setSelectedTargetStatus('all');
    setSearchQuery('');
  };

  // Filter scoped indicators
  const scopedIndicators = useMemo(() => {
    let result = indicators;
    if (selectedCategory !== 'all') {
      result = result.filter(
        (i) => i.reporting_category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    if (selectedPillar !== 'all') {
      result = result.filter((i) => i.pillar === selectedPillar);
    }
    if (selectedIndicator !== 'all') {
      result = result.filter((i) => i.indicator_code === selectedIndicator);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.indicator_code.toLowerCase().includes(q) ||
          i.indicator_name.toLowerCase().includes(q) ||
          i.definition.toLowerCase().includes(q)
      );
    }
    return result;
  }, [indicators, selectedCategory, selectedPillar, selectedIndicator, searchQuery]);

  // Conceptually perform: Active Indicator Catalogue LEFT JOIN activities LEFT JOIN measurements
  const joinedRows = useMemo(() => {
    return joinIndicatorsToMeasurements(scopedIndicators, loadedMeasurements, loadedActivities);
  }, [scopedIndicators, loadedMeasurements, loadedActivities]);

  // Group rows by categories
  const categorySummaries = useMemo(() => {
    return groupRowsByCategory(joinedRows, selectedCategory);
  }, [joinedRows, selectedCategory]);

  // Target Performance Filtered Records (Section F & G)
  const filteredTargetPerformance = useMemo(() => {
    return targetPerformanceList.filter((row) => {
      // Role & LGA boundaries
      if (isLgaAdmin && userAssignedLgaId && row.lga_id !== userAssignedLgaId) return false;
      if (selectedLgaId !== 'all' && row.lga_id !== selectedLgaId) return false;

      // Reporting Year
      if (selectedReportingYear !== 'all' && row.reporting_year !== Number(selectedReportingYear)) {
        return false;
      }

      // Category
      if (selectedCategory !== 'all') {
        const cat = row.reporting_category?.trim().toLowerCase();
        if (cat !== selectedCategory.toLowerCase()) return false;
      }

      // Pillar
      if (selectedPillar !== 'all' && row.pillar !== selectedPillar) return false;

      // Indicator
      if (selectedIndicator !== 'all' && row.indicator_code !== selectedIndicator) return false;

      // Target Status (LGA Admin strictly restricted to approved)
      if (isLgaAdmin && row.target_status !== 'approved') return false;
      if (selectedTargetStatus !== 'all' && row.target_status !== selectedTargetStatus) return false;

      // Period range
      if (startDate && row.period_start && row.period_start < startDate) return false;
      if (endDate && row.period_end && row.period_end > endDate) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const code = (row.indicator_code || '').toLowerCase();
        const name = (row.indicator_name || '').toLowerCase();
        const lga = (row.lga_name || '').toLowerCase();
        const notes = (row.target_notes || '').toLowerCase();
        const ref = (row.source_reference || '').toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !lga.includes(q) && !notes.includes(q) && !ref.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [
    targetPerformanceList,
    isLgaAdmin,
    userAssignedLgaId,
    selectedLgaId,
    selectedReportingYear,
    selectedCategory,
    selectedPillar,
    selectedIndicator,
    selectedTargetStatus,
    startDate,
    endDate,
    searchQuery,
  ]);

  // Target Performance KPI Metrics
  const performanceKpis = useMemo(() => {
    const total = filteredTargetPerformance.length;
    const achieved = filteredTargetPerformance.filter((t) => t.achievement_status === 'achieved').length;
    const onTrack = filteredTargetPerformance.filter((t) => t.achievement_status === 'on_track').length;
    const lagging = filteredTargetPerformance.filter((t) => t.achievement_status === 'lagging').length;
    const critical = filteredTargetPerformance.filter((t) => t.achievement_status === 'critical').length;
    const noData = filteredTargetPerformance.filter((t) => t.achievement_status === 'no_data').length;
    const compareToTarget = filteredTargetPerformance.filter((t) => t.achievement_status === 'compare_to_target').length;
    const targetZeroReview = filteredTargetPerformance.filter((t) => t.achievement_status === 'target_zero_review').length;
    return { total, achieved, onTrack, lagging, critical, noData, compareToTarget, targetZeroReview };
  }, [filteredTargetPerformance]);

  const handleExportTargetPerformanceCsv = () => {
    const lgaTag = selectedLgaInfo ? selectedLgaInfo.name.replace(/\s+/g, '_') : 'Statewide';
    exportTargetPerformanceCsv(filteredTargetPerformance, pillars, lgaTag);
    setSuccessNotice(`Exported ${filteredTargetPerformance.length} target performance records to CSV.`);
    setTimeout(() => setSuccessNotice(null), 4000);
  };

  // Target Performance Formatters (Section F & G)
  const renderAchievementRate = (row: HCDLgaTargetPerformance) => {
    if (row.actual_value === null || row.actual_value === undefined) {
      return <span className="text-slate-400 font-mono italic text-[11px]">No data reported</span>;
    }

    if (row.target_direction === 'maintain' || row.achievement_status === 'compare_to_target') {
      return (
        <div className="space-y-0.5" title="Percentage achievement rate is not defined until an approved tolerance rule is specified.">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-900 bg-purple-100 px-2 py-0.5 rounded border border-purple-200">
            <Info className="w-3 h-3 text-purple-700" />
            Compare to target
          </span>
          <span className="block text-[9px] text-purple-700">Tolerance rule review</span>
        </div>
      );
    }

    if (row.target_direction === 'higher_is_better' && row.target_value === 0) {
      return (
        <div className="space-y-0.5" title="Annual target is set to zero; rate cannot be calculated safely.">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
            <AlertTriangle className="w-3 h-3 text-amber-700" />
            Target zero review
          </span>
          <span className="block text-[9px] text-amber-700">Zero target review</span>
        </div>
      );
    }

    if (row.target_direction === 'lower_is_better' && row.actual_value === 0) {
      return (
        <div className="space-y-0.5">
          <span className="text-emerald-800 font-black font-mono text-xs">100.0%</span>
          <span className="block text-[9px] text-emerald-700 font-medium leading-tight">
            100% (Zero incidence achieved)
          </span>
        </div>
      );
    }

    if (row.achievement_rate !== null && row.achievement_rate !== undefined) {
      const rateNum = Number(row.achievement_rate);
      const isExceeded = rateNum >= 100;
      const isModerate = rateNum >= 75 && rateNum < 100;
      return (
        <div className="space-y-0.5">
          <span
            className={`font-mono font-bold text-xs ${
              isExceeded ? 'text-emerald-800' : isModerate ? 'text-blue-800' : 'text-amber-800'
            }`}
          >
            {rateNum.toFixed(1)}%
          </span>
          <span className="block text-[9px] text-slate-400 font-mono">
            {row.target_direction === 'higher_is_better' ? 'actual/target' : 'target/actual'}
          </span>
        </div>
      );
    }

    return <span className="text-slate-400 font-mono">—</span>;
  };

  const renderAchievementStatusBadge = (status?: string) => {
    switch (status) {
      case 'achieved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
            Achieved
          </span>
        );
      case 'on_track':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
            <TrendingUp className="w-3 h-3 text-blue-700" />
            On Track
          </span>
        );
      case 'lagging':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <AlertTriangle className="w-3 h-3 text-amber-700" />
            Lagging
          </span>
        );
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
            <AlertCircle className="w-3 h-3 text-rose-700" />
            Critical Lag
          </span>
        );
      case 'no_data':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-300">
            <Clock className="w-3 h-3 text-slate-500" />
            No data reported
          </span>
        );
      case 'compare_to_target':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-900 border border-purple-300">
            <Info className="w-3 h-3 text-purple-700" />
            Maintain Target
          </span>
        );
      case 'target_zero_review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-400">
            <AlertTriangle className="w-3 h-3 text-amber-700" />
            Target Zero Review
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {status || 'Unknown'}
          </span>
        );
    }
  };

  const renderDirectionBadge = (dir: TargetDirection) => {
    switch (dir) {
      case 'higher_is_better':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
            <TrendingUp className="w-2.5 h-2.5 text-emerald-600" />
            Higher is better
          </span>
        );
      case 'lower_is_better':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
            <TrendingDown className="w-2.5 h-2.5 text-sky-600" />
            Lower is better
          </span>
        );
      case 'maintain':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
            <Minus className="w-2.5 h-2.5 text-purple-600" />
            Maintain
          </span>
        );
    }
  };

  const renderTargetStatusBadge = (status?: TargetStatus) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
            <ShieldCheck className="w-3 h-3 text-emerald-700" />
            Approved
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
            <Clock className="w-3 h-3 text-amber-700" />
            Draft
          </span>
        );
      case 'retired':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-300">
            <Archive className="w-3 h-3 text-slate-500" />
            Retired
          </span>
        );
      default:
        return null;
    }
  };

  // Indicator high-level statistics
  const totalScopedIndicators = scopedIndicators.length;
  const reportedCount = joinedRows.filter((r) => r.status === 'Data reported').length;
  const incompleteCount = joinedRows.filter((r) => r.status === 'Incomplete submission').length;
  const unreportedCount = joinedRows.filter((r) => r.status === 'No data reported').length;
  const coverageRate = totalScopedIndicators > 0
    ? Math.round(((reportedCount + incompleteCount) / totalScopedIndicators) * 100)
    : 0;

  // Selected LGA Info
  const selectedLgaInfo = ALL_31_LGAS.find((l) => l.id === selectedLgaId);

  // Toggle expandable row
  const toggleExpand = (code: string) => {
    setExpandedIndicatorCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  // Prepare Payload for Export Services
  const buildPayload = (): ExportDataPayload => {
    return {
      activities: loadedActivities,
      measurements: loadedMeasurements,
      indicators: scopedIndicators,
      pillars,
      filters: {
        lgaId: selectedLgaId,
        lgaName: selectedLgaInfo?.name || (selectedLgaId === 'all' ? 'All Akwa Ibom State LGAs' : selectedLgaId),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        pillar: selectedPillar !== 'all' ? selectedPillar : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        indicatorCode: selectedIndicator !== 'all' ? selectedIndicator : undefined,
        searchQuery: searchQuery || undefined,
      },
      generatedAt: generationTimestamp,
      generatedBy: currentUser.isAuthenticated ? currentUser.email : 'Public Transparency Visitor',
      userRole: currentUser.role,
      completenessWarnings,
    };
  };

  const handleExportExcel = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportType('excel');
    setErrorNotice(null);
    try {
      const payload = buildPayload();
      exportLgaExcelWorkbook(payload);
      setSuccessNotice('Comprehensive multi-sheet Excel workbook with Indicator Catalogue generated successfully.');
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to generate Excel report');
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  const handleExportPdf = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportType('pdf');
    setErrorNotice(null);
    try {
      const payload = buildPayload();
      exportLgaPdfReport(payload);
      setSuccessNotice('Official print-ready PDF report with indicator performance generated successfully.');
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to generate PDF report');
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  const handleExportActivitiesCsv = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportType('csv_act');
    setErrorNotice(null);
    try {
      const payload = buildPayload();
      exportActivitiesCsv(payload);
      setSuccessNotice('Activities CSV exported successfully with injection protection.');
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to generate CSV export');
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  const handleExportMeasurementsCsv = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setExportType('csv_meas');
    setErrorNotice(null);
    try {
      const payload = buildPayload();
      exportMeasurementsCsv(payload);
      setSuccessNotice('Indicator Measurements CSV exported successfully.');
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to generate CSV export');
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  if (!isOpen) return null;

  const totalBeneficiaries = loadedActivities.reduce((s, a) => s + (a.beneficiariesTotal || 0), 0);
  const totalBudget = loadedActivities.reduce((s, a) => s + (a.budgetNgn || 0), 0);

  // Category Icon Resolver
  const getCategoryIcon = (catName: string) => {
    switch (catName.toLowerCase()) {
      case 'education':
        return <GraduationCap className="w-4 h-4 text-emerald-700" />;
      case 'health':
        return <HeartPulse className="w-4 h-4 text-sky-600" />;
      case 'skill and labour':
        return <Wrench className="w-4 h-4 text-amber-700" />;
      case 'cross-cutting enablers':
        return <Layers className="w-4 h-4 text-cyan-600" />;
      case 'values/ethics/social behaviour':
        return <ShieldCheck className="w-4 h-4 text-purple-600" />;
      default:
        return <BarChart3 className="w-4 h-4 text-slate-600" />;
    }
  };

  const containerContent = (
    <div className={`bg-white ${isPageMode ? 'rounded-2xl border border-slate-200 shadow-sm' : 'rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[94vh] flex flex-col'} w-full animate-in fade-in duration-200`}>
      {/* Top Official Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#0B4619] to-emerald-950 text-white p-4 sm:p-5 flex items-center justify-between border-b border-[#D4AF37]/40 shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-900/60 rounded-xl border border-[#D4AF37]/30 text-[#D4AF37]">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider font-bold text-[#D4AF37]">
                Akwa Ibom State Government • ARISE Agenda
              </span>
              <span className="bg-emerald-800 text-emerald-200 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                Live Indicator Catalogue Integration
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white">
              Local Government Area Report & Strategic Indicator Dossier
            </h2>
          </div>
        </div>
        {!isPageMode && onClose && (
          <button
            onClick={onClose}
            className="p-2 text-emerald-200 hover:text-white hover:bg-emerald-800/60 rounded-lg transition-colors cursor-pointer"
            aria-label="Close export modal"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Notices & Alerts */}
      {errorNotice && (
        <div className="bg-rose-50 border-b border-rose-200 p-3 px-6 flex items-center gap-3 text-rose-800 text-xs shrink-0">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span className="flex-1 font-medium">{errorNotice}</span>
          <button
            onClick={() => setErrorNotice(null)}
            className="text-rose-600 hover:text-rose-900 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {successNotice && (
        <div className="bg-emerald-50 border-b border-emerald-200 p-3 px-6 flex items-center gap-3 text-emerald-900 text-xs shrink-0">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span className="flex-1 font-medium">{successNotice}</span>
          <button
            onClick={() => setSuccessNotice(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className={`${isPageMode ? 'p-6 space-y-6' : 'flex-1 overflow-y-auto p-4 sm:p-6 space-y-6'}`}>
        {/* Report Sub-System Mode Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setActiveReportTab('catalogue')}
              className={`px-3.5 py-2 rounded-md transition-all flex items-center gap-2 cursor-pointer ${
                activeReportTab === 'catalogue'
                  ? 'bg-white text-emerald-950 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-emerald-700" />
              <span>Indicator Catalogue Report ({scopedIndicators.length})</span>
            </button>

            <button
              onClick={() => setActiveReportTab('performance')}
              className={`px-3.5 py-2 rounded-md transition-all flex items-center gap-2 cursor-pointer ${
                activeReportTab === 'performance'
                  ? 'bg-white text-emerald-950 shadow-xs font-bold ring-1 ring-emerald-300'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Target className="w-4 h-4 text-emerald-700" />
              <span>Target vs. Actual Performance Report</span>
              {filteredTargetPerformance.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold font-mono">
                  {filteredTargetPerformance.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600">
            {activeReportTab === 'performance' ? (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-900 rounded-md border border-emerald-200 text-[11px] font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                Security-Invoker View: <code className="font-mono text-emerald-950">public.hcd_lga_target_performance</code>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 rounded-md text-[11px]">
                <Database className="w-3.5 h-3.5 text-slate-500" />
                Live Catalogue: <code className="font-mono text-slate-900">public.hcd_reporting_indicators</code>
              </span>
            )}
          </div>
        </div>

        {/* Section A: Multi-Parameter Filtering Controls */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-emerald-700" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                {activeReportTab === 'performance'
                  ? 'Target Performance Filters & Scope'
                  : 'LGA Report Filters & Indicator Scope'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearFilters}
                disabled={isLoading || isExporting}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline cursor-pointer disabled:opacity-50"
              >
                Clear Filters
              </button>
              <button
                onClick={fetchReportData}
                disabled={isLoading || isExporting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{isLoading ? 'Querying...' : 'Apply & Refresh'}</span>
              </button>
            </div>
          </div>

          {/* Filter Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* 1. LGA Selector */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Local Government Area (LGA)</span>
              </label>
              <select
                value={selectedLgaId}
                onChange={(e) => setSelectedLgaId(e.target.value)}
                disabled={isLgaAdmin}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
              >
                {!isLgaAdmin && <option value="all">Statewide (All 31 LGAs)</option>}
                {availableLgas.map((lga) => (
                  <option key={lga.id} value={lga.id}>
                    {lga.name} ({lga.senatorialDistrict.split(' ')[0]})
                  </option>
                ))}
              </select>
              {isLgaAdmin && (
                <p className="text-[10px] text-slate-500 mt-1">
                  Locked to your authorized LGA assignment ({currentUser.assignedLgaName}).
                </p>
              )}
            </div>

            {/* 2. Reporting Category Selector (All 6 Live Categories including HCD Settings) */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Reporting Category</span>
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSelectedIndicator('all'); // Reset indicator when category changes
                }}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:outline-none font-medium"
              >
                <option value="all">All 6 Categories (39 Indicators)</option>
                {HCD_REPORTING_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name} ({cat.expectedCount} indicators)
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Strategic Pillar Selector */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-emerald-700" />
                <span>Strategic HCD Pillar</span>
              </label>
              <select
                value={selectedPillar}
                onChange={(e) => setSelectedPillar(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              >
                <option value="all">All Strategic Pillars</option>
                {pillars.map((p) => (
                  <option key={p.pillar_code} value={p.pillar_code}>
                    {p.display_name}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Target Indicator Selector (Dynamically Filtered by Category) */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Target Indicator
              </label>
              <select
                value={selectedIndicator}
                onChange={(e) => setSelectedIndicator(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              >
                <option value="all">
                  All Scoped Indicators ({availableIndicators.length} total)
                </option>
                {availableIndicators.map((ind) => (
                  <option key={ind.indicator_code} value={ind.indicator_code}>
                    {ind.indicator_code} - {ind.indicator_name.slice(0, 34)}...
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Reporting Year Selector */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                <span>Reporting Year</span>
              </label>
              <select
                value={selectedReportingYear}
                onChange={(e) => setSelectedReportingYear(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:outline-none font-medium"
              >
                <option value="all">All Reporting Years</option>
                <option value={new Date().getFullYear()}>{new Date().getFullYear()} (Current Fiscal Cycle)</option>
                <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
                <option value={new Date().getFullYear() - 2}>{new Date().getFullYear() - 2}</option>
                <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1} (Forecast)</option>
              </select>
            </div>

            {/* 6. Contextual Status Filter (Target Status vs Activity Status) */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {activeReportTab === 'performance' ? 'Target Status' : 'Activity Status'}
              </label>
              {activeReportTab === 'performance' ? (
                <select
                  value={selectedTargetStatus}
                  onChange={(e) => setSelectedTargetStatus(e.target.value)}
                  disabled={isLgaAdmin}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed font-medium"
                >
                  {isStateAdmin ? (
                    <>
                      <option value="all">All Target Statuses</option>
                      <option value="approved">Approved (State Council Sanctioned)</option>
                      <option value="draft">Draft (Workplan Proposal)</option>
                      <option value="retired">Retired (Superseded/Archived)</option>
                    </>
                  ) : (
                    <option value="approved">Approved Targets Only (LGA Scoped)</option>
                  )}
                </select>
              ) : (
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                >
                  <option value="all">All Authorized Statuses</option>
                  <option value="PUBLISHED">Published (Official Public Record)</option>
                  {currentUser.isPrivileged && (
                    <>
                      <option value="PENDING_APPROVAL">Pending Executive Review</option>
                      <option value="DRAFT">Field Draft (LGA Workspace)</option>
                      <option value="REJECTED_DRAFT">Revision Required (Rejected)</option>
                    </>
                  )}
                </select>
              )}
            </div>

            {/* 7. Date Range: Start & End */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px] flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  <span>Start Period</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-slate-800 text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-[11px] flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  <span>End Period</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-slate-800 text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            {/* 8. Search Filter */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Search className="w-3.5 h-3.5 text-slate-500" />
                <span>Search Keyword / Reference</span>
              </label>
              <input
                type="text"
                placeholder={activeReportTab === 'performance' ? "e.g. EDU-01, Target 2026, Uyo..." : "e.g. Literacy, Immunization, Uyo..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:ring-2 focus:ring-emerald-600 focus:outline-none placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Progress Banner */}
        {progressText && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 px-4 flex items-center gap-3 text-xs text-emerald-900 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-700" />
            <span>{progressText}</span>
          </div>
        )}

        {/* Section B: Indicator KPI Summaries & Category Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {/* Card 1: Total Indicators in Scope */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Active Catalogue Scope
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 block font-mono">
              {totalScopedIndicators}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              {selectedCategory === 'all' ? 'All 34 indicators' : selectedCategory}
            </span>
          </div>

          {/* Card 2: Reported Indicators */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5">
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
              Data Reported
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-800 mt-0.5 block font-mono">
              {reportedCount}
            </span>
            <span className="text-[10px] text-emerald-700 mt-0.5 block">
              {coverageRate}% reporting coverage
            </span>
          </div>

          {/* Card 3: Incomplete Submissions */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
              Incomplete Data
            </span>
            <span className="text-xl sm:text-2xl font-black text-amber-800 mt-0.5 block font-mono">
              {incompleteCount}
            </span>
            <span className="text-[10px] text-amber-700 mt-0.5 block">
              Missing evidence/fields
            </span>
          </div>

          {/* Card 4: No Data Reported */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              No Data Reported
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-700 mt-0.5 block font-mono">
              {unreportedCount}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Awaiting submission
            </span>
          </div>

          {/* Card 5: Total Activities */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Activities
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 block font-mono">
              {loadedActivities.length}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              {selectedLgaInfo?.name || 'Statewide'}
            </span>
          </div>

          {/* Card 6: Total Beneficiaries */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Beneficiaries
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 block font-mono">
              {totalBeneficiaries.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Recorded individuals
            </span>
          </div>

          {/* Card 7: Linked Measurements */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Measurements
            </span>
            <span className="text-xl sm:text-2xl font-black text-blue-700 mt-0.5 block font-mono">
              {loadedMeasurements.length}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Joined data points
            </span>
          </div>
        </div>

        {/* Category Quick Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              selectedCategory === 'all'
                ? 'bg-emerald-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <span>All Categories</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
              {indicators.length}
            </span>
          </button>
          {HCD_REPORTING_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.name;
            const catRows = joinedRows.filter(
              (r) => r.indicator.reporting_category?.trim().toLowerCase() === cat.name.toLowerCase()
            );
            const withData = catRows.filter((r) => r.status === 'Data reported').length;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-emerald-50 text-emerald-950 border-emerald-400 font-bold shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {getCategoryIcon(cat.name)}
                <span>{cat.name}</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 text-slate-600">
                  {withData}/{cat.expectedCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* Target Architecture Notice */}
        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <strong className="block text-blue-950 font-semibold">
              Indicator Target Architecture Notice:
            </strong>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              The live database table <code className="bg-blue-100 px-1 py-0.2 rounded font-mono">public.hcd_reporting_indicators</code> defines official metric requirements, collection methods, and disaggregation dimensions. Formal quantitative targets require a dedicated schema table keyed by indicator code, LGA identifier, and reporting cycle.
            </p>
          </div>
        </div>

        {/* Section C: Complete Indicator Reporting Table (LEFT JOIN with Catalogue) */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-700" />
                <span>Official Indicator Reporting Table ({joinedRows.length} Indicators In Scope)</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Every catalogue indicator is preserved regardless of whether data has been submitted. Missing values are never displayed as zero.
              </p>
            </div>
            <div className="text-[11px] font-semibold text-slate-600">
              Selected LGA: <strong className="text-slate-900">{selectedLgaInfo?.name || 'All LGAs'}</strong>
            </div>
          </div>

          {categorySummaries.map((catSum) => (
            <div key={catSum.categoryName} className="border-b border-slate-200 last:border-b-0">
              {/* Category Header Bar */}
              <div className="bg-slate-100/80 px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(catSum.categoryName)}
                  <span>{catSum.categoryName}</span>
                  <span className="text-[10px] font-normal text-slate-500">
                    ({catSum.canonicalPillar})
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded font-mono">
                    {catSum.reportedIndicators} Reported
                  </span>
                  <span className="text-slate-600 bg-slate-200 px-2 py-0.5 rounded font-mono">
                    {catSum.unreportedIndicators} No Data
                  </span>
                  <span className="text-slate-500">
                    {catSum.coveragePercentage}% coverage
                  </span>
                </div>
              </div>

              {/* Indicator Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50/70 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10">#</th>
                      <th className="py-2.5 px-3 w-28">Indicator Code</th>
                      <th className="py-2.5 px-4 min-w-[200px]">Indicator Name</th>
                      <th className="py-2.5 px-3 w-24">Unit</th>
                      <th className="py-2.5 px-4 min-w-[140px]">Reported Result</th>
                      <th className="py-2.5 px-3 w-28">Rate / %</th>
                      <th className="py-2.5 px-3 w-32">Status</th>
                      <th className="py-2.5 px-3 w-36">Period</th>
                      <th className="py-2.5 px-2 w-12 text-center">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {catSum.rows.map((row) => {
                      const ind = row.indicator;
                      const isExpanded = expandedIndicatorCodes.has(ind.indicator_code);

                      return (
                        <React.Fragment key={ind.indicator_code}>
                          <tr className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? 'bg-emerald-50/30' : ''}`}>
                            <td className="py-2.5 px-3 font-mono text-slate-400 text-[10px]">
                              {ind.indicator_code.split('-')[1] || '01'}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                              {ind.indicator_code}
                            </td>
                            <td className="py-2.5 px-4">
                              <span className="font-semibold text-slate-900 block">
                                {ind.indicator_name}
                              </span>
                              <span className="text-[10px] text-slate-400 line-clamp-1">
                                {ind.definition}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                              {ind.measurement_unit}
                            </td>
                            <td className="py-2.5 px-4">
                              {row.status === 'No data reported' ? (
                                <span className="text-[11px] text-slate-400 italic">
                                  No data reported for this LGA and reporting period.
                                </span>
                              ) : (
                                <span className="font-bold text-slate-900 font-mono text-xs">
                                  {row.latestValueText}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-xs font-semibold text-slate-800">
                              {row.calculatedRate || '—'}
                            </td>
                            <td className="py-2.5 px-3">
                              {row.status === 'Data reported' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Data reported
                                </span>
                              )}
                              {row.status === 'Incomplete submission' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  Incomplete
                                </span>
                              )}
                              {row.status === 'No data reported' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                                  No data
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-slate-500 whitespace-nowrap">
                              {row.latestPeriod}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <button
                                onClick={() => toggleExpand(ind.indicator_code)}
                                className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                                title="Toggle definition and metadata"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-emerald-800" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                          </tr>

                          {/* Expandable Details Drawer */}
                          {isExpanded && (
                            <tr className="bg-slate-50/90 border-t border-b border-emerald-100">
                              <td colSpan={9} className="p-4 sm:p-5 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                                  {/* Column 1: Full Definition */}
                                  <div className="space-y-1">
                                    <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500 block">
                                      Official Definition
                                    </span>
                                    <p className="text-slate-800 leading-relaxed text-[11px]">
                                      {ind.definition}
                                    </p>
                                  </div>

                                  {/* Column 2: Calculation & Collection */}
                                  <div className="space-y-1">
                                    <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500 block">
                                      Calculation & Collection Method
                                    </span>
                                    <p className="text-slate-800 text-[11px] font-mono leading-tight bg-white p-2 rounded border border-slate-200">
                                      {ind.calculation_method}
                                    </p>
                                    <p className="text-[10px] text-slate-600 mt-1">
                                      Collection: {ind.collection_method}
                                    </p>
                                  </div>

                                  {/* Column 3: Recommended Source & Frequency */}
                                  <div className="space-y-1">
                                    <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500 block">
                                      Source & Frequency
                                    </span>
                                    <p className="text-slate-800 text-[11px]">
                                      {ind.recommended_source}
                                    </p>
                                    <span className="inline-block mt-1 bg-slate-200 text-slate-800 text-[10px] px-2 py-0.5 rounded font-semibold">
                                      {ind.reporting_frequency} Frequency
                                    </span>
                                  </div>

                                  {/* Column 4: Dimensions & Evidence Required */}
                                  <div className="space-y-2">
                                    <div>
                                      <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500 block mb-1">
                                        Disaggregation Dimensions
                                      </span>
                                      <div className="flex flex-wrap gap-1">
                                        {ind.disaggregation_dimensions?.map((dim) => (
                                          <span
                                            key={dim}
                                            className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] rounded font-mono"
                                          >
                                            {dim}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500 block mb-1">
                                        Evidence Requirements
                                      </span>
                                      <div className="flex flex-wrap gap-1">
                                        {ind.evidence_required?.map((ev) => (
                                          <span
                                            key={ev}
                                            className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] rounded"
                                          >
                                            {ev}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Underlying Measurement Transactions for this Indicator */}
                                <div className="border-t border-slate-200 pt-3">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-2">
                                    Recorded Activity Measurements for {ind.indicator_code} ({row.measurements.length})
                                  </span>
                                  {row.measurements.length === 0 ? (
                                    <p className="text-xs text-slate-500 italic">
                                      No activity measurements currently recorded for this indicator in the selected scope.
                                    </p>
                                  ) : (
                                    <div className="space-y-2">
                                      {row.measurements.map(({ measurement: m, parentActivity }) => (
                                        <div
                                          key={m.id || Math.random()}
                                          className="p-3 bg-white rounded-lg border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                        >
                                          <div>
                                            <span className="font-bold text-slate-900 block">
                                              {parentActivity?.title || `Activity ${m.activity_id}`}
                                            </span>
                                            <span className="text-[10px] text-slate-500">
                                              LGA: {parentActivity?.lgaName || selectedLgaInfo?.name || 'N/A'} • Period: {m.reporting_period_start} to {m.reporting_period_end}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <div className="text-right">
                                              <span className="font-bold text-emerald-800 font-mono text-sm block">
                                                {m.value_numeric !== null && m.value_numeric !== undefined ? `${m.value_numeric} ${ind.measurement_unit}` : m.value_text || '—'}
                                              </span>
                                              {typeof m.numerator === 'number' && typeof m.denominator === 'number' && (
                                                <span className="text-[10px] text-slate-500 font-mono">
                                                  {m.numerator} / {m.denominator} ({m.denominator === 0 ? 'N/A' : `${((m.numerator / m.denominator) * 100).toFixed(1)}%`})
                                                </span>
                                              )}
                                            </div>
                                            {m.evidence_reference && (
                                              <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-mono">
                                                Ref: {m.evidence_reference}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* Section D: Download Actions */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-700" />
            <span>Authorized Export Formats (Full 34 Indicators + Joined Activities)</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Option 1: Multi-Sheet Excel */}
            <button
              onClick={handleExportExcel}
              disabled={isLoading || isExporting}
              className="flex flex-col items-start p-4 rounded-xl border-2 border-emerald-600 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-950 transition-all text-left group shadow-xs cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div className="p-2 bg-emerald-600 text-white rounded-lg group-hover:scale-105 transition-transform">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded">
                  8 Sheets
                </span>
              </div>
              <span className="font-bold text-sm text-emerald-900">
                {isExporting && exportType === 'excel' ? 'Generating...' : 'Excel Workbook (.xlsx)'}
              </span>
              <span className="text-[11px] text-emerald-800/80 mt-1">
                Comprehensive workbook including dedicated Indicator Catalogue with all 34 indicators.
              </span>
            </button>

            {/* Option 2: Print-Ready PDF */}
            <button
              onClick={handleExportPdf}
              disabled={isLoading || isExporting}
              className="flex flex-col items-start p-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-600 hover:bg-slate-50 text-slate-800 transition-all text-left group shadow-xs cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div className="p-2 bg-rose-700 text-white rounded-lg group-hover:scale-105 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase bg-rose-100 text-rose-800 px-2 py-0.5 rounded">
                  Printable
                </span>
              </div>
              <span className="font-bold text-sm text-slate-900">
                {isExporting && exportType === 'pdf' ? 'Formatting...' : 'Official PDF Report'}
              </span>
              <span className="text-[11px] text-slate-500 mt-1">
                Executive briefing with complete category coverage, KPI cards & explicit no-data entries.
              </span>
            </button>

            {/* Option 3: Activities CSV */}
            <button
              onClick={handleExportActivitiesCsv}
              disabled={isLoading || isExporting}
              className="flex flex-col items-start p-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-600 hover:bg-slate-50 text-slate-800 transition-all text-left group shadow-xs cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div className="p-2 bg-slate-800 text-white rounded-lg group-hover:scale-105 transition-transform">
                  <Database className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                  Sanitized
                </span>
              </div>
              <span className="font-bold text-sm text-slate-900">
                {isExporting && exportType === 'csv_act' ? 'Exporting...' : 'Activities CSV'}
              </span>
              <span className="text-[11px] text-slate-500 mt-1">
                Tabular CSV with formula injection mitigation for external spreadsheet analysis.
              </span>
            </button>

            {/* Option 4: Measurements CSV */}
            <button
              onClick={handleExportMeasurementsCsv}
              disabled={isLoading || isExporting}
              className="flex flex-col items-start p-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-600 hover:bg-slate-50 text-slate-800 transition-all text-left group shadow-xs cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div className="p-2 bg-blue-700 text-white rounded-lg group-hover:scale-105 transition-transform">
                  <Layers className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                  Metrics
                </span>
              </div>
              <span className="font-bold text-sm text-slate-900">
                {isExporting && exportType === 'csv_meas' ? 'Exporting...' : 'Measurements CSV'}
              </span>
              <span className="text-[11px] text-slate-500 mt-1">
                Quantitative measurement dataset with indicator codes, values and reporting periods.
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Bar */}
      <div className="bg-slate-100 border-t border-slate-200 p-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 shrink-0">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <span>
            Role-Based Access Guard Active: Scoped to {currentUser.role} permissions.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline">
            Generated: {generationTimestamp.split('T')[0]}
          </span>
          {!isPageMode && onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (isPageMode) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {containerContent}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div className="max-w-6xl w-full">
        {containerContent}
      </div>
    </div>
  );
};
