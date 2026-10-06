/*
 * Histórico de revisões do PGR.
 *
 * Veio da tela clássica em abas, que foi removida: era a única coisa dela que
 * não existia no assistente. A NR-01 pede o histórico das atualizações do
 * inventário (item 1.5.7.3.3.1, por 20 anos), então ele não podia sumir junto
 * com a tela.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

interface Revisao {
  id: string;
  acao: string;
  versao_anterior: number | null;
  versao_nova: number | null;
  motivo: string | null;
  user_email: string | null;
  created_at: string;
}

const ROTULO_ACAO: Record<string, string> = {
  abrir_revisao: "Abertura de revisão",
  publicar: "Publicação",
};

export default function HistoricoRevisoes({ pgrId }: { pgrId: string }) {
  const { data: revisoes = [], isLoading } = useQuery({
    queryKey: ["pgr-revisoes", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_revisoes")
        .select("*").eq("pgr_id", pgrId).order("created_at", { ascending: false });
      return (data || []) as Revisao[];
    },
    enabled: !!pgrId,
  });

  if (isLoading) {
    return <p className="py-4 text-sm text-muted-foreground">Carregando…</p>;
  }

  if (revisoes.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Nenhuma revisão registrada. A primeira entra quando este PGR for publicado.
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-2">
      {revisoes.map((r) => (
        <li key={r.id} className="rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium">
              {ROTULO_ACAO[r.acao] || r.acao}
              {r.versao_anterior != null && r.versao_nova != null && (
                <span className="text-muted-foreground">
                  {" "}· v{r.versao_anterior} para v{r.versao_nova}
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(r.created_at).toLocaleString("pt-BR")}
            </span>
          </div>
          {r.motivo && <p className="mt-1 text-xs text-muted-foreground">{r.motivo}</p>}
          {r.user_email && <p className="mt-1 text-[11px] text-muted-foreground">por {r.user_email}</p>}
        </li>
      ))}
    </ul>
  );
}
