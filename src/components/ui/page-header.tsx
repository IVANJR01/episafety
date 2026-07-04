import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Cabeçalho padrão de página do SafetySoluções.
 * - Título e subtítulo alinhados à esquerda
 * - Ações à direita no desktop, largura total no mobile
 * - Espaçamento vertical consistente
 */
export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
          {actions}
        </div>
      )}
    </div>
  );
}
