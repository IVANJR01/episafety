import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, ChevronRight, Loader2, TriangleAlert } from "lucide-react";
import { calcularPendencias, resumirPendencias, Pendencia } from "@/lib/pgrPendencias";

/**
 * Carrega tudo que as regras de pendência precisam. Uma consulta por tabela,
 * compartilhada por chave de cache com o painel e o checklist de emissão.
 */
export function usePgrPendencias(pgrId?: string, respTecNome?: string | null) {
  const q = useQuery({
    queryKey: ["pgr-pendencias", pgrId],
    enabled: !!pgrId,
    queryFn: async () => {
      const pega = async (tabela: string) => {
        const { data, error } = await (supabase.from as any)(tabela)
          .select("*").eq("pgr_id", pgrId);
        return error ? [] : (data || []);
      };
      const [inventario, acoes, responsaveis, levantamento, eficacias] = await Promise.all([
        pega("pgr_inventario_itens"), pega("pgr_acoes"), pega("pgr_responsaveis"),
        pega("pgr_levantamento_preliminar"), pega("pgr_acao_eficacia"),
      ]);
      return { inventario, acoes, responsaveis, levantamento, eficacias };
    },
  });

  const pendencias = useMemo(
    () => (q.data ? calcularPendencias({ ...q.data, respTecNome }) : []),
    [q.data, respTecNome],
  );

  return { ...q, pendencias, resumo: resumirPendencias(pendencias) };
}

interface Props {
  pgrId: string;
  respTecNome?: string | null;
  /** Leva o usuário à etapa onde a pendência se resolve. */
  onIrParaEtapa?: (etapa: string) => void;
}

export default function PgrPendenciasPainel({ pgrId, respTecNome, onIrParaEtapa }: Props) {
  const { pendencias, resumo, isLoading } = usePgrPendencias(pgrId, respTecNome);

  const agrupadas = useMemo(() => {
    const m = new Map<string, Pendencia[]>();
    // Bloqueios primeiro: são eles que impedem emitir.
    [...pendencias]
      .sort((a, b) => (a.severidade === b.severidade ? 0 : a.severidade === "bloqueio" ? -1 : 1))
      .forEach((p) => {
        if (!m.has(p.categoria)) m.set(p.categoria, []);
        m.get(p.categoria)!.push(p);
      });
    return [...m.entries()];
  }, [pendencias]);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Verificando pendências…
      </div>
    );
  }

  if (pendencias.length === 0) {
    return (
      <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-5 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-emerald-900">Nenhuma pendência encontrada</p>
          <p className="text-sm text-emerald-800">
            Todos os riscos estão avaliados, as ações têm responsável e prazo, e há responsável
            técnico cadastrado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {resumo.bloqueios > 0 && (
          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
            {resumo.bloqueios} impedem emitir
          </Badge>
        )}
        {resumo.alertas > 0 && (
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
            {resumo.alertas} para revisar
          </Badge>
        )}
      </div>

      {resumo.bloqueios > 0 && (
        <p className="text-sm text-muted-foreground">
          Itens em vermelho impedem a emissão. Os demais ficam a critério do responsável técnico.
        </p>
      )}

      {agrupadas.map(([categoria, itens]) => (
        <section key={categoria} className="space-y-1.5">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {categoria} · {itens.length}
          </h3>
          <ul className="space-y-1.5">
            {itens.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => onIrParaEtapa?.(p.etapa)}
                  disabled={!onIrParaEtapa}
                  className={`w-full text-left border rounded-lg p-3 flex items-start gap-3 ${
                    onIrParaEtapa ? "hover:border-primary/50 transition" : "cursor-default"
                  } ${p.severidade === "bloqueio" ? "border-red-200 bg-red-50/50" : ""}`}
                >
                  {p.severidade === "bloqueio"
                    ? <TriangleAlert className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    : <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{p.titulo}</span>
                    {p.referencia && (
                      <span className="block text-xs text-muted-foreground">{p.referencia}</span>
                    )}
                  </span>
                  {onIrParaEtapa && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
