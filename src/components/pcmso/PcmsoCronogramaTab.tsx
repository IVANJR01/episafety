import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PcmsoCronogramaTabProps {
  pcmso: any;
}

export default function PcmsoCronogramaTab({ pcmso }: PcmsoCronogramaTabProps) {
  const { empresaId } = useAuth();
  const perms = usePermissions("pgr");
  const queryClient = useQueryClient();

  const [acaoDesc, setAcaoDesc] = useState("");
  const [dataPlan, setDataPlan] = useState("");
  const [responsavel, setResponsavel] = useState("");

  const { data: acoes = [], isLoading } = useQuery({
    queryKey: ["pcmso-cronograma", pcmso.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pcmso_cronograma_acoes")
        .select("*")
        .eq("pcmso_id", pcmso.id)
        .order("data_planejada", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!pcmso.id,
  });

  const insertMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("pcmso_cronograma_acoes")
        .insert({
          pcmso_id: pcmso.id,
          empresa_id: empresaId,
          acao: acaoDesc,
          data_planejada: dataPlan || null,
          responsavel: responsavel || null,
          status: "Planejado"
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ação adicionada ao cronograma.");
      setAcaoDesc("");
      setDataPlan("");
      setResponsavel("");
      queryClient.invalidateQueries({ queryKey: ["pcmso-cronograma", pcmso.id] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pcmso_cronograma_acoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pcmso-cronograma", pcmso.id] });
    }
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.from("pcmso_cronograma_acoes").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pcmso-cronograma", pcmso.id] });
    }
  });

  const handleAdd = () => {
    if (!acaoDesc.trim()) {
      toast.error("Descreva a ação de saúde.");
      return;
    }
    insertMutation.mutate();
  };

  const formDisabled = !perms.canEdit || pcmso.status !== "rascunho";

  return (
    <div className="space-y-6">
      <Card className="border-t-4 border-t-indigo-600 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-indigo-600" /> Cronograma de Ações de Saúde
          </CardTitle>
          <CardDescription>
            Defina as ações planejadas para o período de vigência (ex: SIPAT, Campanhas de Vacinação, 
            Treinamentos de Primeiros Socorros, Campanhas Outubro Rosa/Novembro Azul).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!formDisabled && (
            <div className="flex flex-col sm:flex-row gap-4 mb-8 bg-muted/30 p-4 rounded-lg border">
              <div className="flex-1 space-y-2">
                <Label>Ação / Atividade</Label>
                <Input placeholder="Ex: Palestra sobre Ergonomia" value={acaoDesc} onChange={e => setAcaoDesc(e.target.value)} />
              </div>
              <div className="w-full sm:w-48 space-y-2">
                <Label>Responsável</Label>
                <Input placeholder="Ex: SESMT / CIPA" value={responsavel} onChange={e => setResponsavel(e.target.value)} />
              </div>
              <div className="w-full sm:w-40 space-y-2">
                <Label>Data Prevista</Label>
                <Input type="date" value={dataPlan} onChange={e => setDataPlan(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button onClick={handleAdd} disabled={insertMutation.isPending} className="w-full sm:w-auto">
                  {insertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Adicionar
                </Button>
              </div>
            </div>
          )}

          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Ação de Saúde</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Previsão</TableHead>
                  <TableHead className="w-40">Status</TableHead>
                  {!formDisabled && <TableHead className="w-16 text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando cronograma...</TableCell></TableRow>
                ) : acoes.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma ação cadastrada para este PCMSO.</TableCell></TableRow>
                ) : (
                  acoes.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.acao}</TableCell>
                      <TableCell>{a.responsavel || "-"}</TableCell>
                      <TableCell>{a.data_planejada ? new Date(a.data_planejada).toLocaleDateString() : "Sem data"}</TableCell>
                      <TableCell>
                        <Select 
                          value={a.status} 
                          onValueChange={(val) => statusMutation.mutate({ id: a.id, status: val })}
                          disabled={formDisabled}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Planejado">Planejado</SelectItem>
                            <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                            <SelectItem value="Concluído">Concluído</SelectItem>
                            <SelectItem value="Cancelado">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      {!formDisabled && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(a.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
