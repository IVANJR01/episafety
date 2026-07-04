import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Power, ClipboardList, Search, Briefcase, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { ListSkeleton } from "@/components/ui/list-skeleton";

export default function CadastroGhe() {
  const { empresaId, empresaScopeIds, isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [empresaSel, setEmpresaSel] = useState<string>(empresaId || "");
  const [busca, setBusca] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [openFuncoes, setOpenFuncoes] = useState<any | null>(null);

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
        .select("id, empresa_id, codigo, nome, setor, descricao, status, ghe_funcoes(nome_funcao)")
        .eq("empresa_id", empresaSel)
        .order("codigo");
      if (error) throw error;
      return (data || []).map((g: any) => ({
        ...g,
        funcoesList: (g.ghe_funcoes || []).map((f: any) => f.nome_funcao).filter(Boolean).sort(),
        nFuncoes: (g.ghe_funcoes || []).length,
      }));
    },
  });

  const filtrados = ghes.filter((g: any) => {
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return (
      g.codigo?.toLowerCase().includes(q) ||
      g.nome?.toLowerCase().includes(q) ||
      g.setor?.toLowerCase().includes(q)
    );
  });

  const novo = () => { setEditing(null); setOpenForm(true); };
  const editar = (g: any) => { setEditing(g); setOpenForm(true); };

  const alternarStatus = async (g: any) => {
    const novoStatus = g.status === "ativo" ? "inativo" : "ativo";
    const { error } = await supabase.from("ghe_ges").update({ status: novoStatus }).eq("id", g.id);
    if (error) return toast.error(error.message);
    toast.success(`GHE ${novoStatus === "ativo" ? "ativado" : "inativado"}`);
    qc.invalidateQueries({ queryKey: ["cad-ghe-list"] });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="GHE/GES"
        subtitle="Cadastro dos grupos homogêneos de exposição e setores vinculados à empresa."
        actions={
          <>
            <Select value={empresaSel} onValueChange={setEmpresaSel}>
              <SelectTrigger className="w-full sm:w-[240px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
              <SelectContent>{empresas.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={novo} disabled={!empresaSel}><Plus className="h-4 w-4 mr-1" />Novo GHE/GES</Button>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por código, nome ou setor…" className="pl-8" />
          </div>
          {isLoading && <ListSkeleton rows={4} variant="row" />}
          {!isLoading && filtrados.length === 0 && (
            <EmptyState
              icon={ClipboardList}
              title={busca ? "Nenhum resultado" : "Nenhum GHE/GES cadastrado"}
              description={busca ? "Ajuste a busca para ver mais resultados." : "Cadastre os grupos para organizar setores, funções e exposições ocupacionais."}
              action={!busca && empresaSel ? (
                <Button onClick={novo}><Plus className="h-4 w-4 mr-1" />Novo GHE/GES</Button>
              ) : undefined}
              bare
            />
          )}
          {filtrados.length > 0 && (
            <div className="border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">Código</TableHead>
                    <TableHead className="w-[180px]">Setor</TableHead>
                    <TableHead>Funções ({"#"})</TableHead>
                    <TableHead className="w-[90px]">Status</TableHead>
                    <TableHead className="w-[200px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((g: any) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium align-top">{g.codigo}</TableCell>
                      <TableCell className="align-top">{g.setor || g.nome || "—"}</TableCell>
                      <TableCell className="align-top">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{g.nFuncoes}</Badge>
                          {g.descricao && (
                            <span className="text-xs text-muted-foreground truncate max-w-[260px]" title={g.descricao}>{g.descricao}</span>
                          )}
                        </div>
                        {g.funcoesList?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {g.funcoesList.map((nf: string, i: number) => (
                              <Badge key={i} variant="secondary" className="font-normal text-xs">{nf}</Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs italic text-muted-foreground">Sem funções</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <StatusBadge tone={g.status === "ativo" ? "success" : "neutral"} size="sm">
                          {g.status === "ativo" ? "Ativo" : "Inativo"}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <Button size="sm" variant="outline" onClick={() => setOpenFuncoes(g)} title="Gerenciar funções"><Briefcase className="h-4 w-4 mr-1" />Funções</Button>
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
    </div>
  );
}

function GheFormDialog({ open, onOpenChange, empresaId, editing, onSaved }: any) {
  const [form, setForm] = useState<any>({
    codigo: "", nome: "", setor: "", descricao: "", status: "ativo",
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
        setor: editing.setor || "",
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
        codigo: "", nome: "", setor: "", descricao: "", status: "ativo",
        descricao_atividades: "", trabalhadores_expostos: "", frequencia_exposicao: "",
        tempo_exposicao: "", severidade: "", probabilidade: "", nivel_risco: "",
        medidas_controle_existentes: "", medidas_controle_recomendadas: "",
        epcs: "", capacitacoes_obrigatorias: "", observacoes_tecnicas: "",
      });
    }
    setShowAvancado(false);
  }, [editing, open]);

  const save = async () => {
    if (!form.codigo.trim() || !form.setor.trim()) return toast.error("Código e setor são obrigatórios");
    setSaving(true);
    const toInt = (v: any) => (v === "" || v === null || v === undefined ? null : Number(v));
    const payload: any = {
      codigo: form.codigo.trim(),
      nome: form.setor.trim(),
      setor: form.setor.trim(),
      descricao: form.descricao.trim() || null,
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
    toast.success("GHE salvo");
    onSaved();
    onOpenChange(false);
  };

  const set = (k: string, v: any) => setForm({ ...form, [k]: v });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Editar GHE/GES" : "Novo GHE/GES"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Código *</Label>
              <Input value={form.codigo} onChange={(e) => set("codigo", e.target.value)} placeholder="GHE 01" />
            </div>
            <div>
              <Label>Setor *</Label>
              <Input value={form.setor} onChange={(e) => set("setor", e.target.value)} placeholder="PCP" />
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} rows={2} placeholder="Grupo de exposição do setor PCP." />
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
                <Label>Descrição das atividades</Label>
                <Textarea rows={2} value={form.descricao_atividades} onChange={(e) => set("descricao_atividades", e.target.value)} placeholder="Ex.: Manutenção em painel elétrico energizado." />
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
                <Label>EPCs (equipamentos de proteção coletiva)</Label>
                <Textarea rows={2} value={form.epcs} onChange={(e) => set("epcs", e.target.value)} placeholder="Ex.: sinalização, bloqueio, aterramento temporário" />
              </div>
              <div>
                <Label>Capacitações obrigatórias</Label>
                <Textarea rows={2} value={form.capacitacoes_obrigatorias} onChange={(e) => set("capacitacoes_obrigatorias", e.target.value)} placeholder="Ex.: NR-10, NR-35, SEP" />
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


function FuncoesDialog({ ghe, onClose }: { ghe: any; onClose: () => void }) {
  const [nova, setNova] = useState("");
  const [bulk, setBulk] = useState("");
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ghe_funcoes")
      .select("id, nome_funcao, cbo")
      .eq("ghe_id", ghe.id)
      .order("nome_funcao");
    setLoading(false);
    if (error) return toast.error(error.message);
    setItens(data || []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ghe.id]);

  const add = async () => {
    const nome = nova.trim();
    if (!nome) return;
    const { error } = await supabase.from("ghe_funcoes").insert({
      ghe_id: ghe.id, empresa_id: ghe.empresa_id || ghe.empresaId, nome_funcao: nome,
    } as any);
    if (error) return toast.error(error.message);
    setNova(""); load();
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

  const remove = async (id: string) => {
    const { error } = await supabase.from("ghe_funcoes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const startEdit = (f: any) => { setEditId(f.id); setEditVal(f.nome_funcao || ""); };
  const cancelEdit = () => { setEditId(null); setEditVal(""); };
  const saveEdit = async () => {
    const nome = editVal.trim();
    if (!editId || !nome) return cancelEdit();
    const { error } = await supabase.from("ghe_funcoes").update({ nome_funcao: nome }).eq("id", editId);
    if (error) return toast.error(error.message);
    cancelEdit(); load();
  };

  return (
    <Dialog open={true} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Funções — {ghe.codigo} {ghe.setor ? `· ${ghe.setor}` : ""}</DialogTitle>
          <p className="text-sm text-muted-foreground">Cadastre as funções/cargos vinculados a este GHE. No cadastro do funcionário, ao escolher o GHE, estas funções aparecerão automaticamente.</p>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Nome da função (ex: Costureiro(a))" onKeyDown={(e) => e.key === "Enter" && add()} />
            <Button onClick={add}><Plus className="h-4 w-4" /></Button>
          </div>
          <div>
            <Label className="text-xs">Colar várias funções (uma por linha)</Label>
            <Textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={3} placeholder="Supervisor de Produção&#10;Auxiliar Administrativo" />
            <Button size="sm" variant="outline" onClick={addBulk} className="mt-2" disabled={!bulk.trim()}>Adicionar lista</Button>
          </div>
          <div className="border rounded divide-y max-h-[280px] overflow-y-auto">
            {loading && <p className="text-sm text-muted-foreground p-3">Carregando…</p>}
            {!loading && itens.length === 0 && <p className="text-sm text-muted-foreground p-3 italic">Nenhuma função cadastrada.</p>}
            {itens.map((f: any) => (
              <div key={f.id} className="flex items-center justify-between gap-2 p-2">
                {editId === f.id ? (
                  <>
                    <Input
                      autoFocus
                      value={editVal}
                      onChange={(e) => setEditVal(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }}
                      className="h-8"
                    />
                    <Button size="sm" onClick={saveEdit}>Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancelar</Button>
                  </>
                ) : (
                  <>
                    <span className="text-sm flex-1">{f.nome_funcao}{f.cbo ? <span className="text-xs text-muted-foreground ml-2">CBO {f.cbo}</span> : null}</span>
                    <Button size="icon" variant="ghost" onClick={() => startEdit(f)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(f.id)} title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
