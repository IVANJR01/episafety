// CSV export helpers for the PPP module.
// Small and dependency-free; .xlsx is out of scope for this phase.

function csvEscape(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(rows: Record<string, any>[], headers?: string[]): string {
  if (!rows.length && !headers) return "";
  const cols = headers ?? Object.keys(rows[0] ?? {});
  const head = cols.map(csvEscape).join(";");
  const body = rows.map((r) => cols.map((c) => csvEscape(r[c])).join(";")).join("\n");
  return "\uFEFF" + head + "\n" + body;
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
