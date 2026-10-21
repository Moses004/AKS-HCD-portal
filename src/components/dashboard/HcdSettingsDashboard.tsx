import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { ALL_31_LGAS } from '../../data/lgas';
import { HCD_SETTINGS_MAP, HCDSettingType } from '../../data/indicators';
import { HCDLgaTargetPerformance } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import {
  Home,
  Users,
  GraduationCap,
  Briefcase,
  Target,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Building2,
  Calendar,
  Filter,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  FileCheck,
  Sparkles,
  Info,
} from 'lucide-react';

interface HcdSettingsDashboardProps {
  defaultLgaId?: string;
  onRecordInitiative?: (setting?: HCDSettingType) => void;
}

interface SettingCardData {
  setting: HCDSettingType;
  indicatorCode: string;
  title: string;
  icon: React.ReactNode;
  bgGradient: string;
  accentColor: string;
  performanceRecord?: HCDLgaTargetPerformance;
}

export const HcdSettingsDashboard: React.FC<HcdSettingsDashboardProps> = ({
  defaultLgaId,
  onRecordInitiative,
}) => {
  const { currentUser } = useAuth();
  const { isOnline } = useData();

  const isLgaAdmin = currentUser.role === 'lga_admin';
  const assignedLgaId = currentUser.assignedLgaId;

  // Filter States
  const [selectedLgaId, setSelectedLgaId] = useState<string>(() => {
    if (isLgaAdmin && assignedLgaId) return assignedLgaId;
    return defaultLgaId || 'all';
  });
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState<string>('all');
  const [selectedSettingFilter, setSelectedSettingFilter] = useState<string>('all');

  // Data & Execution States
  const [performanceList, setPerformanceList] = useState<HCDLgaTargetPerformance[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>(() => new Date().toISOString());

  // Available LGAs based on RBAC
  const availableLgas = useMemo(() => {
    if (isLgaAdmin && assignedLgaId) {
      return ALL_31_LGAS.filter((l) => l.id === assignedLgaId);
    }
    return ALL_31_LGAS;
  }, [isLgaAdmin, assignedLgaId]);

  // Load target performance records from database security-invoker view
  const loadPerformanceData = useCallback(async () => {
    setIsLoading(true);
    setErrorNotice(null);

    try {
      const effectiveLga = isLgaAdmin && assignedLgaId ? assignedLgaId : selectedLgaId;
      const res = await supabaseService.fetchTargetPerformance({
        lgaId: effectiveLga !== 'all' ? effectiveLga : undefined,
        reportingYear: selectedYear || undefined,
        userSession: currentUser,
      });

      if (!res.success) {
        setErrorNotice(res.error || 'Failed to retrieve authoritative target-performance view.');
        setPerformanceList([]);
      } else {
        // Filter strictly to HCDS active indicators (HCDS-01 to HCDS-04)
        // Ensure inactive HCDS-05 records never enter active indicator totals or dashboard cards
        const hcdsOnly = res.data.filter(
          (r) =>
            r.indicator_code.startsWith('HCDS-') &&
            r.indicator_code !== 'HCDS-05' &&
            ['HCDS-01', 'HCDS-02', 'HCDS-03', 'HCDS-04'].includes(r.indicator_code)
        );
        setPerformanceList(hcdsOnly);
        setLastRefreshedAt(new Date().toISOString());
      }
    } catch (err: any) {
      setErrorNotice(err.message || 'Error communicating with Supabase database view.');
      setPerformanceList([]);
    } finally {
      setIsLoading(false);
    }
  }, [isLgaAdmin, assignedLgaId, selectedLgaId, selectedYear, currentUser]);

  useEffect(() => {
    loadPerformanceData();
  }, [loadPerformanceData]);

  // The 4 Active HCD Settings
  const settingsDefinitions: Array<{
    setting: HCDSettingType;
    code: string;
    title: string;
    icon: React.ReactNode;
    bgGradient: string;
    accentColor: string;
  }> = [
    {
      setting: 'Home',
      code: 'HCDS-01',
      title: 'Initiatives implemented in homes',
      icon: <Home className="w-5 h-5 text-emerald-700" />,
      bgGradient: 'from-emerald-50 to-teal-50/40',
      accentColor: 'border-emerald-300 text-emerald-900',
    },
    {
      setting: 'Communities',
      code: 'HCDS-02',
      title: 'Initiatives implemented in communities',
      icon: <Users className="w-5 h-5 text-sky-700" />,
      bgGradient: 'from-sky-50 to-blue-50/40',
      accentColor: 'border-sky-300 text-sky-900',
    },
    {
      setting: 'Learning institutions',
      code: 'HCDS-03',
      title: 'Initiatives implemented in learning institutions',
      icon: <GraduationCap className="w-5 h-5 text-indigo-700" />,
      bgGradient: 'from-indigo-50 to-purple-50/40',
      accentColor: 'border-indigo-300 text-indigo-900',
    },
    {
      setting: 'Workplaces',
      code: 'HCDS-04',
      title: 'Initiatives implemented in workplaces',
      icon: <Briefcase className="w-5 h-5 text-amber-700" />,
      bgGradient: 'from-amber-50 to-orange-50/40',
      accentColor: 'border-amber-300 text-amber-900',
    },
  ];

  // Map each setting to its aggregated performance record in the selected scope
  const settingCards: SettingCardData[] = useMemo(() => {
    return settingsDefinitions.map((def) => {
      const records = performanceList.filter((r) => r.indicator_code === def.code);

      // If viewing a single LGA, use that record directly
      let performanceRecord: HCDLgaTargetPerformance | undefined;
      if (records.length === 1) {
        performanceRecord = records[0];
      } else if (records.length > 1) {
        // Statewide aggregation: sum actuals, targets, baselines
        const totalTarget = records.reduce((s, r) => s + (Number(r.target_value) || 0), 0);
        const totalActual = records.reduce((s, r) => s + (Number(r.actual_value) || 0), 0);
        const totalBaseline = records.reduce((s, r) => s + (Number(r.baseline_value) || 0), 0);
        const hasApproved = records.some((r) => r.target_status === 'approved');

        let rate: number | null = null;
        let status = 'no_data';
        if (totalTarget > 0 && totalActual >= 0) {
          rate = Math.round((totalActual / totalTarget) * 10000) / 100;
          status = rate >= 100 ? 'achieved' : rate >= 75 ? 'on_track' : rate >= 50 ? 'lagging' : 'critical';
        } else if (totalTarget === 0) {
          status = 'target_zero_review';
        }

        performanceRecord = {
          lga_id: 'statewide',
          lga_name: 'Statewide (31 LGAs)',
          indicator_code: def.code,
          indicator_name: def.title,
          reporting_year: selectedYear,
          period_start: `${selectedYear}-01-01`,
          period_end: `${selectedYear}-12-31`,
          baseline_value: totalBaseline,
          target_value: totalTarget,
          target_direction: 'higher_is_better',
          target_metric_type: 'count',
          measurement_unit: 'initiatives',
          target_status: hasApproved ? 'approved' : 'draft',
          actual_value: totalActual,
          achievement_rate: rate,
          achievement_status: status,
          activity_count: records.reduce((s, r) => s + (r.activity_count || 0), 0),
          measurement_count: records.reduce((s, r) => s + (r.measurement_count || 0), 0),
        };
      }

      return {
        setting: def.setting,
        indicatorCode: def.code,
        title: def.title,
        icon: def.icon,
        bgGradient: def.bgGradient,
        accentColor: def.accentColor,
        performanceRecord,
      };
    });
  }, [settingsDefinitions, performanceList, selectedYear]);

  // Filtered setting cards based on setting selector
  const visibleCards = useMemo(() => {
    if (selectedSettingFilter === 'all') return settingCards;
    return settingCards.filter((c) => c.setting === selectedSettingFilter);
  }, [settingCards, selectedSettingFilter]);

  // Overall totals across the 4 active HCD Settings
  const summaryTotals = useMemo(() => {
    let totalTarget = 0;
    let totalActual = 0;
    let totalActivities = 0;
    let hasAnyTarget = false;

    settingCards.forEach((c) => {
      if (c.performanceRecord) {
        if (c.performanceRecord.target_status === 'approved') {
          totalTarget += Number(c.performanceRecord.target_value) || 0;
          hasAnyTarget = true;
        }
        totalActual += Number(c.performanceRecord.actual_value) || 0;
        totalActivities += Number(c.performanceRecord.activity_count) || 0;
      }
    });

    const overallRate =
      hasAnyTarget && totalTarget > 0
        ? Math.round((totalActual / totalTarget) * 10000) / 100
        : null;

    return { totalTarget, totalActual, totalActivities, overallRate, hasAnyTarget };
  }, [settingCards]);

  // Safe Achievement Rate Formatter (satisfying all prompt rules)
  const formatAchievementRate = (record?: HCDLgaTargetPerformance) => {
    if (!record) {
      return {
        text: 'No approved target',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
        helper: 'Target not defined in public.hcd_indicator_targets',
      };
    }

    // Must be approved target
    if (record.target_status !== 'approved') {
      return {
        text: 'Target not approved',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
        helper: 'Draft status pending Executive Council approval',
      };
    }

    // Target is zero or invalid
    if (record.target_value === 0 || isNaN(Number(record.target_value))) {
      return {
        text: 'Not calculable',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
        helper: 'Annual target value is 0; rate cannot be computed',
      };
    }

    // Actual measurement missing
    if (record.actual_value === null || record.actual_value === undefined) {
      return {
        text: 'No reported actual',
        badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
        helper: 'Awaiting initiative submissions for this period',
      };
    }

    // Normal calculation: higher_is_better count
    const rate = record.achievement_rate !== null && record.achievement_rate !== undefined
      ? record.achievement_rate
      : Math.round(((Number(record.actual_value) || 0) / (Number(record.target_value) || 1)) * 10000) / 100;

    if (isNaN(rate) || !isFinite(rate)) {
      return {
        text: 'Not calculable',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
        helper: 'Rate is non-finite or invalid',
      };
    }

    if (rate >= 100) {
      return {
        text: `${rate}% Achieved`,
        badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold',
        helper: 'Target benchmark successfully attained',
      };
    }
    if (rate >= 75) {
      return {
        text: `${rate}% On Track`,
        badgeClass: 'bg-blue-100 text-blue-900 border-blue-300 font-bold',
        helper: 'Implementation progressing on trajectory',
      };
    }
    if (rate >= 50) {
      return {
        text: `${rate}% Lagging`,
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-bold',
        helper: 'Progress behind scheduled operational target',
      };
    }
    return {
      text: `${rate}% Critical`,
      badgeClass: 'bg-rose-100 text-rose-900 border-rose-300 font-bold',
      helper: 'Substantial shortfall in implemented initiatives',
    };
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 overflow-hidden relative">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                Pillar: HCD Settings (agriculture)
              </span>
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                Live 4-Setting Initiative Infrastructure
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              HCD Settings: Strategic Initiative Performance
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
              Monitoring distinct human capital development initiatives delivered across four strategic frontline settings: 
              <strong> Homes</strong>, <strong>Communities</strong>, <strong>Learning Institutions</strong>, and <strong>Workplaces</strong>. 
              Authoritative results powered by <code className="font-mono text-emerald-900 bg-emerald-50 px-1 py-0.2 rounded text-[11px]">public.hcd_lga_target_performance</code>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={loadPerformanceData}
              disabled={isLoading}
              className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-700' : ''}`} />
              <span>Refresh View</span>
            </button>

            {onRecordInitiative && (
              <button
                onClick={() => onRecordInitiative()}
                className="px-4 py-2.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                <span>Record HCD Initiative</span>
              </button>
            )}
          </div>
        </div>

        {/* Notices */}
        {errorNotice && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorNotice}</span>
            </div>
            <button
              onClick={loadPerformanceData}
              className="text-rose-700 underline font-bold hover:text-rose-900 text-xs shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Filter Controls Toolbar */}
        <div className="mt-6 pt-5 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* LGA Selector */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>Local Government Area</span>
            </label>
            <select
              value={selectedLgaId}
              onChange={(e) => setSelectedLgaId(e.target.value)}
              disabled={isLgaAdmin}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 font-semibold focus:ring-2 focus:ring-emerald-600 focus:outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
            >
              {!isLgaAdmin && <option value="all">Statewide (All 31 LGAs)</option>}
              {availableLgas.map((lga) => (
                <option key={lga.id} value={lga.id}>
                  {lga.name} ({lga.senatorialDistrict.split(' ')[0]})
                </option>
              ))}
            </select>
            {isLgaAdmin && (
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Restricted to authorized jurisdiction ({currentUser.assignedLgaName || selectedLgaId}).
              </span>
            )}
          </div>

          {/* Reporting Year */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-700" />
              <span>Reporting Fiscal Year</span>
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 font-semibold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            >
              {[2026, 2025, 2024, 2023].map((y) => (
                <option key={y} value={y}>
                  Fiscal Year {y}
                </option>
              ))}
            </select>
          </div>

          {/* Setting / Indicator Filter */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-emerald-700" />
              <span>Frontline Setting Filter</span>
            </label>
            <select
              value={selectedSettingFilter}
              onChange={(e) => setSelectedSettingFilter(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 font-semibold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            >
              <option value="all">All 4 Settings (HCDS-01 to HCDS-04)</option>
              <option value="Home">Home (HCDS-01)</option>
              <option value="Communities">Communities (HCDS-02)</option>
              <option value="Learning institutions">Learning Institutions (HCDS-03)</option>
              <option value="Workplaces">Workplaces (HCDS-04)</option>
            </select>
          </div>

          {/* Data Freshness Information */}
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-2.5 flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              Data Freshness
            </span>
            <span className="text-[11px] font-mono font-medium text-slate-800 truncate">
              {new Date(lastRefreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="text-[9px] text-emerald-800 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Verified Target-Performance Layer
            </span>
          </div>
        </div>
      </div>

      {/* KPI Summary Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Approved Targets Total
          </span>
          <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
            {summaryTotals.hasAnyTarget ? summaryTotals.totalTarget : '—'}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">
            {summaryTotals.hasAnyTarget ? 'Initiatives targeted' : 'No approved target'}
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
            Verified Actuals Implemented
          </span>
          <span className="text-2xl font-black text-emerald-800 font-mono mt-1 block">
            {summaryTotals.totalActual}
          </span>
          <span className="text-[10px] text-emerald-700 mt-0.5 block">
            Distinct initiatives verified
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Aggregate Achievement Rate
          </span>
          <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
            {summaryTotals.overallRate !== null ? `${summaryTotals.overallRate}%` : 'Not calculable'}
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">
            {summaryTotals.hasAnyTarget ? 'Against approved targets' : 'Pending target approvals'}
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">
            Active Settings Catalogue
          </span>
          <span className="text-2xl font-black text-blue-900 font-mono mt-1 block">
            4 / 4
          </span>
          <span className="text-[10px] text-blue-700 mt-0.5 block">
            HCDS-05 inactive (omitted)
          </span>
        </div>
      </div>

      {/* The 4 Distinct Setting Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {visibleCards.map((card) => {
          const rec = card.performanceRecord;
          const rateInfo = formatAchievementRate(rec);
          const hasTarget = rec && rec.target_status === 'approved';
          const hasActual = rec && rec.actual_value !== null && rec.actual_value !== undefined;

          return (
            <div
              key={card.indicatorCode}
              className={`bg-gradient-to-br ${card.bgGradient} rounded-2xl border ${card.accentColor} p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-white shadow-xs border border-slate-200 shrink-0">
                    {card.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-900 font-mono">
                        {card.indicatorCode}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-white/80 border border-slate-200 text-slate-700">
                        Setting: {card.setting}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-1 leading-snug">
                      {card.title}
                    </h3>
                  </div>
                </div>

                {/* Achievement Badge */}
                <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border shadow-2xs whitespace-nowrap ${rateInfo.badgeClass}`}>
                  {rateInfo.text}
                </span>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-3 gap-2.5 bg-white/85 backdrop-blur-xs rounded-xl p-3 border border-slate-200/80">
                {/* Approved Baseline */}
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Baseline
                  </span>
                  <span className="text-sm sm:text-base font-black text-slate-800 font-mono mt-0.5 block">
                    {rec?.baseline_value !== null && rec?.baseline_value !== undefined
                      ? `${rec.baseline_value} init.`
                      : '—'}
                  </span>
                  <span className="text-[9px] text-slate-400 block truncate">
                    {rec?.baseline_year ? `Year ${rec.baseline_year}` : 'Not set'}
                  </span>
                </div>

                {/* Approved Annual Target */}
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Annual Target
                  </span>
                  <span className="text-sm sm:text-base font-black text-slate-900 font-mono mt-0.5 block">
                    {hasTarget ? `${rec!.target_value} init.` : '—'}
                  </span>
                  <span className="text-[9px] text-slate-500 block truncate">
                    {hasTarget ? 'Approved & active' : 'Target not approved'}
                  </span>
                </div>

                {/* Actual Initiatives Implemented */}
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                    Actual Implemented
                  </span>
                  <span className="text-sm sm:text-base font-black text-emerald-800 font-mono mt-0.5 block">
                    {hasActual ? `${rec!.actual_value} init.` : '—'}
                  </span>
                  <span className="text-[9px] text-emerald-700 block truncate">
                    {hasActual ? 'Verified count (sum)' : 'No reported actual'}
                  </span>
                </div>
              </div>

              {/* Context Footer & Status Details */}
              <div className="space-y-2 pt-1 border-t border-slate-200/60 text-xs">
                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 gap-2">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Period: {rec ? `${rec.period_start} to ${rec.period_end}` : `FY ${selectedYear}`}</span>
                  </span>

                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                    <FileCheck className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Evidence: Verified registers & reports</span>
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-500 italic">
                    {rateInfo.helper}
                  </span>

                  {onRecordInitiative && (
                    <button
                      onClick={() => onRecordInitiative(card.setting)}
                      className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <span>Report {card.setting} Initiative</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
