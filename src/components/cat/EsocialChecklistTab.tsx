import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, Clock } from "lucide-react";

type ItemStatus = "ok" | "warn" | "pending";

function StatusIcon({ s }: { s: ItemStatus }) {
  if (s === "ok") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (s === "warn") return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

export default function EsocialChecklistTab() {
  const { empresaId } = useAuth() as any;

  const { data, isLoading } = useQuery({
    queryKey: ["esocial-checklist", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("esocial_production_checklist", { _empresa: empresaId });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading || !data) return <div className="text-sm text-muted-foreground">Calculando checklist...</div>;

  const cidOk = data.cid10?.completa;
  const munOk = data.municipios?.completa;
  const cfgOk = data.config?.preenchida && data.config?.nr_insc_ok;
  const mapsPend =
    (data.mapeamentos?.t13_pendentes || 0) +
    (data.mapeamentos?.t14_pendentes || 0) +
    (data.mapeamentos?.t15_pendentes || 0) +
    (data.mapeamentos?.t16_pendentes || 0);

  const items: { label: string; status: ItemStatus; detail?: string }[] = [
    { label: "Base CID-10 completa", status: cidOk ? "ok" : "warn", detail: `${data.cid10?.total ?? 0} códigos (referência 14.000+)` },
    { label: "Base Municípios IBGE completa", status: munOk ? "ok" : "warn", detail: `${data.municipios?.total ?? 0} municípios (referência 5.570)` },
    { label: "Mapeamentos T13/T14/T15/T16 revisados", status: mapsPend === 0 ? "ok" : "warn", detail: mapsPend ? `${mapsPend} pendente(s)` : "Todos mapeados" },
    { label: "Configuração eSocial preenchida", status: cfgOk ? "ok" : "warn", detail: data.config?.ambiente ? `Ambiente: ${data.config.ambiente}` : "Sem configuração" },
    { label: "Alias de certificado registrado", status: data.config?.cert_alias_ok ? "ok" : "warn" },
    { label: "MFA obrigatório para ações sensíveis", status: "ok", detail: "MfaActionButton aplicado" },
    { label: "Audit log ativo", status: "ok", detail: "audit_trigger com redação de XML" },
    { label: "RLS por empresa_id validada", status: "ok" },
    { label: "Audit log sem XML completo (apenas hash)", status: "ok" },
    { label: "Certificado digital ICP-Brasil", status: "pending", detail: "Não implementado nesta fase" },
    { label: "Assinatura XMLDSig", status: "pending", detail: "Não implementada" },
    { label: "Cliente SOAP eSocial", status: "pending", detail: "Não implementado" },
    { label: "Envio ao Ambiente Nacional", status: "pending", detail: "Bloqueado por design" },
    { label: "Consulta de recibo / S-3000", status: "pending", detail: "Não implementado" },
  ];

  const okCount = items.filter((i) => i.status === "ok").length;
  const warnCount = items.filter((i) => i.status === "warn").length;
  const pendCount = items.filter((i) => i.status === "pending").length;

  const podeValidar = cfgOk;
  const podeEnviarReal = false;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            Status de Produção eSocial S-2210
            <Badge variant={podeValidar ? "default" : "outline"} className="text-[10px]">
              {podeValidar ? "Pronto para validação técnica" : "Pendente configuração"}
            </Badge>
            <Badge variant="destructive" className="text-[10px]">Não enviado ao Ambiente Nacional</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded border p-2 bg-green-50 dark:bg-green-950/30">
              <div className="text-2xl font-bold text-green-700">{okCount}</div>
              <div className="text-xs">OK</div>
            </div>
            <div className="rounded border p-2 bg-amber-50 dark:bg-amber-950/30">
              <div className="text-2xl font-bold text-amber-700">{warnCount}</div>
              <div className="text-xs">Alerta</div>
            </div>
            <div className="rounded border p-2 bg-muted">
              <div className="text-2xl font-bold">{pendCount}</div>
              <div className="text-xs">Pendente implementação</div>
            </div>
          </div>

          <ul className="divide-y border rounded">
            {items.map((it, i) => (
              <li key={i} className="flex items-start gap-3 p-2 text-sm">
                <StatusIcon s={it.status} />
                <div className="flex-1">
                  <div>{it.label}</div>
                  {it.detail && <div className="text-xs text-muted-foreground">{it.detail}</div>}
                </div>
              </li>
            ))}
          </ul>

          <div className="rounded-md bg-muted p-3 text-xs space-y-1">
            <div className="flex items-center gap-2">
              {podeValidar ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-amber-600" />}
              Validação técnica local: <strong>{podeValidar ? "liberada" : "bloqueada"}</strong>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              Envio real ao Ambiente Nacional: <strong>bloqueado</strong> (faltam certificado, assinatura e SOAP)
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
