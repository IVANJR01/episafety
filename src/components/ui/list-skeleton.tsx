import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ListSkeletonProps {
  rows?: number;
  className?: string;
  /** Se true, renderiza cards mobile-ready; se false, linhas para tabela */
  variant?: "card" | "row";
}

/**
 * Skeleton para listagens. Evita spinners genéricos e tela em branco.
 */
export function ListSkeleton({ rows = 4, className, variant = "card" }: ListSkeletonProps) {
  if (variant === "row") {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="w-16 h-8 rounded-md shrink-0" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Grid de cards de KPI (dashboard).
 */
export function KpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-7 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
