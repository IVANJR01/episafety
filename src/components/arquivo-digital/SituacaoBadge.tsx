import {
  AlertCircle, CheckCircle2, Clock, XCircle, RefreshCw, History, Archive, MinusCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ROTULO_SITUACAO, COR_SITUACAO, type SituacaoDocumento } from "@/lib/arquivoDigital";

const ICONES = {
  AlertCircle, CheckCircle2, Clock, XCircle, RefreshCw, History, Archive, MinusCircle,
} as const;

const ICONE_POR_SITUACAO: Record<SituacaoDocumento, keyof typeof ICONES> = {
  nao_enviado: "AlertCircle",
  vigente: "CheckCircle2",
  vence_em_breve: "Clock",
  vencido: "XCircle",
  em_renovacao: "RefreshCw",
  substituido: "History",
  arquivado: "Archive",
  nao_aplicavel: "MinusCircle",
};

/**
 * Tarja de situação do Arquivo Digital.
 *
 * Sempre cor + texto + ícone, nunca cor sozinha: quem não distingue
 * vermelho de verde veria duas tarjas idênticas, e aqui isso é a
 * diferença entre "em dia" e "irregular".
 */
export default function SituacaoBadge({
  situacao, className,
}: { situacao: SituacaoDocumento; className?: string }) {
  const Icone = ICONES[ICONE_POR_SITUACAO[situacao]];
  return (
    <Badge className={cn(COR_SITUACAO[situacao], "border gap-1 font-medium whitespace-nowrap", className)}>
      <Icone className="w-3 h-3 shrink-0" aria-hidden="true" />
      {ROTULO_SITUACAO[situacao]}
    </Badge>
  );
}
