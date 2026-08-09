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
      {/* `min-w-0` deixa a caixa encolher abaixo do texto quando as ações
          disputam a linha; sem `break-words` o título transborda em vez de
          quebrar, e o que passa do limite some cortado. */}
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground break-words">{title}</h1>
        {subtitle && (
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5 break-words">{subtitle}</p>
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
