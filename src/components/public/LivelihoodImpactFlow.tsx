import React, { useMemo, useRef, useState, useEffect } from 'react';
import * as d3 from 'd3';
import {
  sankey as d3Sankey,
  sankeyLinkHorizontal,
  sankeyJustify,
  type SankeyNode,
  type SankeyLink,
} from 'd3-sankey';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Compass,
  GitBranch,
  Layers,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { HCDActivity } from '../../types';
import { PILLARS, getLgaById } from '../../data/lgas';
import { useData } from '../../context/DataContext';
import { KINETIC_EASE } from '../common/MotionPrimitives';

type FlowScope = 'all' | 'uyo' | 'ikot-ekpene' | 'eket';
type MetricBasis = 'all' | 'youth' | 'female';
type FlowStage = 0 | 1 | 2;

interface FlowNodeDatum {
  id: string;
  label: string;
  shortLabel: string;
  stage: FlowStage;
  color: string;
  accentColor: string;
  projectCount: number;
  capitalNgn: number;
  lgaCount: number;
  pillarCode?: string;
  lgaId?: string;
  districtId?: FlowScope;
  subtitle: string;
}

interface FlowLinkDatum {
  source: string;
  target: string;
  value: number;
  stageTransition: 'origin_to_capacity' | 'capacity_to_empowerment';
}

type ComputedNode = SankeyNode<FlowNodeDatum, FlowLinkDatum>;
type ComputedLink = SankeyLink<FlowNodeDatum, FlowLinkDatum>;

interface LivelihoodImpactFlowProps {
  publishedActivities: HCDActivity[];
  onSelectPillarFilter?: (pillarCode: string) => void;
  onSelectLgaFocus?: (lgaId: string) => void;
}

const OUTCOME_NODES: Record<
  string,
  { label: string; shortLabel: string; color: string; accentColor: string; subtitle: string }
> = {
  outcome_skilled: {
    label: 'Digital & Skilled Employment',
    shortLabel: 'Skilled Employment',
    color: '#D4AF37',
    accentColor: '#F4D97A',
    subtitle: 'Tech, engineering & artisanal labour placement',
  },
  outcome_agro: {
    label: 'Agro-Enterprise & Value Chains',
    shortLabel: 'Agro-Enterprise',
    color: '#B88917',
    accentColor: '#E8C55B',
    subtitle: 'Cooperative smallholder yields & agro-commerce',
  },
  outcome_micro: {
    label: 'Women & Community Enterprises',
    shortLabel: 'Micro-Enterprises',
    color: '#0D9488',
    accentColor: '#5EEAD4',
    subtitle: 'Household micro-businesses & local trade',
  },
  outcome_readiness: {
    label: 'Productive Workforce Readiness',
    shortLabel: 'Workforce Readiness',
    color: '#0B4619',
    accentColor: '#34D399',
    subtitle: 'Healthy, educated & resilient human capital',
  },
};

const PILLAR_TO_OUTCOME_WEIGHTS: Record<string, Array<{ key: keyof typeof OUTCOME_NODES; share: number }>> = {
  vocational: [
    { key: 'outcome_skilled', share: 0.55 },
    { key: 'outcome_micro', share: 0.25 },
    { key: 'outcome_readiness', share: 0.2 },
  ],
  agriculture: [
    { key: 'outcome_agro', share: 0.6 },
    { key: 'outcome_micro', share: 0.25 },
    { key: 'outcome_skilled', share: 0.15 },
  ],
  education: [
    { key: 'outcome_readiness', share: 0.45 },
    { key: 'outcome_skilled', share: 0.35 },
    { key: 'outcome_micro', share: 0.2 },
  ],
  health: [
    { key: 'outcome_readiness', share: 0.55 },
    { key: 'outcome_micro', share: 0.3 },
    { key: 'outcome_agro', share: 0.15 },
  ],
  cross_cutting_enablers: [
    { key: 'outcome_skilled', share: 0.4 },
    { key: 'outcome_agro', share: 0.3 },
    { key: 'outcome_micro', share: 0.3 },
  ],
  values_ethics_social_behaviour: [
    { key: 'outcome_readiness', share: 0.5 },
    { key: 'outcome_micro', share: 0.3 },
    { key: 'outcome_skilled', share: 0.2 },
  ],
};

function getDistrictKey(lgaId: string): Exclude<FlowScope, 'all'> {
  const lga = getLgaById(lgaId);
  if (!lga) return 'uyo';
  if (lga.senatorialDistrict.includes('North-West')) return 'ikot-ekpene';
  if (lga.senatorialDistrict.includes('South')) return 'eket';
  return 'uyo';
}

const DISTRICT_META: Record<
  Exclude<FlowScope, 'all'>,
  { label: string; shortLabel: string; color: string; accentColor: string; councils: number }
> = {
  uyo: {
    label: 'Uyo Senatorial District',
    shortLabel: 'Uyo (NE · 9 LGAs)',
    color: '#064E3B',
    accentColor: '#34D399',
    councils: 9,
  },
  'ikot-ekpene': {
    label: 'Ikot Ekpene District',
    shortLabel: 'Ikot Ekpene (NW · 10 LGAs)',
    color: '#0B4619',
    accentColor: '#10B981',
    councils: 10,
  },
  eket: {
    label: 'Eket Senatorial District',
    shortLabel: 'Eket (South · 12 LGAs)',
    color: '#047857',
    accentColor: '#6EE7B7',
    councils: 12,
  },
};

function allocateConservatively(
  total: number,
  splits: Array<{ key: string; share: number }>
): Array<{ key: string; amount: number }> {
  const roundedTotal = Math.round(total);
  if (roundedTotal <= 0) return [];
  let assigned = 0;
  return splits.map((s, idx) => {
    if (idx === splits.length - 1) {
      return { key: s.key, amount: Math.max(0, roundedTotal - assigned) };
    }
    const amt = Math.round(roundedTotal * s.share);
    assigned += amt;
    return { key: s.key, amount: amt };
  });
}

function getActivityWeight(act: HCDActivity, basis: MetricBasis): number {
  if (basis === 'youth') return Math.max(0, act.youthBeneficiaries || 0);
  if (basis === 'female') return Math.max(0, act.beneficiariesFemale || 0);
  return Math.max(0, act.beneficiariesTotal || 0);
}

const formatCompact = d3.format(',');

interface TooltipPayload {
  kind: 'node' | 'link';
  title: string;
  kicker: string;
  value: number;
  sharePct: number;
  subtitle: string;
  secondaryStat?: string;
  actionHint?: string;
}

export const LivelihoodImpactFlow: React.FC<LivelihoodImpactFlowProps> = ({
  publishedActivities,
  onSelectPillarFilter,
  onSelectLgaFocus,
}) => {
  const { getPillarDisplayName } = useData();
  const prefersReduced = useReducedMotion();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [svgWidth, setSvgWidth] = useState<number>(960);
  const [scope, setScope] = useState<FlowScope>('all');
  const [basis, setBasis] = useState<MetricBasis>('all');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLinkIdx, setHoveredLinkIdx] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipPayload | null>(null);
  const [tooltipFlip, setTooltipFlip] = useState<{ flipX: boolean; flipY: boolean }>({
    flipX: false,
    flipY: false,
  });

  // Framer Motion spring coordinates for smooth floating D3 tooltip
  const rawTipX = useMotionValue(0);
  const rawTipY = useMotionValue(0);
  const smoothTipX = useSpring(rawTipX, { stiffness: 420, damping: 32, mass: 0.45 });
  const smoothTipY = useSpring(rawTipY, { stiffness: 420, damping: 32, mass: 0.45 });

  // Measure responsive canvas width cleanly via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) {
        setSvgWidth(Math.max(760, Math.min(1160, Math.round(w))));
      }
    };

    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const svgHeight = 430;

  // Build flow graph data and compute exact D3 Sankey layout
  const {
    nodes,
    links,
    totalFlowValue,
    activeCouncilsCount,
    empowermentConversionPct,
    totalCapitalNgn,
  } = useMemo(() => {
    const scopedActivities = publishedActivities.filter((act) => {
      if (scope === 'all') return true;
      return getDistrictKey(act.lgaId) === scope;
    });

    const weightedActs = scopedActivities
      .map((act) => ({ act, weight: getActivityWeight(act, basis) }))
      .filter((entry) => entry.weight > 0);

    if (weightedActs.length === 0) {
      return {
        nodes: [] as ComputedNode[],
        links: [] as ComputedLink[],
        totalFlowValue: 0,
        activeCouncilsCount: 0,
        empowermentConversionPct: 0,
        totalCapitalNgn: 0,
      };
    }

    const nodeMap = new Map<
      string,
      FlowNodeDatum & { lgaSet: Set<string> }
    >();
    const linkValueMap = new Map<
      string,
      { source: string; target: string; value: number; stageTransition: FlowLinkDatum['stageTransition'] }
    >();

    const ensureNode = (datum: FlowNodeDatum) => {
      const existing = nodeMap.get(datum.id);
      if (existing) return existing;
      const created = { ...datum, lgaSet: new Set<string>() };
      nodeMap.set(datum.id, created);
      return created;
    };

    const addLink = (
      source: string,
      target: string,
      amount: number,
      stageTransition: FlowLinkDatum['stageTransition']
    ) => {
      if (amount <= 0) return;
      const key = `${source}__${target}`;
      const existing = linkValueMap.get(key);
      if (existing) {
        existing.value += amount;
      } else {
        linkValueMap.set(key, { source, target, value: amount, stageTransition });
      }
    };

    // Determine top individual LGAs when filtered to a single Senatorial District
    const topLgaIdsInDistrict = new Set<string>();
    if (scope !== 'all') {
      const lgaTotals = new Map<string, number>();
      for (const { act, weight } of weightedActs) {
        lgaTotals.set(act.lgaId, (lgaTotals.get(act.lgaId) || 0) + weight);
      }
      Array.from(lgaTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .forEach(([id]) => topLgaIdsInDistrict.add(id));
    }

    const emeraldScale = d3.interpolateRgb('#064E3B', '#10B981');
    const activeLgaSet = new Set<string>();
    let totalFlow = 0;
    let totalBudget = 0;
    let directEconomicTotal = 0;

    weightedActs.forEach(({ act, weight }, idx) => {
      totalFlow += weight;
      totalBudget += act.budgetNgn || 0;
      activeLgaSet.add(act.lgaId);

      // Stage 0: Origin Node (District in All-31 view, or individual LGA in District view)
      let originId: string;
      if (scope === 'all') {
        const distKey = getDistrictKey(act.lgaId);
        const distMeta = DISTRICT_META[distKey];
        originId = `origin_dist_${distKey}`;
        const n = ensureNode({
          id: originId,
          label: distMeta.label,
          shortLabel: distMeta.shortLabel,
          stage: 0,
          color: distMeta.color,
          accentColor: distMeta.accentColor,
          projectCount: 0,
          capitalNgn: 0,
          lgaCount: 0,
          districtId: distKey,
          subtitle: `${distMeta.councils} autonomous Local Government Areas`,
        });
        n.projectCount += 1;
        n.capitalNgn += act.budgetNgn || 0;
        n.lgaSet.add(act.lgaId);
      } else {
        const isTopLga = topLgaIdsInDistrict.has(act.lgaId);
        originId = isTopLga ? `origin_lga_${act.lgaId}` : `origin_lga_other_${scope}`;
        const lgaMeta = getLgaById(act.lgaId);
        const n = ensureNode({
          id: originId,
          label: isTopLga ? `${act.lgaName} LGA` : 'Other District Councils',
          shortLabel: isTopLga ? `${act.lgaName} LGA` : 'Other Councils',
          stage: 0,
          color: emeraldScale((idx % 6) / 6),
          accentColor: '#34D399',
          projectCount: 0,
          capitalNgn: 0,
          lgaCount: 0,
          lgaId: isTopLga ? act.lgaId : undefined,
          subtitle: isTopLga && lgaMeta ? `HQ: ${lgaMeta.headquarters}` : 'Additional verified councils',
        });
        n.projectCount += 1;
        n.capitalNgn += act.budgetNgn || 0;
        n.lgaSet.add(act.lgaId);
      }

      // Stage 1: Capacity Building Pillar Node
      const pillarCode = act.pillar || 'education';
      const pillarId = `cap_${pillarCode}`;
      const pillarName = getPillarDisplayName(pillarCode);
      const pillarShort = pillarName.length > 22 ? `${pillarName.slice(0, 20)}…` : pillarName;
      const pillarColor = PILLARS[pillarCode]?.color || '#047857';

      const capNode = ensureNode({
        id: pillarId,
        label: pillarName,
        shortLabel: pillarShort,
        stage: 1,
        color: pillarColor,
        accentColor: '#6EE7B7',
        projectCount: 0,
        capitalNgn: 0,
        lgaCount: 0,
        pillarCode,
        subtitle: 'Verified Capacity Building Pillar',
      });
      capNode.projectCount += 1;
      capNode.capitalNgn += act.budgetNgn || 0;
      capNode.lgaSet.add(act.lgaId);

      // Link Stage 0 -> Stage 1
      addLink(originId, pillarId, weight, 'origin_to_capacity');

      // Stage 2: Economic Empowerment Outcome Nodes (conserved allocation)
      const splitRules =
        PILLAR_TO_OUTCOME_WEIGHTS[pillarCode] || PILLAR_TO_OUTCOME_WEIGHTS.education;
      const allocations = allocateConservatively(weight, splitRules);

      for (const alloc of allocations) {
        if (alloc.amount <= 0) continue;
        const meta = OUTCOME_NODES[alloc.key];
        const outNode = ensureNode({
          id: alloc.key,
          label: meta.label,
          shortLabel: meta.shortLabel,
          stage: 2,
          color: meta.color,
          accentColor: meta.accentColor,
          projectCount: 0,
          capitalNgn: 0,
          lgaCount: 0,
          subtitle: meta.subtitle,
        });
        outNode.projectCount += 1;
        outNode.capitalNgn += (act.budgetNgn || 0) * (alloc.amount / weight);
        outNode.lgaSet.add(act.lgaId);

        if (alloc.key !== 'outcome_readiness') {
          directEconomicTotal += alloc.amount;
        }

        // Link Stage 1 -> Stage 2
        addLink(pillarId, alloc.key, alloc.amount, 'capacity_to_empowerment');
      }
    });

    const rawNodes: FlowNodeDatum[] = Array.from(nodeMap.values()).map(({ lgaSet, ...rest }) => ({
      ...rest,
      lgaCount: lgaSet.size,
    }));
    const rawLinks: FlowLinkDatum[] = Array.from(linkValueMap.values());

    // Compute exact Sankey geometry using d3-sankey
    const layout = d3Sankey<FlowNodeDatum, FlowLinkDatum>()
      .nodeId((d) => d.id)
      .nodeAlign(sankeyJustify)
      .nodeWidth(18)
      .nodePadding(18)
      .extent([
        [16, 20],
        [svgWidth - 16, svgHeight - 20],
      ]);

    const graph = layout({
      nodes: rawNodes.map((n) => ({ ...n })),
      links: rawLinks.map((l) => ({ ...l })),
    });

    const conversionPct =
      totalFlow > 0 ? Math.round((directEconomicTotal / totalFlow) * 100) : 0;

    return {
      nodes: graph.nodes,
      links: graph.links,
      totalFlowValue: totalFlow,
      activeCouncilsCount: activeLgaSet.size,
      empowermentConversionPct: conversionPct,
      totalCapitalNgn: totalBudget,
    };
  }, [publishedActivities, scope, basis, getPillarDisplayName, svgWidth]);

  // Precompute horizontal cubic Bezier path generator from d3-sankey
  const linkPathGenerator = useMemo(() => sankeyLinkHorizontal<FlowNodeDatum, FlowLinkDatum>(), []);

  // Determine connected highlight sets when hovering a node or link
  const { activeNodeIds, activeLinkIndices } = useMemo(() => {
    const nSet = new Set<string>();
    const lSet = new Set<number>();

    if (hoveredLinkIdx !== null && links[hoveredLinkIdx]) {
      const lk = links[hoveredLinkIdx];
      const src = lk.source as ComputedNode;
      const tgt = lk.target as ComputedNode;
      lSet.add(hoveredLinkIdx);
      nSet.add(src.id);
      nSet.add(tgt.id);
      return { activeNodeIds: nSet, activeLinkIndices: lSet };
    }

    if (hoveredNodeId) {
      nSet.add(hoveredNodeId);
      links.forEach((lk, idx) => {
        const src = lk.source as ComputedNode;
        const tgt = lk.target as ComputedNode;
        if (src.id === hoveredNodeId || tgt.id === hoveredNodeId) {
          lSet.add(idx);
          nSet.add(src.id);
          nSet.add(tgt.id);
        }
      });
    }

    return { activeNodeIds: nSet, activeLinkIndices: lSet };
  }, [hoveredNodeId, hoveredLinkIdx, links]);

  const hasHoverFocus = hoveredNodeId !== null || hoveredLinkIdx !== null;

  const updatePointerTooltip = (
    e: React.MouseEvent,
    payload: TooltipPayload
  ) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    rawTipX.set(Math.max(12, Math.min(rect.width - 12, relX)));
    rawTipY.set(Math.max(12, Math.min(rect.height - 12, relY)));

    const nextFlipX = relX > rect.width - 280;
    const nextFlipY = relY < 160;
    setTooltipFlip((prev) =>
      prev.flipX === nextFlipX && prev.flipY === nextFlipY
        ? prev
        : { flipX: nextFlipX, flipY: nextFlipY }
    );
    setTooltip(payload);
  };

  const clearHover = () => {
    setHoveredNodeId(null);
    setHoveredLinkIdx(null);
    setTooltip(null);
  };

  const handleNodeClick = (node: ComputedNode) => {
    if (node.pillarCode && onSelectPillarFilter) {
      onSelectPillarFilter(node.pillarCode);
      return;
    }
    if (node.lgaId && onSelectLgaFocus) {
      onSelectLgaFocus(node.lgaId);
      return;
    }
    if (node.districtId && scope === 'all') {
      setScope(node.districtId);
    }
  };

  const scopeOptions: Array<{ id: FlowScope; label: string }> = [
    { id: 'all', label: 'All 31 LGAs' },
    { id: 'uyo', label: 'Uyo (NE)' },
    { id: 'ikot-ekpene', label: 'Ikot Ekpene (NW)' },
    { id: 'eket', label: 'Eket (South)' },
  ];

  const basisOptions: Array<{ id: MetricBasis; label: string }> = [
    { id: 'all', label: 'All Citizens' },
    { id: 'youth', label: 'Youth Cohort' },
    { id: 'female', label: 'Women Reach' },
  ];

  const basisUnitLabel =
    basis === 'youth' ? 'youth' : basis === 'female' ? 'women' : 'beneficiaries';

  return (
    <div className="bg-white rounded-2xl border border-[#E5E2D9] shadow-sm overflow-hidden flex flex-col">
      {/* Top Emerald-Gold Header & Filter Controls */}
      <div className="p-5 sm:p-6 border-b border-[#ECE8DD] bg-gradient-to-r from-[#062411] via-[#0B4619] to-[#072E14] text-white relative overflow-hidden">
        <div
          aria-hidden="true"
          className="no-print pointer-events-none absolute -right-20 -top-24 w-72 h-72 rounded-full bg-radial from-[#D4AF37]/20 via-emerald-400/10 to-transparent blur-2xl"
        />

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#F0CC56] tracking-wide">
              <span className="inline-flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5" />
                <span>D3.js Sankey Livelihood Transition Model</span>
              </span>
              <span aria-hidden="true" className="text-white/35">·</span>
              <span className="text-emerald-200">Capacity Building → Economic Empowerment</span>
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
              Akwa Ibom Livelihood Impact Flow
            </h3>
            <p className="text-xs text-emerald-100/85 max-w-2xl">
              Trace how verified grassroots beneficiaries across {scope === 'all' ? 'all 31 Local Government Areas' : `${DISTRICT_META[scope].label}`} progress from HCD Capacity Building pillars into measurable Economic Empowerment pathways.
            </p>
          </div>

          {/* Interactive Scope & Demographic Basis Switchers */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Territorial Scope */}
            <div
              role="tablist"
              aria-label="Filter livelihood flow by territory"
              className="flex items-center gap-0.5 bg-white/10 border border-white/15 p-1 rounded-xl text-[11px]"
            >
              {scopeOptions.map((opt) => {
                const active = scope === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setScope(opt.id)}
                    className={`relative px-2.5 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      active ? 'text-[#051F0E]' : 'text-emerald-100 hover:text-white'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="livelihoodFlowScopeBg"
                        transition={{ duration: 0.22, ease: KINETIC_EASE }}
                        className="absolute inset-0 bg-[#D4AF37] rounded-lg"
                      />
                    )}
                    <span className="relative z-10">{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Demographic Basis */}
            <div
              role="tablist"
              aria-label="Select beneficiary demographic flow basis"
              className="flex items-center gap-0.5 bg-black/25 border border-white/15 p-1 rounded-xl text-[11px]"
            >
              {basisOptions.map((opt) => {
                const active = basis === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setBasis(opt.id)}
                    className={`relative px-2.5 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      active ? 'text-white' : 'text-emerald-200/80 hover:text-white'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="livelihoodFlowBasisBg"
                        transition={{ duration: 0.22, ease: KINETIC_EASE }}
                        className="absolute inset-0 bg-emerald-600/80 border border-emerald-300/40 rounded-lg"
                      />
                    )}
                    <span className="relative z-10">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Summary Transition Metrics Strip */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/12">
          <div className="rounded-xl bg-white/8 border border-white/10 px-3.5 py-2.5">
            <span className="text-[10.5px] text-emerald-200/80 block">Total Flow Volume</span>
            <strong className="text-lg sm:text-xl font-bold text-white font-mono tabular-nums">
              {formatCompact(totalFlowValue)}
            </strong>
            <span className="text-[10px] text-emerald-200/75 block">{basisUnitLabel} tracked</span>
          </div>

          <div className="rounded-xl bg-white/8 border border-white/10 px-3.5 py-2.5">
            <span className="text-[10.5px] text-emerald-200/80 block">Active Territories</span>
            <strong className="text-lg sm:text-xl font-bold text-[#F4D97A] font-mono tabular-nums">
              {activeCouncilsCount}
              <span className="text-xs font-normal text-emerald-200/80">
                {' '}/ {scope === 'all' ? 31 : DISTRICT_META[scope].councils} LGAs
              </span>
            </strong>
            <span className="text-[10px] text-emerald-200/75 block">contributing verified flow</span>
          </div>

          <div className="rounded-xl bg-white/8 border border-white/10 px-3.5 py-2.5">
            <span className="text-[10.5px] text-emerald-200/80 block">Direct Economic Share</span>
            <strong className="text-lg sm:text-xl font-bold text-[#F4D97A] font-mono tabular-nums">
              {empowermentConversionPct}%
            </strong>
            <span className="text-[10px] text-emerald-200/75 block">jobs, agro &amp; micro-enterprises</span>
          </div>

          <div className="rounded-xl bg-white/8 border border-white/10 px-3.5 py-2.5">
            <span className="text-[10.5px] text-emerald-200/80 block">Enabling Capital</span>
            <strong className="text-lg sm:text-xl font-bold text-white font-mono tabular-nums">
              ₦{(totalCapitalNgn / 1_000_000).toFixed(1)}M
            </strong>
            <span className="text-[10px] text-emerald-200/75 block">verified grassroots spend</span>
          </div>
        </div>
      </div>

      {/* 3-Stage Column Progression Headers */}
      <div className="grid grid-cols-3 bg-[#FAF8F2] border-b border-[#ECE8DD] px-5 sm:px-7 py-2.5 text-[11px] font-bold uppercase tracking-wider">
        <div className="flex items-center gap-1.5 text-emerald-950">
          <span className="font-mono text-[#0B4619]">01</span>
          <Building2 className="w-3.5 h-3.5 text-[#0B4619] hidden sm:inline" />
          <span className="truncate">
            {scope === 'all' ? '31 LGAs (3 Districts)' : `${DISTRICT_META[scope].shortLabel.split(' ')[0]} Councils`}
          </span>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-emerald-800">
          <span className="font-mono text-emerald-700">02</span>
          <Layers className="w-3.5 h-3.5 text-emerald-700 hidden sm:inline" />
          <span className="truncate">Capacity Building</span>
        </div>

        <div className="flex items-center justify-end gap-1.5 text-amber-900">
          <span className="font-mono text-[#B88917]">03</span>
          <TrendingUp className="w-3.5 h-3.5 text-[#B88917] hidden sm:inline" />
          <span className="truncate">Economic Empowerment</span>
        </div>
      </div>

      {/* Interactive D3.js Sankey Canvas */}
      <div
        ref={containerRef}
        onMouseLeave={clearHover}
        className="relative bg-gradient-to-b from-white via-[#FAF8F2]/55 to-emerald-50/25 px-3 sm:px-5 py-5 overflow-x-auto"
      >
        {nodes.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Compass className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">
              No verified beneficiary transitions match this filter yet
            </p>
            <p className="text-xs text-slate-500">
              Switch back to All 31 LGAs or All Citizens to explore the statewide Livelihood Impact Flow.
            </p>
            <button
              type="button"
              onClick={() => {
                setScope('all');
                setBasis('all');
              }}
              className="mt-2 px-4 py-2 rounded-xl bg-[#0B4619] text-white text-xs font-bold cursor-pointer"
            >
              Reset Flow Filters
            </button>
          </div>
        ) : (
          <div className="min-w-[740px] relative">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto block select-none overflow-visible"
              role="img"
              aria-label="D3 Sankey Livelihood Impact Flow visualizing beneficiary transition from 31 LGAs through Capacity Building to Economic Empowerment"
            >
              <defs>
                {/* Emerald-to-Gold Directional Linear Gradients for Every Sankey Link */}
                {links.map((lk, idx) => {
                  const src = lk.source as ComputedNode;
                  const tgt = lk.target as ComputedNode;
                  const startColor =
                    lk.stageTransition === 'origin_to_capacity'
                      ? src.color || '#0B4619'
                      : '#0F766E';
                  const endColor =
                    lk.stageTransition === 'origin_to_capacity'
                      ? '#10B981'
                      : tgt.color || '#D4AF37';

                  return (
                    <linearGradient
                      key={`flow-grad-${idx}`}
                      id={`livelihood-flow-grad-${idx}`}
                      gradientUnits="userSpaceOnUse"
                      x1={src.x1 ?? 0}
                      x2={tgt.x0 ?? svgWidth}
                    >
                      <stop offset="0%" stopColor={startColor} stopOpacity="0.88" />
                      <stop offset="55%" stopColor="#10B981" stopOpacity="0.72" />
                      <stop offset="100%" stopColor={endColor} stopOpacity="0.92" />
                    </linearGradient>
                  );
                })}

                {/* Soft Luminous Glow Filter for Hovered Pathways */}
                <filter id="livelihood-gold-glow" x="-15%" y="-15%" width="130%" height="130%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Subtle Vertical Stage Guide Hairlines */}
              {[0, 1, 2].map((stageIdx) => {
                const sample = nodes.find((n) => n.stage === stageIdx);
                if (!sample || sample.x0 === undefined || sample.x1 === undefined) return null;
                const cx = (sample.x0 + sample.x1) / 2;
                return (
                  <line
                    key={`stage-guide-${stageIdx}`}
                    x1={cx}
                    x2={cx}
                    y1={8}
                    y2={svgHeight - 8}
                    stroke="#E5E2D9"
                    strokeWidth="1"
                    strokeDasharray="4 6"
                  />
                );
              })}

              {/* Layer 1: D3 Sankey Flow Ribbons */}
              <g>
                {links.map((lk, idx) => {
                  const d = linkPathGenerator(lk) || '';
                  const src = lk.source as ComputedNode;
                  const tgt = lk.target as ComputedNode;
                  const strokeW = Math.max(2, lk.width || 2);
                  const isHighlighted = activeLinkIndices.has(idx);
                  const opacity = hasHoverFocus ? (isHighlighted ? 0.88 : 0.12) : 0.42;
                  const sharePct =
                    totalFlowValue > 0 ? Math.round((lk.value / totalFlowValue) * 1000) / 10 : 0;

                  return (
                    <g key={`link-group-${src.id}-${tgt.id}-${idx}`}>
                      <motion.path
                        d={d}
                        fill="none"
                        stroke={`url(#livelihood-flow-grad-${idx})`}
                        strokeWidth={strokeW}
                        initial={prefersReduced ? { opacity } : { pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity }}
                        transition={{
                          pathLength: {
                            duration: 0.85,
                            delay: Math.min(idx * 0.025, 0.45),
                            ease: KINETIC_EASE,
                          },
                          opacity: { duration: 0.22 },
                        }}
                        filter={isHighlighted ? 'url(#livelihood-gold-glow)' : undefined}
                        className="cursor-pointer transition-[filter] duration-200"
                        onMouseEnter={(e) => {
                          setHoveredLinkIdx(idx);
                          setHoveredNodeId(null);
                          updatePointerTooltip(e, {
                            kind: 'link',
                            kicker:
                              lk.stageTransition === 'origin_to_capacity'
                                ? 'Origin → Capacity Building'
                                : 'Capacity Building → Economic Empowerment',
                            title: `${src.shortLabel} → ${tgt.shortLabel}`,
                            value: Math.round(lk.value),
                            sharePct,
                            subtitle: `${formatCompact(Math.round(lk.value))} ${basisUnitLabel} transitioning along this verified pathway`,
                            secondaryStat: `${sharePct}% of active flow`,
                          });
                        }}
                        onMouseMove={(e) => {
                          if (hoveredLinkIdx === idx && tooltip) {
                            updatePointerTooltip(e, tooltip);
                          }
                        }}
                        onMouseLeave={() => {
                          setHoveredLinkIdx(null);
                          setTooltip(null);
                        }}
                      />

                      {/* Kinetic Flowing Gold Light Stream along Highlighted or Major Links */}
                      {!prefersReduced && (isHighlighted || strokeW >= 12) && (
                        <motion.path
                          d={d}
                          fill="none"
                          stroke={
                            lk.stageTransition === 'capacity_to_empowerment'
                              ? '#F4D97A'
                              : '#6EE7B7'
                          }
                          strokeWidth={Math.max(1.5, Math.min(3, strokeW * 0.16))}
                          strokeLinecap="round"
                          strokeDasharray="10 26"
                          initial={{ strokeDashoffset: 72, opacity: 0 }}
                          animate={{
                            strokeDashoffset: [72, 0],
                            opacity: isHighlighted ? 0.92 : hasHoverFocus ? 0.05 : 0.45,
                          }}
                          transition={{
                            strokeDashoffset: {
                              duration: isHighlighted ? 1.8 : 3.2,
                              repeat: Infinity,
                              ease: 'linear',
                            },
                            opacity: { duration: 0.25 },
                          }}
                          className="pointer-events-none"
                        />
                      )}
                    </g>
                  );
                })}
              </g>

              {/* Layer 2: D3 Sankey Stage Nodes & Crisp High-Contrast Labels */}
              <g>
                {nodes.map((node, idx) => {
                  const x0 = node.x0 ?? 0;
                  const x1 = node.x1 ?? 18;
                  const y0 = node.y0 ?? 0;
                  const y1 = node.y1 ?? 24;
                  const nodeH = Math.max(8, y1 - y0);
                  const nodeW = Math.max(14, x1 - x0);
                  const val = Math.round(node.value || 0);
                  const sharePct =
                    totalFlowValue > 0 ? Math.round((val / totalFlowValue) * 1000) / 10 : 0;

                  const isNodeActive = activeNodeIds.has(node.id);
                  const isDirectlyHovered = hoveredNodeId === node.id;
                  const dimNode = hasHoverFocus && !isNodeActive;

                  // Position labels cleanly without colliding with outer margins
                  const isRightStage = node.stage === 2;
                  const isCenterStage = node.stage === 1;
                  const labelX = isRightStage
                    ? x0 - 10
                    : isCenterStage
                    ? x1 + 10
                    : x1 + 10;
                  const textAnchor: 'start' | 'end' = isRightStage ? 'end' : 'start';
                  const midY = y0 + nodeH / 2;

                  const isClickable = Boolean(
                    (node.pillarCode && onSelectPillarFilter) ||
                      (node.lgaId && onSelectLgaFocus) ||
                      (node.districtId && scope === 'all')
                  );

                  const actionHint = node.pillarCode
                    ? 'Click to filter Verified Dossiers by this pillar'
                    : node.lgaId
                    ? `Click to focus ${node.label} on the 31-LGA Map`
                    : node.districtId && scope === 'all'
                    ? `Click to drill down into ${node.label} LGAs`
                    : undefined;

                  return (
                    <motion.g
                      key={node.id}
                      initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 6 }}
                      animate={{ opacity: dimNode ? 0.35 : 1, y: 0 }}
                      transition={{
                        opacity: { duration: 0.22 },
                        y: { duration: 0.45, delay: Math.min(idx * 0.03, 0.3), ease: KINETIC_EASE },
                      }}
                      onClick={() => handleNodeClick(node)}
                      onMouseEnter={(e) => {
                        setHoveredNodeId(node.id);
                        setHoveredLinkIdx(null);
                        updatePointerTooltip(e, {
                          kind: 'node',
                          kicker:
                            node.stage === 0
                              ? 'Stage 01 · Territorial Origin'
                              : node.stage === 1
                              ? 'Stage 02 · Capacity Building Pillar'
                              : 'Stage 03 · Economic Empowerment Outcome',
                          title: node.label,
                          value: val,
                          sharePct,
                          subtitle: node.subtitle,
                          secondaryStat: `${node.projectCount} verified dossiers · ₦${(
                            node.capitalNgn / 1_000_000
                          ).toFixed(1)}M`,
                          actionHint,
                        });
                      }}
                      onMouseMove={(e) => {
                        if (hoveredNodeId === node.id && tooltip) {
                          updatePointerTooltip(e, tooltip);
                        }
                      }}
                      onMouseLeave={clearHover}
                      className={isClickable ? 'cursor-pointer' : 'cursor-default'}
                    >
                      {/* Node Glass Bar */}
                      <rect
                        x={x0}
                        y={y0}
                        width={nodeW}
                        height={nodeH}
                        rx={5}
                        ry={5}
                        fill={node.color}
                        stroke={isDirectlyHovered ? '#D4AF37' : '#ffffff'}
                        strokeWidth={isDirectlyHovered ? 2.5 : 1.25}
                        filter={isDirectlyHovered ? 'url(#livelihood-gold-glow)' : undefined}
                      />

                      {/* Inner Top Specular Highlight on Node Bar */}
                      <rect
                        x={x0 + 2}
                        y={y0 + 1.5}
                        width={Math.max(4, nodeW - 4)}
                        height={Math.min(4, Math.max(1.5, nodeH * 0.18))}
                        rx={2}
                        fill="#ffffff"
                        opacity={0.35}
                        className="pointer-events-none"
                      />

                      {/* Crisp Label with Soft Halo Readability */}
                      {nodeH >= 16 && (
                        <g className="pointer-events-none">
                          <text
                            x={labelX}
                            y={nodeH >= 32 ? midY - 6 : midY}
                            textAnchor={textAnchor}
                            dominantBaseline="middle"
                            className="text-[11px] font-bold fill-slate-900"
                            style={{
                              paintOrder: 'stroke',
                              stroke: 'rgba(255, 255, 255, 0.92)',
                              strokeWidth: '3.5px',
                              strokeLinejoin: 'round',
                            }}
                          >
                            {node.shortLabel}
                          </text>
                          {nodeH >= 32 && (
                            <text
                              x={labelX}
                              y={midY + 9}
                              textAnchor={textAnchor}
                              dominantBaseline="middle"
                              className="text-[10px] font-mono tabular-nums font-semibold fill-emerald-800"
                              style={{
                                paintOrder: 'stroke',
                                stroke: 'rgba(255, 255, 255, 0.92)',
                                strokeWidth: '3px',
                                strokeLinejoin: 'round',
                              }}
                            >
                              {formatCompact(val)} ({sharePct}%)
                            </text>
                          )}
                        </g>
                      )}
                    </motion.g>
                  );
                })}
              </g>
            </svg>
          </div>
        )}

        {/* Framer Motion Spring Floating Tooltip for D3 Nodes & Links */}
        <AnimatePresence>
          {tooltip && (
            <motion.div
              key="livelihood-flow-tooltip"
              role="tooltip"
              style={{
                left: 0,
                top: 0,
                x: smoothTipX,
                y: smoothTipY,
                willChange: 'transform, opacity',
              }}
              initial={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.93 }}
              animate={prefersReduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={prefersReduced ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
              transition={{
                opacity: { duration: 0.15, ease: KINETIC_EASE },
                scale: { type: 'spring', stiffness: 420, damping: 28 },
              }}
              className="no-print pointer-events-none absolute z-30"
            >
              <div
                style={{
                  transform: `translate(${tooltipFlip.flipX ? 'calc(-100% - 16px)' : '16px'}, ${
                    tooltipFlip.flipY ? '16px' : 'calc(-100% - 14px)'
                  })`,
                  transition: 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                className="w-[268px] rounded-xl bg-[#052110]/95 backdrop-blur-md border border-[#D4AF37]/45 text-white shadow-2xl shadow-emerald-950/35 overflow-hidden"
              >
                <div className="h-[2.5px] w-full bg-gradient-to-r from-[#D4AF37] via-amber-300 to-emerald-400" />
                <div className="p-3.5 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#F0CC56]">
                    {tooltip.kicker}
                  </div>
                  <div className="font-display text-sm font-bold text-white leading-snug">
                    {tooltip.title}
                  </div>

                  <div className="flex items-baseline justify-between gap-2 pt-1.5 border-t border-white/12">
                    <div className="flex items-center gap-1.5 text-xs text-emerald-200">
                      <Users className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span className="font-mono tabular-nums font-bold text-white text-sm">
                        {formatCompact(tooltip.value)}
                      </span>
                      <span className="text-[11px]">{basisUnitLabel}</span>
                    </div>
                    <span className="font-mono tabular-nums text-[11px] font-bold text-[#F4D97A] bg-[#D4AF37]/15 border border-[#D4AF37]/35 px-1.5 py-0.5 rounded">
                      {tooltip.sharePct}%
                    </span>
                  </div>

                  <p className="text-[11px] text-emerald-100/85 leading-relaxed">
                    {tooltip.subtitle}
                  </p>

                  {tooltip.secondaryStat && (
                    <div className="text-[10.5px] font-mono tabular-nums text-emerald-200/85 pt-1 border-t border-white/10">
                      {tooltip.secondaryStat}
                    </div>
                  )}

                  {tooltip.actionHint && (
                    <div className="flex items-center justify-between text-[10px] text-[#F4D97A] pt-1 border-t border-white/10 font-semibold">
                      <span>{tooltip.actionHint}</span>
                      <ArrowUpRight className="w-3 h-3 shrink-0" />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Guidance & Interaction Legend */}
      <div className="px-5 sm:px-6 py-3 bg-[#FAF8F2] border-t border-[#ECE8DD] flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-600">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Interactive Flow Pathways:</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-xs bg-[#0B4619]" />
            <span>31-LGA Origin</span>
          </span>
          <ArrowRight className="w-3 h-3 text-slate-400" />
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-xs bg-[#10B981]" />
            <span>Capacity Building</span>
          </span>
          <ArrowRight className="w-3 h-3 text-slate-400" />
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-xs bg-[#D4AF37]" />
            <span>Economic Empowerment</span>
          </span>
        </div>

        <div className="text-slate-500">
          Hover any ribbon or node to isolate pathways · Click a district, LGA, or pillar to drill down
        </div>
      </div>
    </div>
  );
};
