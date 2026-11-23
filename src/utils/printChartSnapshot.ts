/**
 * Executive Dashboard Print Chart Rasterizer
 * Converts live Recharts SVG charts (including HTML legends) and canvas charts
 * into crisp 2x-DPI static PNG <img> snapshots before window.print() so
 * printed executive briefings & PDFs render charts reliably without clipping.
 */

export interface PreparedPrintCharts {
  capturedCount: number;
  cleanup: () => void;
}

const INLINED_SVG_PROPS = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'letter-spacing',
  'text-anchor',
  'dominant-baseline',
  'visibility',
  'display',
] as const;

function inlineComputedSvgStyles(sourceEl: Element, targetEl: Element): void {
  const computed = window.getComputedStyle(sourceEl);
  const targetHtml = targetEl as SVGElement;

  for (let i = 0; i < INLINED_SVG_PROPS.length; i++) {
    const prop = INLINED_SVG_PROPS[i];
    const val = computed.getPropertyValue(prop);
    if (val && val !== 'normal' && val !== 'none' && val !== 'auto') {
      targetHtml.style.setProperty(prop, val);
    } else if ((prop === 'fill' || prop === 'stroke') && val === 'none') {
      targetHtml.style.setProperty(prop, 'none');
    }
  }

  // Ensure crisp sans/mono fallback fonts inside detached SVG blob
  const fontFamily = computed.getPropertyValue('font-family');
  if (fontFamily) {
    targetHtml.style.setProperty('font-family', fontFamily);
  }

  const sourceChildren = sourceEl.children;
  const targetChildren = targetEl.children;
  const len = Math.min(sourceChildren.length, targetChildren.length);
  for (let i = 0; i < len; i++) {
    inlineComputedSvgStyles(sourceChildren[i], targetChildren[i]);
  }
}

interface LegendEntry {
  label: string;
  color: string;
}

function extractRechartsLegend(wrapper: HTMLElement): LegendEntry[] {
  const legendItems = wrapper.querySelectorAll('.recharts-legend-item');
  if (!legendItems.length) return [];

  const entries: LegendEntry[] = [];
  legendItems.forEach((item) => {
    const textEl = item.querySelector('.recharts-legend-item-text') || item;
    const label = (textEl.textContent || '').trim();
    if (!label) return;

    let color = '#0B4619';
    const swatch = item.querySelector('path, rect, circle, line');
    if (swatch) {
      const style = window.getComputedStyle(swatch);
      const fill = style.fill;
      const stroke = style.stroke;
      if (fill && fill !== 'none' && fill !== 'rgba(0, 0, 0, 0)') {
        color = fill;
      } else if (stroke && stroke !== 'none' && stroke !== 'rgba(0, 0, 0, 0)') {
        color = stroke;
      }
    } else {
      const itemColor = window.getComputedStyle(item).color;
      if (itemColor) color = itemColor;
    }

    entries.push({ label, color });
  });

  return entries;
}

async function rasterizeSvgToPngDataUrl(
  svgEl: SVGSVGElement,
  legendEntries: LegendEntry[] = [],
  scale = 2
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  const rect = svgEl.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));

  if (width < 40 || height < 24) return null;

  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  if (!clone.getAttribute('viewBox')) {
    clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }

  // Inline computed styles so detached SVG preserves typography, axis colors, and lines
  inlineComputedSvgStyles(svgEl, clone);

  // Strip transient hover tooltip cursors / active hover dots from the print snapshot
  clone.querySelectorAll('.recharts-tooltip-cursor, .recharts-active-dot').forEach((node) => {
    node.remove();
  });

  const serializer = new XMLSerializer();
  const svgMarkup = serializer.serializeToString(clone);
  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = (err) => reject(err);
      image.src = blobUrl;
    });

    const legendPaddingTop = legendEntries.length > 0 ? 14 : 0;
    const legendRowHeight = 20;
    const legendRows = legendEntries.length > 0 ? Math.max(1, Math.ceil(legendEntries.length / 4)) : 0;
    const extraLegendHeight = legendRows > 0 ? legendPaddingTop + legendRows * legendRowHeight + 8 : 0;
    const totalHeight = height + extraLegendHeight;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(totalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.scale(scale, scale);

    // Clean crisp white executive paper backdrop
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, totalHeight);

    // Draw rasterized chart SVG
    ctx.drawImage(img, 0, 0, width, height);

    // Paint Recharts HTML legend neatly at the bottom of the static PNG image
    if (legendEntries.length > 0) {
      ctx.font = '600 11px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
      ctx.textBaseline = 'middle';

      const swatchSize = 9;
      const itemGap = 18;
      const maxRowWidth = width - 24;

      // Group entries into centered rows
      const rows: { entries: { entry: LegendEntry; itemWidth: number }[]; rowWidth: number }[] = [];
      let currentRow: { entry: LegendEntry; itemWidth: number }[] = [];
      let currentRowWidth = 0;

      for (const entry of legendEntries) {
        const textWidth = ctx.measureText(entry.label).width;
        const itemWidth = swatchSize + 6 + textWidth;
        const nextWidth = currentRow.length === 0 ? itemWidth : currentRowWidth + itemGap + itemWidth;

        if (currentRow.length > 0 && nextWidth > maxRowWidth) {
          rows.push({ entries: currentRow, rowWidth: currentRowWidth });
          currentRow = [{ entry, itemWidth }];
          currentRowWidth = itemWidth;
        } else {
          currentRow.push({ entry, itemWidth });
          currentRowWidth = nextWidth;
        }
      }
      if (currentRow.length > 0) {
        rows.push({ entries: currentRow, rowWidth: currentRowWidth });
      }

      rows.forEach((row, rowIdx) => {
        let cursorX = Math.max(12, (width - row.rowWidth) / 2);
        const centerY = height + legendPaddingTop + rowIdx * legendRowHeight + legendRowHeight / 2;

        for (const { entry, itemWidth } of row.entries) {
          ctx.fillStyle = entry.color;
          ctx.beginPath();
          ctx.roundRect(cursorX, centerY - swatchSize / 2, swatchSize, swatchSize, 2);
          ctx.fill();

          ctx.fillStyle = '#334155';
          ctx.fillText(entry.label, cursorX + swatchSize + 6, centerY);

          cursorX += itemWidth + itemGap;
        }
      });
    }

    const dataUrl = canvas.toDataURL('image/png');
    return { dataUrl, width, height: totalHeight };
  } catch (err) {
    console.warn('Chart rasterization fallback triggered:', err);
    return null;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Finds all live Recharts charts (and explicit data-print-chart SVGs / canvases)
 * inside `rootEl`, renders each to a crisp 2x-DPI static PNG <img>, inserts the
 * print-only static image right next to the live chart, and marks the live chart
 * hidden during @media print.
 */
export async function prepareDashboardChartsForPrint(
  rootEl: HTMLElement | null
): Promise<PreparedPrintCharts> {
  if (!rootEl) {
    return { capturedCount: 0, cleanup: () => {} };
  }

  const insertedNodes: HTMLElement[] = [];
  const hiddenForPrintNodes: HTMLElement[] = [];
  const decodePromises: Promise<void>[] = [];
  let capturedCount = 0;

  // 1. Capture all Recharts chart wrappers inside the currently viewed dashboard
  const rechartsWrappers = Array.from(rootEl.querySelectorAll<HTMLElement>('.recharts-wrapper'));

  for (const wrapper of rechartsWrappers) {
    const surfaceSvg = wrapper.querySelector<SVGSVGElement>('svg.recharts-surface');
    if (!surfaceSvg) continue;

    // Skip invisible/collapsed charts
    const rect = surfaceSvg.getBoundingClientRect();
    if (rect.width < 60 || rect.height < 40) continue;

    const legendEntries = extractRechartsLegend(wrapper);
    const snapshot = await rasterizeSvgToPngDataUrl(surfaceSvg, legendEntries, 2);
    if (!snapshot) continue;

    // Derive descriptive alt text from nearest heading
    const parentCard = wrapper.closest('section, article, .rounded-2xl, .rounded-xl');
    const headingText =
      parentCard?.querySelector('h2, h3, h4')?.textContent?.trim() ||
      'Executive dashboard chart snapshot';

    const img = document.createElement('img');
    img.src = snapshot.dataUrl;
    img.alt = headingText;
    img.className = 'executive-static-chart-img';
    img.setAttribute('data-print-snapshot', 'true');
    img.style.aspectRatio = `${snapshot.width} / ${snapshot.height}`;

    // Target the ResponsiveContainer wrapper if present so layout height collapses cleanly in print
    const containerToSwap =
      wrapper.closest<HTMLElement>('.recharts-responsive-container') || wrapper;

    if (containerToSwap.parentElement) {
      containerToSwap.classList.add('executive-chart-replaced-for-print');
      hiddenForPrintNodes.push(containerToSwap);
      containerToSwap.parentElement.insertBefore(img, containerToSwap.nextSibling);
      insertedNodes.push(img);
      capturedCount += 1;

      if (typeof img.decode === 'function') {
        decodePromises.push(img.decode().catch(() => {}));
      }
    }
  }

  // 2. Capture any standalone sparkline or explicit SVG charts marked with data-print-chart="true"
  const explicitSvgs = Array.from(
    rootEl.querySelectorAll<SVGSVGElement>('svg[data-print-chart="true"]')
  );

  for (const svg of explicitSvgs) {
    if (svg.closest('.recharts-wrapper')) continue;
    const snapshot = await rasterizeSvgToPngDataUrl(svg, [], 2);
    if (!snapshot || !svg.parentElement) continue;

    const img = document.createElement('img');
    img.src = snapshot.dataUrl;
    img.alt = svg.getAttribute('aria-label') || 'Executive metric trend sparkline';
    img.className = 'executive-static-sparkline-img';
    img.setAttribute('data-print-snapshot', 'true');
    img.width = snapshot.width;
    img.height = snapshot.height;

    svg.classList.add('executive-chart-replaced-for-print');
    hiddenForPrintNodes.push(svg as unknown as HTMLElement);
    svg.parentElement.insertBefore(img, svg.nextSibling);
    insertedNodes.push(img);
    capturedCount += 1;

    if (typeof img.decode === 'function') {
      decodePromises.push(img.decode().catch(() => {}));
    }
  }

  // 3. Capture any HTML5 <canvas> visualizations
  const canvases = Array.from(rootEl.querySelectorAll<HTMLCanvasElement>('canvas'));
  for (const canvas of canvases) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 60 || rect.height < 40 || !canvas.parentElement) continue;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = 'Executive dashboard visualization';
      img.className = 'executive-static-chart-img';
      img.setAttribute('data-print-snapshot', 'true');

      canvas.classList.add('executive-chart-replaced-for-print');
      hiddenForPrintNodes.push(canvas);
      canvas.parentElement.insertBefore(img, canvas.nextSibling);
      insertedNodes.push(img);
      capturedCount += 1;

      if (typeof img.decode === 'function') {
        decodePromises.push(img.decode().catch(() => {}));
      }
    } catch {
      // Skip tainted canvases safely
    }
  }

  // Wait for all static PNG images to fully decode before opening print preview
  await Promise.all(decodePromises);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    for (const node of insertedNodes) {
      node.remove();
    }
    for (const node of hiddenForPrintNodes) {
      node.classList.remove('executive-chart-replaced-for-print');
    }
  };

  return { capturedCount, cleanup };
}
