import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const [pgrIdAtivo, setPgrIdAtivo] = useState<string | null>(pcmso.pgr_base_id || null);

  // Se o documento ainda não tem o vínculo salvo, busca o PGR mais recente da empresa e vincula
  useEffect(() => {
    if (pcmso.pgr_base_id) {
      setPgrIdAtivo(pcmso.pgr_base_id);
      return;
    }

    if (!pgrIdAtivo && pcmso.empresa_id) {
      (async () => {
        const { data } = await supabase
          .from("pgr_documentos")
          .select("id, status, versao, data_vigencia_inicio, data_vigencia_fim")
          .eq("empresa_id", pcmso.empresa_id)
          .order("versao", { ascending: false });

        const valido = ((data || []) as any[]).find(
          (p) => p.status !== "arquivado" && p.status !== "substituido"
        );

        if (valido) {
          setPgrIdAtivo(valido.id);
          await supabase
            .from("pcmso_documentos")
            .update({
              pgr_base_id: valido.id,
              data_vigencia_inicio: pcmso.data_vigencia_inicio || valido.data_vigencia_inicio,
              data_vigencia_fim: pcmso.data_vigencia_fim || valido.data_vigencia_fim,
            })
            .eq("id", pcmso.id);
          queryClient.invalidateQueries({ queryKey: ["pcmso-detalhe", pcmso.id] });
        }
      })();
    }
  }, [pcmso.pgr_base_id, pcmso.empresa_id, pcmso.id, pgrIdAtivo]);

  // Busca o inventário de riscos do PGR base vinculado
  const { data: riscos = [], isLoading } = useQuery({
    queryKey: ["pcmso-riscos-base", pgrIdAtivo],
    queryFn: async () => {
      if (!pgrIdAtivo || pgrIdAtivo === "none") return [];
      const { data, error } = await supabase
        .from("pgr_inventario_itens")
        .select("id, perigo_descricao, fonte_geradora, classificacao")
        .eq("pgr_id", pgrIdAtivo);
      if (error) throw error;
      return (data || []).map((r: any) => ({
        ...r,
        agente: r.perigo_descricao || "Agente / Risco",
      }));
    },
    enabled: !!pgrIdAtivo && pgrIdAtivo !== "none",
  });

  const pgrBaseId = pgrIdAtivo;

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
          {!pgrIdAtivo ? (
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
