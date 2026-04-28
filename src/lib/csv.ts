/** CSV escape — quote if contains separator, quote, semicolon, or newline. */
function escape(cell: unknown): string {
  const s = String(cell ?? '');
  if (/[",;\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function rowsToCsv(rows: Array<Array<unknown>>, separator = ';'): string {
  return rows.map((r) => r.map(escape).join(separator)).join('\n');
}

export function downloadCsv(filename: string, rows: Array<Array<unknown>>): void {
  const csv = rowsToCsv(rows);
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
