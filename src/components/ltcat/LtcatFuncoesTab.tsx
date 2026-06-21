import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Pencil, Trash2, Users, Lock, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { LtcatFuncao } from "@/lib/ltcatTypes";

interface Props {
  ltcatId: string;
  empresaId: string;
  editavel: boolean;
}

export default function LtcatFuncoesTab({ ltcatId, empresaId, editavel }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LtcatFuncao | null>(null);
  const [gheSel, setGheSel] = useState<string>("");

  const empty = {
    grupo_homogeneo_id: "",
    funcao_origem_id: "",
    nome_funcao: "",
    cbo: "",
    descricao_atividade: "",
    numero_trabalhadores: "",
    observacoes: "",
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const { data: ghes = [] } = useQuery({
    queryKey: ["ltcat-ghes-min", ltcatId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ltcat_grupos_homogeneos")
        .select("id, codigo, nome").eq("ltcat_id", ltcatId).order("codigo");
      return data || [];
    },
  });

  const { data: funcoesEmpresa = [] } = useQuery({
    queryKey: ["ltcat-funcoes-empresa", empresaId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("aso_funcoes")
        .select("id, nome, cbo").eq("empresa_id", empresaId).order("nome");
      return data || [];
    },
  });

  const { data: funcoes = [], isLoading } = useQuery({
    queryKey: ["ltcat-funcoes", ltcatId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ltcat_funcoes")
        .select("*").eq("ltcat_id", ltcatId).order("nome_funcao");
      return (data || []) as LtcatFuncao[];
    },
  });

  const openNew = (gheId: string) => {
    setEditing(null);
    setForm({ ...empty, grupo_homogeneo_id: gheId });
    setOpen(true);
  };
  const openEdit = (f: LtcatFuncao) => {
    setEditing(f);
    setForm({
      grupo_homogeneo_id: f.grupo_homogeneo_id,
      funcao_origem_id: f.funcao_origem_id || "",
      nome_funcao: f.nome_funcao,
      cbo: f.cbo || "",
      descricao_atividade: f.descricao_atividade || "",
      numero_trabalhadores: f.numero_trabalhadores?.toString() || "",
      observacoes: f.observacoes || "",
    });
    setOpen(true);
  };

  const pickFuncaoOrigem = (id: string) => {
    const f = (funcoesEmpresa as any[]).find((x) => x.id === id);
    setForm((p) => ({
      ...p,
      funcao_origem_id: id,
      nome_funcao: f?.nome || p.nome_funcao,
      cbo: f?.cbo || p.cbo,
    }));
  };

  const save = async () => {
    if (!form.grupo_homogeneo_id) return toast.error("Selecione o GHE/GES");
    if (!form.nome_funcao.trim()) return toast.error("Nome da função obrigatório");
    setSaving(true);
    try {
      const payload: any = {
        ltcat_id: ltcatId,
        empresa_id: empresaId,
        grupo_homogeneo_id: form.grupo_homogeneo_id,
        funcao_origem_id: form.funcao_origem_id || null,
        nome_funcao: form.nome_funcao.trim(),
        cbo: form.cbo.trim() || null,
        descricao_atividade: form.descricao_atividade.trim() || null,
        numero_trabalhadores: form.numero_trabalhadores ? parseInt(form.numero_trabalhadores) : null,
        observacoes: form.observacoes.trim() || null,
      };
      if (editing) {
        const { error } = await (supabase.from as any)("ltcat_funcoes").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Função atualizada");
      } else {
        payload.created_by = user?.id || null;
        const { error } = await (supabase.from as any)("ltcat_funcoes").insert(payload);
        if (error) throw error;
        toast.success("Função adicionada");
      }
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["ltcat-funcoes", ltcatId] });
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar");
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta função?")) return;
    const { error } = await (supabase.from as any)("ltcat_funcoes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Função removida");
    qc.invalidateQueries({ queryKey: ["ltcat-funcoes", ltcatId] });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {(ghes as any[]).length} GHE/GES · {funcoes.length} funções cadastradas
        </div>
        {!editavel && (
          <Badge variant="outline" className="bg-zinc-100 text-zinc-700"><Lock className="h-3 w-3 mr-1" /> Somente leitura</Badge>
        )}
      </div>

      {isLoading ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Carregando…</CardContent></Card>
      ) : (ghes as any[]).length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          Cadastre GHE/GES na aba Agentes e Avaliações antes de vincular funções.
        </CardContent></Card>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {(ghes as any[]).map((g) => {
            const fs = funcoes.filter((f) => f.grupo_homogeneo_id === g.id);
            return (
              <AccordionItem key={g.id} value={g.id} className="border rounded-md px-3">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex-1 text-left flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs">{g.codigo}</span>
                    <span className="font-medium">{g.nome}</span>
                    <Badge variant="outline" className="text-xs"><Briefcase className="h-3 w-3 mr-1" />{fs.length} funções</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pb-3">
                  {editavel && (
                    <Button size="sm" variant="outline" onClick={() => openNew(g.id)}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar função
                    </Button>
                  )}
                  {fs.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">Nenhuma função vinculada a este GHE.</p>
                  ) : (
                    <div className="space-y-1">
                      {fs.map((f) => (
                        <div key={f.id} className="border rounded-md p-2 flex items-start justify-between gap-2">
                          <div className="text-sm">
                            <div className="font-medium">{f.nome_funcao}{f.cbo && <span className="text-muted-foreground font-mono text-xs ml-2">CBO {f.cbo}</span>}</div>
                            <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                              <span><Users className="h-3 w-3 inline mr-1" />{f.numero_trabalhadores ?? 0}</span>
                              {f.descricao_atividade && <span className="truncate max-w-md">{f.descricao_atividade}</span>}
                            </div>
                          </div>
                          {editavel && (
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => openEdit(f)}><Pencil className="h-3 w-3" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => remove(f.id)}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar função" : "Adicionar função ao GHE"}</DialogTitle>
            <DialogDescription>Vincule função/CBO ao grupo homogêneo de exposição.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">GHE/GES *</Label>
              <Select value={form.grupo_homogeneo_id} onValueChange={(v) => setForm({ ...form, grupo_homogeneo_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(ghes as any[]).map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.codigo} — {g.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Vincular função existente do sistema</Label>
              <Select value={form.funcao_origem_id} onValueChange={pickFuncaoOrigem}>
                <SelectTrigger><SelectValue placeholder="Opcional — escolher cadastro" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {(funcoesEmpresa as any[]).map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}{f.cbo ? ` · CBO ${f.cbo}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <Label className="text-xs">Nome da função *</Label>
                <Input value={form.nome_funcao} onChange={(e) => setForm({ ...form, nome_funcao: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">CBO</Label>
                <Input value={form.cbo} onChange={(e) => setForm({ ...form, cbo: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Nº de trabalhadores</Label>
                <Input type="number" min={0} value={form.numero_trabalhadores}
                  onChange={(e) => setForm({ ...form, numero_trabalhadores: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Descrição das atividades</Label>
              <Textarea rows={3} value={form.descricao_atividade}
                onChange={(e) => setForm({ ...form, descricao_atividade: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea rows={2} value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
