/*
 * Painel "Análise de EPI", no fim do Dashboard.
 *
 * Quatro respostas que o painel não dava:
 *  - em quantos dias cada EPI acaba, pelo consumo de verdade (item 2);
 *  - quanto tempo cada EPI dura na mão do trabalhador, e quem troca muito
 *    mais rápido que os colegas (item 3);
 *  - tudo isso filtrável por período, GES e setor (item 4);
 *  - em que dia da semana e hora o almoxarifado mais entrega (item 6).
 *
 * As contas ficam em src/lib/analiseEpi.ts, com teste. Aqui só se desenha.
 */
import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Activity, CalendarDays, Clock, Hourglass, Repeat } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  previsaoDeEstoque, usoRealPorEpi, trocasRapidas, porDiaDaSemana, porHoraDoDia, filtrar, diasAntes,
  type MovimentoEpi, type EpiComEstoque, type PrevisaoEstoque,
} from "@/lib/analiseEpi";

interface Funcionario { id: string; nome: string; ghe_id?: string | null; setor?: string | null }
interface Ghe { id: string; codigo: string; nome: string }

interface Props {
  epis: EpiComEstoque[];
  entregas: MovimentoEpi[];
  funcionarios: Funcionario[];
}

const PERIODOS = [
  { valor: "30", rotulo: "Últimos 30 dias" },
  { valor: "60", rotulo: "Últimos 60 dias" },
  { valor: "90", rotulo: "Últimos 90 dias" },
  { valor: "180", rotulo: "Últimos 6 meses" },
  { valor: "365", rotulo: "Último ano" },
  { valor: "tudo", rotulo: "Todo o histórico" },
];

const SITUACAO: Record<PrevisaoEstoque["situacao"], { rotulo: string; cor: string }> = {
  zerado: { rotulo: "Zerado", cor: "bg-red-600 text-white" },
  critico: { rotulo: "Crítico", cor: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" },
  atencao: { rotulo: "Atenção", cor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  ok: { rotulo: "OK", cor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
  sem_consumo: { rotulo: "Sem consumo", cor: "bg-muted text-muted-foreground" },
};

const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const dias = (n: number) => (n < 10 ? n.toFixed(1).replace(".", ",") : String(Math.round(n)));

const estiloTooltip = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 };

export default function AnaliseEpi({ epis, entregas, funcionarios }: Props) {
  const { empresaScopeIds } = useAuth();
  const [periodo, setPeriodo] = useState("90");
  const [ghe, setGhe] = useState("todos");
  const [setor, setSetor] = useState("todos");
  const [ghes, setGhes] = useState<Ghe[]>([]);

  /* Nomes dos GHEs. Sem internet a lista fica vazia e o filtro mostra o que der. */
  const escopo = empresaScopeIds.join(",");
  useEffect(() => {
    let q = supabase.from("ghe_ges").select("id, codigo, nome");
    if (escopo) q = q.in("empresa_id", escopo.split(","));
    q.order("codigo").then(({ data }) => setGhes((data as Ghe[]) || []), () => setGhes([]));
  }, [escopo]);

  const hoje = hojeIso();
  const nomeFunc = useMemo(() => new Map(funcionarios.map((f) => [f.id, f.nome])), [funcionarios]);
  const nomeEpi = useMemo(() => new Map(epis.map((e) => [e.id, e.nome])), [epis]);

  /* Só os GHEs e setores que têm alguém, para o filtro não oferecer opção vazia. */
  const ghesUsados = useMemo(() => {
    const ids = new Set(funcionarios.map((f) => f.ghe_id).filter(Boolean) as string[]);
    return ghes.filter((g) => ids.has(g.id));
  }, [ghes, funcionarios]);
  const setores = useMemo(() =>
    [...new Set(funcionarios.map((f) => (f.setor || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
  [funcionarios]);

  const filtrados = useMemo(() => {
    const grupo = ghe === "todos" && setor === "todos" ? null : new Set(funcionarios
      .filter((f) => (ghe === "todos" || f.ghe_id === ghe) && (setor === "todos" || (f.setor || "").trim() === setor))
      .map((f) => f.id));
    return filtrar(entregas, { desde: periodo === "tudo" ? undefined : diasAntes(hoje, Number(periodo)), funcionarios: grupo });
  }, [entregas, funcionarios, ghe, setor, periodo, hoje]);

  /*
   * A previsão de estoque olha a empresa toda nos últimos 90 dias: o estoque
   * é um só, e prever com 30 dias de um setor diria que ele dura para sempre.
   */
  const previsao = useMemo(() => previsaoDeEstoque(epis, entregas, hoje, 90), [epis, entregas, hoje]);
  const usoReal = useMemo(() => usoRealPorEpi(filtrados), [filtrados]);
  const rapidas = useMemo(() => trocasRapidas(filtrados), [filtrados]);
  const semana = useMemo(() => porDiaDaSemana(filtrados), [filtrados]);
  const horas = useMemo(() => porHoraDoDia(filtrados).filter((h) => {
    const n = Number(h.hora.slice(0, 2));
    return n >= 5 && n <= 22;
  }), [filtrados]);

  const alertas = previsao.filter((p) => p.situacao === "zerado" || p.situacao === "critico" || p.situacao === "atencao");
  const listaEstoque = (alertas.length ? alertas : previsao.filter((p) => p.situacao === "ok")).slice(0, 10);
  const temEntregas = filtrados.some((m) => m.tipo !== "devolucao");

  return (
    <Card className="border-border/60">
      <CardHeader className="px-3 pb-3 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <Activity className="h-4 w-4 text-primary" /> Análise de EPI
          </CardTitle>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:w-[560px]">
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger aria-label="Período"><SelectValue /></SelectTrigger>
              <SelectContent>{PERIODOS.map((p) => <SelectItem key={p.valor} value={p.valor}>{p.rotulo}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={ghe} onValueChange={setGhe}>
              <SelectTrigger aria-label="GES"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os GES</SelectItem>
                {ghesUsados.map((g) => <SelectItem key={g.id} value={g.id}>{g.codigo} — {g.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={setor} onValueChange={setSetor}>
              <SelectTrigger aria-label="Setor"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os setores</SelectItem>
                {setores.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-4 px-3 sm:px-6 lg:grid-cols-2 [&>section]:min-w-0 [&_td]:px-2 [&_th]:px-2 sm:[&_td]:px-4 sm:[&_th]:px-4">
        {/* Item 2 — previsão de estoque */}
        <section className="rounded-lg border p-3 lg:col-span-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Hourglass className="h-4 w-4" /> Quanto tempo o estoque dura</h3>
          <p className="mb-2 text-xs text-muted-foreground">Pelo consumo dos últimos 90 dias da empresa toda. {alertas.length
            ? `${alertas.length} EPI${alertas.length > 1 ? "s acabam" : " acaba"} em até 30 dias.`
            : "Nenhum EPI acaba nos próximos 30 dias."}</p>
          {listaEstoque.length === 0 ? (
            <EmptyState icon={Hourglass} title="Sem consumo registrado" description="A previsão aparece quando houver entregas nos últimos 90 dias." bare />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>EPI</TableHead><TableHead className="hidden text-right sm:table-cell">Estoque</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Saída por mês</TableHead><TableHead className="whitespace-nowrap text-right">Dura</TableHead><TableHead>Situação</TableHead>
                </TableRow></TableHeader>
                <TableBody>{listaEstoque.map((p) => (
                  <TableRow key={p.epi.id}>
                    <TableCell className="max-w-[130px] truncate font-medium sm:max-w-[260px]">{p.epi.nome}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{p.epi.estoque}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{Math.round(p.porDia * 30)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{p.dias === null ? "—" : `${p.dias} dias`}</TableCell>
                    <TableCell><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SITUACAO[p.situacao].cor}`}>{SITUACAO[p.situacao].rotulo}</span></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
          )}
        </section>

        {/* Item 3 — tempo de uso real */}
        <section className="rounded-lg border p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Clock className="h-4 w-4" /> Quanto tempo cada EPI dura com o trabalhador</h3>
          <p className="mb-2 text-xs text-muted-foreground">Média de dias entre uma entrega e a próxima do mesmo EPI à mesma pessoa.</p>
          {usoReal.length === 0 ? (
            <EmptyState icon={Clock} title="Ainda sem trocas no período" description="Aparece quando alguém recebe o mesmo EPI pela segunda vez." bare />
          ) : (
            <div className="max-h-72 overflow-y-auto">
              <Table>
                <TableHeader><TableRow><TableHead>EPI</TableHead><TableHead className="whitespace-nowrap text-right">Dura em média</TableHead><TableHead className="hidden text-right sm:table-cell">Trocas</TableHead></TableRow></TableHeader>
                <TableBody>{usoReal.map((u) => (
                  <TableRow key={u.epi_id}>
                    <TableCell className="max-w-[160px] truncate sm:max-w-[220px]">{nomeEpi.get(u.epi_id) || "EPI removido"}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{dias(u.mediaDias)} dias</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{u.amostras}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
          )}
        </section>

        <section className="rounded-lg border p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Repeat className="h-4 w-4" /> Quem troca muito mais rápido que os colegas</h3>
          <p className="mb-2 text-xs text-muted-foreground">Metade do tempo dos colegas, ou menos, com 2 trocas ou mais. Vale conversar: uso errado, tarefa mais pesada ou EPI fraco.</p>
          {rapidas.length === 0 ? (
            <EmptyState icon={Repeat} title="Ninguém fora do normal" description="Nenhum trabalhador troca EPI muito mais rápido que os colegas no período." bare />
          ) : (
            <div className="max-h-72 overflow-y-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Trabalhador / EPI</TableHead><TableHead className="whitespace-nowrap text-right">A cada</TableHead><TableHead className="whitespace-nowrap text-right">Colegas</TableHead></TableRow></TableHeader>
                <TableBody>{rapidas.map((r) => (
                  <TableRow key={`${r.funcionario_id}|${r.epi_id}`}>
                    <TableCell className="max-w-[180px]">
                      <div className="truncate font-medium">{nomeFunc.get(r.funcionario_id) || "—"}</div>
                      <div className="truncate text-xs text-muted-foreground">{nomeEpi.get(r.epi_id) || "—"}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-red-600">{dias(r.mediaDias)} d</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{dias(r.mediaDoEpi)} d</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
          )}
        </section>

        {/* Item 6 — quando o almoxarifado trabalha */}
        <section className="rounded-lg border p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4" /> Entregas por dia da semana</h3>
          {!temEntregas ? <EmptyState icon={CalendarDays} title="Sem entregas no período" description="Mude o período ou os filtros." bare /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={semana} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={estiloTooltip} formatter={(v: number) => [`${v} un.`, "Entregues"]} />
                <Bar dataKey="quantidade" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="rounded-lg border p-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Clock className="h-4 w-4" /> Entregas por hora do dia</h3>
          <p className="text-xs text-muted-foreground">Hora em que a entrega foi lançada no sistema.</p>
          {!temEntregas ? <EmptyState icon={Clock} title="Sem entregas no período" description="Mude o período ou os filtros." bare /> : (
            <ResponsiveContainer width="100%" height={184}>
              <BarChart data={horas} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="hora" tick={{ fontSize: 10 }} interval={1} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={estiloTooltip} formatter={(v: number) => [`${v} un.`, "Entregues"]} />
                <Bar dataKey="quantidade" fill="hsl(var(--primary) / 0.75)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
