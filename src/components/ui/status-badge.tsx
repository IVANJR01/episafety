import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone =
  | "success"      // Verde — vigente, OK, solucionado
  | "warning"      // Amarelo/laranja claro — a vencer, baixo, pendente leve
  | "pending"      // Laranja — pendente
  | "danger"       // Vermelho — vencido, zerado, grave
  | "critical"     // Vermelho forte — risco crítico
  | "info"         // Azul — em andamento, informação
  | "neutral";     // Cinza — não aplicável, sem valor

const toneClasses: Record<StatusTone, string> = {
  success:
    "bg-success/10 text-success border border-success/30 hover:bg-success/15",
  warning:
    "bg-warning/10 text-warning border border-warning/40 hover:bg-warning/15",
  pending:
    "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15",
  danger:
    "bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/15",
  critical:
    "bg-destructive text-destructive-foreground border border-destructive hover:bg-destructive/90",
  info:
    "bg-info/10 text-info border border-info/30 hover:bg-info/15",
  neutral:
    "bg-muted text-muted-foreground border border-border hover:bg-muted/80",
};

interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  tone: StatusTone;
  children: React.ReactNode;
  size?: "sm" | "md";
}

/**
 * Badge de status unificado. Use tone para escolher a semântica:
 * success | warning | pending | danger | critical | info | neutral
 */
export function StatusBadge({ tone, children, size = "md", className, ...props }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium border-transparent",
        toneClasses[tone],
        size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5",
        className,
      )}
      {...props}
    >
      {children}
    </Badge>
  );
}
