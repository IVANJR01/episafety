import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, XCircle, CheckCircle2, Stethoscope } from "lucide-react";
import { PGR_STATUS_LABEL, PGR_STATUS_COLOR, PgrStatus } from "@/lib/pgrTypes";

/*
 * Conferência do PCMSO pelo QR Code impresso no rodapé.
 *
 * O QR já era impresso em todo PCMSO e apontava para /pcmso/validar/<id> —
 * um endereço que NÃO EXISTIA no sistema. Quem lia o QR caía na tela de
 * "página não encontrada", e o código no rodapé não provava coisa nenhuma.
 *
 * Esta página é pública de propósito: quem confere é o fiscal ou o cliente
 * com o papel na mão, sem conta no sistema. Mostra só o que identifica o
 * documento — empresa, revisão, vigência, médico coordenador e o hash do
 * arquivo. O conteúdo do PCMSO (fichas de exame, riscos, colaboradores) é
 * dado de saúde e continua restrito.
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
  medico_nome?: string | null;
  medico_crm?: string | null;
  medico_uf?: string | null;
  pdf_hash?: string | null;
  pdf_gerado_em?: string | null;
}

export default function PcmsoValidar() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["pcmso-validar-publico", id],
    queryFn: async (): Promise<DadosPublicos> => {
      const { data, error } = await (supabase.rpc as any)("pcmso_validar_publico", {
        _pcmso_id: id,
      });
      if (error) throw error;
      return data as DadosPublicos;
    },
    enabled: !!id,
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
              Nenhum PCMSO corresponde a este código. Confira o endereço impresso no
              rodapé do documento ou leia o QR Code novamente.
            </p>
            <p className="text-muted-foreground">
              Um documento legítimo emitido pelo SafetySoluções sempre abre esta página
              com o nome da empresa e o médico coordenador.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = (data.status || "rascunho") as PgrStatus;
  const rascunho = status === "rascunho" || status === "em_revisao";
  const vigente = status === "vigente";
  const vencido = data.data_vigencia_fim
    ? new Date(`${data.data_vigencia_fim}T23:59:59`) < new Date()
    : false;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Shield className="h-5 w-5 text-primary" aria-hidden />
        <span className="font-semibold">SafetySoluções</span>
        <Badge variant="outline" className="text-xs">Conferência de documento</Badge>
      </div>

      {/* O veredito primeiro: é o que quem leu o QR quer saber. */}
      <Card className={vigente && !rascunho && !vencido ? "border-emerald-400" : "border-amber-400"}>
        <CardContent className="pt-5 flex items-start gap-3">
          {vigente && !rascunho && !vencido ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" aria-hidden />
          )}
          <div className="space-y-1">
            <p className="font-medium">
              {rascunho
                ? "Este documento é um RASCUNHO."
                : vencido
                  ? "A vigência deste PCMSO terminou."
                  : vigente
                    ? "Documento emitido pelo SafetySoluções."
                    : "Documento registrado, mas ainda não vigente."}
            </p>
            <p className="text-sm text-muted-foreground">
              {rascunho
                ? "Não substitui a versão final do PCMSO e não deve ser apresentado como documento emitido."
                : vencido
                  ? "O PCMSO tem validade de 12 meses (NR-07). Peça a revisão a quem emitiu."
                  : "Os dados abaixo são os que estão registrados no sistema para este documento."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-xl">
              PCMSO — Programa de Controle Médico de Saúde Ocupacional
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Stethoscope className="h-4 w-4" aria-hidden /> Médico coordenador
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Info label="Nome" value={data.medico_nome} />
          <Info
            label="Registro"
            value={data.medico_crm
              ? `CRM ${data.medico_crm}${data.medico_uf ? `/${data.medico_uf}` : ""}`
              : null}
          />
          {data.pdf_hash && (
            <>
              <div className="pt-1">
                <span className="text-xs text-muted-foreground">Hash SHA-256 do arquivo: </span>
                <span className="font-mono text-[11px] break-all">{data.pdf_hash}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Confira este código com o impresso no rodapé do documento em papel. Se os
                dois forem iguais, o arquivo não foi alterado depois de emitido.
              </p>
            </>
          )}
          {data.pdf_gerado_em && (
            <Info label="Arquivo gerado em" value={fmtDT(data.pdf_gerado_em)} />
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        Documento técnico emitido pelo SafetySoluções. Esta página mostra apenas os dados
        de identificação do documento; o conteúdo do PCMSO é restrito à empresa.
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
