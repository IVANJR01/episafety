import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/orcamentoCalc";
import { CATEGORIAS_CATALOGO } from "@/lib/orcamentoTypes";

type Servico = {
  id: string;
  empresa_id: string;
  nome: string;
  categoria: string | null;
  descricao: string | null;
  unidade: string | null;
  valor_padrao: number;
  custo_estimado: number | null;
  margem_padrao: number | null;
  ativo: boolean;
};

const empty: Partial<Servico> = { ativo: true, valor_padrao: 0, unidade: "un" };

export default function Catalogo() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Servico>>(empty);

  const { data = [], isLoading } = useQuery({
    queryKey: ["catalogo_servicos", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("catalogo_servicos")
        .select("*")
        .order("categoria")
        .order("nome");
      if (error) throw error;
      return (data || []) as Servico[];
    },
  });

  const save = useMutation({
    mutationFn: async (payload: Partial<Servico>) => {
      if (!empresaId) throw new Error("Empresa ativa não definida");
      const clean: any = { ...payload, empresa_id: empresaId };
      delete clean.id;
      if (payload.id) {
        const { error } = await (supabase.from as any)("catalogo_servicos").update(clean).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from as any)("catalogo_servicos").insert(clean);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Serviço salvo");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["catalogo_servicos", empresaId] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("catalogo_servicos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serviço excluído");
      qc.invalidateQueries({ queryKey: ["catalogo_servicos", empresaId] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao excluir"),
  });

  const filtered = data.filter(
    (s) => !busca || s.nome.toLowerCase().includes(busca.toLowerCase()) || (s.categoria || "").toLowerCase().includes(busca.toLowerCase()),
  );

  const openNew = () => { setEditing(empty); setOpen(true); };
  const openEdit = (s: Servico) => { setEditing(s); setOpen(true); };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Catálogo de Serviços"
        subtitle="Serviços padrão para reutilizar em propostas comerciais."
        actions={<Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Novo serviço</Button>}
      />

      <div className="mb-4">
        <Input placeholder="Buscar por nome ou categoria" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Catálogo vazio"
          description="Cadastre os serviços que você mais oferece para acelerar as propostas."
          action={<Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Novo serviço</Button>}
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{s.nome}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {s.categoria || "—"} • {s.unidade || "un"} • {formatBRL(s.valor_padrao)}
                  </div>
                  {s.descricao && <div className="text-xs text-muted-foreground truncate">{s.descricao}</div>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => openEdit(s)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="outline" onClick={() => confirm("Excluir serviço?") && del.mutate(s.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing.id ? "Editar serviço" : "Novo serviço"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Nome *</Label>
              <Input value={editing.nome || ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={editing.categoria || ""} onValueChange={(v) => setEditing({ ...editing, categoria: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_CATALOGO.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unidade</Label>
              <Input value={editing.unidade || ""} onChange={(e) => setEditing({ ...editing, unidade: e.target.value })} placeholder="un, mês, h, laudo" />
            </div>
            <div>
              <Label>Valor Padrão (R$)</Label>
              <Input type="number" step="0.01" value={editing.valor_padrao ?? 0} onChange={(e) => setEditing({ ...editing, valor_padrao: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Custo Estimado (R$)</Label>
              <Input type="number" step="0.01" value={editing.custo_estimado ?? 0} onChange={(e) => setEditing({ ...editing, custo_estimado: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Margem Padrão (%)</Label>
              <Input type="number" step="0.01" value={editing.margem_padrao ?? 0} onChange={(e) => setEditing({ ...editing, margem_padrao: Number(e.target.value) })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Descrição</Label>
              <Textarea value={editing.descricao || ""} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate(editing)} disabled={!editing.nome || save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
