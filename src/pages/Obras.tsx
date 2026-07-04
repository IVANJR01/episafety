import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Building2, Search } from "lucide-react";

type Obra = {
  id: string;
  empresa_id: string;
  nome: string;
  codigo: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  status: string;
  observacoes: string | null;
  created_at: string;
};

const STATUS_OPTIONS = ["ATIVA", "INATIVA", "CONCLUIDA"];

const emptyForm = {
  nome: "",
  codigo: "",
  endereco: "",
  cidade: "",
  uf: "",
  status: "ATIVA",
  observacoes: "",
};

export default function Obras() {
  const { user, empresaId } = useAuth();
  const [items, setItems] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("TODOS");

  async function load() {
    if (!empresaId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await (supabase.from as any)("obras")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("nome", { ascending: true });
    if (error) {
      toast({ title: "Erro ao carregar obras", description: error.message, variant: "destructive" });
    } else {
      setItems((data || []) as Obra[]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [empresaId]);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(o: Obra) {
    setEditingId(o.id);
    setForm({
      nome: o.nome,
      codigo: o.codigo || "",
      endereco: o.endereco || "",
      cidade: o.cidade || "",
      uf: o.uf || "",
      status: o.status || "ATIVA",
      observacoes: o.observacoes || "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) {
      toast({ title: "Informe o nome da obra", variant: "destructive" });
      return;
    }
    if (!empresaId) return;
    setSaving(true);
    const payload = {
      empresa_id: empresaId,
      nome: form.nome.trim(),
      codigo: form.codigo.trim() || null,
      endereco: form.endereco.trim() || null,
      cidade: form.cidade.trim() || null,
      uf: form.uf.trim() || null,
      status: form.status,
      observacoes: form.observacoes.trim() || null,
      created_by: user?.id,
    };
    let error;
    if (editingId) {
      ({ error } = await (supabase.from as any)("obras")
        .update(payload).eq("id", editingId).eq("empresa_id", empresaId));
    } else {
      ({ error } = await (supabase.from as any)("obras").insert(payload));
    }
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editingId ? "Obra atualizada" : "Obra cadastrada" });
    setDialogOpen(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta obra? Inspeções vinculadas ficarão sem obra.")) return;
    const { error } = await (supabase.from as any)("obras").delete().eq("id", id).eq("empresa_id", empresaId);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Obra excluída" });
    load();
  }

  const filtered = items.filter(o => {
    if (statusFilter !== "TODOS" && o.status !== statusFilter) return false;
    if (search && !`${o.nome} ${o.codigo || ""} ${o.cidade || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> Cadastro de Obras
          </h1>
          <p className="text-sm text-muted-foreground">Obras vinculadas às inspeções da empresa.</p>
        </div>
        <Button onClick={openNew} className="min-h-[44px]">
          <Plus className="w-4 h-4 mr-1" /> Nova obra
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome, código ou cidade..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 min-h-[44px]" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px] min-h-[44px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os status</SelectItem>
            {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          Nenhuma obra cadastrada. Clique em <strong>Nova obra</strong> para começar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(o => (
            <div key={o.id} className="border rounded-lg p-4 bg-card space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold break-words">{o.nome}</div>
                  {o.codigo && <div className="text-xs text-muted-foreground">Código: {o.codigo}</div>}
                </div>
                <Badge className={
                  o.status === "ATIVA" ? "bg-green-600 text-white" :
                  o.status === "CONCLUIDA" ? "bg-blue-600 text-white" :
                  "bg-gray-500 text-white"
                }>{o.status}</Badge>
              </div>
              {(o.cidade || o.uf) && (
                <div className="text-xs text-muted-foreground">📍 {[o.cidade, o.uf].filter(Boolean).join(" - ")}</div>
              )}
              {o.endereco && <div className="text-xs text-muted-foreground break-words">{o.endereco}</div>}
              {o.observacoes && <p className="text-xs text-muted-foreground break-words line-clamp-2">{o.observacoes}</p>}
              <div className="flex gap-1 pt-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(o)}>
                  <Pencil className="w-4 h-4 mr-1" /> Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(o.id)}>
                  <Trash2 className="w-4 h-4 mr-1 text-destructive" /> Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar obra" : "Nova obra"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="font-semibold">Nome da obra *</Label>
              <Input
                value={form.nome}
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                placeholder="Ex.: SE 69 KV BARROCAS"
                className="min-h-[44px]"
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">Único campo obrigatório. Os demais são opcionais.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Código (opcional)</Label>
                <Input value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))} className="min-h-[44px]" />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Endereço</Label>
              <Input value={form.endereco} onChange={e => setForm(p => ({ ...p, endereco: e.target.value }))} className="min-h-[44px]" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label>Cidade</Label>
                <Input value={form.cidade} onChange={e => setForm(p => ({ ...p, cidade: e.target.value }))} className="min-h-[44px]" />
              </div>
              <div>
                <Label>UF</Label>
                <Input maxLength={2} value={form.uf} onChange={e => setForm(p => ({ ...p, uf: e.target.value.toUpperCase() }))} className="min-h-[44px]" />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={3} value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
