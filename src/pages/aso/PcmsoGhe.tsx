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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Users, FileText, AlertTriangle, Stethoscope, Briefcase, Upload } from "lucide-react";
import { toast } from "sonner";
import { GRUPOS_RISCO } from "@/lib/asoFromGhe";
import PcmsoImportDialog from "@/components/aso/PcmsoImportDialog";

const TIPO_EXAME_FLAGS = [
  { k: "admissional", l: "Admissional" },
  { k: "periodico", l: "Periódico" },
  { k: "retorno_trabalho", l: "Retorno" },
  { k: "mudanca_risco", l: "Mudança Risco" },
  { k: "mudanca_funcao", l: "Mudança Função" },
  { k: "demissional", l: "Demissional" },
];

export default function PcmsoGhe() {
  const { empresaId, empresaScopeIds } = useAuth();
  const qc = useQueryClient();
  const [openGhe, setOpenGhe] = useState<any | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [empresaSel, setEmpresaSel] = useState<string>(empresaId || "");

  const { data: empresas = [] } = useQuery({
    queryKey: ["pcmso-empresas", (empresaScopeIds || []).join(",")],
    queryFn: async () => {
      let q = supabase.from("empresa_config").select("id, nome").order("nome");
      const ids = (empresaScopeIds || []);
      if (ids.length > 0) {
        q = q.in("id", ids);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: ghes = [], isLoading } = useQuery({
    queryKey: ["ghe-list", empresaSel],
    enabled: !!empresaSel,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ghe_ges")
        .select("*, ghe_funcoes(count), ghe_riscos(count), ghe_exames(count)")
        .eq("empresa_id", empresaSel)
        .order("codigo");
      if (error) throw error;
      // count colaboradores
      const ids = (data || []).map((g: any) => g.id);
      let counts: Record<string, number> = {};
      if (ids.length) {
        const { data: fs } = await supabase.from("funcionarios").select("ghe_id").in("ghe_id", ids);
        (fs || []).forEach((f: any) => { counts[f.ghe_id] = (counts[f.ghe_id] || 0) + 1; });
      }
      const rows = data || [];
      const filtered = (empresaScopeIds && empresaScopeIds.length > 0)
        ? rows.filter((r: any) => empresaScopeIds.includes(r.empresa_id))
        : rows;

      return filtered.map((g: any) => ({
        ...g,
        nFuncoes: g.ghe_funcoes?.[0]?.count || 0,
        nRiscos: g.ghe_riscos?.[0]?.count || 0,
        nExames: g.ghe_exames?.[0]?.count || 0,
        nColaboradores: counts[g.id] || 0,
      }));
    },
  });

  const novoGhe = () => { setEditing(null); setOpenForm(true); };
  const editarGhe = (g: any) => { setEditing(g); setOpenForm(true); };

  const excluirGhe = async (g: any) => {
    if (!confirm(`Excluir o GHE ${g.codigo} — ${g.nome}? Funções, riscos e exames vinculados também serão removidos.`)) return;
    const { error } = await supabase.from("ghe_ges").delete().eq("id", g.id);
    if (error) return toast.error(error.message);
    toast.success("GHE excluído");
    qc.invalidateQueries({ queryKey: ["ghe-list"] });
  };

  const statusOf = (g: any) => {
    if (g.nFuncoes === 0) return { v: "Pendente", color: "secondary" as const };
    if (g.nRiscos === 0) return { v: "Sem riscos", color: "destructive" as const };
    if (g.nExames === 0) return { v: "Sem exames", color: "destructive" as const };
    return { v: "Completo", color: "default" as const };
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5" />Configuração PCMSO / GHE</CardTitle>
              <p className="text-sm text-muted-foreground">Cadastre os grupos do PCMSO, funções, riscos e exames para geração automática do ASO.</p>
            </div>
            <div className="flex gap-2 items-center">
              <Select value={empresaSel} onValueChange={setEmpresaSel}>
                <SelectTrigger className="w-[240px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
                <SelectContent>{empresas.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setOpenImport(true)} disabled={!empresaSel}><Upload className="h-4 w-4 mr-1" />Importar PCMSO</Button>
              <Button onClick={novoGhe} disabled={!empresaSel}><Plus className="h-4 w-4 mr-1" />Novo GHE/GES</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && ghes.length === 0 && (
            <p className="text-sm text-muted-foreground italic">Nenhum GHE/GES cadastrado. Clique em "Novo GHE/GES" para começar.</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ghes.map((g: any) => {
              const st = statusOf(g);
              return (
                <Card key={g.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">{g.codigo}</div>
                        <div className="text-sm">{g.nome}</div>
                        {g.setor && <div className="text-xs text-muted-foreground">Setor: {g.setor}</div>}
                      </div>
                      <Badge variant={st.color}>{st.v}</Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-center text-xs pt-2 border-t">
                      <div><div className="font-bold">{g.nFuncoes}</div><div className="text-muted-foreground">Funções</div></div>
                      <div><div className="font-bold">{g.nRiscos}</div><div className="text-muted-foreground">Riscos</div></div>
                      <div><div className="font-bold">{g.nExames}</div><div className="text-muted-foreground">Exames</div></div>
                      <div><div className="font-bold">{g.nColaboradores}</div><div className="text-muted-foreground">Pessoas</div></div>
                    </div>
                    <div className="flex gap-1 pt-2">
                      <Button size="sm" variant="default" className="flex-1" onClick={() => setOpenGhe(g)}>Configurar</Button>
                      <Button size="icon" variant="ghost" onClick={() => editarGhe(g)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => excluirGhe(g)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <GheFormDialog open={openForm} onOpenChange={setOpenForm} empresaId={empresaSel} editing={editing} onSaved={() => qc.invalidateQueries({ queryKey: ["ghe-list"] })} />
      <PcmsoImportDialog open={openImport} onOpenChange={setOpenImport} empresaId={empresaSel} onImported={() => qc.invalidateQueries({ queryKey: ["ghe-list"] })} />
      {openGhe && <GheDetailDialog ghe={openGhe} onClose={() => { setOpenGhe(null); qc.invalidateQueries({ queryKey: ["ghe-list"] }); }} />}
    </div>
  );
}

function GheFormDialog({ open, onOpenChange, empresaId, editing, onSaved }: any) {
  const [form, setForm] = useState({ codigo: "", nome: "", setor: "", descricao: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) setForm({ codigo: editing.codigo || "", nome: editing.nome || "", setor: editing.setor || "", descricao: editing.descricao || "" });
    else setForm({ codigo: "", nome: "", setor: "", descricao: "" });
  }, [editing, open]);

  const save = async () => {
    if (!form.codigo || !form.nome) return toast.error("Código e nome são obrigatórios");
    setSaving(true);
    const payload: any = { ...form, empresa_id: empresaId };
    const { error } = editing
      ? await supabase.from("ghe_ges").update(payload).eq("id", editing.id)
      : await supabase.from("ghe_ges").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("GHE salvo");
    onSaved(); onOpenChange(false);
    setForm({ codigo: "", nome: "", setor: "", descricao: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar GHE/GES" : "Novo GHE/GES"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Código *</Label><Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="GHE 01" /></div>
            <div><Label>Setor</Label><Input value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} placeholder="Costura" /></div>
          </div>
          <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Administrativo / PCP" /></div>
          <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GheDetailDialog({ ghe, onClose }: { ghe: any; onClose: () => void }) {
  return (
    <Dialog open={true} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ghe.codigo} — {ghe.nome}</DialogTitle>
          {ghe.setor && <p className="text-sm text-muted-foreground">Setor: {ghe.setor}</p>}
        </DialogHeader>
        <Tabs defaultValue="funcoes">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="funcoes" className="gap-1"><Briefcase className="h-3 w-3" />Funções</TabsTrigger>
            <TabsTrigger value="riscos" className="gap-1"><AlertTriangle className="h-3 w-3" />Riscos</TabsTrigger>
            <TabsTrigger value="exames" className="gap-1"><Stethoscope className="h-3 w-3" />Exames</TabsTrigger>
            <TabsTrigger value="colab" className="gap-1"><Users className="h-3 w-3" />Colaboradores</TabsTrigger>
          </TabsList>
          <TabsContent value="funcoes" className="mt-4"><FuncoesTab ghe={ghe} /></TabsContent>
          <TabsContent value="riscos" className="mt-4"><RiscosTab ghe={ghe} /></TabsContent>
          <TabsContent value="exames" className="mt-4"><ExamesTab ghe={ghe} /></TabsContent>
          <TabsContent value="colab" className="mt-4"><ColabTab ghe={ghe} /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function FuncoesTab({ ghe }: { ghe: any }) {
  const qc = useQueryClient();
  const [nova, setNova] = useState("");
  const [bulk, setBulk] = useState("");

  const { data = [], refetch } = useQuery({
    queryKey: ["ghe-funcoes", ghe.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("ghe_funcoes").select("*").eq("ghe_id", ghe.id).order("nome_funcao");
      if (error) throw error;
      return data || [];
    },
  });

  const add = async () => {
    if (!nova.trim()) return;
    const { error } = await supabase.from("ghe_funcoes").insert({ ghe_id: ghe.id, empresa_id: ghe.empresa_id, nome_funcao: nova.trim() });
    if (error) return toast.error(error.message);
    setNova(""); refetch();
  };
  const addBulk = async () => {
    const lines = bulk.split("\n").map((x) => x.trim()).filter(Boolean);
    if (!lines.length) return;
    const { error } = await supabase.from("ghe_funcoes").insert(lines.map((l) => ({ ghe_id: ghe.id, empresa_id: ghe.empresa_id, nome_funcao: l })));
    if (error) return toast.error(error.message);
    setBulk(""); toast.success(`${lines.length} funções adicionadas`); refetch();
  };
  const remove = async (id: string) => {
    await supabase.from("ghe_funcoes").delete().eq("id", id);
    refetch();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Nome da função (ex: Costureiro(a))" onKeyDown={(e) => e.key === "Enter" && add()} />
        <Button onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
      <div>
        <Label className="text-xs">Colar várias funções (uma por linha)</Label>
        <Textarea value={bulk} onChange={(e) => setBulk(e.target.value)} rows={3} placeholder="Supervisor de Produção&#10;Auxiliar Administrativo" />
        <Button size="sm" variant="outline" onClick={addBulk} className="mt-2" disabled={!bulk.trim()}>Adicionar lista</Button>
      </div>
      <div className="border rounded divide-y">
        {data.length === 0 && <p className="text-sm text-muted-foreground p-3">Nenhuma função cadastrada.</p>}
        {data.map((f: any) => (
          <div key={f.id} className="flex items-center justify-between p-2">
            <span className="text-sm">{f.nome_funcao}</span>
            <Button size="icon" variant="ghost" onClick={() => remove(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiscosTab({ ghe }: { ghe: any }) {
  const [grupo, setGrupo] = useState("ergonomico");
  const [tipoAgente, setTipoAgente] = useState("");
  const [texto, setTexto] = useState("");
  const [exposicao, setExposicao] = useState("Intermitente");

  const { data = [], refetch } = useQuery({
    queryKey: ["ghe-riscos", ghe.id],
    queryFn: async () => {
      const { data } = await supabase.from("ghe_riscos").select("*").eq("ghe_id", ghe.id).order("grupo");
      return data || [];
    },
  });

  const add = async () => {
    if (!tipoAgente.trim()) return toast.error("Informe o tipo de agente");
    const { error } = await supabase.from("ghe_riscos").insert({
      ghe_id: ghe.id, empresa_id: ghe.empresa_id, grupo,
      tipo_agente: tipoAgente.trim(), texto_aso: (texto || tipoAgente).trim(), exposicao,
    });
    if (error) return toast.error(error.message);
    setTipoAgente(""); setTexto(""); refetch();
  };
  const remove = async (id: string) => { await supabase.from("ghe_riscos").delete().eq("id", id); refetch(); };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-3">
          <Label className="text-xs">Grupo</Label>
          <Select value={grupo} onValueChange={setGrupo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{GRUPOS_RISCO.map((g) => <SelectItem key={g.k} value={g.k}>{g.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="col-span-4">
          <Label className="text-xs">Tipo de agente *</Label>
          <Input value={tipoAgente} onChange={(e) => setTipoAgente(e.target.value)} placeholder="Postura inadequada" />
        </div>
        <div className="col-span-3">
          <Label className="text-xs">Texto resumido (ASO)</Label>
          <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="(usa o tipo de agente se vazio)" />
        </div>
        <div className="col-span-2 flex items-end">
          <Button onClick={add} className="w-full"><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
        </div>
      </div>
      {GRUPOS_RISCO.map((g) => {
        const itens = data.filter((r: any) => r.grupo === g.k);
        return (
          <div key={g.k} className="border rounded p-2">
            <div className="font-medium text-sm mb-1">{g.l}</div>
            {itens.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">N.A. (Não se aplica)</p>
            ) : (
              <div className="space-y-1">
                {itens.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <span>{r.texto_aso || r.tipo_agente}</span>
                    <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ExamesTab({ ghe }: { ghe: any }) {
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [flags, setFlags] = useState<Record<string, boolean>>({ admissional: false, periodico: false, retorno_trabalho: false, mudanca_risco: false, mudanca_funcao: false, demissional: false });
  const [periodicidade, setPeriodicidade] = useState<number>(12);
  const [busca, setBusca] = useState("");

  const { data = [], refetch } = useQuery({
    queryKey: ["ghe-exames", ghe.id],
    queryFn: async () => {
      const { data } = await supabase.from("ghe_exames").select("*").eq("ghe_id", ghe.id).order("nome_exame");
      return data || [];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: catalogo = [] } = useQuery({
    queryKey: ["aso-cat-ghe", ghe.empresa_id],
    queryFn: async () => {
      const { data } = await supabase.from("aso_exames_catalogo").select("*").eq("empresa_id", ghe.empresa_id).eq("ativo", true).order("nome");
      return data || [];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const norm = (s: string) => (s || "").trim().toLowerCase();
  const vinculadosNomes = new Set(data.map((d: any) => norm(d.nome_exame)));

  const add = async () => {
    if (!nome.trim()) return toast.error("Informe o nome do exame");
    const { error } = await supabase.from("ghe_exames").insert({
      ghe_id: ghe.id, empresa_id: ghe.empresa_id,
      nome_exame: nome.trim(), codigo_exame: codigo.trim() || null, 
      periodicidade_meses: periodicidade,
      ...flags,
    });
    if (error) return toast.error(error.message);
    setNome(""); setCodigo(""); setPeriodicidade(12); refetch();
  };
  const toggle = async (id: string, field: string, value: any) => {
    await supabase.from("ghe_exames").update({ [field]: value }).eq("id", id);
    refetch();
  };
  const remove = async (id: string) => { await supabase.from("ghe_exames").delete().eq("id", id); refetch(); };

  const toggleCatalogo = async (cat: any, checked: boolean) => {
    if (checked) {
      const existing = data.find((d: any) => norm(d.nome_exame) === norm(cat.nome));
      if (existing) return;
      const { error } = await supabase.from("ghe_exames").insert({
        ghe_id: ghe.id, empresa_id: ghe.empresa_id,
        nome_exame: cat.nome, codigo_exame: cat.codigo || null,
        admissional: true, periodico: true, retorno_trabalho: true, mudanca_risco: true, mudanca_funcao: true, demissional: true,
      });
      if (error) return toast.error(error.message);
      refetch();
    } else {
      const existing = data.find((d: any) => norm(d.nome_exame) === norm(cat.nome));
      if (existing) { await supabase.from("ghe_exames").delete().eq("id", existing.id); refetch(); }
    }
  };

  const catalogoFiltrado = catalogo.filter((c: any) => !busca.trim() || norm(c.nome).includes(norm(busca)));

  return (
    <div className="space-y-3">
      <div className="border rounded p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Catálogo de Exames da empresa</Label>
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar no catálogo…" className="max-w-[240px] h-8" />
        </div>
        {catalogo.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nenhum exame no catálogo. Cadastre em Exames &gt; Catálogo.</p>
        ) : (
          <div className="max-h-[200px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1">
            {catalogoFiltrado.map((c: any) => {
              const checked = vinculadosNomes.has(norm(c.nome));
              return (
                <label key={c.id} className="flex items-center gap-2 text-sm border rounded px-2 py-1 cursor-pointer hover:bg-muted/50">
                  <Checkbox checked={checked} onCheckedChange={(v) => toggleCatalogo(c, !!v)} />
                  <span className="flex-1">{c.codigo ? `[${c.codigo}] ` : ""}{c.nome}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="border rounded p-3 space-y-2">
        <Label className="text-sm font-medium">Adicionar exame manualmente</Label>
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-2"><Label className="text-xs">Código</Label><Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="0295" /></div>
          <div className="col-span-6"><Label className="text-xs">Nome do exame *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Avaliação Clínica Ocupacional" /></div>
          <div className="col-span-2"><Label className="text-xs">Validade (m)</Label><Input type="number" value={periodicidade} onChange={(e) => setPeriodicidade(parseInt(e.target.value) || 0)} /></div>
          <div className="col-span-2 flex items-end"><Button onClick={add} className="w-full"><Plus className="h-4 w-4 mr-1" />Add</Button></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {TIPO_EXAME_FLAGS.map((f) => (
            <label key={f.k} className="flex items-center gap-1 text-xs border rounded px-2 py-1 cursor-pointer">
              <Checkbox checked={flags[f.k]} onCheckedChange={(v) => setFlags({ ...flags, [f.k]: !!v })} />
              {f.l}
            </label>
          ))}
        </div>
      </div>

      <div className="border rounded">
        <div className="px-3 py-2 border-b text-sm font-medium bg-muted/30">Exames vinculados a este GHE</div>
        {data.length === 0 && <p className="text-sm text-muted-foreground p-3">Nenhum exame cadastrado.</p>}
        {data.map((ex: any) => (
          <div key={ex.id} className="p-2 border-b last:border-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <div className="text-sm font-medium">{ex.codigo_exame ? `[${ex.codigo_exame}] ` : ""}{ex.nome_exame}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Label className="text-[10px] text-muted-foreground">Validade (meses):</Label>
                  <Input 
                    type="number" 
                    value={ex.periodicidade_meses ?? 12} 
                    onChange={(e) => toggle(ex.id, "periodicidade_meses", parseInt(e.target.value) || 0)} 
                    className="h-6 w-16 text-[10px] px-1"
                  />
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(ex.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {TIPO_EXAME_FLAGS.map((f) => (
                <label key={f.k} className="flex items-center gap-1 text-[11px] border rounded px-1.5 py-0.5 cursor-pointer">
                  <Checkbox checked={!!ex[f.k]} onCheckedChange={(v) => toggle(ex.id, f.k, !!v)} className="h-3 w-3" />
                  {f.l}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


function ColabTab({ ghe }: { ghe: any }) {
  const qc = useQueryClient();
  const { data = [], refetch } = useQuery({
    queryKey: ["ghe-colab", ghe.id],
    queryFn: async () => {
      const { data } = await supabase.from("funcionarios").select("id, nome, cpf, cargo, setor").eq("ghe_id", ghe.id).order("nome");
      return data || [];
    },
  });
  const { data: disponiveis = [] } = useQuery({
    queryKey: ["ghe-colab-disp", ghe.empresa_id, ghe.id],
    queryFn: async () => {
      const { data } = await supabase.from("funcionarios").select("id, nome, cpf, cargo").eq("empresa_id", ghe.empresa_id).is("ghe_id", null).is("data_demissao", null).order("nome").limit(500);
      return data || [];
    },
  });
  const [sel, setSel] = useState("");
  const vincular = async () => {
    if (!sel) return;
    await supabase.from("funcionarios").update({ ghe_id: ghe.id }).eq("id", sel);
    setSel(""); refetch(); qc.invalidateQueries({ queryKey: ["ghe-colab-disp"] });
  };
  const desvincular = async (id: string) => {
    await supabase.from("funcionarios").update({ ghe_id: null }).eq("id", id);
    refetch(); qc.invalidateQueries({ queryKey: ["ghe-colab-disp"] });
  };
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Select value={sel} onValueChange={setSel}>
          <SelectTrigger><SelectValue placeholder="Selecione um colaborador para vincular…" /></SelectTrigger>
          <SelectContent>{disponiveis.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.nome} — {f.cargo || ""}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={vincular} disabled={!sel}>Vincular</Button>
      </div>
      <div className="border rounded divide-y">
        {data.length === 0 && <p className="text-sm text-muted-foreground p-3">Nenhum colaborador vinculado.</p>}
        {data.map((f: any) => (
          <div key={f.id} className="flex items-center justify-between p-2 text-sm">
            <div>{f.nome} <span className="text-muted-foreground">— {f.cargo || "—"}</span></div>
            <Button size="sm" variant="ghost" onClick={() => desvincular(f.id)}>Desvincular</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
