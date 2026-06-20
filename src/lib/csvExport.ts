// CSV export helper — gera CSV UTF-8 com BOM (compatível com Excel pt-BR).
export function toCsv(rows: Record<string, any>[], headers?: string[]): string {
  if (!rows.length) return "";
  const cols = headers ?? Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v == null) return "";
    const s = typeof v === "string" ? v : String(v);
    if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const head = cols.join(";");
  const body = rows.map((r) => cols.map((c) => escape(r[c])).join(";")).join("\n");
  return head + "\n" + body;
}

export function downloadCsv(filename: string, rows: Record<string, any>[], headers?: string[]) {
  const csv = toCsv(rows, headers);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
