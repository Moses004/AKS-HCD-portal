import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Search,
  X,
  MapPin,
  ArrowUpRight,
  Users,
  Building2,
  CornerDownLeft,
  SlidersHorizontal,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { ALL_31_LGAS, PILLARS } from '../../data/lgas';
import { HCDActivity, LGA } from '../../types';
import { KINETIC_EASE } from './MotionPrimitives';

interface HeaderPredictiveSearchProps {
  query: string;
  onQueryChange: (q: string) => void;
  onSelectActivity: (activity: HCDActivity) => void;
  onSelectLga: (lgaId: string) => void;
  onJumpToRegistry: () => void;
  variant?: 'desktop' | 'mobile';
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

function renderHighlightedText(text: string, query: string): React.ReactNode {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'ig');
  const parts = text.split(regex);
  return parts.map((part, idx) =>
    idx % 2 === 1 ? (
      <mark
        key={idx}
        className="bg-[#D4AF37]/30 text-emerald-950 font-bold rounded-[3px] px-0.5"
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    )
  );
}

export const HeaderPredictiveSearch: React.FC<HeaderPredictiveSearchProps> = ({
  query,
  onQueryChange,
  onSelectActivity,
  onSelectLga,
  onJumpToRegistry,
  variant = 'desktop',
  mobileOpen = false,
  onMobileOpenChange,
}) => {
  const { activities, getPillarDisplayName } = useData();
  const prefersReduced = useReducedMotion();

  const [isExpanded, setIsExpanded] = useState<boolean>(Boolean(query));
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [activeResultIdx, setActiveResultIdx] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const publishedActivities = useMemo(
    () => activities.filter((a) => a.status === 'PUBLISHED'),
    [activities]
  );

  // Sync expansion if an external search query is typed in the registry
  useEffect(() => {
    if (query.trim().length > 0 && !isExpanded && variant === 'desktop') {
      setIsExpanded(true);
    }
  }, [query, isExpanded, variant]);

  // Focus input smoothly when opened
  useEffect(() => {
    const shouldFocus = variant === 'desktop' ? isExpanded : mobileOpen;
    if (shouldFocus) {
      const id = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 60);
      return () => window.clearTimeout(id);
    }
  }, [isExpanded, mobileOpen, variant]);

  // Global keyboard shortcut (`/` or Cmd/Ctrl+K) for desktop quick search slide-in
  useEffect(() => {
    if (variant !== 'desktop') return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsExpanded(true);
        setIsDropdownOpen(true);
        window.setTimeout(() => inputRef.current?.focus(), 60);
        return;
      }

      if (e.key === '/' && !isEditable) {
        e.preventDefault();
        setIsExpanded(true);
        setIsDropdownOpen(true);
        window.setTimeout(() => inputRef.current?.focus(), 60);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [variant]);

  // Close dropdown (and collapse empty input) on click outside
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
        if (!query.trim()) {
          setIsExpanded(false);
        }
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [query]);

  // Real-time ranked predictive filtering across Published LGA Activities and 31 LGAs
  const { matchedActivities, matchedLgas, totalActivityMatches } = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return {
        matchedActivities: publishedActivities
          .slice()
          .sort((a, b) => (b.beneficiariesTotal || 0) - (a.beneficiariesTotal || 0))
          .slice(0, 4),
        matchedLgas: [] as LGA[],
        totalActivityMatches: publishedActivities.length,
      };
    }

    const scoredActivities: Array<{ activity: HCDActivity; score: number }> = [];
    for (const act of publishedActivities) {
      const titleLower = act.title.toLowerCase();
      const lgaLower = act.lgaName.toLowerCase();
      const commLower = (act.community || '').toLowerCase();
      const descLower = (act.projectDescription || act.subCategory || '').toLowerCase();
      const pillarLower = getPillarDisplayName(act.pillar).toLowerCase();
      const officerLower = (act.leadOfficer || '').toLowerCase();

      let score = 0;
      if (lgaLower === trimmed) score += 120;
      else if (lgaLower.startsWith(trimmed)) score += 90;
      else if (lgaLower.includes(trimmed)) score += 60;

      if (titleLower.startsWith(trimmed)) score += 100;
      else if (titleLower.includes(trimmed)) score += 70;

      if (pillarLower.includes(trimmed)) score += 50;
      if (commLower.includes(trimmed)) score += 45;
      if (descLower.includes(trimmed)) score += 35;
      if (officerLower.includes(trimmed)) score += 20;

      if (score > 0) {
        scoredActivities.push({ activity: act, score });
      }
    }

    scoredActivities.sort(
      (a, b) =>
        b.score - a.score || (b.activity.beneficiariesTotal || 0) - (a.activity.beneficiariesTotal || 0)
    );

    const matchingLgas = ALL_31_LGAS.filter(
      (lga) =>
        lga.name.toLowerCase().includes(trimmed) ||
        lga.headquarters.toLowerCase().includes(trimmed) ||
        lga.senatorialDistrict.toLowerCase().includes(trimmed)
    ).slice(0, 3);

    return {
      matchedActivities: scoredActivities.slice(0, 6).map((s) => s.activity),
      matchedLgas: matchingLgas,
      totalActivityMatches: scoredActivities.length,
    };
  }, [publishedActivities, query, getPillarDisplayName]);

  // Reset active keyboard highlight whenever query changes
  useEffect(() => {
    setActiveResultIdx(-1);
  }, [query]);

  const handleCloseAll = useCallback(() => {
    setIsDropdownOpen(false);
    if (!query.trim()) {
      setIsExpanded(false);
    }
    if (variant === 'mobile') {
      onMobileOpenChange?.(false);
    }
  }, [query, variant, onMobileOpenChange]);

  const handleChooseActivity = (activity: HCDActivity) => {
    setIsDropdownOpen(false);
    if (variant === 'mobile') {
      onMobileOpenChange?.(false);
    }
    onSelectActivity(activity);
  };

  const handleChooseLga = (lgaId: string) => {
    setIsDropdownOpen(false);
    if (variant === 'mobile') {
      onMobileOpenChange?.(false);
    }
    onSelectLga(lgaId);
  };

  const handleViewAllInRegistry = () => {
    setIsDropdownOpen(false);
    if (variant === 'mobile') {
      onMobileOpenChange?.(false);
    }
    onJumpToRegistry();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (query) {
        onQueryChange('');
      } else {
        handleCloseAll();
        inputRef.current?.blur();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsDropdownOpen(true);
      setActiveResultIdx((prev) =>
        matchedActivities.length === 0 ? -1 : (prev + 1) % matchedActivities.length
      );
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsDropdownOpen(true);
      setActiveResultIdx((prev) =>
        matchedActivities.length === 0
          ? -1
          : prev <= 0
          ? matchedActivities.length - 1
          : prev - 1
      );
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeResultIdx >= 0 && matchedActivities[activeResultIdx]) {
        handleChooseActivity(matchedActivities[activeResultIdx]);
      } else if (query.trim()) {
        handleViewAllInRegistry();
      }
    }
  };

  const trimmedQuery = query.trim();

  const renderPredictiveDropdown = () => (
    <AnimatePresence>
      {isDropdownOpen && (
        <motion.div
          key="header-predictive-dropdown"
          role="listbox"
          aria-label="Predictive LGA activity search results"
          initial={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.985 }}
          animate={prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985 }}
          transition={{ duration: 0.2, ease: KINETIC_EASE }}
          className={
            variant === 'desktop'
              ? 'absolute right-0 top-[calc(100%+8px)] w-[370px] sm:w-[420px] rounded-2xl bg-white/98 backdrop-blur-xl border border-[#D4AF37]/45 shadow-2xl shadow-emerald-950/18 overflow-hidden z-50'
              : 'mt-2 w-full rounded-xl bg-white border border-[#D4AF37]/45 shadow-xl shadow-emerald-950/12 overflow-hidden'
          }
        >
          {/* Crest Gold Top Accent */}
          <div className="h-[2px] w-full bg-gradient-to-r from-[#0B4619] via-[#D4AF37] to-emerald-500" />

          {/* Live Status & Filter Bar */}
          <div className="px-3.5 py-2.5 bg-[#FAF8F2] border-b border-[#ECE8DD] flex items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-600 font-medium min-w-0">
              <SlidersHorizontal className="w-3 h-3 text-[#0B4619] shrink-0" />
              <span className="truncate">
                {trimmedQuery ? (
                  <>
                    <strong className="text-[#0B4619] font-mono tabular-nums">
                      {totalActivityMatches}
                    </strong>{' '}
                    verified {totalActivityMatches === 1 ? 'activity' : 'activities'} filtered live
                  </>
                ) : (
                  'Trending Verified LGA Dossiers'
                )}
              </span>
            </div>

            {trimmedQuery && (
              <button
                type="button"
                onClick={handleViewAllInRegistry}
                className="text-[11px] font-bold text-[#0B4619] hover:text-emerald-700 inline-flex items-center gap-0.5 shrink-0 cursor-pointer"
              >
                <span>Jump to Registry</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Matching Council Quick-Jump Strip */}
          {matchedLgas.length > 0 && (
            <div className="px-3.5 py-2.5 border-b border-[#ECE8DD] bg-emerald-50/40">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-900/75 mb-1.5">
                Matching Local Government Areas
              </div>
              <div className="flex flex-wrap gap-1.5">
                {matchedLgas.map((lga) => (
                  <button
                    key={lga.id}
                    type="button"
                    onClick={() => handleChooseLga(lga.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-[#0B4619] text-slate-800 hover:text-white border border-[#E5E2D9] hover:border-[#0B4619] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <MapPin className="w-3 h-3 text-[#D4AF37]" />
                    <span>{renderHighlightedText(lga.name, trimmedQuery)}</span>
                    <span className="text-[10px] opacity-70 font-normal">LGA</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Real-Time Predicted LGA Activities List */}
          <div className="max-h-[320px] overflow-y-auto divide-y divide-[#F0ECE1]">
            {matchedActivities.length > 0 ? (
              matchedActivities.map((act, idx) => {
                const isKeyboardActive = idx === activeResultIdx;
                const pillarColor = PILLARS[act.pillar]?.color || '#0B4619';
                return (
                  <button
                    key={act.id}
                    type="button"
                    role="option"
                    aria-selected={isKeyboardActive}
                    onMouseEnter={() => setActiveResultIdx(idx)}
                    onClick={() => handleChooseActivity(act)}
                    className={`w-full text-left px-3.5 py-2.5 transition-colors flex items-start justify-between gap-3 cursor-pointer ${
                      isKeyboardActive ? 'bg-emerald-50/90' : 'hover:bg-[#FAF8F2]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-500">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: pillarColor }}
                        />
                        <span className="text-[#0B4619] font-bold">
                          {renderHighlightedText(`${act.lgaName} LGA`, trimmedQuery)}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span className="truncate">{getPillarDisplayName(act.pillar)}</span>
                      </div>

                      <div className="text-xs font-bold text-slate-900 mt-0.5 line-clamp-1">
                        {renderHighlightedText(act.title, trimmedQuery)}
                      </div>

                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="inline-flex items-center gap-1 truncate">
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {renderHighlightedText(act.community || act.lgaName, trimmedQuery)}
                          </span>
                        </span>
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span className="inline-flex items-center gap-1 font-mono tabular-nums font-semibold text-slate-700 shrink-0">
                          <Users className="w-3 h-3 text-emerald-700" />
                          {act.beneficiariesTotal.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <ArrowUpRight
                      className={`w-4 h-4 shrink-0 mt-1 transition-transform ${
                        isKeyboardActive
                          ? 'text-[#0B4619] translate-x-0.5 -translate-y-0.5'
                          : 'text-slate-300'
                      }`}
                    />
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-7 text-center space-y-2">
                <p className="text-xs font-semibold text-slate-700">
                  No verified LGA activities match &ldquo;{trimmedQuery}&rdquo;
                </p>
                <p className="text-[11px] text-slate-500">
                  Try searching an LGA name (e.g., Uyo, Eket, Ikot Ekpene), pillar, or community.
                </p>
                <button
                  type="button"
                  onClick={() => onQueryChange('')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#FAF8F2] hover:bg-emerald-50 border border-[#E5E2D9] text-xs font-semibold text-[#0B4619] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  Clear search filter
                </button>
              </div>
            )}
          </div>

          {/* Keyboard Navigation Hint Footer */}
          <div className="px-3.5 py-2 bg-[#FAF8F2] border-t border-[#ECE8DD] flex items-center justify-between text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <CornerDownLeft className="w-3 h-3 text-slate-400" />
              <span>Enter to open · ↑↓ to navigate · Esc to close</span>
            </span>
            {trimmedQuery && totalActivityMatches > matchedActivities.length && (
              <button
                type="button"
                onClick={handleViewAllInRegistry}
                className="font-bold text-[#0B4619] hover:underline cursor-pointer"
              >
                +{totalActivityMatches - matchedActivities.length} more
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Mobile full-width slide-down search drawer variant
  if (variant === 'mobile') {
    return (
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            ref={containerRef}
            key="mobile-predictive-search-bar"
            initial={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0, y: -8 }}
            animate={prefersReduced ? { opacity: 1 } : { height: 'auto', opacity: 1, y: 0 }}
            exit={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: KINETIC_EASE }}
            className="md:hidden border-t border-emerald-200/80 bg-[#FAF8F2]/98 px-4 py-3 overflow-hidden"
          >
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-[#0B4619] absolute left-3 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onFocus={() => setIsDropdownOpen(true)}
                onChange={(e) => {
                  onQueryChange(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Filter LGA projects, communities, or pillars…"
                aria-label="Search verified LGA activities"
                className="w-full pl-9 pr-16 py-2 text-xs rounded-xl bg-white border border-[#0B4619]/30 focus:border-[#0B4619] focus:ring-2 focus:ring-[#0B4619]/15 focus:outline-none text-slate-900 placeholder:text-slate-400"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    onQueryChange('');
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="absolute right-8 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onMobileOpenChange?.(false)}
                aria-label="Close search bar"
                className="absolute right-2 p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {renderPredictiveDropdown()}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Desktop inline slide-in search bar variant
  return (
    <div ref={containerRef} className="relative hidden md:flex items-center">
      <AnimatePresence mode="wait" initial={false}>
        {isExpanded ? (
          <motion.div
            key="desktop-search-expanded"
            initial={prefersReduced ? { opacity: 0 } : { width: 132, opacity: 0, x: 14 }}
            animate={prefersReduced ? { opacity: 1 } : { width: 280, opacity: 1, x: 0 }}
            exit={prefersReduced ? { opacity: 0 } : { width: 132, opacity: 0, x: 14 }}
            transition={{ duration: 0.26, ease: KINETIC_EASE }}
            className="relative flex items-center"
          >
            <Search className="w-3.5 h-3.5 text-[#0B4619] absolute left-3 pointer-events-none z-10" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onFocus={() => setIsDropdownOpen(true)}
              onChange={(e) => {
                onQueryChange(e.target.value);
                setIsDropdownOpen(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search LGA activities…"
              aria-label="Predictive real-time search for LGA activities"
              className="w-full pl-8.5 pr-14 py-1.5 text-xs rounded-xl bg-white border border-[#0B4619]/35 focus:border-[#0B4619] focus:ring-2 focus:ring-[#D4AF37]/30 focus:outline-none text-slate-900 placeholder:text-slate-400 shadow-xs transition-shadow"
            />

            {trimmedQuery && (
              <span className="absolute right-7 text-[10px] font-mono font-bold text-[#0B4619] bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded pointer-events-none">
                {totalActivityMatches}
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                if (query) {
                  onQueryChange('');
                  inputRef.current?.focus();
                } else {
                  setIsDropdownOpen(false);
                  setIsExpanded(false);
                }
              }}
              aria-label={query ? 'Clear search query' : 'Close search bar'}
              className="absolute right-1.5 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="desktop-search-trigger"
            type="button"
            initial={prefersReduced ? { opacity: 0 } : { opacity: 0, x: -6 }}
            animate={prefersReduced ? { opacity: 1 } : { opacity: 1, x: 0 }}
            exit={prefersReduced ? { opacity: 0 } : { opacity: 0, x: 6 }}
            transition={{ duration: 0.18, ease: KINETIC_EASE }}
            onClick={() => {
              setIsExpanded(true);
              setIsDropdownOpen(true);
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-950 bg-white/85 hover:bg-white border border-[#E5E2D9] hover:border-[#0B4619]/40 rounded-xl shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
            title="Search verified LGA activities (Press / or ⌘K)"
          >
            <Search className="w-3.5 h-3.5 text-[#0B4619]" />
            <span>Search LGAs…</span>
            <kbd className="hidden xl:inline-flex items-center px-1.5 py-0.2 rounded bg-[#FAF8F2] border border-[#E5E2D9] font-mono text-[10px] font-semibold text-slate-400">
              /
            </kbd>
          </motion.button>
        )}
      </AnimatePresence>

      {renderPredictiveDropdown()}
    </div>
  );
};
