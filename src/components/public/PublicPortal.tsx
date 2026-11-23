import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  motion,
  AnimatePresence,
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
  CartesianGrid,
  Cell,
} from 'recharts';
import {
  HCDActivity,
  StateHCDActivity,
  StateHCDPublicActionItem,
  StateActivityCategory,
  STATE_CATEGORY_LABELS,
} from '../../types';
import { stateActivitiesService } from '../../services/stateActivitiesService';
import { PublicStateActivityModal } from './PublicStateActivityModal';
import {
  useHeroDossierReel,
  HeroDossierBackdropCanvas,
  HeroDossierReelBar,
  CuratedFallbackVisual,
} from './HeroDossierBackdropReel';
import { LivelihoodImpactFlow } from './LivelihoodImpactFlow';
import { PILLARS, getLgaById } from '../../data/lgas';
import { useData } from '../../context/DataContext';
import { AkwaIbomStateMap } from '../map/AkwaIbomStateMap';
import { AriseLogo } from '../common/Logos';
import { ActivityMediaImage } from '../common/ActivityMediaImage';
import { ImpactPulse } from '../common/ImpactPulse';
import {
  HistoricalImpactTrendOverlay,
  TrendFocusMetric,
} from '../common/HistoricalImpactTrendOverlay';
import {
  AnimatedCounter,
  ScrollReveal,
  ShowcaseImage,
  ParallaxLayer,
  ParallaxDecorativeField,
  AmbientParallaxGeometry,
  KineticSectionHeader,
  KineticActivityCard,
  SectionSnapRail,
  SnapSectionDefinition,
  KINETIC_EASE,
} from '../common/MotionPrimitives';
import {
  Search,
  GraduationCap,
  HeartPulse,
  Wrench,
  Sprout,
  Users,
  MapPin,
  CheckCircle2,
  Download,
  Eye,
  Building2,
  ArrowRight,
  Flag,
  Layers,
  ShieldCheck,
  Paperclip,
  Clock,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  X,
  ArrowUpRight,
  BarChart3,
  TrendingUp,
} from 'lucide-react';

import heroImpactImg from '../../assets/images/hero_akwa_ibom_impact_1795446602763.jpg';
import educationImg from '../../assets/images/pillar_education_learning_1795446602071.jpg';
import healthImg from '../../assets/images/pillar_health_wellness_1795446606506.jpg';
import skillsAgriImg from '../../assets/images/pillar_skills_agriculture_1795446599881.jpg';

interface PublicPortalProps {
  activities: HCDActivity[];
  onViewActivity: (activity: HCDActivity) => void;
  onOpenReportExport: () => void;
  onNavigateToLga: (lgaId: string) => void;
  externalSelectedLgaId?: string | null;
  onClearExternalLga?: () => void;
  externalSearchQuery?: string;
  onExternalSearchQueryChange?: (query: string) => void;
}

type DistrictMetric = 'beneficiaries' | 'budget' | 'projects';

const PILLAR_VISUALS: Record<string, { src: string; alt: string }> = {
  education: {
    src: educationImg,
    alt: 'Akwa Ibom students and educators engaging with digital learning resources in a sunlit classroom',
  },
  health: {
    src: healthImg,
    alt: 'Primary healthcare consultation supporting mothers and families in Akwa Ibom State',
  },
  vocational: {
    src: skillsAgriImg,
    alt: 'Young Akwa Ibom technicians building modern engineering and vocational competencies',
  },
  agriculture: {
    src: skillsAgriImg,
    alt: 'Agri-entrepreneurs cultivating high-yield seedlings in a solar-assisted training center',
  },
  cross_cutting_enablers: {
    src: heroImpactImg,
    alt: 'Modern civic innovation campus advancing cross-cutting digital and social infrastructure in Uyo',
  },
  values_ethics_social_behaviour: {
    src: heroImpactImg,
    alt: 'Community youth and civic leaders gathering across Akwa Ibom State public learning spaces',
  },
};

const HERO_CURATED_FALLBACKS: CuratedFallbackVisual[] = [
  {
    src: heroImpactImg,
    alt: 'Modern civic innovation campus advancing cross-cutting digital and social infrastructure in Uyo',
    pillarKey: 'cross_cutting_enablers',
    title: 'ARISE Agenda Civic & Digital Human Capital Hub',
    locationLabel: 'Uyo Senatorial District',
  },
  {
    src: educationImg,
    alt: 'Akwa Ibom students and educators engaging with digital learning resources in a sunlit classroom',
    pillarKey: 'education',
    title: 'Smart Classroom & Digital Literacy Transformation',
    locationLabel: 'Akwa Ibom Public Schools',
  },
  {
    src: healthImg,
    alt: 'Primary healthcare consultation supporting mothers and families in Akwa Ibom State',
    pillarKey: 'health',
    title: 'Maternal, Newborn & Primary Healthcare Outreach',
    locationLabel: 'Community Health Centres',
  },
  {
    src: skillsAgriImg,
    alt: 'Young Akwa Ibom technicians and agri-entrepreneurs advancing vocational and agricultural productivity',
    pillarKey: 'vocational',
    title: 'Youth Technical Skills & Modern Agro-Enterprise Centres',
    locationLabel: 'Across 31 LGAs',
  },
];

const PUBLIC_SNAP_SECTIONS: SnapSectionDefinition[] = [
  { id: 'hero-section', label: 'Civic Showcase' },
  { id: 'pillars-section', label: 'Six HCD Pillars' },
  { id: 'districts-section', label: 'Senatorial Districts' },
  { id: 'livelihood-flow-section', label: 'Livelihood Flow' },
  { id: 'map-section', label: '31-LGA Impact Map' },
  { id: 'registry-section', label: 'Verified Dossiers' },
  { id: 'assurance-section', label: 'Verification Standard' },
];

export const PublicPortal: React.FC<PublicPortalProps> = ({
  activities,
  onViewActivity,
  onOpenReportExport,
  onNavigateToLga,
  externalSelectedLgaId,
  onClearExternalLga,
  externalSearchQuery,
  onExternalSearchQueryChange,
}) => {
  const { pillars, getPillarDisplayName } = useData();
  const prefersReduced = useReducedMotion();

  // Scroll-triggered Parallax Refs & Transforms
  const heroRef = useRef<HTMLElement | null>(null);
  const assuranceRef = useRef<HTMLElement | null>(null);

  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const smoothHeroScroll = useSpring(heroScrollProgress, {
    stiffness: 110,
    damping: 26,
    restDelta: 0.001,
  });

  const heroBgY = useTransform(smoothHeroScroll, [0, 1], ['0%', '22%']);
  const heroBgScale = useTransform(smoothHeroScroll, [0, 1], [1.04, 1.13]);
  const heroDecorY = useTransform(smoothHeroScroll, [0, 1], ['0%', '-18%']);
  const heroDecorRotate = useTransform(smoothHeroScroll, [0, 1], [0, 9]);
  const heroDecorOpacity = useTransform(smoothHeroScroll, [0, 1], [0.22, 0.04]);
  const heroLeftY = useTransform(smoothHeroScroll, [0, 1], [0, 26]);
  const heroRightY = useTransform(smoothHeroScroll, [0, 1], [0, -22]);

  const { scrollYProgress: assuranceScrollProgress } = useScroll({
    target: assuranceRef,
    offset: ['start end', 'end start'],
  });
  const smoothAssuranceScroll = useSpring(assuranceScrollProgress, {
    stiffness: 110,
    damping: 26,
    restDelta: 0.001,
  });
  const assuranceDecorY = useTransform(smoothAssuranceScroll, [0, 1], [-28, 28]);
  const assuranceDecorRotate = useTransform(smoothAssuranceScroll, [0, 1], [-5, 5]);

  const [selectedLgaId, setSelectedLgaId] = useState<string | null>(null);
  const [selectedPillar, setSelectedPillar] = useState<string>('all');
  const [isTrendOverlayOpen, setIsTrendOverlayOpen] = useState<boolean>(false);
  const [trendOverlayMetric, setTrendOverlayMetric] = useState<TrendFocusMetric>('activities');
  const [spotlightPillarCode, setSpotlightPillarCode] = useState<string>('education');
  const [internalSearchQuery, setInternalSearchQuery] = useState<string>('');
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = (next: string) => {
    setInternalSearchQuery(next);
    onExternalSearchQueryChange?.(next);
  };
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [districtChartMetric, setDistrictChartMetric] = useState<DistrictMetric>('beneficiaries');

  // Hero Spotlight Carousel State
  const [heroSlideIdx, setHeroSlideIdx] = useState<number>(0);
  const [heroPaused, setHeroPaused] = useState<boolean>(false);

  // State-Level Activities Transparency for Citizens
  const [portalScope, setPortalScope] = useState<'lga' | 'state'>('lga');

  // Automatically bring LGA activities into view when typing in the header predictive search
  useEffect(() => {
    if (externalSearchQuery && externalSearchQuery.trim().length > 0 && portalScope !== 'lga') {
      setPortalScope('lga');
    }
  }, [externalSearchQuery, portalScope]);
  const [publishedStateActivities, setPublishedStateActivities] = useState<StateHCDActivity[]>([]);
  const [publicActionItems, setPublicActionItems] = useState<StateHCDPublicActionItem[]>([]);
  const [selectedStateCategory, setSelectedStateCategory] = useState<StateActivityCategory | 'all'>('all');
  const [stateSearchQuery, setStateSearchQuery] = useState('');
  const [inspectedStateActivity, setInspectedStateActivity] = useState<StateHCDActivity | null>(null);
  const [isStateLoading, setIsStateLoading] = useState(false);

  // Sync Footer / External LGA selection directly to the Geospatial Impact Map
  useEffect(() => {
    if (externalSelectedLgaId) {
      setSelectedLgaId(externalSelectedLgaId);
      const mapEl = document.getElementById('map-section');
      if (mapEl) {
        mapEl.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
      }
      onClearExternalLga?.();
    }
  }, [externalSelectedLgaId, onClearExternalLga, prefersReduced]);

  // Keep spotlightPillarCode aligned with available pillars
  useEffect(() => {
    if (pillars.length > 0 && !pillars.some((p) => p.pillar_code === spotlightPillarCode)) {
      setSpotlightPillarCode(pillars[0].pillar_code);
    }
  }, [pillars, spotlightPillarCode]);

  useEffect(() => {
    const loadPublishedStateActivities = async () => {
      setIsStateLoading(true);
      try {
        const [actRes, actionRes] = await Promise.all([
          stateActivitiesService.fetchStateActivities({ status: 'published' }),
          stateActivitiesService.fetchActionItems({}, false),
        ]);
        if (actRes.success) {
          setPublishedStateActivities(actRes.data);
        }
        if (actionRes.success) {
          setPublicActionItems(actionRes.data as StateHCDPublicActionItem[]);
        }
      } catch {
        // Non-blocking for public visitor portal
      } finally {
        setIsStateLoading(false);
      }
    };
    loadPublishedStateActivities();
  }, []);

  // Only published activities are displayed on the public transparency portal
  const publishedActivities = useMemo(() => {
    return activities.filter((a) => a.status === 'PUBLISHED');
  }, [activities]);

  // Dynamic background reel cycling through all verified project dossier photos & videos
  const heroBackdropReel = useHeroDossierReel({
    publishedActivities,
    publishedStateActivities,
    curatedFallbacks: HERO_CURATED_FALLBACKS,
  });

  // Featured Spotlight items for the Living Hero Carousel
  const spotlightActivities = useMemo(() => {
    return [...publishedActivities]
      .sort((a, b) => (b.beneficiariesTotal || 0) - (a.beneficiariesTotal || 0))
      .slice(0, 6);
  }, [publishedActivities]);

  // Auto-cycle hero spotlight when not paused and reduced motion is off
  useEffect(() => {
    if (prefersReduced || heroPaused || spotlightActivities.length <= 1) return;
    const timer = window.setInterval(() => {
      setHeroSlideIdx((prev) => (prev + 1) % spotlightActivities.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [prefersReduced, heroPaused, spotlightActivities.length]);

  const currentHeroSpotlight =
    spotlightActivities.length > 0
      ? spotlightActivities[heroSlideIdx % spotlightActivities.length]
      : null;

  // Aggregate Key Counters
  const totalBeneficiaries = useMemo(
    () => publishedActivities.reduce((acc, a) => acc + (a.beneficiariesTotal || 0), 0),
    [publishedActivities]
  );

  const totalBudget = useMemo(
    () => publishedActivities.reduce((acc, a) => acc + (a.budgetNgn || 0), 0),
    [publishedActivities]
  );

  const activeLgasCount = useMemo(() => {
    const set = new Set(publishedActivities.map((a) => a.lgaId));
    return set.size;
  }, [publishedActivities]);

  // Senatorial District live comparison dataset
  const districtAnalytics = useMemo(() => {
    const buckets = [
      {
        id: 'uyo',
        label: 'Uyo (North-East)',
        shortLabel: 'Uyo NE',
        councils: 9,
        beneficiaries: 0,
        budgetNgn: 0,
        projects: 0,
        color: '#0F5C3A',
      },
      {
        id: 'ikot-ekpene',
        label: 'Ikot Ekpene (North-West)',
        shortLabel: 'Ikot Ekpene NW',
        councils: 10,
        beneficiaries: 0,
        budgetNgn: 0,
        projects: 0,
        color: '#047857',
      },
      {
        id: 'eket',
        label: 'Eket (South)',
        shortLabel: 'Eket South',
        councils: 12,
        beneficiaries: 0,
        budgetNgn: 0,
        projects: 0,
        color: '#B89226',
      },
    ];

    publishedActivities.forEach((act) => {
      const lga = getLgaById(act.lgaId);
      const dist = lga?.senatorialDistrict || '';
      const target = dist.includes('North-East')
        ? buckets[0]
        : dist.includes('North-West')
        ? buckets[1]
        : dist.includes('South')
        ? buckets[2]
        : null;
      if (target) {
        target.beneficiaries += act.beneficiariesTotal || 0;
        target.budgetNgn += act.budgetNgn || 0;
        target.projects += 1;
      }
    });

    return buckets.map((b) => ({
      ...b,
      budgetM: Number((b.budgetNgn / 1_000_000).toFixed(2)),
      metricValue:
        districtChartMetric === 'beneficiaries'
          ? b.beneficiaries
          : districtChartMetric === 'budget'
          ? Number((b.budgetNgn / 1_000_000).toFixed(2))
          : b.projects,
    }));
  }, [publishedActivities, districtChartMetric]);

  // Active Spotlight Pillar Analytics
  const activeSpotlightPillar = useMemo(() => {
    const pObj = pillars.find((p) => p.pillar_code === spotlightPillarCode) || pillars[0];
    if (!pObj) return null;

    const pActs = publishedActivities.filter((a) => a.pillar === pObj.pillar_code);
    const totalBen = pActs.reduce((acc, a) => acc + (a.beneficiariesTotal || 0), 0);
    const maleBen = pActs.reduce((acc, a) => acc + (a.beneficiariesMale || 0), 0);
    const femaleBen = pActs.reduce((acc, a) => acc + (a.beneficiariesFemale || 0), 0);
    const youthBen = pActs.reduce((acc, a) => acc + (a.youthBeneficiaries || 0), 0);
    const budgetNgn = pActs.reduce((acc, a) => acc + (a.budgetNgn || 0), 0);
    const lgaSet = new Set(pActs.map((a) => a.lgaName));
    const topLgas = Array.from(lgaSet).slice(0, 4);

    const genderTotal = maleBen + femaleBen;
    const malePct = genderTotal > 0 ? Math.round((maleBen / genderTotal) * 100) : 0;
    const femalePct = genderTotal > 0 ? 100 - malePct : 0;
    const youthPct = totalBen > 0 ? Math.min(100, Math.round((youthBen / totalBen) * 100)) : 0;

    return {
      pillar: pObj,
      meta: PILLARS[pObj.pillar_code],
      visual: PILLAR_VISUALS[pObj.pillar_code] || { src: heroImpactImg, alt: pObj.display_name },
      activitiesCount: pActs.length,
      totalBen,
      malePct,
      femalePct,
      youthPct,
      budgetNgn,
      councilsCount: lgaSet.size,
      topLgas,
    };
  }, [pillars, spotlightPillarCode, publishedActivities]);

  // Filtered LGA Activities
  const filteredActivities = useMemo(() => {
    return publishedActivities.filter((a) => {
      const matchLga = !selectedLgaId || a.lgaId.toLowerCase() === selectedLgaId.toLowerCase();
      const matchPillar = selectedPillar === 'all' || a.pillar === selectedPillar;
      const matchSearch =
        !searchQuery ||
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.lgaName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.community.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.projectDescription || a.subCategory || '').toLowerCase().includes(searchQuery.toLowerCase());

      const lgaObj = getLgaById(a.lgaId);
      const matchDistrict =
        districtFilter === 'all' ||
        (districtFilter === 'uyo' && lgaObj?.senatorialDistrict.includes('North-East')) ||
        (districtFilter === 'ikot-ekpene' && lgaObj?.senatorialDistrict.includes('North-West')) ||
        (districtFilter === 'eket' && lgaObj?.senatorialDistrict.includes('South'));

      return matchLga && matchPillar && matchSearch && matchDistrict;
    });
  }, [publishedActivities, selectedLgaId, selectedPillar, searchQuery, districtFilter]);

  const filteredStateActivities = useMemo(() => {
    return publishedStateActivities.filter((act) => {
      const matchCategory = selectedStateCategory === 'all' || act.category === selectedStateCategory;
      const matchSearch =
        !stateSearchQuery ||
        act.title.toLowerCase().includes(stateSearchQuery.toLowerCase()) ||
        act.lead_institution.toLowerCase().includes(stateSearchQuery.toLowerCase()) ||
        (act.location && act.location.toLowerCase().includes(stateSearchQuery.toLowerCase())) ||
        (act.description && act.description.toLowerCase().includes(stateSearchQuery.toLowerCase()));
      return matchCategory && matchSearch;
    });
  }, [publishedStateActivities, selectedStateCategory, stateSearchQuery]);

  const selectedLgaObj = selectedLgaId ? getLgaById(selectedLgaId) : null;

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
    }
  };

  const renderPillarIcon = (code: string, className = 'w-4 h-4') => {
    if (code === 'education') return <GraduationCap className={className} />;
    if (code === 'health') return <HeartPulse className={className} />;
    if (code === 'vocational') return <Wrench className={className} />;
    if (code === 'agriculture') return <Sprout className={className} />;
    if (code === 'cross_cutting_enablers') return <Layers className={className} />;
    return <ShieldCheck className={className} />;
  };

  const marqueeItems = useMemo(() => {
    if (publishedActivities.length === 0) return [];
    const base = publishedActivities.slice(0, 10);
    return [...base, ...base];
  }, [publishedActivities]);

  const hasActiveFilters =
    Boolean(selectedLgaId) || selectedPillar !== 'all' || districtFilter !== 'all' || Boolean(searchQuery);

  return (
    <div className="relative bg-[#F6F8F7] text-slate-900 pb-20 overflow-x-clip">
      {/* Global Ambient Scroll-Parallax Abstract Civic Geometry */}
      <AmbientParallaxGeometry />

      {/* =====================================================================
          1. KINETIC CIVIC HERO STAGE (Multi-Plane Scroll Parallax)
          ===================================================================== */}
      <section
        id="hero-section"
        ref={heroRef}
        className="kinetic-snap-section relative z-10 overflow-hidden bg-[#0A2E1F] text-white border-b-4 border-[#D97706]"
      >
        {/* Plane 1: Dynamic Verified Project Dossier Photos & Videos Reel with Scroll Parallax Depth */}
        <motion.div
          style={
            prefersReduced
              ? undefined
              : { y: heroBgY, scale: heroBgScale, willChange: 'transform' }
          }
          className="absolute inset-0 pointer-events-none origin-center"
        >
          <HeroDossierBackdropCanvas reel={heroBackdropReel} />
        </motion.div>

        {/* Measured Directional Contrast Scrims — Keeps Headline Crisp While Letting Dossier Media Shine Clearly */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#041A0B]/74 via-[#052110]/34 to-[#041A0B]/16" />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#0A2E1F]/82 via-transparent to-[#041A0B]/28" />

        {/* Plane 2: Subtle Mid-Ground Crest Gold Architectural Lattice & Luminous Arcs */}
        <motion.div
          aria-hidden="true"
          style={
            prefersReduced
              ? undefined
              : {
                  y: heroDecorY,
                  opacity: heroDecorOpacity,
                  willChange: 'transform, opacity',
                }
          }
          className="no-print absolute inset-0 pointer-events-none overflow-hidden"
        >
          <svg className="w-full h-full opacity-15" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="hero-kinetic-lattice" width="56" height="56" patternUnits="userSpaceOnUse">
                <circle cx="28" cy="28" r="1.2" fill="#D97706" />
                <path d="M 56 0 L 0 0 0 56" fill="none" stroke="#D97706" strokeWidth="0.3" opacity="0.28" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-kinetic-lattice)" />
          </svg>

          <motion.svg
            style={prefersReduced ? undefined : { rotate: heroDecorRotate, willChange: 'transform' }}
            className="absolute -right-28 -top-24 w-[520px] h-[520px] text-[#F59E0B]/20"
            viewBox="0 0 400 400"
            fill="none"
          >
            <circle cx="200" cy="200" r="185" stroke="currentColor" strokeWidth="1" strokeDasharray="5 10" />
            <circle cx="200" cy="200" r="138" stroke="currentColor" strokeWidth="0.8" />
            <circle cx="200" cy="200" r="90" stroke="currentColor" strokeWidth="0.6" strokeDasharray="2 6" />
          </motion.svg>

          <div className="absolute -left-24 bottom-0 w-96 h-96 rounded-full bg-radial from-[#D97706]/14 via-emerald-500/8 to-transparent blur-3xl" />
        </motion.div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-20 lg:pt-16 lg:pb-24 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            {/* Left Dominant Focal Carrier (7 cols) with Subtle Foreground Parallax */}
            <motion.div
              initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              style={prefersReduced ? undefined : { y: heroLeftY, willChange: 'transform' }}
              transition={{ duration: 0.6, ease: KINETIC_EASE }}
              className="lg:col-span-7 flex flex-col justify-center space-y-6"
            >
              {/* Clean Editorial Kicker (Zero-Pill Discipline) */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide text-[#FBBF24] drop-shadow-[0_1px_6px_rgba(0,0,0,0.75)]">
                <span>Akwa Ibom State Government</span>
                <span aria-hidden="true" className="text-white/50">·</span>
                <span className="text-emerald-100">ARISE Agenda Human Capital Blueprint</span>
                <span aria-hidden="true" className="text-white/50">·</span>
                <span className="text-emerald-100/95">31 Autonomous Councils</span>
              </div>

              <h1
                className="font-display font-bold text-white tracking-tight leading-[1.08] text-balance drop-shadow-[0_2px_16px_rgba(0,0,0,0.68)]"
                style={{ fontSize: 'clamp(2.25rem, 4.2vw, 3.75rem)' }}
              >
                ARISE Human Capital Development Implementation Dashboard
              </h1>

              <p className="text-sm sm:text-base text-white/95 leading-relaxed max-w-2xl drop-shadow-[0_1px_10px_rgba(0,0,0,0.7)]">
                Track Cabinet-verified grassroots investments in Education, Healthcare, Technical Skills, Agriculture, Cross-Cutting Enablers, and Civic Values—complete with geospatial coordinates, photographic proof, and biometric beneficiary rolls.
              </p>

              {/* Single Dominant Primary CTA + Crisp Secondary Action */}
              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <button
                  type="button"
                  onClick={() => scrollToSection('map-section')}
                  className="px-6 py-3.5 rounded-xl bg-[#D97706] hover:bg-[#B45309] text-white font-bold text-xs sm:text-sm shadow-lg shadow-black/30 transition-all duration-200 active:scale-[0.98] inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <MapPin className="w-4 h-4" />
                  Explore 31-LGA Impact Map
                </button>

                <button
                  type="button"
                  onClick={onOpenReportExport}
                  className="px-5 py-3.5 rounded-xl bg-[#0A2E1F]/55 hover:bg-[#0A2E1F]/75 text-white font-semibold text-xs sm:text-sm border border-white/30 backdrop-blur-md shadow-lg shadow-black/20 transition-all duration-200 inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-4 h-4 text-[#F59E0B]" />
                  Executive Briefing Report
                </button>
              </div>
            </motion.div>

            {/* Right Living ARISE Showcase & Verified Field Spotlight Card (5 cols) */}
            <motion.div
              initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              style={prefersReduced ? undefined : { y: heroRightY, willChange: 'transform' }}
              transition={{ duration: 0.65, delay: 0.1, ease: KINETIC_EASE }}
              onMouseEnter={() => setHeroPaused(true)}
              onMouseLeave={() => setHeroPaused(false)}
              className="lg:col-span-5 flex flex-col"
            >
              <div className="h-full bg-[#0A2E1F]/62 backdrop-blur-md rounded-2xl border border-white/20 p-6 sm:p-7 shadow-2xl flex flex-col justify-between gap-6">
                {/* Official ARISE Agenda Crest Header */}
                <div className="flex items-center gap-4 pb-5 border-b border-white/12">
                  <div className="w-20 h-20 sm:w-22 sm:h-22 aspect-square rounded-full bg-white p-2.5 shadow-xl border-[3px] border-[#D97706] flex items-center justify-center shrink-0 transition-transform duration-300 hover:scale-105">
                    <AriseLogo className="w-full h-full object-contain" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#F59E0B] tracking-wide">
                      ARISE AGENDA
                    </div>
                    <h2 className="font-display text-lg sm:text-xl font-bold text-white leading-snug">
                      Live Verified Spotlight
                    </h2>
                    <p className="text-xs text-emerald-200/85 mt-0.5 leading-snug">
                      Real-time Cabinet-audited community interventions across Akwa Ibom State.
                    </p>
                  </div>
                </div>

                {/* Live Cycling Verified Activity Spotlight */}
                <div className="flex-1 flex flex-col justify-between">
                  {currentHeroSpotlight ? (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentHeroSpotlight.id}
                        initial={prefersReduced ? { opacity: 1 } : { opacity: 0, x: 14 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={prefersReduced ? { opacity: 1 } : { opacity: 0, x: -14 }}
                        transition={{ duration: 0.3, ease: KINETIC_EASE }}
                        className="space-y-4"
                      >
                        <div className="text-xs text-emerald-200/90 flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-[#F59E0B]">
                            {currentHeroSpotlight.lgaName} LGA
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{getPillarDisplayName(currentHeroSpotlight.pillar)}</span>
                        </div>

                        <h3 className="font-display text-lg sm:text-xl font-semibold text-white leading-snug line-clamp-2">
                          {currentHeroSpotlight.title}
                        </h3>

                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div className="p-3 rounded-xl bg-white/8 border border-white/10">
                            <span className="text-[11px] text-emerald-200/80 block">
                              Verified Reach
                            </span>
                            <span className="text-lg font-bold text-white font-mono tabular-nums">
                              {currentHeroSpotlight.beneficiariesTotal.toLocaleString()}
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-white/8 border border-white/10">
                            <span className="text-[11px] text-emerald-200/80 block">
                              Invested Capital
                            </span>
                            <span className="text-lg font-bold text-[#F59E0B] font-mono tabular-nums">
                              ₦{(currentHeroSpotlight.budgetNgn / 1_000_000).toFixed(1)}M
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <button
                            type="button"
                            onClick={() => onViewActivity(currentHeroSpotlight)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F59E0B] hover:text-amber-200 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Inspect Dossier & Proof
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>

                          {spotlightActivities.length > 1 && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-mono tabular-nums text-emerald-200/80 mr-1">
                                {(heroSlideIdx % spotlightActivities.length) + 1}/{spotlightActivities.length}
                              </span>
                              <button
                                type="button"
                                aria-label="Previous featured project"
                                onClick={() =>
                                  setHeroSlideIdx(
                                    (prev) => (prev - 1 + spotlightActivities.length) % spotlightActivities.length
                                  )
                                }
                                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label="Next featured project"
                                onClick={() =>
                                  setHeroSlideIdx((prev) => (prev + 1) % spotlightActivities.length)
                                }
                                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  ) : (
                    <div className="py-4 text-xs text-emerald-100/85 leading-relaxed">
                      Published grassroots activities across all 31 Local Government Areas will appear here automatically upon State Executive verification.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Interactive Background Dossier Reel Caption, Progress & Controls */}
          <HeroDossierReelBar
            reel={heroBackdropReel}
            onInspectActivity={onViewActivity}
            onInspectStateActivity={(act) => setInspectedStateActivity(act)}
          />
        </div>
      </section>

      {/* =====================================================================
          2. ROLLING SPRING KPI STRIP + IMPACT PULSE + GRASSROOTS MARQUEE
          ===================================================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-20 space-y-4">
        <div className="relative bg-white rounded-2xl shadow-lg shadow-emerald-950/8 border border-[#E2E8E5] overflow-hidden">
          {/* Grassroots HCD Heartbeat Bar */}
          <ImpactPulse
            variant="bar"
            projectCount={publishedActivities.length}
            activeLgasCount={activeLgasCount}
            beneficiariesTotal={totalBeneficiaries}
          />

          <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-6 lg:divide-x lg:divide-[#EAEFED]">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-500 block">
                Verified Beneficiaries
              </span>
              <div className="text-2xl sm:text-3xl font-bold text-[#0F5C3A] font-mono tabular-nums">
                <AnimatedCounter value={totalBeneficiaries} />
              </div>
              <p className="text-xs text-emerald-800 font-medium">
                Biometrically documented citizens
              </p>
            </div>

            <div className="space-y-1 lg:pl-6">
              <span className="text-xs font-semibold text-slate-500 block">
                Published Grassroots Projects
              </span>
              <div className="text-2xl sm:text-3xl font-bold text-slate-950 font-mono tabular-nums">
                <AnimatedCounter value={publishedActivities.length} />
              </div>
              <p className="text-xs text-slate-500">
                Cabinet approved & EXIF verified
              </p>
            </div>

            <div className="space-y-1 lg:pl-6">
              <span className="text-xs font-semibold text-slate-500 block">
                Active Local Governments
              </span>
              <div className="text-2xl sm:text-3xl font-bold text-slate-950 font-mono tabular-nums">
                <AnimatedCounter value={activeLgasCount} suffix=" / 31" />
              </div>
              <p className="text-xs text-emerald-800 font-medium">
                Across 3 Senatorial Districts
              </p>
            </div>

            <div className="space-y-1 lg:pl-6">
              <span className="text-xs font-semibold text-slate-500 block">
                Capacity Capital Deployed
              </span>
              <div className="text-2xl sm:text-3xl font-bold text-[#0F5C3A] font-mono tabular-nums">
                <AnimatedCounter value={totalBudget / 1_000_000} prefix="₦" suffix="M" decimals={1} />
              </div>
              <p className="text-xs text-slate-500">
                Direct grassroots investments
              </p>
            </div>
          </div>

          {/* Historical Impact Trend Overlay Trigger Bar */}
          <div className="no-print px-6 py-3 bg-[#F6F8F7]/80 border-t border-[#EAEFED] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <TrendingUp className="w-3.5 h-3.5 text-[#0F5C3A] shrink-0" />
              <span className="font-semibold text-slate-800">Historical Impact Trend</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span>Month-over-month capacity building growth &amp; cumulative citizen trajectory</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setTrendOverlayMetric('activities');
                setIsTrendOverlayOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0F5C3A] hover:bg-emerald-900 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <TrendingUp className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span>View MoM Trend Overlay</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#F59E0B]" />
            </button>
          </div>
        </div>

        {/* Pause-on-Hover Interactive Grassroots Highlights Strip */}
        {marqueeItems.length > 0 && (
          <div
            aria-label="Verified grassroots impact stream"
            className="kinetic-marquee-viewport overflow-hidden bg-white rounded-xl border border-[#E2E8E5] py-2.5"
          >
            <div className="kinetic-marquee-track items-center gap-3 px-3">
              {marqueeItems.map((act, idx) => (
                <button
                  key={`${act.id}-${idx}`}
                  type="button"
                  onClick={() => onViewActivity(act)}
                  className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-[#F6F8F7] hover:bg-emerald-50 border border-[#EAEFED] hover:border-emerald-300 transition-colors text-xs whitespace-nowrap shrink-0 cursor-pointer group"
                >
                  <span className="font-semibold text-[#0F5C3A]">{act.lgaName}</span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="text-slate-800 font-medium max-w-[230px] truncate group-hover:text-[#0F5C3A]">
                    {act.title}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-600">
                    {act.beneficiariesTotal.toLocaleString()} reached
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* =====================================================================
          3. INTERACTIVE 6-PILLAR SPOTLIGHT STAGE (01. – 06.)
          ===================================================================== */}
      <section id="pillars-section" className="kinetic-snap-section relative overflow-x-clip scroll-mt-16">
        <ParallaxDecorativeField variant="gold-contours" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 space-y-8 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E2E8E5] pb-4">
          <KineticSectionHeader
            kicker="Strategic Mandate · Six Pillars"
            title="Human Capital Development Pillars & Cross-Cutting Enablers"
            description="Select any pillar to inspect live beneficiary reach, demographic balance, and council coverage across the ARISE HCD Blueprint."
            className="max-w-2xl"
          />

          {selectedPillar !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedPillar('all')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F5C3A] text-white text-xs font-semibold hover:bg-emerald-900 transition-colors cursor-pointer whitespace-nowrap self-start md:self-auto"
            >
              Clear Pillar Filter
            </button>
          )}
        </div>

        <ScrollReveal delay={0.06}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left: Numbered Interactive Pillar Selector Rail (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-2">
              {pillars.map((p, index) => {
                const isSpotlight = activeSpotlightPillar?.pillar.pillar_code === p.pillar_code;
                const pActs = publishedActivities.filter((a) => a.pillar === p.pillar_code);
                const pBen = pActs.reduce((acc, a) => acc + (a.beneficiariesTotal || 0), 0);
                const color = PILLARS[p.pillar_code]?.color || '#0F5C3A';

                return (
                  <button
                    key={p.pillar_code}
                    type="button"
                    onClick={() => setSpotlightPillarCode(p.pillar_code)}
                    className={`relative text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 ${
                      isSpotlight
                        ? 'border-[#0F5C3A] bg-white shadow-md shadow-emerald-950/6'
                        : 'border-[#E2E8E5] bg-white/70 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    {isSpotlight && (
                      <motion.div
                        layoutId="activePillarHighlight"
                        transition={{ duration: 0.25, ease: KINETIC_EASE }}
                        className="absolute inset-0 rounded-xl ring-2 ring-[#0F5C3A]/20 pointer-events-none"
                      />
                    )}

                    <div className="flex items-center gap-3.5 min-w-0">
                      <span className="font-mono text-xs font-bold text-slate-400 tabular-nums shrink-0">
                        0{index + 1}.
                      </span>
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: color }}
                      >
                        {renderPillarIcon(p.pillar_code, 'w-4 h-4')}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">
                          {p.display_name}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono tabular-nums">{pActs.length} projects</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums font-medium text-slate-700">
                            {pBen.toLocaleString()} reached
                          </span>
                        </div>
                      </div>
                    </div>

                    <ChevronRight
                      className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                        isSpotlight ? 'text-[#0F5C3A] translate-x-0.5' : 'text-slate-300'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Right: Animated Pillar Spotlight Stage (7 cols) */}
            <div className="lg:col-span-7 flex">
              {activeSpotlightPillar && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeSpotlightPillar.pillar.pillar_code}
                    initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReduced ? { opacity: 1 } : { opacity: 0, y: -10 }}
                    transition={{ duration: 0.26, ease: KINETIC_EASE }}
                    className="w-full bg-white rounded-2xl border border-[#E2E8E5] overflow-hidden flex flex-col justify-between shadow-sm"
                  >
                    {/* Editorial Visual Header with Scroll Parallax & Measured Contrast Scrim */}
                    <div className="relative h-56 sm:h-64 w-full overflow-hidden">
                      <ParallaxLayer
                        offsetY={[-16, 16]}
                        scaleRange={[1.08, 1.14]}
                        className="w-full h-full"
                      >
                        <ShowcaseImage
                          src={activeSpotlightPillar.visual.src}
                          alt={activeSpotlightPillar.visual.alt}
                          fallbackTitle={activeSpotlightPillar.pillar.display_name}
                          className="w-full h-full"
                          imgClassName="transition-transform duration-700 hover:scale-105"
                        />
                      </ParallaxLayer>
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0A2E1F]/90 via-[#0A2E1F]/35 to-transparent pointer-events-none" />
                      <div className="absolute bottom-5 left-6 right-6 text-white space-y-1.5">
                        <div className="text-xs font-semibold text-[#F59E0B] flex items-center gap-2">
                          <span>Active Pillar Spotlight</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {activeSpotlightPillar.councilsCount} Active Councils
                          </span>
                        </div>
                        <h3 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight text-balance">
                          {activeSpotlightPillar.pillar.display_name}
                        </h3>
                      </div>
                    </div>

                    {/* Spotlight Body & Live Metrics */}
                    <div className="p-6 space-y-6 flex-1 flex flex-col justify-between">
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {activeSpotlightPillar.pillar.pillar_code === 'agriculture'
                          ? 'Building Human Capital Development in Homes, Communities, Learning Institutions & Workplaces through modern agricultural empowerment and food security skills.'
                          : activeSpotlightPillar.pillar.description ||
                            activeSpotlightPillar.meta?.tagline ||
                            'Targeted grassroots human capital investments tracked across all 31 Local Government Areas.'}
                      </p>

                      {/* 3 Crisp Tabular Metrics */}
                      <div className="grid grid-cols-3 gap-4 py-4 border-y border-[#EAEFED]">
                        <div>
                          <span className="text-xs text-slate-500 block">Beneficiaries</span>
                          <strong className="text-xl sm:text-2xl font-bold text-[#0F5C3A] font-mono tabular-nums">
                            {activeSpotlightPillar.totalBen.toLocaleString()}
                          </strong>
                        </div>
                        <div>
                          <span className="text-xs text-slate-500 block">Capital Deployed</span>
                          <strong className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tabular-nums">
                            ₦{(activeSpotlightPillar.budgetNgn / 1_000_000).toFixed(1)}M
                          </strong>
                        </div>
                        <div>
                          <span className="text-xs text-slate-500 block">Verified Projects</span>
                          <strong className="text-xl sm:text-2xl font-bold text-slate-900 font-mono tabular-nums">
                            {activeSpotlightPillar.activitiesCount}
                          </strong>
                        </div>
                      </div>

                      {/* Animated Gender & Youth Proportion Bar */}
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-slate-800">
                            Beneficiary Demographic Mix
                          </span>
                          <span className="font-mono tabular-nums text-slate-600">
                            Male {activeSpotlightPillar.malePct}% · Female {activeSpotlightPillar.femalePct}% · Youth {activeSpotlightPillar.youthPct}%
                          </span>
                        </div>
                        <div className="h-2.5 w-full rounded-full overflow-hidden bg-[#F1EEE5] flex">
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: prefersReduced ? 0 : 0.45, ease: KINETIC_EASE }}
                            style={{
                              width: `${activeSpotlightPillar.malePct}%`,
                              transformOrigin: 'left',
                            }}
                            className="bg-[#0F5C3A] h-full"
                          />
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{
                              duration: prefersReduced ? 0 : 0.45,
                              delay: 0.08,
                              ease: KINETIC_EASE,
                            }}
                            style={{
                              width: `${activeSpotlightPillar.femalePct}%`,
                              transformOrigin: 'left',
                            }}
                            className="bg-[#D97706] h-full"
                          />
                        </div>
                      </div>

                      {/* Active Councils + Direct Registry Filter Action */}
                      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                        <div className="text-xs text-slate-600">
                          {activeSpotlightPillar.topLgas.length > 0 ? (
                            <>
                              <span className="font-semibold text-slate-900">Active in: </span>
                              <span>{activeSpotlightPillar.topLgas.join(' · ')}</span>
                            </>
                          ) : (
                            <span>Awaiting newly published council submissions for this pillar.</span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPillar(activeSpotlightPillar.pillar.pillar_code);
                            setPortalScope('lga');
                            scrollToSection('registry-section');
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F5C3A] hover:bg-emerald-900 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <span>Filter Verified Dossiers</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </div>
        </ScrollReveal>
        </div>
      </section>

      {/* =====================================================================
          4. SENATORIAL DISTRICT LIVE ANALYTICS STRIP
          ===================================================================== */}
      <section id="districts-section" className="kinetic-snap-section relative overflow-x-clip scroll-mt-16">
        <ParallaxDecorativeField variant="emerald-compass" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 space-y-6 relative z-10">
        <ScrollReveal>
          <div className="bg-white rounded-2xl border border-[#E2E8E5] p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#EAEFED]">
              <KineticSectionHeader
                kicker={
                  <span className="inline-flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Regional Distribution · Live Comparison</span>
                  </span>
                }
                title="Senatorial District Performance Pulse"
                description="Compare verified human capital reach across Uyo, Ikot Ekpene, and Eket districts. Click any district card to isolate its verified dossiers."
                className="max-w-2xl"
              />

              {/* Interactive Metric Switcher */}
              <div className="flex items-center gap-1 p-1 bg-[#F6F8F7] border border-[#E2E8E5] rounded-xl text-xs self-start md:self-auto">
                {(
                  [
                    { id: 'beneficiaries', label: 'Beneficiaries' },
                    { id: 'budget', label: 'Capital (₦M)' },
                    { id: 'projects', label: 'Projects' },
                  ] as const
                ).map((m) => {
                  const active = districtChartMetric === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setDistrictChartMetric(m.id)}
                      className={`relative px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                        active ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="districtMetricActive"
                          transition={{ duration: 0.22, ease: KINETIC_EASE }}
                          className="absolute inset-0 bg-[#0F5C3A] rounded-lg"
                        />
                      )}
                      <span className="relative z-10">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 items-center">
              {/* Recharts Animated District Bar Chart (7 cols) */}
              <div className="lg:col-span-7 h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={districtAnalytics}
                    margin={{ top: 12, right: 20, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#EAEFED" vertical={false} />
                    <XAxis
                      dataKey="shortLabel"
                      tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }}
                      axisLine={{ stroke: '#E2E8E5' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      width={54}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(15, 92, 58, 0.05)' }}
                      contentStyle={{
                        backgroundColor: '#0A2E1F',
                        border: '1px solid rgba(217, 119, 6, 0.5)',
                        borderRadius: '10px',
                        color: '#ffffff',
                        fontSize: '12px',
                      }}
                      formatter={(val: any) => {
                        if (districtChartMetric === 'beneficiaries') {
                          return [`${Number(val).toLocaleString()} citizens`, 'Verified Beneficiaries'];
                        }
                        if (districtChartMetric === 'budget') {
                          return [`₦${Number(val).toFixed(2)}M`, 'Capital Deployed'];
                        }
                        return [`${val} verified projects`, 'Published Dossiers'];
                      }}
                    />
                    <Bar
                      dataKey="metricValue"
                      radius={[8, 8, 0, 0]}
                      barSize={54}
                      isAnimationActive={!prefersReduced}
                    >
                      {districtAnalytics.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Interactive Senatorial District Cards (5 cols) */}
              <div className="lg:col-span-5 space-y-3">
                {districtAnalytics.map((dist) => {
                  const isActive = districtFilter === dist.id;
                  return (
                    <button
                      key={dist.id}
                      type="button"
                      onClick={() => {
                        setDistrictFilter(isActive ? 'all' : dist.id);
                        setPortalScope('lga');
                        scrollToSection('registry-section');
                      }}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between gap-4 ${
                        isActive
                          ? 'border-[#0F5C3A] bg-emerald-50/60 shadow-xs'
                          : 'border-[#EAEFED] bg-[#F6F8F7]/60 hover:bg-[#F6F8F7] hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-bold text-slate-900">{dist.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                          {dist.councils} LGAs · {dist.projects} projects · ₦{dist.budgetM.toFixed(1)}M
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-base font-bold text-[#0F5C3A] font-mono tabular-nums">
                          {dist.beneficiaries.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-slate-500">beneficiaries</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollReveal>
        </div>
      </section>

      {/* =====================================================================
          4B. D3.JS LIVELIHOOD IMPACT FLOW (CAPACITY BUILDING -> EMPOWERMENT)
          ===================================================================== */}
      <section
        id="livelihood-flow-section"
        className="kinetic-snap-section relative overflow-x-clip scroll-mt-20"
      >
        <ParallaxDecorativeField variant="gold-contours" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 space-y-6 relative z-10">
          <KineticSectionHeader
            kicker="Livelihood Transition · D3.js Impact Flow"
            title="From Capacity Building to Economic Empowerment"
            description="Trace how verified citizens across all 31 Local Government Areas transition from targeted HCD capacity building into productive livelihoods, skilled employment, and community enterprise."
          />

          <ScrollReveal delay={0.05}>
            <LivelihoodImpactFlow
              publishedActivities={publishedActivities}
              onSelectPillarFilter={(pillarCode) => {
                setSelectedPillar(pillarCode);
                setPortalScope('lga');
                scrollToSection('registry-section');
              }}
              onSelectLgaFocus={(lgaId) => {
                setSelectedLgaId(lgaId);
                scrollToSection('map-section');
              }}
            />
          </ScrollReveal>
        </div>
      </section>

      {/* =====================================================================
          5. UPGRADED AKWA IBOM STATE GEOSPATIAL IMPACT MAP (CENTERPIECE)
          ===================================================================== */}
      <section
        id="map-section"
        className="kinetic-snap-section relative overflow-x-clip scroll-mt-20"
      >
        <ParallaxDecorativeField variant="civic-prism" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 space-y-6 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <KineticSectionHeader
            kicker="Territorial Intelligence · Live Spatial Workbench"
            title="31 Local Government Areas Impact Explorer"
          />

          {selectedLgaId && (
            <button
              type="button"
              onClick={() => setSelectedLgaId(null)}
              className="text-xs font-semibold text-[#0F5C3A] hover:underline cursor-pointer self-start sm:self-auto"
            >
              Reset to All 31 LGAs
            </button>
          )}
        </div>

        <ScrollReveal delay={0.05}>
          <AkwaIbomStateMap
            activities={activities}
            selectedLgaId={selectedLgaId}
            onSelectLga={(id) => setSelectedLgaId(id)}
            onViewActivity={onViewActivity}
            onJumpToRegistry={() => {
              setPortalScope('lga');
              scrollToSection('registry-section');
            }}
          />
        </ScrollReveal>
        </div>
      </section>

      {/* =====================================================================
          6. FLUID VERIFIED DOSSIERS & STATE EXECUTIVE REGISTER
          ===================================================================== */}
      <section
        id="registry-section"
        className="kinetic-snap-section relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 space-y-6 scroll-mt-20"
      >
        <ScrollReveal>
          {/* Scope Selector: 31-LGA Grassroots vs State-Level Executive */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8E5] pb-4">
            <div
              role="tablist"
              aria-label="Portal transparency scope"
              className="flex items-center gap-1 p-1 bg-white border border-[#E2E8E5] rounded-xl text-xs font-semibold overflow-x-auto max-w-full"
            >
              <button
                type="button"
                role="tab"
                aria-selected={portalScope === 'lga'}
                onClick={() => setPortalScope('lga')}
                className={`relative px-4 py-2 rounded-lg transition-colors flex items-center gap-2 shrink-0 cursor-pointer whitespace-nowrap ${
                  portalScope === 'lga' ? 'text-white font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {portalScope === 'lga' && (
                  <motion.span
                    layoutId="registryScopeBg"
                    transition={{ duration: 0.24, ease: KINETIC_EASE }}
                    className="absolute inset-0 bg-[#0F5C3A] rounded-lg shadow-xs"
                  />
                )}
                <Building2 className="w-3.5 h-3.5 relative z-10" />
                <span className="relative z-10">
                  31-LGA Community Projects ({publishedActivities.length})
                </span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={portalScope === 'state'}
                onClick={() => setPortalScope('state')}
                className={`relative px-4 py-2 rounded-lg transition-colors flex items-center gap-2 shrink-0 cursor-pointer whitespace-nowrap ${
                  portalScope === 'state' ? 'text-white font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {portalScope === 'state' && (
                  <motion.span
                    layoutId="registryScopeBg"
                    transition={{ duration: 0.24, ease: KINETIC_EASE }}
                    className="absolute inset-0 bg-[#0F5C3A] rounded-lg shadow-xs"
                  />
                )}
                <Layers className="w-3.5 h-3.5 relative z-10" />
                <span className="relative z-10">
                  State-Level Executive Activities ({publishedStateActivities.length})
                </span>
              </button>
            </div>

            <div className="text-xs text-slate-600 font-medium">
              {portalScope === 'lga'
                ? 'Verified Local Government Grassroots Dossiers'
                : 'Steering Council Meetings, M&E Missions & Partnerships'}
            </div>
          </div>
        </ScrollReveal>

        {/* SECTION 6A: 31-LGA COMMUNITY PROJECTS */}
        {portalScope === 'lga' && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <KineticSectionHeader
                kicker="Grassroots Audit Trail · Open Registry"
                title="Verified Project Dossiers"
                description={
                  <>
                    Showing <strong className="font-mono tabular-nums text-slate-900">{filteredActivities.length}</strong> audited grassroots records with photographic proof and biometric attendance rolls.
                  </>
                }
              />

              {/* Search, District Filter & Grid/List Toggle */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative min-w-[230px] flex-1 sm:flex-initial">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search community, title, or skill…"
                    className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-[#D8D3C5] bg-white focus:outline-none focus:ring-2 focus:ring-[#0F5C3A]"
                  />
                </div>

                <select
                  aria-label="Filter by Senatorial District"
                  value={districtFilter}
                  onChange={(e) => setDistrictFilter(e.target.value)}
                  className="text-xs px-3 py-2.5 rounded-xl border border-[#D8D3C5] bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F5C3A] cursor-pointer"
                >
                  <option value="all">All Senatorial Districts</option>
                  <option value="uyo">Uyo District (North-East)</option>
                  <option value="ikot-ekpene">Ikot Ekpene District (North-West)</option>
                  <option value="eket">Eket District (South)</option>
                </select>

                <select
                  aria-label="Filter by HCD Pillar"
                  value={selectedPillar}
                  onChange={(e) => setSelectedPillar(e.target.value)}
                  className="text-xs px-3 py-2.5 rounded-xl border border-[#D8D3C5] bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F5C3A] cursor-pointer"
                >
                  <option value="all">All 6 Pillars</option>
                  {pillars.map((p) => (
                    <option key={p.pillar_code} value={p.pillar_code}>
                      {p.display_name}
                    </option>
                  ))}
                </select>

                {/* Grid vs List View Switcher */}
                <div className="flex items-center gap-0.5 p-1 bg-white border border-[#D8D3C5] rounded-xl">
                  <button
                    type="button"
                    aria-label="Grid View"
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      viewMode === 'grid'
                        ? 'bg-[#0F5C3A] text-white'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Compact List View"
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      viewMode === 'list'
                        ? 'bg-[#0F5C3A] text-white'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Active Filter Dismiss Bar (Functional Interactive Buttons Only) */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Active filters:</span>
                {selectedLgaObj && (
                  <button
                    type="button"
                    onClick={() => setSelectedLgaId(null)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-[#0F5C3A] border border-emerald-200 font-semibold hover:bg-emerald-100 cursor-pointer"
                  >
                    <span>LGA: {selectedLgaObj.name}</span>
                    <X className="w-3 h-3" />
                  </button>
                )}
                {selectedPillar !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedPillar('all')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-[#0F5C3A] border border-emerald-200 font-semibold hover:bg-emerald-100 cursor-pointer"
                  >
                    <span>Pillar: {getPillarDisplayName(selectedPillar)}</span>
                    <X className="w-3 h-3" />
                  </button>
                )}
                {districtFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setDistrictFilter('all')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-[#0F5C3A] border border-emerald-200 font-semibold hover:bg-emerald-100 cursor-pointer"
                  >
                    <span>District: {districtFilter.toUpperCase()}</span>
                    <X className="w-3 h-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLgaId(null);
                    setSelectedPillar('all');
                    setSearchQuery('');
                    setDistrictFilter('all');
                  }}
                  className="text-slate-600 hover:text-slate-950 font-semibold underline underline-offset-2 ml-1 cursor-pointer"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Empty State or Populated Grid/List */}
            {filteredActivities.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E2E8E5] p-12 text-center space-y-3">
                <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="font-display text-lg font-bold text-slate-900">
                  No matching verified dossiers found
                </h4>
                <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
                  Adjust your search query, switch pillars, or reset the territorial map selection to explore all published activities.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLgaId(null);
                    setSelectedPillar('all');
                    setSearchQuery('');
                    setDistrictFilter('all');
                  }}
                  className="px-4 py-2.5 bg-[#0F5C3A] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Reset All Filters
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredActivities.map((activity, idx) => {
                  const progressPct =
                    activity.overallProgress !== undefined
                      ? activity.overallProgress
                      : activity.status === 'PUBLISHED'
                      ? 100
                      : 65;

                  return (
                    <KineticActivityCard
                      key={activity.id}
                      animateEntrance
                      delayIndex={idx}
                      className="bg-white rounded-2xl border border-[#E2E8E5] hover:border-[#0F5C3A]/35 overflow-hidden flex flex-col justify-between group"
                    >
                      <div>
                        <ActivityMediaImage
                          media={
                            activity.mediaAssets && activity.mediaAssets.length > 0
                              ? activity.mediaAssets[0]
                              : null
                          }
                          activityTitle={activity.title}
                          pillar={activity.pillar}
                          lgaName={activity.lgaName}
                          community={activity.community}
                          aspectRatioClass="h-48 w-full"
                        />

                        <div className="p-5 space-y-3.5">
                          {/* Clean Unboxed Metadata */}
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            <span className="font-semibold text-[#0F5C3A]">
                              {getPillarDisplayName(activity.pillar)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{activity.lgaName}</span>
                            {activity.community && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="truncate max-w-[140px]">{activity.community}</span>
                              </>
                            )}
                          </div>

                          <h3 className="font-display text-base sm:text-lg font-bold text-slate-950 line-clamp-2 leading-snug group-hover:text-[#0F5C3A] transition-colors">
                            {activity.title}
                          </h3>

                          {/* Tabular Quantitative Metrics */}
                          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#EAEFED] text-xs">
                            <div>
                              <span className="text-[11px] text-slate-500 block">Beneficiaries</span>
                              <strong className="text-base font-bold text-slate-950 font-mono tabular-nums">
                                {activity.beneficiariesTotal.toLocaleString()}
                              </strong>
                              <span className="text-[11px] text-slate-500 block font-mono tabular-nums">
                                M {activity.beneficiariesMale} · F {activity.beneficiariesFemale}
                              </span>
                            </div>

                            <div>
                              <span className="text-[11px] text-slate-500 block">Capital Deployed</span>
                              <strong className="text-base font-bold text-[#0F5C3A] font-mono tabular-nums">
                                ₦{(activity.budgetNgn / 1_000_000).toFixed(1)}M
                              </strong>
                              <span className="text-[11px] text-slate-500 block truncate">
                                {activity.leadOfficer}
                              </span>
                            </div>
                          </div>

                          {/* Milestone Progress Bar */}
                          <div className="pt-2.5 border-t border-[#EAEFED] space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-slate-600 font-medium flex items-center gap-1">
                                <Flag className="w-3 h-3 text-[#0F5C3A]" />
                                Milestones ({activity.milestones?.length || 3} Phases)
                              </span>
                              <span className="font-bold text-[#0F5C3A] font-mono tabular-nums">
                                {progressPct}%
                              </span>
                            </div>
                            <div className="w-full bg-[#EFF4F1] rounded-full h-1.5 overflow-hidden">
                              <motion.div
                                initial={{ scaleX: 0 }}
                                whileInView={{ scaleX: 1 }}
                                viewport={{ once: true }}
                                transition={{ duration: prefersReduced ? 0 : 0.6, ease: KINETIC_EASE }}
                                style={{ width: `${progressPct}%`, transformOrigin: 'left' }}
                                className="bg-[#0F5C3A] h-1.5 rounded-full"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="px-5 py-3.5 bg-[#F6F8F7]/80 border-t border-[#EAEFED] flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => onViewActivity(activity)}
                          className="font-bold text-[#0F5C3A] hover:text-emerald-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Inspect Dossier & Proof
                        </button>

                        <button
                          type="button"
                          onClick={() => onNavigateToLga(activity.lgaId)}
                          className="text-slate-600 hover:text-slate-950 inline-flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <span>LGA Desk</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </KineticActivityCard>
                  );
                })}
              </div>
            ) : (
              /* Compact Registry List View */
              <div className="space-y-3">
                {filteredActivities.map((activity, idx) => (
                  <KineticActivityCard
                    key={activity.id}
                    variant="compact"
                    animateEntrance
                    delayIndex={idx}
                    className="p-4 sm:px-6 bg-white rounded-2xl border border-[#E2E8E5] hover:border-[#0F5C3A]/35 flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-[#0F5C3A]">{activity.lgaName} LGA</span>
                        <span aria-hidden="true">·</span>
                        <span>{getPillarDisplayName(activity.pillar)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{activity.community}</span>
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-950 group-hover:text-[#0F5C3A] transition-colors truncate">
                        {activity.title}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-5 shrink-0 text-xs">
                      <div className="text-right">
                        <span className="text-[11px] text-slate-500 block">Beneficiaries</span>
                        <strong className="font-mono tabular-nums text-slate-900">
                          {activity.beneficiariesTotal.toLocaleString()}
                        </strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-slate-500 block">Capital</span>
                        <strong className="font-mono tabular-nums text-[#0F5C3A]">
                          ₦{(activity.budgetNgn / 1_000_000).toFixed(1)}M
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => onViewActivity(activity)}
                        className="px-3.5 py-2 rounded-lg bg-[#0F5C3A] hover:bg-emerald-900 text-white font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect
                      </button>
                    </div>
                  </KineticActivityCard>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION 6B: STATE-LEVEL EXECUTIVE INITIATIVES & RESOLUTIONS */}
        {portalScope === 'state' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <KineticSectionHeader
                kicker="Executive Register · Official Communiques"
                title="Published State-Level Activities & Resolutions"
                description="Steering Council convocations, M&E missions, and inter-agency partnerships verified for public access."
              />

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative min-w-[230px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={stateSearchQuery}
                    onChange={(e) => setStateSearchQuery(e.target.value)}
                    placeholder="Search state activity or MDA…"
                    className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-[#D8D3C5] bg-white focus:outline-none focus:ring-2 focus:ring-[#0F5C3A]"
                  />
                </div>

                <select
                  aria-label="Filter by state activity category"
                  value={selectedStateCategory}
                  onChange={(e) => setSelectedStateCategory(e.target.value as StateActivityCategory | 'all')}
                  className="text-xs px-3 py-2.5 rounded-xl border border-[#D8D3C5] bg-white font-medium text-slate-700 cursor-pointer"
                >
                  <option value="all">All State Categories</option>
                  <option value="monitoring_evaluation">Monitoring & Evaluation (M&E)</option>
                  <option value="partnerships_stakeholder_engagement">Partnerships & Stakeholder</option>
                  <option value="national_level_engagements">National-Level Engagements</option>
                  <option value="state_hcd_council_meetings">Council Meetings</option>
                  <option value="state_hcd_working_group_activities">Working Group Activities</option>
                  <option value="other_state_level_initiatives">Other State Initiatives</option>
                </select>
              </div>
            </div>

            {isStateLoading ? (
              <div className="bg-white rounded-2xl border border-[#E2E8E5] p-12 text-center text-xs text-slate-500">
                <div className="w-5 h-5 border-2 border-[#0F5C3A] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading published state activities…
              </div>
            ) : filteredStateActivities.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E2E8E5] p-12 text-center space-y-3">
                <Layers className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="font-display text-lg font-bold text-slate-900">
                  No published state-level activities found
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  No executive records currently match your filter criteria.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStateCategory('all');
                    setStateSearchQuery('');
                  }}
                  className="px-4 py-2 bg-[#0F5C3A] text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Clear State Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStateActivities.map((act, idx) => {
                  const stakeholderCount = Array.isArray(act.participating_stakeholders)
                    ? act.participating_stakeholders.length
                    : 0;
                  const evidenceCount = Array.isArray(act.evidence_files)
                    ? act.evidence_files.length
                    : 0;
                  const associatedActions = publicActionItems.filter((i) => i.activity_id === act.id);

                  return (
                    <KineticActivityCard
                      key={act.id}
                      animateEntrance
                      delayIndex={idx}
                      className="bg-white rounded-2xl border border-[#E2E8E5] hover:border-[#0F5C3A]/35 overflow-hidden flex flex-col justify-between group"
                    >
                      <div className="p-5 space-y-3.5">
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 font-mono tabular-nums">
                          <span className="font-semibold text-[#0F5C3A]">{act.activity_code}</span>
                          <span>{act.activity_date}</span>
                        </div>

                        <div>
                          <div className="text-xs font-semibold text-emerald-800 mb-1">
                            {STATE_CATEGORY_LABELS[act.category]}
                          </div>
                          <h3 className="font-display text-base font-bold text-slate-950 group-hover:text-[#0F5C3A] transition-colors line-clamp-2 leading-snug">
                            {act.title}
                          </h3>
                        </div>

                        <div className="space-y-1 text-xs text-slate-600 pt-2.5 border-t border-[#EAEFED]">
                          <div className="flex items-center gap-1.5 font-medium truncate" title={act.lead_institution}>
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{act.lead_institution}</span>
                          </div>
                          {act.location && (
                            <div className="flex items-center gap-1.5 text-slate-500 text-xs truncate">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{act.location}</span>
                            </div>
                          )}
                        </div>

                        {act.key_outcomes && (
                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-[#F6F8F7] p-3 rounded-xl border border-[#EAEFED]">
                            <strong className="text-slate-800">Outcomes:</strong> {act.key_outcomes}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#EAEFED] text-xs text-slate-500">
                          {stakeholderCount > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {stakeholderCount} Stakeholders
                            </span>
                          )}
                          {evidenceCount > 0 && (
                            <>
                              {stakeholderCount > 0 && <span aria-hidden="true">·</span>}
                              <span className="inline-flex items-center gap-1">
                                <Paperclip className="w-3 h-3" />
                                {evidenceCount} Evidence Files
                              </span>
                            </>
                          )}
                          {associatedActions.length > 0 && (
                            <>
                              {(stakeholderCount > 0 || evidenceCount > 0) && <span aria-hidden="true">·</span>}
                              <span className="inline-flex items-center gap-1 text-amber-800 font-semibold">
                                <Clock className="w-3 h-3" />
                                {associatedActions.length} Actions
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="px-5 py-3.5 bg-[#F6F8F7]/80 border-t border-[#EAEFED] flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => setInspectedStateActivity(act)}
                          className="font-bold text-[#0F5C3A] hover:text-emerald-800 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect Communique & Outcomes</span>
                        </button>
                      </div>
                    </KineticActivityCard>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* =====================================================================
          7. CITIZEN TRANSPARENCY & VERIFICATION ASSURANCE BAND
          ===================================================================== */}
      <section
        id="assurance-section"
        ref={assuranceRef}
        className="kinetic-snap-section relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 scroll-mt-16"
      >
        <ScrollReveal>
          <div className="relative overflow-hidden bg-gradient-to-r from-[#0A2E1F] via-[#0F5C3A] to-[#0D3B27] text-white rounded-2xl p-7 sm:p-10 border border-[#D97706]/35 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-md">
            {/* Scroll-Triggered Decorative Crest Arcs & Luminous Glow */}
            <motion.div
              aria-hidden="true"
              style={
                prefersReduced
                  ? undefined
                  : { y: assuranceDecorY, rotate: assuranceDecorRotate, willChange: 'transform' }
              }
              className="no-print pointer-events-none absolute -right-20 -top-24 w-80 h-80 text-[#F59E0B]/20"
            >
              <svg viewBox="0 0 320 320" fill="none" className="w-full h-full">
                <circle cx="160" cy="160" r="145" stroke="currentColor" strokeWidth="1" strokeDasharray="4 8" />
                <circle cx="160" cy="160" r="102" stroke="currentColor" strokeWidth="0.8" />
              </svg>
            </motion.div>
            <motion.div
              aria-hidden="true"
              style={prefersReduced ? undefined : { y: assuranceDecorY, willChange: 'transform' }}
              className="no-print pointer-events-none absolute -left-16 -bottom-24 w-72 h-72 rounded-full bg-radial from-[#D97706]/18 via-transparent to-transparent blur-2xl"
            />

            <KineticSectionHeader
              theme="dark"
              headingAs="h3"
              kicker={
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Civil Society & Independent Verification Standard</span>
                </span>
              }
              title="Open Public Reporting Backed by Physical & Geospatial Proof"
              description="Every record published on this portal requires verifiable attendance registries, field photography validated against Akwa Ibom geographic boundaries, and State Executive approval."
              className="relative z-10 max-w-2xl"
            />

            <div className="relative z-10 shrink-0">
              <button
                type="button"
                onClick={onOpenReportExport}
                className="px-6 py-3.5 bg-[#D97706] hover:bg-[#B45309] text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm active:scale-[0.98] inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Download className="w-4 h-4" />
                Export Public Transparency Brief
              </button>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* Desktop Vertical Scroll-Snap Section Navigation Rail */}
      <SectionSnapRail sections={PUBLIC_SNAP_SECTIONS} />

      {/* Public State Activity Inspection Modal */}
      <PublicStateActivityModal
        activity={inspectedStateActivity}
        actionItems={publicActionItems}
        onClose={() => setInspectedStateActivity(null)}
      />

      {/* Recharts Month-over-Month Historical Impact Trend Overlay */}
      <HistoricalImpactTrendOverlay
        isOpen={isTrendOverlayOpen}
        onClose={() => setIsTrendOverlayOpen(false)}
        activities={publishedActivities}
        initialMetric={trendOverlayMetric}
        allowAllStatuses={false}
        scopeTitle="Akwa Ibom Public Transparency Portal · 31 LGAs"
      />
    </div>
  );
};
