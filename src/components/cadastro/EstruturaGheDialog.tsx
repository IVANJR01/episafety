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
}

const GRUPOS_RISCO = ["fisico", "quimico", "biologico", "ergonomico", "acidente", "outro"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function EstruturaGheDialog({ ghe, onClose }: Props) {
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
  const [novoSetor, setNovoSetor] = useState("");
  const [savingAmb, setSavingAmb] = useState(false);

  const salvarAmbiente = async () => {
    if (!amb.codigo.trim() || !amb.nome.trim()) return toast.error("Código e nome são obrigatórios");
    setSavingAmb(true);
    const setoresArr = amb.setores.map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase
      .from("ghe_ges")
      .update({
        codigo: amb.codigo.trim(),
        nome: amb.nome.trim(),
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
    const dos = amb.setores || [];
    const dasFuncoes = Array.from(new Set(funcoes.map((f) => f.setor).filter(Boolean))) as string[];
    return Array.from(new Set([...dos, ...dasFuncoes]));
  }, [amb.setores, funcoes]);

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
    if (!nome) return toast.error("Nome da função é obrigatório");
    const payload: any = {
      ghe_id: ghe.id,
      empresa_id: ghe.empresa_id,
      nome_funcao: nome,
      cbo: f.cbo?.trim() || null,
      descricao_atividade: f.descricao_atividade?.trim() || null,
      setor: f.setor?.trim() || null,
      processo: f.processo?.trim() || null,
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
        processo: processo || null,
        quantidade_trabalhadores: qtd && !isNaN(Number(qtd)) ? Number(qtd) : null,
        observacoes: obs || null,
      };
    }).filter((r) => r.nome_funcao);
    if (!rows.length) return toast.error("Nenhuma linha válida");
    const { error } = await supabase.from("ghe_funcoes").insert(rows as any);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} linha(s) importadas`);
    setBulk(""); setBulkOpen(false);
    // adiciona setores novos ao GES
    const novosSetores = Array.from(new Set(rows.map((r) => r.setor).filter(Boolean))) as string[];
    const merged = Array.from(new Set([...(amb.setores || []), ...novosSetores]));
    if (merged.length !== (amb.setores || []).length) {
      await supabase.from("ghe_ges").update({ setores: merged, setor: merged[0] || null }).eq("id", ghe.id);
      setAmb({ ...amb, setores: merged });
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

  return (
    <Dialog open={true} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-5xl sm:max-h-[92vh] sm:overflow-hidden overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="break-words">Estrutura do GES — {amb.codigo || ghe.codigo} · {amb.nome || ghe.nome}</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Ambiente → Setores → Funções → Processo/atividade → Riscos. O PGR importa tudo daqui.
          </p>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 min-h-0 flex flex-col">
          <TabsList className="w-full sm:w-auto self-start">
            <TabsTrigger value="ambiente">Ambiente</TabsTrigger>
            <TabsTrigger value="funcoes">Setores e Funções</TabsTrigger>
            <TabsTrigger value="riscos">Riscos</TabsTrigger>
            <TabsTrigger value="epis">EPIs / Medidas</TabsTrigger>
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
          </TabsList>

          {/* ---------- Aba Ambiente ---------- */}
          <TabsContent value="ambiente" className="mt-3 space-y-3 overflow-y-auto overflow-x-hidden sm:max-h-[65vh] sm:pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Código do GES *</Label>
                <Input value={amb.codigo} onChange={(e) => setAmb({ ...amb, codigo: e.target.value })} placeholder="GES 01" className="w-full" />
              </div>
              <div>
                <Label className="text-xs">Nome do GES *</Label>
                <Input value={amb.nome} onChange={(e) => setAmb({ ...amb, nome: e.target.value })} placeholder="Administrativo" className="w-full" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Ambiente (título curto)</Label>
              <Input
                value={amb.ambiente}
                onChange={(e) => setAmb({ ...amb, ambiente: e.target.value })}
                placeholder="Ex.: Ambiente interno / Área operacional"
                className="w-full"
              />
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
              <Label className="text-xs">Processo do GES</Label>
              <Textarea
                rows={4}
                value={amb.processo}
                onChange={(e) => setAmb({ ...amb, processo: e.target.value })}
                placeholder="Ex.: Gerencia todo o processo produtivo da empresa. / Executa atividades administrativas, financeiras e de apoio à gestão da empresa."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Processo geral aplicado a todas as funções deste GES. No PGR, se a função não tiver processo específico, será usado este.
            </p>
            </div>
            <div>
              <Label className="text-xs">Setores vinculados</Label>
              <div className="border rounded p-2 flex flex-wrap gap-1 min-h-[44px]">
                {amb.setores.map((s, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {s}
                    <button type="button" className="ml-1" onClick={() => setAmb({ ...amb, setores: amb.setores.filter((_, j) => j !== i) })}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Input
                  value={novoSetor}
                  onChange={(e) => setNovoSetor(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      const v = novoSetor.trim();
                      if (v && !amb.setores.includes(v)) setAmb({ ...amb, setores: [...amb.setores, v] });
                      setNovoSetor("");
                    }
                  }}
                  placeholder="Digite o setor e Enter (ex.: PCP, Financeiro, RH)"
                  className="border-0 shadow-none h-7 flex-1 min-w-[160px] p-1 focus-visible:ring-0"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Observações do GES</Label>
                <Textarea rows={2} value={amb.descricao} onChange={(e) => setAmb({ ...amb, descricao: e.target.value })} className="w-full" />
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
            </div>
            <div className="flex justify-end">
              <Button onClick={salvarAmbiente} disabled={savingAmb}>
                <Save className="h-4 w-4 mr-1" /> Salvar ambiente
              </Button>
            </div>
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
                  <Label className="text-xs">Processo / Descrição da atividade</Label>
                  <Textarea rows={3} value={editF.descricao_atividade || ""}
                    onChange={(e) => setEditF({ ...editF, descricao_atividade: e.target.value })}
                    placeholder="Ex.: Apura e projeta o saldo disponível da empresa para garantir capital de giro…" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Processo específico (opcional)</Label>
                    <Input value={editF.processo || ""} onChange={(e) => setEditF({ ...editF, processo: e.target.value })} placeholder={ghe.processo ? "Deixe em branco para herdar do GES" : "Ex.: Administrativo"} />
                    {ghe.processo && !editF.processo && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">Herdando do GES: {ghe.processo.slice(0, 60)}{ghe.processo.length > 60 ? "…" : ""}</p>
                    )}
                  </div>
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
                            {f.descricao_atividade && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{f.descricao_atividade}</p>}
                            {f.processo && <p className="text-xs mt-1"><span className="text-muted-foreground">Processo:</span> {f.processo}</p>}
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

          {/* ---------- Aba Riscos ---------- */}
          <TabsContent value="riscos" className="mt-3 space-y-4 overflow-y-auto sm:max-h-[65vh] sm:pr-1">
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">
                Riscos <b>comuns</b> aplicam a todas as funções. Marque <b>específico da função</b> quando o risco só existir em uma função.
              </p>
              <Button size="sm" onClick={() => setEditR({ grupo: "ergonomico", tipo_agente: "", funcao_id: null })}>
                <Plus className="h-4 w-4 mr-1" />Novo risco
              </Button>
            </div>

            {editR && (
              <div className="border rounded p-3 bg-muted/30 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Grupo *</Label>
                    <Select value={editR.grupo || ""} onValueChange={(v) => setEditR({ ...editR, grupo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GRUPOS_RISCO.map((g) => <SelectItem key={g} value={g}>{cap(g)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Perigo / Agente *</Label>
                    <Input value={editR.tipo_agente || ""} onChange={(e) => setEditR({ ...editR, tipo_agente: e.target.value })}
                      placeholder="Ex.: Postura sentada prolongada" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Fonte geradora</Label>
                  <Input value={editR.perigo_fonte || ""} onChange={(e) => setEditR({ ...editR, perigo_fonte: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Exposição</Label>
                    <Select value={editR.exposicao || ""} onValueChange={(v) => setEditR({ ...editR, exposicao: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="continua">Contínua</SelectItem>
                        <SelectItem value="intermitente">Intermitente</SelectItem>
                        <SelectItem value="eventual">Eventual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Limite de exposição</Label>
                    <Input value={editR.limite_exposicao || ""} onChange={(e) => setEditR({ ...editR, limite_exposicao: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Possíveis lesões</Label>
                  <Textarea rows={2} value={editR.possiveis_lesoes || ""} onChange={(e) => setEditR({ ...editR, possiveis_lesoes: e.target.value })} />
                </div>
                <div className="border-t pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={!!editR.funcao_id}
                      onCheckedChange={(v) => setEditR({ ...editR, funcao_id: v ? (funcoes[0]?.id || null) : null })}
                    />
                    <span className="text-sm">Risco específico da função</span>
                  </label>
                  {editR.funcao_id && (
                    <Select value={editR.funcao_id} onValueChange={(v) => setEditR({ ...editR, funcao_id: v })}>
                      <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {funcoes.map((f) => <SelectItem key={f.id} value={f.id}>{f.setor ? `${f.setor} · ` : ""}{f.nome_funcao}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setEditR(null)}>Cancelar</Button>
                  <Button size="sm" onClick={() => salvarRisco(editR)}>Salvar risco</Button>
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold mb-2">Riscos comuns do GES</h4>
              <div className="border rounded divide-y">
                {loadingR && <p className="text-xs text-muted-foreground p-3">Carregando…</p>}
                {!loadingR && riscosComuns.length === 0 && <p className="text-xs text-muted-foreground italic p-3">Nenhum risco comum.</p>}
                {riscosComuns.map((r) => (
                  <div key={r.id} className="p-2 flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{cap(r.grupo)}</Badge>
                        <span className="text-sm font-medium">{r.tipo_agente || r.perigo_fonte}</span>
                        {r.exposicao && <span className="text-xs text-muted-foreground">· {r.exposicao}</span>}
                      </div>
                      {r.perigo_fonte && r.tipo_agente && <p className="text-xs text-muted-foreground mt-1">Fonte: {r.perigo_fonte}</p>}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => setEditR(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => excluirRisco(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Riscos específicos por função</h4>
              <div className="border rounded divide-y">
                {!loadingR && riscosEspec.length === 0 && <p className="text-xs text-muted-foreground italic p-3">Nenhum risco específico.</p>}
                {riscosEspec.map((r) => (
                  <div key={r.id} className="p-2 flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{cap(r.grupo)}</Badge>
                        <span className="text-sm font-medium">{r.tipo_agente || r.perigo_fonte}</span>
                        <Badge variant="secondary" className="text-xs">{nomeFuncao(r.funcao_id)}</Badge>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => setEditR(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => excluirRisco(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ---------- Aba EPIs / Medidas ---------- */}
          <TabsContent value="epis" className="mt-3 space-y-3 overflow-y-auto overflow-x-hidden sm:max-h-[65vh] sm:pr-1">
            <p className="text-xs text-muted-foreground">
              Medidas de controle, EPCs, EPIs e capacitações usados pelo PGR e pela OS. Aplicam a todo o GES.
            </p>
            <div>
              <Label className="text-xs">Medidas de controle existentes</Label>
              <Textarea rows={2} value={epis.medidas_controle_existentes} onChange={(e) => setEpis({ ...epis, medidas_controle_existentes: e.target.value })} className="w-full" />
            </div>
            <div>
              <Label className="text-xs">Medidas de controle recomendadas</Label>
              <Textarea rows={2} value={epis.medidas_controle_recomendadas} onChange={(e) => setEpis({ ...epis, medidas_controle_recomendadas: e.target.value })} className="w-full" />
            </div>
            <div>
              <Label className="text-xs">EPCs (Equipamentos de Proteção Coletiva)</Label>
              <Textarea rows={2} value={epis.epcs} onChange={(e) => setEpis({ ...epis, epcs: e.target.value })} placeholder="Ex.: Exaustão localizada, sinalização, isolamento de área…" className="w-full" />
            </div>
            <div>
              <Label className="text-xs">EPIs</Label>
              <Textarea rows={2} value={epis.observacoes_tecnicas} onChange={(e) => setEpis({ ...epis, observacoes_tecnicas: e.target.value })} placeholder="Ex.: Protetor auricular tipo plug, óculos ampla visão, calçado de segurança…" className="w-full" />
              <p className="text-[10px] text-muted-foreground mt-1">Lista descritiva. O controle de entrega de EPIs continua no módulo próprio.</p>
            </div>
            <div>
              <Label className="text-xs">Capacitações obrigatórias</Label>
              <Textarea rows={2} value={epis.capacitacoes_obrigatorias} onChange={(e) => setEpis({ ...epis, capacitacoes_obrigatorias: e.target.value })} placeholder="Ex.: NR-06, NR-35, NR-10 básica…" className="w-full" />
            </div>
            <div className="flex justify-end">
              <Button onClick={salvarEpis} disabled={savingEpis}>
                <Save className="h-4 w-4 mr-1" /> Salvar EPIs / Medidas
              </Button>
            </div>
          </TabsContent>

          {/* ---------- Aba Resumo ---------- */}
          <TabsContent value="resumo" className="mt-3 space-y-3 overflow-y-auto overflow-x-hidden sm:max-h-[65vh] sm:pr-1">
            <div className="border rounded p-3">
              <p className="text-xs text-muted-foreground">Ambiente</p>
              <p className="text-sm font-medium break-words">{amb.ambiente || "—"}</p>
              {amb.descricao_ambiente && <p className="text-xs mt-1 whitespace-pre-wrap break-words">{amb.descricao_ambiente}</p>}
              {amb.processo && (
                <p className="text-xs mt-2 whitespace-pre-wrap break-words">
                  <span className="text-muted-foreground">Processo do GES:</span> {amb.processo}
                </p>
              )}
            </div>
            <div className="border rounded p-3">
              <p className="text-xs text-muted-foreground mb-1">Setores e Funções</p>
              {Array.from(funcoesPorSetor.entries()).map(([setor, fs]) => (
                <div key={setor} className="mb-2">
                  <p className="text-sm font-medium">{setor} <span className="text-xs text-muted-foreground">({fs.length})</span></p>
                  <ul className="pl-4 list-disc text-xs">
                    {fs.map((f) => (
                      <li key={f.id} className="break-words">
                        <b>{f.nome_funcao}</b>
                        {(f.descricao_atividade || f.processo || amb.processo) && (
                          <span className="text-muted-foreground"> — {f.descricao_atividade || f.processo || amb.processo}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {funcoesPorSetor.size === 0 && <p className="text-xs text-muted-foreground italic">Nada cadastrado.</p>}
            </div>
            <div className="border rounded p-3">
              <p className="text-xs text-muted-foreground mb-1">Riscos ({riscos.length})</p>
              <p className="text-xs">{riscosComuns.length} comuns · {riscosEspec.length} específicos</p>
            </div>
            <div className="border rounded p-3 space-y-1">
              <p className="text-xs text-muted-foreground mb-1">EPIs / Medidas</p>
              {epis.medidas_controle_existentes && <p className="text-xs break-words"><b>Medidas existentes:</b> {epis.medidas_controle_existentes}</p>}
              {epis.medidas_controle_recomendadas && <p className="text-xs break-words"><b>Recomendadas:</b> {epis.medidas_controle_recomendadas}</p>}
              {epis.epcs && <p className="text-xs break-words"><b>EPCs:</b> {epis.epcs}</p>}
              {epis.observacoes_tecnicas && <p className="text-xs break-words"><b>EPIs:</b> {epis.observacoes_tecnicas}</p>}
              {epis.capacitacoes_obrigatorias && <p className="text-xs break-words"><b>Capacitações:</b> {epis.capacitacoes_obrigatorias}</p>}
              {!epis.medidas_controle_existentes && !epis.medidas_controle_recomendadas && !epis.epcs && !epis.observacoes_tecnicas && !epis.capacitacoes_obrigatorias && (
                <p className="text-xs text-muted-foreground italic">Nada cadastrado.</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground italic">
              Ao importar este GES no <b>PGR → Inventário de Riscos</b>, o sistema usa: descrição do ambiente, setor da função, código do GES, funções vinculadas, processo/atividade de cada função, agentes/riscos (comuns + específicos), EPCs, EPIs, medidas e capacitações.
            </p>
          </TabsContent>

        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
