import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  AlertTriangle, CheckCircle2, FileCode2, Loader2, Download, Eye,
  ShieldAlert, Info, ListChecks, RefreshCcw,
} from "lucide-react";
import MfaActionButton from "@/components/cat/MfaActionButton";
import {
  gerarSalvarXmlS2210, validarXmlS2210, iniciarRetificacaoS2210,
  registrarDownloadXml, ESOCIAL_S2210_AVISO,
} from "@/lib/esocialS2210Xml";

interface Props { catId: string; empresaId: string | null; }

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente", pronto_envio: "Pronto p/ envio",
  validado_stub: "Validado (stub)", homologacao_stub: "Homologação (stub)",
  simulado: "Simulado", aceito: "Aceito", rejeitado: "Rejeitado",
  retificar: "Retificar", excluido: "Excluído",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pendente: "outline", pronto_envio: "secondary", validado_stub: "default",
  homologacao_stub: "default", simulado: "secondary", aceito: "default",
  rejeitado: "destructive", retificar: "outline", excluido: "destructive",
};

export default function CatEsocialCard({ catId }: Props) {
  const qc = useQueryClient();
  const { modulosPermitidos, isSuperAdmin, isPrincipal } = useAuth();
  const [busy, setBusy] = useState<"gerar" | "validar" | "retif" | null>(null);
  const [openXml, setOpenXml] = useState(false);

  const canEsocial =
    isSuperAdmin || isPrincipal ||
    modulosPermitidos.includes("cat:esocial") ||
    modulosPermitidos.includes("cat");

  const { data: evento, refetch } = useQuery({
    queryKey: ["esocial-evt-card", catId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("esocial_eventos_s2210")
        .select("*").eq("cat_id", catId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const { data: ocorrencias = [], refetch: refetchOco } = useQuery({
    queryKey: ["esocial-oco", evento?.id],
    enabled: !!evento?.id,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("esocial_retorno_ocorrencias")
        .select("*").eq("evento_id", evento.id)
        .order("tipo", { ascending: true }).order("created_at", { ascending: true });
      return data || [];
    },
  });

  const refresh = async () => {
    await Promise.all([refetch(), refetchOco()]);
    qc.invalidateQueries({ queryKey: ["cat-historico", catId] });
  };

  const handleValidar = async () => {
    if (!evento?.id) { toast.error("Configure os dados eSocial na CAT antes de validar."); return; }
    setBusy("validar");
    try {
      const r = await validarXmlS2210(evento.id);
      const msg = `${r.total_erros} erro(s), ${r.total_alertas} alerta(s) — status ${r.status}`;
      r.total_erros > 0 ? toast.error(msg, { duration: 7000 }) : toast.success(msg);
      await refresh();
    } catch (e: any) { toast.error(e?.message || "Falha na validação"); }
    finally { setBusy(null); }
  };

  const handleGerar = async () => {
    if (!evento?.id) { toast.error("Configure os dados eSocial na CAT antes de gerar."); return; }
    setBusy("gerar");
    try {
      const { hash, warnings, idEvento } = await gerarSalvarXmlS2210(evento.id);
      toast.success(`XML técnico gerado — ${idEvento.slice(0, 18)}…`, { description: `hash ${hash.slice(0, 16)}…` });
      if (warnings.length) toast.warning(`${warnings.length} alerta(s) de mapeamento — revise antes de transmissão real.`);
      await refresh();
    } catch (e: any) { toast.error(e?.message || "Falha ao gerar XML", { duration: 8000 }); }
    finally { setBusy(null); }
  };

  const handleRetif = async () => {
    if (!evento?.id) return;
    if (!confirm("Iniciar retificação? Será criado um novo evento vinculado ao atual. O original não será alterado.")) return;
    setBusy("retif");
    try {
      const r = await iniciarRetificacaoS2210(evento.id);
      toast.success("Retificação iniciada", { description: `Novo evento ${r.novo_evento_id.slice(0, 8)}…` });
      await refresh();
    } catch (e: any) { toast.error(e?.message || "Falha ao iniciar retificação"); }
    finally { setBusy(null); }
  };

  const download = async () => {
    if (!evento?.xml_gerado) return;
    try { await registrarDownloadXml(evento.id); } catch {/* não bloqueia download */}
    const blob = new Blob([evento.xml_gerado], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `S2210_${catId.slice(0, 8)}_v${evento.versao_layout}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const status = evento?.status || "não-criado";
  const temXml = !!evento?.xml_gerado;
  const podeRetif = evento && ["aceito", "validado_stub", "homologacao_stub", "simulado"].includes(evento.status);
  const erros = ocorrencias.filter((o: any) => o.tipo === 1);
  const alertas = ocorrencias.filter((o: any) => o.tipo === 2);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <FileCode2 className="h-4 w-4" /> eSocial S-2210 (validação técnica)
          <Badge variant={STATUS_VARIANT[status] || "outline"} className="text-[10px]">
            {STATUS_LABEL[status] || status}
          </Badge>
          {evento?.ultima_validacao_em && (
            <Badge variant="outline" className="text-[10px]">
              Validação local: {new Date(evento.ultima_validacao_em).toLocaleString("pt-BR")}
            </Badge>
          )}
          <Badge variant="destructive" className="text-[10px]">Não enviado ao Ambiente Nacional</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-300 p-2.5 text-amber-900 dark:text-amber-200 text-xs flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">XML apenas para validação técnica local. Nenhum envio é realizado.</div>
            <div className="opacity-80">{ESOCIAL_S2210_AVISO}</div>
            <div className="opacity-80 mt-1">Bases CID-10 e Municípios IBGE em modo reduzido — não use para envio real.</div>
          </div>
        </div>

        {!canEsocial && (
          <div className="rounded-md bg-muted p-2 text-xs flex gap-2 items-center">
            <ShieldAlert className="h-4 w-4" /> Sem permissão <code className="font-mono">cat:esocial</code> — leitura apenas.
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          <Field label="Ambiente" value={evento?.tp_amb === "producao" ? "Produção (restrita)" : "Homologação"} />
          <Field label="Versão" value={evento?.versao_layout || "—"} />
          <Field label="Retificação" value={evento?.ind_retif === "retificacao" ? `Sim (recibo ${evento.nr_recibo_origem || "?"})` : "Não"} />
          <Field label="Origem (evento)" value={evento?.evento_origem_id ? evento.evento_origem_id.slice(0, 8) + "…" : "—"} mono />
          <Field label="Gerado em" value={evento?.dh_processamento ? new Date(evento.dh_processamento).toLocaleString("pt-BR") : "—"} />
          <Field label="Tamanho XML" value={evento?.xml_gerado ? `${evento.xml_gerado.length} bytes` : "—"} />
          <Field label="Hash SHA-256" value={evento?.xml_hash_sha256 || "—"} mono />
          <Field label="hrsTrabAntesAcid" value={evento?.hrs_trab_antes_acid ?? "não informado"} />
          <Field label="iniciatCAT" value={evento?.iniciat_cat ?? "—"} />
        </div>

        {!evento && (
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground flex gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            Nenhum evento eSocial preparado. Abra a CAT em edição → passo <strong>Dados eSocial S-2210</strong>.
          </div>
        )}

        {(erros.length > 0 || alertas.length > 0) && (
          <div className="rounded-md border p-2 space-y-1.5">
            <div className="text-xs font-semibold flex items-center gap-2">
              <ListChecks className="h-4 w-4" /> Ocorrências da última validação
              {erros.length > 0 && <Badge variant="destructive" className="text-[10px]">{erros.length} erro(s)</Badge>}
              {alertas.length > 0 && <Badge variant="outline" className="text-[10px]">{alertas.length} alerta(s)</Badge>}
            </div>
            <ul className="text-xs space-y-1 max-h-48 overflow-auto">
              {[...erros, ...alertas].map((o: any) => (
                <li key={o.id} className="flex gap-2">
                  <Badge variant={o.tipo === 1 ? "destructive" : "outline"} className="text-[9px] shrink-0">
                    {o.tipo === 1 ? "ERRO" : "ALERTA"}
                  </Badge>
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0">{o.codigo}</span>
                  <span>{o.descricao}{o.localizacao ? <em className="text-muted-foreground"> · {o.localizacao}</em> : null}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1 border-t">
          <MfaActionButton size="sm" variant="outline" onClick={handleValidar} disabled={!canEsocial || !!busy || !evento}>
            {busy === "validar" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ListChecks className="h-4 w-4 mr-1" />}
            Validar XML técnico
          </MfaActionButton>
          <MfaActionButton size="sm" onClick={handleGerar} disabled={!canEsocial || !!busy || !evento}>
            {busy === "gerar" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
            {temXml ? "Regerar XML" : "Gerar XML"}
          </MfaActionButton>
          <Button size="sm" variant="outline" disabled={!temXml} onClick={() => setOpenXml(true)}>
            <Eye className="h-4 w-4 mr-1" /> Visualizar
          </Button>
          <Button size="sm" variant="outline" disabled={!temXml || !canEsocial} onClick={download}>
            <Download className="h-4 w-4 mr-1" /> Baixar .xml
          </Button>
          {podeRetif && (
            <MfaActionButton size="sm" variant="secondary" onClick={handleRetif} disabled={!canEsocial || !!busy}>
              {busy === "retif" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCcw className="h-4 w-4 mr-1" />}
              Iniciar retificação
            </MfaActionButton>
          )}
        </div>

        <Dialog open={openXml} onOpenChange={setOpenXml}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileCode2 className="h-5 w-5" /> XML S-2210 (técnico)
                <Badge variant="destructive" className="text-[10px]">Não transmitido</Badge>
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-auto rounded border bg-muted/40 p-3">
              <pre className="text-[11px] font-mono whitespace-pre-wrap break-all">{evento?.xml_gerado}</pre>
            </div>
            <p className="text-xs text-muted-foreground">Hash: <span className="font-mono">{evento?.xml_hash_sha256}</span></p>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={"truncate " + (mono ? "font-mono" : "")} title={String(value ?? "")}>{value ?? "—"}</div>
    </div>
  );
}
