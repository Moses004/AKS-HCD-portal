import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useMotionValueEvent,
  useReducedMotion,
} from 'motion/react';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Compass,
  Download,
  MapPin,
} from 'lucide-react';
import { HCDActivity } from '../../types';
import { KINETIC_EASE } from '../common/MotionPrimitives';

type MilestoneEra = 'past' | 'present' | 'future';

interface EvolutionMilestone {
  id: string;
  indexLabel: string;
  year: string;
  era: MilestoneEra;
  eraLabel: string;
  phase: string;
  title: string;
  summary: string;
  keyMetricLabel: string;
  keyMetricValue: string;
  pillarFocus: string;
  deliverables: string[];
  actionLabel?: string;
  actionType?: 'map' | 'registry' | 'export';
}

export interface HcdEvolutionTimelineProps {
  publishedActivities: HCDActivity[];
  activeLgasCount: number;
  totalBeneficiaries: number;
  totalBudget: number;
  onJumpToMap?: () => void;
  onJumpToRegistry?: () => void;
  onOpenReportExport?: () => void;
}

const ERA_META: Record<
  MilestoneEra,
  { label: string; range: string; accentClass: string; nodeStyle: string }
> = {
  past: {
    label: 'Past',
    range: '2023–2025',
    accentClass: 'text-[#0F5C3A]',
    nodeStyle: 'bg-[#0F5C3A] border-[#0F5C3A]',
  },
  present: {
    label: 'Present',
    range: '2026 Live',
    accentClass: 'text-[#B45309]',
    nodeStyle: 'bg-[#D97706] border-[#0F5C3A]',
  },
  future: {
    label: 'Future',
    range: '2027–2030',
    accentClass: 'text-emerald-800',
    nodeStyle: 'bg-white border-[#0F5C3A]/60',
  },
};

export const HcdEvolutionTimeline: React.FC<HcdEvolutionTimelineProps> = ({
  publishedActivities,
  activeLgasCount,
  totalBeneficiaries,
  totalBudget,
  onJumpToMap,
  onJumpToRegistry,
  onOpenReportExport,
}) => {
  const prefersReduced = useReducedMotion();

  const runwayRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const mobileScrollRef = useRef<HTMLDivElement | null>(null);

  const [isDesktopSticky, setIsDesktopSticky] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [maxTranslateX, setMaxTranslateX] = useState<number>(1200);
  const [activeIndex, setActiveIndex] = useState<number>(3); // Highlight Present (2026) contextually on mobile/scrub
  const [scrubberPercent, setScrubberPercent] = useState<number>(0);
  const [isDraggingTrack, setIsDraggingTrack] = useState<boolean>(false);
  const dragOriginRef = useRef<{ startX: number; startScrollY: number; startScrollLeft: number } | null>(null);

  // Build state-wide past, present (live-data enriched), and future milestones
  const milestones: EvolutionMilestone[] = useMemo(() => {
    const budgetMillions = (totalBudget / 1_000_000).toFixed(1);
    return [
      {
        id: 'ms-2023-blueprint',
        indexLabel: '01',
        year: '2023',
        era: 'past',
        eraLabel: 'Past · Foundation',
        phase: 'Mandate & Policy Architecture',
        title: 'ARISE Agenda Human Capital Blueprint Inauguration',
        summary:
          'Akwa Ibom State formally anchored human capital development across Education, Primary Health, Technical Skills, Agriculture, and Civic Values under unified executive stewardship.',
        keyMetricLabel: 'Core Pillars Adopted',
        keyMetricValue: '6 Pillars',
        pillarFocus: 'Statewide Policy Charter',
        deliverables: [
          'Governor’s Council on HCD constituted',
          'Unified 31-council strategic KPI framework',
        ],
        actionLabel: 'Export Transparency Brief',
        actionType: 'export',
      },
      {
        id: 'ms-2024-desks',
        indexLabel: '02',
        year: '2024',
        era: 'past',
        eraLabel: 'Past · Institutionalization',
        phase: '31-Council Governance Network',
        title: '31-LGA Focal Desk Officers & Demographic Standards',
        summary:
          'Dedicated HCD desk officers were onboarded across all 31 Local Government Areas, introducing strict male, female, and youth demographic balance controls for every grassroots intervention.',
        keyMetricLabel: 'Council Coverage',
        keyMetricValue: '31 LGAs',
        pillarFocus: 'Cross-Cutting Governance',
        deliverables: [
          'Senatorial District coordination across Uyo, Ikot Ekpene & Eket',
          'Standardized ward-level beneficiary roll reporting',
        ],
        actionLabel: 'Explore 31-LGA Map',
        actionType: 'map',
      },
      {
        id: 'ms-2025-verification',
        indexLabel: '03',
        year: '2025',
        era: 'past',
        eraLabel: 'Past · Digital Assurance',
        phase: 'Geospatial & Photographic Proof',
        title: 'EXIF Geotagged Evidence & Cabinet Audit Gateways',
        summary:
          'Public transparency moved from periodic summaries to verified project dossiers—requiring photographic field proof, geographic coordinate bounds, and State Executive sign-off before publication.',
        keyMetricLabel: 'Audit Standard',
        keyMetricValue: '100% EXIF',
        pillarFocus: 'Open Civic Accountability',
        deliverables: [
          'Immutable published dossier approval workflow',
          'Offline-resilient field sync for riverine & rural wards',
        ],
        actionLabel: 'Browse Verified Dossiers',
        actionType: 'registry',
      },
      {
        id: 'ms-2026-live',
        indexLabel: '04',
        year: '2026',
        era: 'present',
        eraLabel: 'Present · Active Delivery',
        phase: 'Live Statewide Implementation',
        title: 'Grassroots Capacity Building & Livelihood Transition',
        summary:
          'Verified grassroots programs are actively scaling across Akwa Ibom councils—linking citizens directly from skills acquisition, primary care, and digital classrooms into sustainable enterprise.',
        keyMetricLabel: 'Verified Beneficiaries',
        keyMetricValue:
          totalBeneficiaries > 0 ? totalBeneficiaries.toLocaleString() : 'Live Sync',
        pillarFocus: `${activeLgasCount}/31 Active LGAs · ₦${budgetMillions}M`,
        deliverables: [
          `${publishedActivities.length.toLocaleString()} Cabinet-approved grassroots dossiers live`,
          'Real-time Livelihood Impact Flow & geospatial reporting',
        ],
        actionLabel: 'Inspect Live 31-LGA Map',
        actionType: 'map',
      },
      {
        id: 'ms-2027-hubs',
        indexLabel: '05',
        year: '2027',
        era: 'future',
        eraLabel: 'Future · Expansion',
        phase: 'Senatorial Innovation Scale',
        title: 'Senatorial Vocational, Agro-Enterprise & Digital Studios',
        summary:
          'Commissioning interconnected youth technical academies, solar-assisted agro-processing cooperatives, and digital engineering hubs serving every Senatorial District.',
        keyMetricLabel: 'Target Districts',
        keyMetricValue: '3 Hubs',
        pillarFocus: 'Vocational & Agriculture',
        deliverables: [
          'Certified trade-to-employment placement pipelines',
          'Cooperative micro-grant linkage for graduating cohorts',
        ],
        actionLabel: 'Review Current Dossiers',
        actionType: 'registry',
      },
      {
        id: 'ms-2028-parity',
        indexLabel: '06',
        year: '2028',
        era: 'future',
        eraLabel: 'Future · Integration',
        phase: 'Universal Ward-Level Parity',
        title: 'Smart Classrooms & Maternal Health Telemetry Statewide',
        summary:
          'Bridging rural and riverine gaps through universal primary healthcare readiness, teacher digital fluency, and women-led community enterprise funds across all 31 councils.',
        keyMetricLabel: 'Parity Horizon',
        keyMetricValue: '31 / 31 LGAs',
        pillarFocus: 'Education & Healthcare',
        deliverables: [
          'Full ward-level maternal & early-childhood coverage',
          'Cross-LGA youth STEM and literacy benchmarks',
        ],
        actionLabel: 'Export Public Brief',
        actionType: 'export',
      },
      {
        id: 'ms-2030-horizon',
        indexLabel: '07',
        year: '2030',
        era: 'future',
        eraLabel: 'Future · Long-Term Horizon',
        phase: 'Self-Sustaining Skilled Economy',
        title: 'Akwa Ibom 2030 Human Capital Prosperity Benchmark',
        summary:
          'A resilient, high-productivity Akwa Ibom workforce anchored in lifelong learning, measurable livelihood mobility, and permanent citizen-audited public investment governance.',
        keyMetricLabel: 'Horizon Benchmark',
        keyMetricValue: '2030 Vision',
        pillarFocus: 'All Six ARISE HCD Pillars',
        deliverables: [
          'Multi-year longitudinal livelihood impact ledger',
          'Institutionalized open-data civic transparency standard',
        ],
        actionLabel: 'Export Transparency Brief',
        actionType: 'export',
      },
    ];
  }, [publishedActivities.length, activeLgasCount, totalBeneficiaries, totalBudget]);

  const useStickyMode = isDesktopSticky && !prefersReduced;

  // Responsive breakpoint listener
  useEffect(() => {
    const updateMedia = () => {
      setIsDesktopSticky(window.innerWidth >= 1024);
    };
    updateMedia();
    window.addEventListener('resize', updateMedia);
    return () => window.removeEventListener('resize', updateMedia);
  }, []);

  // Measure horizontal track overflow cleanly so final card stops right at viewport edge
  useEffect(() => {
    const measure = () => {
      if (!viewportRef.current || !trackRef.current) return;
      const viewportW = viewportRef.current.clientWidth;
      const trackW = trackRef.current.scrollWidth;
      setMaxTranslateX(Math.max(0, trackW - viewportW));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (viewportRef.current) ro.observe(viewportRef.current);
    if (trackRef.current) ro.observe(trackRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [milestones.length, useStickyMode]);

  // Framer Motion vertical scroll progress across the sticky runway
  const { scrollYProgress } = useScroll({
    target: runwayRef,
    offset: ['start start', 'end end'],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 135,
    damping: 26,
    restDelta: 0.001,
  });

  const trackX = useTransform(smoothProgress, [0, 1], [0, -maxTranslateX]);
  const meridianScaleX = useTransform(smoothProgress, [0, 1], [0.06, 1]);
  const parallaxSubtleX = useTransform(smoothProgress, [0, 1], [24, -24]);

  // Synchronize active milestone index & scrubber readout with scroll progress in desktop sticky mode
  useMotionValueEvent(smoothProgress, 'change', (latest) => {
    if (!useStickyMode) return;
    const clamped = Math.max(0, Math.min(1, latest));
    setScrubberPercent(Math.round(clamped * 1000));
    const idx = Math.min(
      milestones.length - 1,
      Math.max(0, Math.round(clamped * (milestones.length - 1)))
    );
    setActiveIndex(idx);
  });

  // Sync mobile / reduced-motion horizontal native scroll container with scrubber & active index
  const handleMobileScroll = useCallback(() => {
    if (useStickyMode || !mobileScrollRef.current) return;
    const el = mobileScrollRef.current;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 0) return;
    const ratio = Math.max(0, Math.min(1, el.scrollLeft / maxScroll));
    setScrubberPercent(Math.round(ratio * 1000));
    const idx = Math.min(
      milestones.length - 1,
      Math.max(0, Math.round(ratio * (milestones.length - 1)))
    );
    setActiveIndex(idx);
  }, [useStickyMode, milestones.length]);

  // Scrub programmatically to a normalized progress [0..1]
  const scrubToProgress = useCallback(
    (ratio: number, instant = false) => {
      const clamped = Math.max(0, Math.min(1, ratio));
      if (useStickyMode && runwayRef.current) {
        const rect = runwayRef.current.getBoundingClientRect();
        const runwayTop = rect.top + window.scrollY;
        const scrollableSpan = Math.max(1, runwayRef.current.offsetHeight - window.innerHeight);
        const targetY = runwayTop + clamped * scrollableSpan;
        window.scrollTo({
          top: targetY,
          behavior: instant || prefersReduced ? 'auto' : 'smooth',
        });
      } else if (mobileScrollRef.current) {
        const el = mobileScrollRef.current;
        const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
        el.scrollTo({
          left: clamped * maxScroll,
          behavior: instant || prefersReduced ? 'auto' : 'smooth',
        });
        setScrubberPercent(Math.round(clamped * 1000));
        setActiveIndex(
          Math.min(
            milestones.length - 1,
            Math.max(0, Math.round(clamped * (milestones.length - 1)))
          )
        );
      }
    },
    [useStickyMode, prefersReduced, milestones.length]
  );

  const scrubToMilestone = useCallback(
    (index: number) => {
      const bounded = Math.max(0, Math.min(milestones.length - 1, index));
      const ratio = milestones.length > 1 ? bounded / (milestones.length - 1) : 0;
      scrubToProgress(ratio);
    },
    [milestones.length, scrubToProgress]
  );

  const jumpToEra = useCallback(
    (era: MilestoneEra) => {
      const firstIdx = milestones.findIndex((m) => m.era === era);
      if (firstIdx !== -1) {
        scrubToMilestone(firstIdx);
      }
    },
    [milestones, scrubToMilestone]
  );

  // Horizontal pointer drag-to-scrub on the desktop card stage
  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    if (!useStickyMode) return;
    setIsDraggingTrack(true);
    dragOriginRef.current = {
      startX: e.clientX,
      startScrollY: window.scrollY,
      startScrollLeft: 0,
    };
  };

  useEffect(() => {
    if (!isDraggingTrack) return;
    const handlePointerMove = (e: PointerEvent) => {
      if (!dragOriginRef.current || !runwayRef.current) return;
      const dx = dragOriginRef.current.startX - e.clientX;
      const scrollableSpan = Math.max(1, runwayRef.current.offsetHeight - window.innerHeight);
      const ratioDelta = maxTranslateX > 0 ? dx / maxTranslateX : 0;
      const targetY = dragOriginRef.current.startScrollY + ratioDelta * scrollableSpan;
      const rect = runwayRef.current.getBoundingClientRect();
      const runwayTop = rect.top + window.scrollY;
      const clampedY = Math.max(runwayTop, Math.min(runwayTop + scrollableSpan, targetY));
      window.scrollTo({ top: clampedY, behavior: 'auto' });
    };
    const handlePointerUp = () => {
      setIsDraggingTrack(false);
      dragOriginRef.current = null;
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isDraggingTrack, maxTranslateX]);

  const handleCardAction = (actionType?: EvolutionMilestone['actionType']) => {
    if (actionType === 'map') onJumpToMap?.();
    else if (actionType === 'registry') onJumpToRegistry?.();
    else if (actionType === 'export') onOpenReportExport?.();
  };

  const activeMilestone = milestones[activeIndex] || milestones[0];
  const progressFraction = scrubberPercent / 1000;

  return (
    <div
      ref={runwayRef}
      className={useStickyMode ? 'relative lg:h-[245vh]' : 'relative'}
    >
      <div
        className={
          useStickyMode
            ? 'lg:sticky lg:top-[76px] lg:min-h-[calc(100vh-92px)] flex flex-col justify-center py-8 lg:py-10'
            : 'py-8'
        }
      >
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 space-y-6">
          {/* Editorial Header + Era Quick-Jump Segmented Controls */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 border-b border-[#E2E8E5] pb-5">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[#0F5C3A]">
                <Compass className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>Chronological Roadmap</span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="text-slate-600 font-mono tabular-nums">2023 — 2030</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight text-balance">
                Akwa Ibom HCD Evolution Timeline
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Scroll, drag, or scrub across the state-wide trajectory of human capital development—from foundational policy adoption through live 31-LGA verification to the 2030 prosperity horizon.
              </p>
            </div>

            {/* Interactive Era Jump Tabs + Prev/Next Scrub Controls */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div
                role="group"
                aria-label="Jump to timeline era"
                className="inline-flex items-center p-1 bg-[#EFF4F1] rounded-xl border border-[#E2E8E5]"
              >
                {(['past', 'present', 'future'] as MilestoneEra[]).map((era) => {
                  const isActiveEra = activeMilestone.era === era;
                  return (
                    <button
                      key={era}
                      type="button"
                      onClick={() => jumpToEra(era)}
                      className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        isActiveEra
                          ? 'text-white'
                          : 'text-slate-600 hover:text-slate-950'
                      }`}
                    >
                      {isActiveEra && (
                        <motion.span
                          layoutId="hcd-evolution-era-pill"
                          transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                          className="absolute inset-0 rounded-lg bg-[#0F5C3A] shadow-xs"
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-1.5">
                        <span>{ERA_META[era].label}</span>
                        <span
                          className={`hidden sm:inline font-mono text-[10px] tabular-nums ${
                            isActiveEra ? 'text-[#FBBF24]' : 'text-slate-400'
                          }`}
                        >
                          {ERA_META[era].range}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="no-print flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => scrubToMilestone(activeIndex - 1)}
                  disabled={activeIndex <= 0}
                  aria-label="Previous milestone"
                  className="p-2 rounded-xl bg-white border border-[#E2E8E5] text-slate-700 hover:text-[#0F5C3A] hover:border-[#0F5C3A]/40 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrubToMilestone(activeIndex + 1)}
                  disabled={activeIndex >= milestones.length - 1}
                  aria-label="Next milestone"
                  className="p-2 rounded-xl bg-white border border-[#E2E8E5] text-slate-700 hover:text-[#0F5C3A] hover:border-[#0F5C3A]/40 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Horizontal Scroll-Linked Stage */}
          <div
            ref={viewportRef}
            onPointerDown={handleStagePointerDown}
            className={`relative overflow-x-clip rounded-2xl ${
              useStickyMode
                ? isDraggingTrack
                  ? 'cursor-grabbing select-none'
                  : 'cursor-grab'
                : ''
            }`}
          >
            {/* Subtle Edge Fade Masks on Desktop */}
            {useStickyMode && (
              <>
                <div
                  aria-hidden="true"
                  className="no-print pointer-events-none hidden lg:block absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#F6F8F7] to-transparent z-20"
                />
                <div
                  aria-hidden="true"
                  className="no-print pointer-events-none hidden lg:block absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#F6F8F7] to-transparent z-20"
                />
              </>
            )}

            {useStickyMode ? (
              <motion.div
                ref={trackRef}
                style={{ x: trackX, willChange: 'transform' }}
                className="relative flex items-stretch gap-6 py-4 pr-12 w-max"
              >
                {/* Continuous Horizontal Meridian Rule Behind Milestone Nodes */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-6 right-16 top-[26px] h-[2px] bg-[#E2E8E5]"
                >
                  <motion.div
                    style={{ scaleX: meridianScaleX, transformOrigin: '0% 50%' }}
                    className="h-full w-full bg-gradient-to-r from-[#0F5C3A] via-[#15803D] to-[#D97706]"
                  />
                </div>

                {milestones.map((ms, idx) => (
                  <MilestoneCard
                    key={ms.id}
                    milestone={ms}
                    isActive={idx === activeIndex}
                    isPassed={idx < activeIndex}
                    onSelect={() => scrubToMilestone(idx)}
                    onAction={() => handleCardAction(ms.actionType)}
                    prefersReduced={Boolean(prefersReduced)}
                  />
                ))}
              </motion.div>
            ) : (
              /* Mobile / Tablet / Reduced-Motion Native Horizontal Scrub Container */
              <div
                ref={mobileScrollRef}
                onScroll={handleMobileScroll}
                className="relative overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth"
              >
                <div ref={trackRef} className="relative flex items-stretch gap-5 py-3 pr-6 w-max">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-6 right-10 top-[22px] h-[2px] bg-[#E2E8E5]"
                  >
                    <div
                      className="h-full bg-gradient-to-r from-[#0F5C3A] via-[#15803D] to-[#D97706] transition-transform duration-200 origin-left"
                      style={{
                        transform: `scaleX(${Math.max(0.08, progressFraction)})`,
                      }}
                    />
                  </div>

                  {milestones.map((ms, idx) => (
                    <div key={ms.id} className="snap-start">
                      <MilestoneCard
                        milestone={ms}
                        isActive={idx === activeIndex}
                        isPassed={idx < activeIndex}
                        onSelect={() => scrubToMilestone(idx)}
                        onAction={() => handleCardAction(ms.actionType)}
                        prefersReduced={Boolean(prefersReduced)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Interactive Timeline Scrubber Bar & Year Chapter Ticks */}
          <div className="no-print bg-white rounded-2xl border border-[#E2E8E5] px-5 py-4 space-y-3.5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono font-bold text-[#0F5C3A] tabular-nums">
                  {activeMilestone.indexLabel} / 0{milestones.length}
                </span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="font-semibold text-slate-900 truncate">
                  {activeMilestone.year} — {activeMilestone.phase}
                </span>
              </div>

              <motion.div
                style={useStickyMode ? { x: parallaxSubtleX } : undefined}
                className="hidden md:flex items-center gap-2 text-[11px] text-slate-500 font-medium"
              >
                <span>{useStickyMode ? 'Scroll page or drag track to scrub' : 'Swipe or drag slider to scrub'}</span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="font-mono tabular-nums text-[#0F5C3A] font-semibold">
                  {Math.round(progressFraction * 100)}%
                </span>
              </motion.div>
            </div>

            {/* Scrubber Track + Accessible Range Input */}
            <div className="relative pt-1 pb-1">
              <div className="relative h-2 rounded-full bg-[#EFF4F1] overflow-hidden">
                {useStickyMode ? (
                  <motion.div
                    style={{ scaleX: meridianScaleX, transformOrigin: '0% 50%' }}
                    className="h-full w-full bg-gradient-to-r from-[#0F5C3A] via-[#15803D] to-[#D97706] rounded-full"
                  />
                ) : (
                  <div
                    className="h-full w-full bg-gradient-to-r from-[#0F5C3A] via-[#15803D] to-[#D97706] rounded-full origin-left transition-transform duration-150"
                    style={{ transform: `scaleX(${Math.max(0.06, progressFraction)})` }}
                  />
                )}
              </div>

              <input
                type="range"
                min={0}
                max={1000}
                step={1}
                value={scrubberPercent}
                aria-label="Scrub through Akwa Ibom HCD Evolution Timeline milestones"
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setScrubberPercent(val);
                  scrubToProgress(val / 1000, true);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-10"
              />
            </div>

            {/* Clickable Year Chapter Ticks */}
            <div className="grid grid-cols-7 gap-1 pt-0.5">
              {milestones.map((ms, idx) => {
                const isSelected = idx === activeIndex;
                return (
                  <button
                    key={ms.id}
                    type="button"
                    onClick={() => scrubToMilestone(idx)}
                    className={`group flex flex-col items-center gap-1 py-1 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5C3A]/40 ${
                      isSelected ? 'bg-[#F6F8F7]' : 'hover:bg-[#F6F8F7]/70'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full border transition-transform duration-200 ${
                        isSelected
                          ? 'scale-125 bg-[#D97706] border-[#0F5C3A]'
                          : idx < activeIndex
                          ? 'bg-[#0F5C3A] border-[#0F5C3A]'
                          : 'bg-white border-slate-300 group-hover:border-[#0F5C3A]/60'
                      }`}
                    />
                    <span
                      className={`text-[11px] font-mono tabular-nums transition-colors ${
                        isSelected
                          ? 'font-bold text-[#0F5C3A]'
                          : 'font-medium text-slate-500 group-hover:text-slate-800'
                      }`}
                    >
                      {ms.year}
                    </span>
                    <span className="hidden sm:block text-[10px] text-slate-400 capitalize truncate max-w-full px-1">
                      {ms.era}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface MilestoneCardProps {
  milestone: EvolutionMilestone;
  isActive: boolean;
  isPassed: boolean;
  onSelect: () => void;
  onAction: () => void;
  prefersReduced: boolean;
}

const MilestoneCard: React.FC<MilestoneCardProps> = ({
  milestone,
  isActive,
  isPassed,
  onSelect,
  onAction,
  prefersReduced,
}) => {
  const isPresent = milestone.era === 'present';
  const isFuture = milestone.era === 'future';

  return (
    <article
      onClick={onSelect}
      className="relative flex flex-col w-[300px] sm:w-[356px] lg:w-[392px] shrink-0 pt-10 group cursor-pointer"
    >
      {/* Meridian Node Sitting Directly on the Horizon Line */}
      <div className="absolute top-[10px] left-6 flex items-center gap-2.5 z-10">
        <motion.div
          animate={
            prefersReduced
              ? undefined
              : {
                  scale: isActive ? 1.2 : 1,
                }
          }
          transition={{ duration: 0.22, ease: KINETIC_EASE }}
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
            isPresent
              ? 'bg-[#D97706] border-[#0F5C3A] shadow-sm'
              : isActive || isPassed
              ? 'bg-[#0F5C3A] border-[#0F5C3A]'
              : 'bg-white border-[#0F5C3A]/45'
          }`}
        >
          {(isActive || isPresent) && (
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isPresent ? 'bg-[#0F5C3A]' : 'bg-[#D97706]'
              }`}
            />
          )}
        </motion.div>

        <span className="text-[11px] font-mono font-bold tabular-nums text-[#0F5C3A] bg-[#F6F8F7] px-1.5">
          {milestone.indexLabel} / {milestone.year}
        </span>
      </div>

      {/* Architectural Editorial Card Body (Single Elevation, Zero-Pill Metadata) */}
      <motion.div
        animate={
          prefersReduced
            ? undefined
            : {
                y: isActive ? -3 : 0,
              }
        }
        transition={{ duration: 0.24, ease: KINETIC_EASE }}
        className={`flex-1 flex flex-col justify-between rounded-2xl p-6 border transition-all duration-200 ${
          isPresent
            ? 'bg-gradient-to-b from-white via-white to-[#EFF4F1] border-[#D97706]/75 shadow-md shadow-emerald-950/8'
            : isActive
            ? 'bg-white border-[#0F5C3A]/45 shadow-md shadow-emerald-950/6'
            : isFuture
            ? 'bg-[#F9FBFA] border-[#E2E8E5] hover:border-[#0F5C3A]/30'
            : 'bg-white border-[#E2E8E5] hover:border-[#0F5C3A]/30'
        }`}
      >
        <div className="space-y-4">
          {/* Top Era & Year Editorial Row */}
          <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-[#EAEFED]">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <span
                  className={
                    isPresent
                      ? 'text-[#B45309]'
                      : isFuture
                      ? 'text-emerald-800'
                      : 'text-[#0F5C3A]'
                  }
                >
                  {milestone.eraLabel}
                </span>
              </div>
              <div className="text-xs text-slate-500 truncate">{milestone.phase}</div>
            </div>

            <div className="font-display text-3xl font-bold tracking-tight font-mono tabular-nums text-[#0F5C3A] leading-none shrink-0">
              {milestone.year}
            </div>
          </div>

          {/* Headline & Narrative */}
          <div className="space-y-2">
            <h3 className="font-display text-lg font-bold text-slate-950 leading-snug group-hover:text-[#0F5C3A] transition-colors text-balance">
              {milestone.title}
            </h3>
            <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed">
              {milestone.summary}
            </p>
          </div>

          {/* Key Quantitative Benchmark (Unboxed Hairline Strip) */}
          <div className="flex items-baseline justify-between gap-3 py-3 border-y border-[#EAEFED]">
            <div>
              <div className="text-[11px] font-semibold text-slate-500">
                {milestone.keyMetricLabel}
              </div>
              <div className="text-xs text-slate-600 mt-0.5 truncate max-w-[180px]">
                {milestone.pillarFocus}
              </div>
            </div>
            <div className="text-lg font-bold font-mono tabular-nums text-[#0F5C3A] shrink-0">
              {milestone.keyMetricValue}
            </div>
          </div>

          {/* Deliverables List */}
          <ul className="space-y-1.5 text-xs text-slate-600">
            {milestone.deliverables.map((item) => (
              <li key={item} className="flex items-start gap-2 leading-snug">
                <span
                  aria-hidden="true"
                  className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#D97706] shrink-0"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer Action */}
        {milestone.actionLabel && (
          <div className="pt-4 mt-4 border-t border-[#EAEFED] flex items-center justify-between">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAction();
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F5C3A] hover:text-emerald-800 transition-colors cursor-pointer"
            >
              {milestone.actionType === 'map' && <MapPin className="w-3.5 h-3.5" />}
              {milestone.actionType === 'export' && <Download className="w-3.5 h-3.5" />}
              <span>{milestone.actionLabel}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </motion.div>
    </article>
  );
};
