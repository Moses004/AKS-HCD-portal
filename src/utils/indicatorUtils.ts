import { HCDReportingIndicator, ActivityMeasurement, HCDActivity } from '../types';

export interface JoinedIndicatorRow {
  indicator: HCDReportingIndicator;
  measurements: Array<{
    measurement: ActivityMeasurement;
    parentActivity?: HCDActivity;
  }>;
  status: 'Data reported' | 'No data reported' | 'Incomplete submission';
  latestValueText: string;
  latestPeriod: string;
  calculatedRate?: string | null;
  hasEvidence: boolean;
  notesSummary: string;
}

export interface CategorySummary {
  categoryName: string;
  canonicalPillar: string;
  totalIndicators: number;
  reportedIndicators: number;
  unreportedIndicators: number;
  incompleteIndicators: number;
  coveragePercentage: number;
  rows: JoinedIndicatorRow[];
}

/**
 * Canonical 6 reporting categories mapped to strategic pillar codes
 */
export const HCD_REPORTING_CATEGORIES = [
  { id: 'Education', name: 'Education', pillar: 'education', codePrefix: 'EDU', expectedCount: 6 },
  { id: 'Health', name: 'Health', pillar: 'health', codePrefix: 'HLT', expectedCount: 6 },
  { id: 'Skill and labour', name: 'Skill and labour', pillar: 'vocational', codePrefix: 'LAB', expectedCount: 6 },
  { id: 'Cross-cutting Enablers', name: 'Cross-cutting Enablers', pillar: 'cross_cutting_enablers', codePrefix: 'CC', expectedCount: 12 },
  { id: 'Values/Ethics/Social behaviour', name: 'Values/Ethics/Social behaviour', pillar: 'values_ethics_social_behaviour', codePrefix: 'VESB', expectedCount: 4 },
  { id: 'HCD Settings', name: 'HCD Settings', pillar: 'agriculture', codePrefix: 'HCDS', expectedCount: 4 },
] as const;

/**
 * Resolves canonical pillar code from category name
 */
export const getPillarFromCategory = (categoryName?: string | null): string => {
  if (!categoryName) return '';
  const match = HCD_REPORTING_CATEGORIES.find(
    (c) => c.name.toLowerCase() === categoryName.trim().toLowerCase() ||
           c.id.toLowerCase() === categoryName.trim().toLowerCase()
  );
  return match?.pillar || '';
};

/**
 * Calculates rate percentage handling zero or null denominator as 'N/A'
 */
export const calculatePercentageRate = (
  numerator?: number | null,
  denominator?: number | null
): string | null => {
  if (numerator === null || numerator === undefined || denominator === null || denominator === undefined) {
    return null;
  }
  if (denominator === 0) {
    return 'N/A';
  }
  const pct = (numerator / denominator) * 100;
  return `${pct.toFixed(1)}%`;
};

/**
 * Left-joins active indicator catalogue to authorized measurements and activities.
 * Always preserves ALL active indicators in the catalogue, even when 0 measurements exist.
 */
export const joinIndicatorsToMeasurements = (
  indicators: HCDReportingIndicator[],
  measurements: ActivityMeasurement[],
  activities: HCDActivity[]
): JoinedIndicatorRow[] => {
  const activityMap = new Map<string, HCDActivity>();
  activities.forEach((a) => activityMap.set(a.id, a));

  // Group measurements by indicator code
  const measurementsByCode = new Map<string, ActivityMeasurement[]>();
  measurements.forEach((m) => {
    const list = measurementsByCode.get(m.indicator_code) || [];
    list.push(m);
    measurementsByCode.set(m.indicator_code, list);
  });

  return indicators.map((ind) => {
    const matchingMeasurements = measurementsByCode.get(ind.indicator_code) || [];
    const joinedMeasurements = matchingMeasurements.map((m) => ({
      measurement: m,
      parentActivity: activityMap.get(m.activity_id),
    }));

    if (joinedMeasurements.length === 0) {
      return {
        indicator: ind,
        measurements: [],
        status: 'No data reported',
        latestValueText: 'No data reported for this LGA and reporting period.',
        latestPeriod: '—',
        calculatedRate: null,
        hasEvidence: false,
        notesSummary: '',
      };
    }

    // Determine latest measurement
    const latest = joinedMeasurements[joinedMeasurements.length - 1].measurement;
    let valueStr = '';
    if (latest.value_numeric !== null && latest.value_numeric !== undefined) {
      valueStr = `${latest.value_numeric} ${ind.measurement_unit}`;
    } else if (latest.value_text) {
      valueStr = latest.value_text;
    } else {
      valueStr = 'Value recorded';
    }

    // Rate calculation if numerator & denominator exist
    const rate = calculatePercentageRate(latest.numerator, latest.denominator);

    // Period string
    const period = latest.reporting_period_start && latest.reporting_period_end
      ? `${latest.reporting_period_start} to ${latest.reporting_period_end}`
      : latest.reporting_period_start || latest.reporting_period_end || 'Period not specified';

    // Completeness check
    const isMissingEvidence = ind.evidence_required && ind.evidence_required.length > 0 && !latest.evidence_reference;
    const isMissingNumeric = ind.measurement_unit !== 'text' && latest.value_numeric === null && latest.value_numeric === undefined;
    const status: 'Data reported' | 'Incomplete submission' =
      isMissingEvidence || isMissingNumeric ? 'Incomplete submission' : 'Data reported';

    return {
      indicator: ind,
      measurements: joinedMeasurements,
      status,
      latestValueText: valueStr,
      latestPeriod: period,
      calculatedRate: rate,
      hasEvidence: Boolean(latest.evidence_reference),
      notesSummary: latest.notes || '',
    };
  });
};

/**
 * Groups joined indicator rows by the 5 official reporting categories
 */
export const groupRowsByCategory = (
  rows: JoinedIndicatorRow[],
  selectedCategory?: string | null
): CategorySummary[] => {
  const result: CategorySummary[] = [];

  const categoriesToProcess = selectedCategory && selectedCategory !== 'all'
    ? HCD_REPORTING_CATEGORIES.filter(
        (c) => c.name.toLowerCase() === selectedCategory.toLowerCase() ||
               c.id.toLowerCase() === selectedCategory.toLowerCase() ||
               c.pillar.toLowerCase() === selectedCategory.toLowerCase()
      )
    : HCD_REPORTING_CATEGORIES;

  categoriesToProcess.forEach((cat) => {
    const catRows = rows.filter(
      (r) => r.indicator.reporting_category?.trim().toLowerCase() === cat.name.toLowerCase()
    );

    const total = catRows.length;
    const reported = catRows.filter((r) => r.status === 'Data reported').length;
    const incomplete = catRows.filter((r) => r.status === 'Incomplete submission').length;
    const unreported = catRows.filter((r) => r.status === 'No data reported').length;
    const coverage = total > 0 ? Math.round(((reported + incomplete) / total) * 100) : 0;

    result.push({
      categoryName: cat.name,
      canonicalPillar: cat.pillar,
      totalIndicators: total,
      reportedIndicators: reported,
      unreportedIndicators: unreported,
      incompleteIndicators: incomplete,
      coveragePercentage: coverage,
      rows: catRows,
    });
  });

  return result;
};
