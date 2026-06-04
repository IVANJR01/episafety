import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileDown, Upload, Sparkles, FileText, AlertTriangle, Stethoscope, Briefcase, Loader2 } from "lucide-react";
import { toast } from "sonner";

const GRUPOS = ["fisico", "quimico", "biologico", "ergonomico", "acidente", "outro"];
const GRUPO_ALIASES: Record<string, string> = {
  fisico: "fisico", físico: "fisico", fisicos: "fisico", físicos: "fisico",
  quimico: "quimico", químico: "quimico", quimicos: "quimico", químicos: "quimico",
  biologico: "biologico", biológico: "biologico", biologicos: "biologico", biológicos: "biologico",
  ergonomico: "ergonomico", ergonômico: "ergonomico", ergonomicos: "ergonomico", ergonômicos: "ergonomico",
  acidente: "acidente", acidentes: "acidente", mecanico: "acidente", mecânico: "acidente",
  outro: "outro", outros: "outro",
};
const norm = (s: string) => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const normGrupo = (s: string) => GRUPO_ALIASES[norm(s)] || "outro";
const truthy = (v: any) => {
  const s = norm(String(v ?? ""));
  return s === "true" || s === "x" || s === "1" || s === "sim" || s === "yes";
};

export interface ParsedGhe {
  codigo: string;
  nome: string;
  setor?: string;
  descricao?: string;
  funcoes: string[];
  riscos: { grupo: string; tipo_agente: string; texto_aso?: string }[];
  exames: { nome_exame: string; codigo_exame?: string | null; admissional?: boolean; periodico?: boolean; retorno_trabalho?: boolean; mudanca_risco?: boolean; mudanca_funcao?: boolean; demissional?: boolean }[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  empresaId: string;
  onImported: () => void;
}

export default function PcmsoImportDialog({ open, onOpenChange, empresaId, onImported }: Props) {
  const [tab, setTab] = useState("xlsx");
  const [ghes, setGhes] = useState<ParsedGhe[]>([]);
  const [textoLivre, setTextoLivre] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const baixarModelo = () => {
    const cols = ["GHE Codigo", "GHE Nome", "Setor", "Descricao", "Funcao", "Risco Grupo", "Risco Agente", "Risco Texto ASO", "Exame Nome", "Exame Codigo", "Admissional", "Periodico", "Retorno", "Mudanca Risco", "Mudanca Funcao", "Demissional"];
    const rows = [
      cols,
      ["GHE 01", "Administrativo / PCP", "Administrativo", "Atividades administrativas", "Auxiliar Administrativo", "Ergonomico", "Postura sentada prolongada", "Postura sentada prolongada", "Clínico Ocupacional", "", "X", "X", "X", "", "", "X"],
      ["GHE 01", "Administrativo / PCP", "Administrativo", "", "Supervisor de PCP", "", "", "", "Acuidade Visual", "", "X", "X", "", "", "", ""],
      ["GHE 02", "Costura", "Costura", "Operação de máquinas de costura", "Costureiro(a)", "Ergonomico", "Movimentos repetitivos", "Movimentos repetitivos", "Clínico Ocupacional", "", "X", "X", "X", "", "", "X"],
      ["GHE 02", "Costura", "", "", "", "Fisico", "Ruído contínuo", "Ruído contínuo", "Audiometria", "", "X", "X", "", "", "", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PCMSO");
    XLSX.writeFile(wb, "Modelo-Importacao-PCMSO.xlsx");
  };

  const parseXlsx = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
    if (!raw.length) { toast.error("Planilha vazia"); return; }

    const get = (r: any, ...keys: string[]) => {
      for (const k of keys) {
        const found = Object.keys(r).find((x) => norm(x) === norm(k));
        if (found && r[found] !== "") return r[found];
      }
      return "";
    };

    const map = new Map<string, ParsedGhe>();
    for (const r of raw) {
      const codigo = String(get(r, "GHE Codigo", "GHE", "Codigo GHE", "Codigo") || "").trim();
      if (!codigo) continue;
      const nome = String(get(r, "GHE Nome", "Nome", "Nome GHE") || codigo).trim();
      const setor = String(get(r, "Setor") || "").trim();
      const descricao = String(get(r, "Descricao", "Descrição") || "").trim();
      const funcao = String(get(r, "Funcao", "Função") || "").trim();
      const rGrupo = String(get(r, "Risco Grupo", "Grupo") || "").trim();
      const rAgente = String(get(r, "Risco Agente", "Agente") || "").trim();
      const rTexto = String(get(r, "Risco Texto ASO", "Texto ASO") || "").trim();
      const eNome = String(get(r, "Exame Nome", "Exame") || "").trim();
      const eCod = String(get(r, "Exame Codigo", "Codigo Exame") || "").trim();

      const key = norm(codigo);
      if (!map.has(key)) map.set(key, { codigo, nome, setor, descricao, funcoes: [], riscos: [], exames: [] });
      const g = map.get(key)!;
      if (setor && !g.setor) g.setor = setor;
      if (descricao && !g.descricao) g.descricao = descricao;
      if (funcao && !g.funcoes.find((f) => norm(f) === norm(funcao))) g.funcoes.push(funcao);
      if (rAgente) {
        if (!g.riscos.find((x) => norm(x.tipo_agente) === norm(rAgente) && x.grupo === normGrupo(rGrupo))) {
          g.riscos.push({ grupo: normGrupo(rGrupo), tipo_agente: rAgente, texto_aso: rTexto || rAgente });
        }
      }
      if (eNome) {
        let ex = g.exames.find((x) => norm(x.nome_exame) === norm(eNome));
        if (!ex) {
          ex = { nome_exame: eNome, codigo_exame: eCod || null };
          g.exames.push(ex);
        }
        ex.admissional = ex.admissional || truthy(get(r, "Admissional"));
        ex.periodico = ex.periodico || truthy(get(r, "Periodico", "Periódico"));
        ex.retorno_trabalho = ex.retorno_trabalho || truthy(get(r, "Retorno", "Retorno Trabalho"));
        ex.mudanca_risco = ex.mudanca_risco || truthy(get(r, "Mudanca Risco", "Mudança Risco"));
        ex.mudanca_funcao = ex.mudanca_funcao || truthy(get(r, "Mudanca Funcao", "Mudança Função"));
        ex.demissional = ex.demissional || truthy(get(r, "Demissional"));
      }
    }
    setGhes([...map.values()]);
    toast.success(`${map.size} GHEs identificados na planilha`);
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result || "");
        const i = s.indexOf(",");
        resolve(i >= 0 ? s.slice(i + 1) : s);
      };
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });

  const parsePdfIA = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) return toast.error("PDF acima de 20MB. Reduza ou cole o texto.");
    setLoading(true);
    try {
      const pdf_base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("parse-pcmso", {
        body: { pdf_base64, mime_type: file.type || "application/pdf" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await applyParsed(data);
    } catch (e: any) {
      toast.error("Falha ao interpretar PDF: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const applyParsed = async (data: any) => {
    const parsed: ParsedGhe[] = (data?.ghes || []).map((g: any) => ({
      codigo: String(g.codigo || "").trim(),
      nome: String(g.nome || g.codigo || "").trim(),
      setor: g.setor || "",
      descricao: g.descricao || "",
      funcoes: Array.isArray(g.funcoes) ? g.funcoes.filter(Boolean) : [],
      riscos: (Array.isArray(g.riscos) ? g.riscos : []).map((r: any) => ({
        grupo: normGrupo(r.grupo), tipo_agente: String(r.tipo_agente || "").trim(),
        texto_aso: String(r.texto_aso || r.tipo_agente || "").trim(),
      })).filter((r: any) => r.tipo_agente),
      exames: (Array.isArray(g.exames) ? g.exames : []).map((e: any) => ({
        nome_exame: String(e.nome_exame || "").trim(),
        codigo_exame: e.codigo_exame || null,
        admissional: !!e.admissional, periodico: !!e.periodico, retorno_trabalho: !!e.retorno_trabalho,
        mudanca_risco: !!e.mudanca_risco, mudanca_funcao: !!e.mudanca_funcao, demissional: !!e.demissional,
      })).filter((e: any) => e.nome_exame),
    })).filter((g: ParsedGhe) => g.codigo || g.nome);
    setGhes(parsed);
    toast.success(`IA identificou ${parsed.length} GHEs`);
  };

  const parseTextoIA = async () => {
    if (!textoLivre.trim()) return toast.error("Cole o texto do PCMSO");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-pcmso", { body: { texto: textoLivre } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await applyParsed(data);
    } catch (e: any) {
      toast.error("Falha ao interpretar: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };



  const importar = async () => {
    if (!ghes.length || !empresaId) return;
    setImporting(true);
    let okGhe = 0, okFunc = 0, okRisco = 0, okExame = 0, errs = 0;
    try {
      for (const g of ghes) {
        // upsert GHE by codigo
        const { data: ex } = await supabase.from("ghe_ges").select("id").eq("empresa_id", empresaId).eq("codigo", g.codigo).maybeSingle();
        let gheId = ex?.id;
        if (gheId) {
          await supabase.from("ghe_ges").update({ nome: g.nome, setor: g.setor || null, descricao: g.descricao || null }).eq("id", gheId);
        } else {
          const { data: ins, error } = await supabase.from("ghe_ges").insert({
            empresa_id: empresaId, codigo: g.codigo, nome: g.nome, setor: g.setor || null, descricao: g.descricao || null,
          }).select("id").single();
          if (error || !ins) { errs++; continue; }
          gheId = ins.id;
        }
        okGhe++;

        // funcoes - skip duplicates
        if (g.funcoes.length) {
          const { data: fex = [] } = await supabase.from("ghe_funcoes").select("nome_funcao").eq("ghe_id", gheId);
          const existing = new Set((fex || []).map((f: any) => norm(f.nome_funcao)));
          const novas = g.funcoes.filter((f) => !existing.has(norm(f)));
          if (novas.length) {
            const { error } = await supabase.from("ghe_funcoes").insert(novas.map((nome_funcao) => ({ ghe_id: gheId, empresa_id: empresaId, nome_funcao })));
            if (!error) okFunc += novas.length;
          }
        }

        // riscos - skip duplicates by grupo+tipo_agente
        if (g.riscos.length) {
          const { data: rex = [] } = await supabase.from("ghe_riscos").select("grupo, tipo_agente").eq("ghe_id", gheId);
          const existing = new Set((rex || []).map((r: any) => `${r.grupo}|${norm(r.tipo_agente)}`));
          const novos = g.riscos.filter((r) => !existing.has(`${r.grupo}|${norm(r.tipo_agente)}`));
          if (novos.length) {
            const { error } = await supabase.from("ghe_riscos").insert(novos.map((r) => ({
              ghe_id: gheId, empresa_id: empresaId, grupo: r.grupo, tipo_agente: r.tipo_agente, texto_aso: r.texto_aso || r.tipo_agente,
            })));
            if (!error) okRisco += novos.length;
          }
        }

        // exames - skip duplicates by nome
        if (g.exames.length) {
          const { data: eex = [] } = await supabase.from("ghe_exames").select("nome_exame").eq("ghe_id", gheId);
          const existing = new Set((eex || []).map((e: any) => norm(e.nome_exame)));
          const novos = g.exames.filter((e) => !existing.has(norm(e.nome_exame)));
          if (novos.length) {
            const { error } = await supabase.from("ghe_exames").insert(novos.map((e) => ({
              ghe_id: gheId, empresa_id: empresaId,
              nome_exame: e.nome_exame, codigo_exame: e.codigo_exame || null,
              admissional: !!e.admissional, periodico: !!e.periodico, retorno_trabalho: !!e.retorno_trabalho,
              mudanca_risco: !!e.mudanca_risco, mudanca_funcao: !!e.mudanca_funcao, demissional: !!e.demissional,
            })));
            if (!error) okExame += novos.length;
          }
        }
      }
      toast.success(`Importado: ${okGhe} GHEs, ${okFunc} funções, ${okRisco} riscos, ${okExame} exames` + (errs ? ` (${errs} erros)` : ""));
      onImported();
      onOpenChange(false);
      setGhes([]); setTextoLivre("");
    } catch (e: any) {
      toast.error("Falha: " + (e?.message || e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Importar PCMSO</DialogTitle>
          <p className="text-sm text-muted-foreground">Crie GHEs, funções, riscos e exames automaticamente a partir de uma planilha ou colagem do PCMSO.</p>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="xlsx">Planilha</TabsTrigger>
            <TabsTrigger value="pdf"><FileText className="h-3 w-3 mr-1" />PDF (IA)</TabsTrigger>
            <TabsTrigger value="texto"><Sparkles className="h-3 w-3 mr-1" />Texto (IA)</TabsTrigger>
          </TabsList>

          <TabsContent value="xlsx" className="mt-3 space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={baixarModelo}><FileDown className="h-4 w-4 mr-1" />Baixar modelo</Button>
              <Label className="cursor-pointer">
                <Input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && parseXlsx(e.target.files[0])} />
                <Button asChild><span><Upload className="h-4 w-4 mr-1" />Carregar planilha</span></Button>
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Colunas esperadas: <code>GHE Codigo, GHE Nome, Setor, Descricao, Funcao, Risco Grupo, Risco Agente, Risco Texto ASO, Exame Nome, Exame Codigo, Admissional, Periodico, Retorno, Mudanca Risco, Mudanca Funcao, Demissional</code>.
              Use uma linha por combinação. O sistema agrupa por <code>GHE Codigo</code>.
            </p>
          </TabsContent>

          <TabsContent value="pdf" className="mt-3 space-y-3">
            <Label className="text-xs">Envie o PDF do PCMSO. A IA lê o documento completo (Quadro Laboral, GHEs, riscos e exames) e estrutura para importação.</Label>
            <div className="flex gap-2 flex-wrap items-center">
              <Label className="cursor-pointer">
                <Input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && parsePdfIA(e.target.files[0])} disabled={loading} />
                <Button asChild disabled={loading}>
                  <span>
                    {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                    {loading ? "Interpretando PDF..." : "Carregar PDF do PCMSO"}
                  </span>
                </Button>
              </Label>
              <span className="text-xs text-muted-foreground">Até 20 MB. A IA pode levar 30-60s.</span>
            </div>
            <p className="text-xs text-muted-foreground">A IA extrai GHEs/GES, funções por setor, riscos (físico, químico, biológico, ergonômico, acidente) e exames (admissional, periódico, etc.) diretamente do PDF.</p>
          </TabsContent>

          <TabsContent value="texto" className="mt-3 space-y-3">
            <Label className="text-xs">Cole o texto do PCMSO (Quadro Laboral, lista por GHE, tabela copiada de PDF, etc.)</Label>
            <Textarea rows={10} value={textoLivre} onChange={(e) => setTextoLivre(e.target.value)} placeholder="GHE 01 — Administrativo / PCP&#10;Funções: Auxiliar Administrativo, Supervisor de PCP&#10;Riscos: Ergonômico — postura sentada prolongada&#10;Exames: Clínico ocupacional, Acuidade visual&#10;&#10;GHE 02 — Costura..." />
            <div className="flex justify-end">
              <Button onClick={parseTextoIA} disabled={loading || !textoLivre.trim()}>
                {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                Interpretar com IA
              </Button>
            </div>
          </TabsContent>
        </Tabs>


        {ghes.length > 0 && (
          <div className="border rounded-lg p-3 space-y-2 mt-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Pré-visualização ({ghes.length} GHEs)</div>
              <Button size="sm" variant="ghost" onClick={() => setGhes([])}>Limpar</Button>
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {ghes.map((g, i) => (
                <div key={i} className="border rounded p-2 bg-background">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-sm">{g.codigo}</span>
                      <span className="text-sm"> — {g.nome}</span>
                      {g.setor && <span className="text-xs text-muted-foreground"> · {g.setor}</span>}
                    </div>
                    <div className="flex gap-1">
                      <Badge variant="secondary" className="gap-1"><Briefcase className="h-3 w-3" />{g.funcoes.length}</Badge>
                      <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" />{g.riscos.length}</Badge>
                      <Badge variant="secondary" className="gap-1"><Stethoscope className="h-3 w-3" />{g.exames.length}</Badge>
                    </div>
                  </div>
                  {g.funcoes.length > 0 && <div className="text-xs text-muted-foreground mt-1"><b>Funções:</b> {g.funcoes.join(", ")}</div>}
                  {g.riscos.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      <b>Riscos:</b> {g.riscos.map((r) => `${r.grupo}: ${r.tipo_agente}`).join(" • ")}
                    </div>
                  )}
                  {g.exames.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      <b>Exames:</b> {g.exames.map((e) => e.nome_exame).join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={importar} disabled={importing || !ghes.length}>
            {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Confirmar importação ({ghes.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
