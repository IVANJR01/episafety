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
import { Users, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Cliente = {
  id: string;
  empresa_id: string;
  nome: string;
  razao_social: string | null;
  cnpj_cpf: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  contato_responsavel: string | null;
  segmento: string | null;
  observacoes: string | null;
  ativo: boolean;
};

const empty: Partial<Cliente> = { ativo: true };

export default function Clientes() {
  const { empresaId } = useAuth();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Cliente>>(empty);

  const { data = [], isLoading } = useQuery({
    queryKey: ["clientes_comerciais", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("clientes_comerciais")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data || []) as Cliente[];
    },
  });

  const save = useMutation({
    mutationFn: async (payload: Partial<Cliente>) => {
      if (!empresaId) throw new Error("Empresa ativa não definida");
      const clean: any = { ...payload, empresa_id: empresaId };
      delete clean.id;
      if (payload.id) {
        const { error } = await (supabase.from as any)("clientes_comerciais").update(clean).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from as any)("clientes_comerciais").insert(clean);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Cliente salvo");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["clientes_comerciais", empresaId] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("clientes_comerciais").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente excluído");
      qc.invalidateQueries({ queryKey: ["clientes_comerciais", empresaId] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao excluir"),
  });

  const filtered = data.filter(
    (c) =>
      !busca ||
      c.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      c.cnpj_cpf?.toLowerCase().includes(busca.toLowerCase()) ||
      c.razao_social?.toLowerCase().includes(busca.toLowerCase()),
  );

  const openNew = () => { setEditing(empty); setOpen(true); };
  const openEdit = (c: Cliente) => { setEditing(c); setOpen(true); };

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Clientes"
        subtitle="Cadastro de clientes do módulo Comercial."
        actions={<Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Novo cliente</Button>}
      />

      <div className="mb-4">
        <Input placeholder="Buscar por nome, razão social ou CNPJ/CPF" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum cliente cadastrado"
          description="Cadastre seu primeiro cliente para começar a emitir orçamentos."
          action={<Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Novo cliente</Button>}
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{c.nome}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {c.razao_social || "—"} {c.cnpj_cpf ? `• ${c.cnpj_cpf}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[c.telefone, c.email, c.cidade && c.uf ? `${c.cidade}/${c.uf}` : c.cidade].filter(Boolean).join(" • ")}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => openEdit(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="outline" onClick={() => confirm("Excluir cliente?") && del.mutate(c.id)}>
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
          <DialogHeader>
            <DialogTitle>{editing.id ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Nome *</Label>
              <Input value={editing.nome || ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
            </div>
            <div>
              <Label>Razão Social</Label>
              <Input value={editing.razao_social || ""} onChange={(e) => setEditing({ ...editing, razao_social: e.target.value })} />
            </div>
            <div>
              <Label>CNPJ/CPF</Label>
              <Input value={editing.cnpj_cpf || ""} onChange={(e) => setEditing({ ...editing, cnpj_cpf: e.target.value })} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input value={editing.email || ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={editing.telefone || ""} onChange={(e) => setEditing({ ...editing, telefone: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Endereço</Label>
              <Input value={editing.endereco || ""} onChange={(e) => setEditing({ ...editing, endereco: e.target.value })} />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={editing.cidade || ""} onChange={(e) => setEditing({ ...editing, cidade: e.target.value })} />
            </div>
            <div>
              <Label>UF</Label>
              <Input maxLength={2} value={editing.uf || ""} onChange={(e) => setEditing({ ...editing, uf: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <Label>Responsável</Label>
              <Input value={editing.contato_responsavel || ""} onChange={(e) => setEditing({ ...editing, contato_responsavel: e.target.value })} />
            </div>
            <div>
              <Label>Segmento</Label>
              <Input value={editing.segmento || ""} onChange={(e) => setEditing({ ...editing, segmento: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Observações</Label>
              <Textarea value={editing.observacoes || ""} onChange={(e) => setEditing({ ...editing, observacoes: e.target.value })} />
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
