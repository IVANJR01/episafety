import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, Loader2 } from "lucide-react";
import { CLASSE_TEXT } from "@/lib/pgrMatriz";

interface PcmsoMatrizTabProps {
  pcmso: any;
}

export default function PcmsoMatrizTab({ pcmso }: PcmsoMatrizTabProps) {
  const pgrBaseId = pcmso.pgr_base_id;

  // Busca o inventário de riscos do PGR base vinculado
  const { data: riscos = [], isLoading } = useQuery({
    queryKey: ["pcmso-riscos-base", pgrBaseId],
    queryFn: async () => {
      if (!pgrBaseId) return [];
      const { data, error } = await supabase
        .from("pgr_inventario_itens")
        .select("id, agente, fonte_geradora, classificacao")
        .eq("pgr_id", pgrBaseId);
      if (error) throw error;
      return data;
    },
    enabled: !!pgrBaseId,
  });

  return (
    <div className="space-y-6">
      <Card className="border-t-4 border-t-amber-500 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-amber-500" /> Matriz de Exames (Baseada no GRO)
          </CardTitle>
          <CardDescription>
            Exibe a matriz de correspondência entre os riscos importados do PGR Base e a prescrição
            de exames ocupacionais (Art. 7.5.1 da NR-07).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!pgrBaseId ? (
            <div className="flex flex-col items-center justify-center p-8 bg-amber-50 dark:bg-amber-950/20 rounded-lg text-amber-800 dark:text-amber-500 text-center gap-3">
              <AlertTriangle className="h-8 w-8" />
              <p className="font-medium">Nenhum PGR Base Vinculado</p>
              <p className="text-sm">
                Volte para a aba "Configuração Básica" e selecione o PGR de origem para habilitar a importação automática da matriz de saúde.
              </p>
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Risco Ocupacional (PGR)</TableHead>
                    <TableHead>Fonte Geradora</TableHead>
                    <TableHead>Grau</TableHead>
                    <TableHead className="w-1/3">Exames Prescritos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : riscos.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">O PGR selecionado não possui riscos mapeados em seu inventário.</TableCell></TableRow>
                  ) : (
                    riscos.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.agente || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{r.fonte_geradora || "-"}</TableCell>
                        <TableCell>
                          {r.classificacao && (
                            <Badge variant="outline" className={CLASSE_TEXT[r.classificacao as keyof typeof CLASSE_TEXT] || ""}>
                              {r.classificacao.toUpperCase()}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 px-3 py-1.5 rounded text-xs border border-blue-200 dark:border-blue-800/50">
                            <strong>Clínico Ocupacional</strong> (Obrigatório)
                            <br/><span className="opacity-70 text-[10px]">Periodicidade p/ cargo/idade</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
