import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

const CATALOGOS = [
  { table: "cat_situacoes_geradoras", label: "Situações Geradoras" },
  { table: "cat_agentes_causadores", label: "Agentes Causadores" },
  { table: "cat_partes_atingidas", label: "Partes Atingidas" },
  { table: "cat_naturezas_lesao", label: "Naturezas da Lesão" },
];

function CatalogoTab({ table }: { table: string }) {
  const qc = useQueryClient();
  const { isSuperAdmin, isPrincipal } = useAuth();
  const canEdit = isSuperAdmin || isPrincipal;
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");

  const { data = [] } = useQuery({
    queryKey: [`cat-cat-${table}`],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)(table).select("*").order("codigo");
      if (error) throw error;
      return data || [];
    },
  });

  const add = async () => {
    if (!codigo || !descricao) {
      toast.error("Preencha código e descrição");
      return;
    }
    const { error } = await (supabase.from as any)(table).insert({ codigo, descricao });
    if (error) {
      toast.error(error.message);
      return;
    }
    setCodigo("");
    setDescricao("");
    qc.invalidateQueries({ queryKey: [`cat-cat-${table}`] });
    toast.success("Adicionado");
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    await (supabase.from as any)(table).update({ ativo: !ativo }).eq("id", id);
    qc.invalidateQueries({ queryKey: [`cat-cat-${table}`] });
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este item do catálogo?")) return;
    const { error } = await (supabase.from as any)(table).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: [`cat-cat-${table}`] });
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[100px]">
              <label className="text-xs font-medium">Código</label>
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="999" />
            </div>
            <div className="flex-[3] min-w-[200px]">
              <label className="text-xs font-medium">Descrição</label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
            <Button onClick={add}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Ativo</TableHead>
                {canEdit && <TableHead className="w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data as any[]).map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.codigo}</TableCell>
                  <TableCell>{item.descricao}</TableCell>
                  <TableCell>
                    <Switch
                      checked={item.ativo}
                      onCheckedChange={() => canEdit && toggleAtivo(item.id, item.ativo)}
                      disabled={!canEdit}
                    />
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => remove(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CatConfiguracoes() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Catálogos da CAT</CardTitle>
          <p className="text-xs text-muted-foreground">
            Tabelas oficiais do eSocial usadas no preenchimento da CAT. Somente Principal ou Super Admin podem editar.
          </p>
        </CardHeader>
      </Card>

      <Tabs defaultValue={CATALOGOS[0].table}>
        <TabsList className="flex flex-wrap h-auto">
          {CATALOGOS.map((c) => (
            <TabsTrigger key={c.table} value={c.table}>{c.label}</TabsTrigger>
          ))}
        </TabsList>
        {CATALOGOS.map((c) => (
          <TabsContent key={c.table} value={c.table} className="mt-4">
            <CatalogoTab table={c.table} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
