import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { isPppEditavel, PppDocumento } from "@/lib/pppTypes";

interface Props { ppp: PppDocumento; funcionario: any | null; }

export default function PppExamesTab({ ppp, funcionario }: Props) {
  const { user } = useAuth();
  const perms = usePermissions("ppp");
  const qc = useQueryClient();
  const editavel = isPppEditavel(ppp.status) && perms.canEdit;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [delId, setDelId] = useState<string | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["ppp-exames", ppp.id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ppp_exames_referenciados")
        .select("*").eq("ppp_id", ppp.id).order("data", { ascending: false });
      return data || [];
    },
  });

  // ASOs do funcionário para vincular
  const { data: asos = [] } = useQuery({
    queryKey: ["ppp-exames-asos", funcionario?.id],
    queryFn: async () => {
      if (!funcionario?.id) return [];
      const { data } = await (supabase.from as any)("asos")
        .select("id, data_emissao, funcionario_id, empresa_id")
        .eq("funcionario_id", funcionario.id).eq("empresa_id", ppp.empresa_id)
        .order("data_emissao", { ascending: false });
      return data || [];
    },
    enabled: !!funcionario?.id,
  });

  function novo() { setForm({ empresa_id: ppp.empresa_id, ppp_id: ppp.id, origem: "manual" }); setOpen(true); }
  function editar(it: any) { setForm({ ...it }); setOpen(true); }

  function aplicarAso(asoId: string) {
    const a = (asos as any[]).find((x) => x.id === asoId);
    if (!a) { setForm({ ...form, aso_id: null }); return; }
    setForm({
      ...form,
      aso_id: a.id,
      data: a.data_emissao || form.data,
      origem: "ASO",
    });
  }

  async function salvar() {
    if (!form.tipo) { toast.error("Tipo de exame é obrigatório."); return; }
    const payload = { ...form, ppp_id: ppp.id, empresa_id: ppp.empresa_id };
    delete payload.created_at; delete payload.updated_at;
    const id = form.id; delete payload.id;
    const { error } = id
      ? await (supabase.from as any)("ppp_exames_referenciados").update(payload).eq("id", id)
      : await (supabase.from as any)("ppp_exames_referenciados").insert(payload);
    if (error) { toast.error(error.message); return; }
    await (supabase.from as any)("ppp_revisoes").insert({
      ppp_id: ppp.id, empresa_id: ppp.empresa_id,
      acao: id ? "exame_atualizado" : "exame_referenciado",
      descricao: `${form.tipo}${form.data ? " · " + form.data : ""}`,
      created_by: user?.id || null,
    });
    toast.success("Exame referenciado salvo.");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["ppp-exames", ppp.id] });
    qc.invalidateQueries({ queryKey: ["ppp-revisoes", ppp.id] });
  }

  async function excluir() {
    if (!delId) return;
    const { error } = await (supabase.from as any)("ppp_exames_referenciados").delete().eq("id", delId);
    if (error) { toast.error(error.message); return; }
    setDelId(null);
    qc.invalidateQueries({ queryKey: ["ppp-exames", ppp.id] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Exames referenciados</CardTitle>
        {editavel && <Button size="sm" onClick={novo}><Plus className="h-4 w-4 mr-1" /> Novo</Button>}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground p-6 text-center">Nenhum exame referenciado.</div>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>Tipo</TableHead>
              <TableHead>Aptidão</TableHead><TableHead>Origem</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(items as any[]).map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="text-xs">{it.data || "—"}</TableCell>
                  <TableCell className="text-sm">{it.tipo || "—"}</TableCell>
                  <TableCell className="text-xs">{it.aptidao || it.resultado_resumo || "—"}</TableCell>
                  <TableCell className="text-xs">{it.origem || (it.aso_id ? "ASO" : "—")}</TableCell>
                  <TableCell className="text-right">
                    {editavel && (
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => editar(it)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setDelId(it.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{form.id ? "Editar" : "Novo"} exame referenciado</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>ASO vinculado (opcional)</Label>
              <Select value={form.aso_id || "__none"} onValueChange={(v) => aplicarAso(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione um ASO do funcionário" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Nenhum / manual —</SelectItem>
                  {(asos as any[]).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.data_emissao || ""} · {a.tipo || "—"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Data do exame</Label>
              <Input type="date" value={form.data || ""} onChange={(e) => setForm({ ...form, data: e.target.value || null })} /></div>
            <div><Label>Tipo de exame *</Label>
              <Input value={form.tipo || ""} placeholder="Admissional / Periódico / Demissional / Audiometria…"
                onChange={(e) => setForm({ ...form, tipo: e.target.value })} /></div>
            <div><Label>Aptidão / resultado</Label>
              <Input value={form.aptidao || ""} placeholder="Apto / Apto com restrição / Inapto"
                onChange={(e) => setForm({ ...form, aptidao: e.target.value })} /></div>
            <div><Label>Origem</Label>
              <Select value={form.origem || "manual"} onValueChange={(v) => setForm({ ...form, origem: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASO">ASO</SelectItem>
                  <SelectItem value="PCMSO">PCMSO</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2"><Label>Resumo do resultado</Label>
              <Textarea rows={2} value={form.resultado_resumo || ""} onChange={(e) => setForm({ ...form, resultado_resumo: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Observações</Label>
              <Textarea rows={2} value={form.observacoes || ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Excluir exame referenciado?</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={excluir}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
