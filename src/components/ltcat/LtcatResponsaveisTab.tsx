import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { LtcatResponsavelTecnico } from "@/lib/ltcatTypes";

interface Props {
  ltcatId: string;
  empresaId: string;
  editavel: boolean;
}

export default function LtcatResponsaveisTab({ ltcatId, empresaId, editavel }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LtcatResponsavelTecnico | null>(null);
  const [form, setForm] = useState({
    nome: "", cpf: "", profissao: "", registro_profissional: "",
    uf_registro: "", numero_art: "", email: "", telefone: "", ordem: 1,
  });
  const [saving, setSaving] = useState(false);

  const { data: rts = [], isLoading } = useQuery({
    queryKey: ["ltcat-rt", ltcatId],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("ltcat_responsaveis_tecnicos")
        .select("*").eq("ltcat_id", ltcatId).order("ordem");
      if (error) throw error;
      return (data || []) as LtcatResponsavelTecnico[];
    },
  });

  const reset = () => {
    setForm({ nome: "", cpf: "", profissao: "", registro_profissional: "", uf_registro: "", numero_art: "", email: "", telefone: "", ordem: (rts.length || 0) + 1 });
    setEditing(null);
  };

  const openNew = () => { reset(); setOpen(true); };
  const openEdit = (rt: LtcatResponsavelTecnico) => {
    setEditing(rt);
    setForm({
      nome: rt.nome, cpf: rt.cpf || "", profissao: rt.profissao,
      registro_profissional: rt.registro_profissional, uf_registro: rt.uf_registro || "",
      numero_art: rt.numero_art || "", email: rt.email || "", telefone: rt.telefone || "", ordem: rt.ordem,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.nome.trim() || !form.profissao.trim() || !form.registro_profissional.trim()) {
      toast.error("Nome, profissão e registro são obrigatórios"); return;
    }
    setSaving(true);
    try {
      const payload: any = {
        ltcat_id: ltcatId, empresa_id: empresaId,
        nome: form.nome.trim(), cpf: form.cpf.trim() || null,
        profissao: form.profissao.trim(), registro_profissional: form.registro_profissional.trim(),
        uf_registro: form.uf_registro.trim() || null, numero_art: form.numero_art.trim() || null,
        email: form.email.trim() || null, telefone: form.telefone.trim() || null,
        ordem: Number(form.ordem) || 1,
      };
      if (editing) {
        const { error } = await (supabase.from as any)("ltcat_responsaveis_tecnicos")
          .update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Responsável atualizado");
      } else {
        const { error } = await (supabase.from as any)("ltcat_responsaveis_tecnicos")
          .insert({ ...payload, created_by: user?.id });
        if (error) throw error;
        toast.success("Responsável adicionado");
      }
      setOpen(false); reset();
      qc.invalidateQueries({ queryKey: ["ltcat-rt", ltcatId] });
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar");
    } finally { setSaving(false); }
  };

  const remove = async (rt: LtcatResponsavelTecnico) => {
    if (!confirm(`Remover ${rt.nome}?`)) return;
    const { error } = await (supabase.from as any)("ltcat_responsaveis_tecnicos").delete().eq("id", rt.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Responsável removido");
    qc.invalidateQueries({ queryKey: ["ltcat-rt", ltcatId] });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Responsáveis Técnicos</CardTitle>
        {editavel && (
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando…</p>
        ) : rts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum responsável técnico cadastrado.</p>
        ) : (
          <ul className="space-y-2">
            {rts.map((rt) => (
              <li key={rt.id} className="border rounded-md p-3 flex items-start justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium">#{rt.ordem} · {rt.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {rt.profissao} · {rt.registro_profissional}{rt.uf_registro ? `/${rt.uf_registro}` : ""}
                    {rt.numero_art && <> · ART {rt.numero_art}</>}
                  </div>
                  {(rt.email || rt.telefone) && (
                    <div className="text-xs text-muted-foreground">
                      {rt.email}{rt.email && rt.telefone ? " · " : ""}{rt.telefone}
                    </div>
                  )}
                </div>
                {editavel && (
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(rt)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(rt)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Responsável Técnico" : "Novo Responsável Técnico"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs">Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Profissão *</Label>
              <Input value={form.profissao} onChange={(e) => setForm({ ...form, profissao: e.target.value })} placeholder="Eng. Segurança / Médico do Trabalho" />
            </div>
            <div>
              <Label className="text-xs">Registro profissional *</Label>
              <Input value={form.registro_profissional} onChange={(e) => setForm({ ...form, registro_profissional: e.target.value })} placeholder="CREA / CRM / etc." />
            </div>
            <div>
              <Label className="text-xs">UF</Label>
              <Input value={form.uf_registro} maxLength={2} onChange={(e) => setForm({ ...form, uf_registro: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <Label className="text-xs">Nº ART</Label>
              <Input value={form.numero_art} onChange={(e) => setForm({ ...form, numero_art: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">CPF</Label>
              <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Ordem</Label>
              <Input type="number" min={1} value={form.ordem} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
