import { HCDPillar, PillarInfo } from '../types';
import { PILLARS, DEFAULT_HCD_PILLARS } from '../data/lgas';

/**
 * Standard utility to resolve pillar display names consistently.
 * Uses the live database catalogue (hcd_pillars) when provided,
 * with fallbacks to static definitions and formatted codes.
 * Ensures the app never crashes on unknown or missing codes.
 */
export const getPillarDisplayName = (
  pillarCode?: string | null,
  pillarCatalogue?: HCDPillar[]
): string => {
  if (!pillarCode) return 'Unspecified Pillar';

  const normalizedCode = pillarCode.trim().toLowerCase();

  // 1. Look up in live database catalogue if available
  if (pillarCatalogue && Array.isArray(pillarCatalogue)) {
    const liveMatch = pillarCatalogue.find(
      (p) => p.pillar_code.toLowerCase() === normalizedCode
    );
    if (liveMatch?.display_name) {
      return liveMatch.display_name;
    }
  }

  // 2. Look up in static PILLARS dictionary
  const staticMatch = PILLARS[normalizedCode];
  if (staticMatch?.name) {
    return staticMatch.name;
  }

  // 3. Fallback to DEFAULT_HCD_PILLARS
  const defaultMatch = DEFAULT_HCD_PILLARS.find(
    (p) => p.pillar_code.toLowerCase() === normalizedCode
  );
  if (defaultMatch?.display_name) {
    return defaultMatch.display_name;
  }

  // 4. Graceful human-readable formatting of unknown code (e.g. 'custom_code' -> 'Custom Code')
  return normalizedCode
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Standard utility to resolve pillar descriptions.
 */
export const getPillarDescription = (
  pillarCode?: string | null,
  pillarCatalogue?: HCDPillar[]
): string => {
  if (!pillarCode) return '';
  const normalizedCode = pillarCode.trim().toLowerCase();

  if (pillarCatalogue && Array.isArray(pillarCatalogue)) {
    const liveMatch = pillarCatalogue.find(
      (p) => p.pillar_code.toLowerCase() === normalizedCode
    );
    if (liveMatch?.description) return liveMatch.description;
  }

  const staticMatch = PILLARS[normalizedCode];
  if (staticMatch?.description) return staticMatch.description;

  return '';
};

/**
 * Get full PillarInfo with live display name applied
 */
export const getPillarInfo = (
  pillarCode?: string | null,
  pillarCatalogue?: HCDPillar[]
): PillarInfo | undefined => {
  if (!pillarCode) return undefined;
  const normalizedCode = pillarCode.trim().toLowerCase();
  const base = PILLARS[normalizedCode];
  if (!base) return undefined;

  const displayName = getPillarDisplayName(normalizedCode, pillarCatalogue);
  return {
    ...base,
    name: displayName,
  };
};

/**
 * Sorts an array of pillar codes or items by canonical sort_order
 */
export const sortPillarsByOrder = <T extends { pillar_code?: string; id?: string }>(
  items: T[],
  pillarCatalogue?: HCDPillar[]
): T[] => {
  const catalogue =
    pillarCatalogue && pillarCatalogue.length > 0
      ? pillarCatalogue
      : DEFAULT_HCD_PILLARS;

  const orderMap = new Map<string, number>();
  catalogue.forEach((p, idx) => {
    orderMap.set(p.pillar_code.toLowerCase(), p.sort_order ?? idx + 1);
  });

  return [...items].sort((a, b) => {
    const codeA = (a.pillar_code || a.id || '').toLowerCase();
    const codeB = (b.pillar_code || b.id || '').toLowerCase();
    const orderA = orderMap.get(codeA) ?? 999;
    const orderB = orderMap.get(codeB) ?? 999;
    return orderA - orderB;
  });
};
