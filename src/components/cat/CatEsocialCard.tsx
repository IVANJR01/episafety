import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileCode2, Loader2, Download, Eye, ShieldAlert, Info } from "lucide-react";
import MfaActionButton from "@/components/cat/MfaActionButton";
import { gerarSalvarXmlS2210, ESOCIAL_S2210_AVISO } from "@/lib/esocialS2210Xml";

interface Props { catId: string; empresaId: string | null; }

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  pronto_envio: "Pronto p/ envio",
  validado_stub: "Validado (stub)",
  homologacao_stub: "Homologação (stub)",
  simulado: "Simulado",
  aceito: "Aceito",
  rejeitado: "Rejeitado",
  retificar: "Retificar",
  excluido: "Excluído",
};

export default function CatEsocialCard({ catId, empresaId }: Props) {
  const qc = useQueryClient();
  const { modulosPermitidos, isSuperAdmin, isPrincipal } = useAuth();
  const [gerando, setGerando] = useState(false);
  const [openXml, setOpenXml] = useState(false);

  const canEsocial =
    isSuperAdmin ||
    isPrincipal ||
    modulosPermitidos.includes("cat:esocial") ||
    modulosPermitidos.includes("cat");

  const { data: evento, refetch } = useQuery({
    queryKey: ["esocial-evt-card", catId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("esocial_eventos_s2210")
        .select("*")
        .eq("cat_id", catId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const gerar = async () => {
    if (!evento?.id) {
      toast.error("Configure os dados eSocial na edição da CAT antes de gerar o XML.");
      return;
    }
    setGerando(true);
    try {
      const { hash, warnings, idEvento } = await gerarSalvarXmlS2210(evento.id);
      toast.success(`XML técnico gerado — ${idEvento.slice(0, 18)}…`, {
        description: `hash ${hash.slice(0, 16)}…`,
      });
      if (warnings.length) {
        toast.warning(`${warnings.length} alerta(s) de mapeamento — revise antes de transmissão real.`);
      }
      await refetch();
      qc.invalidateQueries({ queryKey: ["cat-historico", catId] });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar XML", { duration: 8000 });
    } finally {
      setGerando(false);
    }
  };

  const download = () => {
    if (!evento?.xml_gerado) return;
    const blob = new Blob([evento.xml_gerado], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `S2210_${catId.slice(0, 8)}_v${evento.versao_layout}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    // Audit log opportunístico — histórico já registra updates de status; download é client-side
  };

  const status = evento?.status || "não-criado";
  const temXml = !!evento?.xml_gerado;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <FileCode2 className="h-4 w-4" /> eSocial S-2210 (validação técnica)
          <Badge variant="outline" className="text-[10px]">
            {STATUS_LABEL[status] || status}
          </Badge>
          <Badge variant="destructive" className="text-[10px]">Não enviado ao Ambiente Nacional</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-300 p-2.5 text-amber-900 dark:text-amber-200 text-xs flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">XML gerado apenas para validação técnica. Não enviado ao Ambiente Nacional.</div>
            <div className="opacity-80">{ESOCIAL_S2210_AVISO}</div>
            <div className="opacity-80 mt-1">Bases CID-10 e Municípios IBGE em modo reduzido para validação — não use para envio real.</div>
          </div>
        </div>

        {!canEsocial && (
          <div className="rounded-md bg-muted p-2 text-xs flex gap-2 items-center">
            <ShieldAlert className="h-4 w-4" />
            Sem permissão <code className="font-mono">cat:esocial</code> — leitura apenas.
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          <Field label="Ambiente" value={evento?.tp_amb === "producao" ? "Produção (restrita)" : "Homologação"} />
          <Field label="Versão" value={evento?.versao_layout || "—"} />
          <Field label="Retificação" value={evento?.ind_retif === "retificacao" ? `Sim (recibo ${evento.nr_recibo_origem || "?"})` : "Não"} />
          <Field label="Gerado em" value={evento?.dh_processamento ? new Date(evento.dh_processamento).toLocaleString("pt-BR") : "—"} />
          <Field label="Tamanho XML" value={evento?.xml_gerado ? `${evento.xml_gerado.length} bytes` : "—"} />
          <Field label="Hash SHA-256" value={evento?.xml_hash_sha256 ? evento.xml_hash_sha256.slice(0, 16) + "…" : "—"} mono />
        </div>

        {!evento && (
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground flex gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            Nenhum evento eSocial preparado. Abra a CAT em edição → passo <strong>Dados eSocial S-2210</strong>.
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1 border-t">
          <MfaActionButton size="sm" onClick={gerar} disabled={!canEsocial || gerando || !evento}>
            {gerando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
            {temXml ? "Regerar XML técnico" : "Gerar XML técnico"}
          </MfaActionButton>
          <Button size="sm" variant="outline" disabled={!temXml} onClick={() => setOpenXml(true)}>
            <Eye className="h-4 w-4 mr-1" /> Visualizar XML
          </Button>
          <Button size="sm" variant="outline" disabled={!temXml || !canEsocial} onClick={download}>
            <Download className="h-4 w-4 mr-1" /> Baixar .xml
          </Button>
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
            <p className="text-xs text-muted-foreground">
              Hash: <span className="font-mono">{evento?.xml_hash_sha256}</span>
            </p>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono" : ""}>{value ?? "—"}</div>
    </div>
  );
}
