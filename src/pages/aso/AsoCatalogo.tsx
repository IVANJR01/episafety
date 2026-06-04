import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const PADRAO = [
  "Exame clínico", "Anamnese ocupacional", "Audiometria", "Espirometria",
  "Eletrocardiograma", "Eletroencefalograma", "Hemograma", "Glicemia",
  "Urina", "Acuidade visual", "Raio-X", "Avaliação psicossocial", "Pressão arterial",
];

export default function AsoCatalogo() {
  const { empresaId, empresaScopeIds, isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ nome: "", tipo: "", periodicidade: "", risco_relacionado: "", obrigatorio: false, ativo: true });

  const { data: exames = [] } = useQuery({
    queryKey: ["aso-cat", empresaScopeIds.join(",")],
    queryFn: async () => {
      let q = supabase.from("aso_exames_catalogo").select("*").order("nome");
      if (isSuperAdmin && empresaScopeIds.length > 0) q = q.in("empresa_id", empresaScopeIds);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const seed = async () => {
    if (!empresaId) return toast.error("Selecione uma empresa");
    const existing = new Set(exames.map((e: any) => e.nome.toLowerCase()));
    const novos = PADRAO.filter((n) => !existing.has(n.toLowerCase()))
      .map((nome) => ({ nome, empresa_id: empresaId, ativo: true }));
    if (novos.length === 0) return toast.info("Catálogo já completo");
    const { error } = await supabase.from("aso_exames_catalogo").insert(novos);
    if (error) return toast.error(error.message);
    toast.success(`${novos.length} exames adicionados`);
    qc.invalidateQueries({ queryKey: ["aso-cat"] });
  };

  const openNew = () => { setEditing(null); setForm({ nome: "", tipo: "", periodicidade: "", risco_relacionado: "", obrigatorio: false, ativo: true }); setOpen(true); };
  const openEdit = (e: any) => { setEditing(e); setForm({ ...e }); setOpen(true); };

  const save = async () => {
    if (!form.nome) return toast.error("Nome obrigatório");
    const payload = { ...form, empresa_id: form.empresa_id ?? empresaId };
    delete payload.created_at; delete payload.updated_at;
    const { error } = editing
      ? await supabase.from("aso_exames_catalogo").update(payload).eq("id", editing.id)
      : await supabase.from("aso_exames_catalogo").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Salvo"); setOpen(false);
    qc.invalidateQueries({ queryKey: ["aso-cat"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir?")) return;
    const { error } = await supabase.from("aso_exames_catalogo").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["aso-cat"] });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h3 className="font-semibold">Catálogo de Exames</h3>
          <div className="flex gap-2">
            <Button variant="outline" onClick={seed}><Sparkles className="h-4 w-4 mr-1" />Carregar padrão</Button>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Novo exame</Button>
          </div>
        </div>
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Periodicidade</TableHead>
              <TableHead>Risco relacionado</TableHead><TableHead>Ativo</TableHead><TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {exames.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum exame. Clique em "Carregar padrão" para começar.</TableCell></TableRow>}
              {exames.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.nome}</TableCell>
                  <TableCell>{e.tipo || "—"}</TableCell>
                  <TableCell>{e.periodicidade || "—"}</TableCell>
                  <TableCell>{e.risco_relacionado || "—"}</TableCell>
                  <TableCell>{e.ativo ? "Sim" : "Não"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar exame" : "Novo exame"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div><Label>Tipo</Label><Input value={form.tipo || ""} onChange={(e) => setForm({ ...form, tipo: e.target.value })} /></div>
              <div><Label>Periodicidade</Label><Input value={form.periodicidade || ""} onChange={(e) => setForm({ ...form, periodicidade: e.target.value })} /></div>
              <div className="col-span-2"><Label>Risco relacionado</Label><Input value={form.risco_relacionado || ""} onChange={(e) => setForm({ ...form, risco_relacionado: e.target.value })} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.obrigatorio} onCheckedChange={(v) => setForm({ ...form, obrigatorio: v })} /><Label>Obrigatório</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} /><Label>Ativo</Label></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
