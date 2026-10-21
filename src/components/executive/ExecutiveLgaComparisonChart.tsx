import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ReferenceLine,
} from 'recharts';
import { ALL_31_LGAS, PILLARS } from '../../data/lgas';
import { useData } from '../../context/DataContext';
import { HCDActivity } from '../../types';
import {
  BarChart3,
  Award,
  Filter,
  ArrowUpDown,
  Users,
  Compass,
  Building2,
  TrendingUp,
  Layers,
  Sparkles,
  Info,
  Database,
} from 'lucide-react';

interface ExecutiveLgaComparisonChartProps {
  activities: HCDActivity[];
}

// Senatorial District Accent Colors & Config
const DISTRICT_COLORS: Record<string, { primary: string; hover: string; light: string; badge: string }> = {
  'Uyo (Akwa Ibom North-East)': {
    primary: '#0B4619', // AKS Forest Emerald
    hover: '#083312',
    light: '#ECFDF5',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  'Ikot Ekpene (Akwa Ibom North-West)': {
    primary: '#1D4ED8', // Royal Blue
    hover: '#1E40AF',
    light: '#EFF6FF',
    badge: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  'Eket (Akwa Ibom South)': {
    primary: '#D97706', // Gold Amber
    hover: '#B45309',
    light: '#FFFBEB',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
  },
};

export const ExecutiveLgaComparisonChart: React.FC<ExecutiveLgaComparisonChartProps> = ({
  activities,
}) => {
  const { pillars, getPillarDisplayName } = useData();
  // Filter and Sorting state
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [pillarFilter, setPillarFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | 'alphabetical'>('desc');
  const [displayLayout, setDisplayLayout] = useState<'horizontal' | 'vertical'>('horizontal');
  const [highlightTopCount, setHighlightTopCount] = useState<number>(31); // 31, 10, or 5
  const [metricType, setMetricType] = useState<'all' | 'youth' | 'female' | 'male'>('all');
  const [hoveredLga, setHoveredLga] = useState<string | null>(null);

  // Compute LGA data
  const lgaComparisonData = useMemo(() => {
    // Relevant activities: published capacity building initiatives
    const relevantActivities = activities.filter((act) => {
      // Must be published activity
      if (act.status !== 'PUBLISHED') return false;
      // Filter by pillar if set
      if (pillarFilter !== 'all' && act.pillar !== pillarFilter) return false;
      return true;
    });

    const results = ALL_31_LGAS.map((lga) => {
      const lgaActs = relevantActivities.filter((a) => a.lgaId === lga.id);

      const totalParticipants = lgaActs.reduce((acc, curr) => {
        if (metricType === 'youth') {
          return acc + (curr.youthBeneficiaries || 0);
        }
        if (metricType === 'female') {
          return acc + (curr.beneficiariesFemale || 0);
        }
        if (metricType === 'male') {
          return acc + (curr.beneficiariesMale || 0);
        }
        return acc + (curr.beneficiariesTotal || 0);
      }, 0);

      const totalBudget = lgaActs.reduce((acc, curr) => acc + (curr.budgetNgn || 0), 0);
      const projectCount = lgaActs.length;

      // Extract simplified senatorial district name for badge display
      let districtShort = 'Uyo';
      if (lga.senatorialDistrict.includes('Ikot Ekpene')) districtShort = 'Ikot Ekpene';
      else if (lga.senatorialDistrict.includes('Eket')) districtShort = 'Eket';

      return {
        id: lga.id,
        name: lga.name,
        fullName: `${lga.name} LGA`,
        senatorialDistrict: lga.senatorialDistrict,
        districtShort,
        population: lga.populationEstimate,
        participants: totalParticipants,
        projectCount,
        budgetNgn: totalBudget,
        budgetMillions: Number((totalBudget / 1_000_000).toFixed(1)),
        perCapitaCoverage: Number(
          ((totalParticipants / (lga.populationEstimate || 100000)) * 100).toFixed(2)
        ),
      };
    });

    // Apply district filtering
    let filtered = results;
    if (districtFilter !== 'all') {
      filtered = filtered.filter((item) => item.senatorialDistrict === districtFilter);
    }

    // Apply sorting
    if (sortOrder === 'desc') {
      filtered.sort((a, b) => b.participants - a.participants);
    } else if (sortOrder === 'asc') {
      filtered.sort((a, b) => a.participants - b.participants);
    } else if (sortOrder === 'alphabetical') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Top N slice if active
    if (highlightTopCount < 31) {
      filtered = filtered.slice(0, highlightTopCount);
    }

    return filtered;
  }, [activities, districtFilter, pillarFilter, sortOrder, displayLayout, highlightTopCount, metricType]);

  // Aggregate KPI summary - STRICTLY DERIVED FROM DATABASE RECORDS
  const summaryKpis = useMemo<{
    topLga: (typeof lgaComparisonData)[number] | null;
    runnerUp: (typeof lgaComparisonData)[number] | null;
    totalParticipants: number;
    avgParticipants: number;
    leadingDistrict: { name: string; total: number } | null;
    activeCount: number;
  }>(() => {
    // Only rank LGAs that actually have recorded participants/activities in the database
    const activeLgas = lgaComparisonData.filter((i) => i.participants > 0 || i.projectCount > 0);
    const allSorted = [...activeLgas].sort((a, b) => b.participants - a.participants);
    const topLga = allSorted.length > 0 ? allSorted[0] : null;
    const runnerUp = allSorted.length > 1 ? allSorted[1] : null;
    const totalParticipants = lgaComparisonData.reduce((acc, item) => acc + item.participants, 0);
    const activeCount = activeLgas.length;
    const avgParticipants = activeCount > 0
      ? Math.round(totalParticipants / activeCount)
      : 0;

    // Breakdown by Senatorial District derived only from active records
    const districtTotals: Record<string, number> = {};
    activeLgas.forEach((item) => {
      districtTotals[item.senatorialDistrict] = (districtTotals[item.senatorialDistrict] || 0) + item.participants;
    });

    let leadingDistrict: { name: string; total: number } | null = null;
    Object.entries(districtTotals).forEach(([name, sum]) => {
      if (!leadingDistrict || sum > leadingDistrict.total) {
        leadingDistrict = { name, total: sum };
      }
    });

    return {
      topLga,
      runnerUp,
      totalParticipants,
      avgParticipants,
      leadingDistrict,
      activeCount,
    };
  }, [lgaComparisonData]);

  // Find max participants to calculate ratio
  const maxParticipants = useMemo(() => {
    return Math.max(...lgaComparisonData.map((d) => d.participants), 1000);
  }, [lgaComparisonData]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Header with Title and Executive Context */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
              <BarChart3 className="w-5 h-5" />
            </span>
            <h3 className="text-base font-bold text-slate-900">
              31-LGA Capacity Building Participants Comparison
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
              Side-by-Side Regional Benchmark
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Side-by-side Recharts cross-council comparative evaluation of human capital participants across all 31 Local Government Areas. Identify top-performing regions, high-impact clusters, and capacity growth velocity.
          </p>
        </div>

        {/* Global Controls & Layout Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Layout Orientation */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setDisplayLayout('horizontal')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                displayLayout === 'horizontal'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Horizontal Bar View (Optimal for reading all 31 LGA names)"
            >
              Horizontal Rank
            </button>
            <button
              onClick={() => setDisplayLayout('vertical')}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                displayLayout === 'vertical'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Vertical Column View (Standard Column Chart)"
            >
              Vertical Columns
            </button>
          </div>

          {/* Sort Order Selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setSortOrder('desc')}
              className={`px-2 py-1 rounded-md font-medium transition-all ${
                sortOrder === 'desc'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Highest to Lowest"
            >
              Top First
            </button>
            <button
              onClick={() => setSortOrder('asc')}
              className={`px-2 py-1 rounded-md font-medium transition-all ${
                sortOrder === 'asc'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Lowest to Highest"
            >
              Bottom First
            </button>
            <button
              onClick={() => setSortOrder('alphabetical')}
              className={`px-2 py-1 rounded-md font-medium transition-all ${
                sortOrder === 'alphabetical'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="A-Z Alphabetical Order"
            >
              A–Z
            </button>
          </div>
        </div>
      </div>

      {/* KPI Performance Highlight Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Top Performing Region */}
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 border border-emerald-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-900 uppercase tracking-wider flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-emerald-700" />
              #1 Ranked Council
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
              summaryKpis.topLga ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-700'
            }`}>
              {summaryKpis.topLga ? 'Active Leader' : 'Awaiting Data'}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900">
              {summaryKpis.topLga ? summaryKpis.topLga.name : '—'}
            </span>
            <span className="text-xs font-mono font-bold text-emerald-800">
              {summaryKpis.topLga ? `${summaryKpis.topLga.participants.toLocaleString()} pts` : '0 pts'}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-emerald-800 flex items-center justify-between">
            <span>{summaryKpis.topLga ? `${summaryKpis.topLga.districtShort} District` : 'No database entry'}</span>
            <span className="font-semibold">{summaryKpis.topLga ? `${summaryKpis.topLga.projectCount} Projects` : '0 Projects'}</span>
          </div>
        </div>

        {/* Runner-Up Region */}
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/60 border border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-blue-900 uppercase tracking-wider flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-blue-700" />
              #2 Ranked Council
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
              summaryKpis.runnerUp ? 'bg-blue-200 text-blue-900' : 'bg-slate-200 text-slate-700'
            }`}>
              {summaryKpis.runnerUp ? 'Silver' : 'Awaiting Data'}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900">
              {summaryKpis.runnerUp ? summaryKpis.runnerUp.name : '—'}
            </span>
            <span className="text-xs font-mono font-bold text-blue-800">
              {summaryKpis.runnerUp ? `${summaryKpis.runnerUp.participants.toLocaleString()} pts` : '0 pts'}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-blue-800 flex items-center justify-between">
            <span>
              {summaryKpis.runnerUp
                ? `${summaryKpis.runnerUp.districtShort} District`
                : summaryKpis.activeCount === 1
                ? '1 council in DB'
                : 'No database entry'}
            </span>
            <span className="font-semibold">
              {summaryKpis.runnerUp ? `${summaryKpis.runnerUp.projectCount} Projects` : '0 Projects'}
            </span>
          </div>
        </div>

        {/* 31-LGA Mean Coverage */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-slate-600" />
              Reporting Mean
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-800">
              Active Mean
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900 font-mono">
              {summaryKpis.avgParticipants.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">pts / active LGA</span>
          </div>
          <div className="mt-0.5 text-[11px] text-slate-600 flex items-center justify-between">
            <span>Active Reach</span>
            <span className={`font-semibold ${summaryKpis.activeCount > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
              {summaryKpis.activeCount} / 31 LGAs
            </span>
          </div>
        </div>

        {/* Leading Senatorial District */}
        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-amber-700" />
              Top Senatorial Zone
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
              summaryKpis.leadingDistrict ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-700'
            }`}>
              {summaryKpis.leadingDistrict ? 'Regional Lead' : 'Awaiting Data'}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black text-slate-900 truncate" title={summaryKpis.leadingDistrict?.name || 'No data'}>
              {summaryKpis.leadingDistrict ? summaryKpis.leadingDistrict.name.split(' ')[0] : '—'}
            </span>
            <span className="text-xs font-mono font-bold text-amber-900">
              {summaryKpis.leadingDistrict ? `${summaryKpis.leadingDistrict.total.toLocaleString()} pts` : '0 pts'}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-amber-800 flex items-center justify-between">
            <span>Statewide Total</span>
            <span className="font-semibold text-slate-900 font-mono">
              {summaryKpis.totalParticipants.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Senatorial District Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-semibold text-slate-700">Senatorial District:</span>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-emerald-600 outline-none"
            >
              <option value="all">All 3 Senatorial Districts (31 LGAs)</option>
              <option value="Uyo (Akwa Ibom North-East)">Uyo Senatorial District (9 LGAs)</option>
              <option value="Ikot Ekpene (Akwa Ibom North-West)">Ikot Ekpene Senatorial District (10 LGAs)</option>
              <option value="Eket (Akwa Ibom South)">Eket Senatorial District (12 LGAs)</option>
            </select>
          </div>

          {/* Strategic Pillar Filter */}
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-semibold text-slate-700">HCD Pillar:</span>
            <select
              value={pillarFilter}
              onChange={(e) => setPillarFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-emerald-600 outline-none"
            >
              <option value="all">All Strategic Pillars</option>
              {pillars.map((pillar) => (
                <option key={pillar.pillar_code} value={pillar.pillar_code}>
                  {pillar.display_name}
                </option>
              ))}
            </select>
          </div>

          {/* Participant Scope */}
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-semibold text-slate-700">Metric Breakdown:</span>
            <select
              value={metricType}
              onChange={(e) => setMetricType(e.target.value as any)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium focus:ring-1 focus:ring-emerald-600 outline-none"
            >
              <option value="all">Total Participants (All Demographics)</option>
              <option value="youth">Youth Capacity Participants</option>
              <option value="female">Women & Female Participants</option>
              <option value="male">Male Participants</option>
            </select>
          </div>
        </div>

        {/* View Slice (All 31 vs Top 10 vs Top 5) */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
          <span className="text-[11px] font-semibold text-slate-500 px-2">Show:</span>
          <button
            onClick={() => setHighlightTopCount(31)}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
              highlightTopCount === 31 ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All 31 LGAs
          </button>
          <button
            onClick={() => setHighlightTopCount(10)}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
              highlightTopCount === 10 ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Top 10
          </button>
          <button
            onClick={() => setHighlightTopCount(5)}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
              highlightTopCount === 5 ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Top 5
          </button>
        </div>
      </div>

      {/* Visual Color Legend for Senatorial Districts */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-slate-700 text-[11px]">Regional Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#0B4619] shadow-xs inline-block" />
            <span className="text-slate-700 font-medium">Uyo District</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#1D4ED8] shadow-xs inline-block" />
            <span className="text-slate-700 font-medium">Ikot Ekpene District</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#D97706] shadow-xs inline-block" />
            <span className="text-slate-700 font-medium">Eket District</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-slate-500 text-[11px]">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>Showing {lgaComparisonData.length} of 31 LGA Councils</span>
        </div>
      </div>

      {/* Main Chart Canvas: Recharts BarChart or Database Empty State */}
      <div className="w-full">
        {summaryKpis.activeCount === 0 ? (
          <div className="py-16 px-6 text-center bg-slate-50/80 rounded-2xl border border-dashed border-slate-300 space-y-3">
            <Database className="w-12 h-12 text-slate-400 mx-auto" />
            <h4 className="text-base font-bold text-slate-800">
              No Activity Data Input to Database Yet
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              The 31-LGA Comparison Bar Chart strictly visualizes verified grassroots activities recorded in the cloud database. As LGA Desk Officers log activities or baseline records are seeded, they will sync here in real time.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-[11px] font-semibold text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>Real-Time Cloud Sync Active · Listening for inputs</span>
            </div>
          </div>
        ) : displayLayout === 'horizontal' ? (
          /* ========================================================= */
          /* HORIZONTAL BAR CHART: Best for side-by-side LGA ranking   */
          /* ========================================================= */
          <div
            style={{
              height: Math.max(520, lgaComparisonData.length * 28 + 80),
              width: '100%',
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={lgaComparisonData}
                layout="vertical"
                margin={{ top: 10, right: 35, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`)}
                  domain={[0, 'dataMax + 1000']}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#1E293B', fontWeight: 600 }}
                  width={110}
                  interval={0}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const districtColor =
                        DISTRICT_COLORS[data.senatorialDistrict]?.primary || '#0B4619';

                      return (
                        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 text-white rounded-xl p-3.5 shadow-2xl text-xs space-y-2 min-w-[240px]">
                          <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                            <div>
                              <span className="font-bold text-sm text-white flex items-center gap-1.5">
                                <Building2 className="w-4 h-4 text-emerald-400" />
                                {data.name} LGA
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                {data.senatorialDistrict}
                              </span>
                            </div>
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: districtColor }}
                            />
                          </div>

                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 flex items-center gap-1">
                                <Users className="w-3.5 h-3.5 text-emerald-400" />
                                Total Participants:
                              </span>
                              <span className="font-mono font-bold text-emerald-300 text-sm">
                                {data.participants.toLocaleString()}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Total Published Projects:</span>
                              <span className="font-bold text-slate-200">
                                {data.projectCount} Initiatives
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Capital Deployed:</span>
                              <span className="font-mono font-bold text-amber-300">
                                ₦ {data.budgetMillions}M
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Population Estimate:</span>
                              <span className="font-mono text-slate-300">
                                {data.population.toLocaleString()}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
                              <span className="text-slate-400">Coverage Intensity:</span>
                              <span className="font-mono text-emerald-400 font-bold">
                                {data.perCapitaCoverage}% of population
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine
                  x={summaryKpis.avgParticipants}
                  stroke="#EF4444"
                  strokeDasharray="4 4"
                  label={{
                    value: `Avg: ${summaryKpis.avgParticipants.toLocaleString()}`,
                    fill: '#DC2626',
                    fontSize: 10,
                    position: 'top',
                  }}
                />
                <Bar
                  dataKey="participants"
                  radius={[0, 6, 6, 0]}
                  barSize={16}
                  name="Capacity Building Participants"
                  animationDuration={700}
                >
                  {lgaComparisonData.map((entry, index) => {
                    const color =
                      DISTRICT_COLORS[entry.senatorialDistrict]?.primary || '#0B4619';
                    const isHovered = hoveredLga === entry.id;
                    return (
                      <Cell
                        key={`cell-${entry.id}`}
                        fill={color}
                        opacity={hoveredLga ? (isHovered ? 1 : 0.45) : 0.9}
                        onMouseEnter={() => setHoveredLga(entry.id)}
                        onMouseLeave={() => setHoveredLga(null)}
                        cursor="pointer"
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          /* ========================================================= */
          /* VERTICAL COLUMN CHART: Side-by-side vertical view         */
          /* ========================================================= */
          <div style={{ height: 480, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={lgaComparisonData}
                margin={{ top: 20, right: 25, left: 10, bottom: 75 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="name"
                  angle={-55}
                  textAnchor="end"
                  interval={0}
                  tick={{ fontSize: 10, fill: '#1E293B', fontWeight: 600 }}
                  height={75}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`)}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const districtColor =
                        DISTRICT_COLORS[data.senatorialDistrict]?.primary || '#0B4619';

                      return (
                        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 text-white rounded-xl p-3.5 shadow-2xl text-xs space-y-2 min-w-[240px]">
                          <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                            <div>
                              <span className="font-bold text-sm text-white flex items-center gap-1.5">
                                <Building2 className="w-4 h-4 text-emerald-400" />
                                {data.name} LGA
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                {data.senatorialDistrict}
                              </span>
                            </div>
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: districtColor }}
                            />
                          </div>

                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 flex items-center gap-1">
                                <Users className="w-3.5 h-3.5 text-emerald-400" />
                                Total Participants:
                              </span>
                              <span className="font-mono font-bold text-emerald-300 text-sm">
                                {data.participants.toLocaleString()}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Total Initiatives:</span>
                              <span className="font-bold text-slate-200">
                                {data.projectCount} Projects
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-400">Capital Deployed:</span>
                              <span className="font-mono font-bold text-amber-300">
                                ₦ {data.budgetMillions}M
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
                              <span className="text-slate-400">Coverage Intensity:</span>
                              <span className="font-mono text-emerald-400 font-bold">
                                {data.perCapitaCoverage}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine
                  y={summaryKpis.avgParticipants}
                  stroke="#EF4444"
                  strokeDasharray="4 4"
                  label={{
                    value: `State Avg: ${summaryKpis.avgParticipants.toLocaleString()}`,
                    fill: '#DC2626',
                    fontSize: 10,
                    position: 'top',
                  }}
                />
                <Bar
                  dataKey="participants"
                  radius={[4, 4, 0, 0]}
                  name="Participants"
                  animationDuration={700}
                >
                  {lgaComparisonData.map((entry) => {
                    const color =
                      DISTRICT_COLORS[entry.senatorialDistrict]?.primary || '#0B4619';
                    const isHovered = hoveredLga === entry.id;
                    return (
                      <Cell
                        key={`col-${entry.id}`}
                        fill={color}
                        opacity={hoveredLga ? (isHovered ? 1 : 0.45) : 0.9}
                        onMouseEnter={() => setHoveredLga(entry.id)}
                        onMouseLeave={() => setHoveredLga(null)}
                        cursor="pointer"
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Bottom Insights & Regional Performance Diagnostics - STRICTLY DATABASE GROUNDED */}
      {summaryKpis.activeCount === 0 ? (
        <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center space-y-1">
          <span className="text-xs font-bold text-slate-800 flex items-center justify-center gap-1.5">
            <Database className="w-4 h-4 text-emerald-700" />
            Awaiting Field Activities from 31 LGA Councils
          </span>
          <p className="text-[11px] text-slate-500 max-w-xl mx-auto">
            Analytical insights, high-performing clusters, and senatorial equity balance will synthesize dynamically once grassroots project data is submitted and approved.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          {/* Insight 1: Top LGA Velocity */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Reporting Leader</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              {summaryKpis.topLga ? (
                <>
                  <strong className="text-slate-900">{summaryKpis.topLga.name}</strong> leads currently reporting councils with{' '}
                  <strong className="font-mono text-emerald-800">{summaryKpis.topLga.participants.toLocaleString()}</strong> verified participants across {summaryKpis.topLga.projectCount} project(s)
                  {summaryKpis.runnerUp ? (
                    <>, followed by <strong>{summaryKpis.runnerUp.name}</strong> ({summaryKpis.runnerUp.participants.toLocaleString()} participants)</>
                  ) : (
                    <> (first council reporting in database)</>
                  )}.
                </>
              ) : (
                'No council data currently recorded.'
              )}
            </p>
          </div>

          {/* Insight 2: Senatorial District Equity */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1">
              <Compass className="w-3.5 h-3.5 text-blue-600" />
              <span>Senatorial District Reach</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              {summaryKpis.leadingDistrict ? (
                <>
                  <strong className="text-slate-900">{summaryKpis.leadingDistrict.name}</strong> accounts for{' '}
                  <strong className="font-mono text-blue-800">{summaryKpis.leadingDistrict.total.toLocaleString()}</strong> verified participants in the state database. Active reporting councils average{' '}
                  <strong>{summaryKpis.avgParticipants.toLocaleString()}</strong> participants.
                </>
              ) : (
                'Awaiting regional database data across senatorial districts.'
              )}
            </p>
          </div>

          {/* Insight 3: Policy Execution */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 mb-1">
              <Award className="w-3.5 h-3.5 text-emerald-700" />
              <span>Database Council Reach</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              <strong className="font-mono text-emerald-800">{summaryKpis.activeCount} of 31</strong> Local Government Areas currently have verified projects logged in the cloud database. Live sync automatically ingests new council submissions in real time.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
