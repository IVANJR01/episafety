import { useEffect, useState } from "react";
import { Plus, Zap, Search, FileDown, Pencil, Trash2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import {
  AtividadePericulosa,
  LaudoPericulosidade as LaudoPericulosidadeRow,
  CATEGORIA_PERICULOSIDADE_LABEL,
  FORMA_EXPOSICAO_LABEL,
  STATUS_LAUDO_LABEL,
  STATUS_LAUDO_COLOR,
  LaudoStatus,
} from "@/lib/laudoPericulosidadeTypes";
import { gerarLaudoPericulosidadePdf } from "@/lib/laudoPericulosidadePdf";
import VoltarParaCentral from "@/components/documentacao/VoltarParaCentral";

const ATIVIDADE_VAZIA: AtividadePericulosa = {
  categoria: "energia_eletrica",
  descricao: "",
  forma_exposicao: "permanente",
  area_classificada: "",
};

const FORM_VAZIO = {
  empresa_id: "",
  funcionario_id: "",
  setor: "",
  funcao: "",
  titulo: "",
  data_avaliacao: new Date().toISOString().slice(0, 10),
  data_emissao: "",
  atividades: [] as AtividadePericulosa[],
  percentual_aplicavel: 30,
  base_legal: "",
  metodologia: "",
  fundamentacao: "",
  recomendacoes: "",
  responsavel_tecnico_nome: "",
  responsavel_tecnico_registro: "",
  status: "rascunho" as LaudoStatus,
  caracterizado_manual: null as boolean | null,
};

export default function LaudoPericulosidade() {
  const { empresaId, empresaScopeIds } = useAuth();
  const [items, setItems] = useState<LaudoPericulosidadeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [empresas, setEmpresas] = useState<{ id: string; nome: string; cnpj: string | null }[]>([]);
  const [funcionarios, setFuncionarios] = useState<{ id: string; nome: string; matricula: string | null; cargo: string | null; setor: string | null }[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...FORM_VAZIO, empresa_id: empresaId || "" });

  const load = async () => {
    setLoading(true);
    try {
      let q = (supabase as any).from("laudos_periculosidade").select("*").order("created_at", { ascending: false });
      if (empresaScopeIds.length > 0) q = q.in("empresa_id", empresaScopeIds);
      const { data, error } = await q;
      if (error) throw error;
      setItems((data || []) as LaudoPericulosidadeRow[]);
    } catch (e: any) {
      toast.error(e.message || "Falha ao carregar laudos de periculosidade");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [empresaScopeIds.join(",")]);

  useEffect(() => {
    (async () => {
      let q = (supabase as any).from("empresa_config").select("id, nome, cnpj").order("nome");
      if (empresaScopeIds.length > 0) q = q.in("id", empresaScopeIds);
      const { data } = await q;
      setEmpresas((data || []) as any);
    })();
  }, [empresaScopeIds.join(",")]);

  useEffect(() => {
    if (!form.empresa_id) { setFuncionarios([]); return; }
    (async () => {
      const { data } = await (supabase as any)
        .from("funcionarios")
        .select("id, nome, matricula, cargo, setor")
        .eq("empresa_id", form.empresa_id)
        .is("data_demissao", null)
        .order("nome");
      setFuncionarios((data || []) as any);
    })();
  }, [form.empresa_id]);

  const filtered = items.filter((i) => !busca || i.titulo.toLowerCase().includes(busca.toLowerCase()));

  const abrirNovo = () => {
    setEditingId(null);
    setForm({ ...FORM_VAZIO, empresa_id: empresaId || empresas[0]?.id || "" });
    setDialogOpen(true);
  };

  const abrirEdicao = (l: LaudoPericulosidadeRow) => {
    setEditingId(l.id);
    setForm({
      empresa_id: l.empresa_id,
      funcionario_id: l.funcionario_id || "",
      setor: l.setor || "",
      funcao: l.funcao || "",
      titulo: l.titulo,
      data_avaliacao: l.data_avaliacao || "",
      data_emissao: l.data_emissao || "",
      atividades: l.atividades || [],
      percentual_aplicavel: l.percentual_aplicavel,
      base_legal: l.base_legal || "",
      metodologia: l.metodologia || "",
      fundamentacao: l.fundamentacao || "",
      recomendacoes: l.recomendacoes || "",
      responsavel_tecnico_nome: l.responsavel_tecnico_nome || "",
      responsavel_tecnico_registro: l.responsavel_tecnico_registro || "",
      status: l.status,
      caracterizado_manual: l.caracterizado,
    });
    setDialogOpen(true);
  };

  const selecionarFuncionario = (id: string) => {
    const f = funcionarios.find((x) => x.id === id);
    setForm((s) => ({
      ...s,
      funcionario_id: id === "__none__" ? "" : id,
      setor: f?.setor || s.setor,
      funcao: f?.cargo || s.funcao,
    }));
  };

  const addAtividade = () => setForm((s) => ({ ...s, atividades: [...s.atividades, { ...ATIVIDADE_VAZIA }] }));
  const removeAtividade = (idx: number) => setForm((s) => ({ ...s, atividades: s.atividades.filter((_, i) => i !== idx) }));
  const setAtividade = (idx: number, patch: Partial<AtividadePericulosa>) =>
    setForm((s) => ({ ...s, atividades: s.atividades.map((a, i) => (i === idx ? { ...a, ...patch } : a)) }));

  const caracterizadoAuto = form.atividades.length > 0;
  const caracterizadoAtual = form.caracterizado_manual ?? caracterizadoAuto;

  const salvar = async () => {
    if (!form.empresa_id) return toast.error("Selecione a empresa");
    if (!form.titulo.trim()) return toast.error("Informe o título do laudo");

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        empresa_id: form.empresa_id,
        funcionario_id: form.funcionario_id || null,
        setor: form.setor || null,
        funcao: form.funcao || null,
        titulo: form.titulo.trim(),
        data_avaliacao: form.data_avaliacao || null,
        data_emissao: form.data_emissao || null,
        atividades: form.atividades,
        caracterizado: caracterizadoAtual,
        percentual_aplicavel: caracterizadoAtual ? form.percentual_aplicavel : 0,
        base_legal: form.base_legal || null,
        metodologia: form.metodologia || null,
        fundamentacao: form.fundamentacao || null,
        recomendacoes: form.recomendacoes || null,
        responsavel_tecnico_nome: form.responsavel_tecnico_nome || null,
        responsavel_tecnico_registro: form.responsavel_tecnico_registro || null,
        status: form.status,
      };
      if (!editingId) payload.created_by = user?.id || null;

      const q = editingId
        ? await (supabase as any).from("laudos_periculosidade").update(payload).eq("id", editingId)
        : await (supabase as any).from("laudos_periculosidade").insert(payload);
      if (q.error) throw q.error;

      toast.success(editingId ? "Laudo atualizado" : "Laudo criado");
      setDialogOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar laudo");
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (id: string) => {
    const { error } = await (supabase as any).from("laudos_periculosidade").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Laudo excluído");
    await load();
  };

  const baixarPdf = async (l: LaudoPericulosidadeRow) => {
    try {
      const [{ data: emp }, { data: fun }] = await Promise.all([
        (supabase as any).from("empresa_config").select("nome, cnpj").eq("id", l.empresa_id).maybeSingle(),
        l.funcionario_id
          ? (supabase as any).from("funcionarios").select("nome, matricula").eq("id", l.funcionario_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const doc = gerarLaudoPericulosidadePdf({
        laudo: l,
        empresaNome: emp?.nome || null,
        empresaCnpj: emp?.cnpj || null,
        funcionarioNome: fun?.nome || null,
        funcionarioMatricula: fun?.matricula || null,
      });
      doc.save(`Laudo-Periculosidade-${l.titulo.replace(/[^a-z0-9]+/gi, "_")}-v${l.versao}.pdf`);
      await (supabase as any).from("laudos_periculosidade").update({ pdf_gerado_em: new Date().toISOString() }).eq("id", l.id);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar PDF");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <VoltarParaCentral />
      <PageHeader
        title="Laudo de Periculosidade"
        subtitle="Avaliação técnica para caracterização ou descaracterização de adicional de periculosidade (NR-16)."
        actions={
          <Button onClick={abrirNovo} className="min-h-[44px]">
            <Plus className="w-4 h-4 mr-2" />
            Novo Documento
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por título..." value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-sm" />
      </div>

      {loading ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="Nenhum laudo cadastrado"
          description="Emita e controle laudos técnicos de periculosidade por função, com agentes, exposição e conclusão do perito."
          action={<Button onClick={abrirNovo}><Plus className="w-4 h-4 mr-2" />Novo Documento</Button>}
        />
      ) : (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => (
            <Card key={l.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <Badge className={STATUS_LAUDO_COLOR[l.status]}>{STATUS_LAUDO_LABEL[l.status]}</Badge>
                </div>
                <h3 className="font-semibold text-sm">{l.titulo}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {l.caracterizado ? `Caracterizado — ${l.percentual_aplicavel}%` : "Não caracterizado"} • v{l.versao}
                </p>
                {l.funcao && <p className="text-xs text-muted-foreground">{l.funcao}{l.setor ? ` — ${l.setor}` : ""}</p>}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => abrirEdicao(l)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => baixarPdf(l)}>
                    <FileDown className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => excluir(l.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Laudo de Periculosidade" : "Novo Laudo de Periculosidade"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Empresa *</Label>
                <Select value={form.empresa_id} onValueChange={(v) => setForm((s) => ({ ...s, empresa_id: v, funcionario_id: "" }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Funcionário</Label>
                <Select value={form.funcionario_id || "__none__"} onValueChange={selecionarFuncionario}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— nenhum —</SelectItem>
                    {funcionarios.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Setor</Label>
                <Input value={form.setor} onChange={(e) => setForm((s) => ({ ...s, setor: e.target.value }))} />
              </div>
              <div>
                <Label>Função avaliada</Label>
                <Input value={form.funcao} onChange={(e) => setForm((s) => ({ ...s, funcao: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Label>Título do laudo *</Label>
                <Input value={form.titulo} onChange={(e) => setForm((s) => ({ ...s, titulo: e.target.value }))} placeholder="Ex.: Laudo de Periculosidade — Eletricistas" />
              </div>
              <div>
                <Label>Data da avaliação</Label>
                <Input type="date" value={form.data_avaliacao} onChange={(e) => setForm((s) => ({ ...s, data_avaliacao: e.target.value }))} />
              </div>
              <div>
                <Label>Data de emissão</Label>
                <Input type="date" value={form.data_emissao} onChange={(e) => setForm((s) => ({ ...s, data_emissao: e.target.value }))} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Atividades perigosas ({form.atividades.length})</Label>
                <Button size="sm" variant="outline" onClick={addAtividade}><Plus className="w-3.5 h-3.5 mr-1" />Atividade</Button>
              </div>
              <div className="space-y-3">
                {form.atividades.map((a, idx) => (
                  <div key={idx} className="border rounded-md p-3 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <Select value={a.categoria} onValueChange={(v) => setAtividade(idx, { categoria: v as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(CATEGORIA_PERICULOSIDADE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={a.forma_exposicao} onValueChange={(v) => setAtividade(idx, { forma_exposicao: v as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(FORMA_EXPOSICAO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input placeholder="Área classificada / local" value={a.area_classificada} onChange={(e) => setAtividade(idx, { area_classificada: e.target.value })} />
                    <div className="flex items-center gap-2">
                      <Textarea rows={2} placeholder="Descrição da atividade/exposição" value={a.descricao} onChange={(e) => setAtividade(idx, { descricao: e.target.value })} />
                      <Button size="icon" variant="ghost" onClick={() => removeAtividade(idx)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
                {form.atividades.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhuma atividade adicionada. Clique em "Atividade" para incluir.</p>
                )}
              </div>
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-sm space-y-2">
              <div>
                <b>Conclusão calculada:</b>{" "}
                {caracterizadoAtual ? `Caracterizado — adicional de ${form.percentual_aplicavel}%` : "Não caracterizado"}
              </div>
              {caracterizadoAtual && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Percentual aplicável (%)</Label>
                  <Input
                    type="number"
                    className="w-24"
                    value={form.percentual_aplicavel}
                    onChange={(e) => setForm((s) => ({ ...s, percentual_aplicavel: Number(e.target.value) }))}
                  />
                </div>
              )}
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={form.caracterizado_manual !== null}
                  onCheckedChange={(v) => setForm((s) => ({ ...s, caracterizado_manual: v ? caracterizadoAtual : null }))}
                />
                Sobrepor manualmente a conclusão do perito
              </label>
              {form.caracterizado_manual !== null && (
                <div className="flex items-center gap-2">
                  <Checkbox checked={form.caracterizado_manual} onCheckedChange={(v) => setForm((s) => ({ ...s, caracterizado_manual: !!v }))} />
                  <span className="text-xs">Caracterizar periculosidade mesmo com o cálculo automático acima</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Base legal</Label>
                <Input value={form.base_legal} onChange={(e) => setForm((s) => ({ ...s, base_legal: e.target.value }))} placeholder="Ex.: NR-16, Anexo 4" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((s) => ({ ...s, status: v as LaudoStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LAUDO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Metodologia</Label>
              <Textarea rows={2} value={form.metodologia} onChange={(e) => setForm((s) => ({ ...s, metodologia: e.target.value }))} />
            </div>
            <div>
              <Label>Fundamentação</Label>
              <Textarea rows={2} value={form.fundamentacao} onChange={(e) => setForm((s) => ({ ...s, fundamentacao: e.target.value }))} />
            </div>
            <div>
              <Label>Recomendações</Label>
              <Textarea rows={2} value={form.recomendacoes} onChange={(e) => setForm((s) => ({ ...s, recomendacoes: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Responsável técnico</Label>
                <Input value={form.responsavel_tecnico_nome} onChange={(e) => setForm((s) => ({ ...s, responsavel_tecnico_nome: e.target.value }))} />
              </div>
              <div>
                <Label>Registro (CREA / CRM / etc.)</Label>
                <Input value={form.responsavel_tecnico_registro} onChange={(e) => setForm((s) => ({ ...s, responsavel_tecnico_registro: e.target.value }))} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              {editingId ? "Salvar alterações" : "Criar laudo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
