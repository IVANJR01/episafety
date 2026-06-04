import { useState } from "react";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileDown, CheckCircle2, XCircle, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

type Row = {
  nome: string;
  cpf: string;
  setor?: string;
  funcao?: string;
  data_admissao?: string;
  matricula?: string;
  riscos?: { grupo: string; descricao: string }[];
  tipo_exame?: string;
  status: "novo" | "atualizar" | "erro";
  msg?: string;
};

const COL_GRUPOS = ["fisico", "quimico", "ergonomico", "biologico", "acidente", "outro"];
const COL_TIPOS = ["admissional", "periodico", "retorno", "mudanca_risco", "demissional"];

function normCpf(v: any) { return String(v ?? "").replace(/\D/g, "").padStart(11, "0").slice(-11); }
function validCpf(cpf: string) {
  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  return true;
}
function parseDate(v: any): string | undefined {
  if (!v) return undefined;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return undefined;
}

export default function AsoImport() {
  const { empresaId, empresaScopeIds, isSuperAdmin } = useAuth();
  const [empresaSel, setEmpresaSel] = useState<string>(empresaId || "");
  const [rows, setRows] = useState<Row[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ criados: number; atualizados: number; erros: number } | null>(null);

  const { data: empresas = [] } = useQuery({
    queryKey: ["aso-imp-empresas", empresaScopeIds.join(",")],
    queryFn: async () => {
      let q = supabase.from("empresa_config").select("id, nome").order("nome");
      if (isSuperAdmin && empresaScopeIds.length > 0) q = q.in("id", empresaScopeIds);
      return (await q).data || [];
    },
  });

  const baixarModelo = () => {
    const cols = ["Nome", "CPF", "Setor", "Funcao", "Data Admissao", "Matricula",
      "Fisico", "Quimico", "Ergonomico", "Biologico", "Acidente", "Outro",
      "Admissional", "Periodico", "Retorno", "Mudanca Risco", "Demissional"];
    const sample = [
      "MAYCK ANDRÉ PIRES LINHARES", "711.759.304-07", "Produção", "Auxiliar de Produção",
      "01/03/2024", "22",
      "N.A", "N.A", "Movimentos repetitivos / monotonia, Prazos apertados", "N.A", "Quedas de materiais e escorregões", "",
      "", "", "", "", "TRUE",
    ];
    const ws = XLSX.utils.aoa_to_sheet([cols, sample]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Funcionarios");
    XLSX.writeFile(wb, "Modelo-Importacao-ASO.xlsx");
  };

  const onFile = async (file: File) => {
    if (!empresaSel) { toast.error("Selecione a empresa antes"); return; }
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
    if (!raw.length) { toast.error("Planilha vazia"); return; }

    // existing CPFs
    const { data: existing = [] } = await supabase.from("funcionarios").select("id, cpf, nome").eq("empresa_id", empresaSel);
    const existingMap = new Map((existing || []).map((f: any) => [normCpf(f.cpf), f]));

    const parsed: Row[] = raw.map((r) => {
      const get = (...keys: string[]) => {
        for (const k of keys) {
          const found = Object.keys(r).find((x) => x.toLowerCase().trim() === k.toLowerCase());
          if (found && r[found] !== "") return r[found];
        }
        return "";
      };
      const nome = String(get("Nome", "Funcionario", "Funcionário") || "").trim();
      const cpfRaw = String(get("CPF") || "");
      const cpf = normCpf(cpfRaw);
      const setor = String(get("Setor") || "").trim();
      const funcao = String(get("Funcao", "Função", "Cargo") || "").trim();
      const data_admissao = parseDate(get("Data Admissao", "Data de Admissão", "Admissao"));
      const matricula = String(get("Matricula", "Matrícula") || "").trim();

      const riscos: { grupo: string; descricao: string }[] = [];
      COL_GRUPOS.forEach((g) => {
        const v = String(get(g.charAt(0).toUpperCase() + g.slice(1)) || "").trim();
        if (v && !/^n\.?a/i.test(v) && v.toLowerCase() !== "false") {
          v.split(/[;,]/).map(s => s.trim()).filter(Boolean).forEach((d) => riscos.push({ grupo: g, descricao: d }));
        }
      });
      let tipo_exame: string | undefined;
      for (const t of COL_TIPOS) {
        const v = String(get(t.charAt(0).toUpperCase() + t.slice(1).replace("_", " ")) || "").trim().toLowerCase();
        if (v === "true" || v === "x" || v === "1" || v === "sim") { tipo_exame = t; break; }
      }

      let status: Row["status"] = "novo"; let msg: string | undefined;
      if (!nome) { status = "erro"; msg = "Nome vazio"; }
      else if (!validCpf(cpf)) { status = "erro"; msg = "CPF inválido"; }
      else if (existingMap.has(cpf)) { status = "atualizar"; msg = "CPF já existe"; }
      return { nome, cpf, setor, funcao, data_admissao, matricula, riscos, tipo_exame, status, msg };
    });
    setRows(parsed);
    setResult(null);
  };

  const importar = async () => {
    if (!empresaSel || !rows.length) return;
    setImporting(true);
    let criados = 0, atualizados = 0, erros = 0;

    // pre-resolve setores/funcoes
    const setoresNomes = [...new Set(rows.filter(r => r.setor && r.status !== "erro").map(r => r.setor!.toLowerCase()))];
    const funcoesNomes = [...new Set(rows.filter(r => r.funcao && r.status !== "erro").map(r => r.funcao!.toLowerCase()))];

    const setorMap = new Map<string, string>();
    const funcaoMap = new Map<string, string>();

    for (const nome of setoresNomes) {
      const { data: ex } = await supabase.from("aso_setores").select("id").eq("empresa_id", empresaSel).ilike("nome", nome).maybeSingle();
      if (ex) setorMap.set(nome, ex.id);
      else {
        const { data: ins } = await supabase.from("aso_setores").insert({ empresa_id: empresaSel, nome }).select("id").single();
        if (ins) setorMap.set(nome, ins.id);
      }
    }
    for (const nome of funcoesNomes) {
      const { data: ex } = await supabase.from("aso_funcoes").select("id").eq("empresa_id", empresaSel).ilike("nome", nome).maybeSingle();
      if (ex) funcaoMap.set(nome, ex.id);
      else {
        const { data: ins } = await supabase.from("aso_funcoes").insert({ empresa_id: empresaSel, nome }).select("id").single();
        if (ins) funcaoMap.set(nome, ins.id);
      }
    }

    // vincular riscos à função
    for (const r of rows) {
      if (r.status === "erro" || !r.funcao || !r.riscos?.length) continue;
      const fId = funcaoMap.get(r.funcao.toLowerCase());
      if (!fId) continue;
      for (const risk of r.riscos) {
        const { data: ex } = await supabase.from("aso_riscos_funcao").select("id")
          .eq("funcao_id", fId).eq("grupo", risk.grupo).ilike("descricao", risk.descricao).maybeSingle();
        if (!ex) {
          await supabase.from("aso_riscos_funcao").insert({ empresa_id: empresaSel, funcao_id: fId, grupo: risk.grupo, descricao: risk.descricao });
        }
      }
    }

    // funcionarios upsert
    for (const r of rows) {
      if (r.status === "erro") { erros++; continue; }
      const payload: any = {
        empresa_id: empresaSel, nome: r.nome, cpf: r.cpf,
        cargo: r.funcao || null, setor: r.setor || null,
        matricula: r.matricula || null, data_admissao: r.data_admissao || null, ativo: true,
      };
      try {
        const { data: ex } = await supabase.from("funcionarios").select("id").eq("empresa_id", empresaSel).eq("cpf", r.cpf).maybeSingle();
        if (ex) { await supabase.from("funcionarios").update(payload).eq("id", ex.id); atualizados++; }
        else { await supabase.from("funcionarios").insert(payload); criados++; }
      } catch (e) { erros++; }
    }

    setResult({ criados, atualizados, erros });
    setImporting(false);
    toast.success(`Importação concluída: ${criados} novos, ${atualizados} atualizados, ${erros} erros`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />Importação de Funcionários via Excel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <Label>Empresa *</Label>
            <Select value={empresaSel} onValueChange={setEmpresaSel}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>{empresas.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 flex gap-2">
            <Button variant="outline" onClick={baixarModelo}><FileDown className="h-4 w-4 mr-1" />Baixar modelo</Button>
            <Label className="cursor-pointer">
              <Input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
              <Button asChild><span><Upload className="h-4 w-4 mr-1" />Carregar planilha</span></Button>
            </Label>
          </div>
        </div>

        {rows.length > 0 && (
          <>
            <div className="flex gap-3 text-sm">
              <Badge className="bg-emerald-500/15 text-emerald-700">Novos: {rows.filter(r => r.status === "novo").length}</Badge>
              <Badge className="bg-blue-500/15 text-blue-700">Atualizar: {rows.filter(r => r.status === "atualizar").length}</Badge>
              <Badge className="bg-destructive/15 text-destructive">Erros: {rows.filter(r => r.status === "erro").length}</Badge>
            </div>
            <div className="border rounded-lg max-h-[400px] overflow-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Nome</TableHead><TableHead>CPF</TableHead><TableHead>Setor</TableHead>
                  <TableHead>Função</TableHead><TableHead>Tipo ASO</TableHead><TableHead>Riscos</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="text-xs">{r.nome}</TableCell>
                      <TableCell className="font-mono text-xs">{r.cpf}</TableCell>
                      <TableCell className="text-xs">{r.setor || "—"}</TableCell>
                      <TableCell className="text-xs">{r.funcao || "—"}</TableCell>
                      <TableCell className="text-xs">{r.tipo_exame || "—"}</TableCell>
                      <TableCell className="text-xs">{r.riscos?.length || 0}</TableCell>
                      <TableCell>
                        {r.status === "novo" && <Badge className="bg-emerald-500/15 text-emerald-700"><CheckCircle2 className="h-3 w-3 mr-1" />Novo</Badge>}
                        {r.status === "atualizar" && <Badge className="bg-blue-500/15 text-blue-700">Atualizar</Badge>}
                        {r.status === "erro" && <Badge className="bg-destructive/15 text-destructive" title={r.msg}><XCircle className="h-3 w-3 mr-1" />{r.msg}</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setRows([]); setResult(null); }}>Limpar</Button>
              <Button onClick={importar} disabled={importing}>{importing ? "Importando…" : "Confirmar importação"}</Button>
            </div>
          </>
        )}

        {result && (
          <div className="border rounded-lg p-4 bg-muted/30 text-sm">
            <div className="font-medium mb-1">Relatório final</div>
            <div>✅ {result.criados} funcionários criados</div>
            <div>🔄 {result.atualizados} atualizados</div>
            <div>❌ {result.erros} com erro</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
