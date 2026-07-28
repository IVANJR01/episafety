import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft, Briefcase, Building2, ChevronDown, ChevronRight, ClipboardList,
  Home, LayoutGrid, Loader2, Search, ShieldCheck, Workflow,
} from "lucide-react";
import { useNucleoMestreSst } from "@/hooks/useNucleoMestreSst";
import { GRUPO_LABEL, classificarRisco, CLASSE_LABEL, CLASSE_TEXT } from "@/lib/pgrMatriz";

type NoTipo = "empresa" | "ambiente" | "processo" | "setor" | "ges" | "funcao" | "atividade";

interface NoSelecionado {
  tipo: NoTipo;
  id: string | null;
  nome: string;
}

const ICONE: Record<NoTipo, any> = {
  empresa: Building2,
  ambiente: Home,
  processo: Workflow,
  setor: LayoutGrid,
  ges: ShieldCheck,
  funcao: Briefcase,
  atividade: ClipboardList,
};

/**
 * Modo 2 — Estrutura técnica.
 *
 * Árvore de navegação à esquerda, dados do nó selecionado ao centro. A árvore
 * organiza a leitura, mas NÃO define os vínculos: um GES aparece sob o setor em
 * que tem vínculo e continua acessível de qualquer outro ponto. Colapsar a
 * hierarquia em uma árvore rígida obrigaria cada GES a ter exatamente um setor,
 * que é o erro conceitual que a NR-01 justamente evita.
 */
export default function PgrEstruturaTecnica() {
  const { id: pgrId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    ambientes, processos, setores, funcoes, atividades, gesList, gesVinculos, isLoading,
  } = useNucleoMestreSst();

  const [aberto, setAberto] = useState<Record<string, boolean>>({ raiz: true });
  const [sel, setSel] = useState<NoSelecionado>({ tipo: "empresa", id: null, nome: "Empresa" });
  const [busca, setBusca] = useState("");

  const { data: pgr } = useQuery({
    queryKey: ["pgr-detalhe", pgrId],
    enabled: !!pgrId,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_documentos")
        .select("*").eq("id", pgrId).maybeSingle();
      return data;
    },
  });

  const { data: inventario = [] } = useQuery({
    queryKey: ["pgr-estrutura-inventario", pgrId],
    enabled: !!pgrId,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_inventario_itens")
        .select("*").eq("pgr_id", pgrId);
      return (data || []) as any[];
    },
  });

  const { data: perigos = [] } = useQuery({
    queryKey: ["pgr-estrutura-perigos", pgrId],
    enabled: !!pgrId,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_levantamento_preliminar")
        .select("*").eq("pgr_id", pgrId);
      return (data || []) as any[];
    },
  });

  const alterna = (chave: string) =>
    setAberto((a) => ({ ...a, [chave]: !a[chave] }));

  const casa = (nome: string) =>
    !busca.trim() || nome.toLowerCase().includes(busca.trim().toLowerCase());

  /** Funções ligadas a um GES pelos vínculos N:N. */
  const funcoesDoGes = (gesId: string) => {
    const ids = new Set(
      (gesVinculos as any[]).filter((v) => v.ges_id === gesId && v.funcao_id).map((v) => v.funcao_id),
    );
    return funcoes.filter((f: any) => ids.has(f.id));
  };

  const gesDoSetor = (setorId: string) => {
    const ids = new Set(
      (gesVinculos as any[]).filter((v) => v.setor_id === setorId).map((v) => v.ges_id),
    );
    return gesList.filter((g: any) => ids.has(g.id));
  };

  /** Perigos e riscos ancorados no nó selecionado, em qualquer nível. */
  const itensDoNo = useMemo(() => {
    const campo: Record<NoTipo, string | null> = {
      empresa: null, ambiente: "ambiente_id", processo: "processo_id", setor: "setor_id",
      ges: "ges_id", funcao: "funcao_id", atividade: "atividade_id",
    };
    const chave = campo[sel.tipo];
    const filtra = (lista: any[]) =>
      !chave || !sel.id ? lista : lista.filter((i) => i[chave] === sel.id);
    return { inv: filtra(inventario), lev: filtra(perigos) };
  }, [sel, inventario, perigos]);

  const No = ({
    chave, tipo, nome, contagem, filhos, nivel = 0,
  }: {
    chave: string; tipo: NoTipo; nome: string; contagem?: number;
    filhos?: React.ReactNode; nivel?: number;
  }) => {
    const Icone = ICONE[tipo];
    const temFilhos = !!filhos;
    const expandido = !!aberto[chave];
    const ativo = sel.tipo === tipo && sel.nome === nome;
    return (
      <div>
        <div
          className={`flex items-center gap-1 rounded-md pr-2 ${ativo ? "bg-primary/10 border-l-2 border-primary" : "hover:bg-muted"}`}
          style={{ paddingLeft: `${nivel * 14 + 4}px` }}
        >
          {temFilhos ? (
            <button onClick={() => alterna(chave)} className="p-1 shrink-0" aria-label="Expandir">
              {expandido ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          )}
          <button
            onClick={() => setSel({ tipo, id: chave.split(":")[1] || null, nome })}
            className="flex items-center gap-2 py-1.5 min-w-0 flex-1 text-left"
          >
            <Icone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-sm truncate">{nome}</span>
          </button>
          {contagem != null && (
            <Badge variant="outline" className="text-[10px] h-5 shrink-0">{contagem}</Badge>
          )}
        </div>
        {expandido && filhos}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-12 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando estrutura…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background border-b px-4 py-3 flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate(pgrId ? `/pgr/${pgrId}` : "/pgr")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> {pgrId ? "Assistente" : "Documentos"}
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="font-semibold truncate">Estrutura do levantamento</h1>
          <p className="text-xs text-muted-foreground">
            Navegue pela hierarquia e veja os riscos de cada nível.
          </p>
        </div>
        {pgr && <Badge variant="outline">v{pgr.versao}</Badge>}
      </header>

      <div className="flex flex-col lg:flex-row">
        {/* Árvore */}
        <aside className="lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r p-3 space-y-3 lg:min-h-[calc(100vh-65px)]">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar na estrutura…" className="pl-8 h-9" />
          </div>

          <div className="max-h-[60vh] lg:max-h-none overflow-y-auto">
            <No
              chave="raiz" tipo="empresa" nome="Empresa" contagem={ambientes.length}
              filhos={
                <>
                  {ambientes.filter((a: any) => casa(a.nome)).map((amb: any) => {
                    const setoresDoAmb = setores.filter((s: any) => s.ambiente_id === amb.id);
                    return (
                      <No
                        key={amb.id} chave={`amb:${amb.id}`} tipo="ambiente" nome={amb.nome}
                        nivel={1} contagem={setoresDoAmb.length}
                        filhos={
                          <>
                            {setoresDoAmb.map((set: any) => {
                              const ges = gesDoSetor(set.id);
                              return (
                                <No
                                  key={set.id} chave={`set:${set.id}`} tipo="setor" nome={set.nome}
                                  nivel={2} contagem={ges.length}
                                  filhos={
                                    <>
                                      {ges.map((g: any) => {
                                        const fns = funcoesDoGes(g.id);
                                        return (
                                          <No
                                            key={g.id} chave={`ges:${g.id}`} tipo="ges" nome={g.nome}
                                            nivel={3} contagem={fns.length}
                                            filhos={
                                              <>
                                                {fns.map((fn: any) => {
                                                  const ativs = atividades.filter(
                                                    (a: any) => a.funcao_id === fn.id);
                                                  return (
                                                    <No
                                                      key={fn.id} chave={`fun:${fn.id}`} tipo="funcao"
                                                      nome={fn.nome} nivel={4} contagem={ativs.length}
                                                      filhos={
                                                        ativs.length > 0 ? (
                                                          <>
                                                            {ativs.map((at: any) => (
                                                              <No key={at.id} chave={`ati:${at.id}`}
                                                                tipo="atividade" nome={at.nome} nivel={5} />
                                                            ))}
                                                          </>
                                                        ) : undefined
                                                      }
                                                    />
                                                  );
                                                })}
                                              </>
                                            }
                                          />
                                        );
                                      })}
                                    </>
                                  }
                                />
                              );
                            })}
                          </>
                        }
                      />
                    );
                  })}
                  {processos.filter((p: any) => casa(p.nome)).map((p: any) => (
                    <No key={p.id} chave={`pro:${p.id}`} tipo="processo" nome={p.nome} nivel={1} />
                  ))}
                </>
              }
            />
          </div>

          {ambientes.length === 0 && (
            <p className="text-xs text-muted-foreground px-2">
              Nenhum ambiente cadastrado. A árvore aparece conforme a estrutura é preenchida.
            </p>
          )}
        </aside>

        {/* Painel central */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 space-y-5">
          <div className="flex items-center gap-3">
            {(() => { const I = ICONE[sel.tipo]; return <I className="h-6 w-6 text-muted-foreground shrink-0" />; })()}
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground capitalize">{sel.tipo}</p>
              <h2 className="text-xl font-bold truncate">{sel.nome}</h2>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { rotulo: "Perigos levantados", valor: itensDoNo.lev.length },
              { rotulo: "Riscos avaliados", valor: itensDoNo.inv.length },
              {
                rotulo: "Sem plano de ação",
                valor: itensDoNo.inv.filter((i: any) => i.necessita_acao).length,
              },
              {
                rotulo: "Aguardando avaliação",
                valor: itensDoNo.lev.filter((l: any) => !l.inventario_item_id
                  && l.tratamento === "avaliacao_aprofundada").length,
              },
            ].map((c) => (
              <Card key={c.rotulo}><CardContent className="p-3">
                <div className="text-2xl font-bold">{c.valor}</div>
                <div className="text-xs text-muted-foreground leading-tight">{c.rotulo}</div>
              </CardContent></Card>
            ))}
          </div>

          <section className="space-y-2">
            <h3 className="font-semibold">Riscos avaliados neste nível</h3>
            {itensDoNo.inv.length === 0 ? (
              <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
                Nenhum risco avaliado ainda para este item.
              </CardContent></Card>
            ) : (
              <Card><CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Perigo</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Fonte geradora</TableHead>
                      <TableHead className="text-right">Expostos</TableHead>
                      <TableHead>Classificação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensDoNo.inv.map((i: any) => {
                      // null = ainda não avaliado. Mostrar "Trivial" nesse caso
                      // faria risco não avaliado parecer risco aceito.
                      const classe = classificarRisco(i.severidade, i.probabilidade);
                      return (
                        <TableRow key={i.id}>
                          <TableCell className="font-medium max-w-[240px]">{i.perigo_descricao}</TableCell>
                          <TableCell className="text-xs">{GRUPO_LABEL[i.grupo] || i.grupo}</TableCell>
                          <TableCell className="text-xs max-w-[200px]">{i.fonte_geradora || "—"}</TableCell>
                          <TableCell className="text-right">{i.trabalhadores_expostos ?? "—"}</TableCell>
                          <TableCell>
                            {classe ? (
                              <Badge variant="outline" className={CLASSE_TEXT[classe]}>
                                {CLASSE_LABEL[classe]}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Não avaliado</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent></Card>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold">Perigos levantados, ainda sem avaliação</h3>
            {itensDoNo.lev.filter((l: any) => !l.inventario_item_id).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nada pendente de avaliação neste nível.
              </p>
            ) : (
              <div className="space-y-2">
                {itensDoNo.lev.filter((l: any) => !l.inventario_item_id).map((l: any) => (
                  <Card key={l.id}><CardContent className="p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{l.perigo_descricao}</p>
                      <p className="text-xs text-muted-foreground">{l.fonte_circunstancia || "—"}</p>
                    </div>
                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 shrink-0">
                      {GRUPO_LABEL[l.grupo] || l.grupo || "—"}
                    </Badge>
                  </CardContent></Card>
                ))}
              </div>
            )}
          </section>

          {pgrId && (
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" onClick={() => navigate(`/pgr/${pgrId}?etapa=perigos`)}>
                Cadastrar perigo
              </Button>
              <Button variant="outline" onClick={() => navigate(`/pgr/${pgrId}?etapa=inventario`)}>
                Abrir inventário
              </Button>
              <Button variant="outline" onClick={() => navigate(`/pgr/${pgrId}?etapa=acoes`)}>
                Plano de ação
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
