import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  Plus, Pencil, Trash2, Download, Users, AlertTriangle, ExternalLink, Lock,
} from "lucide-react";
import { toast } from "sonner";
import LtcatGheDialog from "./LtcatGheDialog";
import LtcatAgenteDialog from "./LtcatAgenteDialog";
import LtcatAvaliacaoDialog from "./LtcatAvaliacaoDialog";
import LtcatImportarPgrDialog from "./LtcatImportarPgrDialog";

interface Props {
  ltcatId: string;
  ltcatVersao: number;
  empresaId: string;
  editavel: boolean;
}

export default function LtcatAgentesAvaliacoesTab({ ltcatId, ltcatVersao, empresaId, editavel }: Props) {
  const qc = useQueryClient();
  const [gheOpen, setGheOpen] = useState(false);
  const [editGhe, setEditGhe] = useState<any | null>(null);
  const [agenteOpen, setAgenteOpen] = useState(false);
  const [agenteCtx, setAgenteCtx] = useState<{ gheId: string; agente?: any } | null>(null);
  const [avalOpen, setAvalOpen] = useState(false);
  const [avalCtx, setAvalCtx] = useState<{ gheId: string; agenteId: string; aval?: any } | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ltcat-aa", ltcatId],
    queryFn: async () => {
      const [ghes, agentes, avals] = await Promise.all([
        (supabase.from as any)("ltcat_grupos_homogeneos").select("*").eq("ltcat_id", ltcatId).order("codigo"),
        (supabase.from as any)("ltcat_agentes").select("*").eq("ltcat_id", ltcatId).order("nome"),
        (supabase.from as any)("ltcat_avaliacoes").select("*").eq("ltcat_id", ltcatId).order("created_at"),
      ]);
      if (ghes.error) throw ghes.error;
      return {
        ghes: (ghes.data || []) as any[],
        agentes: (agentes.data || []) as any[],
        avals: (avals.data || []) as any[],
      };
    },
  });

  const removeGhe = async (id: string) => {
    if (!confirm("Remover este GHE e todos os agentes/avaliações vinculados?")) return;
    const { error } = await (supabase.from as any)("ltcat_grupos_homogeneos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("GHE removido");
    qc.invalidateQueries({ queryKey: ["ltcat-aa", ltcatId] });
  };

  const removeAgente = async (id: string) => {
    if (!confirm("Remover este agente e suas avaliações?")) return;
    const { error } = await (supabase.from as any)("ltcat_agentes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Agente removido");
    qc.invalidateQueries({ queryKey: ["ltcat-aa", ltcatId] });
  };

  const removeAval = async (id: string) => {
    if (!confirm("Remover esta avaliação?")) return;
    const { error } = await (supabase.from as any)("ltcat_avaliacoes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Avaliação removida");
    qc.invalidateQueries({ queryKey: ["ltcat-aa", ltcatId] });
  };

  const ghes = data?.ghes || [];
  const agentes = data?.agentes || [];
  const avals = data?.avals || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {ghes.length} GHE/GES · {agentes.length} agentes · {avals.length} avaliações
        </div>
        <div className="flex gap-2">
          {editavel ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Download className="h-4 w-4 mr-1" /> Importar do PGR
              </Button>
              <Button size="sm" onClick={() => { setEditGhe(null); setGheOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar GHE
              </Button>
            </>
          ) : (
            <Badge variant="outline" className="bg-zinc-100 text-zinc-700"><Lock className="h-3 w-3 mr-1" /> Somente leitura</Badge>
          )}
        </div>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Carregando…</CardContent></Card>
      ) : ghes.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhum GHE/GES avaliado. {editavel && "Adicione manualmente ou importe do PGR."}
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {ghes.map((g) => {
            const ags = agentes.filter((a) => a.grupo_homogeneo_id === g.id);
            return (
              <AccordionItem key={g.id} value={g.id} className="border rounded-md px-3">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex-1 text-left flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs">{g.codigo}</span>
                    <span className="font-medium">{g.nome}</span>
                    {g.setor_nome && <Badge variant="outline" className="text-xs">{g.setor_nome}</Badge>}
                    <Badge variant="outline" className="text-xs"><Users className="h-3 w-3 mr-1" />{g.numero_trabalhadores || 0}</Badge>
                    <Badge variant="outline" className="text-xs">{ags.length} agente(s)</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  {g.descricao_atividade && (
                    <p className="text-xs text-muted-foreground italic">{g.descricao_atividade}</p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {editavel && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { setEditGhe(g); setGheOpen(true); }}>
                          <Pencil className="h-3 w-3 mr-1" /> Editar GHE
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => removeGhe(g.id)}>
                          <Trash2 className="h-3 w-3 mr-1" /> Remover GHE
                        </Button>
                        <Button size="sm" onClick={() => { setAgenteCtx({ gheId: g.id }); setAgenteOpen(true); }}>
                          <Plus className="h-3 w-3 mr-1" /> Agente
                        </Button>
                      </>
                    )}
                  </div>

                  {ags.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-3">Nenhum agente cadastrado neste GHE.</p>
                  ) : (
                    <ul className="space-y-3">
                      {ags.map((a) => {
                        const myAvals = avals.filter((v) => v.agente_id === a.id);
                        return (
                          <li key={a.id} className="border rounded-md p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="text-sm">
                                <div className="font-medium">
                                  <span className="font-mono text-xs text-muted-foreground mr-2">{a.codigo_esocial}</span>
                                  {a.nome}
                                  <Badge variant="outline" className="ml-2 text-xs capitalize">{a.grupo}</Badge>
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {a.fonte_geradora && <>Fonte: {a.fonte_geradora}</>}
                                  {a.tipo_exposicao && <> · Exposição: {a.tipo_exposicao}</>}
                                  {a.epi_eficacia && <> · EPI: {a.epi_eficacia}</>}
                                </div>
                              </div>
                              {editavel && (
                                <div className="flex gap-1">
                                  <Button size="icon" variant="ghost" onClick={() => { setAgenteCtx({ gheId: g.id, agente: a }); setAgenteOpen(true); }}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => removeAgente(a.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" onClick={() => { setAvalCtx({ gheId: g.id, agenteId: a.id }); setAvalOpen(true); }}>
                                    <Plus className="h-3 w-3 mr-1" /> Avaliação
                                  </Button>
                                </div>
                              )}
                            </div>

                            {myAvals.length === 0 ? (
                              <p className="text-xs text-muted-foreground pl-3">Nenhuma avaliação registrada.</p>
                            ) : (
                              <ul className="space-y-1 pl-3">
                                {myAvals.map((v) => {
                                  const acima = v.tecnica === "quantitativa" && v.intensidade != null && v.limite_tolerancia != null && Number(v.intensidade) > Number(v.limite_tolerancia);
                                  const semLim = v.tecnica === "quantitativa" && (v.limite_tolerancia == null);
                                  const calVencida = v.instrumento_calibracao_validade && v.instrumento_calibracao_validade < new Date().toISOString().slice(0,10);
                                  return (
                                    <li key={v.id} className="border-l-2 border-muted pl-3 py-1 text-sm">
                                      <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <Badge variant="outline" className="text-xs capitalize">{v.tecnica}</Badge>
                                          {v.tecnica === "quantitativa" && v.intensidade != null && (
                                            <span className="text-xs">
                                              <strong>{v.intensidade}</strong> {v.unidade_medida || ""}
                                              {v.limite_tolerancia != null && <> / LT {v.limite_tolerancia}</>}
                                            </span>
                                          )}
                                          {v.data_medicao && <span className="text-xs text-muted-foreground">· {new Date(v.data_medicao + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
                                          {v.pgr_id && <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">via PGR</Badge>}
                                          {acima && <Badge className="text-xs bg-red-100 text-red-800 border-red-300"><AlertTriangle className="h-3 w-3 mr-0.5" /> Acima do LT</Badge>}
                                          {semLim && <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300">Sem LT</Badge>}
                                          {calVencida && <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-300">Calibração vencida</Badge>}
                                          {v.enquadramento === "neutralizado_epi" && (!v.justificativa_qualitativa) && (
                                            <Badge className="text-xs bg-red-100 text-red-800 border-red-300">Neutralização sem justificativa</Badge>
                                          )}
                                          {v.certificado_calibracao_link && (
                                            <a href={v.certificado_calibracao_link} target="_blank" rel="noreferrer" className="inline-flex items-center text-xs text-primary underline">
                                              <ExternalLink className="h-3 w-3 mr-0.5" /> Certif.
                                            </a>
                                          )}
                                        </div>
                                        {editavel && (
                                          <div className="flex gap-1">
                                            <Button size="icon" variant="ghost" onClick={() => { setAvalCtx({ gheId: g.id, agenteId: a.id, aval: v }); setAvalOpen(true); }}>
                                              <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" onClick={() => removeAval(v.id)}>
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                      {v.metodologia && <div className="text-xs text-muted-foreground mt-0.5">{v.metodologia}</div>}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {gheOpen && (
        <LtcatGheDialog open={gheOpen} onOpenChange={setGheOpen}
          ltcatId={ltcatId} empresaId={empresaId} ghe={editGhe} />
      )}
      {agenteOpen && agenteCtx && (
        <LtcatAgenteDialog open={agenteOpen} onOpenChange={setAgenteOpen}
          ltcatId={ltcatId} empresaId={empresaId}
          gheId={agenteCtx.gheId} agente={agenteCtx.agente} />
      )}
      {avalOpen && avalCtx && (
        <LtcatAvaliacaoDialog open={avalOpen} onOpenChange={setAvalOpen}
          ltcatId={ltcatId} ltcatVersao={ltcatVersao} empresaId={empresaId}
          agenteId={avalCtx.agenteId} gheId={avalCtx.gheId} avaliacao={avalCtx.aval} />
      )}
      {importOpen && (
        <LtcatImportarPgrDialog open={importOpen} onOpenChange={setImportOpen}
          ltcatId={ltcatId} empresaId={empresaId} />
      )}
    </div>
  );
}
