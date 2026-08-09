import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Building2, Briefcase, UserX, ClipboardList, Zap, MapPin,
  CheckCircle2, AlertTriangle, XCircle, IdCard, Hash, CalendarDays, Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupabaseQuery } from "@/hooks/useSupabaseData";
import {
  Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, LabelList,
} from "recharts";
import { differenceInCalendarDays, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiSkeleton } from "@/components/ui/list-skeleton";

interface Funcionario {
  id: string;
  nome: string;
  cpf: string | null;
  matricula: string | null;
  setor: string | null;
  cargo: string | null;
  data_admissao: string | null;
  data_demissao: string | null;
  unidade_id: string | null;
}

interface Conformidade { id: string; status: string; foto_antes: string | null; foto_antes_path: string | null; }
interface Obra { id: string; nome: string; status: string; }
interface PgrAcao { id: string; status: string; }

/*
 * Cor.
 *
 * Antes cada barra do gráfico recebia um matiz diferente de uma lista que
 * dava a volta a cada 10 — com 21 cargos, dois cargos distintos ganhavam a
 * mesma cor, e nenhuma das cores significava nada. Cargo não tem ordem nem
 * identidade cromática: o comprimento da barra já é a grandeza.
 * Uma série, uma cor.
 *
 * Os tons de situação (bom / atenção / falta) são os mesmos já conferidos
 * no validador de paleta usado no painel de Inspeções, e nunca aparecem
 * sozinhos — sempre com ícone e texto.
 */
const COR_SERIE = "#1676f3";
const COR_BOM = "#16794a";
const COR_ATENCAO = "#c67c00";
const COR_FALTA = "#d22b2b";

const COR_EIXO = "hsl(var(--muted-foreground))";
const COR_GRADE = "hsl(var(--border))";

const ESTILO_TOOLTIP = {
  fontSize: 12,
  borderRadius: 8,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
} as const;

/** Acima disso o campo está bem preenchido; abaixo do segundo, é falha. */
const LIMITE_BOM = 90;
const LIMITE_ATENCAO = 60;

function data(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  try {
    const d = parseISO(valor);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export default function CadastroDashboard() {
  const navigate = useNavigate();
  const { data: funcionarios, loading: loadingFunc } = useSupabaseQuery<Funcionario>("funcionarios", "nome", true);
  // A tabela é `conformidades`, no plural. No singular a consulta não
  // encontrava nada e o cartão de Inspeções mostrava zero para sempre.
  const { data: inspecoes, loading: loadingInsp } = useSupabaseQuery<Conformidade>("conformidades", "numero", false);
  const { data: obras, loading: loadingObras } = useSupabaseQuery<Obra>("obras", "nome", true);
  const { data: pgrAcoes, loading: loadingAcoes } = useSupabaseQuery<PgrAcao>("pgr_acoes", null, true);

  const loading = loadingFunc || loadingInsp || loadingObras || loadingAcoes;

  const m = useMemo(() => {
    const ativos = funcionarios.filter((f) => !f.data_demissao);
    const desligados = funcionarios.filter((f) => !!f.data_demissao);

    // Qualidade do cadastro: medida só sobre quem está ativo — corrigir o
    // cadastro de quem já saiu não muda nada na prática.
    const base = ativos.length;
    const preenchidos = (tem: (f: Funcionario) => boolean) => ativos.filter(tem).length;
    const campos = [
      { rotulo: "CPF", icone: IdCard, total: preenchidos((f) => !!f.cpf?.trim()) },
      { rotulo: "Cargo", icone: Briefcase, total: preenchidos((f) => !!f.cargo?.trim()) },
      { rotulo: "GHS / Setor", icone: Layers, total: preenchidos((f) => !!f.setor?.trim()) },
      { rotulo: "Data de admissão", icone: CalendarDays, total: preenchidos((f) => !!f.data_admissao) },
      { rotulo: "Matrícula", icone: Hash, total: preenchidos((f) => !!f.matricula?.trim()) },
      { rotulo: "Unidade", icone: Building2, total: preenchidos((f) => !!f.unidade_id) },
    ].map((c) => ({
      ...c,
      pct: base > 0 ? Math.round((c.total / base) * 100) : 0,
      faltam: base - c.total,
    }));

    const completudeGeral = campos.length > 0 && base > 0
      ? Math.round(campos.reduce((s, c) => s + c.pct, 0) / campos.length)
      : 0;

    // Admissões nos últimos 12 meses.
    const hoje = new Date();
    const meses: { rotulo: string; total: number }[] = [];
    const indice = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      indice.set(format(d, "yyyy-MM"), meses.length);
      meses.push({ rotulo: format(d, "MMM/yy", { locale: ptBR }), total: 0 });
    }
    let admissoes12m = 0;
    funcionarios.forEach((f) => {
      const d = data(f.data_admissao);
      if (!d) return;
      const i = indice.get(format(d, "yyyy-MM"));
      if (i !== undefined) {
        meses[i].total += 1;
        admissoes12m += 1;
      }
    });

    /**
     * Agrupa e devolve os N maiores.
     *
     * A cauda NÃO vira uma barra "Outros": somada, ela costuma ser maior que
     * qualquer item do topo e achata justamente o ranking que o gráfico
     * deveria mostrar. Vira uma linha de texto abaixo do gráfico.
     *
     * O rótulo vai encurtado — o eixo tem largura fixa e nome longo quebra em
     * três linhas — com o nome inteiro guardado para o tooltip.
     */
    const agrupar = (chave: (f: Funcionario) => string | null, limite: number) => {
      const c = new Map<string, number>();
      ativos.forEach((f) => {
        const v = chave(f)?.trim();
        if (!v) return;
        c.set(v, (c.get(v) || 0) + 1);
      });
      const ordenado = [...c.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
      const cauda = ordenado.slice(limite);
      return {
        distintos: ordenado.length,
        restantes: cauda.length,
        restantesTotal: cauda.reduce((s, x) => s + x.total, 0),
        itens: ordenado.slice(0, limite).map((x) => ({
          ...x,
          curto: x.nome.length > 18 ? `${x.nome.slice(0, 17).trimEnd()}…` : x.nome,
        })),
      };
    };

    const cargos = agrupar((f) => f.cargo, 10);
    const setores = agrupar((f) => f.setor, 12);

    // Tempo de casa médio, em anos — número redondo que resume o quadro.
    const temposDias = ativos
      .map((f) => {
        const d = data(f.data_admissao);
        return d ? differenceInCalendarDays(hoje, d) : null;
      })
      .filter((d): d is number => d !== null && d >= 0);
    // Menos de um ano em "0,6 anos" não diz nada a ninguém — vira meses.
    // E o separador decimal é vírgula, não ponto.
    let tempoMedio: string | null = null;
    if (temposDias.length > 0) {
      const dias = temposDias.reduce((a, b) => a + b, 0) / temposDias.length;
      tempoMedio = dias < 365
        ? `${Math.round(dias / 30)} meses`
        : `${(dias / 365).toFixed(1).replace(".", ",")} anos`;
    }

    return {
      ativos: ativos.length,
      desligados: desligados.length,
      campos,
      completudeGeral,
      base,
      meses,
      admissoes12m,
      cargos,
      setores,
      tempoMedio,
      totalObras: obras.length,
      obrasAtivas: obras.filter((o) => (o.status || "").toUpperCase() === "ATIVA").length,
      totalInspecoes: inspecoes.length,
      inspecoesPendentes: inspecoes.filter((i) => i.status === "PENDENTE").length,
      inspecoesComFoto: inspecoes.filter((i) => i.foto_antes || i.foto_antes_path).length,
      totalAcoes: pgrAcoes.length,
    };
  }, [funcionarios, inspecoes, obras, pgrAcoes]);

  const cabecalho = (
    <PageHeader
      title="Dashboard"
      subtitle="Quadro de pessoal, qualidade do cadastro e evolução das admissões."
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

  if (funcionarios.length === 0) {
    return (
      <div className="tela-larga space-y-6">
        {cabecalho}
        <Card>
          <CardContent className="py-4">
            <EmptyState
              icon={Users}
              title="Nenhum funcionário cadastrado"
              description="Cadastre o primeiro colaborador para acompanhar o quadro de pessoal aqui."
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Funcionários ativos" valor={m.ativos} icone={Users} tom="text-primary bg-primary/10"
             nota={m.tempoMedio ? `${m.tempoMedio} de casa em média` : undefined}
             aoClicar={() => navigate("/cadastro/funcionarios")} />
        <Kpi label="Desligados" valor={m.desligados} icone={UserX} tom="text-muted-foreground bg-muted"
             nota={m.admissoes12m > 0 ? `${m.admissoes12m} admissões em 12 meses` : undefined}
             aoClicar={() => navigate("/cadastro/funcionarios")} />
        <Kpi label="Locais de trabalho" valor={m.totalObras} icone={MapPin} tom="text-warning bg-warning/10"
             nota={`${m.obrasAtivas} ativos`}
             aoClicar={() => navigate("/inspecoes-se/obras")} />
        <Kpi label="Cargos distintos" valor={m.cargos.distintos} icone={Briefcase} tom="text-info bg-info/10"
             nota={`${m.setores.distintos} GHS / setores`} />
      </div>

      {/* O cartão que vale a apresentação: o que falta preencher, campo a campo. */}
      <Card>
        <CardHeader className="pb-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-semibold">Qualidade do cadastro</CardTitle>
              <p className="text-xs text-muted-foreground">
                Quanto dos {m.base} funcionários ativos tem cada campo preenchido.
              </p>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold leading-none" style={{ color: corDaFaixa(m.completudeGeral) }}>
                {m.completudeGeral}%
              </span>
              <span className="text-xs text-muted-foreground">completo</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
            {m.campos.map((c) => {
              const cor = corDaFaixa(c.pct);
              const Situacao = c.pct >= LIMITE_BOM ? CheckCircle2 : c.pct >= LIMITE_ATENCAO ? AlertTriangle : XCircle;
              const IconeCampo = c.icone;
              return (
                <div key={c.rotulo}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <IconeCampo className="w-3.5 h-3.5" />
                      {c.rotulo}
                    </span>
                    {/* Situação nunca só pela cor: ícone + número junto. */}
                    <span className="inline-flex items-center gap-1 tabular-nums font-medium" style={{ color: cor }}>
                      <Situacao className="w-3.5 h-3.5" />
                      {c.pct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${c.pct}%`, background: cor }} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {c.faltam === 0 ? "Todos preenchidos" : `Faltam ${c.faltam}`}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-semibold">Admissões por mês</CardTitle>
            <p className="text-xs text-muted-foreground">
              Entradas nos últimos 12 meses — {m.admissoes12m} no período.
            </p>
          </CardHeader>
          <CardContent>
            {m.admissoes12m > 0 ? (
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={m.meses} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid stroke={COR_GRADE} vertical={false} />
                    <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: COR_EIXO }} tickLine={false}
                           axisLine={{ stroke: COR_GRADE }} minTickGap={12} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: COR_EIXO }} tickLine={false}
                           axisLine={false} width={32} />
                    <Tooltip contentStyle={ESTILO_TOOLTIP} cursor={{ stroke: COR_GRADE, strokeWidth: 1 }}
                             formatter={(v: number) => [`${v}`, "Admissões"]} />
                    {/* Série única: o título já diz o que é, legenda seria repetição. */}
                    <Line type="monotone" dataKey="total" name="Admissões" stroke={COR_SERIE} strokeWidth={2}
                          dot={{ r: 3, strokeWidth: 0, fill: COR_SERIE }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState icon={CalendarDays} title="Sem admissões no período"
                          description="Preencha a data de admissão dos funcionários para ver a evolução." bare />
            )}
          </CardContent>
        </Card>

        {/* Mantém a visão integrada sem dois cartões vazios ocupando meia tela. */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-semibold">Operação</CardTitle>
            <p className="text-xs text-muted-foreground">Resumo dos outros módulos.</p>
          </CardHeader>
          <CardContent className="pt-1">
            <ul className="divide-y divide-border/60">
              <LinhaResumo icone={ClipboardList} rotulo="Inspeções registradas" valor={m.totalInspecoes}
                           detalhe={m.totalInspecoes > 0 ? `${m.inspecoesPendentes} pendentes · ${m.inspecoesComFoto} com foto` : "nenhuma ainda"}
                           aoClicar={() => navigate("/inspecoes-se")} />
              <LinhaResumo icone={Zap} rotulo="Ações do PGR" valor={m.totalAcoes}
                           detalhe={m.totalAcoes > 0 ? undefined : "nenhuma ainda"}
                           aoClicar={() => navigate("/documentacao-sst")} />
              <LinhaResumo icone={MapPin} rotulo="Locais de trabalho" valor={m.totalObras}
                           detalhe={`${m.obrasAtivas} ativos`}
                           aoClicar={() => navigate("/inspecoes-se/obras")} />
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* items-start: sem isso o cartão com menos itens estica até a altura do
          vizinho e fica com meia tela em branco embaixo do gráfico. */}
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <CartaoRanking
          titulo="Quadro por cargo"
          descricao={`${m.cargos.distintos} cargos entre os ativos — os 10 maiores.`}
          dados={m.cargos.itens}
          restantes={m.cargos.restantes}
          restantesTotal={m.cargos.restantesTotal}
          vazio="Preencha o cargo dos funcionários para ver a distribuição."
          icone={Briefcase}
        />
        <CartaoRanking
          titulo="Quadro por GHS / setor"
          descricao={`${m.setores.distintos} ${m.setores.distintos === 1 ? "setor cadastrado" : "setores cadastrados"} entre os ativos.`}
          dados={m.setores.itens}
          restantes={m.setores.restantes}
          restantesTotal={m.setores.restantesTotal}
          vazio="Preencha o GHS/setor dos funcionários para ver a distribuição."
          icone={Layers}
        />
      </div>
    </div>
  );
}

function corDaFaixa(pct: number) {
  if (pct >= LIMITE_BOM) return COR_BOM;
  if (pct >= LIMITE_ATENCAO) return COR_ATENCAO;
  return COR_FALTA;
}

function Kpi({
  label, valor, icone: Icone, tom, nota, aoClicar,
}: {
  label: string;
  valor: number | string;
  icone: typeof Users;
  tom: string;
  nota?: string;
  aoClicar?: () => void;
}) {
  return (
    <Card
      className={`border-border/60 ${aoClicar ? "cursor-pointer hover:border-primary/40 transition-colors" : ""}`}
      onClick={aoClicar}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg shrink-0 ${tom}`}><Icone className="w-5 h-5" /></div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            {/* Sem seta de tendência: não há série por trás dela, e seta que
                não mede nada é enfeite que passa por informação. */}
            <p className="font-bold text-2xl leading-tight">{valor}</p>
          </div>
        </div>
        {nota && <p className="mt-2 text-[11px] text-muted-foreground">{nota}</p>}
      </CardContent>
    </Card>
  );
}

function LinhaResumo({
  icone: Icone, rotulo, valor, detalhe, aoClicar,
}: {
  icone: typeof Users;
  rotulo: string;
  valor: number;
  detalhe?: string;
  aoClicar?: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={aoClicar}
        className="w-full flex items-center justify-between gap-3 py-3 text-left hover:bg-muted/50 rounded-md px-1 -mx-1 transition-colors"
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <Icone className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="min-w-0">
            <span className="block text-sm truncate">{rotulo}</span>
            {detalhe && <span className="block text-[11px] text-muted-foreground truncate">{detalhe}</span>}
          </span>
        </span>
        <span className="text-xl font-bold tabular-nums shrink-0">{valor}</span>
      </button>
    </li>
  );
}

function CartaoRanking({
  titulo, descricao, dados, vazio, icone: Icone, restantes = 0, restantesTotal = 0,
}: {
  titulo: string;
  descricao: string;
  dados: { nome: string; curto: string; total: number }[];
  vazio: string;
  icone: typeof Users;
  restantes?: number;
  restantesTotal?: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold">{titulo}</CardTitle>
        <p className="text-xs text-muted-foreground">{descricao}</p>
      </CardHeader>
      <CardContent>
        {dados.length > 0 ? (
          <div style={{ height: Math.max(150, dados.length * 30 + 30) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 36, left: 0, bottom: 4 }}>
                <CartesianGrid stroke={COR_GRADE} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: COR_EIXO }}
                       tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="curto" width={150} tick={{ fontSize: 11, fill: COR_EIXO }}
                       tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={ESTILO_TOOLTIP}
                  cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.4 }}
                  formatter={(v: number) => [`${v}`, "Funcionários"]}
                  labelFormatter={(_, p) => (p?.[0]?.payload as any)?.nome ?? ""}
                />
                <Bar dataKey="total" name="Funcionários" fill={COR_SERIE} radius={[0, 4, 4, 0]} barSize={16}>
                  <LabelList dataKey="total" position="right" style={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState icon={Icone} title="Sem dados" description={vazio} bare />
        )}
        {restantes > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Mais {restantes} {restantes === 1 ? "item" : "itens"} fora do gráfico, somando {restantesTotal}{" "}
            {restantesTotal === 1 ? "funcionário" : "funcionários"}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
