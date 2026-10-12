import { useParams, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield, AlertTriangle, FileText, ArrowRight, ExternalLink, XCircle, CheckCircle2,
} from "lucide-react";
import { PGR_STATUS_LABEL, PGR_STATUS_COLOR, PgrStatus } from "@/lib/pgrTypes";

/*
 * Conferência do PGR pelo QR Code impresso no rodapé.
 *
 * Esta página é PÚBLICA de propósito. Ela existia, mas atrás do login: o
 * fiscal que lia o QR com o papel na mão caía na tela de senha, e o QR não
 * provava coisa nenhuma — que é a única razão de ele estar no documento.
 *
 * O que ela mostra sem login é só o que prova autenticidade: empresa, revisão,
 * datas, responsável técnico e os dados do PDF (versão, quando foi gerado e o
 * hash para conferir com o rodapé impresso). O conteúdo do PGR — inventário,
 * plano de ação, riscos da empresa — continua exigindo login.
 *
 * Para quem ESTÁ logado e enxerga a empresa, a página busca também os dados
 * internos (link do arquivo no Drive e situação do conteúdo) e mostra o
 * caminho para o PGR completo. É a mesma URL para os dois casos: o QR impresso
 * não muda conforme quem lê.
 */

interface DadosPublicos {
  encontrado: boolean;
  empresa_nome?: string | null;
  unidade_nome?: string | null;
  versao?: number;
  status?: PgrStatus;
  data_emissao?: string | null;
  data_vigencia_inicio?: string | null;
  data_vigencia_fim?: string | null;
  resp_tec_nome?: string | null;
  resp_tec_registro?: string | null;
  pdf?: {
    pdf_versao: number;
    pdf_hash: string | null;
    gerado_em: string | null;
    com_marca_dagua: boolean | null;
    status_no_momento: string | null;
  } | null;
  versao_pedida?: number | null;
  ultima_pdf_versao?: number | null;
  eh_ultima_pdf?: boolean;
}

export default function PgrValidar() {
  const { id } = useParams<{ id: string }>();
  const [sp] = useSearchParams();
  const versaoQs = sp.get("v") ? Number(sp.get("v")) : null;

  const { data, isLoading, error } = useQuery({
    queryKey: ["pgr-validar-publico", id, versaoQs],
    queryFn: async (): Promise<DadosPublicos> => {
      const { data, error } = await (supabase.rpc as any)("pgr_validar_publico", {
        _pgr_id: id, _pdf_versao: versaoQs ?? null,
      });
      if (error) throw error;
      return data as DadosPublicos;
    },
    enabled: !!id,
  });

  /*
   * Dados internos, só para quem já está logado e enxerga a empresa. A
   * consulta falha de propósito para quem não tem acesso, e a falha não é
   * mostrada: a página pública não muda por causa dela.
   */
  const { data: interno } = useQuery({
    queryKey: ["pgr-validar-interno", id, versaoQs],
    queryFn: async () => {
      const { data: sessao } = await supabase.auth.getSession();
      if (!sessao?.session) return null;
      const { data, error } = await (supabase.rpc as any)("pgr_validar_interno", {
        _pgr_id: id, _pdf_versao: versaoQs ?? null,
      });
      if (error) return null;
      return data as any;
    },
    enabled: !!id,
    retry: false,
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Conferindo o documento…</div>;
  }

  if (error || !data || !data.encontrado) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <Card className="border-red-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <XCircle className="h-5 w-5" aria-hidden /> Documento não encontrado
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>
              Nenhum PGR corresponde a este código. Confira o endereço impresso no rodapé
              do documento ou leia o QR Code novamente.
            </p>
            <p className="text-muted-foreground">
              Um documento legítimo emitido pelo SafetySoluções sempre abre esta página com
              o nome da empresa e o responsável técnico.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = (data.status || "rascunho") as PgrStatus;
  const pdf = data.pdf;
  const rascunho = !!pdf?.com_marca_dagua || status === "rascunho" || status === "em_revisao";
  /*
   * O papel em mãos não é a última versão emitida.
   *
   * Comparar com a versão PEDIDA no QR não basta: o QR pede a v2, a v2 está
   * registrada e bate — e mesmo assim já existe a v5. Quem confere precisa
   * saber que o documento na mão foi substituído, que é a dúvida que leva
   * alguém a ler um QR.
   */
  const desatualizado = pdf != null && data.ultima_pdf_versao != null
    && pdf.pdf_versao !== data.ultima_pdf_versao;
  /* O QR pede uma versão que não está registrada: outro caso, outro aviso. */
  const versaoNaoRegistrada = versaoQs != null && pdf == null && data.ultima_pdf_versao != null;
  const vigente = status === "vigente";

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Shield className="h-5 w-5 text-primary" aria-hidden />
        <span className="font-semibold">SafetySoluções</span>
        <Badge variant="outline" className="text-xs">Conferência de documento</Badge>
      </div>

      {/* O veredito vem primeiro: é o que quem leu o QR quer saber. */}
      <Card className={vigente && !rascunho ? "border-emerald-400" : "border-amber-400"}>
        <CardContent className="pt-5 flex items-start gap-3">
          {vigente && !rascunho ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" aria-hidden />
          )}
          <div className="space-y-1">
            <p className="font-medium">
              {vigente && !rascunho
                ? "Documento emitido pelo SafetySoluções."
                : rascunho
                  ? "Este documento é um RASCUNHO."
                  : "Documento registrado, mas ainda não vigente."}
            </p>
            <p className="text-sm text-muted-foreground">
              {rascunho
                ? "Não substitui a versão final do PGR e não deve ser apresentado como documento emitido."
                : vigente
                  ? "Os dados abaixo são os que estão registrados no sistema para este documento."
                  : `Situação registrada: ${PGR_STATUS_LABEL[status]}.`}
            </p>
          </div>
        </CardContent>
      </Card>

      {desatualizado && (
        <div className="rounded-md p-3 text-sm flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <span>
            O documento em mãos é o PDF v{pdf?.pdf_versao}, e a versão mais recente deste
            PGR é a v{data.ultima_pdf_versao}. Peça a versão atualizada a quem emitiu.
          </span>
        </div>
      )}
      {versaoNaoRegistrada && (
        <div className="rounded-md p-3 text-sm flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <span>
            A versão v{versaoQs} do PDF não está registrada neste PGR. A versão mais
            recente é a v{data.ultima_pdf_versao}.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-xl">
              PGR — Programa de Gerenciamento de Riscos
            </CardTitle>
            <Badge className={PGR_STATUS_COLOR[status]} variant="outline">
              {PGR_STATUS_LABEL[status]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <Info label="Empresa" value={data.empresa_nome} />
          <Info label="Unidade" value={data.unidade_nome || "Matriz"} />
          <Info label="Revisão" value={data.versao != null ? `v${data.versao}` : null} />
          <Info label="Data de emissão" value={fmt(data.data_emissao)} />
          <Info
            label="Vigência"
            value={data.data_vigencia_inicio || data.data_vigencia_fim
              ? `${fmt(data.data_vigencia_inicio)} a ${fmt(data.data_vigencia_fim)}`
              : null}
          />
          <Info label="Responsável técnico" value={data.resp_tec_nome} />
          <Info label="Registro profissional" value={data.resp_tec_registro} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" aria-hidden /> Arquivo PDF
            {pdf
              ? <Badge variant="outline">v{pdf.pdf_versao}</Badge>
              : <Badge variant="secondary">Nenhum PDF registrado</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {pdf ? (
            <>
              <Info label="Gerado em" value={fmtDT(pdf.gerado_em)} />
              <div>
                <span className="text-xs text-muted-foreground">Hash SHA-256: </span>
                <span className="font-mono text-[11px] break-all">{pdf.pdf_hash || "—"}</span>
              </div>
              <p className="text-[11px] text-muted-foreground pt-1">
                Confira este código com o impresso no rodapé do documento em papel. Se os
                dois forem iguais, o arquivo não foi alterado depois de emitido.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">
              Nenhum arquivo PDF foi registrado para este PGR até agora.
            </p>
          )}

          {/* Daqui para baixo, só para quem está logado e enxerga a empresa. */}
          {interno?.pdf?.drive_view_link && (
            <Button asChild variant="outline" size="sm">
              <a href={interno.pdf.drive_view_link} target="_blank" rel="noreferrer">
                Abrir arquivo <ExternalLink className="h-3 w-3 ml-1" aria-hidden />
              </a>
            </Button>
          )}
          {interno?.pdf_desatualizado && (
            <div className="rounded-md p-3 text-sm flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              O PGR foi alterado depois deste PDF. Gere o documento de novo.
            </div>
          )}
        </CardContent>
      </Card>

      {interno && (
        <Button asChild variant="outline">
          <Link to={`/pgr/${id}`}>
            Ir para o PGR completo <ArrowRight className="h-4 w-4 ml-1" aria-hidden />
          </Link>
        </Button>
      )}

      <p className="text-[11px] text-muted-foreground">
        Documento técnico emitido pelo SafetySoluções. Esta página mostra apenas os dados de
        identificação do documento; o conteúdo do PGR é restrito à empresa.
      </p>
    </div>
  );
}

const fmt = (s?: string | null) =>
  s ? new Date(s + (s.length <= 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR") : "—";
const fmtDT = (s?: string | null) => s ? new Date(s).toLocaleString("pt-BR") : "—";

function Info({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="text-sm">
      <span className="text-xs text-muted-foreground">{label}: </span>
      <span className="font-medium">{(value as string) || "—"}</span>
    </div>
  );
}
