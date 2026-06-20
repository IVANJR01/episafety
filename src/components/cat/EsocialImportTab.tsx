import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import MfaActionButton from "@/components/cat/MfaActionButton";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Loader2, AlertTriangle, CheckCircle2, Download } from "lucide-react";

type Base = "cid10" | "municipios_ibge";

const SCHEMAS: Record<Base, { label: string; cols: string[]; rpc: string; sample: string }> = {
  cid10: {
    label: "CID-10",
    cols: ["codigo", "descricao", "capitulo"],
    rpc: "esocial_import_cid10",
    sample: "codigo;descricao;capitulo\nS00.0;Traumatismo superficial do couro cabeludo;XIX\nT14.9;Lesão não especificada;XIX\n",
  },
  municipios_ibge: {
    label: "Municípios IBGE",
    cols: ["codigo", "nome", "uf"],
    rpc: "esocial_import_municipios",
    sample: "codigo;nome;uf\n3550308;São Paulo;SP\n3304557;Rio de Janeiro;RJ\n",
  },
};

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).map((l) => {
    const parts = l.split(sep);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = (parts[i] ?? "").trim()));
    return obj;
  });
  return { headers, rows };
}

export default function EsocialImportTab() {
  const qc = useQueryClient();
  const [base, setBase] = useState<Base>("cid10");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const schema = SCHEMAS[base];

  const { data: logs = [] } = useQuery({
    queryKey: ["esocial-import-logs"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("esocial_import_logs")
        .select("*").order("created_at", { ascending: false }).limit(20);
      return data || [];
    },
  });

  const handleFile = async (f: File) => {
    setFile(f);
    setResult(null);
    const text = await f.text();
    const { headers: h, rows } = parseCsv(text);
    setHeaders(h);
    setPreview(rows);
    const missing = schema.cols.filter((c) => !h.includes(c));
    if (missing.length) toast.error(`Colunas faltando: ${missing.join(", ")}`);
    else toast.success(`${rows.length} linhas detectadas`);
  };

  const importar = async () => {
    if (!preview.length) { toast.error("Selecione um CSV"); return; }
    const missing = schema.cols.filter((c) => !headers.includes(c));
    if (missing.length) { toast.error(`CSV inválido: faltam ${missing.join(", ")}`); return; }
    setRunning(true);
    try {
      const { data, error } = await (supabase.rpc as any)(schema.rpc, {
        _rows: preview,
        _arquivo_nome: file?.name ?? null,
      });
      if (error) throw error;
      setResult(data);
      toast.success(`Importação concluída: ${data.inseridos} inseridos / ${data.atualizados} atualizados`);
      qc.invalidateQueries({ queryKey: ["esocial-import-logs"] });
      qc.invalidateQueries({ queryKey: ["esocial-bases-counts"] });
      qc.invalidateQueries({ queryKey: ["esocial-checklist"] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao importar");
    } finally { setRunning(false); }
  };

  const baixarModelo = () => {
    const blob = new Blob([schema.sample], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `modelo_${base}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" /> Importador de bases oficiais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-300 p-3 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <div>
              Apenas administradores podem importar. As alterações são <strong>upsert</strong> por código:
              novos códigos são inseridos, existentes atualizados se houver diferença, idênticos ignorados.
              Linhas inválidas são listadas como erro e não interrompem a importação.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(SCHEMAS) as Base[]).map((b) => (
              <Button key={b} size="sm" variant={base === b ? "default" : "outline"} onClick={() => { setBase(b); setPreview([]); setFile(null); setResult(null); }}>
                {SCHEMAS[b].label}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={baixarModelo}>
              <Download className="h-4 w-4 mr-1" /> Modelo CSV
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            Colunas esperadas (separador <code>;</code> ou <code>,</code>):
            {" "}<code className="font-mono">{schema.cols.join(", ")}</code>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <div className="flex flex-wrap gap-2 items-center">
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Selecionar CSV
            </Button>
            {file && <span className="text-sm">{file.name} — {preview.length} linhas</span>}
            <MfaActionButton onClick={importar} disabled={running || !preview.length}>
              {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Importar
            </MfaActionButton>
          </div>

          {preview.length > 0 && (
            <div className="rounded border max-h-60 overflow-auto">
              <Table>
                <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
                <TableBody>
                  {preview.slice(0, 20).map((r, i) => (
                    <TableRow key={i}>{headers.map((h) => <TableCell key={h} className="text-xs font-mono">{r[h]}</TableCell>)}</TableRow>
                  ))}
                </TableBody>
              </Table>
              {preview.length > 20 && <div className="text-xs text-muted-foreground p-2">+{preview.length - 20} linhas...</div>}
            </div>
          )}

          {result && (
            <div className="rounded border p-3 text-sm bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <strong>Resultado:</strong>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                <div>Total: <strong>{result.total}</strong></div>
                <div>Inseridos: <strong className="text-green-700">{result.inseridos}</strong></div>
                <div>Atualizados: <strong className="text-blue-700">{result.atualizados}</strong></div>
                <div>Ignorados: <strong>{result.ignorados}</strong></div>
                <div>Erros: <strong className="text-red-700">{result.erros}</strong></div>
              </div>
              {result.erros > 0 && Array.isArray(result.detalhes) && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer">Ver erros</summary>
                  <pre className="mt-1 max-h-40 overflow-auto bg-background p-2 rounded">{JSON.stringify(result.detalhes, null, 2)}</pre>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Histórico de importações</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded border overflow-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Base</TableHead><TableHead>Arquivo</TableHead>
                <TableHead>Usuário</TableHead><TableHead>Total</TableHead><TableHead>Ins</TableHead>
                <TableHead>Atu</TableHead><TableHead>Ign</TableHead><TableHead>Err</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {logs.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{l.base}</Badge></TableCell>
                    <TableCell className="text-xs">{l.arquivo_nome || "—"}</TableCell>
                    <TableCell className="text-xs">{l.user_email || "—"}</TableCell>
                    <TableCell>{l.total_linhas}</TableCell>
                    <TableCell className="text-green-700">{l.total_inseridos}</TableCell>
                    <TableCell className="text-blue-700">{l.total_atualizados}</TableCell>
                    <TableCell>{l.total_ignorados}</TableCell>
                    <TableCell className={l.total_erros > 0 ? "text-red-700" : ""}>{l.total_erros}</TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Nenhuma importação registrada</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
