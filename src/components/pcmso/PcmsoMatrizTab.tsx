import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, Loader2 } from "lucide-react";
import { CLASSE_TEXT, GRUPO_LABEL } from "@/lib/pgrMatriz";

/**
 * Sugere exames ocupacionais complementares e clínicos com base no
 * agente nocivo e nos quadros e anexos obrigatórios da NR-07.
 */
function sugerirExamesNr07(grupo: string, risco: string, fonte: string) {
  const texto = `${grupo || ""} ${risco || ""} ${fonte || ""}`.toLowerCase();
  const exames: { nome: string; periodicidade: string; base: string; obrigatorio: boolean }[] = [
    {
      nome: "Exame Clínico Ocupacional (Anamnese + Físico)",
      periodicidade: "Admissional, Periódico, Mudança de Risco, Retorno e Demissional",
      base: "NR-07 Item 7.5.6",
      obrigatorio: true,
    },
  ];

  if (texto.includes("ruído") || texto.includes("ruido") || texto.includes("som") || texto.includes("pressão sonora")) {
    exames.push({
      nome: "Audiometria Tonal e Vocal",
      periodicidade: "Admissional, 6 meses (NR-07), Periódico Anual, Demissional",
      base: "NR-07 Anexo II",
      obrigatorio: true,
    });
  }

  if (texto.includes("poeira") || texto.includes("sílica") || texto.includes("silica") || texto.includes("fumos") || texto.includes("respirat")) {
    exames.push(
      {
        nome: "Espirometria Ocupacional",
        periodicidade: "Admissional, Periódico Bienal/Anual",
        base: "NR-07 Anexo I",
        obrigatorio: true,
      },
      {
        nome: "Radiografia de Tórax (RX Padrão OIT)",
        periodicidade: "Admissional, Periódico Anual",
        base: "NR-07 Anexo I",
        obrigatorio: true,
      }
    );
  }

  if (texto.includes("químic") || texto.includes("quimic") || texto.includes("solvente") || texto.includes("tinta") || texto.includes("vapor") || texto.includes("combust")) {
    exames.push(
      {
        nome: "Hemograma Completo + Plaquetas",
        periodicidade: "Admissional, Periódico Semestral/Anual",
        base: "NR-07 Quadro 1",
        obrigatorio: true,
      },
      {
        nome: "Indicadores Biológicos de Exposição (IBE)",
        periodicidade: "Periódico Semestral",
        base: "NR-07 Quadro 1 e 2",
        obrigatorio: true,
      }
    );
  }

  if (texto.includes("biológ") || texto.includes("biolog") || texto.includes("vírus") || texto.includes("bactéria") || texto.includes("sangue")) {
    exames.push({
      nome: "Controle Imunológico (Anti-HBs / Vacinação)",
      periodicidade: "Admissional e Acompanhamento Anual",
      base: "NR-07 e NR-32",
      obrigatorio: true,
    });
  }

  if (texto.includes("altura") || texto.includes("nr-35") || texto.includes("confinado") || texto.includes("nr-33") || texto.includes("eletric") || texto.includes("nr-10")) {
    exames.push(
      {
        nome: "Eletrocardiograma (ECG) + Eletroencefalograma (EEG)",
        periodicidade: "Admissional, Periódico Anual",
        base: "NR-35 / NR-33 / NR-07",
        obrigatorio: true,
      },
      {
        nome: "Glicemia de Jejum + Acuidade Visual",
        periodicidade: "Admissional, Periódico Anual",
        base: "Critério Médico Ocupacional",
        obrigatorio: true,
      },
      {
        nome: "Avaliação Psicossocial",
        periodicidade: "Admissional, Periódico Anual",
        base: "NR-33 / NR-35",
        obrigatorio: true,
      }
    );
  }

  return exames;
}

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

  // Busca o inventário de riscos do PGR base vinculado e dados de GES
  const { data: riscos = [], isLoading } = useQuery({
    queryKey: ["pcmso-riscos-base", pgrIdAtivo, pcmso.empresa_id],
    queryFn: async () => {
      if (!pgrIdAtivo || pgrIdAtivo === "none") return [];

      const [invRes, ghesRes] = await Promise.all([
        supabase
          .from("pgr_inventario_itens")
          .select("id, perigo_descricao, fonte_geradora, tipo_agente, grupo, processo, setor, descricao_ambiente, funcoes_snapshot, ghe_id, classificacao, nivel_risco")
          .eq("pgr_id", pgrIdAtivo),
        supabase
          .from("ghe_ges")
          .select("id, codigo, nome")
          .eq("empresa_id", pcmso.empresa_id)
      ]);

      if (invRes.error) throw invRes.error;
      const ghesData = ghesRes.data || [];

      return (invRes.data || []).map((r: any) => {
        const gesObj = ghesData.find((g: any) => g.id === r.ghe_id);
        const gesRotulo = gesObj ? `${gesObj.codigo} - ${gesObj.nome}` : "";

        // Resolução inteligente da Fonte Geradora e do Risco Ocupacional
        let fonte = (r.fonte_geradora || "").trim();
        let risco = (r.tipo_agente || "").trim();
        const perigo = (r.perigo_descricao || "").trim();
        const grupoNome = GRUPO_LABEL[r.grupo] || r.grupo || "Geral";

        if (!fonte) {
          if (risco && perigo) {
            fonte = perigo;
          } else if (perigo) {
            fonte = perigo;
            risco = risco || grupoNome;
          } else {
            fonte = (r.processo || r.descricao_ambiente || r.setor || "Posto de Trabalho").trim();
            risco = risco || grupoNome;
          }
        }

        if (!risco) {
          risco = perigo || grupoNome;
        }

        // Prescrição dos exames recomendados segundo a NR-07
        const exames = sugerirExamesNr07(r.grupo, risco, fonte);

        return {
          ...r,
          gesRotulo,
          risco,
          fonte,
          exames,
        };
      });
    },
    enabled: !!pgrIdAtivo && pgrIdAtivo !== "none",
  });

  const pgrBaseId = pgrIdAtivo;

  return (
    <div className="space-y-6">
      <Card className="border-t-4 border-t-amber-500 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-amber-500" /> Matriz de Exames Ocupacionais (NR-07 articulada com PGR)
          </CardTitle>
          <CardDescription>
            Matriz de correspondência obrigatória entre os riscos identificados no PGR e a prescrição
            de exames ocupacionais (Art. 7.5.6 e Anexos da NR-07).
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
                    <TableHead className="w-[120px]">GES / Setor</TableHead>
                    <TableHead>Risco Ocupacional (PGR)</TableHead>
                    <TableHead>Fonte Geradora</TableHead>
                    <TableHead className="w-[100px] text-center">Grau</TableHead>
                    <TableHead className="w-[35%]">Exames Prescritos (NR-07)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : riscos.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">O PGR selecionado não possui riscos mapeados em seu inventário.</TableCell></TableRow>
                  ) : (
                    riscos.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs font-semibold text-muted-foreground">
                          {r.gesRotulo || r.setor || "—"}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex flex-col gap-1">
                            <span>{r.risco || "-"}</span>
                            {r.grupo && (
                              <span className="text-[11px] text-muted-foreground">
                                Grupo: {GRUPO_LABEL[r.grupo] || r.grupo}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-foreground font-medium">
                          {r.fonte || "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {r.classificacao && (
                            <Badge variant="outline" className={CLASSE_TEXT[r.classificacao as keyof typeof CLASSE_TEXT] || ""}>
                              {r.classificacao.toUpperCase()}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1.5">
                            {r.exames.map((ex: any, idx: number) => (
                              <div
                                key={idx}
                                className={`px-2.5 py-1.5 rounded text-xs border ${
                                  ex.obrigatorio && ex.nome.includes("Audiometria")
                                    ? "bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800"
                                    : ex.obrigatorio && (ex.nome.includes("Espirometria") || ex.nome.includes("Tórax"))
                                    ? "bg-purple-50 dark:bg-purple-950/20 text-purple-900 dark:text-purple-200 border-purple-300 dark:border-purple-800"
                                    : "bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800/50"
                                }`}
                              >
                                <div className="font-semibold flex items-center justify-between">
                                  <span>{ex.nome}</span>
                                  <span className="text-[10px] opacity-80 font-normal">{ex.base}</span>
                                </div>
                                <div className="opacity-75 text-[11px] mt-0.5">
                                  {ex.periodicidade}
                                </div>
                              </div>
                            ))}
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
