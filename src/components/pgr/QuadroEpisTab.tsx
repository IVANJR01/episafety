import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { nomesUnicos } from "@/lib/sstEstrutura";

interface Props { pgrId: string; empresaId: string; }

interface Linha {
  ghe_codigo: string;
  ghe_nome: string;
  funcao: string;
  epis: string;
}

export default function QuadroEpisTab({ pgrId, empresaId }: Props) {
  const { data: linhas = [], isLoading } = useQuery({
    queryKey: ["pgr-quadro-epis", pgrId],
    queryFn: async () => {
      const { data: itens } = await (supabase.from as any)("pgr_inventario_itens")
        .select("ghe_id")
        .eq("pgr_id", pgrId).not("ghe_id", "is", null);
      const gheIds = Array.from(new Set((itens || []).map((i: any) => i.ghe_id)));
      if (gheIds.length === 0) return [] as Linha[];

      const [ghesRes, funcRes, riscosRes] = await Promise.all([
        (supabase.from as any)("ghe_ges").select("id, codigo, nome").in("id", gheIds),
        (supabase.from as any)("ghe_funcoes").select("ghe_id, nome_funcao").in("ghe_id", gheIds),
        (supabase.from as any)("ghe_riscos").select("ghe_id, epis_recomendados").in("ghe_id", gheIds),
      ]);
      const ghes = ghesRes.data || [];
      const funcs = funcRes.data || [];
      const riscos = riscosRes.data || [];

      const funcoesPorGhe = new Map<string, string[]>();
      funcs.forEach((f: any) => {
        if (!funcoesPorGhe.has(f.ghe_id)) funcoesPorGhe.set(f.ghe_id, []);
        funcoesPorGhe.get(f.ghe_id)!.push(f.nome_funcao);
      });

      const episPorGhe = new Map<string, Set<string>>();
      riscos.forEach((r: any) => {
        const lista: string[] = Array.isArray(r.epis_recomendados) ? r.epis_recomendados : [];
        if (!episPorGhe.has(r.ghe_id)) episPorGhe.set(r.ghe_id, new Set());
        lista.forEach((e) => episPorGhe.get(r.ghe_id)!.add(String(e)));
      });

      const result: Linha[] = [];
      ghes.forEach((g: any) => {
        // Sem repetir nome: o vínculo do grupo traz uma linha por cópia da
        // função no cadastro (ver `nomesUnicos`).
        const funcoes = nomesUnicos(funcoesPorGhe.get(g.id));
        const epis = Array.from(episPorGhe.get(g.id) || []);
        const funcoesStr = funcoes.length ? funcoes.join(", ") : "—";
        result.push({
          ghe_codigo: g.codigo || "—",
          ghe_nome: g.nome || "—",
          funcao: funcoesStr,
          epis: epis.length ? epis.join(", ") : "—",
        });
      });
      return result;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" /> Quadro Sinóptico de Utilização de EPIs
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando…</p>
        ) : linhas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Sem dados. Importe GES no Inventário para gerar o quadro sinóptico automaticamente.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left border">GES</th>
                  <th className="p-2 text-left border">Função</th>
                  <th className="p-2 text-left border">EPIs indicados (CA)</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2 border align-top">
                      <div className="font-semibold">{l.ghe_codigo}</div>
                      <div className="text-muted-foreground">{l.ghe_nome}</div>
                    </td>
                    <td className="p-2 border">{l.funcao}</td>
                    <td className="p-2 border">{l.epis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
