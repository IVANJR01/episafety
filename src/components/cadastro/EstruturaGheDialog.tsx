import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil, Save, X, ClipboardPaste } from "lucide-react";
import { toast } from "sonner";

interface Props {
  ghe: any;
  onClose: () => void;
  mode?: "dialog" | "page";
}

const GRUPOS_RISCO = ["fisico", "quimico", "biologico", "ergonomico", "acidente", "outro"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function EstruturaGheDialog({ ghe, onClose, mode = "dialog" }: Props) {
  const isPage = mode === "page";
  const [tab, setTab] = useState("ambiente");

  /* ---------- Ambiente (agora inclui Código, Nome e Ativo) ---------- */
  const [amb, setAmb] = useState({
    codigo: ghe.codigo || "",
    nome: ghe.nome || "",
    status: ghe.status || "ativo",
    ambiente: ghe.ambiente || "",
    descricao_ambiente: ghe.descricao_ambiente || "",
    processo: ghe.processo || "",
    descricao: ghe.descricao || "",
    setores: ((ghe.setores && ghe.setores.length ? ghe.setores : ghe.setor ? [ghe.setor] : []) as string[]),
  });
  const [savingAmb, setSavingAmb] = useState(false);

  const salvarAmbiente = async () => {
    if (!amb.codigo.trim()) return toast.error("Código do GES é obrigatório");
    setSavingAmb(true);
    const setoresArr = amb.setores.map((s) => s.trim()).filter(Boolean);

    const { error } = await supabase
      .from("ghe_ges")
      .update({
        codigo: amb.codigo.trim(),
        nome: (amb.nome?.trim() || amb.codigo.trim()),
        status: amb.status,
        ambiente: amb.ambiente?.trim() || null,
        descricao_ambiente: amb.descricao_ambiente?.trim() || null,
        processo: amb.processo?.trim() || null,
        descricao: amb.descricao?.trim() || null,
        setores: setoresArr,
        setor: setoresArr[0] || null,
      })
      .eq("id", ghe.id);
    setSavingAmb(false);
    if (error) return toast.error(error.message);
    toast.success("Ambiente salvo");
    ghe.codigo = amb.codigo; ghe.nome = amb.nome; ghe.status = amb.status;
    ghe.ambiente = amb.ambiente; ghe.descricao_ambiente = amb.descricao_ambiente;
    ghe.processo = amb.processo;
    ghe.descricao = amb.descricao; ghe.setores = setoresArr;
  };

  /* ---------- EPIs / Medidas ---------- */
  const [epis, setEpis] = useState({
    medidas_controle_existentes: ghe.medidas_controle_existentes || "",
    medidas_controle_recomendadas: ghe.medidas_controle_recomendadas || "",
    epcs: ghe.epcs || "",
    capacitacoes_obrigatorias: ghe.capacitacoes_obrigatorias || "",
    observacoes_tecnicas: ghe.observacoes_tecnicas || "",
  });
  const [savingEpis, setSavingEpis] = useState(false);
  const salvarEpis = async () => {
    setSavingEpis(true);
    const { error } = await supabase
      .from("ghe_ges")
      .update({
        medidas_controle_existentes: epis.medidas_controle_existentes?.trim() || null,
        medidas_controle_recomendadas: epis.medidas_controle_recomendadas?.trim() || null,
        epcs: epis.epcs?.trim() || null,
        capacitacoes_obrigatorias: epis.capacitacoes_obrigatorias?.trim() || null,
        observacoes_tecnicas: epis.observacoes_tecnicas?.trim() || null,
      })
      .eq("id", ghe.id);
    setSavingEpis(false);
    if (error) return toast.error(error.message);
    toast.success("EPIs e medidas salvos");
    ghe.medidas_controle_existentes = epis.medidas_controle_existentes;
    ghe.medidas_controle_recomendadas = epis.medidas_controle_recomendadas;
    ghe.epcs = epis.epcs;
    ghe.capacitacoes_obrigatorias = epis.capacitacoes_obrigatorias;
    ghe.observacoes_tecnicas = epis.observacoes_tecnicas;
  };


  /* ---------- Setores (nova tabela ghe_setores) ---------- */
  const [setoresRows, setSetoresRows] = useState<any[]>([]);
  const [loadingS, setLoadingS] = useState(false);
  const [editS, setEditS] = useState<any | null>(null);
  const [bulkSOpen, setBulkSOpen] = useState(false);
  const [bulkS, setBulkS] = useState("");

  const loadSetores = async () => {
    setLoadingS(true);
    const { data, error } = await (supabase as any)
      .from("ghe_setores")
      .select("id, nome, processo, observacoes, ativo")
      .eq("ghe_id", ghe.id)
      .order("nome");
    setLoadingS(false);
    if (error) return toast.error(error.message);
    setSetoresRows((data as any[]) || []);
  };
  useEffect(() => { loadSetores(); /* eslint-disable-next-line */ }, [ghe.id]);

  const salvarSetorRow = async (s: any) => {
    const nome = (s.nome || "").trim();
    const processo = (s.processo || "").trim();
    if (!nome) return toast.error("Nome do setor é obrigatório");
    if (!processo) return toast.error("Informe o processo do setor");
    const dup = setoresRows.find((x) => x.id !== s.id && (x.nome || "").trim().toLowerCase() === nome.toLowerCase());
    if (dup) return toast.error(`Setor "${nome}" já existe neste GES`);
    const payload: any = {
      ghe_id: ghe.id,
      empresa_id: ghe.empresa_id,
      nome, processo,
      observacoes: s.observacoes?.trim() || null,
      ativo: s.ativo ?? true,
    };
    const { error } = s.id
      ? await (supabase as any).from("ghe_setores").update(payload).eq("id", s.id)
      : await (supabase as any).from("ghe_setores").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Setor salvo");
    setEditS(null);
    loadSetores();
  };

  const excluirSetor = async (id: string) => {
    if (!confirm("Excluir este setor? As funções vinculadas mantêm o nome do setor.")) return;
    const { error } = await (supabase as any).from("ghe_setores").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadSetores();
  };

  const importarSetoresBulk = async () => {
    const lines = bulkS.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const rows = lines.map((l) => {
      const [nome, processo, observacoes] = l.split(/[|\t]/).map((p) => p.trim());
      return {
        ghe_id: ghe.id,
        empresa_id: ghe.empresa_id,
        nome: nome || "",
        processo: processo || null,
        observacoes: observacoes || null,
      };
    }).filter((r) => r.nome && r.processo);
    if (!rows.length) return toast.error("Nenhuma linha válida (precisa Setor | Processo)");
    const existentes = new Set(setoresRows.map((s) => (s.nome || "").toLowerCase()));
    const novos = rows.filter((r) => !existentes.has(r.nome.toLowerCase()));
    if (!novos.length) { toast.info("Todos os setores da lista já existem"); setBulkS(""); setBulkSOpen(false); return; }
    const { error } = await (supabase as any).from("ghe_setores").insert(novos);
    if (error) return toast.error(error.message);
    toast.success(`${novos.length} setor(es) importado(s)`);
    setBulkS(""); setBulkSOpen(false);
    loadSetores();
  };

  /* ---------- Funções ---------- */
  const [funcoes, setFuncoes] = useState<any[]>([]);
  const [loadingF, setLoadingF] = useState(false);
  const [editF, setEditF] = useState<any | null>(null);
  const [modoTabela, setModoTabela] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState("");

  const loadFuncoes = async () => {
    setLoadingF(true);
    const { data, error } = await supabase
      .from("ghe_funcoes")
      .select("id, nome_funcao, cbo, descricao_atividade, setor, processo, quantidade_trabalhadores, observacoes")
      .eq("ghe_id", ghe.id)
      .order("setor", { ascending: true })
      .order("nome_funcao", { ascending: true });
    setLoadingF(false);
    if (error) return toast.error(error.message);
    setFuncoes(data || []);
  };
  useEffect(() => { loadFuncoes(); /* eslint-disable-next-line */ }, [ghe.id]);

  const setoresAtivos: string[] = useMemo(() => {
    const dos = setoresRows.map((s) => s.nome).filter(Boolean) as string[];
    const dasFuncoes = Array.from(new Set(funcoes.map((f) => f.setor).filter(Boolean))) as string[];
    return Array.from(new Set([...dos, ...dasFuncoes]));
  }, [setoresRows, funcoes]);


  const funcoesPorSetor = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const s of setoresAtivos) map.set(s, []);
    const semSetor: any[] = [];
    for (const f of funcoes) {
      if (f.setor && map.has(f.setor)) map.get(f.setor)!.push(f);
      else if (f.setor) map.set(f.setor, [f]);
      else semSetor.push(f);
    }
    if (semSetor.length) map.set("(sem setor)", semSetor);
    return map;
  }, [funcoes, setoresAtivos]);

  const salvarFuncao = async (f: any) => {
    const nome = (f.nome_funcao || "").trim();
    const setor = (f.setor || "").trim();
    const atividade = (f.descricao_atividade || "").trim();
    if (!nome) return toast.error("Nome da função é obrigatório");
    if (!setor) return toast.error("Selecione o setor da função");
    if (!atividade) return toast.error("Informe o Processo / atividade desta função");
    // valida duplicidade por GES + Setor + Função
    const dup = funcoes.find(
      (x) => x.id !== f.id &&
        (x.nome_funcao || "").trim().toLowerCase() === nome.toLowerCase() &&
        (x.setor || "").trim().toLowerCase() === setor.toLowerCase()
    );
    if (dup) return toast.error(`Já existe a função "${nome}" no setor "${setor}" deste GES`);
    const payload: any = {
      ghe_id: ghe.id,
      empresa_id: ghe.empresa_id,
      nome_funcao: nome,
      cbo: f.cbo?.trim() || null,
      descricao_atividade: atividade,
      setor,
      processo: null,
      quantidade_trabalhadores:
        f.quantidade_trabalhadores === "" || f.quantidade_trabalhadores == null
          ? null
          : Number(f.quantidade_trabalhadores),
      observacoes: f.observacoes?.trim() || null,
    };
    const { error } = f.id
      ? await supabase.from("ghe_funcoes").update(payload).eq("id", f.id)
      : await supabase.from("ghe_funcoes").insert(payload);
    if (error) return toast.error(error.message);
    setEditF(null);
    loadFuncoes();
  };

  const excluirFuncao = async (id: string) => {
    if (!confirm("Excluir esta função?")) return;
    const { error } = await supabase.from("ghe_funcoes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadFuncoes();
  };

  const importarBulk = async () => {
    const lines = bulk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const rows = lines.map((l) => {
      const parts = l.split(/[|\t]/).map((p) => p.trim());
      const [setor, nome_funcao, processo, qtd, obs] = parts;
      return {
        ghe_id: ghe.id,
        empresa_id: ghe.empresa_id,
        setor: setor || null,
        nome_funcao: nome_funcao || setor || "",
        descricao_atividade: processo || null,
        processo: null,
        quantidade_trabalhadores: qtd && !isNaN(Number(qtd)) ? Number(qtd) : null,
        observacoes: obs || null,
      };
    }).filter((r) => r.nome_funcao && r.setor && r.descricao_atividade);
    if (!rows.length) return toast.error("Nenhuma linha válida (precisa Setor | Função | Processo)");
    const { error } = await supabase.from("ghe_funcoes").insert(rows as any);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} linha(s) importadas`);
    setBulk(""); setBulkOpen(false);
    // garante que os setores usados existam em ghe_setores (sem processo — usuário completa depois)
    const existentes = new Set(setoresRows.map((s) => (s.nome || "").toLowerCase()));
    const novosSetores = Array.from(new Set(rows.map((r) => r.setor).filter(Boolean))) as string[];
    const faltantes = novosSetores.filter((n) => !existentes.has(n.toLowerCase()));
    if (faltantes.length) {
      await (supabase as any).from("ghe_setores").insert(
        faltantes.map((nome) => ({ ghe_id: ghe.id, empresa_id: ghe.empresa_id, nome, processo: null }))
      );
      loadSetores();
    }
    loadFuncoes();
  };


  /* ---------- Riscos ---------- */
  const [riscos, setRiscos] = useState<any[]>([]);
  const [loadingR, setLoadingR] = useState(false);
  const [editR, setEditR] = useState<any | null>(null);

  const loadRiscos = async () => {
    setLoadingR(true);
    const { data, error } = await supabase.from("ghe_riscos").select("*").eq("ghe_id", ghe.id).order("grupo");
    setLoadingR(false);
    if (error) return toast.error(error.message);
    setRiscos(data || []);
  };
  useEffect(() => { loadRiscos(); /* eslint-disable-next-line */ }, [ghe.id]);

  const salvarRisco = async (r: any) => {
    if (!r.grupo) return toast.error("Grupo é obrigatório");
    if (!r.tipo_agente?.trim() && !r.perigo_fonte?.trim()) return toast.error("Informe o perigo/agente");
    const payload: any = {
      ghe_id: ghe.id,
      empresa_id: ghe.empresa_id,
      grupo: r.grupo,
      tipo_agente: r.tipo_agente?.trim() || null,
      perigo_fonte: r.perigo_fonte?.trim() || null,
      exposicao: r.exposicao || null,
      possiveis_lesoes: r.possiveis_lesoes?.trim() || null,
      limite_exposicao: r.limite_exposicao?.trim() || null,
      especifico_funcao: !!r.funcao_id,
      funcao_id: r.funcao_id || null,
    };
    const { error } = r.id
      ? await supabase.from("ghe_riscos").update(payload).eq("id", r.id)
      : await supabase.from("ghe_riscos").insert(payload);
    if (error) return toast.error(error.message);
    setEditR(null); loadRiscos();
  };

  const excluirRisco = async (id: string) => {
    if (!confirm("Excluir este risco?")) return;
    const { error } = await supabase.from("ghe_riscos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    loadRiscos();
  };

  const nomeFuncao = (id: string | null) => funcoes.find((f) => f.id === id)?.nome_funcao || "—";
  const riscosComuns = riscos.filter((r) => !r.funcao_id);
  const riscosEspec = riscos.filter((r) => !!r.funcao_id);

  // (removidos: salvarSetores/colarSetoresBulk baseados no array antigo — agora usamos a tabela ghe_setores)


  const bodyContent = (
    <Tabs value={tab} onValueChange={setTab} className={isPage ? "flex-1 min-h-0 flex flex-col" : "flex-1 min-h-0 flex flex-col sm:px-6 sm:pb-6 overflow-hidden"}>
      <div className="w-full overflow-x-auto -mx-1 px-1">
        <TabsList className="inline-flex w-max min-w-full sm:min-w-0 sm:w-auto self-start">
          <TabsTrigger value="ambiente">Ambiente</TabsTrigger>
          <TabsTrigger value="setores">Setores</TabsTrigger>
          <TabsTrigger value="funcoes">Funções</TabsTrigger>
        </TabsList>
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="border rounded p-2"><span className="text-muted-foreground">GES:</span> <b>{amb.codigo || "—"}</b></div>
        <div className="border rounded p-2"><span className="text-muted-foreground">Ambiente:</span> <b>{amb.ambiente ? "informado" : "não informado"}</b></div>
        <div className="border rounded p-2"><span className="text-muted-foreground">Setores:</span> <b>{setoresRows.length}</b></div>
        <div className="border rounded p-2"><span className="text-muted-foreground">Funções:</span> <b>{funcoes.length}</b></div>
      </div>



          {/* ---------- Aba Ambiente ---------- */}
          <TabsContent value="ambiente" className="mt-3 space-y-3 overflow-y-auto overflow-x-hidden sm:max-h-[65vh] sm:pr-1">
            <div>
              <Label className="text-xs">Código do GES *</Label>
              <Input value={amb.codigo} onChange={(e) => setAmb({ ...amb, codigo: e.target.value, nome: e.target.value })} placeholder="GES 01" className="w-full sm:max-w-xs" />
            </div>
            <div>
              <Label className="text-xs">Descrição do ambiente</Label>
              <Textarea
                rows={5}
                value={amb.descricao_ambiente}
                onChange={(e) => setAmb({ ...amb, descricao_ambiente: e.target.value })}
                placeholder="Ex.: Ambiente de trabalho interno, pé direito em torno de 3m, piso do tipo cerâmico, ventilação artificial por condicionadores de ar, iluminação artificial por lâmpadas fluorescentes, teto de gesso com laje em concreto."
              />
              <p className="text-xs text-muted-foreground mt-1">Este texto será importado no PGR no campo "Descrição do ambiente".</p>
            </div>
            <div>
              <Label className="text-xs">Ativo</Label>
              <Select value={amb.status} onValueChange={(v) => setAmb({ ...amb, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Sim</SelectItem>
                  <SelectItem value="inativo">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end">
              <Button onClick={salvarAmbiente} disabled={savingAmb}>
                <Save className="h-4 w-4 mr-1" /> Salvar ambiente
              </Button>
            </div>
          </TabsContent>

          {/* ---------- Aba Setores ---------- */}
          <TabsContent value="setores" className="mt-3 space-y-3 overflow-y-auto overflow-x-hidden sm:max-h-[65vh] sm:pr-1">
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <p className="text-xs text-muted-foreground flex-1 min-w-[220px]">
                Cadastre cada <b>setor</b> deste GES com seu respectivo <b>processo</b>. Ex.: <i>PCP — Gerencia o processo produtivo</i>. As funções serão vinculadas a esses setores.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setBulkSOpen(!bulkSOpen)}>
                  <ClipboardPaste className="h-4 w-4 mr-1" />Colar em lote
                </Button>
                <Button size="sm" onClick={() => setEditS({ nome: "", processo: "", ativo: true })}>
                  <Plus className="h-4 w-4 mr-1" />Adicionar setor
                </Button>
              </div>
            </div>

            {bulkSOpen && (
              <div className="border rounded p-3 bg-muted/30 space-y-2">
                <Label className="text-xs">Colar um setor por linha, campos separados por | ou tab</Label>
                <p className="text-xs text-muted-foreground">Formato: <code>Setor | Processo | Observações (opc.)</code></p>
                <Textarea rows={5} value={bulkS} onChange={(e) => setBulkS(e.target.value)}
                  placeholder={"PCP | Gerencia todo o processo produtivo\nFinanceiro | Apura saldo, contas a pagar e receber\nRH | Rotinas de pessoal\nSESMT | Vistorias e acompanhamento de segurança"} />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => { setBulkS(""); setBulkSOpen(false); }}>Cancelar</Button>
                  <Button size="sm" onClick={importarSetoresBulk} disabled={!bulkS.trim()}>Importar</Button>
                </div>
              </div>
            )}

            {editS && (
              <div className="border rounded p-3 bg-muted/30 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Setor *</Label>
                    <Input value={editS.nome || ""} onChange={(e) => setEditS({ ...editS, nome: e.target.value })} placeholder="Ex.: Financeiro" />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex items-center gap-2">
                      <Checkbox id="setor-ativo" checked={editS.ativo ?? true} onCheckedChange={(v) => setEditS({ ...editS, ativo: !!v })} />
                      <Label htmlFor="setor-ativo" className="text-xs">Ativo</Label>
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Processo do setor *</Label>
                  <Textarea rows={3} value={editS.processo || ""}
                    onChange={(e) => setEditS({ ...editS, processo: e.target.value })}
                    placeholder="Ex.: Apura e projeta saldo disponível, contas a pagar e receber." />
                </div>
                <div>
                  <Label className="text-xs">Observações</Label>
                  <Textarea rows={2} value={editS.observacoes || ""} onChange={(e) => setEditS({ ...editS, observacoes: e.target.value })} />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setEditS(null)}>Cancelar</Button>
                  <Button size="sm" onClick={() => salvarSetorRow(editS)}><Save className="h-4 w-4 mr-1" />Salvar setor</Button>
                </div>
              </div>
            )}

            {loadingS && <p className="text-sm text-muted-foreground">Carregando…</p>}

            {!loadingS && setoresRows.length === 0 && !editS && (
              <div className="border rounded p-6 text-center text-sm text-muted-foreground">
                Nenhum setor cadastrado. Clique em <b>Adicionar setor</b> para começar.
              </div>
            )}

            {/* Mobile: cards */}
            {!loadingS && setoresRows.length > 0 && (
              <div className="sm:hidden space-y-2">
                {setoresRows.map((s) => (
                  <div key={s.id} className="border rounded p-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm break-words">{s.nome}</div>
                        {!s.ativo && <Badge variant="outline" className="text-[10px] mt-1">inativo</Badge>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" onClick={() => setEditS(s)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => excluirSetor(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>
                    <p className="text-xs whitespace-pre-wrap"><span className="text-muted-foreground">Processo:</span> {s.processo || "—"}</p>
                    {s.observacoes && <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{s.observacoes}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Desktop: tabela */}
            {!loadingS && setoresRows.length > 0 && (
              <div className="hidden sm:block border rounded overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Setor</TableHead>
                      <TableHead>Processo do setor</TableHead>
                      <TableHead className="w-[80px]">Ativo</TableHead>
                      <TableHead className="w-[100px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {setoresRows.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm font-medium">{s.nome}</TableCell>
                        <TableCell className="text-xs whitespace-pre-wrap">{s.processo || "—"}</TableCell>
                        <TableCell className="text-sm">{s.ativo ? "Sim" : "Não"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => setEditS(s)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => excluirSetor(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>




          {/* ---------- Aba Setores e Funções ---------- */}
          <TabsContent value="funcoes" className="mt-3 space-y-3 overflow-y-auto sm:max-h-[65vh] sm:pr-1">
            <div className="flex flex-wrap gap-2 justify-between items-center">
              <div className="flex gap-2">
                <Button size="sm" variant={modoTabela ? "outline" : "default"} onClick={() => setModoTabela(false)}>Accordion</Button>
                <Button size="sm" variant={modoTabela ? "default" : "outline"} onClick={() => setModoTabela(true)}>Tabela</Button>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setBulkOpen(!bulkOpen)}>
                  <ClipboardPaste className="h-4 w-4 mr-1" />Colar em lote
                </Button>
                <Button size="sm" onClick={() => setEditF({ nome_funcao: "", setor: setoresAtivos[0] || "" })}>
                  <Plus className="h-4 w-4 mr-1" />Nova função
                </Button>
              </div>
            </div>

            {bulkOpen && (
              <div className="border rounded p-3 bg-muted/30 space-y-2">
                <Label className="text-xs">Colar uma função por linha, campos separados por | ou tab</Label>
                <p className="text-xs text-muted-foreground">Formato: <code>Setor | Função | Processo/Atividade | Qtd | Obs</code></p>
                <Textarea rows={5} value={bulk} onChange={(e) => setBulk(e.target.value)}
                  placeholder="PCP | Supervisor de Produção | Gerencia todo o processo produtivo | 1&#10;Financeiro | Assistente Financeiro | Apura e projeta saldo disponível | 2&#10;RH | Auxiliar Administrativo | Planeja e controla rotinas de pessoal | 1" />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => { setBulk(""); setBulkOpen(false); }}>Cancelar</Button>
                  <Button size="sm" onClick={importarBulk} disabled={!bulk.trim()}>Importar</Button>
                </div>
              </div>
            )}

            {editF && (
              <div className="border rounded p-3 bg-muted/30 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Setor</Label>
                    {setoresAtivos.length > 0 ? (
                      <Select value={editF.setor || ""} onValueChange={(v) => setEditF({ ...editF, setor: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecionar setor" /></SelectTrigger>
                        <SelectContent>
                          {setoresAtivos.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={editF.setor || ""} onChange={(e) => setEditF({ ...editF, setor: e.target.value })} />
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Função *</Label>
                    <Input value={editF.nome_funcao || ""} onChange={(e) => setEditF({ ...editF, nome_funcao: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Processo / atividade *</Label>
                  <Textarea rows={3} value={editF.descricao_atividade || ""}
                    onChange={(e) => setEditF({ ...editF, descricao_atividade: e.target.value })}
                    placeholder="Ex.: Apura e projeta o saldo disponível da empresa para garantir capital de giro…" />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Este processo é específico desta combinação <b>Setor + Função</b>. A mesma função em outro setor pode ter processo diferente.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Qtd trabalhadores</Label>
                    <Input type="number" min={0} value={editF.quantidade_trabalhadores ?? ""} onChange={(e) => setEditF({ ...editF, quantidade_trabalhadores: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">CBO</Label>
                    <Input value={editF.cbo || ""} onChange={(e) => setEditF({ ...editF, cbo: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Observações</Label>
                  <Textarea rows={2} value={editF.observacoes || ""} onChange={(e) => setEditF({ ...editF, observacoes: e.target.value })} />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setEditF(null)}>Cancelar</Button>
                  <Button size="sm" onClick={() => salvarFuncao(editF)}>Salvar função</Button>
                </div>
              </div>
            )}

            {loadingF && <p className="text-sm text-muted-foreground">Carregando…</p>}

            {!loadingF && !modoTabela && (
              <Accordion type="multiple" defaultValue={Array.from(funcoesPorSetor.keys())} className="border rounded">
                {Array.from(funcoesPorSetor.entries()).map(([setor, fs]) => (
                  <AccordionItem key={setor} value={setor} className="px-3">
                    <AccordionTrigger className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{setor}</span>
                        <Badge variant="outline" className="text-xs">{fs.length} funç.</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      {fs.length === 0 && <p className="text-xs text-muted-foreground italic">Nenhuma função ainda.</p>}
                      {fs.map((f) => (
                        <div key={f.id} className="border rounded p-2 flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-sm">{f.nome_funcao}</span>
                              {f.cbo && <span className="text-xs text-muted-foreground">CBO {f.cbo}</span>}
                              {f.quantidade_trabalhadores != null && <Badge variant="secondary" className="text-xs">{f.quantidade_trabalhadores} trab.</Badge>}
                            </div>
                            {(f.descricao_atividade || f.processo) && (
                              <p className="text-xs mt-1"><span className="text-muted-foreground">Processo:</span> <span className="whitespace-pre-wrap">{f.descricao_atividade || f.processo}</span></p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => setEditF(f)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => excluirFuncao(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </div>
                      ))}
                      <Button size="sm" variant="outline" onClick={() => setEditF({ nome_funcao: "", setor })}>
                        <Plus className="h-3 w-3 mr-1" />Adicionar função em {setor}
                      </Button>
                    </AccordionContent>
                  </AccordionItem>
                ))}
                {funcoesPorSetor.size === 0 && (
                  <div className="p-4 text-sm text-muted-foreground italic">
                    Cadastre setores na aba <b>Ambiente</b> ou clique em <b>Nova função</b>.
                  </div>
                )}
              </Accordion>
            )}

            {!loadingF && modoTabela && (
              <div className="border rounded overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Setor</TableHead>
                      <TableHead className="w-[180px]">Função</TableHead>
                      <TableHead>Processo / Atividade</TableHead>
                      <TableHead className="w-[80px]">Qtd</TableHead>
                      <TableHead className="w-[100px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {funcoes.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground italic">Nenhuma função cadastrada.</TableCell></TableRow>
                    )}
                    {funcoes.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="text-sm">{f.setor || "—"}</TableCell>
                        <TableCell className="text-sm font-medium">{f.nome_funcao}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{f.descricao_atividade || f.processo || "—"}</TableCell>
                        <TableCell className="text-sm">{f.quantidade_trabalhadores ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => setEditF(f)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => excluirFuncao(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Abas Riscos, EPIs/Medidas e Resumo removidas desta tela — serão tratadas em módulo próprio. */}


    </Tabs>
  );

  if (isPage) {
    return (
      <div className="flex flex-col min-h-[calc(100dvh-4rem)] w-full max-w-full overflow-x-hidden">
        <div className="border-b pb-3 mb-3">
          <h1 className="text-lg font-semibold break-words">
            Estrutura do GES — {amb.codigo || ghe.codigo} · {amb.nome || ghe.nome}
          </h1>
          <p className="text-xs text-muted-foreground">
            Ambiente → Setores → Funções. O PGR importa essa estrutura.
          </p>
        </div>
        {bodyContent}
        <div className="flex justify-end border-t pt-3 mt-3">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={true} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:!max-w-[min(1200px,95vw)] sm:w-[95vw] sm:h-[92vh] sm:max-h-[92vh] sm:p-0 sm:overflow-hidden overflow-x-hidden flex flex-col">
        <DialogHeader className="sm:px-6 sm:pt-6 sm:pb-3 sm:border-b">
          <DialogTitle className="break-words">Estrutura do GES — {amb.codigo || ghe.codigo} · {amb.nome || ghe.nome}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Ambiente → Setores → Funções. O PGR importa essa estrutura.
          </p>
        </DialogHeader>
        {bodyContent}
        <DialogFooter className="sm:px-6 sm:pb-6">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
