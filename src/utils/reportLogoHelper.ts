import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  HCDActivity,
  ActivityMeasurement,
  HCDReportingIndicator,
  HCDPillar,
  HCDLgaTargetPerformance,
  StateHCDActivity,
  StateHCDActivityActionItem,
  StateHCDPublicActionItem,
  STATE_CATEGORY_LABELS,
  STATE_STATUS_LABELS,
  ACTION_ITEM_STATUS_LABELS,
} from '../types';
import { getPillarDisplayName } from './pillarUtils';

export const OFFICIAL_HCD_LOGO_PATH = '/assets/aistudio/IMG-20261013-WA0049_58348b43.jpg';
export const OFFICIAL_ARISE_LOGO_PATH = '/assets/aistudio/images__2__a39b6d2f.jpeg';

let cachedHcdLogoDataUrl: string | null = null;
let cachedAriseLogoDataUrl: string | null = null;

/**
 * Generates a high-contrast fallback seal on a canvas if image network loading is unavailable.
 */
function createFallbackLogoDataUrl(label: string, primaryHex = '#0B4619', accentHex = '#D4AF37'): string {
  if (typeof document === 'undefined') return '';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(80, 80, 76, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(80, 80, 72, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = primaryHex;
    ctx.beginPath();
    ctx.arc(80, 80, 62, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 80, 72);

    ctx.fillStyle = accentHex;
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('AKWA IBOM', 80, 102);

    return canvas.toDataURL('image/jpeg', 0.92);
  } catch {
    return '';
  }
}

/**
 * Loads an image URL from public assets and converts it to a JPEG Base64 Data URL for jsPDF / offline embedding.
 */
async function loadAssetAsJpegDataUrl(url: string, fallbackLabel: string): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return '';
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const targetW = Math.min(img.naturalWidth || 240, 320);
        const targetH = Math.min(img.naturalHeight || 240, 320);
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(createFallbackLogoDataUrl(fallbackLabel));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch {
        resolve(createFallbackLogoDataUrl(fallbackLabel));
      }
    };
    img.onerror = () => {
      resolve(createFallbackLogoDataUrl(fallbackLabel));
    };
    img.src = url;
  });
}

export async function getSiteLogoDataUrl(): Promise<string> {
  if (cachedHcdLogoDataUrl) return cachedHcdLogoDataUrl;
  cachedHcdLogoDataUrl = await loadAssetAsJpegDataUrl(OFFICIAL_HCD_LOGO_PATH, 'AKS-HCD');
  return cachedHcdLogoDataUrl;
}

export async function getAriseLogoDataUrl(): Promise<string> {
  if (cachedAriseLogoDataUrl) return cachedAriseLogoDataUrl;
  cachedAriseLogoDataUrl = await loadAssetAsJpegDataUrl(OFFICIAL_ARISE_LOGO_PATH, 'ARISE');
  return cachedAriseLogoDataUrl;
}

// Preload logos eagerly in browser environment so PDF exports are instantaneous
if (typeof window !== 'undefined') {
  setTimeout(() => {
    void getSiteLogoDataUrl();
    void getAriseLogoDataUrl();
  }, 100);
}

export interface PdfHeaderOptions {
  documentType?: string;
  title: string;
  subtitle?: string;
  rightMetaTop?: string;
  rightMetaBottom?: string;
  orientation?: 'portrait' | 'landscape';
}

/**
 * Draws the official AKS-HCD Portal Header Banner with embedded site logos (HcdLogo + AriseLogo)
 * onto the current page of a jsPDF instance. Returns the Y coordinate below the banner.
 */
export async function drawPdfOfficialHeader(doc: jsPDF, options: PdfHeaderOptions): Promise<number> {
  const [hcdLogo, ariseLogo] = await Promise.all([getSiteLogoDataUrl(), getAriseLogoDataUrl()]);
  const pageWidth = doc.internal.pageSize.getWidth();

  // Primary Emerald Banner (#0B4619)
  doc.setFillColor(11, 70, 25);
  doc.rect(0, 0, pageWidth, 34, 'F');

  // Gold Accent Bar (#D4AF37)
  doc.setFillColor(212, 175, 55);
  doc.rect(0, 34, pageWidth, 2.2, 'F');

  // Left: Official AKS-HCD Site Logo inside white badge frame
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(12, 5, 24, 24, 2.5, 2.5, 'F');
  if (hcdLogo) {
    try {
      doc.addImage(hcdLogo, 'JPEG', 13, 6, 22, 22);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(11, 70, 25);
      doc.text('AKS-HCD', 15, 18);
    }
  }

  const textStartX = 40;

  // Header Text Hierarchy
  doc.setTextColor(212, 175, 55);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(
    options.documentType || 'AKWA IBOM STATE GOVERNMENT • HUMAN CAPITAL DEVELOPMENT COUNCIL',
    textStartX,
    10.5
  );

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  const maxTitleWidth = pageWidth - textStartX - 56;
  const titleLines = doc.splitTextToSize(options.title, maxTitleWidth);
  doc.text(titleLines[0] || options.title, textStartX, 18.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(209, 250, 229);
  if (options.subtitle) {
    const subLines = doc.splitTextToSize(options.subtitle, maxTitleWidth);
    doc.text(subLines[0] || options.subtitle, textStartX, 25.2);
  }

  doc.setFontSize(7);
  doc.setTextColor(253, 230, 138);
  doc.text('AKS-HCD STRATEGIC MONITORING & EVALUATION PORTAL • ARISE AGENDA', textStartX, 31);

  // Right Side: ARISE Logo + Metadata
  if (ariseLogo) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(pageWidth - 28, 5, 16, 16, 2, 2, 'F');
      doc.addImage(ariseLogo, 'JPEG', pageWidth - 27, 6, 14, 14);
    } catch {
      // ignore
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  if (options.rightMetaTop) {
    doc.text(options.rightMetaTop, pageWidth - 31, 13, { align: 'right' });
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(209, 250, 229);
  if (options.rightMetaBottom) {
    doc.text(options.rightMetaBottom, pageWidth - 12, 28, { align: 'right' });
  } else {
    doc.text(`Generated: ${new Date().toLocaleDateString('en-NG')}`, pageWidth - 12, 28, { align: 'right' });
  }

  return 42;
}

/**
 * Stamps official footers (including mini site logo emblem) on every page of a jsPDF document.
 */
export async function stampPdfOfficialFooters(
  doc: jsPDF,
  footerLabel = 'Akwa Ibom State Human Capital Development Portal • Official Government Dossier'
): Promise<void> {
  const hcdLogo = await getSiteLogoDataUrl();
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Subtle divider line above footer
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 13, pageWidth - 14, pageHeight - 13);

    // Mini embedded site logo in footer
    if (hcdLogo) {
      try {
        doc.addImage(hcdLogo, 'JPEG', 14, pageHeight - 11.5, 6.5, 6.5);
      } catch {
        // ignore
      }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(11, 70, 25);
    doc.text('AKS-HCD PORTAL', 22, pageHeight - 7.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(`•  ${footerLabel}`, 45, pageHeight - 7.5);

    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 7.5, {
      align: 'right',
    });
  }
}

/**
 * Generates an official, logo-embedded PDF Dossier for a single LGA HCDActivity.
 */
export async function exportSingleActivityPdfDossier(
  activity: HCDActivity,
  options?: {
    measurements?: ActivityMeasurement[];
    indicators?: HCDReportingIndicator[];
    pillars?: HCDPillar[];
  }
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pillarName = getPillarDisplayName(activity.pillar, options?.pillars);

  let yPos = await drawPdfOfficialHeader(doc, {
    documentType: 'AKWA IBOM STATE HCD COUNCIL • FIELD INTERVENTION DOSSIER',
    title: activity.title,
    subtitle: `${activity.lgaName} LGA  |  ${pillarName}  |  Status: ${activity.status.replace(/_/g, ' ')}`,
    rightMetaTop: `ID: ${activity.id.slice(0, 14)}`,
    rightMetaBottom: `Exported: ${new Date().toLocaleDateString('en-NG')}`,
  });

  const kpiCards = [
    { label: 'LGA JURISDICTION', value: `${activity.lgaName} LGA` },
    { label: 'CAPITAL ALLOCATION', value: `NGN ${(activity.budgetNgn || 0).toLocaleString()}` },
    { label: 'TOTAL BENEFICIARIES', value: `${(activity.beneficiariesTotal || 0).toLocaleString()} Citizens` },
    { label: 'COMPLETION PROGRESS', value: `${activity.overallProgress ?? 0}% Verified` },
  ];

  kpiCards.forEach((card, idx) => {
    const x = 14 + idx * 46;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, yPos, 43.5, 17, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, x + 3, yPos + 5.5);

    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    const lines = doc.splitTextToSize(card.value, 38);
    doc.text(lines[0] || card.value, x + 3, yPos + 12.5);
  });

  yPos += 23;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(11, 70, 25);
  doc.text('1. Intervention Narrative & Location Specification', 14, yPos);
  yPos += 3.5;

  autoTable(doc, {
    startY: yPos,
    body: [
      ['Project Title', activity.title],
      ['Strategic Pillar', `${pillarName}${activity.category ? ` (${activity.category})` : ''}`],
      ['Community / Ward / Site', `${activity.community || '—'} (${activity.lgaName} LGA)`],
      [
        'GPS Coordinates',
        activity.coordinates
          ? `${activity.coordinates.lat.toFixed(5)}° N, ${activity.coordinates.lng.toFixed(5)}° E`
          : 'Not Recorded',
      ],
      [
        'Implementation Period',
        `${activity.startDate || 'N/A'} to ${activity.completionDate || 'Ongoing'}`,
      ],
      [
        'Beneficiary Disaggregation',
        `Total: ${(activity.beneficiariesTotal || 0).toLocaleString()}  |  Male: ${(activity.beneficiariesMale || 0).toLocaleString()}  |  Female: ${(activity.beneficiariesFemale || 0).toLocaleString()}  |  Youth: ${(activity.youthBeneficiaries || 0).toLocaleString()}`,
      ],
      ['Lead Desk Officer', `${activity.leadOfficer || 'LGA Desk'} (${activity.officerContact || 'Official Desk'})`],
      ['Attendance Registry', activity.attendanceSheetFileName || (activity.attendanceRegistryUrl ? 'Attached in Vault' : 'Not Uploaded')],
      ['Project Description', activity.projectDescription || activity.subCategory || 'No description provided.'],
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 48 },
      1: { cellWidth: 134 },
    },
    margin: { left: 14, right: 14 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Section 2: Implementation Milestones
  if (activity.milestones && activity.milestones.length > 0) {
    if (yPos > 235) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(11, 70, 25);
    doc.text('2. Implementation Milestones & Deliverables', 14, yPos);
    yPos += 3;

    autoTable(doc, {
      startY: yPos,
      head: [['Phase', 'Milestone Title', 'Deliverable', 'Target Date', 'Progress', 'Status']],
      body: activity.milestones.map((m) => [
        `Phase ${m.phaseNumber}`,
        m.title,
        m.keyDeliverable || m.description || '—',
        m.targetDate || '—',
        `${m.completionPercentage}%`,
        m.status,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [11, 70, 25], textColor: 255, fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5 },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;
  }

  // Section 3: Indicator Measurements (if any)
  const measurements = options?.measurements || [];
  if (measurements.length > 0) {
    if (yPos > 235) {
      doc.addPage();
      yPos = 20;
    }
    const indicatorMap = new Map(
      (options?.indicators || []).map((ind) => [ind.indicator_code, ind])
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(11, 70, 25);
    doc.text('3. HCD Indicator Measurements & Empirical Outcomes', 14, yPos);
    yPos += 3;

    autoTable(doc, {
      startY: yPos,
      head: [['Indicator', 'Reporting Period', 'Recorded Value', 'Data Source / Notes']],
      body: measurements.map((m) => {
        const ind = indicatorMap.get(m.indicator_code);
        const val =
          m.value_numeric !== null && m.value_numeric !== undefined
            ? `${m.value_numeric.toLocaleString()} ${ind?.measurement_unit || ''}`.trim()
            : m.value_text || '—';
        return [
          ind ? `${ind.indicator_code} — ${ind.indicator_name}` : m.indicator_code,
          `${m.reporting_period_start || ''} to ${m.reporting_period_end || ''}`,
          val,
          [m.data_source, m.notes].filter(Boolean).join(' — ') || '—',
        ];
      }),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5 },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;
  }

  // Section 4: Verification Evidence Manifest
  if (activity.mediaAssets && activity.mediaAssets.length > 0) {
    if (yPos > 235) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(11, 70, 25);
    doc.text('4. Photographic & Documentary Verification Assets', 14, yPos);
    yPos += 3;

    autoTable(doc, {
      startY: yPos,
      head: [['Filename / Caption', 'Type', 'Geotag Provenance', 'Coordinates']],
      body: activity.mediaAssets.map((item, idx) => [
        item.fileName || item.caption || `Evidence Asset #${idx + 1}`,
        (item.type || 'photo').toUpperCase(),
        item.exifVerified
          ? 'EXIF GPS Verified'
          : item.coordinateSource === 'manual_entry'
          ? 'Manual Geotag'
          : item.coordinateSource === 'activity_location'
          ? 'Activity Site Coords'
          : 'Unverified',
        item.coordinates
          ? `${item.coordinates.lat.toFixed(4)}°N, ${item.coordinates.lng.toFixed(4)}°E`
          : '—',
      ]),
      theme: 'grid',
      headStyles: { fillColor: [11, 70, 25], textColor: 255, fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5 },
      margin: { left: 14, right: 14 },
    });
  }

  await stampPdfOfficialFooters(
    doc,
    `AKS-HCD Field Intervention Dossier • ${activity.lgaName} LGA`
  );

  const safeTitle = activity.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  doc.save(`AKS_HCD_Dossier_${activity.lgaName.replace(/\s+/g, '_')}_${safeTitle}.pdf`);
}

/**
 * Generates an official, logo-embedded PDF Dossier for a single State-Level HCD Activity.
 */
export async function exportStateActivitySinglePdfDossier(
  activity: StateHCDActivity,
  actionItems: Array<StateHCDActivityActionItem | StateHCDPublicActionItem> = []
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const catLabel = STATE_CATEGORY_LABELS[activity.category] || activity.category;
  const statusLabel = STATE_STATUS_LABELS[activity.status] || activity.status;

  let yPos = await drawPdfOfficialHeader(doc, {
    documentType: 'AKWA IBOM STATE HCD COUNCIL • STATE-LEVEL PROGRAMME DOSSIER',
    title: activity.title,
    subtitle: `${catLabel}  |  Lead: ${activity.lead_institution}  |  Status: ${statusLabel}`,
    rightMetaTop: activity.activity_code,
    rightMetaBottom: `Exported: ${new Date().toLocaleDateString('en-NG')}`,
  });

  autoTable(doc, {
    startY: yPos,
    body: [
      ['Activity Code', activity.activity_code],
      ['Programme Title', activity.title],
      ['Category', catLabel],
      ['Lead Institution & Unit', `${activity.lead_institution}${activity.lead_unit ? ` (${activity.lead_unit})` : ''}`],
      ['Official Venue / Location', activity.location || 'Akwa Ibom State'],
      [
        'Activity Timeline',
        `${activity.activity_date}${activity.activity_end_date ? ` to ${activity.activity_end_date}` : ''}`,
      ],
      ['Publication Status', statusLabel],
      ['Executive Purpose & Mandate', activity.description || '—'],
      ['Key Strategic Outcomes', activity.key_outcomes || '—'],
      ['Decisions & Resolutions', activity.decisions_resolutions || '—'],
    ],
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 3, textColor: [30, 41, 59] },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 50 },
      1: { cellWidth: 132 },
    },
    margin: { left: 14, right: 14 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  if (Array.isArray(activity.participating_stakeholders) && activity.participating_stakeholders.length > 0) {
    if (yPos > 235) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(11, 70, 25);
    doc.text('Participating Stakeholders & Partner Institutions', 14, yPos);
    yPos += 3;

    autoTable(doc, {
      startY: yPos,
      head: [['Organization Name', 'Stakeholder Type', 'Role', 'Notes']],
      body: activity.participating_stakeholders.map((sh) => [
        sh.organization_name,
        sh.stakeholder_type,
        sh.role || '—',
        sh.notes || '—',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [11, 70, 25], textColor: 255, fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5 },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;
  }

  if (actionItems.length > 0) {
    if (yPos > 235) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(11, 70, 25);
    doc.text('Tracked Follow-Up Action Commitments', 14, yPos);
    yPos += 3;

    autoTable(doc, {
      startY: yPos,
      head: [['Action Title', 'Responsible Institution', 'Due Date', 'Status']],
      body: actionItems.map((item) => [
        item.action_title,
        item.responsible_institution,
        item.due_date,
        ACTION_ITEM_STATUS_LABELS[item.status] || item.status,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5 },
      margin: { left: 14, right: 14 },
    });
  }

  await stampPdfOfficialFooters(
    doc,
    `AKS-HCD State-Level Programme Dossier • ${activity.activity_code}`
  );

  const safeCode = (activity.activity_code || 'STATE').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`AKS_HCD_State_Dossier_${safeCode}.pdf`);
}

/**
 * Generates an official, logo-embedded PDF Executive Briefing for State-Level HCD Activities.
 */
export async function exportStateActivitiesExecutiveBriefingPdf(
  activities: StateHCDActivity[],
  actionItems: StateHCDActivityActionItem[]
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  let yPos = await drawPdfOfficialHeader(doc, {
    documentType: 'AKWA IBOM STATE GOVERNMENT • EXECUTIVE COUNCIL BRIEFING',
    title: 'State-Level HCD Programmes & Action Commitments Register',
    subtitle: `${activities.length} State-Level Activities  |  ${actionItems.length} Follow-Up Action Commitments`,
    rightMetaTop: 'STATEWIDE BRIEFING',
    rightMetaBottom: `Generated: ${new Date().toLocaleDateString('en-NG')}`,
    orientation: 'landscape',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(11, 70, 25);
  doc.text('1. State-Level HCD Activities Register', 14, yPos);
  yPos += 3.5;

  autoTable(doc, {
    startY: yPos,
    head: [
      [
        'Code',
        'Title',
        'Category',
        'Lead MDA',
        'Location',
        'Timeline',
        'Stakeholders',
        'Status',
      ],
    ],
    body:
      activities.length > 0
        ? activities.map((a) => [
            a.activity_code,
            a.title,
            STATE_CATEGORY_LABELS[a.category] || a.category,
            a.lead_institution,
            a.location,
            `${a.activity_date}${a.activity_end_date ? ` – ${a.activity_end_date}` : ''}`,
            String(a.participating_stakeholders?.length || 0),
            STATE_STATUS_LABELS[a.status] || a.status,
          ])
        : [['—', 'No state-level activities recorded', '', '', '', '', '', '']],
    theme: 'grid',
    headStyles: { fillColor: [11, 70, 25], textColor: 255, fontSize: 7.5 },
    bodyStyles: { fontSize: 7 },
    margin: { left: 14, right: 14 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  if (actionItems.length > 0) {
    if (yPos > 165) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(11, 70, 25);
    doc.text('2. State Action Points & Executive Commitments', 14, yPos);
    yPos += 3.5;

    autoTable(doc, {
      startY: yPos,
      head: [['Action Title', 'Responsible Institution', 'Assigned Person', 'Due Date', 'Status']],
      body: actionItems.map((item) => [
        item.action_title,
        item.responsible_institution,
        item.responsible_person || '—',
        item.due_date,
        ACTION_ITEM_STATUS_LABELS[item.status] || item.status,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.5 },
      bodyStyles: { fontSize: 7 },
      margin: { left: 14, right: 14 },
    });
  }

  await stampPdfOfficialFooters(
    doc,
    'AKS-HCD State-Level Executive Briefing • Official Council Export'
  );

  const dateStamp = new Date().toISOString().split('T')[0];
  doc.save(`AKS_HCD_State_Executive_Briefing_${dateStamp}.pdf`);
}

export interface PrintableAuditRow {
  id: string;
  timestamp: string;
  actionLabel: string;
  severityLevel: string;
  performedBy: string;
  role: string;
  lgaDisplayName: string;
  activityTitle?: string;
  notes?: string;
}

/**
 * Generates an official, logo-embedded PDF Audit Trail Report for State Administration accountability.
 */
export async function exportAuditTrailPdfReport(
  logs: PrintableAuditRow[],
  filterDescription = 'All Filtered Audit Events'
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  let yPos = await drawPdfOfficialHeader(doc, {
    documentType: 'AKWA IBOM STATE HCD COUNCIL • GOVERNANCE & COMPLIANCE LEDGER',
    title: 'Executive Security & Sensitive Data Change Audit Report',
    subtitle: `${logs.length} Recorded Audit Events  |  Scope: ${filterDescription}`,
    rightMetaTop: 'IMMUTABLE LEDGER',
    rightMetaBottom: `Exported: ${new Date().toLocaleDateString('en-NG')}`,
    orientation: 'landscape',
  });

  autoTable(doc, {
    startY: yPos,
    head: [
      [
        'Timestamp (WAT)',
        'Severity',
        'Action Classification',
        'Actor & Role',
        'Jurisdiction / LGA',
        'Target Record',
        'Detailed Change & Verification Notes',
      ],
    ],
    body: logs.map((entry) => {
      const d = new Date(entry.timestamp);
      const formattedDate = isNaN(d.getTime())
        ? entry.timestamp
        : `${d.toLocaleDateString('en-NG')} ${d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}`;
      return [
        formattedDate,
        entry.severityLevel.toUpperCase(),
        entry.actionLabel,
        `${entry.performedBy} (${entry.role})`,
        entry.lgaDisplayName,
        entry.activityTitle || 'State Administrative Action',
        entry.notes || '—',
      ];
    }),
    theme: 'grid',
    headStyles: { fillColor: [11, 70, 25], textColor: 255, fontSize: 7.5 },
    bodyStyles: { fontSize: 6.8, cellPadding: 2 },
    margin: { left: 14, right: 14 },
  });

  await stampPdfOfficialFooters(
    doc,
    'AKS-HCD Executive Audit Trail Ledger • Official Compliance Export'
  );

  const dateStamp = new Date().toISOString().split('T')[0];
  doc.save(`AKS_HCD_Executive_Audit_Ledger_${dateStamp}.pdf`);
}

/**
 * Generates an official, logo-embedded PDF Executive Matrix Report from the Executive Command Centre.
 */
export async function exportExecutiveMatrixPdfReport(
  activities: HCDActivity[],
  filterLabel = 'All 31 Local Government Areas'
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  let yPos = await drawPdfOfficialHeader(doc, {
    documentType: 'AKWA IBOM STATE HCD COUNCIL • EXECUTIVE COMMAND CENTRE',
    title: 'Statewide LGA Field Interventions & Capital Matrix',
    subtitle: `Scope: ${filterLabel}  |  ${activities.length} Total Interventions`,
    rightMetaTop: 'EXECUTIVE EXPORT',
    rightMetaBottom: `Generated: ${new Date().toLocaleDateString('en-NG')}`,
    orientation: 'landscape',
  });

  autoTable(doc, {
    startY: yPos,
    head: [
      [
        'Project Title',
        'LGA',
        'Strategic Pillar',
        'Community',
        'Status',
        'Progress',
        'Budget (NGN)',
        'Beneficiaries',
        'Lead Officer',
      ],
    ],
    body: activities.map((a) => [
      a.title,
      a.lgaName,
      getPillarDisplayName(a.pillar),
      a.community || '—',
      a.status,
      `${a.overallProgress ?? 0}%`,
      (a.budgetNgn || 0).toLocaleString(),
      (a.beneficiariesTotal || 0).toLocaleString(),
      a.leadOfficer || '—',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [11, 70, 25], textColor: 255, fontSize: 7.5 },
    bodyStyles: { fontSize: 7, cellPadding: 2 },
    margin: { left: 14, right: 14 },
  });

  await stampPdfOfficialFooters(
    doc,
    'AKS-HCD Executive Command Matrix • Official Statewide Record'
  );

  const dateStamp = new Date().toISOString().split('T')[0];
  doc.save(`AKS_HCD_State_Wide_Dataset_${dateStamp}.pdf`);
}

/**
 * Generates an official, logo-embedded PDF Target vs Actual Performance Report.
 */
export async function exportTargetPerformancePdfReport(
  performanceRows: HCDLgaTargetPerformance[],
  pillars: HCDPillar[],
  lgaTag = 'Statewide'
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  let yPos = await drawPdfOfficialHeader(doc, {
    documentType: 'AKWA IBOM STATE HCD COUNCIL • TARGET VS ACTUAL PERFORMANCE',
    title: 'LGA Strategic Indicator Target Performance Dossier',
    subtitle: `Jurisdiction: ${lgaTag.replace(/_/g, ' ')}  |  ${performanceRows.length} Evaluated Target Records`,
    rightMetaTop: 'TARGET PERFORMANCE',
    rightMetaBottom: `Generated: ${new Date().toLocaleDateString('en-NG')}`,
    orientation: 'landscape',
  });

  autoTable(doc, {
    startY: yPos,
    head: [
      [
        'Code',
        'Indicator Name',
        'LGA',
        'Pillar',
        'Year',
        'Baseline',
        'Annual Target',
        'Actual Value',
        'Achievement Rate',
        'Status',
      ],
    ],
    body:
      performanceRows.length > 0
        ? performanceRows.map((r) => [
            r.indicator_code,
            r.indicator_name || r.indicator_code,
            r.lga_name || r.lga_id,
            r.pillar ? getPillarDisplayName(r.pillar, pillars) : '—',
            String(r.reporting_year),
            r.baseline_value !== null && r.baseline_value !== undefined ? String(r.baseline_value) : '—',
            `${r.target_value} ${r.measurement_unit || ''}`.trim(),
            r.actual_value !== null && r.actual_value !== undefined
              ? `${r.actual_value} ${r.measurement_unit || ''}`.trim()
              : 'No data',
            r.achievement_rate !== null && r.achievement_rate !== undefined
              ? `${Number(r.achievement_rate).toFixed(1)}%`
              : '—',
            (r.achievement_status || 'no_data').replace(/_/g, ' ').toUpperCase(),
          ])
        : [['—', 'No target performance records match current filters', '', '', '', '', '', '', '', '']],
    theme: 'grid',
    headStyles: { fillColor: [11, 70, 25], textColor: 255, fontSize: 7.5 },
    bodyStyles: { fontSize: 7, cellPadding: 2 },
    margin: { left: 14, right: 14 },
  });

  await stampPdfOfficialFooters(
    doc,
    `AKS-HCD Target vs Actual Performance Dossier • ${lgaTag.replace(/_/g, ' ')}`
  );

  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`AKS_HCD_Target_Performance_${lgaTag}_${dateStr}.pdf`);
}

/**
 * Generates an official, logo-embedded Batch Verification Dossier PDF for selected LGA activities.
 */
export async function exportBatchActivitiesDossierPdf(
  selectedActivities: HCDActivity[],
  scopeLabel = 'Selected Executive Review Queue Submissions'
): Promise<void> {
  if (!selectedActivities.length) return;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let yPos = await drawPdfOfficialHeader(doc, {
    documentType: 'AKWA IBOM STATE HCD COUNCIL • BATCH VERIFICATION DOSSIER',
    title: `Executive Batch Inspection Dossier (${selectedActivities.length} Interventions)`,
    subtitle: `Scope: ${scopeLabel}`,
    rightMetaTop: 'BATCH DOSSIER',
    rightMetaBottom: `Exported: ${new Date().toLocaleDateString('en-NG')}`,
    orientation: 'portrait',
  });

  const totalBen = selectedActivities.reduce((sum, a) => sum + (a.beneficiariesTotal || 0), 0);
  const totalBudget = selectedActivities.reduce((sum, a) => sum + (a.budgetNgn || 0), 0);

  autoTable(doc, {
    startY: yPos,
    head: [['Batch Metric', 'Aggregated Value']],
    body: [
      ['Total Selected Interventions', `${selectedActivities.length} Records`],
      ['Combined Beneficiaries Reached', `${totalBen.toLocaleString()} Citizens`],
      ['Combined Capital Allocation', `NGN ${totalBudget.toLocaleString()}`],
      [
        'Distinct LGAs Represented',
        `${new Set(selectedActivities.map((a) => a.lgaName)).size} Local Government Areas`,
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [11, 70, 25], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 65 } },
    margin: { left: 14, right: 14 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 7;

  autoTable(doc, {
    startY: yPos,
    head: [
      [
        '#',
        'LGA & Community',
        'Intervention Title & Pillar',
        'Beneficiaries (M / F)',
        'Budget (NGN)',
        'Proofs & Status',
      ],
    ],
    body: selectedActivities.map((act, idx) => [
      String(idx + 1),
      `${act.lgaName}\n(${act.community || '—'})`,
      `${act.title}\n[${getPillarDisplayName(act.pillar)}]`,
      `${act.beneficiariesTotal.toLocaleString()}\n(M:${act.beneficiariesMale} / F:${act.beneficiariesFemale})`,
      (act.budgetNgn || 0).toLocaleString(),
      `${(act.mediaAssets || []).length} asset(s)\n${act.status}`,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.5 },
    bodyStyles: { fontSize: 7, cellPadding: 2.2 },
    margin: { left: 14, right: 14 },
  });

  await stampPdfOfficialFooters(
    doc,
    'AKS-HCD Batch Verification Dossier • Official Executive Review Record'
  );

  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`AKS_HCD_Batch_Dossier_${selectedActivities.length}_Records_${dateStr}.pdf`);
}

/**
 * Generates an official, logo-embedded 1-Click Quarterly ARISE Council Cabinet Brief PDF
 * summarizing statewide KPIs, Pillar Capital & Beneficiary distribution, Top LGAs, and Field Highlights.
 */
export async function exportQuarterlyAriseCouncilBriefPdf(
  activities: HCDActivity[],
  pillars?: HCDPillar[]
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  const quarterLabel = `Q${quarter} ${now.getFullYear()}`;

  let yPos = await drawPdfOfficialHeader(doc, {
    documentType: 'GOVERNOR’S COUNCIL ON HUMAN CAPITAL DEVELOPMENT • CABINET BRIEF',
    title: `Quarterly ARISE Agenda Executive Council Brief (${quarterLabel})`,
    subtitle: 'Statewide Grassroots Impact, Capital Utilization & 31-LGA Compliance Summary',
    rightMetaTop: `CABINET DECK • ${quarterLabel}`,
    rightMetaBottom: `Issued: ${now.toLocaleDateString('en-NG')}`,
    orientation: 'portrait',
  });

  const published = activities.filter((a) => a.status === 'PUBLISHED');
  const pending = activities.filter((a) => a.status === 'PENDING_APPROVAL');
  const totalBen = published.reduce((sum, a) => sum + (a.beneficiariesTotal || 0), 0);
  const totalMale = published.reduce((sum, a) => sum + (a.beneficiariesMale || 0), 0);
  const totalFemale = published.reduce((sum, a) => sum + (a.beneficiariesFemale || 0), 0);
  const totalYouth = published.reduce((sum, a) => sum + (a.youthBeneficiaries || 0), 0);
  const totalBudget = published.reduce((sum, a) => sum + (a.budgetNgn || 0), 0);
  const reportingLgas = new Set(published.map((a) => a.lgaId)).size;

  // Section 1: Executive Statewide KPIs
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(11, 70, 25);
  doc.text('1. STATEWIDE EXECUTIVE SCORECARD (VERIFIED & PUBLISHED)', 14, yPos);
  yPos += 3;

  autoTable(doc, {
    startY: yPos,
    head: [['Strategic Cabinet Indicator', 'Verified Statewide Figure']],
    body: [
      ['Reporting Period', `${quarterLabel} (As of ${now.toLocaleDateString('en-NG')})`],
      ['Published Field Interventions', `${published.length} Verified Projects (${pending.length} Pending Review)`],
      ['Active Reporting Local Government Areas', `${reportingLgas} of 31 LGAs (${Math.round((reportingLgas / 31) * 100)}% Coverage)`],
      [
        'Total Verified Beneficiaries',
        `${totalBen.toLocaleString()} Citizens (Male: ${totalMale.toLocaleString()} | Female: ${totalFemale.toLocaleString()})`,
      ],
      ['Youth Beneficiaries (15–35 yrs)', `${totalYouth.toLocaleString()} Youth Empowered`],
      ['Total Verified Capital Deployed', `NGN ${totalBudget.toLocaleString()}`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [11, 70, 25], textColor: 255, fontSize: 8.5 },
    bodyStyles: { fontSize: 8, cellPadding: 2.2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 72 } },
    margin: { left: 14, right: 14 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 7;

  // Section 2: Strategic Pillar Performance Breakdown
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(11, 70, 25);
  doc.text('2. PERFORMANCE BY STRATEGIC HCD PILLAR', 14, yPos);
  yPos += 3;

  const pillarMap = new Map<
    string,
    { count: number; beneficiaries: number; budget: number; avgProgress: number }
  >();
  for (const act of published) {
    const label = getPillarDisplayName(act.pillar, pillars);
    const curr = pillarMap.get(label) || { count: 0, beneficiaries: 0, budget: 0, avgProgress: 0 };
    curr.count += 1;
    curr.beneficiaries += act.beneficiariesTotal || 0;
    curr.budget += act.budgetNgn || 0;
    curr.avgProgress += act.overallProgress || 0;
    pillarMap.set(label, curr);
  }

  const pillarRows = Array.from(pillarMap.entries()).map(([label, stats]) => [
    label,
    String(stats.count),
    stats.beneficiaries.toLocaleString(),
    `NGN ${stats.budget.toLocaleString()}`,
    `${stats.count > 0 ? Math.round(stats.avgProgress / stats.count) : 0}%`,
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Strategic HCD Pillar', 'Projects', 'Beneficiaries', 'Capital Deployed', 'Avg. Progress']],
    body:
      pillarRows.length > 0
        ? pillarRows
        : [['No published pillar interventions recorded yet', '0', '0', 'NGN 0', '0%']],
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2 },
    margin: { left: 14, right: 14 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 7;

  // Section 3: Top Performing LGAs by Verified Beneficiaries
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(11, 70, 25);
  doc.text('3. TOP PERFORMING LOCAL GOVERNMENT COUNCILS', 14, yPos);
  yPos += 3;

  const lgaStatsMap = new Map<
    string,
    { lgaName: string; count: number; beneficiaries: number; budget: number }
  >();
  for (const act of published) {
    const curr = lgaStatsMap.get(act.lgaId) || {
      lgaName: act.lgaName,
      count: 0,
      beneficiaries: 0,
      budget: 0,
    };
    curr.count += 1;
    curr.beneficiaries += act.beneficiariesTotal || 0;
    curr.budget += act.budgetNgn || 0;
    lgaStatsMap.set(act.lgaId, curr);
  }

  const topLgas = Array.from(lgaStatsMap.values())
    .sort((a, b) => b.beneficiaries - a.beneficiaries)
    .slice(0, 10);

  autoTable(doc, {
    startY: yPos,
    head: [['Rank', 'Local Government Area', 'Verified Projects', 'Total Beneficiaries', 'Capital Utilized (NGN)']],
    body:
      topLgas.length > 0
        ? topLgas.map((item, idx) => [
            `#${idx + 1}`,
            item.lgaName,
            String(item.count),
            item.beneficiaries.toLocaleString(),
            item.budget.toLocaleString(),
          ])
        : [['—', 'No published LGA data available', '0', '0', '0']],
    theme: 'grid',
    headStyles: { fillColor: [11, 70, 25], textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 7.5, cellPadding: 2 },
    margin: { left: 14, right: 14 },
  });

  await stampPdfOfficialFooters(
    doc,
    `AKS-HCD Quarterly ARISE Council Brief (${quarterLabel}) • Official Cabinet Document`
  );

  const dateStr = now.toISOString().split('T')[0];
  doc.save(`AKS_HCD_Quarterly_ARISE_Council_Brief_${quarterLabel.replace(/\s+/g, '_')}_${dateStr}.pdf`);
}

