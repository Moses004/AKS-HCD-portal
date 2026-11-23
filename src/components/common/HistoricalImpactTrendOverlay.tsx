import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  X,
  Calendar,
  Layers,
  Activity,
} from 'lucide-react';
import { HCDActivity } from '../../types';
import { useData } from '../../context/DataContext';
import { KINETIC_EASE } from './MotionPrimitives';

export type TrendFocusMetric = 'activities' | 'beneficiaries' | 'lgaCoverage';

export interface HistoricalImpactTrendOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  activities: HCDActivity[];
  initialMetric?: TrendFocusMetric;
  allowAllStatuses?: boolean;
  scopeTitle?: string;
}

interface MonthlyTrendPoint {
  monthKey: string;
  label: string;
  activities: number;
  cumulativeActivities: number;
  beneficiaries: number;
  cumulativeBeneficiaries: number;
  budgetMillions: number;
  cumulativeLgas: number;
  monthlyLgas: number;
  momActivitiesPct: number | null;
  momBeneficiariesPct: number | null;
}

const formatDeltaPct = (pct: number | null): string => {
  if (pct === null || !Number.isFinite(pct)) return 'Baseline';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}% MoM`;
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: MonthlyTrendPoint }>;
  metric: TrendFocusMetric;
  mode: 'mom' | 'cumulative';
}

const ExecutiveTrendTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  metric,
  mode,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0]?.payload;
  if (!pt) return null;

  const activeMomPct =
    metric === 'beneficiaries' ? pt.momBeneficiariesPct : pt.momActivitiesPct;

  return (
    <div className="bg-white/98 backdrop-blur-md border border-[#E5E2D9] rounded-xl shadow-lg shadow-emerald-950/12 p-3.5 min-w-[228px] text-xs">
      <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-[#ECE8DD]">
        <span className="font-display font-bold text-slate-950 text-sm">
          {pt.label}
        </span>
        <span
          className={`font-mono tabular-nums font-bold text-[11px] ${
            activeMomPct === null
              ? 'text-slate-500'
              : activeMomPct > 0
              ? 'text-[#0B4619]'
              : activeMomPct < 0
              ? 'text-amber-700'
              : 'text-slate-600'
          }`}
        >
          {formatDeltaPct(activeMomPct)}
        </span>
      </div>

      <div className="space-y-1.5 font-mono tabular-nums">
        <div className="flex items-center justify-between gap-4">
          <span className="font-sans text-slate-500">Capacity Activities</span>
          <span className="font-bold text-[#0B4619]">
            {mode === 'cumulative'
              ? `${pt.cumulativeActivities} total (${pt.activities} new)`
              : `${pt.activities} activities`}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="font-sans text-slate-500">Beneficiaries</span>
          <span className="font-bold text-slate-900">
            {mode === 'cumulative'
              ? pt.cumulativeBeneficiaries.toLocaleString()
              : pt.beneficiaries.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="font-sans text-slate-500">LGA Reach</span>
          <span className="font-semibold text-slate-800">
            {pt.cumulativeLgas} / 31 LGAs
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 pt-1.5 mt-1 border-t border-[#ECE8DD]">
          <span className="font-sans text-slate-500">Monthly Capital</span>
          <span className="font-bold text-[#9A7410]">
            ₦{pt.budgetMillions.toFixed(1)}M
          </span>
        </div>
      </div>
    </div>
  );
};

export const HistoricalImpactTrendOverlay: React.FC<HistoricalImpactTrendOverlayProps> = ({
  isOpen,
  onClose,
  activities,
  initialMetric = 'activities',
  allowAllStatuses = false,
  scopeTitle = 'Akwa Ibom State · 31 Local Government Areas',
}) => {
  const { pillars } = useData();
  const prefersReduced = useReducedMotion();

  const [metric, setMetric] = useState<TrendFocusMetric>(initialMetric);
  const [trajectoryMode, setTrajectoryMode] = useState<'mom' | 'cumulative'>('mom');
  const [selectedPillar, setSelectedPillar] = useState<string>('all');
  const [statusScope, setStatusScope] = useState<'published' | 'all'>('published');

  // Sync initial metric when reopened from a specific KPI card
  useEffect(() => {
    if (isOpen) {
      setMetric(initialMetric);
    }
  }, [isOpen, initialMetric]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Build chronological month-over-month time series strictly from actual activity records
  const trendData: MonthlyTrendPoint[] = useMemo(() => {
    const filtered = activities.filter((act) => {
      if (statusScope === 'published' && act.status !== 'PUBLISHED') return false;
      if (selectedPillar !== 'all' && act.pillar !== selectedPillar) return false;
      return true;
    });

    if (filtered.length === 0) return [];

    const buckets = new Map<string, { label: string; items: HCDActivity[] }>();

    for (const act of filtered) {
      const rawDate = act.completionDate || act.createdAt;
      if (!rawDate) continue;
      const parsed = new Date(rawDate);
      if (Number.isNaN(parsed.getTime())) continue;

      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const monthKey = `${year}-${month}`;
      const label = parsed.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      });

      const existing = buckets.get(monthKey);
      if (existing) {
        existing.items.push(act);
      } else {
        buckets.set(monthKey, { label, items: [act] });
      }
    }

    const sortedKeys = Array.from(buckets.keys()).sort();
    const seenLgas = new Set<string>();
    let cumulativeActivities = 0;
    let cumulativeBeneficiaries = 0;
    let prevActivities: number | null = null;
    let prevBeneficiaries: number | null = null;

    return sortedKeys.map((monthKey) => {
      const bucket = buckets.get(monthKey)!;
      const items = bucket.items;

      const monthlyActivities = items.length;
      const monthlyBeneficiaries = items.reduce(
        (sum, a) => sum + (a.beneficiariesTotal || 0),
        0
      );
      const monthlyBudgetM =
        items.reduce((sum, a) => sum + (a.budgetNgn || 0), 0) / 1_000_000;

      const monthLgaSet = new Set<string>();
      items.forEach((a) => {
        if (a.lgaId) {
          seenLgas.add(a.lgaId);
          monthLgaSet.add(a.lgaId);
        }
      });

      cumulativeActivities += monthlyActivities;
      cumulativeBeneficiaries += monthlyBeneficiaries;

      const momActivitiesPct =
        prevActivities !== null && prevActivities > 0
          ? ((monthlyActivities - prevActivities) / prevActivities) * 100
          : null;

      const momBeneficiariesPct =
        prevBeneficiaries !== null && prevBeneficiaries > 0
          ? ((monthlyBeneficiaries - prevBeneficiaries) / prevBeneficiaries) * 100
          : null;

      prevActivities = monthlyActivities;
      prevBeneficiaries = monthlyBeneficiaries;

      return {
        monthKey,
        label: bucket.label,
        activities: monthlyActivities,
        cumulativeActivities,
        beneficiaries: monthlyBeneficiaries,
        cumulativeBeneficiaries,
        budgetMillions: Number(monthlyBudgetM.toFixed(1)),
        cumulativeLgas: seenLgas.size,
        monthlyLgas: monthLgaSet.size,
        momActivitiesPct,
        momBeneficiariesPct,
      };
    });
  }, [activities, selectedPillar, statusScope]);

  // Active series keys & summary statistics
  const { primaryKey, secondaryKey, primaryName, secondaryName, stats, averageValue } =
    useMemo(() => {
      const pKey: keyof MonthlyTrendPoint =
        metric === 'activities'
          ? trajectoryMode === 'cumulative'
            ? 'cumulativeActivities'
            : 'activities'
          : metric === 'beneficiaries'
          ? trajectoryMode === 'cumulative'
            ? 'cumulativeBeneficiaries'
            : 'beneficiaries'
          : trajectoryMode === 'cumulative'
          ? 'cumulativeLgas'
          : 'monthlyLgas';

      const sKey: keyof MonthlyTrendPoint | null =
        trajectoryMode === 'mom' && metric === 'activities'
          ? 'cumulativeActivities'
          : trajectoryMode === 'mom' && metric === 'beneficiaries'
          ? 'cumulativeBeneficiaries'
          : null;

      const pName =
        metric === 'activities'
          ? trajectoryMode === 'cumulative'
            ? 'Cumulative Capacity Activities'
            : 'Monthly Capacity Activities'
          : metric === 'beneficiaries'
          ? trajectoryMode === 'cumulative'
            ? 'Cumulative Beneficiaries'
            : 'Monthly Beneficiaries'
          : trajectoryMode === 'cumulative'
          ? 'Cumulative LGAs Reached'
          : 'Active LGAs per Month';

      const sName =
        metric === 'activities'
          ? 'Cumulative Trajectory'
          : metric === 'beneficiaries'
          ? 'Cumulative Reach'
          : '';

      if (trendData.length === 0) {
        return {
          primaryKey: pKey,
          secondaryKey: sKey,
          primaryName: pName,
          secondaryName: sName,
          averageValue: 0,
          stats: {
            latestLabel: '—',
            latestVal: 0,
            momPct: null as number | null,
            peakLabel: '—',
            peakVal: 0,
            avgMonthly: 0,
          },
        };
      }

      const latest = trendData[trendData.length - 1];
      const values = trendData.map((d) => Number(d[pKey]) || 0);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;

      let peakPoint = trendData[0];
      let peakVal = Number(trendData[0][pKey]) || 0;
      for (const pt of trendData) {
        const v = Number(pt[pKey]) || 0;
        if (v >= peakVal) {
          peakVal = v;
          peakPoint = pt;
        }
      }

      const momPct =
        metric === 'beneficiaries'
          ? latest.momBeneficiariesPct
          : latest.momActivitiesPct;

      return {
        primaryKey: pKey,
        secondaryKey: sKey,
        primaryName: pName,
        secondaryName: sName,
        averageValue: Number(avg.toFixed(1)),
        stats: {
          latestLabel: latest.label,
          latestVal: Number(latest[pKey]) || 0,
          momPct,
          peakLabel: peakPoint.label,
          peakVal,
          avgMonthly: avg,
        },
      };
    }, [trendData, metric, trajectoryMode]);

  const formatMetricNumber = (val: number): string => {
    if (metric === 'lgaCoverage') return `${Math.round(val)} LGAs`;
    if (metric === 'beneficiaries') return Math.round(val).toLocaleString();
    return `${Number.isInteger(val) ? val : val.toFixed(1)}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="historical-impact-trend-title"
          initial={prefersReduced ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={prefersReduced ? { opacity: 0 } : { opacity: 0 }}
          transition={{ duration: 0.2, ease: KINETIC_EASE }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-[#051F0E]/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        >
          <motion.div
            initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: 0.24, ease: KINETIC_EASE }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl bg-white rounded-2xl border border-[#E5E2D9] shadow-2xl shadow-emerald-950/25 overflow-hidden my-auto max-h-[92vh] flex flex-col"
          >
            {/* Top Editorial Header */}
            <div className="px-6 py-5 bg-[#FAF8F2] border-b border-[#E5E2D9] flex items-start justify-between gap-4 shrink-0">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#0B4619]">
                  <Activity className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Historical Impact Trend</span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="text-slate-600">{scopeTitle}</span>
                </div>
                <h2
                  id="historical-impact-trend-title"
                  className="font-display text-xl sm:text-2xl font-bold text-slate-950 tracking-tight"
                >
                  Month-over-Month Capacity Building Growth
                </h2>
                <p className="text-xs sm:text-sm text-slate-600">
                  Track verified capacity building cadence, cumulative citizen reach, and council expansion across reporting periods.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close Historical Impact Trend overlay"
                className="p-2 rounded-xl bg-white border border-[#E5E2D9] text-slate-600 hover:text-slate-950 hover:border-[#0B4619]/40 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Interactive Filter & Metric Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Metric Segmented Control */}
                <div
                  role="group"
                  aria-label="Select trend metric"
                  className="inline-flex items-center p-1 bg-[#F3EFE4] rounded-xl border border-[#E5E2D9]"
                >
                  {(
                    [
                      { id: 'activities', label: 'Capacity Activities' },
                      { id: 'beneficiaries', label: 'Beneficiaries' },
                      { id: 'lgaCoverage', label: 'LGA Coverage' },
                    ] as const
                  ).map((tab) => {
                    const active = metric === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setMetric(tab.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-[#0B4619] text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-950'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Right Controls: Trajectory Mode, Pillar Filter, Status Scope */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div
                    role="group"
                    aria-label="Trajectory mode"
                    className="inline-flex items-center p-1 bg-[#F3EFE4] rounded-xl border border-[#E5E2D9]"
                  >
                    <button
                      type="button"
                      onClick={() => setTrajectoryMode('mom')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        trajectoryMode === 'mom'
                          ? 'bg-white text-[#0B4619] shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Month-over-Month
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrajectoryMode('cumulative')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        trajectoryMode === 'cumulative'
                          ? 'bg-white text-[#0B4619] shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Cumulative
                    </button>
                  </div>

                  <div className="relative flex items-center">
                    <Layers className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                    <select
                      aria-label="Filter by HCD pillar"
                      value={selectedPillar}
                      onChange={(e) => setSelectedPillar(e.target.value)}
                      className="pl-8 pr-7 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-[#E5E2D9] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B4619]/30 cursor-pointer"
                    >
                      <option value="all">All HCD Pillars</option>
                      {pillars.map((p) => (
                        <option key={p.pillar_code} value={p.pillar_code}>
                          {p.display_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {allowAllStatuses && (
                    <select
                      aria-label="Filter by publication status"
                      value={statusScope}
                      onChange={(e) =>
                        setStatusScope(e.target.value as 'published' | 'all')
                      }
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-[#E5E2D9] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B4619]/30 cursor-pointer"
                    >
                      <option value="published">Verified Published Only</option>
                      <option value="all">All Recorded Pipeline</option>
                    </select>
                  )}
                </div>
              </div>

              {/* 4-Column Executive Summary Strip (Single Elevation, Hairline Dividers) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-4 px-5 rounded-xl bg-[#FAF8F2] border border-[#ECE8DD] lg:divide-x lg:divide-[#E5E2D9]">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    Latest Period ({stats.latestLabel})
                  </span>
                  <div className="text-xl font-bold text-[#0B4619] font-mono tabular-nums">
                    {formatMetricNumber(stats.latestVal)}
                  </div>
                  <span className="text-[11px] text-slate-500 block">
                    {primaryName}
                  </span>
                </div>

                <div className="space-y-0.5 lg:pl-5">
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    Latest MoM Change
                  </span>
                  <div
                    className={`text-xl font-bold font-mono tabular-nums flex items-center gap-1.5 ${
                      stats.momPct === null
                        ? 'text-slate-700'
                        : stats.momPct > 0
                        ? 'text-[#0B4619]'
                        : stats.momPct < 0
                        ? 'text-amber-700'
                        : 'text-slate-700'
                    }`}
                  >
                    {stats.momPct !== null && stats.momPct > 0 && (
                      <TrendingUp className="w-4 h-4 shrink-0" />
                    )}
                    {stats.momPct !== null && stats.momPct < 0 && (
                      <TrendingDown className="w-4 h-4 shrink-0" />
                    )}
                    {(stats.momPct === null || stats.momPct === 0) && (
                      <Minus className="w-4 h-4 shrink-0 text-slate-400" />
                    )}
                    <span>
                      {stats.momPct === null
                        ? 'Baseline'
                        : `${stats.momPct > 0 ? '+' : ''}${stats.momPct.toFixed(1)}%`}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 block">
                    Compared to prior month
                  </span>
                </div>

                <div className="space-y-0.5 lg:pl-5">
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    Peak Delivery Month
                  </span>
                  <div className="text-xl font-bold text-slate-950 font-mono tabular-nums">
                    {formatMetricNumber(stats.peakVal)}
                  </div>
                  <span className="text-[11px] text-[#9A7410] font-semibold block">
                    Recorded in {stats.peakLabel}
                  </span>
                </div>

                <div className="space-y-0.5 lg:pl-5">
                  <span className="text-[11px] font-semibold text-slate-500 block">
                    Period Average ({trendData.length} mo)
                  </span>
                  <div className="text-xl font-bold text-slate-950 font-mono tabular-nums">
                    {formatMetricNumber(stats.avgMonthly)}
                  </div>
                  <span className="text-[11px] text-slate-500 block">
                    Mean monthly delivery pace
                  </span>
                </div>
              </div>

              {/* Recharts Month-over-Month Growth Line Chart */}
              <div className="rounded-xl border border-[#E5E2D9] bg-white p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-slate-800">
                    <Calendar className="w-3.5 h-3.5 text-[#0B4619]" />
                    <span>{primaryName}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-[#0B4619] rounded-full" />
                      <span>{primaryName}</span>
                    </span>
                    {secondaryKey && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3 h-0.5 bg-[#D4AF37] rounded-full" />
                        <span>{secondaryName} (Right Axis)</span>
                      </span>
                    )}
                    {trendData.length > 1 && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3 border-t border-dashed border-slate-400" />
                        <span>Period Mean</span>
                      </span>
                    )}
                  </div>
                </div>

                {trendData.length === 0 ? (
                  <div className="h-[290px] flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
                    <Calendar className="w-8 h-8 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-700">
                      No historical records match the active filter
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm">
                      Switch back to All HCD Pillars or include pending pipeline submissions to inspect historical growth across months.
                    </p>
                  </div>
                ) : (
                  <div className="h-[300px] sm:h-[330px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={trendData}
                        margin={{ top: 12, right: secondaryKey ? 16 : 12, left: 0, bottom: 4 }}
                      >
                        <defs>
                          <linearGradient id="histImpactAreaFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0B4619" stopOpacity={0.18} />
                            <stop offset="100%" stopColor="#0B4619" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>

                        <CartesianGrid
                          strokeDasharray="3 4"
                          vertical={false}
                          stroke="#ECE8DD"
                        />

                        <XAxis
                          dataKey="label"
                          tick={{ fill: '#475569', fontSize: 11 }}
                          axisLine={{ stroke: '#E5E2D9' }}
                          tickLine={false}
                          dy={6}
                        />

                        <YAxis
                          yAxisId="left"
                          tick={{ fill: '#475569', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          width={metric === 'beneficiaries' ? 56 : 40}
                          allowDecimals={false}
                          tickFormatter={(val: number) =>
                            val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(val)
                          }
                        />

                        {secondaryKey && (
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            tick={{ fill: '#9A7410', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            width={metric === 'beneficiaries' ? 56 : 40}
                            allowDecimals={false}
                            tickFormatter={(val: number) =>
                              val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(val)
                            }
                          />
                        )}

                        <Tooltip
                          content={
                            <ExecutiveTrendTooltip
                              metric={metric}
                              mode={trajectoryMode}
                            />
                          }
                        />

                        {trendData.length > 1 && averageValue > 0 && (
                          <ReferenceLine
                            yAxisId="left"
                            y={averageValue}
                            stroke="#94A3B8"
                            strokeDasharray="4 4"
                            strokeWidth={1.25}
                          />
                        )}

                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey={primaryKey}
                          fill="url(#histImpactAreaFill)"
                          stroke="none"
                          isAnimationActive={!prefersReduced}
                        />

                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey={primaryKey}
                          name={primaryName}
                          stroke="#0B4619"
                          strokeWidth={2.75}
                          dot={{
                            r: 4,
                            fill: '#FFFFFF',
                            stroke: '#0B4619',
                            strokeWidth: 2,
                          }}
                          activeDot={{
                            r: 6,
                            fill: '#D4AF37',
                            stroke: '#0B4619',
                            strokeWidth: 2,
                          }}
                          isAnimationActive={!prefersReduced}
                        />

                        {secondaryKey && (
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey={secondaryKey}
                            name={secondaryName}
                            stroke="#D4AF37"
                            strokeWidth={2}
                            strokeDasharray="5 4"
                            dot={{
                              r: 3,
                              fill: '#D4AF37',
                              stroke: '#FFFFFF',
                              strokeWidth: 1.5,
                            }}
                            activeDot={{
                              r: 5,
                              fill: '#D4AF37',
                              stroke: '#0B4619',
                              strokeWidth: 1.5,
                            }}
                            isAnimationActive={!prefersReduced}
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Compact Month-over-Month Audit Ledger Table */}
              {trendData.length > 0 && (
                <div className="rounded-xl border border-[#E5E2D9] overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#FAF8F2] border-b border-[#ECE8DD] flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">
                      Monthly Capacity Building Ledger
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                      {trendData.length} reporting {trendData.length === 1 ? 'month' : 'months'}
                    </span>
                  </div>
                  <div className="overflow-x-auto max-h-52">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 bg-white border-b border-[#ECE8DD] text-[11px] text-slate-500 font-semibold">
                        <tr>
                          <th className="py-2.5 px-4">Month</th>
                          <th className="py-2.5 px-4 text-right">Activities</th>
                          <th className="py-2.5 px-4 text-right">MoM Growth</th>
                          <th className="py-2.5 px-4 text-right">Beneficiaries</th>
                          <th className="py-2.5 px-4 text-right">Cumulative</th>
                          <th className="py-2.5 px-4 text-right">Capital</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1EDE2] font-mono tabular-nums">
                        {[...trendData].reverse().map((row) => (
                          <tr
                            key={row.monthKey}
                            className="hover:bg-[#FAF8F2]/80 transition-colors"
                          >
                            <td className="py-2.5 px-4 font-sans font-semibold text-slate-900 whitespace-nowrap">
                              {row.label}
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-[#0B4619]">
                              {row.activities}
                            </td>
                            <td
                              className={`py-2.5 px-4 text-right font-semibold ${
                                row.momActivitiesPct === null
                                  ? 'text-slate-400'
                                  : row.momActivitiesPct > 0
                                  ? 'text-[#0B4619]'
                                  : row.momActivitiesPct < 0
                                  ? 'text-amber-700'
                                  : 'text-slate-600'
                              }`}
                            >
                              {formatDeltaPct(row.momActivitiesPct)}
                            </td>
                            <td className="py-2.5 px-4 text-right text-slate-800">
                              {row.beneficiaries.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right text-slate-600">
                              {row.cumulativeActivities} acts ·{' '}
                              {row.cumulativeBeneficiaries.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right text-[#9A7410] font-semibold">
                              ₦{row.budgetMillions.toFixed(1)}M
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
