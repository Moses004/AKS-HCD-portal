import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { KINETIC_EASE } from './MotionPrimitives';

export interface ImpactPulseProps {
  /** Number of verified/active projects represented by the adjacent metrics */
  projectCount?: number;
  /** Number of active LGAs represented by the adjacent metrics */
  activeLgasCount?: number;
  /** Optional total beneficiaries used to detect live metric deltas */
  beneficiariesTotal?: number;
  /** Layout variant: 'bar' integrates into the Public Portal KPI card header; 'compact' fits above Executive/LGA KPI grids */
  variant?: 'bar' | 'compact';
  /** Optional callback fired whenever a sync heartbeat pulse triggers */
  onPulseTrigger?: (pulseId: number) => void;
  /** Optional custom label */
  label?: string;
  className?: string;
}

function formatRelativeSync(isoTimestamp: string, nowMs: number): string {
  const parsed = Date.parse(isoTimestamp);
  if (Number.isNaN(parsed)) return 'Just now';
  const diffSec = Math.max(0, Math.floor((nowMs - parsed) / 1000));
  if (diffSec < 15) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(parsed).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const HEARTBEAT_TRACE_PATH =
  'M 2 12 L 15 12 L 19 12 L 23 5 L 27 19 L 31 3 L 35 15 L 39 11 L 43 12 L 62 12';

/**
 * Framer Motion 'Impact Pulse' heartbeat indicator tied to real DataContext sync
 * and grassroots HCD project updates. Uses GPU-composited transforms & opacity only,
 * honors prefers-reduced-motion, and maintains zero-pill typographic restraint.
 */
export const ImpactPulse: React.FC<ImpactPulseProps> = ({
  projectCount,
  activeLgasCount,
  beneficiariesTotal,
  variant = 'bar',
  onPulseTrigger,
  label = 'Impact Pulse',
  className = '',
}) => {
  const {
    activities,
    isSyncing,
    isLoading,
    lastDatabaseSyncTime,
    revalidateActivities,
    isOnline,
  } = useData();
  const prefersReduced = useReducedMotion();
  const rawGradientId = useId();
  const gradientId = `impact-pulse-grad-${rawGradientId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const [pulseId, setPulseId] = useState<number>(0);
  const [isSurging, setIsSurging] = useState<boolean>(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState<boolean>(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [displaySyncTime, setDisplaySyncTime] = useState<string>(lastDatabaseSyncTime);

  const surgeTimeoutRef = useRef<number | null>(null);
  const lastFingerprintRef = useRef<string | null>(null);
  const wasSyncingRef = useRef<boolean>(false);

  // Derive a lightweight fingerprint of the dataset so any synced project insert/update/approval triggers a pulse
  const dataFingerprint = useMemo(() => {
    let latestUpdated = '';
    let totalBen = 0;
    for (let i = 0; i < activities.length; i++) {
      const a = activities[i];
      totalBen += a.beneficiariesTotal || 0;
      if (a.updatedAt && a.updatedAt > latestUpdated) {
        latestUpdated = a.updatedAt;
      }
    }
    return `${lastDatabaseSyncTime}|${activities.length}|${totalBen}|${latestUpdated}|${
      beneficiariesTotal ?? ''
    }`;
  }, [activities, lastDatabaseSyncTime, beneficiariesTotal]);

  const onPulseTriggerRef = useRef(onPulseTrigger);
  useEffect(() => {
    onPulseTriggerRef.current = onPulseTrigger;
  }, [onPulseTrigger]);

  const firePulse = useRef((syncIso?: string) => {
    if (syncIso) {
      setDisplaySyncTime(syncIso);
    }
    setPulseId((prev) => prev + 1);
    setIsSurging(true);
    if (surgeTimeoutRef.current) {
      window.clearTimeout(surgeTimeoutRef.current);
    }
    surgeTimeoutRef.current = window.setTimeout(() => {
      setIsSurging(false);
    }, 2600);
  });

  // Notify optional parent listeners strictly post-commit (never inside a setState updater)
  useEffect(() => {
    if (pulseId > 0) {
      onPulseTriggerRef.current?.(pulseId);
    }
  }, [pulseId]);

  // Subtle opening heartbeat on mount once initial data settles
  useEffect(() => {
    if (isLoading) return;
    const timer = window.setTimeout(() => {
      firePulse.current(lastDatabaseSyncTime);
    }, 550);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // Trigger pulse whenever new project data syncs or dataset fingerprint updates
  useEffect(() => {
    if (lastFingerprintRef.current === null) {
      lastFingerprintRef.current = dataFingerprint;
      return;
    }
    if (lastFingerprintRef.current !== dataFingerprint) {
      lastFingerprintRef.current = dataFingerprint;
      setNowMs(Date.now());
      firePulse.current(lastDatabaseSyncTime);
    }
  }, [dataFingerprint, lastDatabaseSyncTime]);

  // Trigger pulse when background/manual sync transitions from syncing -> complete
  useEffect(() => {
    if (wasSyncingRef.current && !isSyncing) {
      setNowMs(Date.now());
      firePulse.current(new Date().toISOString());
    } else if (!wasSyncingRef.current && isSyncing) {
      firePulse.current();
    }
    wasSyncingRef.current = isSyncing;
  }, [isSyncing]);

  // Keep relative sync timestamp accurate
  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => {
      window.clearInterval(interval);
      if (surgeTimeoutRef.current) window.clearTimeout(surgeTimeoutRef.current);
    };
  }, []);

  const handleSyncClick = async () => {
    if (isManualRefreshing || isSyncing) return;
    setIsManualRefreshing(true);
    firePulse.current();
    try {
      await revalidateActivities();
    } finally {
      const nowIso = new Date().toISOString();
      setNowMs(Date.now());
      setDisplaySyncTime(nowIso);
      // Fire settling confirmation beat after revalidation completes
      window.setTimeout(() => {
        setIsManualRefreshing(false);
        firePulse.current(nowIso);
      }, 420);
    }
  };

  const activeSyncing = isSyncing || isManualRefreshing;
  const relativeTime = formatRelativeSync(displaySyncTime, nowMs);

  const statusPhrase = activeSyncing
    ? 'Syncing grassroots project data…'
    : !isOnline
    ? 'Local grassroots snapshot'
    : isSurging
    ? 'Project data synced across LGAs'
    : 'Grassroots HCD heartbeat';

  const resolvedProjects = projectCount ?? activities.filter((a) => a.status === 'PUBLISHED').length;

  return (
    <div
      className={`relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2 ${
        variant === 'bar'
          ? 'px-6 py-3.5 border-b border-[#EAEFED] bg-[#F6F8F7]/65 overflow-hidden'
          : 'px-4 py-2.5 rounded-xl border border-[#E2E8E5] bg-[#F6F8F7]/80'
      } ${className}`}
    >
      {/* Self-contained single-pass Emerald-Gold Resonance Shimmer along top edge when new data syncs */}
      {variant === 'bar' && !prefersReduced && pulseId > 0 && (
        <div
          key={`pulse-shimmer-${pulseId}`}
          aria-hidden="true"
          className="no-print pointer-events-none absolute top-0 left-0 right-0 h-[2px] z-20 overflow-hidden"
        >
          <motion.div
            className="w-2/3 h-full bg-gradient-to-r from-transparent via-[#D97706] to-[#0F5C3A]"
            initial={{ x: '-100%', opacity: 0.9 }}
            animate={{ x: '220%', opacity: 0 }}
            transition={{ duration: 1.35, ease: KINETIC_EASE }}
            style={{ willChange: 'transform, opacity' }}
          />
        </div>
      )}

      {/* Left: Concentric Heartbeat Emblem + ECG Trace + Editorial Metadata */}
      <div className="flex items-center gap-3.5 min-w-0">
        {/* Framer Motion Concentric Heartbeat Stage */}
        <div
          className="relative w-9 h-9 flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          {/* Ambient serene resting cadence (compositor-only) */}
          {!prefersReduced && (
            <motion.span
              className="no-print absolute inset-1 rounded-full border border-[#0F5C3A]/30 pointer-events-none"
              animate={{
                scale: activeSyncing ? [0.9, 1.85, 0.9] : [1, 1.55, 1],
                opacity: activeSyncing ? [0.55, 0, 0.55] : [0.24, 0, 0.24],
              }}
              transition={{
                duration: activeSyncing ? 1.15 : 3.6,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          )}

          {/* Sync Surge Staggered Concentric Ripples (Emerald + Heritage Gold Harmonic) */}
          {!prefersReduced && (
            <AnimatePresence>
              {pulseId > 0 && (
                <React.Fragment key={pulseId}>
                  {/* Wave 1: Primary Deep Emerald */}
                  <motion.span
                    className="no-print absolute inset-1.5 rounded-full border-[1.5px] border-[#0F5C3A] pointer-events-none"
                    initial={{ scale: 0.72, opacity: 0.7 }}
                    animate={{ scale: 2.35, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.25, ease: KINETIC_EASE }}
                    style={{ willChange: 'transform, opacity' }}
                  />
                  {/* Wave 2: Secondary Heritage Gold Harmonic */}
                  <motion.span
                    className="no-print absolute inset-1.5 rounded-full border-[1.5px] border-[#D97706] pointer-events-none"
                    initial={{ scale: 0.72, opacity: 0.85 }}
                    animate={{ scale: 2.75, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.45, delay: 0.18, ease: KINETIC_EASE }}
                    style={{ willChange: 'transform, opacity' }}
                  />
                  {/* Wave 3: Wide Botanical Halo Echo */}
                  <motion.span
                    className="no-print absolute inset-1 rounded-full bg-[#D97706]/15 pointer-events-none"
                    initial={{ scale: 0.78, opacity: 0.5 }}
                    animate={{ scale: 2.25, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.1, delay: 0.08, ease: KINETIC_EASE }}
                    style={{ willChange: 'transform, opacity' }}
                  />
                </React.Fragment>
              )}
            </AnimatePresence>
          )}

          {/* Outer Precision Ring */}
          <span
            className={`absolute inset-1 rounded-full border transition-colors duration-300 ${
              isSurging || activeSyncing
                ? 'border-[#D97706]/70 bg-emerald-50/70'
                : 'border-[#0F5C3A]/20 bg-white'
            }`}
          />

          {/* Center Double-Beat Cardiac Core */}
          <motion.span
            key={`core-${pulseId}`}
            className="relative z-10 w-3.5 h-3.5 rounded-full bg-[#0F5C3A] flex items-center justify-center shadow-xs"
            animate={
              prefersReduced
                ? undefined
                : {
                    scale: [1, 1.26, 0.94, 1.16, 1],
                  }
            }
            transition={{
              duration: 0.85,
              times: [0, 0.22, 0.42, 0.64, 1],
              ease: 'easeInOut',
            }}
            style={{ willChange: 'transform' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
          </motion.span>
        </div>

        {/* Crisp Grassroots Heartbeat Waveform Trace */}
        <svg
          width="64"
          height="22"
          viewBox="0 0 64 22"
          fill="none"
          aria-hidden="true"
          className="hidden sm:block shrink-0 overflow-visible"
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0F5C3A" stopOpacity="0.25" />
              <stop offset="50%" stopColor="#0F5C3A" stopOpacity="1" />
              <stop offset="82%" stopColor="#D97706" stopOpacity="1" />
              <stop offset="100%" stopColor="#D97706" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Subtle Resting Hairline Trace */}
          <path
            d={HEARTBEAT_TRACE_PATH}
            stroke="#0F5C3A"
            strokeOpacity="0.16"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Kinetic Sync Sweep Trace */}
          {!prefersReduced ? (
            <motion.path
              key={`wave-${pulseId}`}
              d={HEARTBEAT_TRACE_PATH}
              stroke={`url(#${gradientId})`}
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0.95 }}
              animate={{
                pathLength: [0, 1, 1],
                opacity: [0.95, 1, 0.28],
              }}
              transition={{
                duration: 1.5,
                times: [0, 0.62, 1],
                ease: KINETIC_EASE,
              }}
            />
          ) : (
            <path
              d={HEARTBEAT_TRACE_PATH}
              stroke="#0F5C3A"
              strokeOpacity="0.55"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>

        {/* Clean Unboxed Typographic Copy (Zero-Pill Discipline) */}
        <div className="min-w-0" aria-live="polite">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className="font-bold text-[#0F5C3A] tracking-tight whitespace-nowrap">
              {label}
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <motion.span
              key={statusPhrase}
              initial={prefersReduced ? false : { opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: KINETIC_EASE }}
              className={`font-medium truncate ${
                isSurging || activeSyncing ? 'text-[#0F5C3A]' : 'text-slate-600'
              }`}
            >
              {statusPhrase}
            </motion.span>
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
            <span>{resolvedProjects.toLocaleString()} verified projects</span>
            {activeLgasCount !== undefined && (
              <>
                <span aria-hidden="true" className="text-slate-300 font-sans">
                  ·
                </span>
                <span>{activeLgasCount}/31 LGAs active</span>
              </>
            )}
            <span aria-hidden="true" className="text-slate-300 font-sans">
              ·
            </span>
            <span>Synced {relativeTime}</span>
          </div>
        </div>
      </div>

      {/* Right: Functional Sync Control */}
      <button
        type="button"
        onClick={handleSyncClick}
        disabled={activeSyncing}
        className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0F5C3A] hover:text-emerald-950 bg-white hover:bg-emerald-50/80 border border-[#E2E8E5] hover:border-[#0F5C3A]/30 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F5C3A]/40"
        title="Check for newly synced grassroots HCD project updates"
      >
        <RefreshCw
          className={`w-3.5 h-3.5 text-[#0F5C3A] ${
            activeSyncing && !prefersReduced ? 'animate-spin' : ''
          }`}
        />
        <span>{activeSyncing ? 'Syncing' : 'Sync Pulse'}</span>
      </button>
    </div>
  );
};
