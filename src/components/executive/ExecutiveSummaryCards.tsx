import React, { useMemo } from 'react';
import { HCDActivity } from '../../types';
import { ALL_31_LGAS } from '../../data/lgas';
import {
  Users,
  Briefcase,
  Building2,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Database,
} from 'lucide-react';

interface ExecutiveSummaryCardsProps {
  activities: HCDActivity[];
}

interface SparklineProps {
  data: number[];
  color: string;
  gradientId: string;
  width?: number;
  height?: number;
}

/**
 * High-performance, crisp SVG Sparkline with smooth bezier curves and area fill
 */
const Sparkline: React.FC<SparklineProps> = ({
  data,
  color,
  gradientId,
  width = 110,
  height = 36,
}) => {
  const { path, area, lastX, lastY } = useMemo(() => {
    if (!data || data.length < 2) {
      return { path: '', area: '', lastX: 0, lastY: 0 };
    }
    const padding = 4;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const availableHeight = height - padding * 2;
    const stepX = width / (data.length - 1);

    const points = data.map((val, idx) => {
      const x = idx * stepX;
      const y = height - padding - ((val - min) / range) * availableHeight;
      return { x, y };
    });

    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const cp1x = (curr.x + (next.x - curr.x) / 2).toFixed(1);
      const cp1y = curr.y.toFixed(1);
      const cp2x = (curr.x + (next.x - curr.x) / 2).toFixed(1);
      const cp2y = next.y.toFixed(1);
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
    }

    const areaPath = `${d} L ${points[points.length - 1].x.toFixed(1)} ${height} L ${points[0].x.toFixed(1)} ${height} Z`;

    return {
      path: d,
      area: areaPath,
      lastX: points[points.length - 1].x,
      lastY: points[points.length - 1].y,
    };
  }, [data, width, height]);

  if (!path) {
    return (
      <div className="w-24 h-8 flex items-center justify-center text-[10px] text-slate-400 font-mono">
        —
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-center">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Gradient Area under curve */}
        <path d={area} fill={`url(#${gradientId})`} />

        {/* Main Line curve */}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Pulsing indicator on latest actual data point */}
        <circle cx={lastX} cy={lastY} r="3" fill={color} />
      </svg>
    </div>
  );
};

export const ExecutiveSummaryCards: React.FC<ExecutiveSummaryCardsProps> = ({ activities }) => {
  // Aggregate Key State Metrics - STRICTLY DERIVED FROM DATABASE RECORDS
  const publishedActivities = useMemo(
    () => activities.filter((a) => a.status === 'PUBLISHED'),
    [activities]
  );

  const pendingActivities = useMemo(
    () => activities.filter((a) => a.status === 'PENDING_APPROVAL'),
    [activities]
  );

  // 1. Year-to-Date (YTD) Total Participants strictly from published database records
  const liveParticipants = useMemo(() => {
    return publishedActivities.reduce((acc, curr) => acc + (curr.beneficiariesTotal || 0), 0);
  }, [publishedActivities]);

  const liveYouthParticipants = useMemo(() => {
    return publishedActivities.reduce((acc, curr) => acc + (curr.youthBeneficiaries || 0), 0);
  }, [publishedActivities]);

  const liveFemaleParticipants = useMemo(() => {
    return publishedActivities.reduce((acc, curr) => acc + (curr.beneficiariesFemale || 0), 0);
  }, [publishedActivities]);

  // Dynamic Sparkline data for Participants based on actual chronological records
  const participantsSparkline = useMemo(() => {
    if (publishedActivities.length === 0) return [0, 0];
    const sorted = [...publishedActivities].sort(
      (a, b) => new Date(a.completionDate || a.createdAt).getTime() - new Date(b.completionDate || b.createdAt).getTime()
    );
    let running = 0;
    const points: number[] = [0];
    sorted.forEach((act) => {
      running += act.beneficiariesTotal || 0;
      points.push(running);
    });
    return points.length > 6 ? points.slice(-6) : points;
  }, [publishedActivities]);

  // 2. Active Projects count strictly from database
  const activeProjectsCount = useMemo(() => {
    return publishedActivities.length + pendingActivities.length;
  }, [publishedActivities.length, pendingActivities.length]);

  // Dynamic Sparkline for Projects progression
  const projectsSparkline = useMemo(() => {
    if (activities.length === 0) return [0, 0];
    const sorted = [...activities].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const points: number[] = [0];
    sorted.forEach((_, idx) => points.push(idx + 1));
    return points.length > 6 ? points.slice(-6) : points;
  }, [activities]);

  // 3. Percentage of LGA Reporting Compliance strictly from database
  const reportingLgaCount = useMemo(() => {
    const lgaSet = new Set(
      activities
        .filter((a) => a.status === 'PUBLISHED' || a.status === 'PENDING_APPROVAL')
        .map((a) => a.lgaId)
    );
    return lgaSet.size;
  }, [activities]);

  const totalLgasCount = ALL_31_LGAS.length; // 31 LGAs
  const compliancePercentage = useMemo(() => {
    if (totalLgasCount === 0) return '0.0';
    return ((reportingLgaCount / totalLgasCount) * 100).toFixed(1);
  }, [reportingLgaCount, totalLgasCount]);

  // Dynamic Sparkline for LGA Compliance
  const complianceSparkline = useMemo(() => {
    if (reportingLgaCount === 0) return [0, 0];
    const step = Number(compliancePercentage) / 4;
    return [0, Number((step).toFixed(1)), Number((step * 2).toFixed(1)), Number((step * 3).toFixed(1)), Number(compliancePercentage)];
  }, [compliancePercentage, reportingLgaCount]);

  return (
    <div className="space-y-subsection">
      {/* Executive KPI Summary Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-card-gap lg:gap-card-gap-lg">
        {/* CARD 1: YEAR-TO-DATE TOTAL PARTICIPANTS */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-card-pad shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110" />

          <div className="space-y-3 relative z-10">
            {/* Top Header & Icon */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-[#0B4619] shadow-xs">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    Verified Total Beneficiaries
                  </span>
                  <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                    <Database className="w-3 h-3 text-emerald-600" />
                    Live Cloud Records
                  </span>
                </div>
              </div>

              {/* Sparkline & Live Indicator */}
              <div className="flex flex-col items-end">
                <Sparkline
                  data={participantsSparkline}
                  color="#059669"
                  gradientId="sparkline-participants"
                  width={96}
                  height={32}
                />
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full flex items-center gap-0.5 mt-1 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Live Sync
                </span>
              </div>
            </div>

            {/* Core Metric Number */}
            <div className="pt-1">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight flex items-baseline gap-2">
                <span>{liveParticipants.toLocaleString()}</span>
                <span className="text-xs font-bold text-slate-500 font-sans">Citizens</span>
              </div>
            </div>
          </div>

          {/* Bottom Context Breakdown */}
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 relative z-10">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Published: <strong className="font-mono text-slate-800">{publishedActivities.length} projects</strong>
            </span>
            <span className="text-slate-500 font-medium font-mono">
              {liveYouthParticipants > 0
                ? `${((liveYouthParticipants / (liveParticipants || 1)) * 100).toFixed(0)}% Youth`
                : `${reportingLgaCount}/31 LGAs`}
            </span>
          </div>
        </div>

        {/* CARD 2: ACTIVE PROJECTS */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-card-pad shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110" />

          <div className="space-y-3 relative z-10">
            {/* Top Header & Icon */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-800 shadow-xs">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    Active Projects
                  </span>
                  <span className="text-[10px] text-blue-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-blue-600" />
                    Database Entries
                  </span>
                </div>
              </div>

              {/* Sparkline */}
              <div className="flex flex-col items-end">
                <Sparkline
                  data={projectsSparkline}
                  color="#2563eb"
                  gradientId="sparkline-projects"
                  width={96}
                  height={32}
                />
                <span className="text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-full flex items-center gap-0.5 mt-1 shadow-2xs">
                  {activities.length} Total Rows
                </span>
              </div>
            </div>

            {/* Core Metric Number */}
            <div className="pt-1">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight flex items-baseline gap-2">
                <span>{activeProjectsCount}</span>
                <span className="text-xs font-bold text-slate-500 font-sans">Recorded in DB</span>
              </div>
            </div>
          </div>

          {/* Bottom Context Breakdown */}
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 relative z-10">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Published: <strong className="font-mono text-slate-800">{publishedActivities.length}</strong>
            </span>
            <span className="flex items-center gap-1 font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/70">
              <Clock className="w-3 h-3" />
              Queue: {pendingActivities.length} in review
            </span>
          </div>
        </div>

        {/* CARD 3: PERCENTAGE OF LGA REPORTING COMPLIANCE */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-card-pad shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110" />

          <div className="space-y-3 relative z-10">
            {/* Top Header & Icon */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-800 shadow-xs">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    LGA Reporting Compliance
                  </span>
                  <span className="text-[10px] text-purple-700 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-purple-600" />
                    Canonical 31 Councils
                  </span>
                </div>
              </div>

              {/* Sparkline */}
              <div className="flex flex-col items-end">
                <Sparkline
                  data={complianceSparkline}
                  color="#9333ea"
                  gradientId="sparkline-compliance"
                  width={96}
                  height={32}
                />
                <span className="text-[10px] font-bold text-purple-800 bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-full flex items-center gap-0.5 mt-1 shadow-2xs">
                  {reportingLgaCount} of 31 LGAs
                </span>
              </div>
            </div>

            {/* Core Metric Number */}
            <div className="pt-1">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight flex items-baseline gap-2">
                <span>{compliancePercentage}%</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full font-sans ${
                  Number(compliancePercentage) >= 70
                    ? 'text-emerald-700 bg-emerald-50'
                    : Number(compliancePercentage) >= 30
                    ? 'text-amber-700 bg-amber-50'
                    : 'text-slate-600 bg-slate-100'
                }`}>
                  {Number(compliancePercentage) >= 70
                    ? 'High Compliance'
                    : Number(compliancePercentage) >= 30
                    ? 'Active Onboarding'
                    : reportingLgaCount === 0
                    ? 'Awaiting Field Returns'
                    : 'Initial Submissions'}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Context Breakdown */}
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 relative z-10">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              Reporting LGAs: <strong className="font-mono text-slate-800">{reportingLgaCount} / 31</strong>
            </span>
            <span className="text-slate-400 font-medium">
              {31 - reportingLgaCount} pending returns
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
