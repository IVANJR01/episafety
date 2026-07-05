import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Briefcase, MapPin, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const GRUPOS = [
  { k: "fisico", l: "Físicos" },
  { k: "quimico", l: "Químicos" },
  { k: "biologico", l: "Biológicos" },
  { k: "ergonomico", l: "Ergonômicos" },
  { k: "acidente", l: "Acidentes / Mecânicos" },
  { k: "outro", l: "Outros" },
];

export default function AsoFuncoes() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [empresaSel, setEmpresaSel] = useState<string>(empresaId || "");
  useEffect(() => { setEmpresaSel(empresaId || ""); }, [empresaId]);
  const [tab, setTab] = useState("funcoes");

  const { data: empresas = [] } = useQuery({
    queryKey: ["aso-fn-empresas", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("empresa_config").select("id, nome").eq("id", empresaId!).order("nome");
      return data || [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2"><Briefcase className="h-5 w-5" />Setores, Funções e Riscos</CardTitle>
          <Select value={empresaSel} onValueChange={setEmpresaSel}>
            <SelectTrigger className="w-[260px]"><SelectValue placeholder="Empresa…" /></SelectTrigger>
            <SelectContent>{empresas.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {!empresaSel && <p className="text-sm text-muted-foreground">Selecione uma empresa para gerenciar setores, funções e riscos.</p>}
        {empresaSel && (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="setores" className="gap-1"><MapPin className="h-4 w-4" />Setores</TabsTrigger>
              <TabsTrigger value="funcoes" className="gap-1"><Briefcase className="h-4 w-4" />Funções</TabsTrigger>
              <TabsTrigger value="riscos" className="gap-1"><AlertTriangle className="h-4 w-4" />Riscos por função</TabsTrigger>
            </TabsList>
            <TabsContent value="setores" className="mt-3"><SetoresCRUD empresaId={empresaSel} /></TabsContent>
            <TabsContent value="funcoes" className="mt-3"><FuncoesCRUD empresaId={empresaSel} /></TabsContent>
            <TabsContent value="riscos" className="mt-3"><RiscosCRUD empresaId={empresaSel} /></TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

function SetoresCRUD({ empresaId }: { empresaId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ nome: "", descricao: "" });

  const { data: setores = [] } = useQuery({
    queryKey: ["aso-setores", empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("aso_setores").select("*").eq("empresa_id", empresaId).order("nome");
      return data || [];
    },
  });

  const save = async () => {
    if (!form.nome.trim()) return toast.error("Nome obrigatório");
    const payload = { ...form, empresa_id: empresaId };
    const { error } = editing
      ? await supabase.from("aso_setores").update(payload).eq("id", editing.id)
      : await supabase.from("aso_setores").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Setor salvo");
    qc.invalidateQueries({ queryKey: ["aso-setores", empresaId] });
    setOpen(false); setEditing(null); setForm({ nome: "", descricao: "" });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir setor?")) return;
    const { error } = await supabase.from("aso_setores").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["aso-setores", empresaId] });
  };

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm" onClick={() => { setEditing(null); setForm({ nome: "", descricao: "" }); }}><Plus className="h-4 w-4 mr-1" />Novo setor</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} setor</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="border rounded-lg divide-y">
        {setores.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">Nenhum setor cadastrado.</p>}
        {setores.map((s: any) => (
          <div key={s.id} className="flex items-center justify-between p-3">
            <div><div className="font-medium">{s.nome}</div>{s.descricao && <div className="text-xs text-muted-foreground">{s.descricao}</div>}</div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setForm({ nome: s.nome, descricao: s.descricao || "" }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FuncoesCRUD({ empresaId }: { empresaId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ nome: "", cbo: "", setor_id: "", descricao_atividades: "", exige_nr35: false, exige_nr10: false, exige_nr33: false, ativo: true });

  const { data: setores = [] } = useQuery({
    queryKey: ["aso-setores", empresaId],
    queryFn: async () => (await supabase.from("aso_setores").select("id, nome").eq("empresa_id", empresaId).order("nome")).data || [],
  });
  const { data: funcoes = [] } = useQuery({
    queryKey: ["aso-funcoes", empresaId],
    queryFn: async () => (await supabase.from("aso_funcoes").select("*, aso_setores:setor_id (nome)").eq("empresa_id", empresaId).order("nome")).data || [],
  });

  const save = async () => {
    if (!form.nome.trim()) return toast.error("Nome obrigatório");
    const payload: any = { ...form, empresa_id: empresaId, setor_id: form.setor_id || null };
    const { error } = editing
      ? await supabase.from("aso_funcoes").update(payload).eq("id", editing.id)
      : await supabase.from("aso_funcoes").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Função salva");
    qc.invalidateQueries({ queryKey: ["aso-funcoes", empresaId] });
    setOpen(false); setEditing(null);
  };
  const remove = async (id: string) => {
    if (!confirm("Excluir função e seus riscos?")) return;
    const { error } = await supabase.from("aso_funcoes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["aso-funcoes", empresaId] });
  };

  return (
    <div className="space-y-3">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button size="sm" onClick={() => { setEditing(null); setForm({ nome: "", cbo: "", setor_id: "", descricao_atividades: "", exige_nr35: false, exige_nr10: false, exige_nr33: false, ativo: true }); }}><Plus className="h-4 w-4 mr-1" />Nova função</Button></DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} função</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div><Label>CBO</Label><Input value={form.cbo} onChange={(e) => setForm({ ...form, cbo: e.target.value })} /></div>
              <div>
                <Label>Setor</Label>
                <Select value={form.setor_id} onValueChange={(v) => setForm({ ...form, setor_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Sem setor" /></SelectTrigger>
                  <SelectContent>{setores.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Descrição das atividades</Label><Textarea value={form.descricao_atividades} onChange={(e) => setForm({ ...form, descricao_atividades: e.target.value })} rows={3} /></div>
            <div className="grid grid-cols-3 gap-2">
              <Label className="flex items-center gap-2 border rounded p-2 cursor-pointer"><Checkbox checked={form.exige_nr35} onCheckedChange={(v) => setForm({ ...form, exige_nr35: !!v })} />NR-35</Label>
              <Label className="flex items-center gap-2 border rounded p-2 cursor-pointer"><Checkbox checked={form.exige_nr10} onCheckedChange={(v) => setForm({ ...form, exige_nr10: !!v })} />NR-10</Label>
              <Label className="flex items-center gap-2 border rounded p-2 cursor-pointer"><Checkbox checked={form.exige_nr33} onCheckedChange={(v) => setForm({ ...form, exige_nr33: !!v })} />NR-33</Label>
            </div>
            <Label className="flex items-center gap-2"><Checkbox checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: !!v })} />Função ativa</Label>
          </div>
          <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="border rounded-lg divide-y">
        {funcoes.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">Nenhuma função cadastrada.</p>}
        {funcoes.map((f: any) => (
          <div key={f.id} className="flex items-center justify-between p-3">
            <div>
              <div className="font-medium flex items-center gap-2">{f.nome} {!f.ativo && <Badge variant="outline">Inativa</Badge>}</div>
              <div className="text-xs text-muted-foreground">
                {f.aso_setores?.nome || "Sem setor"}{f.cbo && ` · CBO ${f.cbo}`}
                {(f.exige_nr35 || f.exige_nr10 || f.exige_nr33) && (
                  <> · {[f.exige_nr35 && "NR-35", f.exige_nr10 && "NR-10", f.exige_nr33 && "NR-33"].filter(Boolean).join(", ")}</>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => { setEditing(f); setForm(f); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiscosCRUD({ empresaId }: { empresaId: string }) {
  const qc = useQueryClient();
  const [funcaoId, setFuncaoId] = useState<string>("");
  const [grupo, setGrupo] = useState("fisico");
  const [descricao, setDescricao] = useState("");
  const [fonte, setFonte] = useState("");
  const [danos, setDanos] = useState("");
  const [controles, setControles] = useState("");

  const { data: funcoes = [] } = useQuery({
    queryKey: ["aso-funcoes", empresaId],
    queryFn: async () => (await supabase.from("aso_funcoes").select("id, nome").eq("empresa_id", empresaId).order("nome")).data || [],
  });
  const { data: riscos = [] } = useQuery({
    queryKey: ["aso-riscos-funcao", funcaoId],
    enabled: !!funcaoId,
    queryFn: async () => (await supabase.from("aso_riscos_funcao").select("*").eq("funcao_id", funcaoId).order("grupo")).data || [],
  });

  const add = async () => {
    if (!funcaoId) return toast.error("Selecione uma função");
    if (!descricao.trim()) return toast.error("Descrição obrigatória");
    const { error } = await supabase.from("aso_riscos_funcao").insert({
      empresa_id: empresaId, funcao_id: funcaoId, grupo, descricao, fonte_geradora: fonte, possiveis_danos: danos, medidas_controle: controles,
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["aso-riscos-funcao", funcaoId] });
    setDescricao(""); setFonte(""); setDanos(""); setControles("");
  };
  const remove = async (id: string) => {
    await supabase.from("aso_riscos_funcao").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["aso-riscos-funcao", funcaoId] });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Função</Label>
        <Select value={funcaoId} onValueChange={setFuncaoId}>
          <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
          <SelectContent>{funcoes.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {funcaoId && (
        <>
          <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Grupo</Label>
                <Select value={grupo} onValueChange={setGrupo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GRUPOS.map((g) => <SelectItem key={g.k} value={g.k}>{g.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Descrição *</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
              <div><Label className="text-xs">Fonte geradora</Label><Input value={fonte} onChange={(e) => setFonte(e.target.value)} /></div>
              <div><Label className="text-xs">Possíveis danos</Label><Input value={danos} onChange={(e) => setDanos(e.target.value)} /></div>
              <div className="col-span-2"><Label className="text-xs">Medidas de controle</Label><Input value={controles} onChange={(e) => setControles(e.target.value)} /></div>
            </div>
            <Button size="sm" onClick={add}><Plus className="h-4 w-4 mr-1" />Adicionar risco</Button>
          </div>
          <div className="border rounded-lg divide-y">
            {riscos.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">Nenhum risco cadastrado para esta função.</p>}
            {riscos.map((r: any) => (
              <div key={r.id} className="p-3 flex justify-between items-start">
                <div className="text-sm">
                  <Badge variant="outline" className="mr-2">{GRUPOS.find(g => g.k === r.grupo)?.l || r.grupo}</Badge>
                  <strong>{r.descricao}</strong>
                  {r.fonte_geradora && <div className="text-xs text-muted-foreground">Fonte: {r.fonte_geradora}</div>}
                  {r.medidas_controle && <div className="text-xs text-muted-foreground">Controle: {r.medidas_controle}</div>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
