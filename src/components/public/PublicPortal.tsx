import React, { useState, useMemo, useEffect } from 'react';
import {
  HCDActivity,
  StateHCDActivity,
  StateHCDPublicActionItem,
  StateActivityCategory,
  STATE_CATEGORY_LABELS,
  STATE_ACTIVITY_CATEGORIES,
} from '../../types';
import { stateActivitiesService } from '../../services/stateActivitiesService';
import { PublicStateActivityModal } from './PublicStateActivityModal';
import { ALL_31_LGAS, PILLARS, getLgaById } from '../../data/lgas';
import { useData } from '../../context/DataContext';
import { AkwaIbomStateMap } from '../map/AkwaIbomStateMap';
import { AriseLogo } from '../common/Logos';
import { ActivityMediaImage } from '../common/ActivityMediaImage';
import {
  Search,
  Filter,
  GraduationCap,
  HeartPulse,
  Wrench,
  Sprout,
  Users,
  MapPin,
  CheckCircle2,
  FileCheck2,
  Download,
  Eye,
  ExternalLink,
  Building2,
  ArrowRight,
  TrendingUp,
  Award,
  Calendar,
  Sparkles,
  Flag,
  Layers,
  ShieldCheck,
  Paperclip,
  Clock,
} from 'lucide-react';

interface PublicPortalProps {
  activities: HCDActivity[];
  onViewActivity: (activity: HCDActivity) => void;
  onOpenReportExport: () => void;
  onNavigateToLga: (lgaId: string) => void;
}

export const PublicPortal: React.FC<PublicPortalProps> = ({
  activities,
  onViewActivity,
  onOpenReportExport,
  onNavigateToLga,
}) => {
  const { pillars, getPillarDisplayName } = useData();
  const [selectedLgaId, setSelectedLgaId] = useState<string | null>(null);
  const [selectedPillar, setSelectedPillar] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [districtFilter, setDistrictFilter] = useState<string>('all');

  // State-Level Activities Transparency for Citizens
  const [portalScope, setPortalScope] = useState<'lga' | 'state'>('lga');
  const [publishedStateActivities, setPublishedStateActivities] = useState<StateHCDActivity[]>([]);
  const [publicActionItems, setPublicActionItems] = useState<StateHCDPublicActionItem[]>([]);
  const [selectedStateCategory, setSelectedStateCategory] = useState<StateActivityCategory | 'all'>('all');
  const [stateSearchQuery, setStateSearchQuery] = useState('');
  const [inspectedStateActivity, setInspectedStateActivity] = useState<StateHCDActivity | null>(null);
  const [isStateLoading, setIsStateLoading] = useState(false);

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
          setPublicActionItems(actionRes.data as any);
        }
      } catch {
        // Non-blocking for public visitor portal
      } finally {
        setIsStateLoading(false);
      }
    };
    loadPublishedStateActivities();
  }, []);

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

  // Only published activities are displayed on the public transparency portal
  const publishedActivities = useMemo(() => {
    return activities.filter((a) => a.status === 'PUBLISHED');
  }, [activities]);

  // Aggregate Key Counters
  const totalBeneficiaries = useMemo(() => {
    return publishedActivities.reduce((acc, a) => acc + a.beneficiariesTotal, 0);
  }, [publishedActivities]);

  const totalBudget = useMemo(() => {
    return publishedActivities.reduce((acc, a) => acc + a.budgetNgn, 0);
  }, [publishedActivities]);

  const activeLgasCount = useMemo(() => {
    const set = new Set(publishedActivities.map((a) => a.lgaId));
    return set.size;
  }, [publishedActivities]);

  // Filtered Activities
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

  const selectedLgaObj = selectedLgaId ? getLgaById(selectedLgaId) : null;

  return (
    <div className="space-y-section pb-16 bg-[#FAF8F2]">
      {/* 1. HERO LEADERSHIP SPOTLIGHT & ARISE AGENDA BANNER (Inspired by reference screenshot) */}
      <section className="bg-gradient-to-b from-emerald-950 via-[#0B4619] to-emerald-900 text-white pt-8 pb-14 px-4 sm:px-6 lg:px-8 border-b-4 border-[#D4AF37] relative overflow-hidden">
        {/* Subtle patterned backdrop */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="hero-pattern" width="60" height="60" patternUnits="userSpaceOnUse">
                <circle cx="30" cy="30" r="1.5" fill="#D4AF37" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-pattern)" />
          </svg>
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Headline & Strategic Mandate (7 cols) */}
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-[#D4AF37]/50 text-[#D4AF37] text-xs font-semibold backdrop-blur-xs">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Akwa Ibom State Human Capital Development Blueprint · ARISE Agenda</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight text-balance">
                ARISE Human Capital Development Implementation Dashboard
              </h1>

              <p className="text-sm sm:text-base text-emerald-100/90 leading-relaxed max-w-2xl text-balance">
                Measuring real-time grassroots investments in Education and Life long learning, Health, Skill and labour participation, Agriculture, Cross-cutting Enablers, and Values, Ethics & Social Behaviour. Isolated municipal workflows unified into an open state impact repository.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a
                  href="#map-section"
                  className="px-5 py-3 rounded-xl bg-[#D4AF37] hover:bg-amber-400 text-emerald-950 font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center gap-2"
                >
                  <MapPin className="w-4 h-4" />
                  Explore 31-LGA Interactive Map
                </a>

                <button
                  onClick={onOpenReportExport}
                  className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm border border-white/20 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4 text-emerald-300" />
                  Official Executive Briefing
                </button>
              </div>
            </div>

            {/* Right AKS | ARISE Placeholder Card (Official ARISE Logo) */}
            <div className="lg:col-span-4">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6 sm:p-7 shadow-xl text-center space-y-4">
                {/* Official ARISE Logo - Maintained Rounded Form, Shape, and Pixel Fidelity */}
                <div className="flex flex-col items-center justify-center py-2">
                  <div className="w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48 aspect-square rounded-full bg-white p-5 sm:p-6 shadow-2xl border-4 border-[#D4AF37] ring-4 ring-white/25 flex items-center justify-center hover:scale-105 transition-transform duration-300 overflow-hidden shrink-0">
                    <AriseLogo className="w-full h-full object-contain" />
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg sm:text-xl font-black text-white tracking-wide">
                    ARISE AGENDA
                  </h3>
                  <p className="text-xs text-[#D4AF37] font-semibold tracking-wide">
                    Government of Akwa Ibom State
                  </p>
                  <p className="text-xs text-emerald-100/95 italic mt-2.5 leading-relaxed text-balance">
                    "Anchor on the ARISE Agenda and the Human Capital Development Framework, across all 31 Local Government Areas."
                  </p>
                </div>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. LIVE STATE KPI STATS BANNER */}
      <section className="max-w-7xl mx-auto px-dashboard-x sm:px-dashboard-x-sm lg:px-dashboard-x-lg -mt-10 relative z-20">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/90 p-card-pad grid grid-cols-2 md:grid-cols-4 gap-card-gap lg:gap-card-gap-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Verified Beneficiaries
            </span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-950 font-mono tabular-nums">
              {totalBeneficiaries.toLocaleString()}
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Biometrically Documented
            </div>
          </div>

          <div className="space-y-1 pt-3 sm:pt-0 sm:pl-6">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Published Grassroots Projects
            </span>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tabular-nums">
              {publishedActivities.length}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              Cabinet Approved & Audited
            </div>
          </div>

          <div className="space-y-1 pt-3 sm:pt-0 sm:pl-6">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              31 Local Governments
            </span>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tabular-nums">
              31 / 31
            </div>
            <div className="text-[11px] text-emerald-700 font-medium">
              {activeLgasCount} Councils With Active Records
            </div>
          </div>

          <div className="space-y-1 pt-3 sm:pt-0 sm:pl-6">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Capacity Capital Deployed
            </span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-900 font-mono tabular-nums">
              ₦ {(totalBudget / 1000000).toFixed(1)}M
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              Direct Beneficiary Subventions
            </div>
          </div>
        </div>
      </section>

      {/* 3. STRATEGIC DEVELOPMENT PILLARS & CROSS-CUTTING ENABLERS */}
      <section className="max-w-7xl mx-auto px-dashboard-x sm:px-dashboard-x-sm lg:px-dashboard-x-lg space-y-subsection">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Strategic Human Capital Pillars & Enablers
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Grassroots activities categorically aligned with the Akwa Ibom State HCD Blueprint and Cross-Cutting Metrics
            </p>
          </div>
          <button
            onClick={() => setSelectedPillar('all')}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
              selectedPillar === 'all'
                ? 'bg-emerald-950 text-white'
                : 'text-slate-600 hover:text-slate-900 bg-slate-100'
            }`}
          >
            Show All Pillars
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-card-gap lg:gap-card-gap-lg">
          {pillars.map((p) => {
            const pillarInfo = PILLARS[p.pillar_code];
            const isSelected = selectedPillar === p.pillar_code;
            const pActs = publishedActivities.filter((a) => a.pillar === p.pillar_code);
            const pBen = pActs.reduce((acc, a) => acc + a.beneficiariesTotal, 0);

            return (
              <div
                key={p.pillar_code}
                onClick={() => setSelectedPillar(isSelected ? 'all' : p.pillar_code)}
                className={`p-card-pad rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-emerald-700 bg-emerald-50/70 shadow-md ring-2 ring-emerald-700/20'
                    : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs"
                      style={{ backgroundColor: pillarInfo?.color || '#0B4619' }}
                    >
                      {p.pillar_code === 'education' && <GraduationCap className="w-5 h-5" />}
                      {p.pillar_code === 'health' && <HeartPulse className="w-5 h-5" />}
                      {p.pillar_code === 'vocational' && <Wrench className="w-5 h-5" />}
                      {p.pillar_code === 'agriculture' && <Sprout className="w-5 h-5" />}
                      {p.pillar_code === 'cross_cutting_enablers' && <Layers className="w-5 h-5" />}
                      {p.pillar_code === 'values_ethics_social_behaviour' && <ShieldCheck className="w-5 h-5" />}
                    </div>
                    <span className="text-xs font-bold text-slate-500 font-mono tabular-nums">
                      {pActs.length} {pActs.length === 1 ? 'project' : 'projects'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{p.display_name}</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {p.pillar_code === 'agriculture'
                        ? 'Building Human Capital Development in Homes, Communities, Learning Institutions & Workplaces.'
                        : p.description || pillarInfo?.tagline || ''}
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Beneficiaries</span>
                  <strong className="text-slate-900 font-mono tabular-nums font-bold">
                    {pBen.toLocaleString()}
                  </strong>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. GEOSPATIAL 31-LGA INTERACTIVE MAP SECTION */}
      <section id="map-section" className="max-w-7xl mx-auto px-dashboard-x sm:px-dashboard-x-sm lg:px-dashboard-x-lg space-y-subsection">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              31 Local Government Areas Vector Map
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Select or hover any LGA polygon to query verified grassroots metrics and isolate territory data
            </p>
          </div>

          {selectedLgaId && (
            <button
              onClick={() => setSelectedLgaId(null)}
              className="text-xs font-semibold text-emerald-800 hover:underline"
            >
              Reset to All 31 LGAs
            </button>
          )}
        </div>

        <AkwaIbomStateMap
          activities={activities}
          selectedLgaId={selectedLgaId}
          onSelectLga={(id) => setSelectedLgaId(id)}
        />
      </section>

      {/* 5. VERIFIED ACTIVITIES SEARCH & REGISTRY EXPLORER */}
      <section className="max-w-7xl mx-auto px-dashboard-x sm:px-dashboard-x-sm lg:px-dashboard-x-lg space-y-subsection">
        {/* Scope Selector: 31-LGA Grassroots vs State-Level Executive */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold overflow-x-auto max-w-full">
            <button
              onClick={() => setPortalScope('lga')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                portalScope === 'lga'
                  ? 'bg-white text-emerald-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>31-LGA Community Projects ({publishedActivities.length})</span>
            </button>

            <button
              onClick={() => setPortalScope('state')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                portalScope === 'state'
                  ? 'bg-white text-emerald-950 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-700" />
              <span>State-Level Executive Activities ({publishedStateActivities.length})</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                Resolutions & Actions
              </span>
            </button>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            {portalScope === 'lga'
              ? 'Local Government Area Verified Grassroots Projects'
              : 'Official State Steering Council Meetings, M&E & Partnerships'}
          </div>
        </div>

        {/* SECTION 5A: 31-LGA GRASSROOTS PROJECTS */}
        {portalScope === 'lga' && (
          <>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Verified Project Dossiers
                  {selectedLgaObj && (
                    <span className="text-xs font-bold text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      {selectedLgaObj.name} LGA
                    </span>
                  )}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Grassroots activities verified with photo proofs, attendance rolls, and State Cabinet approvals
                </p>
              </div>

              {/* Search & District Filter Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search community, title, or skill..."
                    className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <select
                  value={districtFilter}
                  onChange={(e) => setDistrictFilter(e.target.value)}
                  className="text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-700"
                >
                  <option value="all">All Senatorial Districts</option>
                  <option value="uyo">Uyo District (North-East)</option>
                  <option value="ikot-ekpene">Ikot Ekpene District (North-West)</option>
                  <option value="eket">Eket District (South)</option>
                </select>
              </div>
            </div>

        {/* Projects Cards Grid */}
        {filteredActivities.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-base font-bold text-slate-800">
              No matching verified activities found
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try adjusting your search criteria, clearing the LGA map filter, or switching pillars.
            </p>
            <button
              onClick={() => {
                setSelectedLgaId(null);
                setSelectedPillar('all');
                setSearchQuery('');
                setDistrictFilter('all');
              }}
              className="px-4 py-2 bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredActivities.map((activity) => {
              const pillar = PILLARS[activity.pillar];

              return (
                <div
                  key={activity.id}
                  className="activity-card bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col justify-between transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-950/10 hover:border-emerald-700/30 group"
                >
                  <div>
                    {/* Visual Media Header with secure resolver and neutral branded fallback */}
                    <ActivityMediaImage
                      media={activity.mediaAssets && activity.mediaAssets.length > 0 ? activity.mediaAssets[0] : null}
                      activityTitle={activity.title}
                      pillar={activity.pillar}
                      lgaName={activity.lgaName}
                      community={activity.community}
                      aspectRatioClass="h-48 w-full"
                    />

                    {/* Card Content */}
                    <div className="p-5 space-y-3">
                      {/* Unboxed Metadata (Zero-pill discipline) */}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span>{getPillarDisplayName(activity.pillar)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{activity.projectDescription || activity.subCategory}</span>
                        {activity.pillar === 'cross_cutting_enablers' && activity.pillarSegment && (
                          <span className="text-[10px] font-bold text-cyan-800 bg-cyan-100 px-1.5 py-0.5 rounded capitalize">
                            {activity.pillarSegment.replace('_', ' ')}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-emerald-900 transition-colors">
                        {activity.title}
                      </h3>

                      {/* Quantitative Demographic Splits */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                        <div className="bg-slate-50 p-2 rounded-lg">
                          <span className="text-[10px] text-slate-500 block">Total Beneficiaries</span>
                          <strong className="text-sm font-black text-slate-900 font-mono tabular-nums">
                            {activity.beneficiariesTotal.toLocaleString()}
                          </strong>
                          <span className="text-[10px] text-slate-500 block">
                            ♂ {activity.beneficiariesMale} · ♀ {activity.beneficiariesFemale}
                          </span>
                        </div>

                        <div className="bg-slate-50 p-2 rounded-lg">
                          <span className="text-[10px] text-slate-500 block">Invested Capital</span>
                          <strong className="text-sm font-black text-emerald-950 font-mono tabular-nums">
                            ₦ {(activity.budgetNgn / 1000000).toFixed(1)}M
                          </strong>
                          <span className="text-[10px] text-slate-500 block truncate">
                            Desk: {activity.leadOfficer}
                          </span>
                        </div>
                      </div>

                      {/* Milestone Phased Progress Bar */}
                      <div className="pt-2 border-t border-slate-100 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-medium flex items-center gap-1">
                            <Flag className="w-3 h-3 text-emerald-700" />
                            Milestones (
                            {activity.milestones?.length || 3} Phases)
                          </span>
                          <span className="font-bold text-emerald-900 font-mono">
                            {activity.overallProgress !== undefined
                              ? `${activity.overallProgress}%`
                              : activity.status === 'PUBLISHED'
                              ? '100%'
                              : '65%'}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-emerald-700 h-1.5 rounded-full transition-all"
                            style={{
                              width: `${
                                activity.overallProgress !== undefined
                                  ? activity.overallProgress
                                  : activity.status === 'PUBLISHED'
                                  ? 100
                                  : 65
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                    <button
                      onClick={() => onViewActivity(activity)}
                      className="font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Inspect Dossier & Proof
                    </button>

                    <button
                      onClick={() => onNavigateToLga(activity.lgaId)}
                      className="text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
                    >
                      <span>LGA Desk</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>
    )}

    {/* SECTION 5B: STATE-LEVEL EXECUTIVE INITIATIVES & RESOLUTIONS */}
    {portalScope === 'state' && (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              Published State-Level Activities & Communiques
              <span className="text-xs font-bold text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                Executive Register
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Steering Council convocations, high-level M&E missions, and inter-agency partnerships published for public verification
            </p>
          </div>

          {/* State Category and Search Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={stateSearchQuery}
                onChange={(e) => setStateSearchQuery(e.target.value)}
                placeholder="Search state activity or MDA..."
                className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <select
              value={selectedStateCategory}
              onChange={(e) => setSelectedStateCategory(e.target.value as any)}
              className="text-xs p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-700"
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

        {/* State Activities Grid */}
        {isStateLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-500">
            <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading published state activities...
          </div>
        ) : filteredStateActivities.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <Layers className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-base font-bold text-slate-800">
              No published state-level activities found
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No executive activities currently match your filter criteria or have been published to the open portal yet.
            </p>
            <button
              onClick={() => {
                setSelectedStateCategory('all');
                setStateSearchQuery('');
              }}
              className="px-4 py-2 bg-emerald-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Clear State Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStateActivities.map((act) => {
              const stakeholderCount = Array.isArray(act.participating_stakeholders)
                ? act.participating_stakeholders.length
                : 0;
              const evidenceCount = Array.isArray(act.evidence_files)
                ? act.evidence_files.length
                : 0;
              const associatedActions = publicActionItems.filter((i) => i.activity_id === act.id);

              return (
                <div
                  key={act.id}
                  className="activity-card bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col justify-between transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-950/10 hover:border-emerald-700/30 group"
                >
                  <div className="p-5 space-y-3">
                    {/* Header Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-emerald-950 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {act.activity_code}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {act.activity_date}
                      </span>
                    </div>

                    {/* Category & Title */}
                    <div>
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                        {STATE_CATEGORY_LABELS[act.category]}
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-emerald-900 transition-colors line-clamp-2 leading-snug">
                        {act.title}
                      </h3>
                    </div>

                    {/* Lead MDA & Location */}
                    <div className="space-y-1 text-xs text-slate-600 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 font-medium truncate" title={act.lead_institution}>
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{act.lead_institution}</span>
                      </div>
                      {act.location && (
                        <div className="flex items-center gap-1.5 text-slate-500 text-[11px] truncate">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{act.location}</span>
                        </div>
                      )}
                    </div>

                    {/* Outcomes Preview */}
                    {act.key_outcomes && (
                      <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100 text-[11px] text-slate-700 line-clamp-2">
                        <strong>Outcomes:</strong> {act.key_outcomes}
                      </div>
                    )}

                    {/* Metadata Pills */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                      {stakeholderCount > 0 && (
                        <span className="inline-flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded text-slate-600">
                          <Users className="w-3 h-3 text-slate-400" />
                          {stakeholderCount} Stakeholders
                        </span>
                      )}
                      {evidenceCount > 0 && (
                        <span className="inline-flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded text-slate-600">
                          <Paperclip className="w-3 h-3 text-slate-400" />
                          {evidenceCount} Evidence Files
                        </span>
                      )}
                      {associatedActions.length > 0 && (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded font-semibold border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-600" />
                          {associatedActions.length} Action Commitments
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Action */}
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                    <button
                      onClick={() => setInspectedStateActivity(act)}
                      className="font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect Communique & Outcomes</span>
                    </button>
                    <span className="text-[10px] text-slate-400">Official Dossier</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    )}
  </section>

  {/* 6. CITIZEN TRANSPARENCY & ASSURANCE BANNER */}
  <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-emerald-950 text-white rounded-2xl p-6 sm:p-8 border border-[#D4AF37]/30 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-md">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" />
              Civil Society & Independent Auditing
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Open Public Reporting & Verification Standards
            </h3>
            <p className="text-xs sm:text-sm text-emerald-200/80 max-w-xl leading-relaxed">
              Every data point published on this portal requires signed biometric registers, photographic GPS assets within state boundaries, and State Super-Admin verification.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenReportExport}
              className="px-5 py-2.5 bg-[#D4AF37] hover:bg-amber-400 text-emerald-950 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              Export Public Transparency Brief
            </button>
          </div>
        </div>
      </section>

      {/* Public State Activity Inspection Modal */}
      <PublicStateActivityModal
        activity={inspectedStateActivity}
        actionItems={publicActionItems}
        onClose={() => setInspectedStateActivity(null)}
      />
    </div>
  );
};
