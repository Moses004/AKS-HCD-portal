import React, { useEffect, useRef, useState } from 'react';
import {
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useReducedMotion,
  animate,
} from 'motion/react';
import { Compass } from 'lucide-react';

export const KINETIC_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Top viewport gold scroll-progress hairline.
 * Automatically hidden in print and reduced-motion contexts.
 */
export const ScrollProgressBar: React.FC = () => {
  const prefersReduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 180,
    damping: 30,
    restDelta: 0.001,
  });

  if (prefersReduced) return null;

  return (
    <motion.div
      aria-hidden="true"
      className="no-print fixed top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-[#0B4619] via-[#D4AF37] to-emerald-500 origin-left z-50 pointer-events-none"
      style={{ scaleX }}
    />
  );
};

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  duration?: number;
}

/**
 * Spring-interpolated rolling tabular counter that counts smoothly into view.
 */
export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
  duration = 1.15,
}) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });
  const prefersReduced = useReducedMotion();
  const [displayValue, setDisplayValue] = useState<number>(prefersReduced ? value : 0);

  useEffect(() => {
    if (prefersReduced) {
      setDisplayValue(value);
      return;
    }
    if (!isInView) return;

    const controls = animate(displayValue, value, {
      duration,
      ease: KINETIC_EASE,
      onUpdate: (latest) => {
        setDisplayValue(latest);
      },
    });

    return () => controls.stop();
  }, [value, isInView, prefersReduced, duration]);

  const formatted =
    decimals > 0
      ? displayValue.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : Math.round(displayValue).toLocaleString();

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  yOffset?: number;
}

/**
 * Compositor-only (transform + opacity) viewport reveal honoring prefers-reduced-motion.
 */
export const ScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  className = '',
  delay = 0,
  yOffset = 20,
}) => {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.55, delay, ease: KINETIC_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

interface ParallaxLayerProps {
  children: React.ReactNode;
  className?: string;
  offsetY?: [number, number];
  scaleRange?: [number, number];
}

/**
 * Self-contained scroll-triggered parallax wrapper using compositor-only GPU transforms.
 * Safely degrades to static rendering when prefers-reduced-motion is active.
 */
export const ParallaxLayer: React.FC<ParallaxLayerProps> = ({
  children,
  className = '',
  offsetY = [-24, 24],
  scaleRange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const prefersReduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 26,
    restDelta: 0.001,
  });

  const y = useTransform(smoothProgress, [0, 1], offsetY);
  const scale = useTransform(smoothProgress, [0, 1], scaleRange || [1, 1]);

  if (prefersReduced) {
    return <div className={`relative ${className}`}>{children}</div>;
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <motion.div
        style={{
          y,
          scale: scaleRange ? scale : undefined,
          willChange: 'transform',
        }}
        className="w-full h-full"
      >
        {children}
      </motion.div>
    </div>
  );
};

interface ParallaxDecorativeFieldProps {
  variant?: 'gold-contours' | 'emerald-compass' | 'civic-prism';
  className?: string;
}

/**
 * Multi-plane architectural background geometry that glides at 3 distinct parallax speeds on scroll.
 */
export const ParallaxDecorativeField: React.FC<ParallaxDecorativeFieldProps> = ({
  variant = 'gold-contours',
  className = '',
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const prefersReduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const smooth = useSpring(scrollYProgress, {
    stiffness: 105,
    damping: 26,
    restDelta: 0.001,
  });

  const yFar = useTransform(smooth, [0, 1], [-58, 58]);
  const yMid = useTransform(smooth, [0, 1], [42, -42]);
  const yNear = useTransform(smooth, [0, 1], [-82, 82]);
  const rotateCw = useTransform(smooth, [0, 1], [-9, 9]);
  const rotateCcw = useTransform(smooth, [0, 1], [12, -12]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`no-print pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {variant === 'gold-contours' && (
        <>
          {/* Far Plane: Concentric Crest Contours */}
          <motion.svg
            style={prefersReduced ? undefined : { y: yFar, rotate: rotateCw, willChange: 'transform' }}
            className="absolute -right-24 -top-16 w-[480px] h-[480px] text-[#D4AF37]/20"
            viewBox="0 0 400 400"
            fill="none"
          >
            <circle cx="200" cy="200" r="175" stroke="currentColor" strokeWidth="1" strokeDasharray="4 8" />
            <circle cx="200" cy="200" r="132" stroke="currentColor" strokeWidth="0.9" />
            <circle cx="200" cy="200" r="88" stroke="currentColor" strokeWidth="0.75" strokeDasharray="2 6" />
            <polygon points="200,32 346,116 346,284 200,368 54,284 54,116" stroke="currentColor" strokeWidth="0.7" opacity="0.65" />
            <path d="M 20 200 H 380 M 200 20 V 380" stroke="currentColor" strokeWidth="0.6" opacity="0.55" />
          </motion.svg>

          {/* Mid Plane: Floating Isometric Civic Diamond */}
          <motion.svg
            style={prefersReduced ? undefined : { y: yMid, rotate: rotateCcw, willChange: 'transform' }}
            className="absolute left-6 top-20 w-44 h-44 text-[#0B4619]/[0.09]"
            viewBox="0 0 180 180"
            fill="none"
          >
            <polygon points="90,12 168,90 90,168 12,90" stroke="currentColor" strokeWidth="1.2" />
            <polygon points="90,38 142,90 90,142 38,90" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="0.8" />
            <line x1="12" y1="90" x2="168" y2="90" stroke="currentColor" strokeWidth="0.6" strokeDasharray="3 5" />
          </motion.svg>

          {/* Near Plane: Crisp Floating Accent Rhombus & Soft Aura */}
          <motion.div
            style={prefersReduced ? undefined : { y: yNear, rotate: rotateCw, willChange: 'transform' }}
            className="absolute right-[14%] bottom-16 w-14 h-14 border border-[#D4AF37]/30 rounded-lg rotate-45 bg-[#D4AF37]/[0.04]"
          />
          <motion.div
            style={prefersReduced ? undefined : { y: yMid, willChange: 'transform' }}
            className="absolute -left-24 bottom-8 w-80 h-80 rounded-full bg-radial from-emerald-800/[0.07] via-emerald-700/[0.02] to-transparent blur-2xl"
          />
        </>
      )}

      {variant === 'emerald-compass' && (
        <>
          {/* Far Plane: Compass & Architectural Vector Arcs */}
          <motion.svg
            style={prefersReduced ? undefined : { y: yMid, rotate: rotateCw, willChange: 'transform' }}
            className="absolute -left-20 top-8 w-[440px] h-[440px] text-[#0B4619]/[0.09]"
            viewBox="0 0 400 400"
            fill="none"
          >
            <rect x="40" y="40" width="320" height="320" rx="160" stroke="currentColor" strokeWidth="1" />
            <rect x="85" y="85" width="230" height="230" rx="115" stroke="currentColor" strokeWidth="0.8" strokeDasharray="6 6" />
            <polygon points="200,52 328,200 200,348 72,200" stroke="currentColor" strokeWidth="0.75" opacity="0.7" />
            <path d="M 60 340 L 340 60" stroke="currentColor" strokeWidth="0.7" />
          </motion.svg>

          {/* Mid Plane: Layered Geometric Chevron Stack */}
          <motion.svg
            style={prefersReduced ? undefined : { y: yFar, rotate: rotateCcw, willChange: 'transform' }}
            className="absolute right-8 top-12 w-52 h-52 text-[#D4AF37]/24"
            viewBox="0 0 200 200"
            fill="none"
          >
            <polygon points="100,14 176,58 176,142 100,186 24,142 24,58" stroke="currentColor" strokeWidth="1" />
            <polygon points="100,40 152,70 152,130 100,160 48,130 48,70" stroke="currentColor" strokeWidth="0.8" strokeDasharray="4 4" />
            <circle cx="100" cy="100" r="14" stroke="currentColor" strokeWidth="0.9" />
          </motion.svg>

          {/* Near Plane: Soft Gold Ambient Wash */}
          <motion.div
            style={prefersReduced ? undefined : { y: yNear, willChange: 'transform' }}
            className="absolute right-0 -bottom-16 w-96 h-96 rounded-full bg-radial from-[#D4AF37]/[0.1] via-[#D4AF37]/[0.03] to-transparent blur-2xl"
          />
        </>
      )}

      {variant === 'civic-prism' && (
        <>
          {/* Far Plane: Asymmetric Faceted Prism Wireframe */}
          <motion.svg
            style={prefersReduced ? undefined : { y: yFar, rotate: rotateCcw, willChange: 'transform' }}
            className="absolute -right-16 top-16 w-[440px] h-[440px] text-[#0B4619]/[0.08]"
            viewBox="0 0 400 400"
            fill="none"
          >
            <polygon points="200,24 364,120 318,324 82,324 36,120" stroke="currentColor" strokeWidth="1" />
            <polygon points="200,68 320,138 286,292 114,292 80,138" stroke="currentColor" strokeWidth="0.8" strokeDasharray="5 7" />
            <path d="M 200 24 L 200 324 M 36 120 L 364 120" stroke="currentColor" strokeWidth="0.6" opacity="0.65" />
          </motion.svg>

          {/* Mid Plane: Floating Crest Gold Isometric Rings */}
          <motion.svg
            style={prefersReduced ? undefined : { y: yMid, rotate: rotateCw, willChange: 'transform' }}
            className="absolute -left-16 bottom-12 w-72 h-72 text-[#D4AF37]/22"
            viewBox="0 0 260 260"
            fill="none"
          >
            <rect x="38" y="38" width="184" height="184" rx="28" stroke="currentColor" strokeWidth="1" />
            <rect x="68" y="68" width="124" height="124" rx="18" stroke="currentColor" strokeWidth="0.85" strokeDasharray="4 6" />
            <circle cx="130" cy="130" r="24" stroke="currentColor" strokeWidth="0.9" />
          </motion.svg>

          {/* Near Plane: Crisp Geometric Floating Accents */}
          <motion.div
            style={prefersReduced ? undefined : { y: yNear, rotate: rotateCw, willChange: 'transform' }}
            className="absolute left-[12%] top-28 w-10 h-10 border border-[#0B4619]/20 rounded-md rotate-12 bg-emerald-900/[0.03]"
          />
          <motion.div
            style={prefersReduced ? undefined : { y: yMid, willChange: 'transform' }}
            className="absolute left-1/3 top-1/2 w-80 h-80 rounded-full bg-radial from-emerald-800/[0.05] via-transparent to-transparent blur-3xl"
          />
        </>
      )}
    </div>
  );
};

/**
 * Full-page ambient abstract geometric depth layer linked to global viewport scroll.
 * Glides subtly behind the Warm Ivory canvas to unify the Kinetic Civic Showcase aesthetic.
 */
export const AmbientParallaxGeometry: React.FC = () => {
  const prefersReduced = useReducedMotion();
  const { scrollYProgress } = useScroll();

  const smooth = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 28,
    restDelta: 0.001,
  });

  const yLayerA = useTransform(smooth, [0, 1], ['0%', '-18%']);
  const yLayerB = useTransform(smooth, [0, 1], ['0%', '14%']);
  const rotA = useTransform(smooth, [0, 1], [0, 22]);
  const rotB = useTransform(smooth, [0, 1], [0, -18]);

  return (
    <div
      aria-hidden="true"
      className="no-print pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Distant Architectural Diagonal Mesh */}
      <motion.svg
        style={prefersReduced ? undefined : { y: yLayerA, willChange: 'transform' }}
        className="absolute -top-24 left-0 w-full h-[130vh] text-[#0B4619]/[0.035]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="ambient-civic-diamond" width="120" height="120" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 120 60 L 60 120 L 0 60 Z" fill="none" stroke="currentColor" strokeWidth="0.7" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ambient-civic-diamond)" />
      </motion.svg>

      {/* Slow-Drifting Gold Geometric Crest Polygon (Top-Right Ambient) */}
      <motion.svg
        style={prefersReduced ? undefined : { y: yLayerB, rotate: rotA, willChange: 'transform' }}
        className="absolute top-[22vh] -right-32 w-[420px] h-[420px] text-[#D4AF37]/[0.11]"
        viewBox="0 0 360 360"
        fill="none"
      >
        <polygon points="180,20 320,100 320,260 180,340 40,260 40,100" stroke="currentColor" strokeWidth="1" />
        <polygon points="180,62 284,122 284,238 180,298 76,238 76,122" stroke="currentColor" strokeWidth="0.75" strokeDasharray="5 7" />
      </motion.svg>

      {/* Counter-Drifting Emerald Abstract Prism (Lower-Left Ambient) */}
      <motion.svg
        style={prefersReduced ? undefined : { y: yLayerA, rotate: rotB, willChange: 'transform' }}
        className="absolute bottom-[-8vh] -left-28 w-[380px] h-[380px] text-[#0B4619]/[0.06]"
        viewBox="0 0 360 360"
        fill="none"
      >
        <circle cx="180" cy="180" r="150" stroke="currentColor" strokeWidth="1" strokeDasharray="3 9" />
        <polygon points="180,44 316,180 180,316 44,180" stroke="currentColor" strokeWidth="0.9" />
      </motion.svg>
    </div>
  );
};

interface KineticSectionHeaderProps {
  kicker?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  headingAs?: 'h2' | 'h3';
  theme?: 'light' | 'dark';
  showAccentRule?: boolean;
  className?: string;
}

/**
 * Staggered scroll-linked section title block with depth-aware opacity and transform curves.
 * Separates kicker, display title, accent rule, and description across staggered scroll windows
 * so each typographic stratum resolves into sharp reading focus with continuous depth.
 */
export const KineticSectionHeader: React.FC<KineticSectionHeaderProps> = ({
  kicker,
  title,
  description,
  headingAs = 'h2',
  theme = 'light',
  showAccentRule = true,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const prefersReduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 96%', 'start 56%'],
  });

  const smooth = useSpring(scrollYProgress, {
    stiffness: 135,
    damping: 28,
    restDelta: 0.001,
  });

  // Stratum 1: Kicker arrives first (0.00 -> 0.55)
  const kickerOpacity = useTransform(smooth, [0, 0.55], [0.18, 1]);
  const kickerY = useTransform(smooth, [0, 0.55], [16, 0]);
  const kickerX = useTransform(smooth, [0, 0.55], [-10, 0]);

  // Stratum 2: Monumental display title resolves second (0.12 -> 0.78)
  const titleOpacity = useTransform(smooth, [0.12, 0.78], [0.12, 1]);
  const titleY = useTransform(smooth, [0.12, 0.78], [28, 0]);
  const titleScale = useTransform(smooth, [0.12, 0.78], [0.985, 1]);

  // Stratum 3: Crest hairline rule unfurls (0.22 -> 0.86)
  const ruleScaleX = useTransform(smooth, [0.22, 0.86], [0, 1]);
  const ruleOpacity = useTransform(smooth, [0.22, 0.86], [0, 1]);

  // Stratum 4: Description settles last at deeper parallax plane (0.28 -> 0.96)
  const descOpacity = useTransform(smooth, [0.28, 0.96], [0.1, 1]);
  const descY = useTransform(smooth, [0.28, 0.96], [34, 0]);

  const kickerColor = theme === 'dark' ? 'text-[#D4AF37]' : 'text-[#0B4619]';
  const titleColor = theme === 'dark' ? 'text-white' : 'text-slate-950';
  const descColor = theme === 'dark' ? 'text-emerald-100/85' : 'text-slate-600';
  const ruleGradient =
    theme === 'dark'
      ? 'from-[#D4AF37] via-[#D4AF37]/50 to-transparent'
      : 'from-[#0B4619] via-[#D4AF37] to-transparent';

  const HeadingTag = headingAs === 'h3' ? motion.h3 : motion.h2;

  return (
    <div ref={containerRef} className={`relative space-y-2 ${className}`}>
      {kicker && (
        <motion.div
          style={
            prefersReduced
              ? undefined
              : {
                  opacity: kickerOpacity,
                  y: kickerY,
                  x: kickerX,
                  willChange: 'transform, opacity',
                }
          }
          className={`text-xs font-semibold tracking-wide ${kickerColor}`}
        >
          {kicker}
        </motion.div>
      )}

      <HeadingTag
        style={
          prefersReduced
            ? undefined
            : {
                opacity: titleOpacity,
                y: titleY,
                scale: titleScale,
                transformOrigin: 'left bottom',
                willChange: 'transform, opacity',
              }
        }
        className={`font-display text-2xl sm:text-3xl font-bold tracking-tight text-balance ${titleColor}`}
      >
        {title}
      </HeadingTag>

      {showAccentRule && (
        <motion.div
          aria-hidden="true"
          style={
            prefersReduced
              ? undefined
              : {
                  scaleX: ruleScaleX,
                  opacity: ruleOpacity,
                  transformOrigin: 'left center',
                  willChange: 'transform, opacity',
                }
          }
          className={`no-print h-[2px] w-16 rounded-full bg-gradient-to-r ${ruleGradient}`}
        />
      )}

      {description && (
        <motion.p
          style={
            prefersReduced
              ? undefined
              : {
                  opacity: descOpacity,
                  y: descY,
                  willChange: 'transform, opacity',
                }
          }
          className={`text-xs sm:text-sm leading-relaxed ${descColor}`}
        >
          {description}
        </motion.p>
      )}
    </div>
  );
};

interface KineticActivityCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'compact';
  animateEntrance?: boolean;
  delayIndex?: number;
  interactive?: boolean;
  onClick?: () => void;
}

/**
 * Tactile Kinetic Civic Showcase card with Framer Motion spring `whileHover`
 * scale elevation and layered emerald-and-gold shadow intensity.
 */
export const KineticActivityCard: React.FC<KineticActivityCardProps> = ({
  children,
  className = '',
  variant = 'default',
  animateEntrance = false,
  delayIndex = 0,
  interactive = false,
  onClick,
}) => {
  const prefersReduced = useReducedMotion();

  const hoverEffect = prefersReduced
    ? {
        boxShadow:
          '0 12px 24px -8px rgba(6, 78, 59, 0.16), 0 0 0 1px rgba(11, 70, 25, 0.22)',
      }
    : variant === 'compact'
    ? {
        scale: 1.008,
        y: -2,
        boxShadow:
          '0 16px 30px -12px rgba(6, 78, 59, 0.20), 0 6px 14px -6px rgba(212, 175, 55, 0.16), 0 0 0 1px rgba(11, 70, 25, 0.18)',
      }
    : {
        scale: 1.016,
        y: -4,
        boxShadow:
          '0 24px 44px -14px rgba(6, 78, 59, 0.24), 0 10px 22px -8px rgba(212, 175, 55, 0.18), 0 0 0 1px rgba(11, 70, 25, 0.24)',
      };

  const tapEffect =
    interactive && !prefersReduced
      ? { scale: variant === 'compact' ? 0.996 : 0.992, y: -1 }
      : undefined;

  return (
    <motion.article
      onClick={onClick}
      initial={
        animateEntrance && !prefersReduced
          ? { opacity: 0, y: 14 }
          : undefined
      }
      whileInView={
        animateEntrance && !prefersReduced
          ? { opacity: 1, y: 0 }
          : undefined
      }
      viewport={animateEntrance ? { once: true, amount: 0.08 } : undefined}
      whileHover={hoverEffect}
      whileTap={tapEffect}
      transition={{
        opacity: { duration: 0.35, delay: Math.min(delayIndex * 0.04, 0.24), ease: KINETIC_EASE },
        y: { type: 'spring', stiffness: 380, damping: 26, mass: 0.78 },
        scale: { type: 'spring', stiffness: 380, damping: 26, mass: 0.78 },
        boxShadow: { duration: 0.22, ease: KINETIC_EASE },
      }}
      style={{ willChange: 'transform, box-shadow' }}
      className={`activity-card relative hover:z-10 ${className}`}
    >
      {children}
    </motion.article>
  );
};

interface ShowcaseImageProps {
  src: string;
  alt: string;
  fallbackTitle: string;
  className?: string;
  imgClassName?: string;
}

/**
 * Resilient editorial image frame with zero-broken-image CSS/SVG fallback.
 */
export const ShowcaseImage: React.FC<ShowcaseImageProps> = ({
  src,
  alt,
  fallbackTitle,
  className = '',
  imgClassName = '',
}) => {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`relative overflow-hidden bg-gradient-to-br from-[#072E14] via-[#0B4619] to-emerald-900 flex flex-col items-center justify-center p-6 text-center ${className}`}
      >
        <div className="w-12 h-12 rounded-2xl bg-white/10 border border-[#D4AF37]/40 flex items-center justify-center mb-3">
          <Compass className="w-6 h-6 text-[#D4AF37]" />
        </div>
        <p className="font-display text-base font-semibold text-white/95 max-w-xs text-balance">
          {fallbackTitle}
        </p>
        <p className="text-xs text-emerald-200/80 mt-1">Akwa Ibom State ARISE HCD Showcase</p>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`w-full h-full object-cover ${imgClassName}`}
      />
    </div>
  );
};

type CursorInteractionMode = 'default' | 'button' | 'card' | 'input';

function resolveCursorInteractionMode(target: EventTarget | null): CursorInteractionMode {
  if (!(target instanceof Element)) return 'default';
  if (target.closest('input, textarea, select, [contenteditable="true"]')) {
    return 'input';
  }
  if (
    target.closest(
      'button, a, [role="button"], [role="tab"], summary, label[for], [data-cursor="interactive"]'
    )
  ) {
    return 'button';
  }
  if (target.closest('.activity-card, article, [data-cursor="card"]')) {
    return 'card';
  }
  return 'default';
}

/**
 * Subtle Kinetic Civic Showcase cursor-following glow powered by Framer Motion springs.
 * - Uses compositor-only MotionValues (zero per-pixel React re-renders)
 * - Gently reacts to interactive hover states (buttons/links, activity cards, form inputs)
 * - Automatically disabled on touch/coarse pointers, print views, and prefers-reduced-motion
 */
export const KineticGlowCursor: React.FC = () => {
  const prefersReduced = useReducedMotion();
  const [isFinePointer, setIsFinePointer] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [mode, setMode] = useState<CursorInteractionMode>('default');
  const [isPressed, setIsPressed] = useState(false);

  const rawX = useMotionValue(-300);
  const rawY = useMotionValue(-300);

  // Soft trailing ambient glow aura
  const auraX = useSpring(rawX, { stiffness: 155, damping: 24, mass: 0.72 });
  const auraY = useSpring(rawY, { stiffness: 155, damping: 24, mass: 0.72 });

  // Snappier precision luminous halo ring
  const ringX = useSpring(rawX, { stiffness: 420, damping: 32, mass: 0.42 });
  const ringY = useSpring(rawY, { stiffness: 420, damping: 32, mass: 0.42 });

  const modeRef = useRef<CursorInteractionMode>('default');
  const visibleRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || prefersReduced) {
      setIsFinePointer(false);
      return;
    }

    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const syncPointerCapability = () => setIsFinePointer(mq.matches);
    syncPointerCapability();

    mq.addEventListener('change', syncPointerCapability);
    return () => mq.removeEventListener('change', syncPointerCapability);
  }, [prefersReduced]);

  useEffect(() => {
    if (!isFinePointer || prefersReduced) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      rawX.set(e.clientX);
      rawY.set(e.clientY);

      if (!visibleRef.current) {
        visibleRef.current = true;
        setIsVisible(true);
      }

      const nextMode = resolveCursorInteractionMode(e.target);
      if (nextMode !== modeRef.current) {
        modeRef.current = nextMode;
        setMode(nextMode);
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      setIsPressed(true);
    };

    const handlePointerUp = () => {
      setIsPressed(false);
    };

    const handleLeave = () => {
      visibleRef.current = false;
      setIsVisible(false);
      setIsPressed(false);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    document.addEventListener('mouseleave', handleLeave);
    window.addEventListener('blur', handleLeave);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('mouseleave', handleLeave);
      window.removeEventListener('blur', handleLeave);
    };
  }, [isFinePointer, prefersReduced, rawX, rawY]);

  if (prefersReduced || !isFinePointer) return null;

  const auraScale = !isVisible
    ? 0.5
    : mode === 'card'
    ? 1.32
    : mode === 'button'
    ? 0.88
    : mode === 'input'
    ? 0.65
    : 1;

  const auraOpacity = !isVisible
    ? 0
    : mode === 'input'
    ? 0.22
    : mode === 'card'
    ? 0.92
    : mode === 'button'
    ? 0.85
    : 0.62;

  const ringScale = !isVisible
    ? 0.4
    : isPressed
    ? 0.82
    : mode === 'card'
    ? 1.65
    : mode === 'button'
    ? 1.35
    : mode === 'input'
    ? 0.55
    : 1;

  const ringOpacity = !isVisible
    ? 0
    : mode === 'input'
    ? 0.12
    : mode === 'button'
    ? 0.85
    : mode === 'card'
    ? 0.65
    : 0.42;

  const auraBackground =
    mode === 'button'
      ? 'radial-gradient(circle, rgba(212, 175, 55, 0.24) 0%, rgba(16, 185, 129, 0.11) 42%, rgba(11, 70, 25, 0) 72%)'
      : mode === 'card'
      ? 'radial-gradient(circle, rgba(212, 175, 55, 0.20) 0%, rgba(11, 70, 25, 0.12) 45%, rgba(11, 70, 25, 0) 74%)'
      : 'radial-gradient(circle, rgba(212, 175, 55, 0.14) 0%, rgba(16, 185, 129, 0.08) 44%, rgba(11, 70, 25, 0) 72%)';

  const ringBorderColor =
    mode === 'button'
      ? 'rgba(212, 175, 55, 0.72)'
      : mode === 'card'
      ? 'rgba(11, 70, 25, 0.34)'
      : 'rgba(212, 175, 55, 0.38)';

  const ringFill =
    mode === 'button'
      ? 'rgba(212, 175, 55, 0.12)'
      : mode === 'card'
      ? 'rgba(212, 175, 55, 0.06)'
      : 'rgba(11, 70, 25, 0.02)';

  return (
    <div
      aria-hidden="true"
      className="no-print fixed inset-0 pointer-events-none z-[60] overflow-hidden"
    >
      {/* Layer 1: Soft Trailing Ambient Emerald-Gold Aura */}
      <motion.div
        style={{
          x: auraX,
          y: auraY,
          translateX: '-50%',
          translateY: '-50%',
          background: auraBackground,
          willChange: 'transform, opacity',
        }}
        animate={{
          scale: auraScale,
          opacity: auraOpacity,
        }}
        transition={{
          scale: { type: 'spring', stiffness: 240, damping: 24 },
          opacity: { duration: 0.26, ease: KINETIC_EASE },
        }}
        className="fixed top-0 left-0 w-52 h-52 rounded-full blur-2xl"
      />

      {/* Layer 2: Precision Reactive Luminous Ring */}
      <motion.div
        style={{
          x: ringX,
          y: ringY,
          translateX: '-50%',
          translateY: '-50%',
          willChange: 'transform, opacity',
        }}
        animate={{
          scale: ringScale,
          opacity: ringOpacity,
          borderColor: ringBorderColor,
          backgroundColor: ringFill,
          boxShadow:
            mode === 'button'
              ? '0 0 18px 2px rgba(212, 175, 55, 0.26), inset 0 0 8px rgba(212, 175, 55, 0.16)'
              : mode === 'card'
              ? '0 0 22px 2px rgba(11, 70, 25, 0.14), inset 0 0 10px rgba(212, 175, 55, 0.12)'
              : '0 0 10px 0px rgba(212, 175, 55, 0.14)',
        }}
        transition={{
          scale: { type: 'spring', stiffness: 360, damping: 26 },
          opacity: { duration: 0.2, ease: KINETIC_EASE },
          borderColor: { duration: 0.22 },
          backgroundColor: { duration: 0.22 },
          boxShadow: { duration: 0.22 },
        }}
        className="fixed top-0 left-0 w-8 h-8 rounded-full border-[1.25px]"
      />
    </div>
  );
};

export interface SnapSectionDefinition {
  id: string;
  label: string;
}

interface SectionSnapRailProps {
  sections: SnapSectionDefinition[];
}

/**
 * Minimal desktop vertical section-snap navigation rail that tracks the active
 * scroll-snap section via IntersectionObserver and glides smoothly on click.
 */
export const SectionSnapRail: React.FC<SectionSnapRailProps> = ({ sections }) => {
  const prefersReduced = useReducedMotion();
  const [activeId, setActiveId] = useState<string>(sections[0]?.id || '');

  useEffect(() => {
    if (typeof window === 'undefined' || sections.length === 0) return;

    const elements = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0 && visible[0].target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: '-22% 0px -55% 0px',
        threshold: [0.05, 0.25, 0.5],
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  const handleJump = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    setActiveId(id);
    target.scrollIntoView({
      behavior: prefersReduced ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  if (sections.length === 0) return null;

  return (
    <nav
      aria-label="Section quick navigation"
      className="no-print hidden xl:flex fixed right-3.5 top-1/2 -translate-y-1/2 z-30 flex-col items-end gap-2"
    >
      <div className="bg-white/80 backdrop-blur-md border border-[#E5E2D9] rounded-xl py-2.5 px-2 shadow-sm flex flex-col items-center gap-2">
        {sections.map((section, idx) => {
          const isActive = activeId === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => handleJump(section.id)}
              aria-label={`Jump to ${section.label}`}
              aria-current={isActive ? 'true' : undefined}
              className="group relative flex items-center justify-center w-5 h-5 cursor-pointer"
            >
              {/* Hover Editorial Label */}
              <span className="pointer-events-none absolute right-7 px-2.5 py-1 rounded-md bg-[#062611] text-white text-[11px] font-semibold tracking-wide whitespace-nowrap opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:translate-x-0 transition-all duration-200 shadow-md border border-[#D4AF37]/35">
                <span className="font-mono text-[#D4AF37] mr-1.5">0{idx + 1}</span>
                {section.label}
              </span>

              {/* Visual Segment Marker */}
              <span
                className={`relative block rounded-full transition-all duration-200 ${
                  isActive
                    ? 'w-1.5 h-4 bg-[#0B4619]'
                    : 'w-1.5 h-1.5 bg-slate-300 group-hover:bg-[#D4AF37] group-hover:scale-125'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="section-snap-rail-active"
                    transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                    className="absolute -inset-[2px] rounded-full ring-2 ring-[#D4AF37]/75"
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
