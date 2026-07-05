import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Power, ClipboardList, Search, Briefcase, Trash2, ShieldAlert, X, LayoutList } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import EstruturaGheDialog from "@/components/cadastro/EstruturaGheDialog";

export default function CadastroGhe() {
  const { empresaId, empresaScopeIds, isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [empresaSel, setEmpresaSel] = useState<string>(empresaId || "");
  const [busca, setBusca] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [openEstrutura, setOpenEstrutura] = useState<any | null>(null);

  const { data: empresas = [] } = useQuery({
    queryKey: ["cad-ghe-empresas", empresaScopeIds.join(",")],
    queryFn: async () => {
      let q = supabase.from("empresa_config").select("id, nome").order("nome");
      if (isSuperAdmin && empresaScopeIds.length > 0) q = q.in("id", empresaScopeIds);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: ghes = [], isLoading } = useQuery({
    queryKey: ["cad-ghe-list", empresaSel],
    enabled: !!empresaSel,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ghe_ges")
        .select("*, ghe_funcoes(nome_funcao), ghe_riscos(id)")
        .eq("empresa_id", empresaSel)
        .order("codigo");
      if (error) throw error;
      return (data || []).map((g: any) => ({
        ...g,
        funcoesList: (g.ghe_funcoes || []).map((f: any) => f.nome_funcao).filter(Boolean).sort(),
        nFuncoes: (g.ghe_funcoes || []).length,
        nRiscos: (g.ghe_riscos || []).length,
        setoresList: (g.setores && g.setores.length ? g.setores : (g.setor ? [g.setor] : [])) as string[],
      }));
    },
  });

  const filtrados = ghes.filter((g: any) => {
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return (
      g.codigo?.toLowerCase().includes(q) ||
      g.nome?.toLowerCase().includes(q) ||
      g.ambiente?.toLowerCase().includes(q) ||
      (g.setoresList || []).some((s: string) => s.toLowerCase().includes(q))
    );
  });

  const novo = () => { setEditing(null); setOpenForm(true); };
  const editar = (g: any) => { setEditing(g); setOpenForm(true); };

  const alternarStatus = async (g: any) => {
    const novoStatus = g.status === "ativo" ? "inativo" : "ativo";
    const { error } = await supabase.from("ghe_ges").update({ status: novoStatus }).eq("id", g.id);
    if (error) return toast.error(error.message);
    toast.success(`GES ${novoStatus === "ativo" ? "ativado" : "inativado"}`);
    qc.invalidateQueries({ queryKey: ["cad-ghe-list"] });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="GES"
        subtitle="Cadastro dos grupos homogêneos de exposição — ambiente, setores, funções, riscos e controles."
        actions={
          <>
            <Select value={empresaSel} onValueChange={setEmpresaSel}>
              <SelectTrigger className="w-full sm:w-[240px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
              <SelectContent>{empresas.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={novo} disabled={!empresaSel}><Plus className="h-4 w-4 mr-1" />Novo GES</Button>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por código, nome, ambiente ou setor…" className="pl-8" />
          </div>
          {isLoading && <ListSkeleton rows={4} variant="row" />}
          {!isLoading && filtrados.length === 0 && (
            <EmptyState
              icon={ClipboardList}
              title={busca ? "Nenhum resultado" : "Nenhum GES cadastrado"}
              description={busca ? "Ajuste a busca para ver mais resultados." : "Cadastre os grupos para organizar ambientes, setores, funções e exposições ocupacionais."}
              action={!busca && empresaSel ? (
                <Button onClick={novo}><Plus className="h-4 w-4 mr-1" />Novo GES</Button>
              ) : undefined}
              bare
            />
          )}
          {filtrados.length > 0 && (
            <div className="border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Código</TableHead>
                    <TableHead className="w-[200px]">Ambiente</TableHead>
                    <TableHead className="w-[180px]">Setores</TableHead>
                    <TableHead>Funções / Riscos</TableHead>
                    <TableHead className="w-[80px]">Status</TableHead>
                    <TableHead className="w-[260px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((g: any) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium align-top">{g.codigo}</TableCell>
                      <TableCell className="align-top text-sm">{g.ambiente || "—"}</TableCell>
                      <TableCell className="align-top">
                        {(g.setoresList || []).length ? (
                          <div className="flex flex-wrap gap-1">
                            {g.setoresList.map((s: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                            ))}
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline"><Briefcase className="h-3 w-3 mr-1" />{g.nFuncoes} funç.</Badge>
                          <Badge variant="outline"><ShieldAlert className="h-3 w-3 mr-1" />{g.nRiscos} risco(s)</Badge>
                        </div>
                        {g.funcoesList?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {g.funcoesList.slice(0, 6).map((nf: string, i: number) => (
                              <Badge key={i} variant="secondary" className="font-normal text-xs">{nf}</Badge>
                            ))}
                            {g.funcoesList.length > 6 && <span className="text-xs text-muted-foreground">+{g.funcoesList.length - 6}</span>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <StatusBadge tone={g.status === "ativo" ? "success" : "neutral"} size="sm">
                          {g.status === "ativo" ? "Ativo" : "Inativo"}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-right align-top space-x-1">
                        <Button size="sm" variant="outline" onClick={() => setOpenFuncoes(g)} title="Funções"><Briefcase className="h-4 w-4 mr-1" />Funções</Button>
                        <Button size="sm" variant="outline" onClick={() => setOpenRiscos(g)} title="Riscos"><ShieldAlert className="h-4 w-4 mr-1" />Riscos</Button>
                        <Button size="icon" variant="ghost" onClick={() => editar(g)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => alternarStatus(g)} title={g.status === "ativo" ? "Inativar" : "Ativar"}>
                          <Power className={`h-4 w-4 ${g.status === "ativo" ? "text-destructive" : "text-primary"}`} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <GheFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        empresaId={empresaSel}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["cad-ghe-list"] })}
      />
      {openFuncoes && (
        <FuncoesDialog
          ghe={openFuncoes}
          onClose={() => { setOpenFuncoes(null); qc.invalidateQueries({ queryKey: ["cad-ghe-list"] }); }}
        />
      )}
      {openRiscos && (
        <RiscosDialog
          ghe={openRiscos}
          onClose={() => { setOpenRiscos(null); qc.invalidateQueries({ queryKey: ["cad-ghe-list"] }); }}
        />
      )}
    </div>
  );
}

/* ---------------- Form GES ---------------- */

function TagsInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [inp, setInp] = useState("");
  const add = () => {
    const v = inp.trim();
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setInp("");
  };
  return (
    <div className="border rounded p-2 flex flex-wrap gap-1 min-h-[40px]">
      {value.map((s, i) => (
        <Badge key={i} variant="secondary" className="text-xs">
          {s}
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="ml-1"><X className="h-3 w-3" /></button>
        </Badge>
      ))}
      <Input
        value={inp}
        onChange={(e) => setInp(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={placeholder}
        className="border-0 shadow-none h-6 flex-1 min-w-[120px] p-1 focus-visible:ring-0"
      />
    </div>
  );
}

function GheFormDialog({ open, onOpenChange, empresaId, editing, onSaved }: any) {
  const [form, setForm] = useState<any>({
    codigo: "", nome: "", ambiente: "", setores: [] as string[], descricao_ambiente: "",
    descricao: "", status: "ativo",
    descricao_atividades: "", trabalhadores_expostos: "", frequencia_exposicao: "",
    tempo_exposicao: "", severidade: "", probabilidade: "", nivel_risco: "",
    medidas_controle_existentes: "", medidas_controle_recomendadas: "",
    epcs: "", capacitacoes_obrigatorias: "", observacoes_tecnicas: "",
  });
  const [saving, setSaving] = useState(false);
  const [showAvancado, setShowAvancado] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        codigo: editing.codigo || "",
        nome: editing.nome || "",
        ambiente: editing.ambiente || "",
        setores: (editing.setores && editing.setores.length ? editing.setores : (editing.setor ? [editing.setor] : [])) as string[],
        descricao_ambiente: editing.descricao_ambiente || "",
        descricao: editing.descricao || "",
        status: editing.status || "ativo",
        descricao_atividades: editing.descricao_atividades || "",
        trabalhadores_expostos: editing.trabalhadores_expostos ?? "",
        frequencia_exposicao: editing.frequencia_exposicao || "",
        tempo_exposicao: editing.tempo_exposicao || "",
        severidade: editing.severidade ?? "",
        probabilidade: editing.probabilidade ?? "",
        nivel_risco: editing.nivel_risco || "",
        medidas_controle_existentes: editing.medidas_controle_existentes || "",
        medidas_controle_recomendadas: editing.medidas_controle_recomendadas || "",
        epcs: editing.epcs || "",
        capacitacoes_obrigatorias: editing.capacitacoes_obrigatorias || "",
        observacoes_tecnicas: editing.observacoes_tecnicas || "",
      });
    } else {
      setForm({
        codigo: "", nome: "", ambiente: "", setores: [], descricao_ambiente: "",
        descricao: "", status: "ativo",
        descricao_atividades: "", trabalhadores_expostos: "", frequencia_exposicao: "",
        tempo_exposicao: "", severidade: "", probabilidade: "", nivel_risco: "",
        medidas_controle_existentes: "", medidas_controle_recomendadas: "",
        epcs: "", capacitacoes_obrigatorias: "", observacoes_tecnicas: "",
      });
    }
    setShowAvancado(false);
  }, [editing, open]);

  const save = async () => {
    if (!form.codigo.trim() || !form.nome.trim()) return toast.error("Código e nome são obrigatórios");
    setSaving(true);
    const toInt = (v: any) => (v === "" || v === null || v === undefined ? null : Number(v));
    const setoresArr = form.setores.map((s: string) => s.trim()).filter(Boolean);
    const payload: any = {
      codigo: form.codigo.trim(),
      nome: form.nome.trim(),
      ambiente: form.ambiente?.trim() || null,
      setores: setoresArr,
      setor: setoresArr[0] || null, // legado
      descricao_ambiente: form.descricao_ambiente?.trim() || null,
      descricao: form.descricao?.trim() || null,
      status: form.status,
      empresa_id: empresaId,
      descricao_atividades: form.descricao_atividades?.trim() || null,
      trabalhadores_expostos: toInt(form.trabalhadores_expostos),
      frequencia_exposicao: form.frequencia_exposicao?.trim() || null,
      tempo_exposicao: form.tempo_exposicao?.trim() || null,
      severidade: toInt(form.severidade),
      probabilidade: toInt(form.probabilidade),
      nivel_risco: form.nivel_risco?.trim() || null,
      medidas_controle_existentes: form.medidas_controle_existentes?.trim() || null,
      medidas_controle_recomendadas: form.medidas_controle_recomendadas?.trim() || null,
      epcs: form.epcs?.trim() || null,
      capacitacoes_obrigatorias: form.capacitacoes_obrigatorias?.trim() || null,
      observacoes_tecnicas: form.observacoes_tecnicas?.trim() || null,
    };
    const { error } = editing
      ? await (supabase.from("ghe_ges") as any).update(payload).eq("id", editing.id)
      : await (supabase.from("ghe_ges") as any).insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("GES salvo");
    onSaved();
    onOpenChange(false);
  };

  const set = (k: string, v: any) => setForm({ ...form, [k]: v });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Editar GES" : "Novo GES"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Código *</Label>
              <Input value={form.codigo} onChange={(e) => set("codigo", e.target.value)} placeholder="GES 01" />
            </div>
            <div>
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Administrativo" />
            </div>
          </div>
          <div>
            <Label>Ambiente</Label>
            <Input value={form.ambiente} onChange={(e) => set("ambiente", e.target.value)} placeholder="Ex.: Ambiente de trabalho interno / Área operacional / Campo" />
          </div>
          <div>
            <Label>Setores vinculados</Label>
            <TagsInput value={form.setores} onChange={(v) => set("setores", v)} placeholder="Digite e Enter (ex.: PCP, Financeiro, RH)" />
            <p className="text-xs text-muted-foreground mt-1">Vários setores podem compartilhar o mesmo GES quando o ambiente e riscos são semelhantes.</p>
          </div>
          <div>
            <Label>Descrição geral do ambiente</Label>
            <Textarea value={form.descricao_ambiente} onChange={(e) => set("descricao_ambiente", e.target.value)} rows={2} placeholder="Ex.: Escritório climatizado, iluminação artificial, mobiliário padrão…" />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} rows={2} placeholder="Observações gerais do grupo." />
          </div>
          <div>
            <Label>Ativo</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Sim</SelectItem>
                <SelectItem value="inativo">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="pt-2 border-t">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAvancado(!showAvancado)} className="w-full justify-between">
              <span>Dados técnicos (usados nos programas: PGR, OS, PCMSO, LTCAT)</span>
              <span className="text-xs text-muted-foreground">{showAvancado ? "ocultar" : "mostrar"}</span>
            </Button>
          </div>

          {showAvancado && (
            <div className="space-y-3 border rounded-md p-3 bg-muted/30">
              <div>
                <Label>Descrição das atividades (geral)</Label>
                <Textarea rows={2} value={form.descricao_atividades} onChange={(e) => set("descricao_atividades", e.target.value)} placeholder="Descrição geral — atividades específicas ficam nas funções." />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Trab. expostos</Label>
                  <Input type="number" min={0} value={form.trabalhadores_expostos} onChange={(e) => set("trabalhadores_expostos", e.target.value)} />
                </div>
                <div>
                  <Label>Frequência</Label>
                  <Input value={form.frequencia_exposicao} onChange={(e) => set("frequencia_exposicao", e.target.value)} placeholder="Ex.: diária" />
                </div>
                <div>
                  <Label>Tempo exposição</Label>
                  <Input value={form.tempo_exposicao} onChange={(e) => set("tempo_exposicao", e.target.value)} placeholder="Ex.: 8h/dia" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Severidade (1-5)</Label>
                  <Input type="number" min={1} max={5} value={form.severidade} onChange={(e) => set("severidade", e.target.value)} />
                </div>
                <div>
                  <Label>Probabilidade (1-5)</Label>
                  <Input type="number" min={1} max={5} value={form.probabilidade} onChange={(e) => set("probabilidade", e.target.value)} />
                </div>
                <div>
                  <Label>Nível de risco</Label>
                  <Input value={form.nivel_risco} onChange={(e) => set("nivel_risco", e.target.value)} placeholder="Baixo / Médio / Alto" />
                </div>
              </div>
              <div>
                <Label>Medidas de controle existentes</Label>
                <Textarea rows={2} value={form.medidas_controle_existentes} onChange={(e) => set("medidas_controle_existentes", e.target.value)} />
              </div>
              <div>
                <Label>Medidas de controle recomendadas</Label>
                <Textarea rows={2} value={form.medidas_controle_recomendadas} onChange={(e) => set("medidas_controle_recomendadas", e.target.value)} />
              </div>
              <div>
                <Label>EPCs</Label>
                <Textarea rows={2} value={form.epcs} onChange={(e) => set("epcs", e.target.value)} />
              </div>
              <div>
                <Label>Capacitações obrigatórias</Label>
                <Textarea rows={2} value={form.capacitacoes_obrigatorias} onChange={(e) => set("capacitacoes_obrigatorias", e.target.value)} />
              </div>
              <div>
                <Label>Observações técnicas</Label>
                <Textarea rows={2} value={form.observacoes_tecnicas} onChange={(e) => set("observacoes_tecnicas", e.target.value)} />
              </div>
            </div>
          )}
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Diálogo de Funções (agora com atividade/processo/setor/qtd) ---------------- */

function FuncoesDialog({ ghe, onClose }: { ghe: any; onClose: () => void }) {
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [bulk, setBulk] = useState("");

  const setoresDisponiveis: string[] = (ghe.setores && ghe.setores.length ? ghe.setores : (ghe.setor ? [ghe.setor] : []));

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("ghe_funcoes")
      .select("id, nome_funcao, cbo, descricao_atividade, setor, processo, quantidade_trabalhadores, observacoes")
      .eq("ghe_id", ghe.id)
      .order("nome_funcao");
    setLoading(false);
    if (error) return toast.error(error.message);
    setItens(data || []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ghe.id]);

  const salvar = async (f: any) => {
    const nome = (f.nome_funcao || "").trim();
    if (!nome) return toast.error("Nome da função é obrigatório");
    const payload: any = {
      ghe_id: ghe.id, empresa_id: ghe.empresa_id, nome_funcao: nome,
      cbo: f.cbo?.trim() || null,
      descricao_atividade: f.descricao_atividade?.trim() || null,
      setor: f.setor?.trim() || null,
      processo: f.processo?.trim() || null,
      quantidade_trabalhadores: f.quantidade_trabalhadores === "" || f.quantidade_trabalhadores == null ? null : Number(f.quantidade_trabalhadores),
      observacoes: f.observacoes?.trim() || null,
    };
    const { error } = f.id
      ? await (supabase as any).from("ghe_funcoes").update(payload).eq("id", f.id)
      : await (supabase as any).from("ghe_funcoes").insert(payload);
    if (error) return toast.error(error.message);
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta função?")) return;
    const { error } = await supabase.from("ghe_funcoes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const addBulk = async () => {
    const lines = bulk.split("\n").map((x) => x.trim()).filter(Boolean);
    if (!lines.length) return;
    const payload = lines.map((l) => ({ ghe_id: ghe.id, empresa_id: ghe.empresa_id, nome_funcao: l }));
    const { error } = await supabase.from("ghe_funcoes").insert(payload as any);
    if (error) return toast.error(error.message);
    toast.success(`${lines.length} funções adicionadas`);
    setBulk(""); load();
  };

  return (
    <Dialog open={true} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Funções — {ghe.codigo} · {ghe.nome}</DialogTitle>
          <p className="text-sm text-muted-foreground">Cada função pode ter seu próprio setor, descrição de atividade e processo, mesmo compartilhando o GES.</p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setEditing({ nome_funcao: "", setor: setoresDisponiveis[0] || "" })}>
              <Plus className="h-4 w-4 mr-1" />Nova função
            </Button>
          </div>

          {editing && (
            <div className="border rounded p-3 bg-muted/30 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Função *</Label>
                  <Input value={editing.nome_funcao || ""} onChange={(e) => setEditing({ ...editing, nome_funcao: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Setor</Label>
                  {setoresDisponiveis.length > 0 ? (
                    <Select value={editing.setor || ""} onValueChange={(v) => setEditing({ ...editing, setor: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecionar setor" /></SelectTrigger>
                      <SelectContent>
                        {setoresDisponiveis.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={editing.setor || ""} onChange={(e) => setEditing({ ...editing, setor: e.target.value })} />
                  )}
                </div>
              </div>
              <div>
                <Label className="text-xs">Descrição da atividade</Label>
                <Textarea rows={2} value={editing.descricao_atividade || ""} onChange={(e) => setEditing({ ...editing, descricao_atividade: e.target.value })} placeholder="O que essa função executa no ambiente." />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Processo</Label>
                  <Input value={editing.processo || ""} onChange={(e) => setEditing({ ...editing, processo: e.target.value })} placeholder="Ex.: Administrativo" />
                </div>
                <div>
                  <Label className="text-xs">Qtd. trabalhadores</Label>
                  <Input type="number" min={0} value={editing.quantidade_trabalhadores ?? ""} onChange={(e) => setEditing({ ...editing, quantidade_trabalhadores: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">CBO</Label>
                  <Input value={editing.cbo || ""} onChange={(e) => setEditing({ ...editing, cbo: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Observações</Label>
                <Textarea rows={2} value={editing.observacoes || ""} onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button size="sm" onClick={() => salvar(editing)}>Salvar função</Button>
              </div>
            </div>
          )}

          <div className="border rounded divide-y max-h-[320px] overflow-y-auto">
            {loading && <p className="text-sm text-muted-foreground p-3">Carregando…</p>}
            {!loading && itens.length === 0 && <p className="text-sm text-muted-foreground p-3 italic">Nenhuma função cadastrada.</p>}
            {itens.map((f: any) => (
              <div key={f.id} className="p-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{f.nome_funcao}</span>
                    {f.setor && <Badge variant="outline" className="text-xs">{f.setor}</Badge>}
                    {f.cbo && <span className="text-xs text-muted-foreground">CBO {f.cbo}</span>}
                    {f.quantidade_trabalhadores != null && <Badge variant="secondary" className="text-xs">{f.quantidade_trabalhadores} trab.</Badge>}
                  </div>
                  {f.descricao_atividade && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{f.descricao_atividade}</p>}
                  {f.processo && <p className="text-xs mt-1"><span className="text-muted-foreground">Processo:</span> {f.processo}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(f)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(f.id)} title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-3">
            <Label className="text-xs">Adicionar várias funções rapidamente (uma por linha, só nome)</Label>
            <Textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={3} placeholder="Assistente Financeiro&#10;Auxiliar Administrativo" />
            <Button size="sm" variant="outline" onClick={addBulk} className="mt-2" disabled={!bulk.trim()}>Adicionar lista</Button>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Diálogo de Riscos do GES ---------------- */

const GRUPOS_RISCO = ["fisico", "quimico", "biologico", "ergonomico", "acidente", "outro"];

function RiscosDialog({ ghe, onClose }: { ghe: any; onClose: () => void }) {
  const [itens, setItens] = useState<any[]>([]);
  const [funcoes, setFuncoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    const [riscosRes, funcRes] = await Promise.all([
      (supabase as any).from("ghe_riscos").select("*").eq("ghe_id", ghe.id).order("grupo"),
      (supabase as any).from("ghe_funcoes").select("id, nome_funcao").eq("ghe_id", ghe.id).order("nome_funcao"),
    ]);
    setLoading(false);
    if (riscosRes.error) return toast.error(riscosRes.error.message);
    setItens(riscosRes.data || []);
    setFuncoes(funcRes.data || []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ghe.id]);

  const salvar = async (r: any) => {
    if (!r.grupo) return toast.error("Grupo é obrigatório");
    if (!r.tipo_agente?.trim() && !r.perigo_fonte?.trim()) return toast.error("Informe o perigo/agente");
    const payload: any = {
      ghe_id: ghe.id, empresa_id: ghe.empresa_id,
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
      ? await (supabase as any).from("ghe_riscos").update(payload).eq("id", r.id)
      : await (supabase as any).from("ghe_riscos").insert(payload);
    if (error) return toast.error(error.message);
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este risco?")) return;
    const { error } = await supabase.from("ghe_riscos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const nomeFuncao = (id: string | null) => funcoes.find((f) => f.id === id)?.nome_funcao;

  return (
    <Dialog open={true} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Riscos — {ghe.codigo} · {ghe.nome}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Riscos <b>comuns</b> aplicam a todas as funções do GES. Marque um risco como <b>específico da função</b> se ele só existe em uma função.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setEditing({ grupo: "ergonomico", tipo_agente: "", perigo_fonte: "", funcao_id: null })}>
              <Plus className="h-4 w-4 mr-1" />Novo risco
            </Button>
          </div>

          {editing && (
            <div className="border rounded p-3 bg-muted/30 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Grupo *</Label>
                  <Select value={editing.grupo || ""} onValueChange={(v) => setEditing({ ...editing, grupo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GRUPOS_RISCO.map((g) => <SelectItem key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Perigo / Agente *</Label>
                  <Input value={editing.tipo_agente || ""} onChange={(e) => setEditing({ ...editing, tipo_agente: e.target.value })} placeholder="Ex.: Postura sentada prolongada" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Fonte geradora</Label>
                <Input value={editing.perigo_fonte || ""} onChange={(e) => setEditing({ ...editing, perigo_fonte: e.target.value })} placeholder="Ex.: Mobiliário / uso contínuo de computador" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Exposição</Label>
                  <Select value={editing.exposicao || ""} onValueChange={(v) => setEditing({ ...editing, exposicao: v })}>
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
                  <Input value={editing.limite_exposicao || ""} onChange={(e) => setEditing({ ...editing, limite_exposicao: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Possíveis lesões</Label>
                <Textarea rows={2} value={editing.possiveis_lesoes || ""} onChange={(e) => setEditing({ ...editing, possiveis_lesoes: e.target.value })} />
              </div>

              <div className="border-t pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={!!editing.funcao_id} onCheckedChange={(v) => setEditing({ ...editing, funcao_id: v ? (funcoes[0]?.id || null) : null })} />
                  <span className="text-sm">Risco específico da função</span>
                </label>
                {editing.funcao_id && (
                  <div className="mt-2">
                    <Label className="text-xs">Função</Label>
                    <Select value={editing.funcao_id} onValueChange={(v) => setEditing({ ...editing, funcao_id: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {funcoes.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome_funcao}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {funcoes.length === 0 && <p className="text-xs text-destructive mt-1">Nenhuma função cadastrada. Cadastre em "Funções" primeiro.</p>}
                  </div>
                )}
                {!editing.funcao_id && (
                  <p className="text-xs text-muted-foreground mt-1">Este risco será aplicado a <b>todas as funções</b> deste GES.</p>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button size="sm" onClick={() => salvar(editing)}>Salvar risco</Button>
              </div>
            </div>
          )}

          <div className="border rounded divide-y max-h-[360px] overflow-y-auto">
            {loading && <p className="text-sm text-muted-foreground p-3">Carregando…</p>}
            {!loading && itens.length === 0 && <p className="text-sm text-muted-foreground p-3 italic">Nenhum risco cadastrado.</p>}
            {itens.map((r: any) => (
              <div key={r.id} className="p-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs uppercase">{r.grupo}</Badge>
                    <span className="font-medium text-sm">{r.tipo_agente || r.perigo_fonte}</span>
                    {r.funcao_id ? (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">Específico: {nomeFuncao(r.funcao_id) || "—"}</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Comum a todas as funções</Badge>
                    )}
                  </div>
                  {r.perigo_fonte && r.tipo_agente && <p className="text-xs text-muted-foreground mt-1"><span className="font-medium">Fonte:</span> {r.perigo_fonte}</p>}
                  {r.exposicao && <p className="text-xs mt-1"><span className="text-muted-foreground">Exposição:</span> {r.exposicao}</p>}
                  {r.possiveis_lesoes && <p className="text-xs mt-1 whitespace-pre-wrap"><span className="text-muted-foreground">Lesões:</span> {r.possiveis_lesoes}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(r)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(r.id)} title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
