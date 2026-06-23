import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, CheckCircle2, FileCode2, Loader2, Download, ExternalLink,
  ShieldAlert, Info, ListChecks,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import MfaActionButton from "@/components/cat/MfaActionButton";
import {
  obterOuCriarEventoS2240PorPeriodo, validarEventoS2240, gerarXmlS2240,
  validarXmlS2240Tecnico,
  ESOCIAL_S2240_AVISO, ESOCIAL_S2240_VERSAO_LAYOUT,
  type Ocorrencia,
} from "@/lib/esocialS2240Xml";
import {
  openDocumentoSeguro,
  parseSupabaseStorageRef,
  SUPABASE_STORAGE_REF_PREFIX,
  SST_BUCKET,
} from "@/lib/secureStorage";

interface Props { ppp: any; }

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  pronto_envio: "Pronto p/ envio (stub)",
  validado_stub: "Validado (stub)",
  homologacao_stub: "Homologação (stub)",
  simulado: "Simulado",
  rejeitado_local: "Rejeitado localmente",
  retificar: "Retificar",
  excluido_local: "Excluído local",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pendente: "outline", pronto_envio: "secondary", validado_stub: "default",
  homologacao_stub: "default", simulado: "secondary",
  rejeitado_local: "destructive", retificar: "outline", excluido_local: "destructive",
};

function hasPerm(modulosPermitidos: string[], isSuperAdmin: boolean, isPrincipal: boolean, key: string) {
  if (isSuperAdmin || isPrincipal) return true;
  return modulosPermitidos.includes(key) || modulosPermitidos.includes("esocial");
}

export default function PppEsocialS2240Tab({ ppp }: Props) {
  const qc = useQueryClient();
  const { modulosPermitidos, isSuperAdmin, isPrincipal } = useAuth();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [xmlValByEvento, setXmlValByEvento] = useState<Record<string, { erros: number; alertas: number; ocorrencias: Ocorrencia[]; hashOk: boolean; quando: string }>>({});

  const canView = hasPerm(modulosPermitidos, isSuperAdmin, isPrincipal, "esocial:s2240:visualizar");
  const canPreparar = hasPerm(modulosPermitidos, isSuperAdmin, isPrincipal, "esocial:s2240:preparar");
  const canValidar = hasPerm(modulosPermitidos, isSuperAdmin, isPrincipal, "esocial:s2240:validar");

  const { data: periodos = [] } = useQuery({
    queryKey: ["ppp-s2240-periodos", ppp.id],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ppp_periodos")
        .select("id, data_inicio, data_fim, funcao_nome, cbo, setor_nome, ltcat_id")
        .eq("ppp_id", ppp.id).order("ordem", { ascending: true });
      return data || [];
    },
  });

  const { data: eventos = [], refetch: refetchEv } = useQuery({
    queryKey: ["ppp-s2240-eventos", ppp.id],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("esocial_eventos_s2240")
        .select("*").eq("ppp_documento_id", ppp.id).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const eventoByPeriodo = new Map<string, any>();
  for (const ev of eventos as any[]) {
    if (ev.status === "excluido_local") continue;
    if (!ev.ppp_periodo_id) continue;
    if (!eventoByPeriodo.has(ev.ppp_periodo_id)) eventoByPeriodo.set(ev.ppp_periodo_id, ev);
  }

  const { data: mapeamentos = [] } = useQuery({
    queryKey: ["ppp-s2240-maps", ppp.empresa_id],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("esocial_s2240_mapeamentos")
        .select("agente_nome, codigo_t24, status").eq("empresa_id", ppp.empresa_id);
      return data || [];
    },
  });
  const mapNorm = new Map<string, any>();
  for (const m of mapeamentos as any[]) mapNorm.set((m.agente_nome || "").trim().toLowerCase(), m);

  const { data: exposByPeriodo = {} } = useQuery({
    queryKey: ["ppp-s2240-exp", ppp.id],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ppp_exposicoes")
        .select("id, periodo_id, agente_nome, codigo_esocial").eq("ppp_id", ppp.id);
      const acc: Record<string, any[]> = {};
      for (const e of data || []) {
        (acc[e.periodo_id] ||= []).push(e);
      }
      return acc;
    },
  });

  const refresh = () => {
    refetchEv();
    qc.invalidateQueries({ queryKey: ["ppp-s2240-eventos", ppp.id] });
  };

  const handleValidar = async (periodoId: string) => {
    setBusyKey(periodoId + ":val");
    try {
      const evId = await obterOuCriarEventoS2240PorPeriodo(ppp.id, periodoId);
      const r = await validarEventoS2240(evId);
      const msg = `${r.erros} erro(s), ${r.alertas} alerta(s)`;
      r.erros > 0 ? toast.error(msg, { duration: 7000 }) : toast.success(`Validação OK — ${msg}`);
      refresh();
    } catch (e: any) { toast.error(e?.message || "Falha na validação"); }
    finally { setBusyKey(null); }
  };

  const handleGerar = async (periodoId: string) => {
    setBusyKey(periodoId + ":gen");
    try {
      const evId = await obterOuCriarEventoS2240PorPeriodo(ppp.id, periodoId);
      const r = await gerarXmlS2240(evId);
      toast.success(`XML técnico gerado — hash ${r.hash.slice(0, 16)}…`, {
        description: `Drive: ${r.driveId.slice(0, 12)}…`,
      });
      if (r.warnings.length) toast.warning(`${r.warnings.length} alerta(s) — revise.`);
      refresh();
    } catch (e: any) { toast.error(e?.message || "Falha ao gerar XML", { duration: 8000 }); }
    finally { setBusyKey(null); }
  };

  const handleValidarXml = async (periodoId: string, eventoId: string) => {
    setBusyKey(periodoId + ":xml");
    try {
      const r = await validarXmlS2240Tecnico(eventoId);
      setXmlValByEvento((s) => ({
        ...s,
        [eventoId]: {
          erros: r.erros, alertas: r.alertas, ocorrencias: r.ocorrencias,
          hashOk: r.hashOk, quando: new Date().toISOString(),
        },
      }));
      const msg = `${r.erros} erro(s), ${r.alertas} alerta(s) · hash ${r.hashOk ? "ok" : "divergente"}`;
      r.erros > 0
        ? toast.error("Validação técnica falhou — " + msg, { duration: 8000 })
        : toast.success("Validação técnica OK — " + msg);
      refresh();
    } catch (e: any) { toast.error(e?.message || "Falha ao validar XML técnico", { duration: 8000 }); }
    finally { setBusyKey(null); }
  };



  if (!canView) {
    return (
      <Card><CardContent className="p-6 text-sm text-muted-foreground flex gap-2 items-center">
        <ShieldAlert className="h-4 w-4" /> Sem permissão <code className="font-mono">esocial:s2240:visualizar</code>.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            <FileCode2 className="h-4 w-4" /> eSocial S-2240 — Condições Ambientais (stub)
            <Badge variant="outline" className="text-[10px]">Layout {ESOCIAL_S2240_VERSAO_LAYOUT}</Badge>
            <Badge variant="destructive" className="text-[10px]">Não enviado ao Ambiente Nacional</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-300 p-2.5 text-amber-900 dark:text-amber-200 text-xs flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">{ESOCIAL_S2240_AVISO}</div>
              <div className="opacity-80">
                XML salvo apenas no seu Google Drive privado (BYOK), em
                <code className="font-mono mx-1">eSocial/S2240/{ppp.id.slice(0, 8)}…/</code>.
                Nenhum certificado ICP-Brasil, SOAP, recibo ou protocolo real é gerado.
              </div>
              <div className="opacity-80 mt-1">
                Mapeamento Tabela 24:{" "}
                <Link to="/esocial/s2240/mapeamentos" className="underline">configurar agentes</Link>
              </div>
            </div>
          </div>

          {periodos.length === 0 && (
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground flex gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              Cadastre ao menos um período laboral no PPP antes de preparar eventos S-2240.
            </div>
          )}

          <div className="space-y-3">
            {(periodos as any[]).map((per) => {
              const ev = eventoByPeriodo.get(per.id);
              const exps = (exposByPeriodo as any)[per.id] || [];
              const pend = exps.filter((e: any) => {
                const m = mapNorm.get((e.agente_nome || "").trim().toLowerCase());
                return !m?.codigo_t24 && !e.codigo_esocial;
              });
              const div = exps.filter((e: any) => mapNorm.get((e.agente_nome || "").trim().toLowerCase())?.status === "divergente");
              const status = ev?.status || "não-criado";
              const busyVal = busyKey === per.id + ":val";
              const busyGen = busyKey === per.id + ":gen";

              return (
                <div key={per.id} className="border rounded p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex-1 min-w-[200px]">
                      <div className="text-sm font-medium">
                        {per.funcao_nome || "—"} <span className="text-muted-foreground">· CBO {per.cbo || "—"}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {per.data_inicio} → {per.data_fim || "atual"} · setor {per.setor_nome || "—"}
                      </div>
                    </div>
                    <Badge variant={STATUS_VARIANT[status] || "outline"} className="text-[10px]">
                      {STATUS_LABEL[status] || status}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">{exps.length} agente(s)</Badge>
                    {pend.length > 0 && <Badge variant="destructive">{pend.length} sem T24</Badge>}
                    {div.length > 0 && <Badge variant="destructive">{div.length} divergente(s)</Badge>}
                    {ev?.xml_sha256 && (
                      <Badge variant="outline" className="font-mono">
                        sha256 {ev.xml_sha256.slice(0, 12)}…
                      </Badge>
                    )}
                    {ev?.xml_gerado_em && (
                      <Badge variant="outline">
                        gerado {new Date(ev.xml_gerado_em).toLocaleString("pt-BR")}
                      </Badge>
                    )}
                    {ev?.xml_tamanho_bytes && (
                      <Badge variant="outline">{ev.xml_tamanho_bytes} bytes</Badge>
                    )}
                  </div>

                  {pend.length > 0 && (
                    <div className="rounded bg-muted/50 p-2 text-xs">
                      <div className="font-semibold flex items-center gap-1.5">
                        <ListChecks className="h-3.5 w-3.5" /> Pendências de Tabela 24
                      </div>
                      <ul className="mt-1 list-disc list-inside opacity-90">
                        {pend.slice(0, 6).map((e: any) => (<li key={e.id}>{e.agente_nome}</li>))}
                        {pend.length > 6 && <li>… +{pend.length - 6}</li>}
                      </ul>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1 border-t">
                    <MfaActionButton
                      size="sm" variant="outline"
                      disabled={!canValidar || !!busyKey}
                      onClick={() => handleValidar(per.id)}
                    >
                      {busyVal ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                      Validar localmente
                    </MfaActionButton>
                    <MfaActionButton
                      size="sm"
                      disabled={!canPreparar || !!busyKey || pend.length > 0 || div.length > 0}
                      onClick={() => handleGerar(per.id)}
                      title={pend.length > 0 || div.length > 0 ? "Resolva pendências de Tabela 24" : ""}
                    >
                      {busyGen ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileCode2 className="h-4 w-4 mr-1" />}
                      Gerar XML técnico
                    </MfaActionButton>
                    {ev?.xml_drive_id && (
                      <MfaActionButton
                        size="sm" variant="secondary"
                        disabled={!canValidar || !!busyKey}
                        onClick={() => handleValidarXml(per.id, ev.id)}
                      >
                        {busyKey === per.id + ":xml"
                          ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          : <ShieldAlert className="h-4 w-4 mr-1" />}
                        Validar XML técnico
                      </MfaActionButton>
                    )}
                    {ev?.xml_drive_link && (
                      <>
                        <Button asChild size="sm" variant="outline">
                          <a href={ev.xml_drive_link} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-4 w-4 mr-1" /> Abrir no Drive
                          </a>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <a href={`https://drive.google.com/uc?id=${ev.xml_drive_id}&export=download`} target="_blank" rel="noreferrer">
                            <Download className="h-4 w-4 mr-1" /> Baixar XML
                          </a>
                        </Button>
                      </>
                    )}
                  </div>

                  {ev?.validado_em && (
                    <div className="text-[11px] text-muted-foreground flex flex-wrap gap-2 items-center pt-1">
                      <Badge variant="default" className="text-[10px]">Validação local</Badge>
                      <span>Última validação: {new Date(ev.validado_em).toLocaleString("pt-BR")}</span>
                    </div>
                  )}

                  {ev && xmlValByEvento[ev.id] && (
                    <div className={`rounded p-2 text-xs border ${xmlValByEvento[ev.id].erros > 0 ? "border-destructive/40 bg-destructive/5" : "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30"}`}>
                      <div className="font-semibold flex items-center gap-1.5">
                        {xmlValByEvento[ev.id].erros > 0
                          ? <AlertTriangle className="h-3.5 w-3.5" />
                          : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Resultado da validação técnica · {xmlValByEvento[ev.id].erros} erro(s), {xmlValByEvento[ev.id].alertas} alerta(s) · hash {xmlValByEvento[ev.id].hashOk ? "ok" : "divergente"}
                      </div>
                      {xmlValByEvento[ev.id].ocorrencias.length > 0 && (
                        <ul className="mt-1 space-y-0.5 max-h-44 overflow-auto">
                          {xmlValByEvento[ev.id].ocorrencias.slice(0, 30).map((o, i) => (
                            <li key={i} className="flex gap-1.5">
                              <Badge variant={o.tipo === "erro" ? "destructive" : "outline"} className="text-[9px] uppercase shrink-0">
                                {o.tipo}
                              </Badge>
                              <span className="font-mono opacity-70 shrink-0">{o.codigo}</span>
                              <span className="opacity-90">{o.mensagem}</span>
                            </li>
                          ))}
                          {xmlValByEvento[ev.id].ocorrencias.length > 30 && (
                            <li className="opacity-60">… +{xmlValByEvento[ev.id].ocorrencias.length - 30}</li>
                          )}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

          </div>
        </CardContent>
      </Card>
    </div>
  );
}
