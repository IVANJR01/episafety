import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Power, ClipboardList, Search, Briefcase, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function CadastroGhe() {
  const { empresaId, empresaScopeIds, isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [empresaSel, setEmpresaSel] = useState<string>(empresaId || "");
  const [busca, setBusca] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [openFuncoes, setOpenFuncoes] = useState<any | null>(null);

  const { data: empresas = [] } = useQuery({
    queryKey: ["cad-ghe-empresas", empresaScopeIds.join(",")],
    queryFn: async () => {
      let q = supabase.from("empresa_config").select("id, nome").order("nome");
      if (isSuperAdmin && empresaScopeIds.length > 0) q = q.in("id", empresaScopeIds);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: ghes = [], isLoading } = useQuery({
    queryKey: ["cad-ghe-list", empresaSel],
    enabled: !!empresaSel,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ghe_ges")
        .select("id, codigo, nome, setor, descricao, status, ghe_funcoes(count)")
        .eq("empresa_id", empresaSel)
        .order("codigo");
      if (error) throw error;
      return (data || []).map((g: any) => ({ ...g, nFuncoes: g.ghe_funcoes?.[0]?.count || 0 }));
    },
  });

  const filtrados = ghes.filter((g: any) => {
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return (
      g.codigo?.toLowerCase().includes(q) ||
      g.nome?.toLowerCase().includes(q) ||
      g.setor?.toLowerCase().includes(q)
    );
  });

  const novo = () => { setEditing(null); setOpenForm(true); };
  const editar = (g: any) => { setEditing(g); setOpenForm(true); };

  const alternarStatus = async (g: any) => {
    const novoStatus = g.status === "ativo" ? "inativo" : "ativo";
    const { error } = await supabase.from("ghe_ges").update({ status: novoStatus }).eq("id", g.id);
    if (error) return toast.error(error.message);
    toast.success(`GHE ${novoStatus === "ativo" ? "ativado" : "inativado"}`);
    qc.invalidateQueries({ queryKey: ["cad-ghe-list"] });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg flex items-center gap-2"><ClipboardList className="h-5 w-5" />Cadastro de GHE/GES (PGR/PCMSO)</CardTitle>
              <p className="text-sm text-muted-foreground">Cadastro base dos grupos de exposição. Riscos, exames e funções são configurados em Gestão Documental &gt; Gestão de ASO.</p>
            </div>
            <div className="flex gap-2 items-center">
              <Select value={empresaSel} onValueChange={setEmpresaSel}>
                <SelectTrigger className="w-[240px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
                <SelectContent>{empresas.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
              </Select>
              <Button onClick={novo} disabled={!empresaSel}><Plus className="h-4 w-4 mr-1" />Novo GHE/GES</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por código, nome ou setor…" className="pl-8" />
          </div>
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && filtrados.length === 0 && (
            <p className="text-sm text-muted-foreground italic">Nenhum GHE/GES cadastrado.</p>
          )}
          {filtrados.length > 0 && (
            <div className="border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Código</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-[110px] text-center">Funções</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[200px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((g: any) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">{g.codigo}</TableCell>
                      <TableCell>{g.setor || g.nome || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-[300px]">{g.descricao || "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{g.nFuncoes}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={g.status === "ativo" ? "default" : "secondary"}>
                          {g.status === "ativo" ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setOpenFuncoes(g)} title="Gerenciar funções"><Briefcase className="h-4 w-4 mr-1" />Funções</Button>
                        <Button size="icon" variant="ghost" onClick={() => editar(g)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => alternarStatus(g)} title={g.status === "ativo" ? "Inativar" : "Ativar"}>
                          <Power className={`h-4 w-4 ${g.status === "ativo" ? "text-destructive" : "text-primary"}`} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <GheFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        empresaId={empresaSel}
        editing={editing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["cad-ghe-list"] })}
      />
      {openFuncoes && (
        <FuncoesDialog
          ghe={openFuncoes}
          onClose={() => { setOpenFuncoes(null); qc.invalidateQueries({ queryKey: ["cad-ghe-list"] }); }}
        />
      )}
    </div>
  );
}

function GheFormDialog({ open, onOpenChange, empresaId, editing, onSaved }: any) {
  const [form, setForm] = useState({ codigo: "", nome: "", setor: "", descricao: "", status: "ativo" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        codigo: editing.codigo || "",
        nome: editing.nome || "",
        setor: editing.setor || "",
        descricao: editing.descricao || "",
        status: editing.status || "ativo",
      });
    } else {
      setForm({ codigo: "", nome: "", setor: "", descricao: "", status: "ativo" });
    }
  }, [editing, open]);

  const save = async () => {
    if (!form.codigo.trim() || !form.setor.trim()) return toast.error("Código e setor são obrigatórios");
    setSaving(true);
    const payload: any = {
      codigo: form.codigo.trim(),
      nome: form.setor.trim(),
      setor: form.setor.trim(),
      descricao: form.descricao.trim() || null,
      status: form.status,
      empresa_id: empresaId,
    };
    const { error } = editing
      ? await supabase.from("ghe_ges").update(payload).eq("id", editing.id)
      : await supabase.from("ghe_ges").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("GHE salvo");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar GHE/GES" : "Novo GHE/GES"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Código *</Label>
              <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="GHE 01" />
            </div>
            <div>
              <Label>Setor *</Label>
              <Input value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} placeholder="PCP" />
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} placeholder="Grupo de exposição do setor PCP." />
          </div>
          <div>
            <Label>Ativo</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Sim</SelectItem>
                <SelectItem value="inativo">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
