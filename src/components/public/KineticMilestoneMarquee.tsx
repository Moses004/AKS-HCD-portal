import React, { useMemo, useRef, useState } from 'react';
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from 'motion/react';
import {
  Award,
  CheckCircle2,
  Flag,
  MapPin,
  Pause,
  Play,
  ArrowUpRight,
  Landmark,
  Users,
  Sparkles,
} from 'lucide-react';
import { HCDActivity, StateHCDActivity, STATE_CATEGORY_LABELS } from '../../types';
import { KINETIC_EASE } from '../common/MotionPrimitives';

type StreamFilter = 'all' | 'milestones' | 'achievements';

interface MarqueeStatusItem {
  id: string;
  kind: 'milestone' | 'achievement';
  kicker: string;
  title: string;
  detail: string;
  metricBadge: string;
  activity?: HCDActivity;
  stateActivity?: StateHCDActivity;
  targetSectionId?: string;
}

interface KineticMilestoneMarqueeProps {
  publishedActivities: HCDActivity[];
  publishedStateActivities: StateHCDActivity[];
  totalBeneficiaries: number;
  totalBudget: number;
  activeLgasCount: number;
  onViewActivity: (activity: HCDActivity) => void;
  onViewStateActivity: (activity: StateHCDActivity) => void;
  onScrollToSection: (sectionId: string) => void;
}

const BASE_SPEED_PX_PER_SEC = 46;

export const KineticMilestoneMarquee: React.FC<KineticMilestoneMarqueeProps> = ({
  publishedActivities,
  publishedStateActivities,
  totalBeneficiaries,
  totalBudget,
  activeLgasCount,
  onViewActivity,
  onViewStateActivity,
  onScrollToSection,
}) => {
  const prefersReduced = useReducedMotion();
  const [filter, setFilter] = useState<StreamFilter>('all');
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const isHoveredRef = useRef(false);
  const currentVelocityFactorRef = useRef(1);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const baseX = useMotionValue(0);

  // Sync marquee kinetic energy subtly with page scroll velocity
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothScrollVelocity = useSpring(scrollVelocity, {
    damping: 42,
    stiffness: 260,
  });
  const velocityBoost = useTransform(smoothScrollVelocity, [-2400, 0, 2400], [2.4, 0, 2.4]);

  // Synthesize real-time Verified Project Milestones & State-Wide HCD Achievements
  const { milestoneItems, achievementItems, combinedItems } = useMemo(() => {
    const milestones: MarqueeStatusItem[] = [];
    const achievements: MarqueeStatusItem[] = [];

    // 1. Extract Verified Project Milestones from published LGA activities
    const sortedActs = [...publishedActivities].sort((a, b) => {
      const tA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const tB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return tB - tA;
    });

    for (const act of sortedActs) {
      if (Array.isArray(act.milestones) && act.milestones.length > 0) {
        // Prioritize completed or highest-progress milestone per verified dossier
        const sortedMs = [...act.milestones].sort((a, b) => {
          const scoreA = a.status === 'COMPLETED' ? 200 + a.phaseNumber : a.completionPercentage;
          const scoreB = b.status === 'COMPLETED' ? 200 + b.phaseNumber : b.completionPercentage;
          return scoreB - scoreA;
        });

        for (const ms of sortedMs.slice(0, 2)) {
          milestones.push({
            id: `ms-${act.id}-${ms.id}`,
            kind: 'milestone',
            kicker: `Verified Milestone · Phase ${ms.phaseNumber}`,
            title: ms.title,
            detail: `${act.lgaName} LGA · ${ms.keyDeliverable || act.title}`,
            metricBadge:
              ms.status === 'COMPLETED'
                ? '100% Verified'
                : `${Math.round(ms.completionPercentage || 0)}% Active`,
            activity: act,
          });
        }
      } else {
        milestones.push({
          id: `act-ms-${act.id}`,
          kind: 'milestone',
          kicker: `Verified Dossier · ${act.lgaName} LGA`,
          title: act.title,
          detail: `${act.community || act.lgaName} · ${act.beneficiariesTotal.toLocaleString()} citizens reached`,
          metricBadge: `${act.overallProgress ?? 100}% Delivered`,
          activity: act,
        });
      }
    }

    // 2. Build State-Wide HCD Achievements from live statewide aggregates & State Executive activities
    const totalYouth = publishedActivities.reduce((sum, a) => sum + (a.youthBeneficiaries || 0), 0);
    const totalFemale = publishedActivities.reduce((sum, a) => sum + (a.beneficiariesFemale || 0), 0);
    const femalePct =
      totalBeneficiaries > 0 ? Math.round((totalFemale / totalBeneficiaries) * 100) : 0;

    if (totalBeneficiaries > 0) {
      achievements.push({
        id: 'ach-state-beneficiaries',
        kind: 'achievement',
        kicker: 'State-Wide HCD Achievement',
        title: `${totalBeneficiaries.toLocaleString()} Citizens Biometrically Documented`,
        detail: `Verified grassroots impact recorded across ${activeLgasCount} of 31 Local Government Areas`,
        metricBadge: `${activeLgasCount}/31 LGAs`,
        targetSectionId: 'map-section',
      });
    }

    if (totalBudget > 0) {
      achievements.push({
        id: 'ach-state-capital',
        kind: 'achievement',
        kicker: 'ARISE HCD Capital Deployment',
        title: `₦${(totalBudget / 1_000_000).toFixed(1)}M Invested in Grassroots Capacity`,
        detail: `${publishedActivities.length} Cabinet-verified dossiers audited with field proof`,
        metricBadge: `${publishedActivities.length} Dossiers`,
        targetSectionId: 'registry-section',
      });
    }

    if (totalYouth > 0) {
      achievements.push({
        id: 'ach-state-youth',
        kind: 'achievement',
        kicker: 'Demographic Dividend Milestone',
        title: `${totalYouth.toLocaleString()} Youth Empowered Across ARISE Pillars`,
        detail: `${femalePct}% female participation verified across skills, health & learning hubs`,
        metricBadge: `${femalePct}% Female`,
        targetSectionId: 'pillars-section',
      });
    }

    for (const stAct of publishedStateActivities.slice(0, 6)) {
      achievements.push({
        id: `state-ach-${stAct.id}`,
        kind: 'achievement',
        kicker: `State Achievement · ${STATE_CATEGORY_LABELS[stAct.category] || 'State Initiative'}`,
        title: stAct.title,
        detail: `${stAct.lead_institution} · ${stAct.location || 'Akwa Ibom State'}`,
        metricBadge: stAct.activity_code || 'Published',
        stateActivity: stAct,
      });
    }

    // Interleave verified project milestones and state-wide achievements cleanly
    const interleaved: MarqueeStatusItem[] = [];
    const maxLen = Math.max(milestones.length, achievements.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < milestones.length) interleaved.push(milestones[i]);
      if (i < achievements.length) interleaved.push(achievements[i]);
    }

    return {
      milestoneItems: milestones.slice(0, 14),
      achievementItems: achievements.slice(0, 10),
      combinedItems: interleaved.slice(0, 18),
    };
  }, [
    publishedActivities,
    publishedStateActivities,
    totalBeneficiaries,
    totalBudget,
    activeLgasCount,
  ]);

  const activeItems = useMemo(() => {
    if (filter === 'milestones' && milestoneItems.length > 0) return milestoneItems;
    if (filter === 'achievements' && achievementItems.length > 0) return achievementItems;
    return combinedItems;
  }, [filter, milestoneItems, achievementItems, combinedItems]);

  // Continuous Framer Motion frame loop with smooth hover deceleration & scroll-velocity sync
  useAnimationFrame((_time, delta) => {
    if (prefersReduced || activeItems.length === 0) return;

    const targetFactor = isManuallyPaused || isHoveredRef.current ? 0 : 1;
    // Smooth exponential damping for velvety pause/resume transitions
    currentVelocityFactorRef.current +=
      (targetFactor - currentVelocityFactorRef.current) * Math.min(1, delta / 180);

    if (currentVelocityFactorRef.current < 0.005) return;

    const trackEl = trackRef.current;
    if (!trackEl) return;

    const halfWidth = trackEl.scrollWidth / 2;
    if (halfWidth <= 0) return;

    const scrollBoost = Math.min(Math.abs(velocityBoost.get()), 2.4);
    const speed = BASE_SPEED_PX_PER_SEC * (1 + scrollBoost) * currentVelocityFactorRef.current;
    const moveBy = (speed * Math.min(delta, 48)) / 1000;

    let nextX = baseX.get() - moveBy;
    if (nextX <= -halfWidth) {
      nextX += halfWidth;
    }
    baseX.set(nextX);
  });

  if (activeItems.length === 0) return null;

  // Duplicate list for seamless infinite loop when animated
  const renderedItems = prefersReduced ? activeItems : [...activeItems, ...activeItems];

  const handleItemClick = (item: MarqueeStatusItem) => {
    if (item.activity) {
      onViewActivity(item.activity);
    } else if (item.stateActivity) {
      onViewStateActivity(item.stateActivity);
    } else if (item.targetSectionId) {
      onScrollToSection(item.targetSectionId);
    }
  };

  return (
    <div
      aria-label="Verified Project Milestones and State-Wide HCD Achievements Marquee"
      className="relative rounded-2xl border border-emerald-900/15 bg-gradient-to-r from-[#062411] via-[#0B4619] to-[#062411] shadow-md shadow-emerald-950/10 overflow-hidden"
    >
      {/* Top Crest Gold Hairline Accent */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#D4AF37]/80 to-transparent" />

      {/* Marquee Header Bar: Live Identity, Filter Tabs & Playback Control */}
      <div className="px-4 sm:px-5 py-2.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
            {!prefersReduced && !isManuallyPaused && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4AF37] opacity-75" />
            )}
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#D4AF37]" />
          </span>
          <span className="text-[11px] sm:text-xs font-bold tracking-wide text-white uppercase truncate">
            Live Status Feed · Verified Project Milestones &amp; State-Wide HCD Achievements
          </span>
        </div>

        <div className="no-print flex items-center gap-2">
          {/* Stream Scope Switcher */}
          <div
            role="tablist"
            aria-label="Filter marquee status updates"
            className="flex items-center gap-0.5 bg-white/8 border border-white/12 p-0.5 rounded-lg text-[11px]"
          >
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'milestones', label: `Milestones (${milestoneItems.length})` },
                { id: 'achievements', label: `State Achievements (${achievementItems.length})` },
              ] as const
            ).map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setFilter(tab.id);
                    baseX.set(0);
                  }}
                  className={`relative px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    active ? 'text-[#051F0E]' : 'text-emerald-100/85 hover:text-white'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="kineticMarqueeFilterBg"
                      transition={{ duration: 0.22, ease: KINETIC_EASE }}
                      className="absolute inset-0 rounded-md bg-[#D4AF37]"
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {!prefersReduced && (
            <button
              type="button"
              onClick={() => setIsManuallyPaused((p) => !p)}
              aria-label={isManuallyPaused ? 'Resume milestone marquee' : 'Pause milestone marquee'}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[#D4AF37] border border-white/12 transition-colors cursor-pointer"
              title={isManuallyPaused ? 'Resume marquee' : 'Pause marquee'}
            >
              {isManuallyPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Framer Motion Kinetic Track */}
      <div
        onMouseEnter={() => {
          isHoveredRef.current = true;
        }}
        onMouseLeave={() => {
          isHoveredRef.current = false;
        }}
        onFocusCapture={() => {
          isHoveredRef.current = true;
        }}
        onBlurCapture={() => {
          isHoveredRef.current = false;
        }}
        className={`relative py-3.5 ${
          prefersReduced ? 'overflow-x-auto px-4' : 'overflow-hidden'
        }`}
      >
        {/* Soft Left & Right Edge Vignette Masks */}
        {!prefersReduced && (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-12 sm:w-20 z-10 bg-gradient-to-r from-[#062411] via-[#062411]/80 to-transparent"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-12 sm:w-20 z-10 bg-gradient-to-l from-[#062411] via-[#062411]/80 to-transparent"
            />
          </>
        )}

        <motion.div
          ref={trackRef}
          style={prefersReduced ? undefined : { x: baseX, willChange: 'transform' }}
          className="flex items-stretch gap-3.5 w-max px-3"
        >
          {renderedItems.map((item, idx) => {
            const isAchievement = item.kind === 'achievement';
            return (
              <motion.button
                key={`${item.id}-${idx}`}
                type="button"
                onClick={() => handleItemClick(item)}
                whileHover={prefersReduced ? undefined : { y: -2, scale: 1.015 }}
                whileTap={prefersReduced ? undefined : { scale: 0.985 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                className={`group text-left w-[300px] sm:w-[340px] shrink-0 rounded-xl px-4 py-3 border backdrop-blur-md transition-colors cursor-pointer flex flex-col justify-between gap-2 ${
                  isAchievement
                    ? 'bg-gradient-to-br from-[#D4AF37]/16 via-white/[0.08] to-emerald-950/40 border-[#D4AF37]/35 hover:border-[#D4AF37]/70'
                    : 'bg-white/[0.08] hover:bg-white/[0.13] border-white/15 hover:border-emerald-300/45'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[10.5px]">
                  <span
                    className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-wider truncate ${
                      isAchievement ? 'text-[#F4D97A]' : 'text-emerald-300'
                    }`}
                  >
                    {isAchievement ? (
                      item.stateActivity ? (
                        <Landmark className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <Award className="w-3.5 h-3.5 shrink-0" />
                      )
                    ) : (
                      <Flag className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="truncate">{item.kicker}</span>
                  </span>

                  <span
                    className={`font-mono tabular-nums font-bold px-2 py-0.5 rounded-md text-[10px] shrink-0 ${
                      isAchievement
                        ? 'bg-[#D4AF37]/20 text-[#F4D97A] border border-[#D4AF37]/35'
                        : 'bg-emerald-400/15 text-emerald-200 border border-emerald-300/25'
                    }`}
                  >
                    {item.metricBadge}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-xs sm:text-[13px] font-bold text-white leading-snug line-clamp-1 group-hover:text-[#F4D97A] transition-colors">
                    {item.title}
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-emerald-100/80">
                    <span className="inline-flex items-center gap-1 min-w-0 truncate">
                      {isAchievement ? (
                        item.stateActivity ? (
                          <Sparkles className="w-3 h-3 text-[#D4AF37] shrink-0" />
                        ) : (
                          <Users className="w-3 h-3 text-[#D4AF37] shrink-0" />
                        )
                      ) : (
                        <MapPin className="w-3 h-3 text-emerald-300 shrink-0" />
                      )}
                      <span className="truncate">{item.detail}</span>
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#D4AF37] opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
                  </div>
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      </div>

      {/* Subtle Bottom Status Caption */}
      <div className="px-4 sm:px-5 py-1.5 bg-black/20 border-t border-white/8 flex items-center justify-between text-[10px] text-emerald-200/75">
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>Hover any card to pause · Click to inspect verified dossier or impact section</span>
        </span>
        <span className="hidden sm:inline font-mono tabular-nums text-[#D4AF37]/85">
          {milestoneItems.length} Milestones · {achievementItems.length} State Achievements
        </span>
      </div>
    </div>
  );
};
