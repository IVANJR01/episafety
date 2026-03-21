import { ChevronRight, Building2, GitBranch, FileText } from "lucide-react";

export interface BreadcrumbLevel {
  id: string;
  nome: string;
  type: "matriz" | "unidade" | "contrato";
}

interface StockBreadcrumbProps {
  levels: BreadcrumbLevel[];
  onNavigate: (index: number) => void;
}

const iconMap = {
  matriz: Building2,
  unidade: GitBranch,
  contrato: FileText,
};

export default function StockBreadcrumb({ levels, onNavigate }: StockBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm flex-wrap" aria-label="breadcrumb">
      {levels.map((level, i) => {
        const Icon = iconMap[level.type];
        const isLast = i === levels.length - 1;
        return (
          <span key={level.id} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
            <button
              onClick={() => onNavigate(i)}
              disabled={isLast}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
                isLast
                  ? "bg-primary/10 text-primary font-semibold cursor-default"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {level.nome}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
