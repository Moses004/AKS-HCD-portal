import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'motion/react';
import {
  Camera,
  Video,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  ArrowUpRight,
  MapPin,
  Film,
  Compass,
} from 'lucide-react';
import { HCDActivity, StateHCDActivity, VerificationMedia, StateEvidenceFile } from '../../types';
import { resolveActivityMedia, isDocumentMedia, ResolvableMediaInput } from '../../lib/mediaResolver';

export interface HeroBackdropSlide {
  id: string;
  url: string;
  mediaType: 'photo' | 'video';
  title: string;
  subtitle: string;
  locationLabel: string;
  caption?: string;
  coordinates?: { lat: number; lng: number };
  exifVerified?: boolean;
  source: 'lga_dossier' | 'state_dossier' | 'curated_showcase';
  activity?: HCDActivity;
  stateActivity?: StateHCDActivity;
}

export interface CuratedFallbackVisual {
  src: string;
  alt: string;
  pillarKey: string;
  title: string;
  locationLabel: string;
}

interface RawMediaCandidate {
  id: string;
  dedupeKey: string;
  mediaType: 'photo' | 'video';
  input: ResolvableMediaInput;
  title: string;
  subtitle: string;
  locationLabel: string;
  caption?: string;
  coordinates?: { lat: number; lng: number };
  exifVerified?: boolean;
  source: 'lga_dossier' | 'state_dossier';
  activity?: HCDActivity;
  stateActivity?: StateHCDActivity;
}

const PHOTO_DURATION_MS = 6000;
const VIDEO_MAX_DURATION_MS = 16000;
const RESOLVE_BATCH_SIZE = 6;
const CINEMATIC_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.ogg'];
const DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.csv', '.txt'];

function stripQuery(raw?: string | null): string {
  if (!raw) return '';
  return raw.split('?')[0].toLowerCase().trim();
}

function hasExtension(values: Array<string | null | undefined>, exts: string[]): boolean {
  return values.some((val) => {
    const clean = stripQuery(val);
    return clean.length > 0 && exts.some((ext) => clean.endsWith(ext));
  });
}

function isCandidateDocument(params: {
  type?: string;
  fileName?: string;
  mimeType?: string;
  storagePath?: string | null;
  url?: string | null;
}): boolean {
  if (
    isDocumentMedia({
      type: params.type,
      fileName: params.fileName,
      mimeType: params.mimeType,
    })
  ) {
    return true;
  }
  return hasExtension([params.fileName, params.storagePath, params.url], DOCUMENT_EXTENSIONS);
}

function isCandidateVideo(params: {
  type?: string;
  fileName?: string;
  mimeType?: string;
  storagePath?: string | null;
  url?: string | null;
}): boolean {
  if (params.type === 'video') return true;
  const mime = (params.mimeType || '').toLowerCase();
  if (mime.startsWith('video/')) return true;
  return hasExtension([params.fileName, params.storagePath, params.url], VIDEO_EXTENSIONS);
}

/**
 * Interleave media candidates across different dossiers so the Hero carousel
 * showcases diverse LGAs and projects right from the opening transitions while
 * still cycling through every single verified photo and video.
 */
function interleaveByGroup<T>(groups: T[][]): T[] {
  const result: T[] = [];
  let maxLen = 0;
  for (const g of groups) {
    if (g.length > maxLen) maxLen = g.length;
  }
  for (let i = 0; i < maxLen; i++) {
    for (const g of groups) {
      if (i < g.length) {
        result.push(g[i]);
      }
    }
  }
  return result;
}

function buildLgaMediaCandidates(activities: HCDActivity[]): RawMediaCandidate[][] {
  const sorted = [...activities].sort((a, b) => {
    const tA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const tB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return tB - tA;
  });

  const groups: RawMediaCandidate[][] = [];
  for (const activity of sorted) {
    const assets: VerificationMedia[] = Array.isArray(activity.mediaAssets)
      ? activity.mediaAssets
      : [];
    if (assets.length === 0) continue;

    const group: RawMediaCandidate[] = [];
    assets.forEach((asset, idx) => {
      if (
        isCandidateDocument({
          type: asset.type,
          fileName: asset.fileName,
          mimeType: asset.mimeType,
          storagePath: asset.storagePath,
          url: asset.url,
        })
      ) {
        return;
      }

      const rawRef = (asset.storagePath || asset.url || '').trim();
      if (!rawRef) return;

      const mediaType: 'photo' | 'video' = isCandidateVideo({
        type: asset.type,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        storagePath: asset.storagePath,
        url: asset.url,
      })
        ? 'video'
        : 'photo';

      group.push({
        id: `lga-${activity.id}-${asset.id || idx}`,
        dedupeKey: rawRef,
        mediaType,
        input: asset,
        title: activity.title,
        subtitle: asset.caption?.trim() || activity.projectDescription || activity.community,
        locationLabel: `${activity.lgaName} LGA`,
        caption: asset.caption,
        coordinates: asset.coordinates || activity.coordinates,
        exifVerified: asset.exifVerified,
        source: 'lga_dossier',
        activity,
      });
    });

    if (group.length > 0) {
      groups.push(group);
    }
  }

  return groups;
}

function buildStateMediaCandidates(stateActivities: StateHCDActivity[]): RawMediaCandidate[][] {
  const groups: RawMediaCandidate[][] = [];
  for (const act of stateActivities) {
    const files: StateEvidenceFile[] = Array.isArray(act.evidence_files) ? act.evidence_files : [];
    if (files.length === 0) continue;

    const group: RawMediaCandidate[] = [];
    files.forEach((file, idx) => {
      if (
        isCandidateDocument({
          fileName: file.file_name,
          mimeType: file.file_type,
          storagePath: file.file_path,
        })
      ) {
        return;
      }

      const rawRef = (file.file_path || '').trim();
      if (!rawRef) return;

      const mediaType: 'photo' | 'video' = isCandidateVideo({
        fileName: file.file_name,
        mimeType: file.file_type,
        storagePath: file.file_path,
      })
        ? 'video'
        : 'photo';

      group.push({
        id: `state-${act.id}-${idx}`,
        dedupeKey: rawRef,
        mediaType,
        input: file,
        title: act.title,
        subtitle: file.title || act.lead_institution || act.location,
        locationLabel: act.location || 'Statewide Initiative',
        caption: file.title,
        source: 'state_dossier',
        stateActivity: act,
      });
    });

    if (group.length > 0) {
      groups.push(group);
    }
  }

  return groups;
}

// Cinematic Ken Burns zoom-and-drift choreography profiles cycled per slide
interface CinematicMotionProfile {
  enterScale: number;
  settleScale: number;
  exitScale: number;
  enterY: string;
  settleY: string;
  settleX: string;
}

const CINEMATIC_PROFILES: CinematicMotionProfile[] = [
  {
    enterScale: 1.14,
    settleScale: 1.02,
    exitScale: 0.99,
    enterY: '0.8%',
    settleY: '-0.8%',
    settleX: '1.1%',
  },
  {
    enterScale: 1.03,
    settleScale: 1.12,
    exitScale: 1.16,
    enterY: '-0.6%',
    settleY: '0.9%',
    settleX: '-1.1%',
  },
  {
    enterScale: 1.13,
    settleScale: 1.03,
    exitScale: 1.0,
    enterY: '1.2%',
    settleY: '-1.0%',
    settleX: '0.7%',
  },
  {
    enterScale: 1.04,
    settleScale: 1.13,
    exitScale: 1.17,
    enterY: '-0.8%',
    settleY: '0.8%',
    settleX: '-0.9%',
  },
];

// Staggered parent choreography for each incoming Cinematic Dossier frame
const stageContainerVariants: Variants = {
  enter: {
    opacity: 1,
  },
  center: {
    opacity: 1,
    transition: {
      staggerChildren: 0.14,
      delayChildren: 0.04,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.95,
      ease: CINEMATIC_EASE,
      staggerChildren: 0.06,
      staggerDirection: -1,
    },
  },
};

// Staggered caption & dossier info choreography inside the bottom carousel bar
const reelInfoContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.065,
      delayChildren: 0.04,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.22,
      ease: 'easeOut',
    },
  },
};

const reelInfoItemVariants: Variants = {
  hidden: { opacity: 0, y: 7, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.36,
      ease: CINEMATIC_EASE,
    },
  },
  exit: {
    opacity: 0,
    y: -5,
    transition: {
      duration: 0.18,
      ease: 'easeIn',
    },
  },
};

export interface UseHeroDossierReelParams {
  publishedActivities: HCDActivity[];
  publishedStateActivities: StateHCDActivity[];
  curatedFallbacks: CuratedFallbackVisual[];
}

export interface HeroDossierReelState {
  slides: HeroBackdropSlide[];
  activeSlide: HeroBackdropSlide | null;
  activeIndex: number;
  direction: 1 | -1;
  isLiveDossierReel: boolean;
  isPaused: boolean;
  togglePause: () => void;
  goNext: () => void;
  goPrev: () => void;
  goToIndex: (index: number) => void;
  markSlideFailed: (id: string) => void;
  slideDurationMs: number;
  photoCount: number;
  videoCount: number;
}

export function useHeroDossierReel({
  publishedActivities,
  publishedStateActivities,
  curatedFallbacks,
}: UseHeroDossierReelParams): HeroDossierReelState {
  const prefersReduced = useReducedMotion();
  const [resolvedSlides, setResolvedSlides] = useState<HeroBackdropSlide[]>([]);
  const [failedIds, setFailedIds] = useState<Set<string>>(() => new Set());
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Build ordered, deduplicated list of all non-document verified dossier media candidates
  const candidates = useMemo(() => {
    const lgaGroups = buildLgaMediaCandidates(publishedActivities);
    const stateGroups = buildStateMediaCandidates(publishedStateActivities);
    const interleaved = interleaveByGroup([...lgaGroups, ...stateGroups]);
    const seen = new Set<string>();
    const unique: RawMediaCandidate[] = [];
    for (const item of interleaved) {
      if (!seen.has(item.dedupeKey)) {
        seen.add(item.dedupeKey);
        unique.push(item);
      }
    }
    return unique;
  }, [publishedActivities, publishedStateActivities]);

  // Stable signature to avoid re-resolving on unrelated parent re-renders
  const candidatesSignature = useMemo(
    () => candidates.map((c) => `${c.id}:${c.dedupeKey}`).join('|'),
    [candidates]
  );

  // Resolve short-lived signed URLs progressively in batches via mediaResolver
  useEffect(() => {
    let cancelled = false;

    if (candidates.length === 0) {
      setResolvedSlides([]);
      return;
    }

    const resolveAll = async () => {
      const accumulated: HeroBackdropSlide[] = [];

      for (let i = 0; i < candidates.length; i += RESOLVE_BATCH_SIZE) {
        if (cancelled) return;
        const batch = candidates.slice(i, i + RESOLVE_BATCH_SIZE);

        const batchResults = await Promise.all(
          batch.map(async (cand): Promise<HeroBackdropSlide | null> => {
            try {
              const res = await resolveActivityMedia(cand.input);
              if (res.isDocument || !res.url || res.useFallbackPlaceholder) {
                return null;
              }
              return {
                id: cand.id,
                url: res.url,
                mediaType: cand.mediaType,
                title: cand.title,
                subtitle: cand.subtitle,
                locationLabel: cand.locationLabel,
                caption: cand.caption,
                coordinates: res.coordinates || cand.coordinates,
                exifVerified: res.exifVerified ?? cand.exifVerified,
                source: cand.source,
                activity: cand.activity,
                stateActivity: cand.stateActivity,
              };
            } catch {
              return null;
            }
          })
        );

        if (cancelled) return;

        let added = false;
        for (const item of batchResults) {
          if (item) {
            accumulated.push(item);
            added = true;
          }
        }

        if (added) {
          setResolvedSlides([...accumulated]);
        }
      }

      if (!cancelled && accumulated.length === 0) {
        setResolvedSlides([]);
      }
    };

    resolveAll();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidatesSignature]);

  // Build curated fallback slides anchored to real published dossiers when cloud storage URLs aren't present
  const fallbackSlides = useMemo<HeroBackdropSlide[]>(() => {
    const byPillar = new Map<string, CuratedFallbackVisual>();
    for (const vis of curatedFallbacks) {
      byPillar.set(vis.pillarKey, vis);
    }

    if (publishedActivities.length > 0) {
      const usedVisualSrcs = new Set<string>();
      const paired: HeroBackdropSlide[] = [];

      for (const act of publishedActivities) {
        const visual =
          byPillar.get(act.pillar) || curatedFallbacks[paired.length % curatedFallbacks.length];
        if (!visual || usedVisualSrcs.has(visual.src)) continue;
        usedVisualSrcs.add(visual.src);
        paired.push({
          id: `curated-dossier-${act.id}`,
          url: visual.src,
          mediaType: 'photo',
          title: act.title,
          subtitle: act.projectDescription || act.community,
          locationLabel: `${act.lgaName} LGA`,
          coordinates: act.coordinates,
          exifVerified: true,
          source: 'lga_dossier',
          activity: act,
        });
      }

      for (const vis of curatedFallbacks) {
        if (!usedVisualSrcs.has(vis.src)) {
          usedVisualSrcs.add(vis.src);
          paired.push({
            id: `curated-${vis.pillarKey}`,
            url: vis.src,
            mediaType: 'photo',
            title: vis.title,
            subtitle: vis.alt,
            locationLabel: vis.locationLabel,
            source: 'curated_showcase',
          });
        }
      }

      if (paired.length > 0) return paired;
    }

    return curatedFallbacks.map((vis) => ({
      id: `curated-${vis.pillarKey}`,
      url: vis.src,
      mediaType: 'photo',
      title: vis.title,
      subtitle: vis.alt,
      locationLabel: vis.locationLabel,
      source: 'curated_showcase',
    }));
  }, [curatedFallbacks, publishedActivities]);

  // Prefer all resolved live verified dossier photos & videos; fall back cleanly if none resolved
  const liveValidSlides = useMemo(
    () => resolvedSlides.filter((s) => !failedIds.has(s.id)),
    [resolvedSlides, failedIds]
  );

  const isLiveDossierReel = liveValidSlides.length > 0;
  const slides = isLiveDossierReel ? liveValidSlides : fallbackSlides;

  const safeIndex = slides.length > 0 ? activeIndex % slides.length : 0;
  const activeSlide = slides.length > 0 ? slides[safeIndex] : null;

  const slideDurationMs =
    activeSlide?.mediaType === 'video' ? VIDEO_MAX_DURATION_MS : PHOTO_DURATION_MS;

  const goNext = useCallback(() => {
    if (slides.length <= 1) return;
    setDirection(1);
    setActiveIndex((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const goPrev = useCallback(() => {
    if (slides.length <= 1) return;
    setDirection(-1);
    setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const goToIndex = useCallback(
    (index: number) => {
      if (slides.length === 0) return;
      const normalized = ((index % slides.length) + slides.length) % slides.length;
      setDirection(normalized >= safeIndex ? 1 : -1);
      setActiveIndex(normalized);
    },
    [slides.length, safeIndex]
  );

  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const markSlideFailed = useCallback((id: string) => {
    setFailedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // Preload upcoming photo slide for instantaneous flicker-free carousel transitions
  useEffect(() => {
    if (slides.length <= 1) return;
    const nextSlide = slides[(safeIndex + 1) % slides.length];
    if (nextSlide && nextSlide.mediaType === 'photo') {
      const preloadImg = new Image();
      preloadImg.src = nextSlide.url;
    }
  }, [slides, safeIndex]);

  // Continuous auto-advance timer (videos also advance immediately onEnded)
  useEffect(() => {
    if (prefersReduced || isPaused || slides.length <= 1 || !activeSlide) return;

    const timer = window.setTimeout(() => {
      setDirection(1);
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, slideDurationMs);

    return () => window.clearTimeout(timer);
  }, [prefersReduced, isPaused, slides.length, safeIndex, activeSlide, slideDurationMs]);

  const { photoCount, videoCount } = useMemo(() => {
    let photos = 0;
    let videos = 0;
    for (const s of slides) {
      if (s.mediaType === 'video') videos += 1;
      else photos += 1;
    }
    return { photoCount: photos, videoCount: videos };
  }, [slides]);

  return {
    slides,
    activeSlide,
    activeIndex: safeIndex,
    direction,
    isLiveDossierReel,
    isPaused,
    togglePause,
    goNext,
    goPrev,
    goToIndex,
    markSlideFailed,
    slideDurationMs,
    photoCount,
    videoCount,
  };
}

interface HeroDossierBackdropCanvasProps {
  reel: HeroDossierReelState;
}

/**
 * Full-bleed Framer Motion Cinematic Dossier Carousel canvas.
 * Orchestrates staggered fade, directional zoom/Ken Burns drift, subtle focus-pull,
 * luminous film-gate sheen, and viewfinder corner marks on every media transition.
 */
export const HeroDossierBackdropCanvas: React.FC<HeroDossierBackdropCanvasProps> = ({ reel }) => {
  const prefersReduced = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { activeSlide, activeIndex, direction, isPaused, slides, goNext, markSlideFailed } = reel;

  // Keep video playback synced with Pause / Play controls
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isPaused) {
      vid.pause();
    } else {
      vid.play().catch(() => {
        // Autoplay may be throttled in background tabs; timer still advances cleanly
      });
    }
  }, [isPaused, activeSlide?.id]);

  if (!activeSlide) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-[#062611] via-[#0B4619] to-[#051F0E]" />
    );
  }

  const profile = CINEMATIC_PROFILES[activeIndex % CINEMATIC_PROFILES.length];
  const isPhoto = activeSlide.mediaType === 'photo';
  const driftDurationSec = PHOTO_DURATION_MS / 1000 + 1.4;
  const enterX = direction === 1 ? '2.2%' : '-2.2%';
  const exitX = direction === 1 ? '-1.8%' : '1.8%';

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#062611]">
      <AnimatePresence mode="sync" initial={false} custom={direction}>
        <motion.div
          key={`${activeSlide.id}-${activeIndex}`}
          custom={direction}
          variants={stageContainerVariants}
          initial="enter"
          animate="center"
          exit="exit"
          className="absolute inset-0 w-full h-full"
        >
          {/* Stagger Beat 1: Primary Media Frame — Fade + Directional Zoom + Gentle Focus Pull */}
          <motion.div
            variants={{
              enter: prefersReduced
                ? { opacity: 0 }
                : {
                    opacity: 0,
                    scale: isPhoto ? profile.enterScale : 1.07,
                    x: enterX,
                    y: isPhoto ? profile.enterY : '0%',
                    filter: 'blur(5px) brightness(0.92)',
                  },
              center: prefersReduced
                ? {
                    opacity: 1,
                    transition: { duration: 0.3 },
                  }
                : {
                    opacity: 1,
                    scale: isPhoto ? profile.settleScale : 1.0,
                    x: isPhoto ? profile.settleX : '0%',
                    y: isPhoto ? profile.settleY : '0%',
                    filter: 'blur(0px) brightness(1)',
                    transition: {
                      opacity: { duration: 1.15, ease: CINEMATIC_EASE },
                      filter: { duration: 0.95, ease: CINEMATIC_EASE },
                      scale: {
                        duration: isPhoto ? driftDurationSec : 1.3,
                        ease: isPhoto ? 'linear' : CINEMATIC_EASE,
                      },
                      x: {
                        duration: isPhoto ? driftDurationSec : 1.25,
                        ease: isPhoto ? 'linear' : CINEMATIC_EASE,
                      },
                      y: {
                        duration: isPhoto ? driftDurationSec : 1.25,
                        ease: isPhoto ? 'linear' : CINEMATIC_EASE,
                      },
                    },
                  },
              exit: prefersReduced
                ? {
                    opacity: 0,
                    transition: { duration: 0.25 },
                  }
                : {
                    opacity: 0,
                    scale: isPhoto ? profile.exitScale : 1.04,
                    x: exitX,
                    filter: 'blur(3px) brightness(0.95)',
                    transition: {
                      duration: 1.0,
                      ease: CINEMATIC_EASE,
                    },
                  },
            }}
            className="absolute inset-0 w-full h-full will-change-transform"
          >
            {activeSlide.mediaType === 'video' ? (
              <video
                ref={videoRef}
                src={activeSlide.url}
                autoPlay
                muted
                playsInline
                loop={slides.length <= 1}
                preload="auto"
                onEnded={() => {
                  if (!isPaused && slides.length > 1) {
                    goNext();
                  }
                }}
                onError={() => markSlideFailed(activeSlide.id)}
                className="w-full h-full object-cover object-center brightness-[0.99] contrast-[1.04] saturate-[1.08]"
              />
            ) : (
              <img
                src={activeSlide.url}
                alt={`${activeSlide.title} — ${activeSlide.locationLabel}`}
                onError={() => markSlideFailed(activeSlide.id)}
                className="w-full h-full object-cover object-center brightness-[0.99] contrast-[1.04] saturate-[1.08]"
              />
            )}
          </motion.div>

          {/* Stagger Beat 2: Subtle Optical Aperture Sheen Sweep on Slide Entry */}
          {!prefersReduced && (
            <motion.div
              aria-hidden="true"
              variants={{
                enter: { opacity: 0, x: direction === 1 ? '-18%' : '18%' },
                center: {
                  opacity: [0, 0.22, 0],
                  x: direction === 1 ? '18%' : '-18%',
                  transition: {
                    duration: 1.45,
                    ease: CINEMATIC_EASE,
                  },
                },
                exit: { opacity: 0, transition: { duration: 0.3 } },
              }}
              className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-[#D4AF37]/25 to-transparent mix-blend-screen"
            />
          )}

          {/* Stagger Beat 3: Cinematic Dossier Viewfinder Corner Reticles */}
          {!prefersReduced && (
            <motion.div
              aria-hidden="true"
              variants={{
                enter: { opacity: 0, scale: 1.03 },
                center: {
                  opacity: 0.65,
                  scale: 1,
                  transition: { duration: 0.7, ease: CINEMATIC_EASE },
                },
                exit: {
                  opacity: 0,
                  scale: 0.99,
                  transition: { duration: 0.35 },
                },
              }}
              className="hidden sm:block absolute inset-5 pointer-events-none"
            >
              <span className="absolute top-0 left-0 w-5 h-5 border-t border-l border-[#D4AF37]/50" />
              <span className="absolute top-0 right-0 w-5 h-5 border-t border-r border-[#D4AF37]/50" />
              <span className="absolute bottom-0 left-0 w-5 h-5 border-b border-l border-[#D4AF37]/50" />
              <span className="absolute bottom-0 right-0 w-5 h-5 border-b border-r border-[#D4AF37]/50" />
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

interface HeroDossierReelBarProps {
  reel: HeroDossierReelState;
  onInspectActivity?: (activity: HCDActivity) => void;
  onInspectStateActivity?: (activity: StateHCDActivity) => void;
}

/**
 * Interactive Cinematic Dossier Carousel control bar anchored at the base of the Hero.
 * Features staggered metadata transitions, clickable thumbnail filmstrip scrubbing
 * with animated active frame indicator, live slide progress bar, and direct dossier inspection.
 */
export const HeroDossierReelBar: React.FC<HeroDossierReelBarProps> = ({
  reel,
  onInspectActivity,
  onInspectStateActivity,
}) => {
  const prefersReduced = useReducedMotion();
  const {
    activeSlide,
    activeIndex,
    slides,
    isLiveDossierReel,
    isPaused,
    togglePause,
    goNext,
    goPrev,
    goToIndex,
    slideDurationMs,
    photoCount,
    videoCount,
  } = reel;

  // Build a smart windowed filmstrip (up to 6 visible thumbnails centered around activeIndex)
  const visibleThumbIndices = useMemo(() => {
    const total = slides.length;
    if (total <= 1) return [];
    const maxThumbs = 6;
    if (total <= maxThumbs) {
      return Array.from({ length: total }, (_, i) => i);
    }
    const half = Math.floor(maxThumbs / 2);
    let start = activeIndex - half;
    if (start < 0) start = 0;
    if (start + maxThumbs > total) start = total - maxThumbs;
    return Array.from({ length: maxThumbs }, (_, i) => start + i);
  }, [slides.length, activeIndex]);

  if (!activeSlide) return null;

  const canInspect = Boolean(
    (activeSlide.activity && onInspectActivity) ||
      (activeSlide.stateActivity && onInspectStateActivity)
  );

  const handleInspect = () => {
    if (activeSlide.activity && onInspectActivity) {
      onInspectActivity(activeSlide.activity);
    } else if (activeSlide.stateActivity && onInspectStateActivity) {
      onInspectStateActivity(activeSlide.stateActivity);
    }
  };

  const formattedCoords =
    activeSlide.coordinates &&
    typeof activeSlide.coordinates.lat === 'number' &&
    typeof activeSlide.coordinates.lng === 'number'
      ? `${activeSlide.coordinates.lat.toFixed(3)}°N, ${activeSlide.coordinates.lng.toFixed(3)}°E`
      : null;

  return (
    <div className="no-print mt-8 sm:mt-10">
      <div className="relative overflow-hidden rounded-xl bg-[#041B0C]/68 backdrop-blur-md border border-white/18 px-4 py-3.5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          {/* Staggered Active Dossier Metadata */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeSlide.id}-${activeIndex}`}
              variants={prefersReduced ? undefined : reelInfoContainerVariants}
              initial={prefersReduced ? { opacity: 1 } : 'hidden'}
              animate={prefersReduced ? { opacity: 1 } : 'visible'}
              exit={prefersReduced ? { opacity: 0 } : 'exit'}
              className="flex items-center gap-3.5 min-w-0 flex-1"
            >
              <motion.div
                variants={prefersReduced ? undefined : reelInfoItemVariants}
                className="hidden w-9 h-9 rounded-lg bg-[#D4AF37]/20 border border-[#D4AF37]/45 text-[#D4AF37] items-center justify-center shrink-0"
              >
                {activeSlide.mediaType === 'video' ? (
                  <Video className="w-4 h-4" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </motion.div>

              <div className="min-w-0 flex-1">
                <motion.div
                  variants={prefersReduced ? undefined : reelInfoItemVariants}
                  className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold text-emerald-200/90"
                >
                  <span className="hidden items-center gap-1 text-[#D4AF37] uppercase tracking-wider">
                    <Film className="w-3 h-3" />
                    {isLiveDossierReel ? 'Cinematic Dossier Reel' : 'Field Showcase Reel'}
                  </span>
                  <span aria-hidden="true" className="hidden text-white/35">·</span>
                  <span className="inline-flex items-center gap-1 text-white/95">
                    <MapPin className="w-3 h-3 text-[#D4AF37]" />
                    {activeSlide.locationLabel}
                  </span>
                  {formattedCoords && (
                    <>
                      <span aria-hidden="true" className="hidden sm:inline text-white/35">·</span>
                      <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] text-emerald-200/80">
                        <Compass className="w-3 h-3 text-emerald-300/80" />
                        {formattedCoords}
                      </span>
                    </>
                  )}
                  <span aria-hidden="true" className="text-white/35">·</span>
                  <span className="text-emerald-200/80">
                    {activeSlide.mediaType === 'video' ? 'Field Video' : 'Field Photo'}
                    {videoCount > 0 && photoCount > 0
                      ? ` (${photoCount}P · ${videoCount}V)`
                      : ''}
                  </span>
                </motion.div>

                <motion.p
                  variants={prefersReduced ? undefined : reelInfoItemVariants}
                  className="text-xs sm:text-sm font-semibold text-white truncate mt-0.5"
                  title={activeSlide.title}
                >
                  {activeSlide.title}
                </motion.p>

                {activeSlide.subtitle && (
                  <motion.p
                    variants={prefersReduced ? undefined : reelInfoItemVariants}
                    className="hidden text-[11px] text-emerald-100/75 truncate"
                    title={activeSlide.subtitle}
                  >
                    {activeSlide.subtitle}
                  </motion.p>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Right: Interactive Filmstrip Carousel Thumbnails + Controls + Inspect */}
          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2.5 shrink-0">
            {/* Clickable Dossier Filmstrip Preview */}
            {visibleThumbIndices.length > 1 && (
              <div
                role="tablist"
                aria-label="Cinematic dossier background slides"
                className="flex items-center gap-1.5"
              >
                {visibleThumbIndices.map((slideIdx) => {
                  const thumb = slides[slideIdx];
                  const isActive = slideIdx === activeIndex;
                  return (
                    <motion.button
                      key={thumb.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-label={`View slide ${slideIdx + 1}: ${thumb.title}`}
                      onClick={() => goToIndex(slideIdx)}
                      whileHover={prefersReduced ? undefined : { scale: 1.08, y: -1 }}
                      whileTap={prefersReduced ? undefined : { scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className={`relative w-10 h-7 rounded-md overflow-hidden border transition-opacity cursor-pointer shrink-0 ${
                        isActive
                          ? 'opacity-100 border-transparent'
                          : 'opacity-55 hover:opacity-90 border-white/20'
                      }`}
                    >
                      {thumb.mediaType === 'video' ? (
                        <div className="w-full h-full bg-[#093218] flex items-center justify-center text-[#D4AF37]">
                          <Video className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <img
                          src={thumb.url}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      )}

                      {isActive && (
                        <motion.span
                          layoutId="hero-cinematic-dossier-active"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                          className="absolute inset-0 rounded-md ring-2 ring-[#D4AF37] ring-inset pointer-events-none"
                        />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-2">
              {canInspect && (
                <button
                  type="button"
                  onClick={handleInspect}
                  className="px-3 py-1.5 rounded-lg bg-[#D4AF37]/18 hover:bg-[#D4AF37]/30 border border-[#D4AF37]/40 text-[#F4D97A] hover:text-white text-xs font-semibold transition-colors inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  Open Dossier
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}

              {slides.length > 1 && (
                <div className="flex items-center gap-1 pl-2 border-l border-white/15">
                  <span className="text-[11px] font-mono tabular-nums text-emerald-100/85 mr-1">
                    {String(activeIndex + 1).padStart(2, '0')}/
                    {String(slides.length).padStart(2, '0')}
                  </span>
                  <button
                    type="button"
                    onClick={goPrev}
                    aria-label="Previous background dossier media"
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/22 text-white transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={togglePause}
                    aria-label={isPaused ? 'Resume background reel' : 'Pause background reel'}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/22 text-[#D4AF37] transition-colors cursor-pointer"
                  >
                    {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    aria-label="Next background dossier media"
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/22 text-white transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Continuous Cinematic Progress Hairline */}
        {slides.length > 1 && !prefersReduced && (
          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/10 overflow-hidden">
            {!isPaused ? (
              <motion.div
                key={`${activeSlide.id}-${activeIndex}`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: slideDurationMs / 1000, ease: 'linear' }}
                className="h-full w-full origin-left bg-gradient-to-r from-[#D4AF37] via-amber-300 to-emerald-400"
              />
            ) : (
              <div className="h-full w-1/3 bg-[#D4AF37]/60" />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
