import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Activity, AlertTriangle, Loader2, Users, Search, Layers, Stethoscope } from "lucide-react";
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

function formatarCodigoGes(cod?: string): string {
  if (!cod) return "GES 01";
  const num = cod.replace(/\D/g, "");
  if (num) {
    return `GES ${num.padStart(2, "0")}`;
  }
  return cod.toUpperCase();
}

function extrairNumGes(cod?: string): number {
  if (!cod) return 9999;
  const num = cod.replace(/\D/g, "");
  return num ? parseInt(num, 10) : 9999;
}

interface PcmsoMatrizTabProps {
  pcmso: any;
}

export default function PcmsoMatrizTab({ pcmso }: PcmsoMatrizTabProps) {
  const queryClient = useQueryClient();
  const [pgrIdAtivo, setPgrIdAtivo] = useState<string | null>(pcmso.pgr_base_id || null);
  const [busca, setBusca] = useState("");

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

  // Busca o inventário de riscos do PGR base vinculado e dados de GES e Funções
  const { data: dadosMatriz, isLoading } = useQuery({
    queryKey: ["pcmso-riscos-base-estruturado", pgrIdAtivo, pcmso.empresa_id],
    queryFn: async () => {
      if (!pgrIdAtivo || pgrIdAtivo === "none") {
        return { grupos: [], totalRiscos: 0 };
      }

      const [invRes, ghesRes, gheFuncoesRes, sstFuncoesRes, sstSetoresRes] = await Promise.all([
        supabase
          .from("pgr_inventario_itens")
          .select("id, perigo_descricao, fonte_geradora, tipo_agente, grupo, processo, setor, descricao_ambiente, funcoes_snapshot, ghe_id, classificacao, nivel_risco")
          .eq("pgr_id", pgrIdAtivo),
        supabase
          .from("ghe_ges")
          .select("id, codigo, nome, setor")
          .eq("empresa_id", pcmso.empresa_id)
          .order("codigo"),
        supabase
          .from("ghe_funcoes")
          .select("ghe_id, nome_funcao, funcao_id"),
        (supabase.from as any)("sst_funcoes")
          .select("id, nome, setor_id")
          .eq("empresa_id", pcmso.empresa_id),
        (supabase.from as any)("sst_setores")
          .select("id, nome")
          .eq("empresa_id", pcmso.empresa_id),
      ]);

      if (invRes.error) throw invRes.error;

      const ghesData: any[] = ghesRes.data || [];
      const gheFuncoesData: any[] = gheFuncoesRes.data || [];
      const sstFuncoesData: any[] = sstFuncoesRes.data || [];
      const sstSetoresData: any[] = sstSetoresRes.data || [];

      // Mapeia funções por ghe_id
      const funcoesPorGheId = new Map<string, Set<string>>();
      for (const f of gheFuncoesData) {
        if (!f.ghe_id) continue;
        const set = funcoesPorGheId.get(f.ghe_id) || new Set<string>();
        if (f.nome_funcao) set.add(f.nome_funcao.trim());
        funcoesPorGheId.set(f.ghe_id, set);
      }

      // Mapeia funções por setor_id ou nome do setor
      const funcoesPorSetorNome = new Map<string, Set<string>>();
      for (const set of sstSetoresData) {
        const funcsDoSetor = sstFuncoesData.filter((f: any) => f.setor_id === set.id);
        if (funcsDoSetor.length > 0) {
          const nomeSetorNorm = (set.nome || "").trim().toUpperCase();
          const s = funcoesPorSetorNome.get(nomeSetorNorm) || new Set<string>();
          for (const f of funcsDoSetor) {
            if (f.nome) s.add(f.nome.trim());
          }
          funcoesPorSetorNome.set(nomeSetorNorm, s);
        }
      }

      // Itens formatados do inventário
      const itensMapeados = (invRes.data || []).map((r: any) => {
        const gesObj = ghesData.find((g: any) => g.id === r.ghe_id);
        const codOriginal = gesObj?.codigo || r.ghe_id || "01";
        const codigoFormatado = formatarCodigoGes(codOriginal);
        const codigoNum = extrairNumGes(codOriginal);

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

        // Funções do item (snapshot ou vinculadas ao GES)
        const funcoesItemSet = new Set<string>();
        if (Array.isArray(r.funcoes_snapshot)) {
          for (const fn of r.funcoes_snapshot) {
            if (fn && typeof fn === "string") funcoesItemSet.add(fn.trim());
          }
        } else if (typeof r.funcoes_snapshot === "string" && r.funcoes_snapshot) {
          funcoesItemSet.add(r.funcoes_snapshot.trim());
        }

        if (r.ghe_id && funcoesPorGheId.has(r.ghe_id)) {
          for (const fn of funcoesPorGheId.get(r.ghe_id)!) {
            funcoesItemSet.add(fn);
          }
        }

        const setorNome = (r.setor || gesObj?.setor || gesObj?.nome || "").trim().toUpperCase();
        if (setorNome && funcoesPorSetorNome.has(setorNome)) {
          for (const fn of funcoesPorSetorNome.get(setorNome)!) {
            funcoesItemSet.add(fn);
          }
        }

        const exames = sugerirExamesNr07(r.grupo, risco, fonte);

        return {
          ...r,
          gesId: r.ghe_id || "sem_ges",
          gesNome: gesObj?.nome || r.setor || "Geral",
          setor: r.setor || gesObj?.setor || "—",
          codigoFormatado,
          codigoNum,
          risco,
          fonte,
          funcoes: Array.from(funcoesItemSet),
          exames,
        };
      });

      // Agrupa por GES
      const mapaGrupos = new Map<string, {
        gesId: string;
        codigoFormatado: string;
        codigoNum: number;
        nome: string;
        setor: string;
        funcoes: Set<string>;
        itens: any[];
      }>();

      for (const item of itensMapeados) {
        const chave = item.codigoFormatado;
        if (!mapaGrupos.has(chave)) {
          mapaGrupos.set(chave, {
            gesId: item.gesId,
            codigoFormatado: item.codigoFormatado,
            codigoNum: item.codigoNum,
            nome: item.gesNome,
            setor: item.setor,
            funcoes: new Set<string>(item.funcoes),
            itens: [],
          });
        }
        const g = mapaGrupos.get(chave)!;
        for (const f of item.funcoes) g.funcoes.add(f);
        g.itens.push(item);
      }

      // Converte para lista ordenada por número do GES (01, 02, 03...)
      const grupos = Array.from(mapaGrupos.values()).map((g) => ({
        ...g,
        funcoes: Array.from(g.funcoes),
      }));

      grupos.sort((a, b) => {
        if (a.codigoNum !== b.codigoNum) return a.codigoNum - b.codigoNum;
        return a.codigoFormatado.localeCompare(b.codigoFormatado);
      });

      return {
        grupos,
        totalRiscos: itensMapeados.length,
      };
    },
    enabled: !!pgrIdAtivo && pgrIdAtivo !== "none",
  });

  // Filtragem pela busca
  const gruposFiltrados = useMemo(() => {
    if (!dadosMatriz?.grupos) return [];
    if (!busca.trim()) return dadosMatriz.grupos;

    const termo = busca.toLowerCase();
    return dadosMatriz.grupos
      .map((g) => {
        const matchGes = g.codigoFormatado.toLowerCase().includes(termo) ||
          g.nome.toLowerCase().includes(termo) ||
          g.setor.toLowerCase().includes(termo) ||
          g.funcoes.some((f) => f.toLowerCase().includes(termo));

        const itensFiltrados = g.itens.filter((i) =>
          matchGes ||
          i.risco.toLowerCase().includes(termo) ||
          i.fonte.toLowerCase().includes(termo) ||
          (i.grupo && i.grupo.toLowerCase().includes(termo)) ||
          i.exames.some((e: any) => e.nome.toLowerCase().includes(termo))
        );

        if (matchGes || itensFiltrados.length > 0) {
          return {
            ...g,
            itens: matchGes ? g.itens : itensFiltrados,
          };
        }
        return null;
      })
      .filter(Boolean) as typeof dadosMatriz.grupos;
  }, [dadosMatriz, busca]);

  return (
    <div className="space-y-6">
      <Card className="border-t-4 border-t-amber-500 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-amber-500" /> Matriz de Exames Ocupacionais (NR-07 articulada com PGR)
              </CardTitle>
              <CardDescription className="mt-1">
                Matriz de correspondência obrigatória entre os riscos identificados no PGR e a prescrição
                de exames ocupacionais (Art. 7.5.6 e Anexos da NR-07), organizada por GES e Funções.
              </CardDescription>
            </div>

            {dadosMatriz && dadosMatriz.grupos.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar GES, função, risco..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-8 h-9 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {dadosMatriz && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" />
                <strong>{dadosMatriz.grupos.length}</strong> Grupo(s) GES Mapeados
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-amber-500" />
                <strong>{dadosMatriz.totalRiscos}</strong> Risco(s) no Inventário
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Stethoscope className="h-3.5 w-3.5 text-blue-500" />
                Conforme <strong>Portaria MTP nº 6.734/2020</strong>
              </span>
            </div>
          )}
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
          ) : isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Carregando e organizando a matriz por GES e Funções...</span>
            </div>
          ) : !dadosMatriz || dadosMatriz.grupos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              O PGR selecionado não possui riscos mapeados em seu inventário.
            </div>
          ) : gruposFiltrados.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum resultado encontrado para a busca "{busca}".
            </div>
          ) : (
            <div className="space-y-6">
              {gruposFiltrados.map((g) => (
                <div
                  key={g.codigoFormatado}
                  className="rounded-lg border bg-card shadow-sm overflow-hidden"
                >
                  {/* Cabeçalho do Grupo GES */}
                  <div className="bg-muted/40 p-3.5 border-b flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-primary hover:bg-primary text-primary-foreground font-mono font-semibold text-xs px-2.5 py-1 tracking-wide">
                        {g.codigoFormatado}
                      </Badge>
                      <div>
                        <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                          {g.nome}
                        </h4>
                        {g.setor && g.setor !== g.nome && g.setor !== "—" && (
                          <span className="text-xs text-muted-foreground">
                            Setor: <strong className="text-foreground">{g.setor}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Exibição Clara e Destacada das Funções / Cargos */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground mr-1">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        <span>Funções / Cargos:</span>
                      </div>
                      {g.funcoes.length > 0 ? (
                        g.funcoes.map((fn, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="text-xs font-normal bg-background border border-border shadow-2xs"
                          >
                            {fn}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-amber-600 dark:text-amber-400 italic">
                          (Não especificada no cadastro)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tabela dos Riscos e Exames do GES */}
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow>
                        <TableHead className="w-[30%]">Risco Ocupacional (PGR)</TableHead>
                        <TableHead className="w-[25%]">Fonte Geradora</TableHead>
                        <TableHead className="w-[100px] text-center">Grau</TableHead>
                        <TableHead className="w-[35%]">Exames Prescritos (NR-07)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {g.itens.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-foreground">{r.risco || "-"}</span>
                              {r.grupo && (
                                <span className="text-[11px] text-muted-foreground">
                                  Grupo: {GRUPO_LABEL[r.grupo] || r.grupo}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-foreground font-medium text-xs">
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
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
