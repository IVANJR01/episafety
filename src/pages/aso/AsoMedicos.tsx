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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function AsoMedicos() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ nome: "", crm: "", uf_crm: "", cpf: "", email: "", telefone: "", responsavel_pcmso: false, ativo: true });

  const { data: medicos = [] } = useQuery({
    queryKey: ["aso-medicos", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      // Empresa ativa apenas — sem mash-up entre empresas.
      const { data, error } = await supabase.from("aso_medicos").select("*")
        .eq("empresa_id", empresaId!).order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const openNew = () => {
    setEditing(null);
    setForm({ nome: "", crm: "", uf_crm: "", cpf: "", email: "", telefone: "", responsavel_pcmso: false, ativo: true });
    setOpen(true);
  };
  const openEdit = (m: any) => {
    setEditing(m);
    setForm({ ...m });
    setOpen(true);
  };

  const save = async () => {
    if (!form.nome || !form.crm) return toast.error("Nome e CRM são obrigatórios");
    const payload = { ...form, empresa_id: form.empresa_id ?? empresaId };
    delete payload.created_at; delete payload.updated_at;
    const { error } = editing
      ? await supabase.from("aso_medicos").update(payload).eq("id", editing.id)
      : await supabase.from("aso_medicos").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Médico salvo");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["aso-medicos"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este médico?")) return;
    const { error } = await supabase.from("aso_medicos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["aso-medicos"] });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Médicos do Trabalho</h3>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Novo médico</Button>
        </div>
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>CRM</TableHead><TableHead>E-mail</TableHead>
              <TableHead>PCMSO</TableHead><TableHead>Ativo</TableHead><TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {medicos.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum médico cadastrado.</TableCell></TableRow>}
              {medicos.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.nome}</TableCell>
                  <TableCell>{m.crm}{m.uf_crm ? `/${m.uf_crm}` : ""}</TableCell>
                  <TableCell>{m.email || "—"}</TableCell>
                  <TableCell>{m.responsavel_pcmso ? "Sim" : "Não"}</TableCell>
                  <TableCell>{m.ativo ? "Sim" : "Não"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar médico" : "Novo médico"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nome completo *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div><Label>CRM *</Label><Input value={form.crm} onChange={(e) => setForm({ ...form, crm: e.target.value })} /></div>
              <div><Label>UF</Label><Input value={form.uf_crm || ""} maxLength={2} onChange={(e) => setForm({ ...form, uf_crm: e.target.value.toUpperCase() })} /></div>
              <div><Label>CPF</Label><Input value={form.cpf || ""} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.telefone || ""} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
              <div className="col-span-2"><Label>E-mail</Label><Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.responsavel_pcmso} onCheckedChange={(v) => setForm({ ...form, responsavel_pcmso: v })} /><Label>Responsável PCMSO</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} /><Label>Ativo</Label></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
