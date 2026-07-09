import { cn } from "@/lib/utils";
import { OrcamentoStatus, STATUS_LABEL, STATUS_COLOR, isVencido } from "@/lib/orcamentoTypes";

interface Props {
  status: OrcamentoStatus;
  validade?: string | null;
  className?: string;
}

export function StatusBadgeOrcamento({ status, validade, className }: Props) {
  const effective: OrcamentoStatus = isVencido(status, validade ?? null) ? "vencido" : status;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        STATUS_COLOR[effective],
        className,
      )}
    >
      {STATUS_LABEL[effective]}
    </span>
  );
}
