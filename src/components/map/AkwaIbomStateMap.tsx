import React, { useState, useMemo } from 'react';
import { ALL_31_LGAS } from '../../data/lgas';
import { LGA, HCDActivity } from '../../types';
import { HcdLogo } from '../common/Logos';
import { Layers, MapPin, ZoomIn, ZoomOut, RotateCcw, CheckCircle2 } from 'lucide-react';

interface AkwaIbomStateMapProps {
  activities: HCDActivity[];
  selectedLgaId: string | null;
  onSelectLga: (lgaId: string | null) => void;
}

export const AkwaIbomStateMap: React.FC<AkwaIbomStateMapProps> = ({
  activities,
  selectedLgaId,
  onSelectLga,
}) => {
  const [hoveredLga, setHoveredLga] = useState<LGA | null>(null);
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [metricView, setMetricView] = useState<'beneficiaries' | 'activities'>('beneficiaries');
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Compute metrics per LGA
  const lgaMetrics = useMemo(() => {
    const map = new Map<string, { totalBeneficiaries: number; publishedCount: number; pendingCount: number }>();
    
    ALL_31_LGAS.forEach((lga) => {
      map.set(lga.id, { totalBeneficiaries: 0, publishedCount: 0, pendingCount: 0 });
    });

    activities.forEach((act) => {
      const current = map.get(act.lgaId) || { totalBeneficiaries: 0, publishedCount: 0, pendingCount: 0 };
      if (act.status === 'PUBLISHED') {
        current.totalBeneficiaries += act.beneficiariesTotal;
        current.publishedCount += 1;
      } else if (act.status === 'PENDING_APPROVAL') {
        current.pendingCount += 1;
      }
      map.set(act.lgaId, current);
    });

    return map;
  }, [activities]);

  const maxBeneficiaries = useMemo(() => {
    let max = 1;
    lgaMetrics.forEach((val) => {
      if (val.totalBeneficiaries > max) max = val.totalBeneficiaries;
    });
    return max;
  }, [lgaMetrics]);

  const maxActivities = useMemo(() => {
    let max = 1;
    lgaMetrics.forEach((val) => {
      if (val.publishedCount > max) max = val.publishedCount;
    });
    return max;
  }, [lgaMetrics]);

  // Color interpolation for choropleth
  const getLgaFillColor = (lga: LGA, isSelected: boolean, isHovered: boolean) => {
    if (isSelected) return '#D4AF37'; // Crest Gold
    if (isHovered) return '#10b981'; // Emerald 500

    // Filter by district dimming
    if (districtFilter !== 'all') {
      const matchDistrict = 
        (districtFilter === 'uyo' && lga.senatorialDistrict.includes('North-East')) ||
        (districtFilter === 'ikot-ekpene' && lga.senatorialDistrict.includes('North-West')) ||
        (districtFilter === 'eket' && lga.senatorialDistrict.includes('South'));
      if (!matchDistrict) return '#e2e8f0'; // Dimmed slate
    }

    const metrics = lgaMetrics.get(lga.id) || { totalBeneficiaries: 0, publishedCount: 0 };
    const ratio = metricView === 'beneficiaries'
      ? (metrics.totalBeneficiaries / (maxBeneficiaries || 1))
      : (metrics.publishedCount / (maxActivities || 1));

    if (metrics.publishedCount === 0) return '#f1f5f9'; // Slate 100
    if (ratio > 0.6) return '#064e3b'; // Deep emerald 900
    if (ratio > 0.3) return '#047857'; // Emerald 700
    return '#10b981'; // Emerald 500
  };

  const filteredLgas = ALL_31_LGAS.filter((lga) => {
    if (districtFilter === 'all') return true;
    if (districtFilter === 'uyo') return lga.senatorialDistrict.includes('North-East');
    if (districtFilter === 'ikot-ekpene') return lga.senatorialDistrict.includes('North-West');
    if (districtFilter === 'eket') return lga.senatorialDistrict.includes('South');
    return true;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
      {/* Map Control Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center bg-white p-1.5 rounded-xl border border-[#D4AF37]/60 shadow-xs shrink-0">
            <HcdLogo className="w-6 h-6 object-contain" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Akwa Ibom State Geospatial Impact Map
              <span className="text-xs font-medium text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                31 LGAs
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Interactive territorial heat map of localized human capital investments
            </p>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Senatorial District Filter */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-lg text-xs font-medium">
            <button
              onClick={() => setDistrictFilter('all')}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                districtFilter === 'all'
                  ? 'bg-emerald-950 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All 31 LGAs
            </button>
            <button
              onClick={() => setDistrictFilter('uyo')}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                districtFilter === 'uyo'
                  ? 'bg-emerald-950 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Uyo (NE)
            </button>
            <button
              onClick={() => setDistrictFilter('ikot-ekpene')}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                districtFilter === 'ikot-ekpene'
                  ? 'bg-emerald-950 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ikot Ekpene (NW)
            </button>
            <button
              onClick={() => setDistrictFilter('eket')}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                districtFilter === 'eket'
                  ? 'bg-emerald-950 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Eket (South)
            </button>
          </div>

          {/* Metric View Toggle */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-lg text-xs">
            <button
              onClick={() => setMetricView('beneficiaries')}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                metricView === 'beneficiaries'
                  ? 'bg-emerald-700 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Beneficiaries
            </button>
            <button
              onClick={() => setMetricView('activities')}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                metricView === 'activities'
                  ? 'bg-emerald-700 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Projects Count
            </button>
          </div>

          {/* Zoom & Reset */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-lg">
            <button
              onClick={() => setZoomLevel((z) => Math.min(z + 0.2, 1.8))}
              title="Zoom In"
              className="p-1 hover:bg-slate-100 rounded text-slate-600"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel((z) => Math.max(z - 0.2, 0.8))}
              title="Zoom Out"
              className="p-1 hover:bg-slate-100 rounded text-slate-600"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            {selectedLgaId && (
              <button
                onClick={() => onSelectLga(null)}
                title="Reset Selection"
                className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-900 hover:bg-amber-100 rounded text-xs font-medium"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Map Canvas Area */}
      <div className="relative w-full bg-gradient-to-b from-slate-50 via-white to-emerald-50/20 p-4 sm:p-6 overflow-hidden min-h-[460px] flex items-center justify-center">
        {/* Subtle Map Watermarks / Coordinate grid */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.75" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-pattern)" />
          </svg>
        </div>

        {/* Bight of Bonny / Atlantic Coastline Label (South) */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] tracking-widest uppercase font-semibold text-sky-800/60 pointer-events-none flex items-center gap-2">
          <span>≋ Atlantic Ocean / Bight of Bonny (Coastal Boundary) ≋</span>
        </div>

        {/* SVG Territorial Map */}
        <div
          className="relative w-full max-w-4xl transition-transform duration-300 origin-center"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <svg
            viewBox="100 20 540 500"
            className="w-full h-auto drop-shadow-md select-none"
            style={{ maxHeight: '520px' }}
          >
            {/* Ambient Coastal Water Body */}
            <path
              d="M 120 480 Q 280 510 400 495 T 620 480 L 620 520 L 120 520 Z"
              fill="#e0f2fe"
              stroke="#bae6fd"
              strokeWidth="1.5"
            />

            {/* Render 31 LGA Polygons */}
            {ALL_31_LGAS.map((lga) => {
              const { x, y, w, h, labelX = x + w / 2, labelY = y + h / 2 } = lga.svgData;
              const isSelected = selectedLgaId === lga.id;
              const isHovered = hoveredLga?.id === lga.id;
              const fillColor = getLgaFillColor(lga, isSelected, isHovered);
              const metrics = lgaMetrics.get(lga.id) || { totalBeneficiaries: 0, publishedCount: 0 };

              return (
                <g
                  key={lga.id}
                  onClick={() => onSelectLga(isSelected ? null : lga.id)}
                  onMouseEnter={() => setHoveredLga(lga)}
                  onMouseLeave={() => setHoveredLga(null)}
                  className="cursor-pointer transition-all duration-150 group"
                >
                  {/* LGA Shape (Rounded rect with subtle organic bevels) */}
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    rx="8"
                    ry="8"
                    fill={fillColor}
                    stroke={isSelected ? '#0B4619' : isHovered ? '#047857' : '#ffffff'}
                    strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 1.5}
                    className="transition-colors duration-200"
                  />

                  {/* Impact Indicator dot if published activities exist */}
                  {metrics.publishedCount > 0 && (
                    <circle
                      cx={x + w - 7}
                      cy={y + 7}
                      r={metrics.publishedCount > 1 ? 4 : 3}
                      fill={isSelected ? '#0B4619' : '#D4AF37'}
                      stroke="#ffffff"
                      strokeWidth="1"
                    />
                  )}

                  {/* LGA Name Text Label */}
                  <text
                    x={labelX}
                    y={labelY - 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className={`text-[9.5px] font-bold pointer-events-none transition-colors ${
                      isSelected
                        ? 'fill-slate-950 font-extrabold'
                        : isHovered
                        ? 'fill-white font-extrabold'
                        : fillColor === '#064e3b' || fillColor === '#047857'
                        ? 'fill-white'
                        : 'fill-slate-700'
                    }`}
                  >
                    {lga.name}
                  </text>

                  {/* Beneficiary count preview badge on hover/selected */}
                  <text
                    x={labelX}
                    y={labelY + 10}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className={`text-[7.5px] pointer-events-none tabular-nums ${
                      isSelected
                        ? 'fill-slate-900 font-semibold'
                        : isHovered
                        ? 'fill-emerald-100 font-medium'
                        : fillColor === '#064e3b' || fillColor === '#047857'
                        ? 'fill-emerald-200'
                        : 'fill-slate-400'
                    }`}
                  >
                    {metrics.publishedCount > 0
                      ? `${metrics.totalBeneficiaries.toLocaleString()} ben.`
                      : '0 projects'}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Live Hover Tooltip Card */}
        {hoveredLga && (
          <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-xl rounded-xl p-3.5 max-w-xs animate-in fade-in zoom-in-95 pointer-events-none">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 mb-2">
              <div>
                <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider block">
                  Local Government Area
                </span>
                <h4 className="text-base font-bold text-slate-900 leading-tight">
                  {hoveredLga.name} LGA
                </h4>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                HQ: {hoveredLga.headquarters}
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-2">
              <span className="font-medium text-slate-700">District:</span> {hoveredLga.senatorialDistrict}
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
              <div className="bg-emerald-50/70 p-2 rounded-lg">
                <span className="text-[10px] text-emerald-800 font-medium block">Beneficiaries</span>
                <span className="text-sm font-bold text-emerald-950 tabular-nums">
                  {(lgaMetrics.get(hoveredLga.id)?.totalBeneficiaries || 0).toLocaleString()}
                </span>
              </div>
              <div className="bg-amber-50/70 p-2 rounded-lg">
                <span className="text-[10px] text-amber-800 font-medium block">Verified Projects</span>
                <span className="text-sm font-bold text-amber-950 tabular-nums">
                  {lgaMetrics.get(hoveredLga.id)?.publishedCount || 0}
                </span>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 mt-2 text-center">
              Click polygon to filter all dashboard metrics to {hoveredLga.name}
            </p>
          </div>
        )}

        {/* Selected LGA Indicator Banner */}
        {selectedLgaId && (
          <div className="absolute top-4 right-4 z-20 bg-emerald-950 text-white shadow-lg rounded-xl px-4 py-2.5 flex items-center gap-3 border border-[#D4AF37]/40">
            <div className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] animate-pulse" />
            <div>
              <div className="text-[10px] text-emerald-200 uppercase font-semibold">Active Territorial Filter</div>
              <div className="text-sm font-bold text-white">
                {ALL_31_LGAS.find((l) => l.id === selectedLgaId)?.name} LGA Selected
              </div>
            </div>
            <button
              onClick={() => onSelectLga(null)}
              className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded transition-colors text-emerald-100"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Map Legend Footer */}
      <div className="p-3 sm:px-6 bg-slate-50 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-700" />
            Intensity Legend:
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[#f1f5f9] border border-slate-300" />
            <span>0 Verified Projects</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[#10b981]" />
            <span>Moderate Impact</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[#064e3b]" />
            <span>High Impact Focus</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-[#D4AF37] border border-[#0B4619]" />
            <span>Selected LGA</span>
          </div>
        </div>

        <div className="text-slate-500 text-[11px] flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Real-time aggregation across all 31 autonomous councils</span>
        </div>
      </div>
    </div>
  );
};
