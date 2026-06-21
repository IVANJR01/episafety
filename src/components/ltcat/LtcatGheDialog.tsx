import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  ltcatId: string;
  empresaId: string;
  ghe?: any | null;
}

export default function LtcatGheDialog({ open, onOpenChange, ltcatId, empresaId, ghe }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const editing = !!ghe;
  const [form, setForm] = useState({
    ghe_origem_id: ghe?.ghe_origem_id || "__none__",
    codigo: ghe?.codigo || "",
    nome: ghe?.nome || "",
    setor_nome: ghe?.setor_nome || "",
    descricao: ghe?.descricao || "",
    descricao_atividade: ghe?.descricao_atividade || "",
    numero_trabalhadores: ghe?.numero_trabalhadores ?? 0,
  });
  const [saving, setSaving] = useState(false);

  const { data: gheOrigens = [] } = useQuery({
    queryKey: ["ghe-empresa", empresaId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ghe_ges")
        .select("id, codigo, nome, setor, descricao")
        .eq("empresa_id", empresaId).eq("status", "ativo").order("codigo");
      return data || [];
    },
    enabled: open,
  });

  const pickFromOrigem = (id: string) => {
    if (id === "__none__") { setForm({ ...form, ghe_origem_id: "__none__" }); return; }
    const g = (gheOrigens as any[]).find((x) => x.id === id);
    if (g) {
      setForm({
        ...form,
        ghe_origem_id: id,
        codigo: form.codigo || g.codigo,
        nome: form.nome || g.nome,
        setor_nome: form.setor_nome || (g.setor || ""),
        descricao: form.descricao || (g.descricao || ""),
      });
    }
  };

  const save = async () => {
    if (!form.codigo.trim() || !form.nome.trim()) { toast.error("Código e nome são obrigatórios"); return; }
    setSaving(true);
    try {
      const payload: any = {
        ltcat_id: ltcatId, empresa_id: empresaId,
        ghe_origem_id: form.ghe_origem_id === "__none__" ? null : form.ghe_origem_id,
        codigo: form.codigo.trim(),
        nome: form.nome.trim(),
        setor_nome: form.setor_nome.trim() || null,
        descricao: form.descricao.trim() || null,
        descricao_atividade: form.descricao_atividade.trim() || null,
        numero_trabalhadores: Number(form.numero_trabalhadores) || 0,
      };
      if (editing) {
        const { error } = await (supabase.from as any)("ltcat_grupos_homogeneos")
          .update(payload).eq("id", ghe.id);
        if (error) throw error;
        toast.success("GHE atualizado");
      } else {
        const { error } = await (supabase.from as any)("ltcat_grupos_homogeneos")
          .insert({ ...payload, created_by: user?.id });
        if (error) throw error;
        toast.success("GHE adicionado");
      }
      qc.invalidateQueries({ queryKey: ["ltcat-aa", ltcatId] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? "Editar GHE/GES" : "Novo GHE/GES avaliado"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {!editing && (
            <div className="md:col-span-2">
              <Label className="text-xs">Importar de GHE/GES existente da empresa</Label>
              <Select value={form.ghe_origem_id} onValueChange={pickFromOrigem}>
                <SelectTrigger><SelectValue placeholder="Selecionar (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Criar manualmente —</SelectItem>
                  {(gheOrigens as any[]).map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.codigo} · {g.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">Código *</Label>
            <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Nome *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Setor</Label>
            <Input value={form.setor_nome} onChange={(e) => setForm({ ...form, setor_nome: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Nº de trabalhadores expostos</Label>
            <Input type="number" min={0} value={form.numero_trabalhadores}
              onChange={(e) => setForm({ ...form, numero_trabalhadores: Number(e.target.value) })} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Descrição</Label>
            <Textarea rows={2} value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Descrição da atividade</Label>
            <Textarea rows={3} value={form.descricao_atividade}
              onChange={(e) => setForm({ ...form, descricao_atividade: e.target.value })}
              placeholder="Descreva as atividades realizadas pelo grupo (tarefas habituais, intermitentes, eventuais)." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
