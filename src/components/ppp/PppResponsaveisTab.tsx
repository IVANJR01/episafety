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
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { isPppEditavel, PppDocumento } from "@/lib/pppTypes";

interface Props { ppp: PppDocumento; }

export default function PppResponsaveisTab({ ppp }: Props) {
  return (
    <Tabs defaultValue="amb">
      <TabsList>
        <TabsTrigger value="amb">Ambientais</TabsTrigger>
        <TabsTrigger value="med">Médicos</TabsTrigger>
      </TabsList>
      <TabsContent value="amb"><Ambientais ppp={ppp} /></TabsContent>
      <TabsContent value="med"><Medicos ppp={ppp} /></TabsContent>
    </Tabs>
  );
}

function Ambientais({ ppp }: Props) {
  const { user } = useAuth();
  const perms = usePermissions("ppp");
  const qc = useQueryClient();
  const editavel = isPppEditavel(ppp.status) && perms.canEdit;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [delId, setDelId] = useState<string | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["ppp-resp-amb", ppp.id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ppp_responsaveis_ambientais")
        .select("*").eq("ppp_id", ppp.id).order("created_at");
      return data || [];
    },
  });

  function novo() { setForm({ empresa_id: ppp.empresa_id, ppp_id: ppp.id }); setOpen(true); }
  function editar(it: any) { setForm({ ...it }); setOpen(true); }

  async function salvar() {
    if (!form.nome) { toast.error("Nome é obrigatório."); return; }
    const payload = { ...form, ppp_id: ppp.id, empresa_id: ppp.empresa_id };
    delete payload.created_at; delete payload.updated_at;
    const id = form.id;
    delete payload.id;
    const { error } = id
      ? await (supabase.from as any)("ppp_responsaveis_ambientais").update(payload).eq("id", id)
      : await (supabase.from as any)("ppp_responsaveis_ambientais").insert(payload);
    if (error) { toast.error(error.message); return; }
    await (supabase.from as any)("ppp_revisoes").insert({
      ppp_id: ppp.id, empresa_id: ppp.empresa_id,
      acao: id ? "resp_amb_atualizado" : "resp_amb_criado",
      descricao: form.nome, created_by: user?.id || null,
    });
    toast.success("Responsável salvo.");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["ppp-resp-amb", ppp.id] });
    qc.invalidateQueries({ queryKey: ["ppp-revisoes", ppp.id] });
  }

  async function excluir() {
    if (!delId) return;
    const { error } = await (supabase.from as any)("ppp_responsaveis_ambientais").delete().eq("id", delId);
    if (error) { toast.error(error.message); return; }
    setDelId(null);
    qc.invalidateQueries({ queryKey: ["ppp-resp-amb", ppp.id] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Responsáveis ambientais</CardTitle>
        {editavel && <Button size="sm" onClick={novo}><Plus className="h-4 w-4 mr-1" /> Novo</Button>}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground p-6 text-center">Nenhum responsável ambiental cadastrado.</div>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>Conselho</TableHead>
              <TableHead>Cargo</TableHead><TableHead>Período</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(items as any[]).map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="text-sm">
                    <div className="font-medium">{it.nome}</div>
                    <div className="text-xs text-muted-foreground">{it.cpf || ""} {it.registro_profissional ? `· ${it.registro_profissional}` : ""}</div>
                  </TableCell>
                  <TableCell className="text-xs">{it.conselho || "—"}{it.conselho_uf ? `/${it.conselho_uf}` : ""}</TableCell>
                  <TableCell className="text-xs">{it.cargo || it.formacao || "—"}</TableCell>
                  <TableCell className="text-xs">
                    {it.periodo_inicio || "—"} → {it.periodo_fim || "atual"}
                  </TableCell>
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
          <DialogHeader><DialogTitle>{form.id ? "Editar" : "Novo"} responsável ambiental</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2"><Label>Nome *</Label>
              <Input value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>CPF</Label>
              <Input value={form.cpf || ""} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></div>
            <div><Label>Registro profissional</Label>
              <Input value={form.registro_profissional || ""} onChange={(e) => setForm({ ...form, registro_profissional: e.target.value })} /></div>
            <div><Label>Conselho</Label>
              <Input value={form.conselho || ""} placeholder="CREA, MTE, etc." onChange={(e) => setForm({ ...form, conselho: e.target.value })} /></div>
            <div><Label>UF do conselho</Label>
              <Input maxLength={2} value={form.conselho_uf || ""} onChange={(e) => setForm({ ...form, conselho_uf: e.target.value.toUpperCase() })} /></div>
            <div className="md:col-span-2"><Label>Cargo / função</Label>
              <Input value={form.cargo || ""} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></div>
            <div><Label>Período — início</Label>
              <Input type="date" value={form.periodo_inicio || ""} onChange={(e) => setForm({ ...form, periodo_inicio: e.target.value || null })} /></div>
            <div><Label>Período — fim</Label>
              <Input type="date" value={form.periodo_fim || ""} onChange={(e) => setForm({ ...form, periodo_fim: e.target.value || null })} /></div>
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
          <DialogHeader><DialogTitle>Excluir responsável?</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={excluir}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Medicos({ ppp }: Props) {
  const { user } = useAuth();
  const perms = usePermissions("ppp");
  const qc = useQueryClient();
  const editavel = isPppEditavel(ppp.status) && perms.canEdit;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [delId, setDelId] = useState<string | null>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["ppp-resp-med", ppp.id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ppp_responsaveis_medicos")
        .select("*").eq("ppp_id", ppp.id).order("created_at");
      return data || [];
    },
  });

  function novo() { setForm({ empresa_id: ppp.empresa_id, ppp_id: ppp.id }); setOpen(true); }
  function editar(it: any) { setForm({ ...it }); setOpen(true); }

  async function salvar() {
    if (!form.nome) { toast.error("Nome é obrigatório."); return; }
    const payload = { ...form, ppp_id: ppp.id, empresa_id: ppp.empresa_id };
    delete payload.created_at; delete payload.updated_at;
    const id = form.id; delete payload.id;
    const { error } = id
      ? await (supabase.from as any)("ppp_responsaveis_medicos").update(payload).eq("id", id)
      : await (supabase.from as any)("ppp_responsaveis_medicos").insert(payload);
    if (error) { toast.error(error.message); return; }
    await (supabase.from as any)("ppp_revisoes").insert({
      ppp_id: ppp.id, empresa_id: ppp.empresa_id,
      acao: id ? "resp_med_atualizado" : "resp_med_criado",
      descricao: form.nome, created_by: user?.id || null,
    });
    toast.success("Responsável salvo.");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["ppp-resp-med", ppp.id] });
    qc.invalidateQueries({ queryKey: ["ppp-revisoes", ppp.id] });
  }

  async function excluir() {
    if (!delId) return;
    const { error } = await (supabase.from as any)("ppp_responsaveis_medicos").delete().eq("id", delId);
    if (error) { toast.error(error.message); return; }
    setDelId(null);
    qc.invalidateQueries({ queryKey: ["ppp-resp-med", ppp.id] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Responsáveis médicos</CardTitle>
        {editavel && <Button size="sm" onClick={novo}><Plus className="h-4 w-4 mr-1" /> Novo</Button>}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground p-6 text-center">Nenhum responsável médico cadastrado.</div>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>CRM</TableHead>
              <TableHead>Período</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(items as any[]).map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="text-sm font-medium">{it.nome}</TableCell>
                  <TableCell className="text-xs">{it.crm || "—"}{it.uf_crm ? `/${it.uf_crm}` : ""}</TableCell>
                  <TableCell className="text-xs">{it.periodo_inicio || "—"} → {it.periodo_fim || "atual"}</TableCell>
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
          <DialogHeader><DialogTitle>{form.id ? "Editar" : "Novo"} responsável médico</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2"><Label>Nome *</Label>
              <Input value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>CRM</Label>
              <Input value={form.crm || ""} onChange={(e) => setForm({ ...form, crm: e.target.value })} /></div>
            <div><Label>UF do CRM</Label>
              <Input maxLength={2} value={form.uf_crm || ""} onChange={(e) => setForm({ ...form, uf_crm: e.target.value.toUpperCase() })} /></div>
            <div><Label>Período — início</Label>
              <Input type="date" value={form.periodo_inicio || ""} onChange={(e) => setForm({ ...form, periodo_inicio: e.target.value || null })} /></div>
            <div><Label>Período — fim</Label>
              <Input type="date" value={form.periodo_fim || ""} onChange={(e) => setForm({ ...form, periodo_fim: e.target.value || null })} /></div>
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
          <DialogHeader><DialogTitle>Excluir responsável?</DialogTitle></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={excluir}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
