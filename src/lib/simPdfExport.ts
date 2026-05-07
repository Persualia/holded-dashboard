import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatEUR } from './format';
import { MONTH_LABELS_ES, MONTH_LABELS_LONG_ES } from './time';
import type { ItemType, SavedSim } from './types';
import type { SimEvaluation } from './simEvaluation';

const PAGE_W = 210;
const MARGIN_X = 15;
const MARGIN_TOP = 16;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const LAND_MARGIN_X = 12;

const COLOR = {
  text: '#1f2937',
  muted: '#6b7280',
  subtle: '#9ca3af',
  border: '#e5e7eb',
  cardBg: '#f9fafb',
  cardBorder: '#e5e7eb',
  positive: '#5CB6C1', // theme --success
  negative: '#EC8783', // theme --accent
  brandText: '#111827',
} as const;

const TAG_LABEL: Record<SavedSim['tag'], string> = {
  optimista: 'Optimista',
  moderado: 'Moderado',
  conservador: 'Conservador',
  crisis: 'Crisis',
  planA: 'Plan A',
  neutral: 'Neutral',
};

function safeFilename(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'simulacion'
  );
}

function todayStamp(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

const FMT_DATE = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

function sum12(arr: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < 12; i++) s += arr[i] ?? 0;
  return s;
}

function bestWorstMonth(net: readonly number[]): { bestIdx: number; worstIdx: number } {
  let bestIdx = 0;
  let worstIdx = 0;
  for (let i = 1; i < 12; i++) {
    if ((net[i] ?? 0) > (net[bestIdx] ?? 0)) bestIdx = i;
    if ((net[i] ?? 0) < (net[worstIdx] ?? 0)) worstIdx = i;
  }
  return { bestIdx, worstIdx };
}

function countOverrides(sim: SavedSim): number {
  let n = 0;
  for (const months of Object.values(sim.overrideKeys ?? {})) n += months.length;
  return n;
}

function setText(pdf: jsPDF, color: string, size: number, weight: 'normal' | 'bold' = 'normal') {
  pdf.setTextColor(color);
  pdf.setFontSize(size);
  pdf.setFont('helvetica', weight);
}

// Loads /persualia-logo.svg, crops to the logo's content viewBox, draws it
// onto a canvas with rounded corners, and returns a PNG data URL ready to
// hand to jsPDF.addImage. Returns null in non-DOM environments (e.g. our
// node smoke test) so callers can skip the logo gracefully.
async function loadLogoPng(sizePx = 256, cornerRadius = 32): Promise<string | null> {
  if (typeof document === 'undefined' || typeof fetch !== 'function') return null;
  try {
    const res = await fetch('/persualia-logo.svg');
    const raw = await res.text();
    // The SVG canvas is much larger than the visible logo (5315x7087 with
    // the actual mark drawn at 2145.65,3030.9 / 1024x1024). Re-aim the
    // viewBox so the rasterized output is just the mark.
    const cropped = raw.replace(/viewBox="[^"]+"/, 'viewBox="2145.65 3030.9 1024 1024"');
    const blob = new Blob([cropped], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('logo load failed'));
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = sizePx;
    canvas.height = sizePx;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      URL.revokeObjectURL(url);
      return null;
    }

    ctx.beginPath();
    const r = cornerRadius;
    ctx.moveTo(r, 0);
    ctx.lineTo(sizePx - r, 0);
    ctx.arcTo(sizePx, 0, sizePx, r, r);
    ctx.lineTo(sizePx, sizePx - r);
    ctx.arcTo(sizePx, sizePx, sizePx - r, sizePx, r);
    ctx.lineTo(r, sizePx);
    ctx.arcTo(0, sizePx, 0, sizePx - r, r);
    ctx.lineTo(0, r);
    ctx.arcTo(0, 0, r, 0, r);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, 0, 0, sizePx, sizePx);

    URL.revokeObjectURL(url);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

// ─── Page 1 ────────────────────────────────────────────────────────────────

function drawHeader(pdf: jsPDF, sim: SavedSim, logoPng: string | null): number {
  const logoSize = 14;
  const titleX = logoPng ? MARGIN_X + logoSize + 5 : MARGIN_X;

  if (logoPng) {
    pdf.addImage(logoPng, 'PNG', MARGIN_X, MARGIN_TOP - 2, logoSize, logoSize);
  }

  setText(pdf, COLOR.muted, 9);
  pdf.text('PERSUALIA · REPORTE DE SIMULACIÓN', titleX, MARGIN_TOP + 4);

  const generatedLabel = `Generado el ${FMT_DATE.format(new Date())}`;
  pdf.text(generatedLabel, PAGE_W - MARGIN_X, MARGIN_TOP + 4, { align: 'right' });

  setText(pdf, COLOR.brandText, 22, 'bold');
  pdf.text(sim.name, MARGIN_X, MARGIN_TOP + 22);

  const created = new Date(sim.createdAt);
  const savedMonth = MONTH_LABELS_LONG_ES[sim.savedAtMonthIdx] ?? '';
  const subtitle = `Guardada el ${FMT_DATE.format(created)} · sobre ${savedMonth} ${sim.savedAtYear} · ${TAG_LABEL[sim.tag] ?? sim.tag}`;
  setText(pdf, COLOR.muted, 10);
  pdf.text(subtitle, MARGIN_X, MARGIN_TOP + 28);

  pdf.setDrawColor(COLOR.border);
  pdf.setLineWidth(0.2);
  pdf.line(MARGIN_X, MARGIN_TOP + 32, PAGE_W - MARGIN_X, MARGIN_TOP + 32);

  return MARGIN_TOP + 38;
}

function drawHypothesis(pdf: jsPDF, sim: SavedSim, y: number): number {
  if (!sim.hypothesis?.trim()) return y;

  const text = `"${sim.hypothesis.trim()}"`;
  const wrapped = pdf.splitTextToSize(text, CONTENT_W - 8) as string[];
  const lineH = 5;
  const boxH = wrapped.length * lineH + 8;

  pdf.setFillColor(COLOR.cardBg);
  pdf.setDrawColor(COLOR.cardBorder);
  pdf.setLineWidth(0.2);
  pdf.roundedRect(MARGIN_X, y, CONTENT_W, boxH, 1.5, 1.5, 'FD');

  setText(pdf, COLOR.muted, 8, 'bold');
  pdf.text('HIPÓTESIS', MARGIN_X + 4, y + 5);

  setText(pdf, COLOR.text, 11);
  pdf.setFont('helvetica', 'italic');
  pdf.text(wrapped, MARGIN_X + 4, y + 10);

  if (sim.description?.trim()) {
    setText(pdf, COLOR.muted, 9);
    const desc = pdf.splitTextToSize(sim.description.trim(), CONTENT_W) as string[];
    let dy = y + boxH + 5;
    for (const line of desc) {
      pdf.text(line, MARGIN_X, dy);
      dy += 4.5;
    }
    return dy + 3;
  }

  return y + boxH + 6;
}

function drawKpiGrid(pdf: jsPDF, sim: SavedSim, evaluation: SimEvaluation, y: number): number {
  const totalIncome = sum12(evaluation.predIncome);
  const totalExpense = sum12(evaluation.predExpense);
  const totalNet = sum12(evaluation.predNet);
  const margin = totalIncome > 0 ? (totalNet / totalIncome) * 100 : null;
  const { bestIdx, worstIdx } = bestWorstMonth(evaluation.predNet);

  // Cockpit-style insights derived from the saved scenario items only — same
  // logic as CockpitView.tsx: recurrent income share, monthly expense average.
  const items = sim.predicted?.items ?? [];
  const recurrentTotal = items
    .filter((it) => it.type === 'income' && it.group === 'Ventas recurrentes')
    .reduce((s, it) => s + it.values.reduce((a, b) => a + b, 0), 0);
  const recurrentPct = totalIncome > 0 ? (recurrentTotal / totalIncome) * 100 : null;
  const monthlyAvgExpense = Math.abs(totalExpense) / 12;

  const cards: Array<{
    label: string;
    value: string;
    sub?: string;
    color?: string;
    big?: boolean;
  }> = [
    {
      label: 'Ingresos previstos',
      value: formatEUR(totalIncome, { compact: true }),
      sub: '12 meses',
    },
    {
      label: 'Gastos previstos',
      value: formatEUR(totalExpense, { compact: true }),
      sub: '12 meses',
    },
    {
      label: 'Resultado neto',
      value: formatEUR(totalNet, { compact: true }),
      sub: '12 meses',
      color: totalNet >= 0 ? COLOR.positive : COLOR.negative,
      big: true,
    },
    {
      label: 'Margen neto',
      value: margin == null ? '—' : `${margin >= 0 ? '+' : ''}${margin.toFixed(1)}%`,
      sub: 'sobre ingresos',
      color: margin == null ? COLOR.text : margin >= 0 ? COLOR.positive : COLOR.negative,
    },
    {
      label: 'Mejor mes',
      value: formatEUR(evaluation.predNet[bestIdx], { compact: true }),
      sub: MONTH_LABELS_LONG_ES[bestIdx],
      color: COLOR.positive,
    },
    {
      label: 'Peor mes',
      value: formatEUR(evaluation.predNet[worstIdx], { compact: true }),
      sub: MONTH_LABELS_LONG_ES[worstIdx],
      color: evaluation.predNet[worstIdx] < 0 ? COLOR.negative : COLOR.text,
    },
    {
      label: '% ingresos recurrentes',
      value: recurrentPct == null ? '—' : `${recurrentPct.toFixed(0)}%`,
      sub: 'sobre ingresos totales',
      color: recurrentPct != null && recurrentPct >= 50 ? COLOR.positive : COLOR.text,
    },
    {
      label: 'Media gasto / mes',
      value: formatEUR(monthlyAvgExpense, { compact: true }),
      sub: '12 meses',
    },
  ];

  const cols = 4;
  const gap = 4;
  const cardW = (CONTENT_W - gap * (cols - 1)) / cols;
  const cardH = 26;
  const rows = Math.ceil(cards.length / cols);

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const r = Math.floor(i / cols);
    const col = i % cols;
    const cx = MARGIN_X + col * (cardW + gap);
    const cy = y + r * (cardH + gap);

    pdf.setFillColor('#ffffff');
    pdf.setDrawColor(COLOR.cardBorder);
    pdf.setLineWidth(0.2);
    pdf.roundedRect(cx, cy, cardW, cardH, 1.5, 1.5, 'FD');

    setText(pdf, COLOR.muted, 7.5, 'bold');
    pdf.text(c.label.toUpperCase(), cx + 3, cy + 5);

    setText(pdf, c.color ?? COLOR.text, c.big ? 18 : 15, 'bold');
    pdf.text(c.value, cx + 3, cy + 16);

    if (c.sub) {
      setText(pdf, COLOR.muted, 8);
      pdf.text(c.sub, cx + 3, cy + 22);
    }
  }

  return y + rows * (cardH + gap) + 2;
}

function drawMetaRow(pdf: jsPDF, sim: SavedSim, y: number): number {
  const cells = countOverrides(sim);
  const rows = sim.simRows?.length ?? 0;
  const items = sim.predicted?.items?.length ?? 0;
  const groups = new Set((sim.predicted?.items ?? []).map((it) => it.group)).size;

  setText(pdf, COLOR.muted, 9);
  const parts = [
    `${items} concepto${items === 1 ? '' : 's'}`,
    `${groups} grupo${groups === 1 ? '' : 's'}`,
    `${cells} celda${cells === 1 ? '' : 's'} modificada${cells === 1 ? '' : 's'}`,
    `${rows} fila${rows === 1 ? '' : 's'} simulada${rows === 1 ? '' : 's'}`,
  ];
  pdf.text(parts.join(' · '), MARGIN_X, y + 4);

  return y + 7;
}

// ─── Page 2: previsión por concepto ────────────────────────────────────────

function drawSectionTitle(pdf: jsPDF, title: string, y: number, landscape = false): number {
  const x = landscape ? LAND_MARGIN_X : MARGIN_X;
  setText(pdf, COLOR.brandText, 14, 'bold');
  pdf.text(title, x, y);
  return y + 4;
}

function niceCeil(n: number): number {
  if (n === 0) return 1;
  const sign = n < 0 ? -1 : 1;
  const abs = Math.abs(n);
  const exp = Math.floor(Math.log10(abs));
  const base = Math.pow(10, exp);
  const m = abs / base;
  let nice: number;
  if (m <= 1) nice = 1;
  else if (m <= 2) nice = 2;
  else if (m <= 5) nice = 5;
  else nice = 10;
  return sign * nice * base;
}

/**
 * Draws a combined income-vs-expense chart showing both series as solid lines
 * over 12 months. Expenses are plotted as absolute magnitudes so they share
 * the same Y axis as income — when the expense line crosses above the income
 * line, the month is at a loss (visually obvious without needing to read
 * numbers).
 */
function drawIncomeExpenseChart(
  pdf: jsPDF,
  predIncome: readonly number[],
  predExpense: readonly number[],
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  // Legend on the right of the title.
  const legendY = y - 2;
  const legendRight = x + w;
  setText(pdf, COLOR.text, 8);
  pdf.setDrawColor(COLOR.positive);
  pdf.setLineWidth(0.9);
  pdf.line(legendRight - 50, legendY - 1, legendRight - 42, legendY - 1);
  pdf.text('Ingresos', legendRight - 40, legendY);

  pdf.setDrawColor(COLOR.negative);
  pdf.line(legendRight - 23, legendY - 1, legendRight - 15, legendY - 1);
  pdf.text('Gastos', legendRight - 13, legendY);

  const incAbs = predIncome.map((v) => Math.abs(v));
  const expAbs = predExpense.map((v) => Math.abs(v));
  const max = Math.max(1, ...incAbs, ...expAbs);
  const niceMax = niceCeil(max);
  const range = niceMax || 1;

  const plotX0 = x + 18;
  const plotTop = y + 4;
  const plotW = w - 18;
  const plotH = h - 12;

  const xFor = (m: number) => plotX0 + (plotW / 11) * m;
  const yFor = (v: number) => plotTop + plotH - (v / range) * plotH;

  // Gridlines + Y labels.
  pdf.setDrawColor(COLOR.border);
  pdf.setLineWidth(0.15);
  setText(pdf, COLOR.muted, 7);
  for (let i = 0; i <= 4; i++) {
    const v = (range * i) / 4;
    const yy = yFor(v);
    pdf.line(plotX0, yy, plotX0 + plotW, yy);
    pdf.text(formatEUR(v, { compact: true }), plotX0 - 2, yy + 1.2, { align: 'right' });
  }

  // X labels.
  setText(pdf, COLOR.muted, 7);
  for (let m = 0; m < 12; m++) {
    pdf.text(MONTH_LABELS_ES[m], xFor(m), plotTop + plotH + 4, { align: 'center' });
  }

  // Income line.
  pdf.setDrawColor(COLOR.positive);
  pdf.setLineWidth(0.9);
  for (let m = 0; m < 11; m++) {
    pdf.line(xFor(m), yFor(incAbs[m]), xFor(m + 1), yFor(incAbs[m + 1]));
  }
  // Expense line.
  pdf.setDrawColor(COLOR.negative);
  for (let m = 0; m < 11; m++) {
    pdf.line(xFor(m), yFor(expAbs[m]), xFor(m + 1), yFor(expAbs[m + 1]));
  }
  // Markers.
  pdf.setFillColor(COLOR.positive);
  for (let m = 0; m < 12; m++) pdf.circle(xFor(m), yFor(incAbs[m]), 0.9, 'F');
  pdf.setFillColor(COLOR.negative);
  for (let m = 0; m < 12; m++) pdf.circle(xFor(m), yFor(expAbs[m]), 0.9, 'F');
}

/**
 * Per-month profit/loss strip drawn under the combined chart. Each cell shows
 * the month, the net €, and a color background (positive/negative) so a CFO
 * can scan loss months at a glance.
 */
function drawNetMonthlyStrip(
  pdf: jsPDF,
  predNet: readonly number[],
  x: number,
  y: number,
  w: number,
): number {
  setText(pdf, COLOR.brandText, 10, 'bold');
  pdf.text('Resultado neto por mes', x, y);

  const stripY = y + 3;
  const cellW = w / 12;
  const cellH = 13;
  for (let m = 0; m < 12; m++) {
    const cx = x + m * cellW;
    const v = predNet[m] ?? 0;
    const fill = v >= 0 ? COLOR.positive : COLOR.negative;
    pdf.setFillColor(fill);
    pdf.setDrawColor('#ffffff');
    pdf.setLineWidth(0.4);
    pdf.rect(cx + 0.4, stripY, cellW - 0.8, cellH, 'FD');

    setText(pdf, '#ffffff', 8, 'bold');
    pdf.text(MONTH_LABELS_ES[m], cx + cellW / 2, stripY + 5, { align: 'center' });
    setText(pdf, '#ffffff', 8);
    pdf.text(formatEUR(v, { compact: true }), cx + cellW / 2, stripY + 10, { align: 'center' });
  }
  return stripY + cellH + 4;
}

// ─── Page 3: insights del escenario ────────────────────────────────────────

interface RankedRow {
  label: string;
  value: number;
  share: number; // 0..1
}

function topClients(sim: SavedSim, totalIncome: number): RankedRow[] {
  const items = (sim.predicted?.items ?? []).filter(
    (it) =>
      it.type === 'income' &&
      (it.group === 'Ventas recurrentes' || it.group === 'Ventas no recurrentes'),
  );
  const ranked = items
    .map((it) => {
      const total = it.values.reduce((a, b) => a + b, 0);
      // Names are usually "CODE - Customer Name". Show the customer name.
      const human = it.name.includes(' - ')
        ? it.name.split(' - ').slice(1).join(' - ')
        : it.name;
      return {
        label: human || it.name,
        value: total,
        share: totalIncome > 0 ? total / totalIncome : 0,
      };
    })
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  return ranked.slice(0, 5);
}

function topExpenseGroups(sim: SavedSim, totalExpense: number): RankedRow[] {
  const map = new Map<string, number>();
  for (const it of sim.predicted?.items ?? []) {
    if (it.type !== 'expense') continue;
    const key = it.group || '—';
    const total = it.values.reduce((a, b) => a + b, 0);
    map.set(key, (map.get(key) ?? 0) + total);
  }
  const denom = Math.abs(totalExpense) || 1;
  const ranked = [...map.entries()]
    .map(([label, total]) => ({
      label,
      value: Math.abs(total),
      share: Math.abs(total) / denom,
    }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  return ranked.slice(0, 7);
}

function drawRankedBars(
  pdf: jsPDF,
  title: string,
  rows: RankedRow[],
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  setText(pdf, COLOR.brandText, 12, 'bold');
  const titleWidth = pdf.getTextWidth(title);
  pdf.text(title, x, y);
  setText(pdf, COLOR.muted, 9);
  pdf.text(`${rows.length} entradas`, x + titleWidth + 3, y);

  if (rows.length === 0) {
    setText(pdf, COLOR.muted, 9);
    pdf.text('Sin datos disponibles.', x, y + 8);
    return;
  }

  const labelW = 60;
  const valueW = 32;
  const barX = x + labelW;
  const barMaxW = w - labelW - valueW - 4;
  const rowH = (h - 6) / rows.length;
  const top = y + 4;
  const max = Math.max(...rows.map((r) => r.value));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const cy = top + i * rowH;
    const barH = Math.min(rowH - 2, 6);
    const barTop = cy + (rowH - barH) / 2;

    setText(pdf, COLOR.text, 9);
    const truncated = r.label.length > 28 ? r.label.slice(0, 27) + '…' : r.label;
    pdf.text(truncated, x, cy + rowH / 2 + 1.5);

    // Track background.
    pdf.setFillColor(COLOR.border);
    pdf.roundedRect(barX, barTop, barMaxW, barH, 0.6, 0.6, 'F');
    // Filled bar.
    const fillW = (r.value / max) * barMaxW;
    pdf.setFillColor(color);
    pdf.roundedRect(barX, barTop, Math.max(0.6, fillW), barH, 0.6, 0.6, 'F');

    setText(pdf, COLOR.text, 9, 'bold');
    pdf.text(formatEUR(r.value, { compact: true }), x + w, cy + rowH / 2 + 1.5, {
      align: 'right',
    });
    setText(pdf, COLOR.muted, 7.5);
    pdf.text(`${(r.share * 100).toFixed(0)}%`, x + w, cy + rowH / 2 + 5.5, { align: 'right' });
  }
}

/**
 * Page 3: high-value scenario insights — top 5 clients (recurrent + spot)
 * and top 7 expense categories. Mirrors the Cockpit's RankedBarsCard so the
 * printed report tells the same "where is the money coming from / going" story.
 */
function drawInsightsPage(pdf: jsPDF, sim: SavedSim, evaluation: SimEvaluation): void {
  const totalIncome = sum12(evaluation.predIncome);
  const totalExpense = sum12(evaluation.predExpense);
  const clients = topClients(sim, totalIncome);
  const expenses = topExpenseGroups(sim, totalExpense);

  drawSectionTitle(pdf, 'Insights del escenario', MARGIN_TOP);

  // Top clients — top half.
  drawRankedBars(
    pdf,
    'Top clientes',
    clients,
    COLOR.positive,
    MARGIN_X,
    MARGIN_TOP + 14,
    CONTENT_W,
    70,
  );

  // Concentration callout (top1 share warning).
  if (clients[0]) {
    const top1Share = clients[0].share * 100;
    setText(
      pdf,
      top1Share >= 25 ? COLOR.negative : COLOR.muted,
      9,
      top1Share >= 25 ? 'bold' : 'normal',
    );
    const msg =
      top1Share >= 25
        ? `Riesgo de concentración: ${clients[0].label} representa el ${top1Share.toFixed(0)}% de los ingresos.`
        : `Top cliente (${clients[0].label}) representa el ${top1Share.toFixed(0)}% de los ingresos.`;
    pdf.text(msg, MARGIN_X, MARGIN_TOP + 90);
  }

  // Top expense groups — bottom half.
  drawRankedBars(
    pdf,
    'Top categorías de gasto',
    expenses,
    COLOR.negative,
    MARGIN_X,
    MARGIN_TOP + 105,
    CONTENT_W,
    90,
  );
}

// ─── Monthly P&G (landscape) ───────────────────────────────────────────────

function drawMonthlyTable(pdf: jsPDF, evaluation: SimEvaluation): void {
  const head = [['Concepto', ...MONTH_LABELS_ES, 'Total']];
  const fmt = (v: number) => formatEUR(v, { compact: true });

  const body: Array<Array<string>> = [];

  body.push(['Ingresos previstos', ...evaluation.predIncome.map(fmt), fmt(sum12(evaluation.predIncome))]);
  body.push(['Gastos previstos', ...evaluation.predExpense.map(fmt), fmt(sum12(evaluation.predExpense))]);
  body.push(['Neto previsto', ...evaluation.predNet.map(fmt), fmt(sum12(evaluation.predNet))]);

  const margin = evaluation.predIncome.map((inc, i) =>
    inc > 0 ? `${((evaluation.predNet[i] / inc) * 100).toFixed(0)}%` : '—',
  );
  const totalInc = sum12(evaluation.predIncome);
  const totalMargin =
    totalInc > 0 ? `${((sum12(evaluation.predNet) / totalInc) * 100).toFixed(0)}%` : '—';
  body.push(['Margen %', ...margin, totalMargin]);

  autoTable(pdf, {
    startY: MARGIN_TOP + 8,
    margin: { left: LAND_MARGIN_X, right: LAND_MARGIN_X },
    head,
    body,
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.4, textColor: COLOR.text },
    headStyles: { fillColor: '#f3f4f6', textColor: COLOR.text, fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 36 },
      13: { fontStyle: 'bold', halign: 'right' },
      ...Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [i + 1, { halign: 'right' }]),
      ),
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const label = body[data.row.index]?.[0] ?? '';
      if (label.startsWith('Neto previsto')) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });
}

// ─── Por grupo ─────────────────────────────────────────────────────────────

interface GroupRow {
  group: string;
  type: ItemType;
  values: number[];
  total: number;
}

function buildGroupRows(sim: SavedSim): GroupRow[] {
  const items = sim.predicted?.items ?? [];
  const map = new Map<string, GroupRow>();
  for (const it of items) {
    const key = `${it.type}::${it.group}`;
    let row = map.get(key);
    if (!row) {
      row = { group: it.group, type: it.type, values: new Array(12).fill(0), total: 0 };
      map.set(key, row);
    }
    for (let m = 0; m < 12; m++) {
      const v = it.values[m] ?? 0;
      row.values[m] += v;
      row.total += v;
    }
  }
  // Drop rows where every month is exactly 0 — they add no signal.
  const all = [...map.values()].filter((r) => r.values.some((v) => v !== 0));
  // Income first (descending by total), then expenses (ascending = most negative first)
  const income = all.filter((r) => r.type === 'income').sort((a, b) => b.total - a.total);
  const expense = all.filter((r) => r.type === 'expense').sort((a, b) => a.total - b.total);
  return [...income, ...expense];
}

function drawGroupTable(pdf: jsPDF, sim: SavedSim): void {
  const rows = buildGroupRows(sim);
  const fmt = (v: number) => formatEUR(v, { compact: true });

  const head = [['Grupo', 'Tipo', ...MONTH_LABELS_ES, 'Total']];

  const body: Array<Array<string>> = rows.map((r) => [
    r.group || '—',
    r.type === 'income' ? 'Ingreso' : 'Gasto',
    ...r.values.map(fmt),
    fmt(r.total),
  ]);

  // Totals row
  const monthTotals = new Array(12).fill(0);
  let grandTotal = 0;
  for (const r of rows) {
    for (let m = 0; m < 12; m++) monthTotals[m] += r.values[m];
    grandTotal += r.total;
  }

  autoTable(pdf, {
    startY: MARGIN_TOP + 8,
    margin: { left: LAND_MARGIN_X, right: LAND_MARGIN_X },
    head,
    body,
    foot: [['Resultado neto', '', ...monthTotals.map(fmt), fmt(grandTotal)]],
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.2, textColor: COLOR.text },
    headStyles: { fillColor: '#f3f4f6', textColor: COLOR.text, fontStyle: 'bold' },
    footStyles: {
      fillColor: '#111827',
      textColor: '#ffffff',
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 14 },
      14: { fontStyle: 'bold', halign: 'right' },
      ...Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [i + 2, { halign: 'right' }]),
      ),
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const r = rows[data.row.index];
      if (!r) return;
      if (data.column.index >= 2 && data.column.index <= 13) {
        const v = r.values[data.column.index - 2];
        if (r.type === 'expense' || v < 0) data.cell.styles.textColor = COLOR.negative;
      }
      if (data.column.index === 14) {
        data.cell.styles.textColor = r.type === 'income' ? COLOR.positive : COLOR.negative;
      }
    },
  });
}

// ─── Detalle por concepto ──────────────────────────────────────────────────

function drawDetailTable(pdf: jsPDF, sim: SavedSim): void {
  // Drop items that are zero across all 12 months — they're just noise.
  const items = (sim.predicted?.items ?? []).filter((it) => it.values.some((v) => v !== 0));
  // Group by (type, group), income first (groups by total desc), expense after.
  type Bucket = { type: ItemType; group: string; items: typeof items };
  const buckets = new Map<string, Bucket>();
  for (const it of items) {
    const key = `${it.type}::${it.group}`;
    let b = buckets.get(key);
    if (!b) {
      b = { type: it.type, group: it.group, items: [] };
      buckets.set(key, b);
    }
    b.items.push(it);
  }
  const bucketTotal = (b: { items: typeof items }) =>
    b.items.reduce((s, it) => s + it.values.reduce((a, v) => a + v, 0), 0);

  const ordered = [...buckets.values()];
  ordered.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'income' ? -1 : 1;
    // Income: biggest first; expense: most negative (= biggest abs) first.
    return a.type === 'income' ? bucketTotal(b) - bucketTotal(a) : bucketTotal(a) - bucketTotal(b);
  });

  const fmt = (v: number) => formatEUR(v, { compact: true });
  const head = [['Concepto', 'Tipo', ...MONTH_LABELS_ES, 'Total']];
  const body: Array<Array<string>> = [];

  for (const b of ordered) {
    // Group header row
    const groupValues = new Array(12).fill(0);
    let groupTotal = 0;
    for (const it of b.items) {
      for (let m = 0; m < 12; m++) groupValues[m] += it.values[m] ?? 0;
      for (const v of it.values) groupTotal += v;
    }
    body.push([
      `${b.group || '—'} (${b.items.length} concepto${b.items.length === 1 ? '' : 's'})`,
      b.type === 'income' ? 'Ingreso' : 'Gasto',
      ...groupValues.map(fmt),
      fmt(groupTotal),
    ]);
    // Items — show only the human part of the name (drop "CODE - " prefix).
    const sortedItems = [...b.items].sort((a, b2) => {
      const ta = a.values.reduce((s, v) => s + v, 0);
      const tb = b2.values.reduce((s, v) => s + v, 0);
      return b.type === 'income' ? tb - ta : ta - tb;
    });
    for (const it of sortedItems) {
      const total = it.values.reduce((s, v) => s + v, 0);
      const human = it.name.includes(' - ')
        ? it.name.split(' - ').slice(1).join(' - ')
        : it.name;
      body.push([
        human || it.name,
        it.type === 'income' ? 'Ingreso' : 'Gasto',
        ...it.values.map(fmt),
        fmt(total),
      ]);
    }
  }

  const groupHeaderIdxSet = new Set<number>();
  let idx = 0;
  for (const b of ordered) {
    groupHeaderIdxSet.add(idx);
    idx += 1 + b.items.length;
  }

  autoTable(pdf, {
    startY: MARGIN_TOP + 8,
    margin: { left: LAND_MARGIN_X, right: LAND_MARGIN_X },
    head,
    body,
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1, textColor: COLOR.text },
    headStyles: { fillColor: '#f3f4f6', textColor: COLOR.text, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 78 },
      1: { cellWidth: 14 },
      14: { fontStyle: 'bold', halign: 'right' },
      ...Object.fromEntries(
        Array.from({ length: 12 }, (_, i) => [i + 2, { halign: 'right' }]),
      ),
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      if (groupHeaderIdxSet.has(data.row.index)) {
        data.cell.styles.fillColor = '#eef2ff';
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = COLOR.brandText;
      }
    },
  });
}

// ─── Footer / pagination ───────────────────────────────────────────────────

function drawFooters(pdf: jsPDF, sim: SavedSim): void {
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    const isLandscape = pdf.internal.pageSize.getWidth() > pdf.internal.pageSize.getHeight();
    const w = pdf.internal.pageSize.getWidth();
    const h = pdf.internal.pageSize.getHeight();
    const mx = isLandscape ? LAND_MARGIN_X : MARGIN_X;

    setText(pdf, COLOR.subtle, 8);
    pdf.text(`Persualia · ${sim.name}`, mx, h - 8);
    pdf.text(`Página ${i} de ${total}`, w - mx, h - 8, { align: 'right' });
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function exportSimulationPdf(
  sim: SavedSim,
  evaluation: SimEvaluation,
): Promise<void> {
  const logoPng = await loadLogoPng();
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  // Page 1 — cover + executive summary
  let y = drawHeader(pdf, sim, logoPng);
  y = drawHypothesis(pdf, sim, y);
  y = drawKpiGrid(pdf, sim, evaluation, y);
  drawMetaRow(pdf, sim, y);

  // Page 2 — combined income vs expense chart + per-month profit/loss strip
  pdf.addPage('a4', 'portrait');
  drawSectionTitle(pdf, 'Ingresos vs. gastos por mes', MARGIN_TOP);
  setText(pdf, COLOR.muted, 9);
  pdf.text(
    'Cuando la línea de gastos cruza por encima de la de ingresos, el mes cierra en pérdida.',
    MARGIN_X,
    MARGIN_TOP + 6,
  );
  drawIncomeExpenseChart(
    pdf,
    evaluation.predIncome,
    evaluation.predExpense,
    MARGIN_X,
    MARGIN_TOP + 14,
    CONTENT_W,
    100,
  );
  drawNetMonthlyStrip(
    pdf,
    evaluation.predNet,
    MARGIN_X,
    MARGIN_TOP + 130,
    CONTENT_W,
  );

  // Page 3 — insights del escenario (top clientes + top gastos)
  pdf.addPage('a4', 'portrait');
  drawInsightsPage(pdf, sim, evaluation);

  // Page — vista mensual P&G (landscape)
  pdf.addPage('a4', 'landscape');
  drawSectionTitle(pdf, 'Vista mensual de P&G', MARGIN_TOP, true);
  drawMonthlyTable(pdf, evaluation);

  // Page — agregada por grupo
  pdf.addPage('a4', 'landscape');
  drawSectionTitle(pdf, 'Agregado por grupo', MARGIN_TOP, true);
  drawGroupTable(pdf, sim);

  // Page — detalle por concepto
  pdf.addPage('a4', 'landscape');
  drawSectionTitle(pdf, 'Detalle por concepto', MARGIN_TOP, true);
  drawDetailTable(pdf, sim);

  drawFooters(pdf, sim);

  pdf.save(`simulacion-${safeFilename(sim.name)}-${todayStamp()}.pdf`);
}
