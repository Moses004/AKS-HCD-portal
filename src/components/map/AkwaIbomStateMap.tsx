import React, { useState, useMemo, useRef } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
  useSpring,
} from 'motion/react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { ALL_31_LGAS, PILLARS } from '../../data/lgas';
import { LGA, HCDActivity } from '../../types';
import { useData } from '../../context/DataContext';
import { HcdLogo } from '../common/Logos';
import { KINETIC_EASE } from '../common/MotionPrimitives';
import {
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  Eye,
  Compass,
  MapPin,
  ArrowUpRight,
  Lock,
  Search,
  Users,
} from 'lucide-react';

interface AkwaIbomStateMapProps {
  activities: HCDActivity[];
  selectedLgaId: string | null;
  onSelectLga: (lgaId: string | null) => void;
  onViewActivity?: (activity: HCDActivity) => void;
  onJumpToRegistry?: () => void;
}

type MetricView = 'beneficiaries' | 'activities' | 'budget';

interface LgaAggregate {
  totalBeneficiaries: number;
  maleBeneficiaries: number;
  femaleBeneficiaries: number;
  youthBeneficiaries: number;
  totalBudget: number;
  publishedCount: number;
  pendingCount: number;
  publishedActivities: HCDActivity[];
}

export const AkwaIbomStateMap: React.FC<AkwaIbomStateMapProps> = ({
  activities,
  selectedLgaId,
  onSelectLga,
  onViewActivity,
  onJumpToRegistry,
}) => {
  const { pillars, getPillarDisplayName } = useData();
  const prefersReduced = useReducedMotion();
  const mapCanvasRef = useRef<HTMLDivElement | null>(null);

  const { scrollYProgress: mapScrollProgress } = useScroll({
    target: mapCanvasRef,
    offset: ['start end', 'end start'],
  });
  const smoothMapScroll = useSpring(mapScrollProgress, {
    stiffness: 110,
    damping: 26,
    restDelta: 0.001,
  });
  const gridParallaxY = useTransform(smoothMapScroll, [0, 1], [-26, 26]);
  const compassParallaxY = useTransform(smoothMapScroll, [0, 1], [24, -24]);
  const compassRotate = useTransform(smoothMapScroll, [0, 1], [-8, 8]);

  const [hoveredLga, setHoveredLga] = useState<LGA | null>(null);
  const [hoveredTarget, setHoveredTarget] = useState<'territory' | 'beacon'>('territory');
  const [tooltipFlip, setTooltipFlip] = useState<{ flipX: boolean; flipY: boolean }>({
    flipX: false,
    flipY: false,
  });
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [metricView, setMetricView] = useState<MetricView>('beneficiaries');
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Framer Motion spring coordinates for smooth floating geospatial tooltip
  const rawTooltipX = useMotionValue(0);
  const rawTooltipY = useMotionValue(0);
  const smoothTooltipX = useSpring(rawTooltipX, { stiffness: 420, damping: 32, mass: 0.45 });
  const smoothTooltipY = useSpring(rawTooltipY, { stiffness: 420, damping: 32, mass: 0.45 });

  const updateTooltipAnchor = (clientX: number, clientY: number) => {
    const canvas = mapCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;
    const clampedX = Math.max(16, Math.min(rect.width - 16, relX));
    const clampedY = Math.max(16, Math.min(rect.height - 16, relY));
    rawTooltipX.set(clampedX);
    rawTooltipY.set(clampedY);

    const nextFlipX = clampedX > rect.width - 285;
    const nextFlipY = clampedY < 195;
    setTooltipFlip((prev) =>
      prev.flipX === nextFlipX && prev.flipY === nextFlipY
        ? prev
        : { flipX: nextFlipX, flipY: nextFlipY }
    );
  };

  const anchorTooltipToElement = (el: Element) => {
    const canvas = mapCanvasRef.current;
    if (!canvas) return;
    const elRect = el.getBoundingClientRect();
    updateTooltipAnchor(elRect.left + elRect.width / 2, elRect.top + elRect.height / 2);
  };

  // Compute rich per-LGA metrics from live activities
  const lgaMetrics = useMemo(() => {
    const map = new Map<string, LgaAggregate>();

    ALL_31_LGAS.forEach((lga) => {
      map.set(lga.id, {
        totalBeneficiaries: 0,
        maleBeneficiaries: 0,
        femaleBeneficiaries: 0,
        youthBeneficiaries: 0,
        totalBudget: 0,
        publishedCount: 0,
        pendingCount: 0,
        publishedActivities: [],
      });
    });

    activities.forEach((act) => {
      const current = map.get(act.lgaId) || {
        totalBeneficiaries: 0,
        maleBeneficiaries: 0,
        femaleBeneficiaries: 0,
        youthBeneficiaries: 0,
        totalBudget: 0,
        publishedCount: 0,
        pendingCount: 0,
        publishedActivities: [],
      };
      if (act.status === 'PUBLISHED') {
        current.totalBeneficiaries += act.beneficiariesTotal || 0;
        current.maleBeneficiaries += act.beneficiariesMale || 0;
        current.femaleBeneficiaries += act.beneficiariesFemale || 0;
        current.youthBeneficiaries += act.youthBeneficiaries || 0;
        current.totalBudget += act.budgetNgn || 0;
        current.publishedCount += 1;
        current.publishedActivities.push(act);
      } else if (act.status === 'PENDING_APPROVAL') {
        current.pendingCount += 1;
      }
      map.set(act.lgaId, current);
    });

    return map;
  }, [activities]);

  // Statewide aggregate for default inspector state
  const stateAggregate = useMemo<LgaAggregate>(() => {
    const published = activities.filter((a) => a.status === 'PUBLISHED');
    return {
      totalBeneficiaries: published.reduce((sum, a) => sum + (a.beneficiariesTotal || 0), 0),
      maleBeneficiaries: published.reduce((sum, a) => sum + (a.beneficiariesMale || 0), 0),
      femaleBeneficiaries: published.reduce((sum, a) => sum + (a.beneficiariesFemale || 0), 0),
      youthBeneficiaries: published.reduce((sum, a) => sum + (a.youthBeneficiaries || 0), 0),
      totalBudget: published.reduce((sum, a) => sum + (a.budgetNgn || 0), 0),
      publishedCount: published.length,
      pendingCount: activities.filter((a) => a.status === 'PENDING_APPROVAL').length,
      publishedActivities: published,
    };
  }, [activities]);

  const maxMetrics = useMemo(() => {
    let maxBen = 1;
    let maxActs = 1;
    let maxBudget = 1;
    lgaMetrics.forEach((val) => {
      if (val.totalBeneficiaries > maxBen) maxBen = val.totalBeneficiaries;
      if (val.publishedCount > maxActs) maxActs = val.publishedCount;
      if (val.totalBudget > maxBudget) maxBudget = val.totalBudget;
    });
    return { maxBen, maxActs, maxBudget };
  }, [lgaMetrics]);

  // Determine which LGA is displayed in the Live Side Inspector
  const selectedLgaObj = useMemo(
    () => (selectedLgaId ? ALL_31_LGAS.find((l) => l.id === selectedLgaId) || null : null),
    [selectedLgaId]
  );

  const inspectedLga: LGA | null = hoveredLga || selectedLgaObj;
  const isLockedSelection = Boolean(selectedLgaObj && (!hoveredLga || hoveredLga.id === selectedLgaObj.id));

  const inspectedStats: LgaAggregate = useMemo(() => {
    if (inspectedLga) {
      return (
        lgaMetrics.get(inspectedLga.id) || {
          totalBeneficiaries: 0,
          maleBeneficiaries: 0,
          femaleBeneficiaries: 0,
          youthBeneficiaries: 0,
          totalBudget: 0,
          publishedCount: 0,
          pendingCount: 0,
          publishedActivities: [],
        }
      );
    }
    return stateAggregate;
  }, [inspectedLga, lgaMetrics, stateAggregate]);

  // Pillar distribution mini-chart dataset for the Live Side Inspector
  const pillarChartData = useMemo(() => {
    const sourceActs = inspectedStats.publishedActivities;
    return pillars
      .map((p) => {
        const matching = sourceActs.filter((a) => a.pillar === p.pillar_code);
        const beneficiaries = matching.reduce((s, a) => s + (a.beneficiariesTotal || 0), 0);
        const budgetM = Number((matching.reduce((s, a) => s + (a.budgetNgn || 0), 0) / 1_000_000).toFixed(2));
        const projects = matching.length;
        const shortName =
          p.display_name.length > 18 ? `${p.display_name.slice(0, 16)}…` : p.display_name;

        return {
          code: p.pillar_code,
          name: shortName,
          fullName: p.display_name,
          value:
            metricView === 'beneficiaries'
              ? beneficiaries
              : metricView === 'budget'
              ? budgetM
              : projects,
          beneficiaries,
          budgetM,
          projects,
          color: PILLARS[p.pillar_code]?.color || '#0B4619',
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [inspectedStats, pillars, metricView]);

  const hasChartValues = pillarChartData.some((d) => d.value > 0);

  // Top projects for quick inspection in the side drawer
  const topProjects = useMemo(() => {
    return [...inspectedStats.publishedActivities]
      .sort((a, b) => (b.beneficiariesTotal || 0) - (a.beneficiariesTotal || 0))
      .slice(0, 3);
  }, [inspectedStats]);

  // Precomputed summary snapshot for the floating Framer Motion geospatial hover tooltip
  const hoveredTooltipSummary = useMemo(() => {
    if (!hoveredLga) return null;
    const metrics = lgaMetrics.get(hoveredLga.id) || {
      totalBeneficiaries: 0,
      maleBeneficiaries: 0,
      femaleBeneficiaries: 0,
      youthBeneficiaries: 0,
      totalBudget: 0,
      publishedCount: 0,
      pendingCount: 0,
      publishedActivities: [],
    };

    // Determine dominant HCD pillar in this council
    const pillarCounts = new Map<string, number>();
    for (const act of metrics.publishedActivities) {
      pillarCounts.set(act.pillar, (pillarCounts.get(act.pillar) || 0) + (act.beneficiariesTotal || 1));
    }
    let leadPillarCode: string | null = null;
    let leadScore = -1;
    pillarCounts.forEach((score, code) => {
      if (score > leadScore) {
        leadScore = score;
        leadPillarCode = code;
      }
    });

    const leadProject =
      metrics.publishedActivities.length > 0
        ? [...metrics.publishedActivities].sort(
            (a, b) => (b.beneficiariesTotal || 0) - (a.beneficiariesTotal || 0)
          )[0]
        : null;

    return {
      lga: hoveredLga,
      metrics,
      leadPillarCode,
      leadPillarName: leadPillarCode ? getPillarDisplayName(leadPillarCode) : null,
      leadPillarColor: leadPillarCode ? PILLARS[leadPillarCode]?.color || '#10b981' : '#D4AF37',
      leadProject,
      isSelected: selectedLgaId === hoveredLga.id,
    };
  }, [hoveredLga, lgaMetrics, getPillarDisplayName, selectedLgaId]);

  // Choropleth color interpolation
  const getLgaFillColor = (lga: LGA, isSelected: boolean, isHovered: boolean) => {
    if (isSelected) return '#D4AF37';
    if (isHovered) return '#10b981';

    if (districtFilter !== 'all') {
      const matchDistrict =
        (districtFilter === 'uyo' && lga.senatorialDistrict.includes('North-East')) ||
        (districtFilter === 'ikot-ekpene' && lga.senatorialDistrict.includes('North-West')) ||
        (districtFilter === 'eket' && lga.senatorialDistrict.includes('South'));
      if (!matchDistrict) return '#ebe7dc';
    }

    const metrics = lgaMetrics.get(lga.id);
    if (!metrics || metrics.publishedCount === 0) return '#f3f1ea';

    const ratio =
      metricView === 'beneficiaries'
        ? metrics.totalBeneficiaries / maxMetrics.maxBen
        : metricView === 'budget'
        ? metrics.totalBudget / maxMetrics.maxBudget
        : metrics.publishedCount / maxMetrics.maxActs;

    if (ratio > 0.62) return '#064e3b';
    if (ratio > 0.28) return '#047857';
    return '#10b981';
  };

  const formatTileSubLabel = (metrics: LgaAggregate | undefined) => {
    if (!metrics || metrics.publishedCount === 0) return '0 projects';
    if (metricView === 'beneficiaries') return `${metrics.totalBeneficiaries.toLocaleString()} ben.`;
    if (metricView === 'budget') return `₦${(metrics.totalBudget / 1_000_000).toFixed(1)}M`;
    return `${metrics.publishedCount} ${metrics.publishedCount === 1 ? 'proj.' : 'projs.'}`;
  };

  const genderTotal = inspectedStats.maleBeneficiaries + inspectedStats.femaleBeneficiaries;
  const malePct = genderTotal > 0 ? Math.round((inspectedStats.maleBeneficiaries / genderTotal) * 100) : 0;
  const femalePct = genderTotal > 0 ? 100 - malePct : 0;
  const youthPct =
    inspectedStats.totalBeneficiaries > 0
      ? Math.min(100, Math.round((inspectedStats.youthBeneficiaries / inspectedStats.totalBeneficiaries) * 100))
      : 0;

  const districtOptions = [
    { id: 'all', label: 'All 31 LGAs' },
    { id: 'uyo', label: 'Uyo (NE)' },
    { id: 'ikot-ekpene', label: 'Ikot Ekpene (NW)' },
    { id: 'eket', label: 'Eket (South)' },
  ];

  const metricOptions: { id: MetricView; label: string }[] = [
    { id: 'beneficiaries', label: 'Beneficiaries' },
    { id: 'activities', label: 'Projects' },
    { id: 'budget', label: 'Capital (₦)' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-[#E5E2D9] shadow-sm overflow-hidden flex flex-col">
      {/* Map Control Bar — Preserves Exact Required Title, Tag, and Subtitle */}
      <div className="p-4 sm:p-5 border-b border-[#ECE8DD] bg-[#FAF8F2]/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center bg-white p-1.5 rounded-xl border border-[#D4AF37]/70 shadow-xs shrink-0">
            <HcdLogo className="w-6 h-6 object-contain" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex flex-wrap items-center gap-2">
              <span>Akwa Ibom State Geospatial Impact Map</span>
              <span className="text-xs font-semibold text-emerald-900 bg-emerald-100/80 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                31 LGAs
              </span>
            </h3>
            <p className="text-xs text-slate-600">
              Interactive territorial heat map of localized human capital investments
            </p>
          </div>
        </div>

        {/* Dynamic Controls: District Filter, Layer Switcher, Quick LGA Jump, Zoom */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Senatorial District Segmented Filter */}
          <div
            role="tablist"
            aria-label="Filter map by senatorial district"
            className="flex items-center gap-0.5 bg-white border border-[#E5E2D9] p-1 rounded-xl text-xs font-medium"
          >
            {districtOptions.map((opt) => {
              const active = districtFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setDistrictFilter(opt.id)}
                  className={`relative px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    active ? 'text-white font-semibold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="mapDistrictActiveBg"
                      transition={{ duration: 0.25, ease: KINETIC_EASE }}
                      className="absolute inset-0 bg-[#0B4619] rounded-lg shadow-xs"
                    />
                  )}
                  <span className="relative z-10">{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* 3-Layer Metric Switcher */}
          <div
            role="tablist"
            aria-label="Switch geospatial choropleth metric"
            className="flex items-center gap-0.5 bg-white border border-[#E5E2D9] p-1 rounded-xl text-xs"
          >
            {metricOptions.map((opt) => {
              const active = metricView === opt.id;
              return (
                <button
                  key={opt.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMetricView(opt.id)}
                  className={`relative px-2.5 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    active ? 'text-emerald-950 font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="mapMetricActiveBg"
                      transition={{ duration: 0.25, ease: KINETIC_EASE }}
                      className="absolute inset-0 bg-[#D4AF37]/30 border border-[#D4AF37]/60 rounded-lg"
                    />
                  )}
                  <span className="relative z-10">{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick LGA Search-Jump Select */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              aria-label="Jump to Local Government Area"
              value={selectedLgaId || ''}
              onChange={(e) => onSelectLga(e.target.value || null)}
              className="text-xs pl-8 pr-7 py-2 rounded-xl border border-[#E5E2D9] bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0B4619] cursor-pointer"
            >
              <option value="">Jump to LGA…</option>
              {[...ALL_31_LGAS]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((lga) => (
                  <option key={lga.id} value={lga.id}>
                    {lga.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Zoom & Reset Controls */}
          <div className="flex items-center gap-1 bg-white border border-[#E5E2D9] p-1 rounded-xl">
            <button
              onClick={() => setZoomLevel((z) => Math.min(Number((z + 0.18).toFixed(2)), 1.72))}
              title="Zoom In"
              aria-label="Zoom In Map"
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel((z) => Math.max(Number((z - 0.18).toFixed(2)), 0.82))}
              title="Zoom Out"
              aria-label="Zoom Out Map"
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            {(selectedLgaId || zoomLevel !== 1 || districtFilter !== 'all') && (
              <button
                onClick={() => {
                  onSelectLga(null);
                  setZoomLevel(1);
                  setDistrictFilter('all');
                }}
                title="Reset Map View"
                className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-950 hover:bg-amber-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Two-Column Geospatial Workbench: Interactive Map (7 cols) + Live Side Inspector (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* LEFT COLUMN: Interactive 31-LGA Vector Canvas */}
        <div
          ref={mapCanvasRef}
          className="lg:col-span-7 relative bg-gradient-to-b from-[#FAF8F2]/60 via-white to-emerald-50/30 p-4 sm:p-6 overflow-hidden min-h-[480px] flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-[#ECE8DD]"
        >
          {/* Cartographic Coordinate Grid with Scroll Parallax */}
          <motion.div
            aria-hidden="true"
            style={prefersReduced ? undefined : { y: gridParallaxY, willChange: 'transform' }}
            className="absolute -inset-y-10 inset-x-0 pointer-events-none opacity-45"
          >
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="aks-grid-pattern" width="36" height="36" patternUnits="userSpaceOnUse">
                  <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#e5e2d9" strokeWidth="0.75" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#aks-grid-pattern)" />
            </svg>
          </motion.div>

          {/* Subtle Parallax Cartographic Compass Rose Accent */}
          <motion.svg
            aria-hidden="true"
            style={
              prefersReduced
                ? undefined
                : { y: compassParallaxY, rotate: compassRotate, willChange: 'transform' }
            }
            className="no-print pointer-events-none absolute -right-12 -bottom-12 w-56 h-56 text-[#D4AF37]/18"
            viewBox="0 0 200 200"
            fill="none"
          >
            <circle cx="100" cy="100" r="88" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" />
            <circle cx="100" cy="100" r="56" stroke="currentColor" strokeWidth="0.8" />
            <path d="M 100 12 V 188 M 12 100 H 188" stroke="currentColor" strokeWidth="0.7" />
          </motion.svg>

          {/* Floating Status Hint (Top-Left) */}
          <div className="absolute top-3.5 left-4 z-10 flex items-center gap-2 text-[11px] font-medium text-slate-600 bg-white/90 backdrop-blur-sm border border-[#E5E2D9] rounded-lg px-3 py-1.5 shadow-xs">
            <Compass className="w-3.5 h-3.5 text-[#0B4619]" />
            <span>
              {selectedLgaObj
                ? `Pinned: ${selectedLgaObj.name} LGA — click again to view all 31 councils`
                : 'Hover any territory to preview · Click to lock Side Inspector'}
            </span>
          </div>

          {/* Atlantic Coastline Marker */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.18em] uppercase font-semibold text-sky-900/60 pointer-events-none whitespace-nowrap">
            Atlantic Ocean · Bight of Bonny Coastal Boundary
          </div>

          {/* Zoomable SVG Map */}
          <motion.div
            animate={{ scale: zoomLevel }}
            transition={{ duration: prefersReduced ? 0 : 0.3, ease: KINETIC_EASE }}
            className="relative w-full max-w-2xl origin-center pt-6 pb-4"
          >
            <svg
              viewBox="100 20 540 500"
              className="w-full h-auto drop-shadow-sm select-none"
              style={{ maxHeight: '500px' }}
              role="img"
              aria-label="Interactive choropleth map of the 31 Local Government Areas of Akwa Ibom State"
            >
              {/* Coastal Water Silhouette */}
              <path
                d="M 120 480 Q 280 512 400 494 T 620 480 L 620 520 L 120 520 Z"
                fill="#e0f2fe"
                stroke="#bae6fd"
                strokeWidth="1.5"
              />

              {/* 31 LGA Interactive Polygons */}
              {ALL_31_LGAS.map((lga) => {
                const { x, y, w, h, labelX = x + w / 2, labelY = y + h / 2 } = lga.svgData;
                const isSelected = selectedLgaId === lga.id;
                const isHovered = hoveredLga?.id === lga.id;
                const fillColor = getLgaFillColor(lga, isSelected, isHovered);
                const metrics = lgaMetrics.get(lga.id);
                const hasProjects = (metrics?.publishedCount || 0) > 0;
                const isDarkFill = fillColor === '#064e3b' || fillColor === '#047857';

                return (
                  <g
                    key={lga.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`${lga.name} LGA — ${formatTileSubLabel(metrics)}`}
                    aria-pressed={isSelected}
                    onClick={() => onSelectLga(isSelected ? null : lga.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectLga(isSelected ? null : lga.id);
                      }
                    }}
                    onMouseEnter={(e) => {
                      setHoveredLga(lga);
                      setHoveredTarget('territory');
                      updateTooltipAnchor(e.clientX, e.clientY);
                    }}
                    onMouseMove={(e) => {
                      updateTooltipAnchor(e.clientX, e.clientY);
                    }}
                    onMouseLeave={() => {
                      setHoveredLga(null);
                      setHoveredTarget('territory');
                    }}
                    onFocus={(e) => {
                      setHoveredLga(lga);
                      setHoveredTarget('territory');
                      anchorTooltipToElement(e.currentTarget);
                    }}
                    onBlur={() => {
                      setHoveredLga(null);
                      setHoveredTarget('territory');
                    }}
                    className="cursor-pointer outline-none"
                  >
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      rx="8"
                      ry="8"
                      fill={fillColor}
                      stroke={isSelected ? '#072E14' : isHovered ? '#064e3b' : '#ffffff'}
                      strokeWidth={isSelected ? 3.2 : isHovered ? 2.5 : 1.5}
                      style={{
                        transition: 'fill 260ms ease, stroke 180ms ease, filter 200ms ease',
                        filter:
                          isSelected || isHovered
                            ? 'drop-shadow(0 6px 10px rgba(6, 78, 59, 0.24))'
                            : 'none',
                      }}
                    />

                    {/* Live Activity Investment Beacon on Active Councils */}
                    {hasProjects && (
                      <g
                        onMouseEnter={(e) => {
                          e.stopPropagation();
                          setHoveredLga(lga);
                          setHoveredTarget('beacon');
                          updateTooltipAnchor(e.clientX, e.clientY);
                        }}
                        onMouseLeave={() => setHoveredTarget('territory')}
                      >
                        {(isSelected || isHovered || (metrics?.publishedCount || 0) >= 2) && (
                          <circle
                            cx={x + w - 8}
                            cy={y + 8}
                            r={isHovered ? 5.5 : 4.5}
                            fill="none"
                            stroke={isSelected ? '#072E14' : '#D4AF37'}
                            strokeWidth="1.5"
                            className="map-beacon-pulse"
                          />
                        )}
                        <circle
                          cx={x + w - 8}
                          cy={y + 8}
                          r={
                            isHovered
                              ? 4.6
                              : metrics && metrics.publishedCount > 1
                              ? 3.8
                              : 2.8
                          }
                          fill={isSelected ? '#072E14' : '#D4AF37'}
                          stroke="#ffffff"
                          strokeWidth="1.15"
                          style={{ transition: 'r 180ms ease' }}
                        />
                      </g>
                    )}

                    {/* LGA Name */}
                    <text
                      x={labelX}
                      y={labelY - 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className={`text-[9.5px] font-bold pointer-events-none transition-colors ${
                        isSelected
                          ? 'fill-slate-950 font-extrabold'
                          : isHovered
                          ? 'fill-white font-extrabold'
                          : isDarkFill
                          ? 'fill-white'
                          : 'fill-slate-800'
                      }`}
                    >
                      {lga.name}
                    </text>

                    {/* Live Layer Sub-Metric */}
                    <text
                      x={labelX}
                      y={labelY + 10}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className={`text-[7.5px] font-mono tabular-nums pointer-events-none ${
                        isSelected
                          ? 'fill-slate-900 font-semibold'
                          : isHovered
                          ? 'fill-emerald-50 font-medium'
                          : isDarkFill
                          ? 'fill-emerald-100'
                          : 'fill-slate-500'
                      }`}
                    >
                      {formatTileSubLabel(metrics)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </motion.div>

          {/* Framer Motion Floating Interactive Geospatial Tooltip */}
          <AnimatePresence>
            {hoveredTooltipSummary && (
              <motion.div
                key="geospatial-floating-tooltip"
                role="tooltip"
                aria-live="polite"
                style={{
                  left: 0,
                  top: 0,
                  x: smoothTooltipX,
                  y: smoothTooltipY,
                  willChange: 'transform, opacity',
                }}
                initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
                animate={prefersReduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
                transition={{
                  opacity: { duration: 0.16, ease: KINETIC_EASE },
                  scale: { type: 'spring', stiffness: 420, damping: 28 },
                }}
                className="no-print pointer-events-none absolute z-30"
              >
                <div
                  style={{
                    transform: `translate(${tooltipFlip.flipX ? 'calc(-100% - 16px)' : '16px'}, ${
                      tooltipFlip.flipY ? '16px' : 'calc(-100% - 14px)'
                    })`,
                    transition: 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                  className="w-[268px] rounded-xl bg-[#052110]/95 backdrop-blur-md border border-[#D4AF37]/45 text-white shadow-2xl shadow-emerald-950/40 overflow-hidden"
                >
                  {/* Crest Gold Accent Hairline */}
                  <div className="h-[2.5px] w-full bg-gradient-to-r from-[#D4AF37] via-amber-300 to-emerald-400" />

                  <div className="p-3.5 space-y-2.5">
                    {/* Tooltip Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#F0CC56]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] shrink-0" />
                          <span className="truncate">
                            {hoveredTarget === 'beacon'
                              ? `Investment Beacon · ${hoveredTooltipSummary.metrics.publishedCount} Dossiers`
                              : hoveredTooltipSummary.lga.senatorialDistrict.split(' ')[0] + ' District'}
                          </span>
                        </div>
                        <div className="font-display text-base font-bold text-white leading-tight mt-0.5 truncate">
                          {hoveredTooltipSummary.lga.name} LGA
                        </div>
                        <div className="text-[11px] text-emerald-200/80 flex items-center gap-1.5 mt-0.5">
                          <span className="truncate">HQ: {hoveredTooltipSummary.lga.headquarters}</span>
                          <span aria-hidden="true" className="text-white/30">·</span>
                          <span className="font-mono text-[10px] shrink-0">
                            {hoveredTooltipSummary.lga.centerCoordinates.lat.toFixed(2)}°N,{' '}
                            {hoveredTooltipSummary.lga.centerCoordinates.lng.toFixed(2)}°E
                          </span>
                        </div>
                      </div>

                      {hoveredTooltipSummary.isSelected && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#051F0E] bg-[#D4AF37] px-1.5 py-0.5 rounded shrink-0">
                          <Lock className="w-2.5 h-2.5" />
                          Pinned
                        </span>
                      )}
                    </div>

                    {/* 3 High-Level Tabular Metrics */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-white/12">
                      <div
                        className={`rounded-lg px-2 py-1.5 border ${
                          metricView === 'beneficiaries'
                            ? 'bg-[#D4AF37]/16 border-[#D4AF37]/45'
                            : 'bg-white/6 border-white/10'
                        }`}
                      >
                        <span className="text-[9.5px] text-emerald-200/80 block">Reach</span>
                        <span
                          className={`text-xs font-bold font-mono tabular-nums ${
                            metricView === 'beneficiaries' ? 'text-[#F4D97A]' : 'text-white'
                          }`}
                        >
                          {hoveredTooltipSummary.metrics.totalBeneficiaries.toLocaleString()}
                        </span>
                      </div>

                      <div
                        className={`rounded-lg px-2 py-1.5 border ${
                          metricView === 'budget'
                            ? 'bg-[#D4AF37]/16 border-[#D4AF37]/45'
                            : 'bg-white/6 border-white/10'
                        }`}
                      >
                        <span className="text-[9.5px] text-emerald-200/80 block">Capital</span>
                        <span
                          className={`text-xs font-bold font-mono tabular-nums ${
                            metricView === 'budget' ? 'text-[#F4D97A]' : 'text-white'
                          }`}
                        >
                          ₦{(hoveredTooltipSummary.metrics.totalBudget / 1_000_000).toFixed(1)}M
                        </span>
                      </div>

                      <div
                        className={`rounded-lg px-2 py-1.5 border ${
                          metricView === 'activities'
                            ? 'bg-[#D4AF37]/16 border-[#D4AF37]/45'
                            : 'bg-white/6 border-white/10'
                        }`}
                      >
                        <span className="text-[9.5px] text-emerald-200/80 block">Dossiers</span>
                        <span
                          className={`text-xs font-bold font-mono tabular-nums ${
                            metricView === 'activities' ? 'text-[#F4D97A]' : 'text-white'
                          }`}
                        >
                          {hoveredTooltipSummary.metrics.publishedCount}
                        </span>
                      </div>
                    </div>

                    {/* Leading Pillar & Top Verified Dossier Snippet */}
                    {hoveredTooltipSummary.leadProject ? (
                      <div className="pt-1 border-t border-white/12 space-y-1">
                        {hoveredTooltipSummary.leadPillarName && (
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-200/90">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: hoveredTooltipSummary.leadPillarColor }}
                            />
                            <span className="truncate">
                              Lead Pillar: {hoveredTooltipSummary.leadPillarName}
                            </span>
                          </div>
                        )}
                        <p className="text-[11px] font-medium text-white/95 line-clamp-1">
                          {hoveredTooltipSummary.leadProject.title}
                        </p>
                      </div>
                    ) : (
                      <div className="pt-1 border-t border-white/12 text-[11px] text-emerald-200/80">
                        {hoveredTooltipSummary.metrics.pendingCount > 0
                          ? `${hoveredTooltipSummary.metrics.pendingCount} dossier(s) pending Cabinet review`
                          : 'Awaiting verified council submissions'}
                      </div>
                    )}

                    {/* Subtle Footer Cue */}
                    <div className="flex items-center justify-between text-[10px] text-emerald-300/80 pt-0.5">
                      <span>
                        {hoveredTooltipSummary.isSelected
                          ? 'Click territory to reset view'
                          : 'Click to lock Side Inspector'}
                      </span>
                      <ArrowUpRight className="w-3 h-3 text-[#D4AF37]" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT COLUMN: Live Side Inspector & Mini-Charts */}
        <div className="lg:col-span-5 bg-white p-5 sm:p-6 flex flex-col justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={inspectedLga ? inspectedLga.id : 'statewide'}
              initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReduced ? { opacity: 1 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: KINETIC_EASE }}
              className="space-y-5 flex-1 flex flex-col"
            >
              {/* Inspector Header */}
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#ECE8DD]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-[#0B4619]">
                      {inspectedLga ? 'Territorial Inspector' : 'Statewide Overview'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {inspectedLga
                        ? isLockedSelection
                          ? 'Pinned Focus'
                          : 'Live Hover Preview'
                        : 'All 31 Councils'}
                    </span>
                  </div>

                  <h4 className="font-display text-2xl font-bold text-slate-950 tracking-tight leading-tight">
                    {inspectedLga ? `${inspectedLga.name} LGA` : 'Akwa Ibom State'}
                  </h4>

                  <p className="text-xs text-slate-600 flex flex-wrap items-center gap-1.5">
                    {inspectedLga ? (
                      <>
                        <span>HQ: {inspectedLga.headquarters}</span>
                        <span aria-hidden="true">·</span>
                        <span>{inspectedLga.senatorialDistrict}</span>
                      </>
                    ) : (
                      <span>
                        Uyo (NE) · Ikot Ekpene (NW) · Eket (South) Senatorial Districts
                      </span>
                    )}
                  </p>
                </div>

                {selectedLgaObj && (
                  <button
                    onClick={() => onSelectLga(null)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-950 bg-[#FAF8F2] hover:bg-emerald-50 border border-[#E5E2D9] rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    <Lock className="w-3 h-3 text-[#D4AF37]" />
                    Unpin
                  </button>
                )}
              </div>

              {/* 3 Tabular Territory KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-[#FAF8F2] border border-[#ECE8DD]">
                  <span className="text-[11px] font-medium text-slate-500 block">Beneficiaries</span>
                  <div className="text-lg sm:text-xl font-bold text-[#0B4619] font-mono tabular-nums mt-0.5">
                    {inspectedStats.totalBeneficiaries.toLocaleString()}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#FAF8F2] border border-[#ECE8DD]">
                  <span className="text-[11px] font-medium text-slate-500 block">Capital</span>
                  <div className="text-lg sm:text-xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                    ₦{(inspectedStats.totalBudget / 1_000_000).toFixed(1)}M
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#FAF8F2] border border-[#ECE8DD]">
                  <span className="text-[11px] font-medium text-slate-500 block">Projects</span>
                  <div className="text-lg sm:text-xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                    {inspectedStats.publishedCount}
                  </div>
                </div>
              </div>

              {/* Pillar Distribution Mini-Chart (Recharts) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900">
                    Pillar Distribution ({metricView === 'beneficiaries' ? 'Beneficiaries' : metricView === 'budget' ? 'Capital ₦M' : 'Projects'})
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                    {pillars.length} Pillars
                  </span>
                </div>

                {hasChartValues ? (
                  <div className="h-[168px] w-full bg-[#FAF8F2]/60 rounded-xl border border-[#ECE8DD] px-2 pt-2 pb-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={pillarChartData}
                        layout="vertical"
                        margin={{ top: 2, right: 16, left: 4, bottom: 2 }}
                      >
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={112}
                          tick={{ fontSize: 10, fill: '#334155', fontWeight: 500 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: 'rgba(11, 70, 25, 0.05)' }}
                          contentStyle={{
                            backgroundColor: '#072E14',
                            border: '1px solid rgba(212, 175, 55, 0.45)',
                            borderRadius: '10px',
                            fontSize: '11px',
                            color: '#ffffff',
                          }}
                          formatter={(val: any, _name: any, entry: any) => {
                            const item = entry?.payload;
                            if (metricView === 'beneficiaries') {
                              return [`${Number(val).toLocaleString()} beneficiaries`, item?.fullName || 'Pillar'];
                            }
                            if (metricView === 'budget') {
                              return [`₦${Number(val).toFixed(2)}M deployed`, item?.fullName || 'Pillar'];
                            }
                            return [`${val} verified projects`, item?.fullName || 'Pillar'];
                          }}
                        />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={14} isAnimationActive={!prefersReduced}>
                          {pillarChartData.map((entry) => (
                            <Cell key={entry.code} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[120px] rounded-xl border border-dashed border-[#D8D3C5] bg-[#FAF8F2]/50 flex flex-col items-center justify-center text-center px-4">
                    <MapPin className="w-5 h-5 text-slate-400 mb-1" />
                    <p className="text-xs font-semibold text-slate-700">
                      No published activities recorded in {inspectedLga?.name || 'this selection'} yet
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {inspectedStats.pendingCount > 0
                        ? `${inspectedStats.pendingCount} submission(s) awaiting State Cabinet review.`
                        : 'Select another highlighted council on the map to inspect verified impact.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Demographic Reach Split Bar */}
              {inspectedStats.totalBeneficiaries > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#0B4619]" />
                      Demographic Reach
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-600">
                      Male {malePct}% · Female {femalePct}% · Youth {youthPct}%
                    </span>
                  </div>

                  <div className="h-2.5 w-full rounded-full overflow-hidden bg-slate-100 flex">
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: prefersReduced ? 0 : 0.45, ease: KINETIC_EASE }}
                      style={{ width: `${malePct}%`, transformOrigin: 'left' }}
                      className="bg-[#0B4619] h-full"
                      title={`Male: ${inspectedStats.maleBeneficiaries.toLocaleString()}`}
                    />
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: prefersReduced ? 0 : 0.45, delay: 0.08, ease: KINETIC_EASE }}
                      style={{ width: `${femalePct}%`, transformOrigin: 'left' }}
                      className="bg-[#D4AF37] h-full"
                      title={`Female: ${inspectedStats.femaleBeneficiaries.toLocaleString()}`}
                    />
                  </div>
                </div>
              )}

              {/* Clickable Verified Projects in Territory */}
              <div className="space-y-2 pt-2 border-t border-[#ECE8DD] flex-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900">
                    {inspectedLga ? `Verified Projects in ${inspectedLga.name}` : 'Leading Verified Projects'}
                  </span>
                  {inspectedStats.publishedCount > 0 && onJumpToRegistry && (
                    <button
                      onClick={() => {
                        if (inspectedLga && selectedLgaId !== inspectedLga.id) {
                          onSelectLga(inspectedLga.id);
                        }
                        onJumpToRegistry();
                      }}
                      className="text-[11px] font-semibold text-[#0B4619] hover:text-emerald-700 inline-flex items-center gap-0.5 cursor-pointer"
                    >
                      Open all ({inspectedStats.publishedCount})
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {topProjects.length > 0 ? (
                  <div className="divide-y divide-[#ECE8DD] border border-[#ECE8DD] rounded-xl overflow-hidden">
                    {topProjects.map((act) => (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => onViewActivity && onViewActivity(act)}
                        className="w-full text-left px-3.5 py-2.5 bg-white hover:bg-[#FAF8F2] transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 group-hover:text-[#0B4619] truncate">
                            {act.title}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 truncate mt-0.5">
                            <span>{getPillarDisplayName(act.pillar)}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums text-slate-700 font-medium">
                              {act.beneficiariesTotal.toLocaleString()} ben.
                            </span>
                          </div>
                        </div>
                        <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0B4619] shrink-0 transition-colors" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 py-2">
                    Click any shaded emerald council on the map to inspect its verified community dossiers.
                  </p>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Map Legend Footer */}
      <div className="px-4 sm:px-6 py-3 bg-[#FAF8F2] border-t border-[#ECE8DD] flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-semibold text-slate-900 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#0B4619]" />
            Intensity Legend:
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#f3f1ea] border border-slate-300" />
            <span>0 Verified</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#10b981]" />
            <span>Moderate Impact</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#047857]" />
            <span>Strong Reach</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#064e3b]" />
            <span>High Concentration</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#D4AF37] border border-[#072E14]" />
            <span>Selected LGA</span>
          </div>
        </div>

        <div className="text-slate-600 text-[11px] flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
          <span>Live verified aggregation across all 31 autonomous councils</span>
        </div>
      </div>
    </div>
  );
};
