interface FormatEUROptions {
  compact?: boolean;
  sign?: boolean;
}

function compactDecimal(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  const str = rounded.toFixed(1);
  return str.endsWith('.0') ? str.slice(0, -2) : str;
}

export function formatEUR(value: number | null | undefined, opts: FormatEUROptions = {}): string {
  const { compact = false, sign = false } = opts;
  if (value == null || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  let formatted: string;
  if (compact && abs >= 1000) {
    if (abs >= 1_000_000) formatted = compactDecimal(value / 1_000_000) + 'M';
    else formatted = compactDecimal(value / 1000) + 'k';
  } else {
    formatted = Math.round(value).toLocaleString('es-ES');
  }
  return (sign && value > 0 ? '+' : '') + formatted + ' €';
}

export function formatPct(value: number | null | undefined, decimals = 1): string {
  if (value == null || Number.isNaN(value)) return '—';
  return (value >= 0 ? '+' : '') + value.toFixed(decimals) + '%';
}

export function formatNumberInput(n: number): string {
  return n.toLocaleString('es-ES', { useGrouping: false });
}

export function parseUserNumber(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '').replace('€', '').replace(',', '.');
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
}
