import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  HCDActivity,
  HCDReportingIndicator,
  ActivityMeasurement,
  HCDPillar,
  UserSession,
  HCDLgaTargetPerformance,
} from '../types';
import { getPillarDisplayName } from '../utils/pillarUtils';
import { supabaseService } from './supabaseService';

export interface ExportFilterOptions {
  lgaId?: string;
  lgaName?: string;
  startDate?: string;
  endDate?: string;
  pillar?: string;
  category?: string;
  status?: string;
  indicatorCode?: string;
  searchQuery?: string;
}

export interface ExportDataPayload {
  activities: HCDActivity[];
  measurements: ActivityMeasurement[];
  indicators: HCDReportingIndicator[];
  pillars: HCDPillar[];
  filters: ExportFilterOptions;
  generatedAt: string;
  generatedBy?: string;
  userRole?: string;
  completenessWarnings: string[];
}

/**
 * Mitigates spreadsheet formula injection (CSV/Excel) for untrusted text fields
 * while preserving valid numbers, dates, and clean strings.
 */
export const sanitizeSpreadsheetCell = (val: unknown): string | number => {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';

  const str = String(val).trim();
  if (str === '') return '';

  // If it's a valid integer or float (e.g. "-12.5" or "100"), preserve as number
  if (!isNaN(Number(str))) {
    return Number(str);
  }

  // Prepend single quote if it starts with formula injection characters
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }

  return str;
};

/**
 * Evaluates dataset completeness and flags data-quality warnings
 */
export const evaluateDataCompleteness = (
  activities: HCDActivity[],
  measurements: ActivityMeasurement[]
): string[] => {
  const warnings: string[] = [];

  if (activities.length === 0) {
    warnings.push('No activities found matching the specified filter criteria.');
    return warnings;
  }

  const missingDates = activities.filter((a) => !a.startDate || !a.completionDate).length;
  if (missingDates > 0) {
    warnings.push(`${missingDates} activity record(s) lack complete start or completion dates.`);
  }

  const missingCoords = activities.filter((a) => !a.coordinates).length;
  if (missingCoords > 0) {
    warnings.push(`${missingCoords} activity record(s) do not have verified geographic coordinates.`);
  }

  const zeroBeneficiaries = activities.filter((a) => a.beneficiariesTotal === 0).length;
  if (zeroBeneficiaries > 0) {
    warnings.push(`${zeroBeneficiaries} activity record(s) report zero recorded beneficiaries.`);
  }

  const missingEvidence = activities.filter(
    (a) => (!a.mediaAssets || a.mediaAssets.length === 0) && !a.attendanceRegistryUrl
  ).length;
  if (missingEvidence > 0) {
    warnings.push(`${missingEvidence} activity record(s) lack supporting media assets or attendance registries.`);
  }

  const unmeasuredActs = activities.filter(
    (a) => !measurements.some((m) => m.activity_id === a.id)
  ).length;
  if (unmeasuredActs > 0) {
    warnings.push(`${unmeasuredActs} activity record(s) do not currently have associated indicator measurements.`);
  }

  return warnings;
};

/**
 * Builds the 7-sheet comprehensive Excel workbook and initiates download
 */
export const exportLgaExcelWorkbook = (payload: ExportDataPayload): void => {
  const {
    activities,
    measurements,
    indicators,
    pillars,
    filters,
    generatedAt,
    generatedBy,
    completenessWarnings,
  } = payload;

  const workbook = XLSX.utils.book_new();

  // Create Indicator Map
  const indicatorMap = new Map<string, HCDReportingIndicator>();
  indicators.forEach((ind) => indicatorMap.set(ind.indicator_code, ind));

  // --------------------------------------------------------------------------
  // SHEET 1: LGA Summary
  // --------------------------------------------------------------------------
  const totalBeneficiaries = activities.reduce((sum, a) => sum + (a.beneficiariesTotal || 0), 0);
  const totalMale = activities.reduce((sum, a) => sum + (a.beneficiariesMale || 0), 0);
  const totalFemale = activities.reduce((sum, a) => sum + (a.beneficiariesFemale || 0), 0);
  const totalYouth = activities.reduce((sum, a) => sum + (a.youthBeneficiaries || 0), 0);
  const totalBudget = activities.reduce((sum, a) => sum + (a.budgetNgn || 0), 0);
  const avgProgress =
    activities.length > 0
      ? Math.round(
          activities.reduce((sum, a) => sum + (a.overallProgress || 0), 0) / activities.length
        )
      : 0;

  // Breakdown by Pillar
  const pillarCounts: Record<string, { count: number; beneficiaries: number; budget: number }> = {};
  pillars.forEach((p) => {
    pillarCounts[p.pillar_code] = { count: 0, beneficiaries: 0, budget: 0 };
  });

  activities.forEach((a) => {
    const code = a.pillar || 'unspecified';
    if (!pillarCounts[code]) {
      pillarCounts[code] = { count: 0, beneficiaries: 0, budget: 0 };
    }
    pillarCounts[code].count += 1;
    pillarCounts[code].beneficiaries += a.beneficiariesTotal || 0;
    pillarCounts[code].budget += a.budgetNgn || 0;
  });

  // Breakdown by Status
  const statusCounts: Record<string, number> = {
    PUBLISHED: 0,
    PENDING_APPROVAL: 0,
    DRAFT: 0,
    REJECTED_DRAFT: 0,
  };
  activities.forEach((a) => {
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
  });

  // Indicator Coverage Stats
  const measuredIndicatorCodes = new Set(measurements.map((m) => m.indicator_code));
  const activeIndicatorsCount = indicators.length;
  const reportedIndicatorsCount = indicators.filter((i) => measuredIndicatorCodes.has(i.indicator_code)).length;
  const unreportedIndicatorsCount = activeIndicatorsCount - reportedIndicatorsCount;
  const coverageRate = activeIndicatorsCount > 0
    ? `${Math.round((reportedIndicatorsCount / activeIndicatorsCount) * 100)}%`
    : '0%';

  const summaryRows: any[][] = [
    ['AKWA IBOM STATE GOVERNMENT — HUMAN CAPITAL DEVELOPMENT (ARISE AGENDA)'],
    ['OFFICIAL LOCAL GOVERNMENT AREA COMPREHENSIVE DOSSIER & METRICS REPORT'],
    [''],
    ['REPORT METADATA & PARAMETERS', ''],
    ['Local Government Area (LGA):', filters.lgaName || filters.lgaId || 'All Akwa Ibom State LGAs'],
    ['LGA Identifier Code:', filters.lgaId || 'statewide'],
    ['Reporting Period Range:', `${filters.startDate || 'Commencement'} to ${filters.endDate || 'Latest Recorded'}`],
    ['HCD Pillar Filter:', filters.pillar ? getPillarDisplayName(filters.pillar, pillars) : 'All Strategic Pillars'],
    ['Activity Category Filter:', filters.category || 'All Categories'],
    ['Activity Status Filter:', filters.status || 'All Authorized Statuses'],
    ['Generated At (UTC):', generatedAt],
    ['Generated By / Officer:', generatedBy || 'Authorized State Executive / Desk Officer'],
    ['Data Classification:', 'OFFICIAL GOVERNMENT REPORTING DATA'],
    [''],
    ['EXECUTIVE KEY PERFORMANCE SUMMARY', ''],
    ['Total Matching Activities:', activities.length],
    ['Total Recorded Beneficiaries:', totalBeneficiaries],
    ['Male Beneficiaries:', totalMale],
    ['Female Beneficiaries:', totalFemale],
    ['Youth Beneficiaries:', totalYouth],
    ['Total Recorded Budget (NGN):', totalBudget],
    ['Average Implementation Progress:', `${avgProgress}%`],
    ['Total Linked Indicator Measurements:', measurements.length],
    [''],
    ['BREAKDOWN BY HCD STRATEGIC PILLAR', 'Total Activities', 'Total Beneficiaries', 'Total Budget (NGN)'],
  ];

  pillars.forEach((p) => {
    const stats = pillarCounts[p.pillar_code] || { count: 0, beneficiaries: 0, budget: 0 };
    summaryRows.push([p.display_name, stats.count, stats.beneficiaries, stats.budget]);
  });

  summaryRows.push(['']);
  summaryRows.push(['BREAKDOWN BY ACTIVITY WORKFLOW STATUS', 'Total Count']);
  Object.entries(statusCounts).forEach(([status, count]) => {
    summaryRows.push([status, count]);
  });

  summaryRows.push(['']);
  summaryRows.push(['STRATEGIC INDICATOR REPORTING COVERAGE (34-INDICATOR CATALOGUE)', '']);
  summaryRows.push(['Total Active Indicators in Catalogue Scope:', activeIndicatorsCount]);
  summaryRows.push(['Indicators with Reported Field Data:', reportedIndicatorsCount]);
  summaryRows.push(['Indicators without Reported Measurements:', unreportedIndicatorsCount]);
  summaryRows.push(['Indicator Catalogue Coverage Rate:', coverageRate]);
  summaryRows.push(['Approved Numerical Targets Architecture:', 'Separate target-management table required for formal numerical targets']);

  if (completenessWarnings.length > 0) {
    summaryRows.push(['']);
    summaryRows.push(['DATA QUALITY & COMPLETENESS WARNINGS', 'Notes / Observations']);
    completenessWarnings.forEach((warn, idx) => {
      summaryRows.push([`Notice #${idx + 1}`, warn]);
    });
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(workbook, wsSummary, 'LGA Summary');

  // --------------------------------------------------------------------------
  // SHEET 2: Indicator Catalogue (Complete 34-Indicator Catalogue Left-Joined)
  // --------------------------------------------------------------------------
  const catalogueHeaders = [
    'Indicator Code',
    'Indicator Name',
    'Reporting Category',
    'Canonical Pillar Code',
    'Pillar Display Name',
    'Segment',
    'Measurement Unit',
    'Reporting Frequency',
    'Definition',
    'Calculation Method',
    'Collection Method',
    'Recommended Source',
    'Required Data Fields',
    'Disaggregation Dimensions',
    'Evidence Required',
    'Scope Reporting Status',
    'Total Measurements in Scope',
    'Approved Numerical Target',
  ];

  const catalogueRows = indicators.map((ind) => {
    const matchingCount = measurements.filter((m) => m.indicator_code === ind.indicator_code).length;
    const hasData = matchingCount > 0;
    return [
      sanitizeSpreadsheetCell(ind.indicator_code),
      sanitizeSpreadsheetCell(ind.indicator_name),
      sanitizeSpreadsheetCell(ind.reporting_category),
      sanitizeSpreadsheetCell(ind.pillar),
      sanitizeSpreadsheetCell(getPillarDisplayName(ind.pillar, pillars)),
      sanitizeSpreadsheetCell(ind.segment || ''),
      sanitizeSpreadsheetCell(ind.measurement_unit),
      sanitizeSpreadsheetCell(ind.reporting_frequency),
      sanitizeSpreadsheetCell(ind.definition),
      sanitizeSpreadsheetCell(ind.calculation_method),
      sanitizeSpreadsheetCell(ind.collection_method),
      sanitizeSpreadsheetCell(ind.recommended_source),
      sanitizeSpreadsheetCell(ind.required_data_fields?.join(', ') || ''),
      sanitizeSpreadsheetCell(ind.disaggregation_dimensions?.join(', ') || ''),
      sanitizeSpreadsheetCell(ind.evidence_required?.join(', ') || ''),
      hasData ? 'Data reported' : 'No data reported',
      matchingCount,
      'Target Management Table Required (Pending Schema Approval)',
    ];
  });

  const wsCatalogue = XLSX.utils.aoa_to_sheet([catalogueHeaders, ...catalogueRows]);
  XLSX.utils.book_append_sheet(workbook, wsCatalogue, 'Indicator Catalogue');

  // --------------------------------------------------------------------------
  // SHEET 2: Complete Activity Register
  // --------------------------------------------------------------------------
  const activityHeaders = [
    'Activity ID',
    'LGA ID',
    'LGA Name',
    'Title',
    'Canonical Pillar Code',
    'Pillar Display Name',
    'Category',
    'Pillar Segment',
    'Project Description',
    'Community / Ward',
    'Latitude',
    'Longitude',
    'Total Beneficiaries',
    'Male Beneficiaries',
    'Female Beneficiaries',
    'Youth Beneficiaries',
    'Budget (NGN)',
    'Start Date',
    'Completion Date',
    'Lead Officer',
    'Officer Contact',
    'Status',
    'Overall Progress (%)',
    'Milestones Count',
    'Media Assets Count',
    'Attendance Registry URL',
    'Attendance Sheet Filename',
    'Submission Notes',
    'Rejection Reason',
    'Reviewed By',
    'Reviewed At',
    'Created At',
    'Updated At',
    'Created By User ID',
    'Updated By User ID',
  ];

  const activityRows = activities.map((a) => [
    sanitizeSpreadsheetCell(a.id),
    sanitizeSpreadsheetCell(a.lgaId),
    sanitizeSpreadsheetCell(a.lgaName),
    sanitizeSpreadsheetCell(a.title),
    sanitizeSpreadsheetCell(a.pillar),
    sanitizeSpreadsheetCell(getPillarDisplayName(a.pillar, pillars)),
    sanitizeSpreadsheetCell(a.category || ''),
    sanitizeSpreadsheetCell(a.pillarSegment || ''),
    sanitizeSpreadsheetCell(a.projectDescription || ''),
    sanitizeSpreadsheetCell(a.community || ''),
    a.coordinates?.lat !== undefined ? a.coordinates.lat : '',
    a.coordinates?.lng !== undefined ? a.coordinates.lng : '',
    a.beneficiariesTotal || 0,
    a.beneficiariesMale || 0,
    a.beneficiariesFemale || 0,
    a.youthBeneficiaries || 0,
    a.budgetNgn || 0,
    sanitizeSpreadsheetCell(a.startDate || ''),
    sanitizeSpreadsheetCell(a.completionDate || ''),
    sanitizeSpreadsheetCell(a.leadOfficer || ''),
    sanitizeSpreadsheetCell(a.officerContact || ''),
    sanitizeSpreadsheetCell(a.status),
    a.overallProgress || 0,
    Array.isArray(a.milestones) ? a.milestones.length : 0,
    Array.isArray(a.mediaAssets) ? a.mediaAssets.length : 0,
    sanitizeSpreadsheetCell(a.attendanceRegistryUrl || ''),
    sanitizeSpreadsheetCell(a.attendanceSheetFileName || ''),
    sanitizeSpreadsheetCell(a.submissionNotes || ''),
    sanitizeSpreadsheetCell(a.rejectionReason || ''),
    sanitizeSpreadsheetCell(a.reviewedBy || ''),
    sanitizeSpreadsheetCell(a.reviewedAt || ''),
    sanitizeSpreadsheetCell(a.createdAt || ''),
    sanitizeSpreadsheetCell(a.updatedAt || ''),
    sanitizeSpreadsheetCell(a.createdBy || ''),
    sanitizeSpreadsheetCell(a.updatedBy || ''),
  ]);

  const wsActivities = XLSX.utils.aoa_to_sheet([activityHeaders, ...activityRows]);
  XLSX.utils.book_append_sheet(workbook, wsActivities, 'Complete Activity Register');

  // --------------------------------------------------------------------------
  // SHEET 3: Indicator Measurements
  // --------------------------------------------------------------------------
  const measurementHeaders = [
    'Measurement ID',
    'Activity ID',
    'Activity Title',
    'LGA Name',
    'Indicator Code',
    'Indicator Name',
    'Reporting Category',
    'Pillar',
    'Segment',
    'Measurement Unit',
    'Period Start',
    'Period End',
    'Value (Numeric)',
    'Value (Text)',
    'Numerator',
    'Denominator',
    'Disaggregation (JSON)',
    'Data Source',
    'Evidence Reference',
    'Notes',
    'Entered By User ID',
    'Created At',
    'Updated At',
  ];

  const activityTitleMap = new Map<string, { title: string; lgaName: string }>();
  activities.forEach((a) => activityTitleMap.set(a.id, { title: a.title, lgaName: a.lgaName }));

  const measurementRows = measurements.map((m) => {
    const parent = activityTitleMap.get(m.activity_id) || { title: 'Unknown Activity', lgaName: '' };
    const ind = indicatorMap.get(m.indicator_code);

    return [
      sanitizeSpreadsheetCell(m.id || ''),
      sanitizeSpreadsheetCell(m.activity_id),
      sanitizeSpreadsheetCell(parent.title),
      sanitizeSpreadsheetCell(parent.lgaName),
      sanitizeSpreadsheetCell(m.indicator_code),
      sanitizeSpreadsheetCell(ind?.indicator_name || m.indicator_code),
      sanitizeSpreadsheetCell(ind?.reporting_category || ''),
      sanitizeSpreadsheetCell(ind?.pillar ? getPillarDisplayName(ind.pillar, pillars) : ''),
      sanitizeSpreadsheetCell(ind?.segment || ''),
      sanitizeSpreadsheetCell(ind?.measurement_unit || ''),
      sanitizeSpreadsheetCell(m.reporting_period_start || ''),
      sanitizeSpreadsheetCell(m.reporting_period_end || ''),
      m.value_numeric !== null && m.value_numeric !== undefined ? m.value_numeric : '',
      sanitizeSpreadsheetCell(m.value_text || ''),
      m.numerator !== null && m.numerator !== undefined ? m.numerator : '',
      m.denominator !== null && m.denominator !== undefined ? m.denominator : '',
      sanitizeSpreadsheetCell(
        m.disaggregation ? JSON.stringify(m.disaggregation) : '{}'
      ),
      sanitizeSpreadsheetCell(m.data_source || ''),
      sanitizeSpreadsheetCell(m.evidence_reference || ''),
      sanitizeSpreadsheetCell(m.notes || ''),
      sanitizeSpreadsheetCell(m.entered_by || ''),
      sanitizeSpreadsheetCell(m.created_at || ''),
      sanitizeSpreadsheetCell(m.updated_at || ''),
    ];
  });

  const wsMeasurements = XLSX.utils.aoa_to_sheet([measurementHeaders, ...measurementRows]);
  XLSX.utils.book_append_sheet(workbook, wsMeasurements, 'Indicator Measurements');

  // --------------------------------------------------------------------------
  // SHEET 4: Beneficiary & Disaggregation Details
  // --------------------------------------------------------------------------
  const beneficiaryHeaders = [
    'Record Scope',
    'Activity ID',
    'Activity Title',
    'LGA Name',
    'Community / Ward',
    'Total Beneficiaries (Activity-Level)',
    'Male (Activity-Level)',
    'Female (Activity-Level)',
    'Youth (Activity-Level)',
    'Linked Measurement ID',
    'Indicator Code',
    'Disaggregation Dimension',
    'Disaggregation Value / Category',
    'Disaggregated Metric Value',
    'Notes / Prevent Double-Counting Notice',
  ];

  const beneficiaryRows: any[][] = [];

  // 1. Activity-level baseline totals
  activities.forEach((a) => {
    beneficiaryRows.push([
      'ACTIVITY_LEVEL_TOTAL',
      sanitizeSpreadsheetCell(a.id),
      sanitizeSpreadsheetCell(a.title),
      sanitizeSpreadsheetCell(a.lgaName),
      sanitizeSpreadsheetCell(a.community || ''),
      a.beneficiariesTotal || 0,
      a.beneficiariesMale || 0,
      a.beneficiariesFemale || 0,
      a.youthBeneficiaries || 0,
      '',
      '',
      'OVERALL_TOTALS',
      'Male + Female Exact Sum',
      a.beneficiariesTotal || 0,
      'Activity-level official beneficiary headcount',
    ]);
  });

  // 2. Measurement-level disaggregation rows
  measurements.forEach((m) => {
    const parent = activityTitleMap.get(m.activity_id) || { title: 'Unknown Activity', lgaName: '' };
    if (m.disaggregation && typeof m.disaggregation === 'object') {
      Object.entries(m.disaggregation).forEach(([dimKey, dimVal]) => {
        beneficiaryRows.push([
          'MEASUREMENT_DISAGGREGATION',
          sanitizeSpreadsheetCell(m.activity_id),
          sanitizeSpreadsheetCell(parent.title),
          sanitizeSpreadsheetCell(parent.lgaName),
          '',
          '',
          '',
          '',
          '',
          sanitizeSpreadsheetCell(m.id || ''),
          sanitizeSpreadsheetCell(m.indicator_code),
          sanitizeSpreadsheetCell(dimKey),
          sanitizeSpreadsheetCell(String(dimVal)),
          m.value_numeric !== null && m.value_numeric !== undefined ? m.value_numeric : '',
          'Sub-indicator disaggregation dimension; DO NOT sum into Activity-Level Total',
        ]);
      });
    }
  });

  const wsBeneficiary = XLSX.utils.aoa_to_sheet([beneficiaryHeaders, ...beneficiaryRows]);
  XLSX.utils.book_append_sheet(workbook, wsBeneficiary, 'Beneficiary & Disaggregation');

  // --------------------------------------------------------------------------
  // SHEET 5: Milestones and Progress
  // --------------------------------------------------------------------------
  const milestoneHeaders = [
    'Activity ID',
    'Activity Title',
    'LGA Name',
    'Milestone ID',
    'Phase Number',
    'Milestone Title',
    'Target Date',
    'Completed Date',
    'Status',
    'Completion (%)',
    'Parent Overall Progress (%)',
    'Raw Milestone JSON Format',
  ];

  const milestoneRows: any[][] = [];
  activities.forEach((a) => {
    if (Array.isArray(a.milestones) && a.milestones.length > 0) {
      a.milestones.forEach((m) => {
        milestoneRows.push([
          sanitizeSpreadsheetCell(a.id),
          sanitizeSpreadsheetCell(a.title),
          sanitizeSpreadsheetCell(a.lgaName),
          sanitizeSpreadsheetCell(m.id || ''),
          m.phaseNumber || '',
          sanitizeSpreadsheetCell(m.title || ''),
          sanitizeSpreadsheetCell(m.targetDate || ''),
          sanitizeSpreadsheetCell(m.completedDate || ''),
          sanitizeSpreadsheetCell(m.status || ''),
          m.completionPercentage !== undefined ? m.completionPercentage : '',
          a.overallProgress || 0,
          sanitizeSpreadsheetCell(JSON.stringify(m)),
        ]);
      });
    }
  });

  const wsMilestones = XLSX.utils.aoa_to_sheet([milestoneHeaders, ...milestoneRows]);
  XLSX.utils.book_append_sheet(workbook, wsMilestones, 'Milestones & Progress');

  // --------------------------------------------------------------------------
  // SHEET 6: Evidence and Supporting References
  // --------------------------------------------------------------------------
  const evidenceHeaders = [
    'Activity ID',
    'Activity Title',
    'LGA Name',
    'Evidence Category',
    'Asset ID',
    'Asset Type',
    'Storage Path',
    'Resource URL / Link',
    'Original Filename',
    'File Size',
    'Caption / Details',
    'EXIF Verified',
    'Coordinates (Lat, Lng)',
    'Upload Timestamp',
  ];

  const evidenceRows: any[][] = [];
  activities.forEach((a) => {
    // Physical attendance sheet scans
    if (a.attendanceRegistryUrl || a.attendanceSheetFileName) {
      evidenceRows.push([
        sanitizeSpreadsheetCell(a.id),
        sanitizeSpreadsheetCell(a.title),
        sanitizeSpreadsheetCell(a.lgaName),
        'Physical Attendance Registry Scan',
        'ATT-DOC',
        'document/pdf',
        sanitizeSpreadsheetCell(a.attendanceRegistryUrl || ''),
        sanitizeSpreadsheetCell(a.attendanceRegistryUrl || ''),
        sanitizeSpreadsheetCell(a.attendanceSheetFileName || 'Registry_Document.pdf'),
        '',
        'Sign-in roster of grassroots participants',
        'N/A',
        a.coordinates ? `${a.coordinates.lat}, ${a.coordinates.lng}` : '',
        sanitizeSpreadsheetCell(a.createdAt || ''),
      ]);
    }

    // Media assets array
    if (Array.isArray(a.mediaAssets)) {
      a.mediaAssets.forEach((med) => {
        evidenceRows.push([
          sanitizeSpreadsheetCell(a.id),
          sanitizeSpreadsheetCell(a.title),
          sanitizeSpreadsheetCell(a.lgaName),
          'Project Verification Media',
          sanitizeSpreadsheetCell(med.id || ''),
          sanitizeSpreadsheetCell(med.type || ''),
          sanitizeSpreadsheetCell(med.storagePath || ''),
          sanitizeSpreadsheetCell(med.url || ''),
          sanitizeSpreadsheetCell(med.fileName || ''),
          sanitizeSpreadsheetCell(med.fileSize || ''),
          sanitizeSpreadsheetCell(med.caption || ''),
          med.exifVerified ? 'TRUE' : 'FALSE',
          med.coordinates ? `${med.coordinates.lat}, ${med.coordinates.lng}` : '',
          sanitizeSpreadsheetCell(med.uploadTimestamp || ''),
        ]);
      });
    }
  });

  const wsEvidence = XLSX.utils.aoa_to_sheet([evidenceHeaders, ...evidenceRows]);
  XLSX.utils.book_append_sheet(workbook, wsEvidence, 'Evidence & Supporting References');

  // --------------------------------------------------------------------------
  // SHEET 7: Data Dictionary and Export Metadata
  // --------------------------------------------------------------------------
  const dictionaryHeaders = [
    'Export Sheet',
    'Column Name',
    'Source Database Table',
    'Data Type',
    'Field Semantics & Meaning',
    'Calculation / Derivation Type',
  ];

  const dictionaryRows: any[][] = [
    ['LGA Summary', 'Total Matching Activities', 'public.activities', 'INTEGER', 'Count of activities filtered by LGA, date and pillar', 'Derived summary'],
    ['LGA Summary', 'Total Recorded Beneficiaries', 'public.activities', 'INTEGER', 'Sum of beneficiaries_total across matching activities', 'Sum total (Male + Female)'],
    ['LGA Summary', 'Total Recorded Budget (NGN)', 'public.activities', 'NUMERIC', 'Sum of budget_ngn in Nigerian Naira', 'Sum total'],
    ['Complete Activity Register', 'Activity ID', 'public.activities.id', 'TEXT', 'Primary key formatted as act-{lgaId}-{timestamp}', 'Raw database identifier'],
    ['Complete Activity Register', 'Canonical Pillar Code', 'public.activities.pillar', 'TEXT', 'Canonical strategic pillar code (e.g. education, vocational)', 'Foreign key / catalogue code'],
    ['Complete Activity Register', 'Pillar Display Name', 'public.hcd_pillars.display_name', 'TEXT', 'Human-readable official pillar label', 'Catalogue join lookup'],
    ['Complete Activity Register', 'Category', 'public.activities.category', 'TEXT', 'values_ethics_social_behaviour, cross_cutting_enablers, or NULL', 'Raw database category'],
    ['Complete Activity Register', 'Pillar Segment', 'public.activities.pillar_segment', 'TEXT', 'gender, governance, climate_change, demography_youth_investment', 'Cross-cutting segment'],
    ['Complete Activity Register', 'Project Description', 'public.activities.project_description', 'TEXT', 'Operational activity description', 'Raw input field'],
    ['Complete Activity Register', 'Status', 'public.activities.status', 'TEXT', 'DRAFT, PENDING_APPROVAL, PUBLISHED, or REJECTED_DRAFT', 'Workflow state'],
    ['Indicator Measurements', 'Measurement ID', 'public.activity_measurements.id', 'UUID/TEXT', 'Primary key of indicator measurement record', 'Raw database identifier'],
    ['Indicator Measurements', 'Indicator Code', 'public.hcd_reporting_indicators.indicator_code', 'TEXT', 'Standardized 16-indicator catalogue code', 'Catalogue foreign key'],
    ['Indicator Measurements', 'Value (Numeric)', 'public.activity_measurements.value_numeric', 'NUMERIC', 'Quantitative measurement result for indicator', 'Input measurement'],
    ['Beneficiary & Disaggregation', 'Record Scope', 'Calculated', 'TEXT', 'ACTIVITY_LEVEL_TOTAL vs MEASUREMENT_DISAGGREGATION', 'Double-counting guardrail'],
    ['Milestones & Progress', 'Milestone ID', 'public.activities.milestones[].id', 'JSONB/TEXT', 'Sub-task milestone unique identifier', 'Embedded milestone'],
    ['Evidence & References', 'Storage Path', 'public.activities.media_assets[].storagePath', 'TEXT', 'Relative path in private Supabase bucket hcd-evidence-vault', 'Storage object pointer'],
  ];

  const wsDictionary = XLSX.utils.aoa_to_sheet([dictionaryHeaders, ...dictionaryRows]);
  XLSX.utils.book_append_sheet(workbook, wsDictionary, 'Data Dictionary & Metadata');

  // Trigger download
  const dateStr = generatedAt.split('T')[0];
  const lgaTag = filters.lgaName ? filters.lgaName.replace(/\s+/g, '_') : 'Statewide';
  const fileName = `AKS_HCD_LGA_Report_${lgaTag}_${dateStr}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};

/**
 * Builds a professional, print-ready PDF document and initiates download
 */
export const exportLgaPdfReport = (payload: ExportDataPayload): void => {
  const {
    activities,
    measurements,
    indicators,
    pillars,
    filters,
    generatedAt,
    completenessWarnings,
  } = payload;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const totalBeneficiaries = activities.reduce((sum, a) => sum + (a.beneficiariesTotal || 0), 0);
  const totalMale = activities.reduce((sum, a) => sum + (a.beneficiariesMale || 0), 0);
  const totalFemale = activities.reduce((sum, a) => sum + (a.beneficiariesFemale || 0), 0);
  const totalYouth = activities.reduce((sum, a) => sum + (a.youthBeneficiaries || 0), 0);
  const totalBudget = activities.reduce((sum, a) => sum + (a.budgetNgn || 0), 0);
  const avgProgress =
    activities.length > 0
      ? Math.round(
          activities.reduce((sum, a) => sum + (a.overallProgress || 0), 0) / activities.length
        )
      : 0;

  // Header Banner
  doc.setFillColor(11, 70, 25); // Emerald Green #0B4619
  doc.rect(0, 0, 210, 32, 'F');

  // Gold Accent line
  doc.setFillColor(212, 175, 55); // Gold #D4AF37
  doc.rect(0, 32, 210, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('AKWA IBOM STATE GOVERNMENT', 14, 12);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('DIRECTORATE OF HUMAN CAPITAL DEVELOPMENT (ARISE AGENDA)', 14, 18);
  doc.setFontSize(8);
  doc.text('Comprehensive Local Government Area Report & Strategic Indicator Dossier', 14, 25);

  let currentY = 40;

  // Report Context Box
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.rect(14, currentY, 182, 24, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, currentY, 182, 24, 'S');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Target LGA:', 18, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(filters.lgaName || filters.lgaId || 'All 31 Local Government Areas', 45, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('Period Range:', 18, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(`${filters.startDate || 'Commencement'} to ${filters.endDate || 'Latest Recorded'}`, 45, currentY + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('Generated At:', 18, currentY + 18);
  doc.setFont('helvetica', 'normal');
  doc.text(`${generatedAt} (UTC)`, 45, currentY + 18);

  doc.setFont('helvetica', 'bold');
  doc.text('Pillar Filter:', 110, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(filters.pillar ? getPillarDisplayName(filters.pillar, pillars) : 'All Pillars', 135, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('Status Filter:', 110, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(filters.status || 'All Statuses', 135, currentY + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('Total Records:', 110, currentY + 18);
  doc.setFont('helvetica', 'normal');
  doc.text(`${activities.length} activities | ${measurements.length} measurements`, 135, currentY + 18);

  currentY += 30;

  // Section 1: Executive KPI Summary Cards
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 70, 25);
  doc.text('1. EXECUTIVE KEY PERFORMANCE INDICATORS', 14, currentY);
  currentY += 4;

  const kpis = [
    { label: 'Total Activities', value: activities.length.toString() },
    { label: 'Beneficiaries', value: totalBeneficiaries.toLocaleString() },
    { label: 'Male / Female', value: `${totalMale.toLocaleString()} / ${totalFemale.toLocaleString()}` },
    { label: 'Youth Beneficiaries', value: totalYouth.toLocaleString() },
    { label: 'Total Budget (NGN)', value: `₦${totalBudget.toLocaleString()}` },
    { label: 'Avg Implementation', value: `${avgProgress}%` },
  ];

  autoTable(doc, {
    startY: currentY,
    head: [kpis.map((k) => k.label)],
    body: [kpis.map((k) => k.value)],
    theme: 'grid',
    headStyles: { fillColor: [11, 70, 25], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 8, halign: 'center' },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Section 2: Breakdown by Strategic Pillar
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 70, 25);
  doc.text('2. STRATEGIC PILLAR PERFORMANCE DISTRIBUTION', 14, currentY);
  currentY += 4;

  const pillarTableData = pillars.map((p) => {
    const acts = activities.filter((a) => a.pillar === p.pillar_code);
    const ben = acts.reduce((sum, a) => sum + (a.beneficiariesTotal || 0), 0);
    const bud = acts.reduce((sum, a) => sum + (a.budgetNgn || 0), 0);
    return [p.display_name, acts.length.toString(), ben.toLocaleString(), `₦${bud.toLocaleString()}`];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Strategic Pillar', 'Total Activities', 'Total Beneficiaries', 'Recorded Budget (NGN)']],
    body: pillarTableData,
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8 },
    styles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Section 3: Activity Register Table (First 15 or full if fitting)
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 70, 25);
  doc.text('3. COMPREHENSIVE ACTIVITY REGISTER', 14, currentY);
  currentY += 4;

  const activityTableData = activities.map((a) => [
    a.title.length > 25 ? `${a.title.slice(0, 25)}...` : a.title,
    a.lgaName,
    getPillarDisplayName(a.pillar, pillars),
    a.community || '-',
    (a.beneficiariesTotal || 0).toLocaleString(),
    `₦${(a.budgetNgn || 0).toLocaleString()}`,
    `${a.overallProgress || 0}%`,
    a.status,
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Title', 'LGA', 'Pillar', 'Community', 'Beneficiaries', 'Budget', 'Progress', 'Status']],
    body: activityTableData.length > 0 ? activityTableData : [['No activities matching current criteria', '', '', '', '', '', '', '']],
    theme: 'grid',
    headStyles: { fillColor: [11, 70, 25], textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold' },
    styles: { fontSize: 7 },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Section 4: Strategic Indicator Performance & Coverage (Complete Catalogue Left Join)
  if (currentY > 230) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 70, 25);
  doc.text('4. STRATEGIC INDICATOR PERFORMANCE & COVERAGE (34-INDICATOR CATALOGUE)', 14, currentY);
  currentY += 4;

  const indTableData = indicators.map((ind) => {
    const matching = measurements.filter((m) => m.indicator_code === ind.indicator_code);
    if (matching.length === 0) {
      return [
        ind.indicator_code,
        ind.indicator_name.length > 28 ? `${ind.indicator_name.slice(0, 28)}...` : ind.indicator_name,
        ind.reporting_category,
        ind.measurement_unit,
        'No data reported for this LGA and reporting period.',
        'No data reported',
      ];
    }

    const latest = matching[matching.length - 1];
    let valStr = '';
    if (latest.value_numeric !== null && latest.value_numeric !== undefined) {
      valStr = `${latest.value_numeric} ${ind.measurement_unit}`;
    } else if (latest.value_text) {
      valStr = latest.value_text;
    } else {
      valStr = 'Data recorded';
    }

    return [
      ind.indicator_code,
      ind.indicator_name.length > 28 ? `${ind.indicator_name.slice(0, 28)}...` : ind.indicator_name,
      ind.reporting_category,
      ind.measurement_unit,
      valStr,
      'Data reported',
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['Code', 'Indicator Name', 'Category', 'Unit', 'Result / Status', 'Reporting Status']],
    body: indTableData,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 7 },
    styles: { fontSize: 6.5 },
    margin: { left: 14, right: 14 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Completeness Warnings
  if (completenessWarnings.length > 0) {
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9); // Amber-700
    doc.text('DATA COMPLETENESS & QUALITY OBSERVATIONS', 14, currentY);
    currentY += 4;

    completenessWarnings.forEach((warn) => {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`• ${warn}`, 16, currentY);
      currentY += 4;
    });
  }

  // Add Page Numbers to all pages
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // Slate-400
    doc.text(
      `Akwa Ibom State Human Capital Development Portal • Page ${i} of ${pageCount} • Official Government Dossier`,
      14,
      290
    );
  }

  // Download PDF
  const dateStr = generatedAt.split('T')[0];
  const lgaTag = filters.lgaName ? filters.lgaName.replace(/\s+/g, '_') : 'Statewide';
  doc.save(`AKS_HCD_LGA_Report_${lgaTag}_${dateStr}.pdf`);
};

/**
 * Generates and downloads sanitised CSV for Activities
 */
export const exportActivitiesCsv = (payload: ExportDataPayload): void => {
  const { activities, pillars, filters, generatedAt } = payload;

  const headers = [
    'Activity ID',
    'LGA ID',
    'LGA Name',
    'Title',
    'Canonical Pillar Code',
    'Pillar Display Name',
    'Category',
    'Pillar Segment',
    'Project Description',
    'Community',
    'Latitude',
    'Longitude',
    'Beneficiaries Total',
    'Beneficiaries Male',
    'Beneficiaries Female',
    'Youth Beneficiaries',
    'Budget (NGN)',
    'Start Date',
    'Completion Date',
    'Lead Officer',
    'Status',
    'Overall Progress (%)',
    'Created At',
  ];

  const rows = activities.map((a) => [
    `"${String(sanitizeSpreadsheetCell(a.id)).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(a.lgaId)).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(a.lgaName)).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(a.title)).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(a.pillar)).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(getPillarDisplayName(a.pillar, pillars))).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(a.category || '')).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(a.pillarSegment || '')).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(a.projectDescription || '')).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(a.community || '')).replace(/"/g, '""')}"`,
    a.coordinates?.lat !== undefined ? a.coordinates.lat : '',
    a.coordinates?.lng !== undefined ? a.coordinates.lng : '',
    a.beneficiariesTotal || 0,
    a.beneficiariesMale || 0,
    a.beneficiariesFemale || 0,
    a.youthBeneficiaries || 0,
    a.budgetNgn || 0,
    `"${String(sanitizeSpreadsheetCell(a.startDate || '')).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(a.completionDate || '')).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(a.leadOfficer || '')).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(a.status)).replace(/"/g, '""')}"`,
    a.overallProgress || 0,
    `"${String(sanitizeSpreadsheetCell(a.createdAt || '')).replace(/"/g, '""')}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = generatedAt.split('T')[0];
  const lgaTag = filters.lgaName ? filters.lgaName.replace(/\s+/g, '_') : 'Statewide';
  link.setAttribute('download', `AKS_HCD_Activities_${lgaTag}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Generates and downloads sanitised CSV for Indicator Measurements
 */
export const exportMeasurementsCsv = (payload: ExportDataPayload): void => {
  const { measurements, indicators, pillars, filters, generatedAt } = payload;

  const indicatorMap = new Map<string, HCDReportingIndicator>();
  indicators.forEach((i) => indicatorMap.set(i.indicator_code, i));

  const headers = [
    'Measurement ID',
    'Activity ID',
    'Indicator Code',
    'Indicator Name',
    'Pillar',
    'Segment',
    'Period Start',
    'Period End',
    'Numeric Value',
    'Text Value',
    'Measurement Unit',
    'Data Source',
    'Evidence Reference',
    'Entered By',
    'Created At',
  ];

  const rows = measurements.map((m) => {
    const ind = indicatorMap.get(m.indicator_code);
    return [
      `"${String(sanitizeSpreadsheetCell(m.id || '')).replace(/"/g, '""')}"`,
      `"${String(sanitizeSpreadsheetCell(m.activity_id)).replace(/"/g, '""')}"`,
      `"${String(sanitizeSpreadsheetCell(m.indicator_code)).replace(/"/g, '""')}"`,
      `"${String(sanitizeSpreadsheetCell(ind?.indicator_name || m.indicator_code)).replace(/"/g, '""')}"`,
      `"${String(sanitizeSpreadsheetCell(ind?.pillar ? getPillarDisplayName(ind.pillar, pillars) : '')).replace(/"/g, '""')}"`,
      `"${String(sanitizeSpreadsheetCell(ind?.segment || '')).replace(/"/g, '""')}"`,
      `"${String(sanitizeSpreadsheetCell(m.reporting_period_start || '')).replace(/"/g, '""')}"`,
      `"${String(sanitizeSpreadsheetCell(m.reporting_period_end || '')).replace(/"/g, '""')}"`,
      m.value_numeric !== null && m.value_numeric !== undefined ? m.value_numeric : '',
      `"${String(sanitizeSpreadsheetCell(m.value_text || '')).replace(/"/g, '""')}"`,
      `"${String(sanitizeSpreadsheetCell(ind?.measurement_unit || '')).replace(/"/g, '""')}"`,
      `"${String(sanitizeSpreadsheetCell(m.data_source || '')).replace(/"/g, '""')}"`,
      `"${String(sanitizeSpreadsheetCell(m.evidence_reference || '')).replace(/"/g, '""')}"`,
      `"${String(sanitizeSpreadsheetCell(m.entered_by || '')).replace(/"/g, '""')}"`,
      `"${String(sanitizeSpreadsheetCell(m.created_at || '')).replace(/"/g, '""')}"`,
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = generatedAt.split('T')[0];
  const lgaTag = filters.lgaName ? filters.lgaName.replace(/\s+/g, '_') : 'Statewide';
  link.setAttribute('download', `AKS_HCD_Measurements_${lgaTag}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Exports target-versus-actual performance dataset to sanitized CSV
 */
export const exportTargetPerformanceCsv = (
  performanceRows: HCDLgaTargetPerformance[],
  pillars: HCDPillar[],
  lgaTag: string = 'Statewide'
): void => {
  const headers = [
    'Indicator Code',
    'Indicator Name',
    'Reporting Category',
    'Pillar',
    'LGA ID',
    'LGA Name',
    'Reporting Year',
    'Period Start',
    'Period End',
    'Baseline Year',
    'Baseline Value',
    'Target Value',
    'Target Direction',
    'Target Metric Type',
    'Measurement Unit',
    'Actual Value',
    'Achievement Rate (%)',
    'Achievement Status',
    'Activity Count',
    'Measurement Count',
    'Target Status',
    'Approved By',
    'Approved At',
    'Source Reference',
    'Target Notes',
    'Last Updated',
  ];

  const rows = performanceRows.map((r) => [
    `"${String(sanitizeSpreadsheetCell(r.indicator_code)).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(r.indicator_name || '')).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(r.reporting_category || '')).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(r.pillar ? getPillarDisplayName(r.pillar, pillars) : '')).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(r.lga_id)).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(r.lga_name || '')).replace(/"/g, '""')}"`,
    r.reporting_year,
    `"${String(sanitizeSpreadsheetCell(r.period_start || '')).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(r.period_end || '')).replace(/"/g, '""')}"`,
    r.baseline_year !== null && r.baseline_year !== undefined ? r.baseline_year : '',
    r.baseline_value !== null && r.baseline_value !== undefined ? r.baseline_value : '',
    r.target_value,
    `"${String(sanitizeSpreadsheetCell(r.target_direction || '')).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(r.target_metric_type || '')).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(r.measurement_unit || '')).replace(/"/g, '""')}"`,
    r.actual_value !== null && r.actual_value !== undefined ? r.actual_value : '',
    r.achievement_rate !== null && r.achievement_rate !== undefined ? r.achievement_rate : '',
    `"${String(sanitizeSpreadsheetCell(r.achievement_status || '')).replace(/"/g, '""')}"`,
    r.activity_count || 0,
    r.measurement_count || 0,
    `"${String(sanitizeSpreadsheetCell(r.target_status || '')).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(r.approved_by || '')).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(r.approved_at || '')).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(r.source_reference || '')).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(r.target_notes || '')).replace(/"/g, '""')}"`,
    `"${String(sanitizeSpreadsheetCell(r.updated_at || '')).replace(/"/g, '""')}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `AKS_HCD_Target_Performance_${lgaTag}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
