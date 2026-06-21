import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props { ltcatId: string; empresaId: string; editavel: boolean; }

export default function LtcatSetoresTab({ ltcatId, empresaId, editavel }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome_setor: "", descricao_local: "" });
  const [saving, setSaving] = useState(false);

  const { data: setores = [], isLoading } = useQuery({
    queryKey: ["ltcat-setores", ltcatId],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("ltcat_setores_avaliados")
        .select("*").eq("ltcat_id", ltcatId).order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: ghes = [] } = useQuery({
    queryKey: ["ltcat-ghes-empresa", empresaId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ghe_ges")
        .select("id, nome, codigo").eq("empresa_id", empresaId);
      return data || [];
    },
  });

  const save = async () => {
    if (!form.nome_setor.trim()) { toast.error("Nome do setor é obrigatório"); return; }
    setSaving(true);
    try {
      const { error } = await (supabase.from as any)("ltcat_setores_avaliados").insert({
        ltcat_id: ltcatId, empresa_id: empresaId,
        nome_setor: form.nome_setor.trim(),
        descricao_local: form.descricao_local.trim() || null,
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success("Setor adicionado");
      setOpen(false); setForm({ nome_setor: "", descricao_local: "" });
      qc.invalidateQueries({ queryKey: ["ltcat-setores", ltcatId] });
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar");
    } finally { setSaving(false); }
  };

  const remove = async (setorId: string) => {
    if (!confirm("Remover este setor avaliado?")) return;
    const { error } = await (supabase.from as any)("ltcat_setores_avaliados").delete().eq("id", setorId);
    if (error) { toast.error(error.message); return; }
    toast.success("Setor removido");
    qc.invalidateQueries({ queryKey: ["ltcat-setores", ltcatId] });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Setores avaliados</CardTitle>
          {editavel && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Adicionar setor</Button>}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando…</p>
          ) : setores.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum setor avaliado cadastrado.</p>
          ) : (
            <ul className="space-y-2">
              {(setores as any[]).map((s) => (
                <li key={s.id} className="border rounded-md p-3 flex items-start justify-between gap-3">
                  <div className="text-sm">
                    <div className="font-medium">{s.nome_setor}</div>
                    {s.descricao_local && <div className="text-xs text-muted-foreground">{s.descricao_local}</div>}
                  </div>
                  {editavel && (
                    <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">GHE / GES disponíveis da empresa</CardTitle></CardHeader>
        <CardContent>
          {(ghes as any[]).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum GHE/GES cadastrado na empresa. Use Cadastro → GHE/GES.
            </p>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {(ghes as any[]).map((g) => (
                <li key={g.id} className="border rounded-md p-2">
                  <span className="font-mono text-xs text-muted-foreground">{g.codigo || "—"}</span> · {g.nome}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            O vínculo formal GHE × LTCAT (com agentes e avaliações) é liberado na <strong>Parte 3</strong>.
          </p>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo setor avaliado</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome do setor *</Label>
              <Input value={form.nome_setor} onChange={(e) => setForm({ ...form, nome_setor: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Descrição do local</Label>
              <Textarea rows={3} value={form.descricao_local} onChange={(e) => setForm({ ...form, descricao_local: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
