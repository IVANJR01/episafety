import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, ArrowRight, Loader2, Minus, Plus, TrendingDown, TrendingUp,
} from "lucide-react";
import { compararVersoes, MudancaRisco, rotuloClasse, TipoMudanca } from "@/lib/pgrDiff";
import { CLASSE_TEXT } from "@/lib/pgrMatriz";
import { PGR_STATUS_LABEL, PgrStatus } from "@/lib/pgrTypes";
import { useNucleoMestreSst } from "@/hooks/useNucleoMestreSst";

const COR_TIPO: Record<TipoMudanca, string> = {
  incluido: "bg-emerald-100 text-emerald-800 border-emerald-300",
  removido: "bg-red-100 text-red-800 border-red-300",
  alterado: "bg-amber-100 text-amber-800 border-amber-300",
  igual: "bg-slate-100 text-slate-600 border-slate-300",
};

const ROTULO_TIPO: Record<TipoMudanca, string> = {
  incluido: "Incluído", removido: "Removido", alterado: "Alterado", igual: "Sem mudança",
};

/** Compara duas versões do PGR da mesma unidade. */
export default function PgrComparar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [mostrarIguais, setMostrarIguais] = useState(false);
  const { gesList, setores, funcoes } = useNucleoMestreSst();

  const { data: atual } = useQuery({
    queryKey: ["pgr-detalhe", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_documentos")
        .select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  /** Demais versões da MESMA unidade — comparar unidades distintas não diz nada. */
  const { data: irmaos = [] } = useQuery({
    queryKey: ["pgr-irmaos", atual?.empresa_id, atual?.unidade_id],
    enabled: !!atual,
    queryFn: async () => {
      let q = (supabase.from as any)("pgr_documentos")
        .select("id,versao,status,data_emissao,created_at")
        .eq("empresa_id", atual.empresa_id);
      q = atual.unidade_id
        ? q.eq("unidade_id", atual.unidade_id)
        : q.is("unidade_id", null);
      const { data } = await q.order("versao", { ascending: false });
      return ((data || []) as any[]).filter((d) => d.id !== id);
    },
  });

  const baseId = params.get("base") || irmaos[0]?.id || "";

  const carregar = async (pgrId: string) => {
    const pega = async (t: string) => {
      const { data } = await (supabase.from as any)(t).select("*").eq("pgr_id", pgrId);
      return (data || []) as any[];
    };
    const [inventario, acoes] = await Promise.all([
      pega("pgr_inventario_itens"), pega("pgr_acoes"),
    ]);
    return { inventario, acoes };
  };

  const { data: dadosAtual, isLoading: l1 } = useQuery({
    queryKey: ["pgr-cmp", id], enabled: !!id, queryFn: () => carregar(id!),
  });
  const { data: dadosBase, isLoading: l2 } = useQuery({
    queryKey: ["pgr-cmp", baseId], enabled: !!baseId, queryFn: () => carregar(baseId),
  });

  const nomes = useMemo(() => ({
    ges: Object.fromEntries(gesList.map((g: any) => [g.id, g.nome])),
    setores: Object.fromEntries(setores.map((s: any) => [s.id, s.nome])),
    funcoes: Object.fromEntries(funcoes.map((f: any) => [f.id, f.nome])),
  }), [gesList, setores, funcoes]);

  const diff = useMemo(
    () => (dadosBase && dadosAtual ? compararVersoes(dadosBase, dadosAtual, nomes) : null),
    [dadosBase, dadosAtual, nomes],
  );

  const versaoBase = irmaos.find((x: any) => x.id === baseId);

  const riscosVisiveis = useMemo(() => {
    if (!diff) return [];
    const ordem: TipoMudanca[] = ["removido", "alterado", "incluido", "igual"];
    return diff.riscos
      .filter((r) => mostrarIguais || r.tipo !== "igual")
      .sort((a, b) => ordem.indexOf(a.tipo) - ordem.indexOf(b.tipo));
  }, [diff, mostrarIguais]);

  if (!atual) {
    return (
      <div className="p-12 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
      </div>
    );
  }

  return (
    <div className="pgr-module min-h-screen bg-muted/40">
      <header className="sticky top-0 z-20 bg-background border-b px-3 sm:px-5 h-16 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/pgr/${id}`)} className="shrink-0">
          <ArrowLeft className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Assistente</span>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold truncate">Comparar versões</h1>
          <p className="text-xs text-muted-foreground">
            O que mudou entre duas versões deste PGR.
          </p>
        </div>
      </header>

      <div className="p-3 sm:p-5 max-w-[1200px] mx-auto space-y-5">
        {irmaos.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            Este é o único PGR desta unidade. A comparação aparece quando existir uma
            segunda versão — ela é criada ao abrir uma revisão do documento vigente.
          </CardContent></Card>
        ) : (
          <>
            <Card><CardContent className="p-4 flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="flex-1 space-y-1.5">
                <label className="text-xs text-muted-foreground">Versão base (anterior)</label>
                <Select
                  value={baseId}
                  onValueChange={(v) => { const p = new URLSearchParams(params); p.set("base", v); setParams(p); }}
                >
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {irmaos.map((v: any) => (
                      <SelectItem key={v.id} value={v.id}>
                        v{v.versao} — {PGR_STATUS_LABEL[v.status as PgrStatus] || v.status}
                        {v.data_emissao ? ` · ${v.data_emissao.split("-").reverse().join("/")}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground hidden sm:block mb-3 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <label className="text-xs text-muted-foreground">Versão comparada (esta)</label>
                <div className="h-11 flex items-center gap-2 border rounded-md px-3 bg-muted/40">
                  <span className="font-medium">v{atual.versao}</span>
                  <Badge variant="outline" className="text-[11px]">
                    {PGR_STATUS_LABEL[atual.status as PgrStatus] || atual.status}
                  </Badge>
                </div>
              </div>
            </CardContent></Card>

            {l1 || l2 ? (
              <div className="p-10 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Comparando…
              </div>
            ) : diff && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Resumo icone={Plus} cor="text-emerald-600 bg-emerald-50"
                    rotulo="Riscos incluídos" valor={diff.resumo.riscosIncluidos} />
                  <Resumo icone={Minus} cor="text-red-600 bg-red-50"
                    rotulo="Riscos removidos" valor={diff.resumo.riscosRemovidos} />
                  <Resumo icone={TrendingUp} cor="text-amber-600 bg-amber-50"
                    rotulo="Agravados" valor={diff.resumo.agravados} />
                  <Resumo icone={TrendingDown} cor="text-sky-600 bg-sky-50"
                    rotulo="Atenuados" valor={diff.resumo.atenuados} />
                </div>

                <p className="text-sm text-muted-foreground">
                  O pareamento tenta o contexto completo primeiro e afrouxa para perigo + GES e
                  depois só o perigo — assim uma versão antiga, sem setor e função preenchidos,
                  não faz todo risco parecer removido e reincluído. Renomear um perigo continua
                  aparecendo como remoção seguida de inclusão: um risco que sumiu da lista precisa
                  saltar aos olhos, mesmo ao custo de um falso positivo.
                </p>

                <section className="space-y-2">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h2 className="font-semibold">
                      Riscos · v{versaoBase?.versao} → v{atual.versao}
                    </h2>
                    <Button variant="outline" size="sm" onClick={() => setMostrarIguais((m) => !m)}>
                      {mostrarIguais ? "Ocultar sem mudança" : "Mostrar sem mudança"}
                    </Button>
                  </div>
                  {riscosVisiveis.length === 0 ? (
                    <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
                      Nenhuma diferença nos riscos entre as duas versões.
                    </CardContent></Card>
                  ) : riscosVisiveis.map((r) => <LinhaRisco key={r.chave} r={r} />)}
                </section>

                <section className="space-y-2">
                  <h2 className="font-semibold">Ações</h2>
                  {diff.acoes.filter((a) => a.tipo !== "igual").length === 0 ? (
                    <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
                      Nenhuma diferença no plano de ação.
                    </CardContent></Card>
                  ) : diff.acoes.filter((a) => a.tipo !== "igual").map((a) => (
                    <Card key={a.chave}><CardContent className="p-3">
                      <div className="flex items-start gap-2 flex-wrap">
                        <Badge variant="outline" className={`${COR_TIPO[a.tipo]} shrink-0 text-[11px]`}>
                          {ROTULO_TIPO[a.tipo]}
                        </Badge>
                        <span className="font-medium text-sm min-w-0">{a.descricao}</span>
                      </div>
                      {a.tipo === "alterado" && a.antes && a.depois && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {a.antes.status} → {a.depois.status}
                          {a.antes.prazo !== a.depois.prazo &&
                            ` · prazo ${a.antes.prazo || "—"} → ${a.depois.prazo || "—"}`}
                          {a.antes.responsavel !== a.depois.responsavel &&
                            ` · responsável ${a.antes.responsavel || "—"} → ${a.depois.responsavel || "—"}`}
                        </p>
                      )}
                    </CardContent></Card>
                  ))}
                </section>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Resumo({ icone: Icone, cor, rotulo, valor }: any) {
  return (
    <Card><CardContent className="p-3 flex items-center gap-3">
      <span className={`h-10 w-10 rounded-full grid place-items-center shrink-0 ${cor}`}>
        <Icone className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">{rotulo}</span>
        <span className="block text-2xl font-bold leading-none">{valor}</span>
      </span>
    </CardContent></Card>
  );
}

function LinhaRisco({ r }: { r: MudancaRisco }) {
  return (
    <Card>
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-start gap-2 flex-wrap">
          <Badge variant="outline" className={`${COR_TIPO[r.tipo]} shrink-0 text-[11px]`}>
            {ROTULO_TIPO[r.tipo]}
          </Badge>
          <span className="font-medium text-sm min-w-0">{r.perigo}</span>
          <span className="text-xs text-muted-foreground">{r.contexto}</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          {r.antes && (
            <span className={`rounded px-2 py-0.5 border ${r.antes.classe ? CLASSE_TEXT[r.antes.classe] : ""}`}>
              {rotuloClasse(r.antes.classe)}
              {r.antes.sev != null && ` (${r.antes.sev}×${r.antes.prob})`}
            </span>
          )}
          {r.antes && r.depois && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
          {r.depois && (
            <span className={`rounded px-2 py-0.5 border ${r.depois.classe ? CLASSE_TEXT[r.depois.classe] : ""}`}>
              {rotuloClasse(r.depois.classe)}
              {r.depois.sev != null && ` (${r.depois.sev}×${r.depois.prob})`}
            </span>
          )}
        </div>

        {r.camposAlterados.length > 0 && (
          <ul className="text-xs text-muted-foreground space-y-0.5 pt-1">
            {r.camposAlterados.map((c) => (
              <li key={c.campo}>
                <b>{c.campo}:</b> {c.antes} → {c.depois}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
