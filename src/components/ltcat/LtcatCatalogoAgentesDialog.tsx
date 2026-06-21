import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Lock, Globe, Building2 } from "lucide-react";
import { toast } from "sonner";

const GRUPOS = [
  { value: "fisico", label: "Físico" },
  { value: "quimico", label: "Químico" },
  { value: "biologico", label: "Biológico" },
  { value: "ergonomico", label: "Ergonômico" },
  { value: "acidente", label: "Acidente / Mecânico" },
];

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  empresaId: string;
  canEdit: boolean;
}

export default function LtcatCatalogoAgentesDialog({ open, onOpenChange, empresaId, canEdit }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [editing, setEditing] = useState<any | null>(null);
  const empty = {
    codigo_esocial: "", nome: "", grupo: "fisico",
    unidade_medida: "", limite_tolerancia: "",
    base_normativa: "", observacoes: "",
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"list" | "form">("list");

  const { data: itens = [] } = useQuery({
    queryKey: ["ltcat-cat-mgmt", empresaId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ltcat_catalogo_agentes")
        .select("*")
        .or(`empresa_id.is.null,empresa_id.eq.${empresaId}`)
        .order("empresa_id", { ascending: true })
        .order("codigo_esocial");
      return data || [];
    },
    enabled: open,
  });

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setMode("form");
  };
  const openEdit = (a: any) => {
    setEditing(a);
    setForm({
      codigo_esocial: a.codigo_esocial || "",
      nome: a.nome || "",
      grupo: a.grupo || "fisico",
      unidade_medida: a.unidade_medida || "",
      limite_tolerancia: a.limite_tolerancia?.toString() || "",
      base_normativa: a.base_normativa || "",
      observacoes: a.observacoes || "",
    });
    setMode("form");
  };

  const save = async () => {
    if (!form.codigo_esocial.trim() || !form.nome.trim()) return toast.error("Código e nome obrigatórios");
    setSaving(true);
    try {
      const payload: any = {
        empresa_id: empresaId,
        codigo_esocial: form.codigo_esocial.trim(),
        nome: form.nome.trim(),
        grupo: form.grupo,
        unidade_medida: form.unidade_medida.trim() || null,
        limite_tolerancia: form.limite_tolerancia ? parseFloat(form.limite_tolerancia) : null,
        base_normativa: form.base_normativa.trim() || null,
        observacoes: form.observacoes.trim() || null,
        ativo: true,
      };
      if (editing) {
        if (editing.empresa_id === null) return toast.error("Agentes globais somente podem ser alterados por Super Admin");
        const { error } = await (supabase.from as any)("ltcat_catalogo_agentes").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Agente atualizado");
      } else {
        payload.created_by = user?.id || null;
        const { error } = await (supabase.from as any)("ltcat_catalogo_agentes").insert(payload);
        if (error) throw error;
        toast.success("Agente cadastrado");
      }
      qc.invalidateQueries({ queryKey: ["ltcat-cat-mgmt", empresaId] });
      qc.invalidateQueries({ queryKey: ["ltcat-cat-agentes", empresaId] });
      setMode("list");
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar");
    } finally { setSaving(false); }
  };

  const toggleAtivo = async (a: any) => {
    if (a.empresa_id === null) return toast.error("Agente global — exige Super Admin");
    const { error } = await (supabase.from as any)("ltcat_catalogo_agentes").update({ ativo: !a.ativo }).eq("id", a.id);
    if (error) return toast.error(error.message);
    toast.success(a.ativo ? "Desativado" : "Ativado");
    qc.invalidateQueries({ queryKey: ["ltcat-cat-mgmt", empresaId] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Catálogo de agentes nocivos</DialogTitle>
          <DialogDescription>
            Agentes globais são mantidos pela plataforma. Agentes da empresa podem ser criados/editados por quem tem permissão LTCAT — editar.
          </DialogDescription>
        </DialogHeader>

        {mode === "list" ? (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">{(itens as any[]).length} agentes visíveis</div>
              {canEdit && <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo agente</Button>}
            </div>
            <div className="max-h-[55vh] overflow-y-auto space-y-1">
              {(itens as any[]).map((a) => (
                <div key={a.id} className="border rounded-md p-2 flex items-start justify-between gap-2">
                  <div className="text-sm flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs">{a.codigo_esocial}</span>
                      <span className="font-medium truncate">{a.nome}</span>
                      <Badge variant="outline" className="text-xs">{a.grupo}</Badge>
                      {a.empresa_id === null ? (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700"><Globe className="h-3 w-3 mr-1" />Global</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700"><Building2 className="h-3 w-3 mr-1" />Empresa</Badge>
                      )}
                      {!a.ativo && <Badge variant="outline" className="text-xs bg-zinc-100">Inativo</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {a.limite_tolerancia != null ? `LT ${a.limite_tolerancia} ${a.unidade_medida || ""}` : ""}
                      {a.base_normativa ? ` · ${a.base_normativa}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {a.empresa_id === null ? (
                      <Badge variant="outline" className="text-xs"><Lock className="h-3 w-3 mr-1" />Super Admin</Badge>
                    ) : canEdit && (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(a)}><Pencil className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => toggleAtivo(a)}><Trash2 className="h-3 w-3" /></Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Código eSocial *</Label>
                <Input value={form.codigo_esocial} onChange={(e) => setForm({ ...form, codigo_esocial: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Grupo *</Label>
                <Select value={form.grupo} onValueChange={(v) => setForm({ ...form, grupo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRUPOS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Nome *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Unidade de medida</Label>
                <Input value={form.unidade_medida} onChange={(e) => setForm({ ...form, unidade_medida: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Limite de tolerância</Label>
                <Input type="number" step="0.01" value={form.limite_tolerancia}
                  onChange={(e) => setForm({ ...form, limite_tolerancia: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Fundamento/base normativa</Label>
                <Input value={form.base_normativa} onChange={(e) => setForm({ ...form, base_normativa: e.target.value })}
                  placeholder="Ex.: Anexo IV Dec. 3.048/99 · NR-15 Anexo X" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Observações</Label>
                <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMode("list")}>Voltar</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
