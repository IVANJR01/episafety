import * as React from "react";
import { LucideIcon, Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** Renderiza sem o wrapper de Card (para uso dentro de outro card) */
  bare?: boolean;
}

/**
 * Empty state padrão. Ícone, título, descrição e (opcional) ação.
 * Uso: <EmptyState icon={Package} title="Nenhum EPI cadastrado" description="..." action={<Button>...</Button>} />
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  bare = false,
}: EmptyStateProps) {
  const content = (
    <div className={cn("flex flex-col items-center justify-center text-center py-10 px-4", className)}>
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
        <Icon className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-sm sm:text-base text-foreground">{title}</h3>
      {description && (
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );

  if (bare) return content;
  return (
    <Card>
      <CardContent className="p-0">{content}</CardContent>
    </Card>
  );
}
