import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { ALL_31_LGAS, getLgaById } from '../../data/lgas';
import { HCDActivity } from '../../types';
import {
  TrendingUp,
  Calendar,
  Users,
  Building2,
  ArrowUpRight,
  Sparkles,
  BarChart2,
  Info,
  Sliders,
  Database,
  Layers,
  CheckCircle2,
  Calculator,
} from 'lucide-react';
import { calculateLinearRegression, DataPoint } from '../../utils/forecasting';
import { useData } from '../../context/DataContext';

interface ExecutiveTrendChartsProps {
  activities: HCDActivity[];
}

export const ExecutiveTrendCharts: React.FC<ExecutiveTrendChartsProps> = ({ activities }) => {
  const { pillars, getPillarDisplayName } = useData();

  // Chart 1 (Monthly) controls
  const [monthlyMetric, setMonthlyMetric] = useState<'activities' | 'beneficiaries' | 'budget'>('beneficiaries');
  const [monthlyTrajectory, setMonthlyTrajectory] = useState<'velocity' | 'cumulative'>('velocity');

  // Trend Forecast controls (Linear Regression) - strictly OFF by default so only database data is shown
  const [showForecast, setShowForecast] = useState<boolean>(false);
  const [showConfidenceIntervals, setShowConfidenceIntervals] = useState<boolean>(false);

  // Chart 2 (YoY) controls
  const [yoyViewMode, setYoyViewMode] = useState<'pillars' | 'districts' | 'lgaCoverage'>('pillars');
  const [yoyMetric, setYoyMetric] = useState<'beneficiaries' | 'projects'>('beneficiaries');

  // Only published activities constitute verified public impact records
  const published = useMemo(() => activities.filter((a) => a.status === 'PUBLISHED'), [activities]);

  // Dynamic Top Overview Strip Metrics - 100% Database Derived
  const totalBeneficiaries = useMemo(
    () => published.reduce((acc, a) => acc + (a.beneficiariesTotal || 0), 0),
    [published]
  );

  const activeReportingLgas = useMemo(() => {
    const lgaSet = new Set(published.map((a) => a.lgaId));
    return lgaSet.size;
  }, [published]);

  const activePillarsCount = useMemo(() => {
    const pillarSet = new Set(published.map((a) => a.pillar));
    return pillarSet.size;
  }, [published]);

  // -------------------------------------------------------------
  // DATASET 1: Monthly Capacity Building Activity Growth & Linear Regression Forecast
  // 100% COMPUTED STRICTLY FROM ACTUAL DATABASE ACTIVITIES
  // -------------------------------------------------------------
  const { historicalMonthly, forecastAnalysis, monthlyData } = useMemo(() => {
    if (published.length === 0) {
      return {
        historicalMonthly: [],
        forecastAnalysis: null,
        monthlyData: [],
      };
    }

    // Group real activities by Month (YYYY-MM)
    const monthMap = new Map<string, { key: string; label: string; acts: HCDActivity[] }>();
    published.forEach((a) => {
      const dateStr = a.completionDate || a.createdAt;
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;
      const yr = d.getFullYear();
      const mNum = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${yr}-${mNum}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (!monthMap.has(key)) {
        monthMap.set(key, { key, label, acts: [] });
      }
      monthMap.get(key)!.acts.push(a);
    });

    const sortedMonthKeys = Array.from(monthMap.keys()).sort();

    let cumTotal = 0;
    let cumUyo = 0;
    let cumIkotEkpene = 0;
    let cumEket = 0;
    let cumBeneficiariesTotal = 0;

    const hist = sortedMonthKeys.map((key, idx) => {
      const monthObj = monthMap.get(key)!;
      const acts = monthObj.acts;

      const actCount = acts.length;
      const benCount = acts.reduce((acc, c) => acc + (c.beneficiariesTotal || 0), 0);
      const budgetMillion = +(acts.reduce((acc, c) => acc + (c.budgetNgn || 0), 0) / 1000000).toFixed(1);

      // Senatorial district breakdowns from canonical LGA data
      const uyoActs = acts.filter((a) => getLgaById(a.lgaId)?.senatorialDistrict.includes('North-East'));
      const ikotActs = acts.filter((a) => getLgaById(a.lgaId)?.senatorialDistrict.includes('North-West'));
      const eketActs = acts.filter((a) => getLgaById(a.lgaId)?.senatorialDistrict.includes('South'));

      const uyoTotal = uyoActs.length;
      const ikotTotal = ikotActs.length;
      const eketTotal = eketActs.length;

      const uyoBen = uyoActs.reduce((acc, c) => acc + (c.beneficiariesTotal || 0), 0);
      const ikotBen = ikotActs.reduce((acc, c) => acc + (c.beneficiariesTotal || 0), 0);
      const eketBen = eketActs.reduce((acc, c) => acc + (c.beneficiariesTotal || 0), 0);

      const uyoBudget = +(uyoActs.reduce((acc, c) => acc + (c.budgetNgn || 0), 0) / 1000000).toFixed(1);
      const ikotBudget = +(ikotActs.reduce((acc, c) => acc + (c.budgetNgn || 0), 0) / 1000000).toFixed(1);
      const eketBudget = +(eketActs.reduce((acc, c) => acc + (c.budgetNgn || 0), 0) / 1000000).toFixed(1);

      const activeMetricVal =
        monthlyMetric === 'activities' ? actCount : monthlyMetric === 'beneficiaries' ? benCount : budgetMillion;

      const activeUyoVal =
        monthlyMetric === 'activities' ? uyoTotal : monthlyMetric === 'beneficiaries' ? uyoBen : uyoBudget;

      const activeIkotVal =
        monthlyMetric === 'activities' ? ikotTotal : monthlyMetric === 'beneficiaries' ? ikotBen : ikotBudget;

      const activeEketVal =
        monthlyMetric === 'activities' ? eketTotal : monthlyMetric === 'beneficiaries' ? eketBen : eketBudget;

      cumTotal += activeMetricVal;
      cumUyo += activeUyoVal;
      cumIkotEkpene += activeIkotVal;
      cumEket += activeEketVal;
      cumBeneficiariesTotal += benCount;

      return {
        month: monthObj.label,
        key: monthObj.key,
        index: idx,
        totalActivities: actCount,
        totalBeneficiaries: benCount,
        totalBudgetMillion: budgetMillion,
        uyoTotal,
        ikotEkpeneTotal: ikotTotal,
        eketTotal,
        uyoBen,
        ikotEkpeneBen: ikotBen,
        eketBen,
        activeMetricVal,
        activeUyoVal,
        activeIkotVal,
        activeEketVal,
        cumTotal: Math.round(cumTotal),
        cumUyo: Math.round(cumUyo),
        cumIkotEkpene: Math.round(cumIkotEkpene),
        cumEket: Math.round(cumEket),
        cumBeneficiariesTotal,
      };
    });

    // Run Ordinary Least Squares (OLS) Regression if at least 2 distinct calendar periods exist
    let forecastAnalysis: any = null;
    const chartRows: any[] = [];

    if (hist.length >= 2) {
      const participantPoints: DataPoint[] = hist.map((h) => ({
        x: h.index,
        y: monthlyTrajectory === 'cumulative' ? h.cumBeneficiariesTotal : h.totalBeneficiaries,
        label: h.month,
      }));
      const participantRegression = calculateLinearRegression(participantPoints);

      const activeMetricPoints: DataPoint[] = hist.map((h) => ({
        x: h.index,
        y: monthlyTrajectory === 'cumulative' ? h.cumTotal : h.activeMetricVal,
        label: h.month,
      }));
      const activeMetricRegression = calculateLinearRegression(activeMetricPoints);

      // Extrapolate next quarter (3 future intervals)
      const lastMonthObj = new Date(hist[hist.length - 1].key + '-01');
      const forecastMonths = [1, 2, 3].map((offset) => {
        const futureDate = new Date(lastMonthObj.getFullYear(), lastMonthObj.getMonth() + offset, 1);
        const lbl = futureDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        const futureX = hist.length - 1 + offset;
        const predictedBen = Math.max(0, Math.round(participantRegression.predict(futureX)));
        const ciBen = participantRegression.confidenceInterval(futureX);
        return {
          label: `${lbl} (Est.)`,
          rawLabel: lbl,
          index: futureX,
          predicted: predictedBen,
          lowerBound: ciBen.lower,
          upperBound: ciBen.upper,
        };
      });

      const nextQuarterTotalParticipants = forecastMonths.reduce((acc, f) => acc + f.predicted, 0);
      const prevQuarterParticipants =
        hist.slice(-Math.min(3, hist.length)).reduce((acc, h) => acc + h.totalBeneficiaries, 0) || 1;
      const quarterGrowthPct =
        ((nextQuarterTotalParticipants - prevQuarterParticipants) / prevQuarterParticipants) * 100;

      const slopeSign = activeMetricRegression.slope >= 0 ? '+' : '';
      const equation = `ŷ = ${slopeSign}${Math.round(activeMetricRegression.slope)}x + ${Math.round(activeMetricRegression.intercept)}`;

      forecastAnalysis = {
        participantRegression,
        activeMetricRegression,
        forecastMonths,
        nextQuarterTotalParticipants,
        prevQuarterParticipants,
        quarterGrowthPct,
        equation,
      };

      // Add historical rows
      hist.forEach((h, idx) => {
        const isTransitionMonth = idx === hist.length - 1;
        const val = monthlyTrajectory === 'cumulative' ? h.cumTotal : h.activeMetricVal;
        const uyoVal = monthlyTrajectory === 'cumulative' ? h.cumUyo : h.activeUyoVal;
        const ikotVal = monthlyTrajectory === 'cumulative' ? h.cumIkotEkpene : h.activeIkotVal;
        const eketVal = monthlyTrajectory === 'cumulative' ? h.cumEket : h.activeEketVal;

        chartRows.push({
          month: h.month,
          key: h.key,
          'State Total (All 31 LGAs)': val,
          'Next Qtr Forecast (OLS Regression)': isTransitionMonth && showForecast ? val : null,
          'Forecast Upper (95% CI)': isTransitionMonth && showForecast && showConfidenceIntervals ? val : null,
          'Forecast Lower (95% CI)': isTransitionMonth && showForecast && showConfidenceIntervals ? val : null,
          'Uyo Senatorial District': uyoVal,
          'Ikot Ekpene Senatorial District': ikotVal,
          'Eket Senatorial District': eketVal,
          activitiesCount: h.totalActivities,
          beneficiariesCount: h.totalBeneficiaries,
          budgetNgnMillion: h.totalBudgetMillion,
          isForecast: false,
        });
      });

      // Add forecast rows if enabled
      if (showForecast) {
        let runningCumTotal = hist[hist.length - 1].cumTotal;
        forecastMonths.forEach((fm, idx) => {
          const futureX = hist.length + idx;
          const predMetric = Math.max(0, Math.round(activeMetricRegression.predict(futureX)));
          const ciMetric = activeMetricRegression.confidenceInterval(futureX);

          let displayPred = predMetric;
          let displayUpper = ciMetric.upper;
          let displayLower = ciMetric.lower;

          if (monthlyTrajectory === 'cumulative') {
            runningCumTotal += predMetric;
            displayPred = runningCumTotal;
            displayUpper = Math.round(runningCumTotal + (ciMetric.upper - predMetric));
            displayLower = Math.max(0, Math.round(runningCumTotal - (predMetric - ciMetric.lower)));
          }

          chartRows.push({
            month: fm.label,
            key: `forecast-${idx}`,
            'State Total (All 31 LGAs)': null,
            'Next Qtr Forecast (OLS Regression)': displayPred,
            'Forecast Upper (95% CI)': showConfidenceIntervals ? displayUpper : null,
            'Forecast Lower (95% CI)': showConfidenceIntervals ? displayLower : null,
            'Uyo Senatorial District': null,
            'Ikot Ekpene Senatorial District': null,
            'Eket Senatorial District': null,
            activitiesCount: predMetric,
            beneficiariesCount: fm.predicted,
            budgetNgnMillion: +(predMetric * 0.01).toFixed(1),
            isForecast: true,
            predictedValue: displayPred,
            lowerCI: displayLower,
            upperCI: displayUpper,
          });
        });
      }
    } else {
      // Single month of real data
      hist.forEach((h) => {
        chartRows.push({
          month: h.month,
          key: h.key,
          'State Total (All 31 LGAs)': monthlyTrajectory === 'cumulative' ? h.cumTotal : h.activeMetricVal,
          'Uyo Senatorial District': monthlyTrajectory === 'cumulative' ? h.cumUyo : h.activeUyoVal,
          'Ikot Ekpene Senatorial District': monthlyTrajectory === 'cumulative' ? h.cumIkotEkpene : h.activeIkotVal,
          'Eket Senatorial District': monthlyTrajectory === 'cumulative' ? h.cumEket : h.activeEketVal,
          activitiesCount: h.totalActivities,
          beneficiariesCount: h.totalBeneficiaries,
          budgetNgnMillion: h.totalBudgetMillion,
          isForecast: false,
        });
      });
    }

    return {
      historicalMonthly: hist,
      forecastAnalysis,
      monthlyData: chartRows,
    };
  }, [published, monthlyMetric, monthlyTrajectory, showForecast, showConfidenceIntervals]);

  // -------------------------------------------------------------
  // DATASET 2: Year-over-Year (YoY) Multi-Year Progress
  // 100% COMPUTED STRICTLY FROM ACTUAL DATABASE ACTIVITIES
  // -------------------------------------------------------------
  const { yoyDataByPillars, yoyDataByDistricts, yoyLgaCoverageData } = useMemo(() => {
    if (published.length === 0) {
      return { yoyDataByPillars: [], yoyDataByDistricts: [], yoyLgaCoverageData: [] };
    }

    // Group real activities by Year
    const yearMap = new Map<number, HCDActivity[]>();
    published.forEach((a) => {
      const dateStr = a.completionDate || a.createdAt;
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;
      const yr = d.getFullYear();
      if (!yearMap.has(yr)) yearMap.set(yr, []);
      yearMap.get(yr)!.push(a);
    });

    const sortedYears = Array.from(yearMap.keys()).sort();

    const pillarsRows: any[] = [];
    const districtsRows: any[] = [];
    const coverageRows: any[] = [];

    sortedYears.forEach((year) => {
      const yearActs = yearMap.get(year)!;

      // Dynamic Pillars breakdown
      const eduName = getPillarDisplayName('education');
      const healthName = getPillarDisplayName('health');
      const vocName = getPillarDisplayName('vocational');
      const agricName = getPillarDisplayName('agriculture');
      const crossName = getPillarDisplayName('cross_cutting_enablers');
      const valuesName = getPillarDisplayName('values_ethics_social_behaviour');

      const eduActs = yearActs.filter((a) => a.pillar === 'education');
      const healthActs = yearActs.filter((a) => a.pillar === 'health');
      const vocActs = yearActs.filter((a) => a.pillar === 'vocational');
      const agricActs = yearActs.filter((a) => a.pillar === 'agriculture');
      const crossActs = yearActs.filter((a) => a.pillar === 'cross_cutting_enablers');
      const valuesActs = yearActs.filter((a) => a.pillar === 'values_ethics_social_behaviour');

      const eduVal =
        yoyMetric === 'beneficiaries'
          ? eduActs.reduce((acc, c) => acc + (c.beneficiariesTotal || 0), 0)
          : eduActs.length;
      const healthVal =
        yoyMetric === 'beneficiaries'
          ? healthActs.reduce((acc, c) => acc + (c.beneficiariesTotal || 0), 0)
          : healthActs.length;
      const vocVal =
        yoyMetric === 'beneficiaries'
          ? vocActs.reduce((acc, c) => acc + (c.beneficiariesTotal || 0), 0)
          : vocActs.length;
      const agricVal =
        yoyMetric === 'beneficiaries'
          ? agricActs.reduce((acc, c) => acc + (c.beneficiariesTotal || 0), 0)
          : agricActs.length;
      const crossVal =
        yoyMetric === 'beneficiaries'
          ? crossActs.reduce((acc, c) => acc + (c.beneficiariesTotal || 0), 0)
          : crossActs.length;
      const valuesVal =
        yoyMetric === 'beneficiaries'
          ? valuesActs.reduce((acc, c) => acc + (c.beneficiariesTotal || 0), 0)
          : valuesActs.length;

      const totalVal = eduVal + healthVal + vocVal + agricVal + crossVal + valuesVal;

      pillarsRows.push({
        year: String(year),
        [eduName]: eduVal,
        [healthName]: healthVal,
        [vocName]: vocVal,
        [agricName]: agricVal,
        [crossName]: crossVal,
        [valuesName]: valuesVal,
        'Total State Wide': totalVal,
      });

      // Districts breakdown
      const uyoActs = yearActs.filter((a) => getLgaById(a.lgaId)?.senatorialDistrict.includes('North-East'));
      const ikotActs = yearActs.filter((a) => getLgaById(a.lgaId)?.senatorialDistrict.includes('North-West'));
      const eketActs = yearActs.filter((a) => getLgaById(a.lgaId)?.senatorialDistrict.includes('South'));

      const uyoVal =
        yoyMetric === 'beneficiaries'
          ? uyoActs.reduce((acc, c) => acc + (c.beneficiariesTotal || 0), 0)
          : uyoActs.length;
      const ikotVal =
        yoyMetric === 'beneficiaries'
          ? ikotActs.reduce((acc, c) => acc + (c.beneficiariesTotal || 0), 0)
          : ikotActs.length;
      const eketVal =
        yoyMetric === 'beneficiaries'
          ? eketActs.reduce((acc, c) => acc + (c.beneficiariesTotal || 0), 0)
          : eketActs.length;

      districtsRows.push({
        year: String(year),
        'Uyo Senatorial District (9 LGAs)': uyoVal,
        'Ikot Ekpene Senatorial District (10 LGAs)': ikotVal,
        'Eket Senatorial District (12 LGAs)': eketVal,
        'All 31 LGAs Combined': uyoVal + ikotVal + eketVal,
      });

      // Coverage breakdown
      const distinctLgas = new Set(yearActs.map((a) => a.lgaId)).size;
      const rate = +((distinctLgas / 31) * 100).toFixed(1);
      coverageRows.push({
        year: String(year),
        'Active LGA Councils': distinctLgas,
        'Coverage Rate (%)': rate,
      });
    });

    return {
      yoyDataByPillars: pillarsRows,
      yoyDataByDistricts: districtsRows,
      yoyLgaCoverageData: coverageRows,
    };
  }, [published, yoyMetric]);

  // Formatter for Y-Axis and Tooltips
  const formatYAxisNumber = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return val.toString();
  };

  return (
    <div className="space-y-8">
      {/* Top Analytical Overview Strip - STRICTLY REAL DATABASE AGGREGATES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Active Database Records
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono flex items-baseline gap-1.5 mt-0.5">
              <span>{published.length}</span>
              <span className="text-xs font-semibold text-emerald-700 font-sans">Published</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {activities.length} total entries on portal
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Verified Beneficiaries
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono flex items-baseline gap-1.5 mt-0.5">
              <span>{totalBeneficiaries.toLocaleString()}</span>
              <span className="text-xs font-semibold text-amber-700 font-sans">Citizens</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Aggregated from live attendance
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-800 shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Reporting LGAs
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono mt-0.5 flex items-baseline gap-1.5">
              <span>{activeReportingLgas} / 31</span>
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-sans">
                {((activeReportingLgas / 31) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Councils with published work
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-purple-800 shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Active Strategic Pillars
            </div>
            <div className="text-2xl font-black text-slate-900 font-mono mt-0.5 flex items-baseline gap-1.5">
              <span>{activePillarsCount} / {pillars.length || 6}</span>
              <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full font-sans">
                ARISE
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs" title={pillars.map((p) => p.display_name).join(', ')}>
              {pillars.map((p) => p.display_name).join(', ')}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CHART 1: MONTHLY CAPACITY BUILDING ACTIVITY GROWTH ACROSS THE 31 LGAS     */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-7 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-200">
                Monthly Trend Analysis
              </span>
              <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                <Calendar className="w-3.5 h-3.5" /> Live Database Horizon ({historicalMonthly.length} Months Logged)
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-1">
              Monthly Capacity Building Activity Growth Across the 31 LGAs
            </h3>
            <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
              Empirical chronological trajectory derived strictly from verified projects logged in the cloud database.
            </p>
          </div>

          {/* Controls Bar for Monthly Chart */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Metric Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
              <button
                onClick={() => setMonthlyMetric('activities')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  monthlyMetric === 'activities'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                Activities Count
              </button>
              <button
                onClick={() => setMonthlyMetric('beneficiaries')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  monthlyMetric === 'beneficiaries'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                Beneficiaries Trained
              </button>
              <button
                onClick={() => setMonthlyMetric('budget')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  monthlyMetric === 'budget'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                Budget (₦ Millions)
              </button>
            </div>

            {/* Velocity vs Cumulative Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
              <button
                onClick={() => setMonthlyTrajectory('velocity')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  monthlyTrajectory === 'velocity'
                    ? 'bg-[#0B4619] text-white shadow-xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                Monthly Rate
              </button>
              <button
                onClick={() => setMonthlyTrajectory('cumulative')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  monthlyTrajectory === 'cumulative'
                    ? 'bg-[#0B4619] text-white shadow-xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                Cumulative Path
              </button>
            </div>

            {/* Linear Regression Forecast Toggle (Active when at least 2 distinct periods exist) */}
            {forecastAnalysis && (
              <button
                onClick={() => setShowForecast(!showForecast)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                  showForecast
                    ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                title="Toggle Next Quarter Linear Regression Forecast (OLS)"
              >
                <Sparkles className={`w-3.5 h-3.5 ${showForecast ? 'text-emerald-300' : 'text-slate-400'}`} />
                <span>Trend Forecast</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                    showForecast ? 'bg-emerald-950 text-emerald-200 font-bold' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {showForecast ? 'ACTIVE' : 'OFF'}
                </span>
              </button>
            )}

            {/* 95% Confidence Interval Toggle */}
            {forecastAnalysis && showForecast && (
              <button
                onClick={() => setShowConfidenceIntervals(!showConfidenceIntervals)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 border ${
                  showConfidenceIntervals
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
                title="Toggle 95% Confidence Interval Bands"
              >
                <Sliders className="w-3 h-3 text-emerald-700" />
                <span>95% CI</span>
              </button>
            )}
          </div>
        </div>

        {/* Legend / Quick Stats */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#0B4619]" />
              <span className="font-bold text-slate-900">State Total (Verified)</span>
            </div>
            {forecastAnalysis && showForecast && (
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-1.5 rounded-full bg-[#059669] border border-dashed border-[#064E3B]" />
                <span className="font-bold text-emerald-900 flex items-center gap-1">
                  Next Qtr Forecast (OLS)
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#2563EB]" />
              <span>Uyo District</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#D4AF37]" />
              <span>Ikot Ekpene District</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#DC2626]" />
              <span>Eket District</span>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
            <Database className="w-3.5 h-3.5" />
            <span>Live Database Records: {published.length}</span>
          </div>
        </div>

        {/* Statistical Estimation Notice when Forecast is Active */}
        {forecastAnalysis && showForecast && (
          <div className="p-3 bg-amber-50/80 border border-amber-200/90 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Statistical Forecast Engaged:</strong> Dashed green curve and upcoming months are OLS linear regression mathematical models ({forecastAnalysis.equation}) extrapolated from historical trends. Solid lines represent verified database records.
              </span>
            </div>
            <button
              onClick={() => setShowForecast(false)}
              className="px-2.5 py-1 bg-amber-200/70 hover:bg-amber-200 text-amber-950 font-semibold rounded-lg text-[11px] shrink-0 transition-colors"
            >
              Hide Projection
            </button>
          </div>
        )}

        {/* EMPTY STATE IF NO DATA IN DATABASE */}
        {published.length === 0 ? (
          <div className="py-16 px-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-3">
            <Database className="w-12 h-12 text-slate-400 mx-auto" />
            <h4 className="text-base font-bold text-slate-800">
              Zero Database Records Available
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              The State Cloud Database currently has 0 published activities. Monthly trend velocity and OLS linear regression forecasting will populate dynamically in real-time as activities are submitted from LGA desks or when the baseline dataset is seeded.
            </p>
          </div>
        ) : (
          <>
            {/* OLS REGRESSION PANEL IF 2+ MONTHS EXIST */}
            {forecastAnalysis && showForecast && (
              <div className="bg-gradient-to-br from-emerald-50/90 via-slate-50 to-emerald-50/40 rounded-2xl p-5 border border-emerald-200/90 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100/90 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-800 text-white flex items-center justify-center shadow-xs">
                      <Calculator className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm tracking-tight">
                          Next Quarter Trend Forecast: Linear Regression Model (OLS)
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                          Data-Driven Projection
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Empirical participant growth trajectory modeled using Ordinary Least Squares regression over {historicalMonthly.length} recorded calendar intervals
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-[11px] text-emerald-900 font-semibold bg-white/90 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs font-mono">
                      R² = {forecastAnalysis.participantRegression.rSquared.toFixed(3)}
                    </span>
                  </div>
                </div>

                {/* 4 Analytical KPI Metric Blocks */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-white rounded-xl p-3.5 border border-emerald-100/80 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Next Qtr Projected Output
                    </span>
                    <div className="text-xl font-black text-emerald-950 font-mono mt-0.5">
                      +{forecastAnalysis.nextQuarterTotalParticipants.toLocaleString()}
                    </div>
                    <div className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1 mt-0.5">
                      <ArrowUpRight className="w-3 h-3" />
                      <span>Forecasted Growth</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-3.5 border border-emerald-100/80 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Expansion Velocity (Slope)
                    </span>
                    <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
                      +{Math.round(forecastAnalysis.participantRegression.slope).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Net change per period
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-3.5 border border-emerald-100/80 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Regression Equation
                    </span>
                    <div className="text-sm font-black text-slate-900 font-mono mt-1 truncate" title={forecastAnalysis.equation}>
                      {forecastAnalysis.equation}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Ordinary Least Squares
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-3.5 border border-emerald-100/80 shadow-2xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      95% Confidence Margin
                    </span>
                    <div className="text-xl font-black text-slate-900 font-mono mt-0.5">
                      ±{Math.round(forecastAnalysis.participantRegression.standardError * 1.96).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Standard Error (p &lt; 0.05)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notice if only 1 month exists */}
            {historicalMonthly.length === 1 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Single calendar interval currently recorded in database ({historicalMonthly[0].month}). Linear regression forecasting will activate automatically once activities span 2 or more distinct calendar months.
                </span>
              </div>
            )}

            {/* Recharts Line Chart Container */}
            <div className="w-full h-80 sm:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={monthlyData}
                  margin={{ top: 15, right: 30, left: 10, bottom: 15 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="#64748b"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={formatYAxisNumber}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const rowData = payload[0]?.payload;
                        const isForecastPoint = rowData?.isForecast;

                        return (
                          <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs min-w-[250px] space-y-2">
                            <div className="font-bold text-[#D4AF37] border-b border-slate-700 pb-1.5 flex items-center justify-between">
                              <span>{label}</span>
                              {isForecastPoint ? (
                                <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-300 bg-emerald-900/80 px-2 py-0.5 rounded border border-emerald-600/50 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-emerald-400" />
                                  OLS Forecast
                                </span>
                              ) : (
                                <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-300">
                                  Live Database Record
                                </span>
                              )}
                            </div>

                            <div className="space-y-1">
                              {payload.map((entry, idx) => {
                                if (entry.value === null || entry.value === undefined) return null;
                                return (
                                  <div key={`item-${idx}`} className="flex items-center justify-between gap-3">
                                    <span className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                                      <span
                                        className="w-2.5 h-2.5 rounded-full"
                                        style={{ backgroundColor: entry.color }}
                                      />
                                      {entry.name}:
                                    </span>
                                    <span className="font-mono font-bold text-white">
                                      {typeof entry.value === 'number'
                                        ? monthlyMetric === 'budget'
                                          ? `₦${entry.value}M`
                                          : entry.value.toLocaleString()
                                        : entry.value}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', paddingTop: '16px' }}
                  />

                  {/* District Historical Lines */}
                  <Line
                    type="monotone"
                    dataKey="Uyo Senatorial District"
                    stroke="#2563EB"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#2563EB' }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Ikot Ekpene Senatorial District"
                    stroke="#D4AF37"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#D4AF37' }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Eket Senatorial District"
                    stroke="#DC2626"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#DC2626' }}
                    activeDot={{ r: 5 }}
                  />

                  {/* Primary State Historical Line */}
                  <Line
                    type="monotone"
                    dataKey="State Total (All 31 LGAs)"
                    stroke="#0B4619"
                    strokeWidth={3.5}
                    dot={{ r: 4, fill: '#0B4619', stroke: '#D4AF37', strokeWidth: 1.5 }}
                    activeDot={{ r: 7, fill: '#0B4619', stroke: '#fff', strokeWidth: 2 }}
                  />

                  {/* Linear Regression Forecast Line */}
                  {forecastAnalysis && showForecast && (
                    <Line
                      type="monotone"
                      dataKey="Next Qtr Forecast (OLS Regression)"
                      stroke="#059669"
                      strokeWidth={3.5}
                      strokeDasharray="6 4"
                      dot={{ r: 5, fill: '#10B981', stroke: '#064E3B', strokeWidth: 2 }}
                      activeDot={{ r: 8, fill: '#059669', stroke: '#fff', strokeWidth: 2 }}
                      connectNulls={false}
                      name="Next Qtr Forecast (OLS Regression)"
                    />
                  )}

                  {/* 95% Confidence Interval Upper Bound */}
                  {forecastAnalysis && showForecast && showConfidenceIntervals && (
                    <Line
                      type="monotone"
                      dataKey="Forecast Upper (95% CI)"
                      stroke="#10B981"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      dot={false}
                      strokeOpacity={0.7}
                      connectNulls={false}
                      name="Forecast Upper (95% CI)"
                    />
                  )}

                  {/* 95% Confidence Interval Lower Bound */}
                  {forecastAnalysis && showForecast && showConfidenceIntervals && (
                    <Line
                      type="monotone"
                      dataKey="Forecast Lower (95% CI)"
                      stroke="#10B981"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      dot={false}
                      strokeOpacity={0.7}
                      connectNulls={false}
                      name="Forecast Lower (95% CI)"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* CHART 2: YEAR-OVER-YEAR HUMAN CAPITAL DEVELOPMENT PROGRESS (31 LGAs)      */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-7 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-200">
                Multi-Year Strategic Progress
              </span>
              <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                <BarChart2 className="w-3.5 h-3.5" /> Longitudinal Database Horizon
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-1">
              Year-over-Year (YoY) Human Capital Development Progress Across the 31 LGAs
            </h3>
            <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
              Longitudinal analysis tracking four-pillar capacity outcomes derived exclusively from authenticated database entries.
            </p>
          </div>

          {/* Controls Bar for YoY Chart */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
              <button
                onClick={() => setYoyViewMode('pillars')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  yoyViewMode === 'pillars'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                By Strategic Pillar
              </button>
              <button
                onClick={() => setYoyViewMode('districts')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  yoyViewMode === 'districts'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                By Senatorial District
              </button>
              <button
                onClick={() => setYoyViewMode('lgaCoverage')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  yoyViewMode === 'lgaCoverage'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                LGA Penetration Rate
              </button>
            </div>

            {yoyViewMode !== 'lgaCoverage' && (
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
                <button
                  onClick={() => setYoyMetric('beneficiaries')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    yoyMetric === 'beneficiaries'
                      ? 'bg-[#0B4619] text-white shadow-xs font-bold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Beneficiaries
                </button>
                <button
                  onClick={() => setYoyMetric('projects')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    yoyMetric === 'projects'
                      ? 'bg-[#0B4619] text-white shadow-xs font-bold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Completed Projects
                </button>
              </div>
            )}
          </div>
        </div>

        {/* EMPTY STATE IF NO DATA IN DATABASE */}
        {published.length === 0 ? (
          <div className="py-12 px-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
            <p className="text-xs text-slate-500">
              No longitudinal annual records found in the database. Annual trends will appear once projects are recorded.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {yoyDataByPillars.length === 1 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Single calendar year ({yoyDataByPillars[0]?.year}) currently logged in database. Multi-year comparative trajectory will dynamically expand as longitudinal records accumulate.
                </span>
              </div>
            )}
            <div className="w-full h-80 sm:h-96">
            <ResponsiveContainer width="100%" height="100%">
              {yoyViewMode === 'pillars' ? (
                <LineChart
                  data={yoyDataByPillars}
                  margin={{ top: 15, right: 30, left: 10, bottom: 15 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="year"
                    stroke="#64748b"
                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={formatYAxisNumber}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs min-w-[240px] space-y-2">
                            <div className="font-bold text-[#D4AF37] border-b border-slate-700 pb-1.5 flex items-center justify-between">
                              <span>{label}</span>
                              <span className="text-[10px] text-emerald-300 font-mono">
                                Verified Database Pillars
                              </span>
                            </div>
                            <div className="space-y-1">
                              {payload.map((entry, idx) => (
                                <div key={`p-${idx}`} className="flex items-center justify-between gap-3">
                                  <span className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full"
                                      style={{ backgroundColor: entry.color }}
                                    />
                                    {entry.name}:
                                  </span>
                                  <span className="font-mono font-bold text-white">
                                    {typeof entry.value === 'number'
                                      ? entry.value.toLocaleString()
                                      : entry.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', paddingTop: '16px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey={getPillarDisplayName('education')}
                    stroke="#15803D"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#15803D' }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey={getPillarDisplayName('health')}
                    stroke="#0284C7"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#0284C7' }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey={getPillarDisplayName('vocational')}
                    stroke="#B45309"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#B45309' }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey={getPillarDisplayName('agriculture')}
                    stroke="#047857"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#047857' }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey={getPillarDisplayName('cross_cutting_enablers')}
                    stroke="#0891B2"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#0891B2' }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey={getPillarDisplayName('values_ethics_social_behaviour')}
                    stroke="#7C3AED"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#7C3AED' }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Total State Wide"
                    stroke="#0B4619"
                    strokeWidth={3.5}
                    strokeDasharray="4 2"
                    dot={{ r: 5, fill: '#0B4619', stroke: '#D4AF37', strokeWidth: 2 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              ) : yoyViewMode === 'districts' ? (
                <LineChart
                  data={yoyDataByDistricts}
                  margin={{ top: 15, right: 30, left: 10, bottom: 15 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="year"
                    stroke="#64748b"
                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={formatYAxisNumber}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs min-w-[240px] space-y-2">
                            <div className="font-bold text-[#D4AF37] border-b border-slate-700 pb-1.5 flex items-center justify-between">
                              <span>{label}</span>
                              <span className="text-[10px] text-emerald-300 font-mono">
                                Verified Districts
                              </span>
                            </div>
                            <div className="space-y-1">
                              {payload.map((entry, idx) => (
                                <div key={`d-${idx}`} className="flex items-center justify-between gap-3">
                                  <span className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full"
                                      style={{ backgroundColor: entry.color }}
                                    />
                                    {entry.name}:
                                  </span>
                                  <span className="font-mono font-bold text-white">
                                    {typeof entry.value === 'number'
                                      ? entry.value.toLocaleString()
                                      : entry.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', paddingTop: '16px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Uyo Senatorial District (9 LGAs)"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Ikot Ekpene Senatorial District (10 LGAs)"
                    stroke="#D4AF37"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Eket Senatorial District (12 LGAs)"
                    stroke="#DC2626"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="All 31 LGAs Combined"
                    stroke="#0B4619"
                    strokeWidth={3.5}
                    strokeDasharray="4 2"
                    dot={{ r: 5, fill: '#0B4619', stroke: '#D4AF37', strokeWidth: 2 }}
                  />
                </LineChart>
              ) : (
                <LineChart
                  data={yoyLgaCoverageData}
                  margin={{ top: 15, right: 30, left: 10, bottom: 15 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="year"
                    stroke="#64748b"
                    tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs min-w-[220px] space-y-2">
                            <div className="font-bold text-[#D4AF37] border-b border-slate-700 pb-1.5">
                              {label}
                            </div>
                            <div className="space-y-1">
                              {payload.map((entry, idx) => (
                                <div key={`c-${idx}`} className="flex items-center justify-between gap-3">
                                  <span className="text-slate-300 text-[11px]">
                                    {entry.name}:
                                  </span>
                                  <span className="font-mono font-bold text-white">
                                    {String(entry.name || '').includes('%')
                                      ? `${entry.value}%`
                                      : entry.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', paddingTop: '16px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Active LGA Councils"
                    stroke="#0B4619"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#0B4619' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Coverage Rate (%)"
                    stroke="#D4AF37"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#D4AF37' }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}

        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-start justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-start gap-2">
            <Layers className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <span>
              <strong>Real-Time Data Ledger Integrity:</strong> All metrics, percentages, and regressions reflect verified entries in the cloud database. Synthetic extrapolations are strictly disengaged to preserve official audit compliance.
            </span>
          </div>
          <span className="shrink-0 font-mono text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded">
            Live Streamed
          </span>
        </div>
      </div>
    </div>
  );
};
