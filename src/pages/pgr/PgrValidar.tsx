import { useEffect } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, FileText, ArrowRight, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PGR_STATUS_LABEL, PGR_STATUS_COLOR, PgrStatus } from "@/lib/pgrTypes";

export default function PgrValidar() {
  const { id } = useParams<{ id: string }>();
  const [sp] = useSearchParams();
  const versaoQs = sp.get("v") ? Number(sp.get("v")) : null;
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["pgr-validar", id, versaoQs],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("pgr_validar_interno", {
        _pgr_id: id, _pdf_versao: versaoQs ?? null,
      });
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (!isLoading && !data && error) {
      toast.error("PGR não encontrado ou fora do seu escopo.");
      navigate("/pgr");
    }
  }, [data, isLoading, error, navigate]);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Validando…</div>;
  if (!data) return null;

  const status = data.status as PgrStatus;
  const pdf = data.pdf;
  const desatualizado = !!data.pdf_desatualizado;
  const versaoDivergente = versaoQs != null && pdf && pdf.pdf_versao !== versaoQs;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <Badge variant="outline" className="text-xs">Validação interna</Badge>
        <span className="text-xs text-muted-foreground ml-auto">Acesso restrito à empresa do PGR</span>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-xl">PGR v{data.versao}</CardTitle>
            <Badge className={PGR_STATUS_COLOR[status]} variant="outline">{PGR_STATUS_LABEL[status]}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {desatualizado && (
            <div className="rounded-md p-3 text-sm flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              PDF desatualizado — o PGR foi alterado após esta versão. Regenere o PDF.
            </div>
          )}
          {versaoDivergente && (
            <div className="rounded-md p-3 text-sm flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 dark:bg-red-950/30 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              QR aberto para PDF v{versaoQs}, mas a última versão é v{pdf?.pdf_versao}.
            </div>
          )}
          {pdf?.com_marca_dagua && (
            <div className="rounded-md p-3 text-sm bg-zinc-50 border border-zinc-200 text-zinc-700">
              Este PDF está marcado como <b>RASCUNHO / EM REVISÃO</b> — não substitui a versão final.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Info label="Empresa" value={data.empresa_nome} />
            <Info label="Unidade" value={data.unidade_nome || "Matriz"} />
            <Info label="Vigência" value={`${fmt(data.data_vigencia_inicio)} – ${fmt(data.data_vigencia_fim)}`} />
            <Info label="Responsável Técnico" value={data.resp_tec_nome} />
            <Info label="Registro" value={data.resp_tec_registro} />
            <Info label="Conteúdo atualizado em" value={fmtDT(data.conteudo_atualizado_em)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> PDF
            {pdf ? <Badge variant="outline">v{pdf.pdf_versao}</Badge> : <Badge variant="secondary">Não gerado</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Info label="Versão do PDF" value={pdf ? `v${pdf.pdf_versao}` : "—"} />
          <Info label="Gerado em" value={pdf ? fmtDT(pdf.gerado_em) : "—"} />
          <Info label="Status no momento" value={pdf ? PGR_STATUS_LABEL[pdf.status_no_momento as PgrStatus] : "—"} />
          <div>
            <span className="text-xs text-muted-foreground">Hash SHA-256: </span>
            <span className="font-mono text-[11px] break-all">{pdf?.pdf_hash || "—"}</span>
          </div>
          {pdf?.drive_view_link && (
            <Button asChild variant="outline" size="sm">
              <a href={pdf.drive_view_link} target="_blank" rel="noreferrer">
                Abrir no Drive <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          )}
          <p className="text-[11px] text-muted-foreground pt-2">
            Documento técnico interno. Assinatura ICP-Brasil não implementada nesta fase.
            Compare o hash acima com o impresso no rodapé do PDF para validar integridade.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-between flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to={`/pgr/${id}`}>Ir para o PGR completo <ArrowRight className="h-4 w-4 ml-1" /></Link>
        </Button>
      </div>
    </div>
  );
}

const fmt = (s?: string | null) => s ? new Date(s + (s.length <= 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR") : "—";
const fmtDT = (s?: string | null) => s ? new Date(s).toLocaleString("pt-BR") : "—";

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="text-sm">
      <span className="text-xs text-muted-foreground">{label}: </span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}
