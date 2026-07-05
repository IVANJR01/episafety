import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";

type Local = {
  id: string;
  empresa_id: string;
  nome: string;
  cidade: string | null;
  uf: string | null;
  endereco: string | null;
  ativo: boolean;
  padrao: boolean;
};

export default function AsoLocaisEmissao() {
  const { user, empresaId } = useAuth() as any;
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Local> | null>(null);

  const { data: empresas = [] } = useQuery({
    queryKey: ["aso-locais-empresas", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("empresa_config").select("id, nome").eq("id", empresaId).order("nome");
      return data || [];
    },
  });

  const { data: locais = [], isLoading, refetch } = useQuery({
    queryKey: ["aso-locais-emissao", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("locais_emissao_aso").select("*").eq("empresa_id", empresaId).order("nome");
      if (error) throw error;
      return (data || []) as Local[];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const openNovo = () => setEditing({
    empresa_id: empresaId || "",
    nome: "", cidade: "", uf: "", endereco: "", ativo: true, padrao: false,
  });

  const salvar = async () => {
    if (!editing) return;
    if (!editing.empresa_id) return toast.error("Selecione a empresa");
    if (!editing.nome?.trim()) return toast.error("Informe o nome do local");

    try {
      if (editing.padrao && editing.empresa_id) {
        await (supabase.from as any)("locais_emissao_aso")
          .update({ padrao: false })
          .eq("empresa_id", editing.empresa_id)
          .neq("id", editing.id || "00000000-0000-0000-0000-000000000000");
      }
      if (editing.id) {
        const { error } = await (supabase.from as any)("locais_emissao_aso").update({
          empresa_id: editing.empresa_id, nome: editing.nome.trim(),
          cidade: editing.cidade || null, uf: editing.uf || null,
          endereco: editing.endereco || null, ativo: editing.ativo, padrao: editing.padrao,
        }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from as any)("locais_emissao_aso").insert({
          empresa_id: editing.empresa_id, nome: editing.nome.trim(),
          cidade: editing.cidade || null, uf: editing.uf || null,
          endereco: editing.endereco || null, ativo: editing.ativo ?? true,
          padrao: editing.padrao ?? false, created_by: user?.id || null,
        });
        if (error) throw error;
      }
      toast.success("Local salvo");
      setEditing(null);
      await qc.refetchQueries({ queryKey: ["aso-locais-emissao"] });
      await qc.refetchQueries({ queryKey: ["rh-locais-emissao"] });
      await refetch();
    } catch (e: any) {
      toast.error("Erro: " + (e.message || e));
    }
  };

  const excluir = async (id: string) => {
    if (!confirm("Excluir este local de emissão?")) return;
    const { error } = await (supabase.from as any)("locais_emissao_aso").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    await qc.refetchQueries({ queryKey: ["aso-locais-emissao"] });
    await qc.refetchQueries({ queryKey: ["rh-locais-emissao"] });
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Locais de Emissão do ASO</h2>
          </div>
          <Button size="sm" onClick={openNovo}><Plus className="h-4 w-4 mr-1" />Novo local</Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : locais.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum local de emissão cadastrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locais.map((l) => {
                const emp = empresas.find((e: any) => e.id === l.empresa_id);
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">
                      {l.nome}
                      {l.padrao && <Badge variant="secondary" className="ml-2">Padrão</Badge>}
                    </TableCell>
                    <TableCell>{[l.cidade, l.uf].filter(Boolean).join(" - ") || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{emp?.nome || "—"}</TableCell>
                    <TableCell>
                      {l.ativo ? <Badge>Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(l)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => excluir(l.id)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Editar" : "Novo"} local de emissão</DialogTitle>
            </DialogHeader>
            {editing && (
              <div className="space-y-3">
                <div>
                  <Label>Empresa *</Label>
                  <Select value={editing.empresa_id || ""} onValueChange={(v) => setEditing({ ...editing, empresa_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {empresas.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nome do local *</Label>
                  <Input value={editing.nome || ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} placeholder="Ex.: Alto Santo - CE" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Label>Cidade</Label>
                    <Input value={editing.cidade || ""} onChange={(e) => setEditing({ ...editing, cidade: e.target.value })} />
                  </div>
                  <div>
                    <Label>UF</Label>
                    <Input maxLength={2} value={editing.uf || ""} onChange={(e) => setEditing({ ...editing, uf: e.target.value.toUpperCase() })} />
                  </div>
                </div>
                <div>
                  <Label>Endereço (opcional)</Label>
                  <Input value={editing.endereco || ""} onChange={(e) => setEditing({ ...editing, endereco: e.target.value })} />
                </div>
                <div className="flex items-center justify-between border rounded-md p-2">
                  <Label className="cursor-pointer">Local padrão</Label>
                  <Switch checked={!!editing.padrao} onCheckedChange={(v) => setEditing({ ...editing, padrao: v })} />
                </div>
                <div className="flex items-center justify-between border rounded-md p-2">
                  <Label className="cursor-pointer">Ativo</Label>
                  <Switch checked={editing.ativo ?? true} onCheckedChange={(v) => setEditing({ ...editing, ativo: v })} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={salvar}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
