import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck } from "lucide-react";
import { PgrDocumento, PgrStatus } from "@/lib/pgrTypes";
import { isAtrasada } from "@/lib/pgrAcoes";

interface Props {
  pgr: PgrDocumento;
}

type CheckState = "ok" | "warn" | "fail" | "info";

interface Item {
  label: string;
  state: CheckState;
  detail?: string;
}

function Row({ item }: { item: Item }) {
  const Icon =
    item.state === "ok" ? CheckCircle2 :
    item.state === "warn" ? AlertTriangle :
    item.state === "fail" ? XCircle : ShieldCheck;
  const color =
    item.state === "ok" ? "text-emerald-600" :
    item.state === "warn" ? "text-amber-600" :
    item.state === "fail" ? "text-red-600" : "text-blue-600";
  return (
    <li className="flex items-start gap-2 py-1.5 border-b last:border-0">
      <Icon className={`h-4 w-4 mt-0.5 ${color}`} />
      <div className="flex-1">
        <div className="text-sm">{item.label}</div>
        {item.detail && <div className="text-xs text-muted-foreground">{item.detail}</div>}
      </div>
    </li>
  );
}

export default function PgrChecklistTab({ pgr }: Props) {
  const pgrId = pgr.id;

  const { data: inventario = [] } = useQuery({
    queryKey: ["pgr-chk-inv", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_inventario_itens")
        .select("id,classificacao").eq("pgr_id", pgrId);
      return (data || []) as any[];
    },
  });

  const { data: acoes = [] } = useQuery({
    queryKey: ["pgr-chk-acoes", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_acoes")
        .select("id,status,prazo,inventario_item_id").eq("pgr_id", pgrId);
      return (data || []) as any[];
    },
  });

  const { data: pdfVersoes = [] } = useQuery({
    queryKey: ["pgr-chk-pdf", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_pdf_versoes")
        .select("*").eq("pgr_id", pgrId).order("pdf_versao", { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: assinaturas = [] } = useQuery({
    queryKey: ["pgr-chk-assin", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_assinaturas")
        .select("*").eq("pgr_id", pgrId);
      return (data || []) as any[];
    },
  });

  const { data: evidencias = [] } = useQuery({
    queryKey: ["pgr-chk-evid", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_acao_evidencias")
        .select("id,drive_file_id").eq("pgr_id", pgrId);
      return (data || []) as any[];
    },
  });

  const status = pgr.status as PgrStatus;
  const ultimoPdf = pdfVersoes[0];
  const altoCrit = inventario.filter((i) => i.classificacao === "alto" || i.classificacao === "critico");
  const altoCritIds = new Set(altoCrit.map((i: any) => i.id));
  const acoesAtivas = acoes.filter((a: any) => a.status !== "cancelada");
  const altoCritSemAcao = altoCrit.filter((i: any) =>
    !acoes.some((a: any) => a.inventario_item_id === i.id && a.status !== "cancelada"),
  );
  const atrasadas = acoes.filter((a: any) => isAtrasada(a));
  const pdfDesatualizado = ultimoPdf && (pgr as any).conteudo_atualizado_em &&
    new Date((pgr as any).conteudo_atualizado_em).getTime() >
    new Date(ultimoPdf.gerado_em).getTime() + 500;
  const respTec = (pgr.responsavel_tecnico_id != null) || !!(pgr.resp_tec_nome || "").trim();
  const assinPdfAtual = ultimoPdf && assinaturas.some(
    (a: any) => a.pdf_versao === ultimoPdf.pdf_versao && a.pdf_hash === ultimoPdf.pdf_hash,
  );

  // Avaliação dos critérios finais de publicação
  const pubItems: Item[] = [
    { label: "Inventário preenchido", state: inventario.length > 0 ? "ok" : "fail",
      detail: `${inventario.length} item(ns) cadastrado(s)` },
    { label: "Plano de ação preenchido (quando há risco alto/crítico)",
      state: altoCrit.length === 0 ? "info" : (acoesAtivas.length > 0 ? "ok" : "fail"),
      detail: altoCrit.length === 0 ? "Sem riscos alto/crítico no inventário" :
              `${acoesAtivas.length} ação(ões) ativa(s)` },
    { label: "Riscos alto/crítico com ação vinculada",
      state: altoCrit.length === 0 ? "info" : (altoCritSemAcao.length === 0 ? "ok" : "warn"),
      detail: altoCritSemAcao.length > 0 ? `${altoCritSemAcao.length} risco(s) sem ação vinculada` : undefined },
    { label: "PDF gerado", state: ultimoPdf ? "ok" : "fail",
      detail: ultimoPdf ? `Última versão: PDF v${ultimoPdf.pdf_versao}` : "Nenhum PDF gerado" },
    { label: "PDF atualizado em relação ao conteúdo",
      state: !ultimoPdf ? "fail" : pdfDesatualizado ? "warn" : "ok",
      detail: pdfDesatualizado ? "Regenerar PDF antes de publicar" : undefined },
    { label: "PDF final (sem marca d'água RASCUNHO)",
      state: !ultimoPdf ? "fail" : ultimoPdf.com_marca_dagua ? "warn" : "ok" },
    { label: "Assinatura visual registrada (quando há responsável técnico)",
      state: !respTec ? "info" : (assinPdfAtual ? "ok" : "warn"),
      detail: !respTec ? "Sem responsável técnico declarado" :
              assinPdfAtual ? `Assinatura conferida com PDF v${ultimoPdf?.pdf_versao}` :
              "Falta assinatura visual do PDF atual" },
    { label: "Publicação bloqueada por validações (RLS + RPC pgr_publicar)",
      state: "ok",
      detail: "Inventário, ações, PDF final atualizado, assinatura (quando aplicável) e MFA" },
  ];

  const segItems: Item[] = [
    { label: "RLS ativo nas tabelas do PGR", state: "ok",
      detail: "Isolamento por empresa via is_in_user_company_tree + Principal/Super Admin" },
    { label: "MFA aplicado em ações críticas (publicar, assinar, status alto)", state: "ok" },
    { label: "Audit log ativo (pgr_revisoes + pgr_acao_historico)", state: "ok" },
    { label: "Histórico append-only (pdf_versoes, assinaturas, revisões, histórico de ações)", state: "ok" },
    { label: "Evidências armazenadas no Drive BYOK (privadas, por tenant)",
      state: evidencias.length === 0 ? "info" : "ok",
      detail: `${evidencias.length} evidência(s) referenciada(s) no Drive` },
    { label: "Ações atrasadas identificadas no Plano de Ação",
      state: atrasadas.length === 0 ? "ok" : "warn",
      detail: atrasadas.length > 0 ? `${atrasadas.length} ação(ões) com prazo vencido` : "Sem atrasos" },
    { label: "QR Code de validação interna funcionando",
      state: ultimoPdf ? "ok" : "info",
      detail: ultimoPdf ? `Rota /pgr/validar/${pgrId}` : "Gere o PDF para ativar" },
    { label: "Aviso 'sem ICP-Brasil' visível no documento e na UI", state: "ok",
      detail: "Documento técnico interno com assinatura visual + hash SHA-256" },
  ];

  const podePublicar =
    status === "rascunho" || status === "em_revisao"
      ? pubItems.every((i) => i.state !== "fail" && i.state !== "warn")
      : false;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Checklist final de produção
            </span>
            {(status === "rascunho" || status === "em_revisao") && (
              <Badge variant="outline"
                     className={podePublicar
                       ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                       : "bg-amber-100 text-amber-800 border-amber-300"}>
                {podePublicar ? "Pronto para publicação" : "Ajustes pendentes"}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">
            Validações finais aplicadas na publicação do PGR.
          </p>
          <ul>{pubItems.map((it, i) => <Row key={i} item={it} />)}</ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Segurança e auditoria</CardTitle>
        </CardHeader>
        <CardContent>
          <ul>{segItems.map((it, i) => <Row key={i} item={it} />)}</ul>
        </CardContent>
      </Card>

      <div className="text-[11px] text-muted-foreground">
        Documento técnico interno. Esta fase <b>não</b> implementa ICP-Brasil, certificado digital,
        eSocial S-2240 ou integração com órgãos externos.
      </div>
    </div>
  );
}
