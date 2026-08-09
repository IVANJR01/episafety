import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ClipboardList, AlertTriangle, CheckCircle2, Clock, BarChart3, CalendarClock,
  ShieldAlert, Timer, Info, OctagonAlert, TrendingUp, MapPin, BookOpen,
} from "lucide-react";
import {
  ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Cell, LabelList,
} from "recharts";
import { differenceInCalendarDays, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCachedData, isOnline } from "@/lib/offlineStorage";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiSkeleton } from "@/components/ui/list-skeleton";

interface Conformidade {
  id: string;
  numero: number | null;
  status: string;
  gravidade: string;
  empresa_id: string | null;
  data_inspecao: string | null;
  data_realizado: string | null;
  prazo_correcao: string | null;
  local: string | null;
  local_especifico: string | null;
  referencia_normativa: string | null;
  responsavel: string | null;
  situacao_detectada: string | null;
  obra_id: string | null;
}

interface Obra {
  id: string;
  nome: string;
  codigo: string | null;
}

const TODAS_OBRAS = "todas";

/*
 * Paleta dos gráficos.
 *
 * Gravidade é calor semântico (verde → âmbar → vermelho → vinho), não uma
 * escala de matiz única. Estes quatro valores foram conferidos no validador
 * de paleta: banda de luminosidade, piso de croma, separação para daltonismo
 * (pior par adjacente ΔE 8.7 em deuteranopia), piso de visão normal (ΔE 15.5)
 * e contraste contra a superfície — os cinco passam. Mexer num deles sem
 * revalidar quebra a leitura de quem enxerga cor de forma diferente.
 *
 * Cor nunca anda sozinha aqui: toda gravidade aparece com ícone e texto.
 */
const COR_GRAVIDADE: Record<string, string> = {
  "LEVE": "#16794a",
  "MODERADO": "#c67c00",
  "GRAVE": "#d22b2b",
  "RISCO CRÍTICO": "#8f2352",
};

const ICONE_GRAVIDADE: Record<string, typeof Info> = {
  "LEVE": Info,
  "MODERADO": AlertTriangle,
  "GRAVE": OctagonAlert,
  "RISCO CRÍTICO": ShieldAlert,
};

const ORDEM_GRAVIDADE = ["LEVE", "MODERADO", "GRAVE", "RISCO CRÍTICO"];

/** Par do gráfico de evolução — validado, ΔE 25.5 em deuteranopia. */
const COR_ABERTAS = "#1676f3";
const COR_SOLUCIONADAS = "#16794a";

/** Série única nas barras de ranking: uma cor só, o comprimento já informa. */
const COR_SERIE_UNICA = "#1676f3";

const COR_PRAZO: Record<string, string> = {
  "Em dia": "#16794a",
  "Vence em 7 dias": "#c67c00",
  "Vencida": "#d22b2b",
  "Sem prazo": "#8d94a1",
};

const COR_EIXO = "hsl(var(--muted-foreground))";
const COR_GRADE = "hsl(var(--border))";

const ESTILO_TOOLTIP = {
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
} as const;

const PERIODOS = [
  { valor: "90", rotulo: "Últimos 90 dias" },
  { valor: "180", rotulo: "Últimos 6 meses" },
  { valor: "365", rotulo: "Últimos 12 meses" },
  { valor: "tudo", rotulo: "Todo o período" },
];

const LOAD_TIMEOUT_MS = 3000;

const withTimeout = <T,>(promise: Promise<T>, timeoutMs = LOAD_TIMEOUT_MS) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("timeout")), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  }) as Promise<T>;
};

/** Data do banco vem como 'YYYY-MM-DD'; nulo e texto inválido viram null. */
function data(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  try {
    const d = parseISO(valor);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/**
 * Agrupa por chave textual e devolve os N maiores, já ordenados.
 *
 * O eixo do gráfico tem largura fixa: "NR-35 — Trabalho em Altura" inteiro
 * transborda para fora do cartão. O rótulo vai encurtado e o nome completo
 * viaja junto, para o tooltip mostrar sem cortar.
 */
function ranking(itens: Conformidade[], chave: (c: Conformidade) => string | null, limite: number) {
  const contagem = new Map<string, number>();
  itens.forEach((c) => {
    const v = chave(c)?.trim();
    if (!v) return;
    contagem.set(v, (contagem.get(v) || 0) + 1);
  });
  return [...contagem.entries()]
    .map(([completo, total]) => ({
      nome: completo.length > 18 ? `${completo.slice(0, 17).trimEnd()}…` : completo,
      completo,
      total,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limite);
}

export default function InspecoesDashboard() {
  const { empresaId, empresaScopeIds } = useAuth();
  const [registros, setRegistros] = useState<Conformidade[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("365");
  const [obraId, setObraId] = useState(TODAS_OBRAS);

  const targetIds = useMemo(
    () => (empresaScopeIds && empresaScopeIds.length > 0 ? empresaScopeIds : empresaId ? [empresaId] : []),
    [empresaId, empresaScopeIds],
  );

  const cachedData = useMemo(() => {
    const cached = getCachedData<Conformidade>("conformidades") || [];
    return targetIds.length > 0 ? cached.filter((i) => i.empresa_id && targetIds.includes(i.empresa_id)) : [];
  }, [targetIds]);

  useEffect(() => {
    async function load() {
      if (targetIds.length === 0) {
        setRegistros([]);
        setLoading(false);
        return;
      }
      setLoading(true);

      if (!isOnline()) {
        setRegistros(cachedData);
        setLoading(false);
        return;
      }

      try {
        const { data: linhas, error } = (await withTimeout(
          (supabase.from as any)("conformidades")
            .select(
              "id, numero, status, gravidade, empresa_id, obra_id, data_inspecao, data_realizado, prazo_correcao, local, local_especifico, referencia_normativa, responsavel, situacao_detectada",
            )
            .in("empresa_id", targetIds),
        )) as any;
        if (error) throw error;
        setRegistros((linhas || []) as Conformidade[]);
      } catch {
        setRegistros(cachedData);
      } finally {
        setLoading(false);
      }
    }

    void load();
    const handleOnline = () => void load();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [cachedData, targetIds]);

  // Obras do mesmo escopo de empresa dos registros — sem elas o seletor
  // mostraria id cru. Falha de rede aqui só apaga o seletor, não a tela.
  useEffect(() => {
    if (targetIds.length === 0) {
      setObras([]);
      return;
    }
    let ativo = true;
    (async () => {
      try {
        const { data: linhas } = await (supabase.from as any)("obras")
          .select("id, nome, codigo")
          .in("empresa_id", targetIds)
          .order("nome", { ascending: true });
        if (ativo) setObras((linhas || []) as Obra[]);
      } catch {
        if (ativo) setObras([]);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [targetIds]);

  const nomeObra = useMemo(() => {
    const m = new Map<string, string>();
    obras.forEach((o) => m.set(o.id, o.codigo ? `${o.codigo} — ${o.nome}` : o.nome));
    return m;
  }, [obras]);

  /*
   * A obra escolhida some da lista? Acontece quando se troca de empresa com
   * o filtro aplicado. Volta para "todas" em vez de mostrar tela vazia sem
   * explicação.
   */
  useEffect(() => {
    if (obraId !== TODAS_OBRAS && obras.length > 0 && !obras.some((o) => o.id === obraId)) {
      setObraId(TODAS_OBRAS);
    }
  }, [obras, obraId]);

  /*
   * Os filtros valem para tudo que está abaixo deles — uma faixa de filtro,
   * um recorte só. O período corta pela data da inspeção: é quando o problema
   * foi detectado, e é isso que o período de uma apresentação delimita.
   */
  const itens = useMemo(() => {
    const dias = periodo === "tudo" ? null : Number(periodo);
    const hoje = new Date();
    return registros.filter((c) => {
      if (obraId !== TODAS_OBRAS && c.obra_id !== obraId) return false;
      if (dias === null) return true;
      const d = data(c.data_inspecao);
      return d ? differenceInCalendarDays(hoje, d) <= dias : false;
    });
  }, [registros, periodo, obraId]);

  const m = useMemo(() => {
    const hoje = new Date();
    const pendentes = itens.filter((c) => c.status === "PENDENTE");
    const solucionados = itens.filter((c) => c.status === "SOLUCIONADO");

    // Dias até o prazo, só para o que continua em aberto.
    const diasParaPrazo = (c: Conformidade) => {
      const p = data(c.prazo_correcao);
      return p ? differenceInCalendarDays(p, hoje) : null;
    };

    const vencidas = pendentes.filter((c) => {
      const d = diasParaPrazo(c);
      return d !== null && d < 0;
    });
    const vencendo = pendentes.filter((c) => {
      const d = diasParaPrazo(c);
      return d !== null && d >= 0 && d <= 7;
    });
    const emDia = pendentes.filter((c) => {
      const d = diasParaPrazo(c);
      return d !== null && d > 7;
    });
    const semPrazo = pendentes.filter((c) => diasParaPrazo(c) === null);
    const criticasAbertas = pendentes.filter((c) => c.gravidade === "RISCO CRÍTICO");

    // Tempo médio de solução: só entra quem tem as duas pontas registradas.
    const prazos = solucionados
      .map((c) => {
        const ini = data(c.data_inspecao);
        const fim = data(c.data_realizado);
        return ini && fim ? differenceInCalendarDays(fim, ini) : null;
      })
      .filter((d): d is number => d !== null && d >= 0);
    const tempoMedio = prazos.length > 0 ? Math.round(prazos.reduce((a, b) => a + b, 0) / prazos.length) : null;

    // Evolução: 12 baldes mensais, detectadas x solucionadas.
    const meses: { chave: string; rotulo: string; abertas: number; solucionadas: number }[] = [];
    const indice = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const chave = format(d, "yyyy-MM");
      indice.set(chave, meses.length);
      meses.push({ chave, rotulo: format(d, "MMM/yy", { locale: ptBR }), abertas: 0, solucionadas: 0 });
    }
    itens.forEach((c) => {
      const ins = data(c.data_inspecao);
      if (ins) {
        const i = indice.get(format(ins, "yyyy-MM"));
        if (i !== undefined) meses[i].abertas += 1;
      }
      const res = data(c.data_realizado);
      if (res) {
        const i = indice.get(format(res, "yyyy-MM"));
        if (i !== undefined) meses[i].solucionadas += 1;
      }
    });

    const porGravidade = ORDEM_GRAVIDADE.map((g) => ({
      nome: g.charAt(0) + g.slice(1).toLowerCase(),
      chave: g,
      total: itens.filter((c) => c.gravidade === g).length,
      fill: COR_GRAVIDADE[g],
    })).filter((g) => g.total > 0);

    const prazoBarra = [
      {
        rotulo: "Pendentes",
        "Em dia": emDia.length,
        "Vence em 7 dias": vencendo.length,
        Vencida: vencidas.length,
        "Sem prazo": semPrazo.length,
      },
    ];

    // Prioridades: o mais grave primeiro, e dentro da gravidade o mais atrasado.
    const peso = (g: string) => ORDEM_GRAVIDADE.indexOf(g);
    const prioridades = [...pendentes]
      .map((c) => ({ c, dias: diasParaPrazo(c) }))
      .sort((a, b) => {
        const pg = peso(b.c.gravidade) - peso(a.c.gravidade);
        if (pg !== 0) return pg;
        return (a.dias ?? 9999) - (b.dias ?? 9999);
      })
      .slice(0, 10);

    return {
      total: itens.length,
      pendentes: pendentes.length,
      solucionados: solucionados.length,
      taxa: itens.length > 0 ? Math.round((solucionados.length / itens.length) * 100) : null,
      vencidas: vencidas.length,
      vencendo: vencendo.length,
      criticasAbertas: criticasAbertas.length,
      tempoMedio,
      meses,
      porGravidade,
      prazoBarra,
      temPrazo: emDia.length + vencendo.length + vencidas.length + semPrazo.length > 0,
      topNormas: ranking(itens, (c) => c.referencia_normativa, 8),
      /*
       * `local` e `local_especifico` são texto livre e ficam em branco em
       * quem registra a localização pela obra — e aí o cartão dizia "nenhum
       * local preenchido" com a tela cheia de inspeções. A obra entra como
       * terceira opção: é o local, só que vindo do cadastro.
       */
      topLocais: ranking(
        itens,
        (c) => c.local_especifico || c.local || (c.obra_id ? nomeObra.get(c.obra_id) ?? null : null),
        8,
      ),
      prioridades,
    };
  }, [itens, nomeObra]);

  /*
   * A coluna Obra só aparece quando ela informa algo: filtrando por uma obra
   * só, repetir o mesmo nome em toda linha é coluna gasta à toa.
   */
  const mostrarObra =
    obraId === TODAS_OBRAS && m.prioridades.some(({ c }) => c.obra_id && nomeObra.get(c.obra_id));

  const cabecalho = (
    <PageHeader
      title="Dashboard de Inspeções"
      subtitle="Conformidades, gravidade, prazos e evolução da resolução."
    />
  );

  if (loading) {
    return (
      <div className="tela-larga space-y-6">
        {cabecalho}
        <KpiSkeleton count={4} />
      </div>
    );
  }

  if (m.total === 0) {
    return (
      <div className="tela-larga space-y-6">
        {cabecalho}
        <BarraFiltros periodo={periodo} setPeriodo={setPeriodo} obraId={obraId} setObraId={setObraId} obras={obras} />
        <Card>
          <CardContent className="py-4">
            <EmptyState
              icon={BarChart3}
              title="Nenhuma inspeção neste recorte"
              description={
                obraId !== TODAS_OBRAS
                  ? "Esta obra não tem inspeções no período escolhido. Troque a obra ou amplie o período."
                  : "Amplie o período ou registre inspeções para acompanhar os indicadores."
              }
              bare
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="tela-larga space-y-5">
      {cabecalho}

      {/* Uma faixa de filtro acima de tudo: todos os painéis leem o mesmo recorte. */}
      <BarraFiltros periodo={periodo} setPeriodo={setPeriodo} obraId={obraId} setObraId={setObraId} obras={obras} />

      {/* Números de referência */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total de Inspeções" valor={m.total} icone={ClipboardList} tom="text-primary bg-primary/10" />
        <KpiCard label="Pendentes" valor={m.pendentes} icone={Clock} tom="text-warning bg-warning/10" />
        <KpiCard label="Solucionados" valor={m.solucionados} icone={CheckCircle2} tom="text-success bg-success/10" />
        <KpiCard
          label="Taxa de Resolução"
          valor={m.taxa === null ? "—" : `${m.taxa}%`}
          icone={TrendingUp}
          tom="text-info bg-info/10"
          medidor={m.taxa}
        />
      </div>

      {/* Faixa de risco: o que exige ação agora. Cor sempre com ícone e texto. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Prazo vencido"
          valor={m.vencidas}
          icone={AlertTriangle}
          tom="text-destructive bg-destructive/10"
          destaque={m.vencidas > 0}
          nota={m.vencidas > 0 ? "Correção fora do prazo" : "Nenhuma em atraso"}
        />
        <KpiCard
          label="Vence em 7 dias"
          valor={m.vencendo}
          icone={CalendarClock}
          tom="text-warning bg-warning/10"
          destaque={m.vencendo > 0}
          nota={m.vencendo > 0 ? "Prazo próximo do fim" : "Nada vencendo agora"}
        />
        <KpiCard
          label="Risco crítico em aberto"
          valor={m.criticasAbertas}
          icone={ShieldAlert}
          tom="text-destructive bg-destructive/10"
          destaque={m.criticasAbertas > 0}
          nota={m.criticasAbertas > 0 ? "Prioridade máxima" : "Nenhum em aberto"}
        />
        <KpiCard
          label="Tempo médio de solução"
          valor={m.tempoMedio === null ? "—" : `${m.tempoMedio} d`}
          icone={Timer}
          tom="text-info bg-info/10"
          nota={m.tempoMedio === null ? "Sem histórico de conclusão" : "Da detecção à correção"}
        />
      </div>

      {/* Evolução: a leitura que mostra se a curva está virando */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-semibold">Evolução mensal</CardTitle>
          <p className="text-xs text-muted-foreground">
            Não conformidades detectadas e solucionadas a cada mês, nos últimos 12 meses.
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={m.meses} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid stroke={COR_GRADE} vertical={false} />
                {/* minTickGap: em tela estreita o recharts descarta rótulo em vez de sobrepor */}
                <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: COR_EIXO }} tickLine={false} axisLine={{ stroke: COR_GRADE }} minTickGap={12} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COR_EIXO }} tickLine={false} axisLine={false} width={32} />
                <Tooltip contentStyle={ESTILO_TOOLTIP} cursor={{ stroke: COR_GRADE, strokeWidth: 1 }} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone" dataKey="abertas" name="Detectadas" stroke={COR_ABERTAS}
                  strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: COR_ABERTAS }} activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone" dataKey="solucionadas" name="Solucionadas" stroke={COR_SOLUCIONADAS}
                  strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: COR_SOLUCIONADAS }} activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Gravidade */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-semibold">Distribuição por gravidade</CardTitle>
            <p className="text-xs text-muted-foreground">Todas as inspeções do período, da menor para a maior gravidade.</p>
          </CardHeader>
          <CardContent>
            {m.porGravidade.length > 0 ? (
              <>
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={m.porGravidade} margin={{ top: 20, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid stroke={COR_GRADE} vertical={false} />
                      <XAxis dataKey="nome" tick={{ fontSize: 11, fill: COR_EIXO }} tickLine={false} axisLine={{ stroke: COR_GRADE }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COR_EIXO }} tickLine={false} axisLine={false} width={32} />
                      <Tooltip contentStyle={ESTILO_TOOLTIP} cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.4 }} formatter={(v: number) => [`${v}`, "Registros"]} />
                      <Bar dataKey="total" name="Registros" radius={[4, 4, 0, 0]} maxBarSize={72}>
                        <LabelList dataKey="total" position="top" style={{ fontSize: 12, fill: "hsl(var(--foreground))" }} />
                        {m.porGravidade.map((g) => (
                          <Cell key={g.chave} fill={g.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Identidade nunca só pela cor: ícone + nome. O número já está
                    rotulado em cima da barra — repetir aqui seria dizer duas vezes. */}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
                  {m.porGravidade.map((g) => {
                    const Icone = ICONE_GRAVIDADE[g.chave] || Info;
                    return (
                      <span key={g.chave} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Icone className="w-3.5 h-3.5" style={{ color: g.fill }} />
                        {g.nome}
                      </span>
                    );
                  })}
                </div>
              </>
            ) : (
              <EmptyState icon={BarChart3} title="Sem dados no período" description="Nenhuma gravidade registrada." bare />
            )}
          </CardContent>
        </Card>

        {/* Prazos */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-semibold">Situação dos prazos</CardTitle>
            <p className="text-xs text-muted-foreground">Como estão as {m.pendentes} pendências em relação ao prazo de correção.</p>
          </CardHeader>
          <CardContent>
            {m.temPrazo ? (
              <>
                {/* A frase que resume o cartão — é o que fica na cabeça de quem assiste. */}
                <p className="text-sm mb-2">
                  {m.vencidas > 0 ? (
                    <>
                      <span className="font-bold text-destructive tabular-nums">{m.vencidas}</span>{" "}
                      das {m.pendentes} pendências (
                      {Math.round((m.vencidas / m.pendentes) * 100)}%) já passaram do prazo de correção.
                    </>
                  ) : (
                    <>Nenhuma pendência com prazo vencido.</>
                  )}
                </p>
                <div className="h-[72px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={m.prazoBarra} layout="vertical" margin={{ top: 4, right: 4, left: 0, bottom: 4 }} barSize={40}>
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="rotulo" hide />
                      <Tooltip contentStyle={ESTILO_TOOLTIP} cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.4 }} />
                      {/* stroke na cor da superfície = folga de 2px entre os blocos */}
                      {Object.keys(COR_PRAZO).map((k, i, arr) => (
                        <Bar
                          key={k} dataKey={k} stackId="p" fill={COR_PRAZO[k]}
                          stroke="hsl(var(--card))" strokeWidth={2}
                          radius={i === 0 ? [4, 0, 0, 4] : i === arr.length - 1 ? [0, 4, 4, 0] : 0}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Esta é a legenda do gráfico — por isso o <Legend> do recharts sai:
                    dois blocos dizendo a mesma coisa, e só um deles traz o número. */}
                <ul className="mt-1 divide-y divide-border/60">
                  {Object.entries(COR_PRAZO).map(([nome, cor]) => {
                    const valor = (m.prazoBarra[0] as Record<string, any>)[nome] as number;
                    const fatia = m.pendentes > 0 ? Math.round((valor / m.pendentes) * 100) : 0;
                    return (
                      <li key={nome} className="flex items-center justify-between py-1.5 text-xs">
                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: cor }} />
                          {nome}
                        </span>
                        <span className="tabular-nums">
                          <span className="font-medium text-foreground">{valor}</span>
                          <span className="text-muted-foreground"> · {fatia}%</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <EmptyState icon={CalendarClock} title="Nenhuma pendência" description="Não há correções em aberto no período." bare />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <RankingCard
          titulo="Normas mais citadas"
          descricao="Onde as não conformidades se concentram na legislação."
          icone={BookOpen}
          dados={m.topNormas}
          vazio="Nenhuma referência normativa preenchida no período."
        />
        <RankingCard
          titulo="Locais com mais ocorrências"
          descricao="Onde os problemas se repetem."
          icone={MapPin}
          dados={m.topLocais}
          vazio="Nenhum local preenchido no período."
        />
      </div>

      {/* Prioridades: a tabela é também a leitura acessível dos gráficos acima */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-semibold">Prioridades de correção</CardTitle>
          <p className="text-xs text-muted-foreground">
            Pendências em aberto, da mais grave para a menos grave e, dentro da gravidade, da mais atrasada.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {m.prioridades.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">Nº</TableHead>
                  <TableHead className="min-w-[240px]">Situação detectada</TableHead>
                  <TableHead className="whitespace-nowrap">Gravidade</TableHead>
                  {mostrarObra && <TableHead className="whitespace-nowrap">Obra</TableHead>}
                  <TableHead className="whitespace-nowrap">Local</TableHead>
                  <TableHead className="whitespace-nowrap">Prazo</TableHead>
                  <TableHead className="whitespace-nowrap text-right">Situação do prazo</TableHead>
                  <TableHead className="whitespace-nowrap">Responsável</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {m.prioridades.map(({ c, dias }) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.numero ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      <span className="line-clamp-2" title={c.situacao_detectada || ""}>
                        {c.situacao_detectada || "—"}
                      </span>
                    </TableCell>
                    <TableCell><BadgeGravidade gravidade={c.gravidade} /></TableCell>
                    {mostrarObra && (
                      <TableCell className="text-sm">{(c.obra_id && nomeObra.get(c.obra_id)) || "—"}</TableCell>
                    )}
                    <TableCell className="text-sm">{c.local_especifico || c.local || "—"}</TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {c.prazo_correcao ? format(parseISO(c.prazo_correcao), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap"><SituacaoPrazo dias={dias} /></TableCell>
                    <TableCell className="text-sm">{c.responsavel || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-4">
              <EmptyState icon={CheckCircle2} title="Nada pendente" description="Todas as não conformidades do período foram solucionadas." bare />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BarraFiltros({
  periodo, setPeriodo, obraId, setObraId, obras,
}: {
  periodo: string;
  setPeriodo: (v: string) => void;
  obraId: string;
  setObraId: (v: string) => void;
  obras: Obra[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Período</span>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="h-9 w-[180px] text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIODOS.map((p) => (
              <SelectItem key={p.valor} value={p.valor}>{p.rotulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* Sem obra cadastrada o seletor não aparece: escolha de um item só não é escolha. */}
      {obras.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Obra</span>
          <Select value={obraId} onValueChange={setObraId}>
            <SelectTrigger className="h-9 w-[240px] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS_OBRAS}>Todas as obras</SelectItem>
              {obras.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.codigo ? `${o.codigo} — ${o.nome}` : o.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label, valor, icone: Icone, tom, nota, medidor, destaque,
}: {
  label: string;
  valor: number | string;
  icone: typeof Info;
  tom: string;
  nota?: string;
  medidor?: number | null;
  destaque?: boolean;
}) {
  return (
    <Card className={destaque ? "border-destructive/30" : "border-border/60"}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg shrink-0 ${tom}`}><Icone className="w-5 h-5" /></div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            {/* Cifra grande usa figuras proporcionais — tabular só onde alinha em coluna. */}
            <p className="font-bold text-2xl leading-tight">{valor}</p>
          </div>
        </div>
        {typeof medidor === "number" && (
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-info" style={{ width: `${Math.min(100, Math.max(0, medidor))}%` }} />
          </div>
        )}
        {nota && <p className="mt-2 text-[11px] text-muted-foreground">{nota}</p>}
      </CardContent>
    </Card>
  );
}

function RankingCard({
  titulo, descricao, icone: Icone, dados, vazio,
}: {
  titulo: string;
  descricao: string;
  icone: typeof Info;
  dados: { nome: string; completo: string; total: number }[];
  vazio: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold">{titulo}</CardTitle>
        <p className="text-xs text-muted-foreground">{descricao}</p>
      </CardHeader>
      <CardContent>
        {dados.length > 0 ? (
          <div style={{ height: Math.max(160, dados.length * 34 + 24) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 34, left: 0, bottom: 4 }}>
                <CartesianGrid stroke={COR_GRADE} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COR_EIXO }} tickLine={false} axisLine={false} />
                <YAxis
                  type="category" dataKey="nome" width={140} tick={{ fontSize: 11, fill: COR_EIXO }}
                  tickLine={false} axisLine={false}
                />
                <Tooltip
                  contentStyle={ESTILO_TOOLTIP}
                  cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.4 }}
                  formatter={(v: number) => [`${v}`, "Registros"]}
                  labelFormatter={(_, p) => (p?.[0]?.payload as any)?.completo ?? ""}
                />
                {/* Série única: uma cor só. O comprimento da barra já é a grandeza. */}
                <Bar dataKey="total" name="Registros" fill={COR_SERIE_UNICA} radius={[0, 4, 4, 0]} barSize={18}>
                  <LabelList dataKey="total" position="right" style={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState icon={Icone} title="Sem dados" description={vazio} bare />
        )}
      </CardContent>
    </Card>
  );
}

function BadgeGravidade({ gravidade }: { gravidade: string }) {
  const cor = COR_GRAVIDADE[gravidade];
  const Icone = ICONE_GRAVIDADE[gravidade] || Info;
  const rotulo = gravidade ? gravidade.charAt(0) + gravidade.slice(1).toLowerCase() : "—";
  if (!cor) return <span className="text-xs text-muted-foreground">{rotulo}</span>;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ color: cor, borderColor: `${cor}55`, background: `${cor}14` }}
    >
      <Icone className="w-3.5 h-3.5 shrink-0" />
      {rotulo}
    </span>
  );
}

function SituacaoPrazo({ dias }: { dias: number | null }) {
  if (dias === null) return <span className="text-xs text-muted-foreground">Sem prazo</span>;
  if (dias < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
        <AlertTriangle className="w-3.5 h-3.5" />
        {Math.abs(dias)} d em atraso
      </span>
    );
  }
  if (dias <= 7) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
        <CalendarClock className="w-3.5 h-3.5" />
        vence em {dias} d
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <CheckCircle2 className="w-3.5 h-3.5 text-success" />
      {dias} d restantes
    </span>
  );
}
