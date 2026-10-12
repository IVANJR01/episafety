import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, FolderOpen, Users, Info, XCircle, Clock, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { type SituacaoDocumento } from "@/lib/arquivoDigital";

const TABELA_AUSENTE = new Set(["42P01", "PGRST205", "PGRST202"]);
const ehTabelaAusente = (e: any) =>
  !!e && (TABELA_AUSENTE.has(e.code) || /does not exist|schema cache/i.test(e.message || ""));

interface Funcionario {
  id: string; nome: string; cpf: string | null; cargo: string | null;
  setor: string | null; matricula: string | null; data_demissao: string | null;
}

const normalizar = (s: string) =>
  (s || "").normalize("NFD").split("").filter((c) => {
    const n = c.codePointAt(0) || 0;
    return n < 0x0300 || n > 0x036f;
  }).join("").toLowerCase().trim();

/** Contador colorido de pendência, com ícone — nunca só cor. */
function Contador({ valor, icone: Icone, cor, titulo }: {
  valor: number; icone: any; cor: string; titulo: string;
}) {
  if (!valor) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap shadow-2xs ${cor}`}
      title={titulo}>
      <Icone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{valor}</span>
    </span>
  );
}

const getInitials = (name: string) => {
  return name.split(" ").filter(n => n.trim()).slice(0, 2).map(n => n[0]).join("").toUpperCase();
};

/**
 * Dossiê de Colaboradores — a porta de entrada do Arquivo Digital.
 *
 * Lista quem tem pendência primeiro: um dossiê só é útil se a pessoa que
 * abre a tela vê imediatamente de quem precisa cobrar documento.
 */
export default function DossieColaboradores() {
  const navigate = useNavigate();
  const { empresaId, empresaScopeIds, isSuperAdmin } = useAuth();
  const perms = usePermissions("arquivo_digital");

  const [busca, setBusca] = useState("");
  const [soPendentes, setSoPendentes] = useState(false);
  const [incluirDesligados, setIncluirDesligados] = useState(false);
  const [indisponivel, setIndisponivel] = useState(false);

  const { data: funcionarios = [], isLoading } = useQuery({
    queryKey: ["dossie-funcionarios", empresaId, empresaScopeIds.join(",")],
    enabled: perms.canView,
    queryFn: async () => {
      let q = supabase.from("funcionarios")
        .select("id, nome, cpf, cargo, setor, matricula, data_demissao").order("nome");
      if (empresaScopeIds.length && !isSuperAdmin) q = q.in("empresa_id", empresaScopeIds);
      else if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      return (data || []) as Funcionario[];
    },
  });

  const { data: situacoes = [] } = useQuery({
    queryKey: ["dossie-situacoes", empresaId, empresaScopeIds.join(",")],
    enabled: perms.canView,
    queryFn: async () => {
      let q = (supabase.from as any)("internal_documents_situacao")
        .select("colaborador_id, tipo_documento_id, situacao").not("colaborador_id", "is", null);
      if (empresaScopeIds.length && !isSuperAdmin) q = q.in("empresa_id", empresaScopeIds);
      else if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q;
      if (error) { if (ehTabelaAusente(error)) setIndisponivel(true); return []; }
      return (data || []) as { colaborador_id: string; tipo_documento_id: string; situacao: SituacaoDocumento }[];
    },
  });

  const { data: requisitos = [] } = useQuery({
    queryKey: ["dossie-requisitos", empresaId, empresaScopeIds.join(",")],
    enabled: perms.canView,
    queryFn: async () => {
      let q = (supabase.from as any)("internal_document_requirements")
        .select("tipo_documento_id, cargo, obrigatorio");
      if (empresaScopeIds.length && !isSuperAdmin) q = q.in("empresa_id", empresaScopeIds);
      else if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      return (data || []) as { tipo_documento_id: string; cargo: string | null; obrigatorio: boolean }[];
    },
  });

  const porColaborador = useMemo(() => {
    // Para cada colaborador, guarda quais tipos ele JÁ tem situação registrada
    const mapTipos = new Map<string, Set<string>>();
    const m = new Map<string, Partial<Record<SituacaoDocumento, number>>>();
    
    situacoes.forEach((s) => {
      if (!s.colaborador_id) return;
      const atual = m.get(s.colaborador_id) || {};
      atual[s.situacao] = (atual[s.situacao] || 0) + 1;
      m.set(s.colaborador_id, atual);

      const tipos = mapTipos.get(s.colaborador_id) || new Set();
      // Se a única situação do documento for "arquivado", ele não cumpre o requisito.
      // Fingimos que ele não tem o documento para que o loop de requisitos o marque como "Não enviado".
      if (s.situacao !== "arquivado") {
        tipos.add(s.tipo_documento_id);
      }
      mapTipos.set(s.colaborador_id, tipos);
    });

    // Agora cruza com funcionários e requisitos para achar os "nao_enviado" que nunca nasceram
    funcionarios.forEach((f) => {
      const cargo = (f.cargo || "").trim().toLowerCase();
      const tiposQueTem = mapTipos.get(f.id) || new Set();
      const atual = m.get(f.id) || {};

      let faltantes = 0;
      // Para cada requisito, se ele obriga este cargo e o funcionário NÃO tem o tipo registrado:
      requisitos.forEach((r) => {
        if (r.obrigatorio !== false && (!r.cargo || r.cargo.trim().toLowerCase() === cargo)) {
          if (!tiposQueTem.has(r.tipo_documento_id)) faltantes++;
        }
      });

      if (faltantes > 0) {
        atual.nao_enviado = (atual.nao_enviado || 0) + faltantes;
        m.set(f.id, atual);
      }
    });

    return m;
  }, [situacoes, funcionarios, requisitos]);

  const linhas = useMemo(() => {
    const b = normalizar(busca);
    return funcionarios
      .filter((f) => {
        if (!incluirDesligados && f.data_demissao) return false;
        const c = porColaborador.get(f.id) || {};
        const pendencias = (c.vencido || 0) + (c.vence_em_breve || 0) + (c.nao_enviado || 0);
        if (soPendentes && pendencias === 0) return false;
        if (!b) return true;
        /*
         * O CPF só entra na busca com 3 dígitos ou mais.
         *
         * Antes o trecho digitado ia direto para `includes`, e busca sem
         * número nenhum virava `includes("")` — verdadeiro para todo mundo,
         * fazendo a lista inteira casar pelo CPF. A saída tinha sido um
         * caractere NULO como sentinela, o que deixava este arquivo binário
         * para o editor e para as ferramentas de busca. Perguntar pelos
         * dígitos resolve sem sentinela nenhuma.
         */
        const digitos = busca.replace(/\D/g, "");
        return normalizar(f.nome).includes(b)
          || normalizar(f.cargo || "").includes(b)
          || normalizar(f.setor || "").includes(b)
          || (!!f.matricula && f.matricula.includes(busca.trim()))
          || (digitos.length >= 3 && (f.cpf || "").replace(/\D/g, "").includes(digitos));
      })
      .map((f) => ({ f, c: porColaborador.get(f.id) || {} }))
      // Quem tem documento vencido aparece antes de quem só tem a vencer,
      // e ambos antes de quem está em dia.
      .sort((a, b2) => {
        const peso = (c: any) => (c.vencido || 0) * 100 + (c.vence_em_breve || 0) * 10 + (c.nao_enviado || 0);
        const d = peso(b2.c) - peso(a.c);
        return d !== 0 ? d : a.f.nome.localeCompare(b2.f.nome);
      });
  }, [funcionarios, porColaborador, busca, soPendentes, incluirDesligados]);

  // Paginação: 227 colaboradores numa página só é rolagem sem fim, e no
  // celular cada linha vira um cartão alto — pior ainda.
  const [porPagina, setPorPagina] = useState(50);
  const [pagina, setPagina] = useState(1);
  useEffect(() => { setPagina(1); }, [busca, soPendentes, incluirDesligados, porPagina]);

  const totalPaginas = Math.max(1, Math.ceil(linhas.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * porPagina;
  const itensPagina = useMemo(
    () => linhas.slice(inicio, inicio + porPagina),
    [linhas, inicio, porPagina],
  );

  if (!perms.canView) return null;

  const rodape = linhas.length > 0 && (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5 border-t bg-slate-50/50 dark:bg-slate-900/30">
      <p className="text-xs sm:text-sm text-muted-foreground font-medium">
        Mostrando <b>{inicio + 1}</b>–<b>{Math.min(inicio + porPagina, linhas.length)}</b> de <b>{linhas.length}</b> colaboradores
      </p>
      <div className="flex items-center gap-3">
        <Select value={String(porPagina)} onValueChange={(v) => setPorPagina(Number(v))}>
          <SelectTrigger className="h-9 w-[140px] text-xs font-medium"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[25, 50, 100, 200].map((n) => (
              <SelectItem key={n} value={String(n)}>{n} por página</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="icon" variant="outline" className="h-9 w-9" disabled={paginaAtual <= 1}
          onClick={() => setPagina(paginaAtual - 1)} title="Página anterior">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-xs sm:text-sm tabular-nums text-muted-foreground whitespace-nowrap font-medium px-1">
          {paginaAtual} / {totalPaginas}
        </span>
        <Button size="icon" variant="outline" className="h-9 w-9" disabled={paginaAtual >= totalPaginas}
          onClick={() => setPagina(paginaAtual + 1)} title="Próxima página">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  /** Pendências do colaborador — mesma leitura no cartão e na tabela. */
  const Pendencias = ({ c }: { c: any }) => (
    <div className="flex gap-2 flex-wrap items-center">
      <Contador valor={c.vencido || 0} icone={XCircle} titulo="Documentos vencidos"
        cor="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900" />
      <Contador valor={c.vence_em_breve || 0} icone={Clock} titulo="Documentos vencendo em breve"
        cor="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900" />
      <Contador valor={c.nao_enviado || 0} icone={AlertCircle} titulo="Documentos obrigatórios não enviados"
        cor="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900" />
      {!(c.vencido || c.vence_em_breve || c.nao_enviado) && (
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-full whitespace-nowrap font-medium shadow-2xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Em dia</span>
        </span>
      )}
    </div>
  );

  return (
    <div className="w-full space-y-5">

      {indisponivel && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-800 flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            O Arquivo Digital ainda não foi ativado neste banco (migrations pendentes).
          </CardContent>
        </Card>
      )}

      <Card className="shadow-xs border border-border/80">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, CPF, matrícula, função ou setor…"
                className="h-11 pl-10 pr-4 text-sm bg-muted/20 border-slate-200 dark:border-slate-800 focus:bg-background rounded-lg"
              />
            </div>
            <div className="flex items-center gap-4 bg-muted/40 px-4 py-2 rounded-lg border border-muted">
              <label className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer hover:opacity-80 transition-opacity select-none font-medium">
                <Checkbox checked={soPendentes} onCheckedChange={(v) => setSoPendentes(!!v)} className="rounded-[4px] h-4 w-4" />
                Só com pendência
              </label>
              <label className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer hover:opacity-80 transition-opacity select-none font-medium">
                <Checkbox checked={incluirDesligados} onCheckedChange={(v) => setIncluirDesligados(!!v)} className="rounded-[4px] h-4 w-4" />
                Incluir desligados
              </label>
            </div>
            <div className="ml-auto">
              <Badge variant="secondary" className="text-xs sm:text-sm font-semibold px-3.5 py-1.5 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 rounded-lg">
                {linhas.length} colaborador(es)
              </Badge>
            </div>
          </div>

          {/* Celular: cartões */}
          <div className="space-y-3 lg:hidden">
            {isLoading && <p className="text-center py-8 text-sm text-muted-foreground">Carregando…</p>}
            {!isLoading && linhas.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum colaborador encontrado.</p>
              </div>
            )}
            {itensPagina.map(({ f, c }) => (
              <button
                key={f.id}
                type="button"
                onClick={() => navigate(`/arquivo-digital/dossie/${f.id}`)}
                className={`w-full text-left rounded-xl border p-4 active:bg-muted/60 transition-colors shadow-2xs ${f.data_demissao ? "opacity-60 bg-muted/20" : "bg-card"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-sm shrink-0">
                      {getInitials(f.nome)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm flex items-center gap-2 flex-wrap text-foreground">
                        {f.nome}
                        {f.data_demissao && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">Desligado</Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {[f.cargo, f.setor].filter(Boolean).join(" • ") || "Sem função e setor"}
                      </p>
                      {f.matricula && <p className="text-[11px] text-muted-foreground font-mono">Mat. {f.matricula}</p>}
                    </div>
                  </div>
                  <FolderOpen className="w-5 h-5 text-primary shrink-0 mt-1" />
                </div>
                <div className="mt-3 pt-2.5 border-t border-border/40"><Pendencias c={c} /></div>
              </button>
            ))}
            {rodape}
          </div>

          {/* Desktop: Tabela Ampla e Confortável */}
          <div className="rounded-xl border overflow-x-auto hidden lg:block shadow-xs bg-card">
            <Table>
              <TableHeader>
                <TableRow className="h-12 bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800">
                  <TableHead className="py-3.5 px-6 min-w-[320px] text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Colaborador
                  </TableHead>
                  <TableHead className="py-3.5 px-6 min-w-[200px] text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Função
                  </TableHead>
                  <TableHead className="py-3.5 px-6 min-w-[180px] text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Setor
                  </TableHead>
                  <TableHead className="py-3.5 px-6 min-w-[200px] text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Pendências
                  </TableHead>
                  <TableHead className="py-3.5 px-6 text-right w-[140px] text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Dossiê
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Carregando colaboradores…</TableCell></TableRow>
                )}
                {!isLoading && linhas.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Nenhum colaborador encontrado.
                  </TableCell></TableRow>
                )}
                {itensPagina.map(({ f, c }) => (
                  <TableRow
                    key={f.id}
                    className={`h-18 hover:bg-slate-50/90 dark:hover:bg-slate-900/60 transition-colors border-b border-slate-100 dark:border-slate-800/80 cursor-pointer ${
                      f.data_demissao ? "opacity-60 bg-slate-50/40" : ""
                    }`}
                    onClick={() => navigate(`/arquivo-digital/dossie/${f.id}`)}
                  >
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs select-none">
                          {getInitials(f.nome)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="font-semibold text-sm sm:text-[15px] text-slate-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                            <span className="truncate">{f.nome}</span>
                            {f.data_demissao && (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal border-slate-300">
                                Desligado
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            {f.matricula && (
                              <span className="font-mono">Matrícula: {f.matricula}</span>
                            )}
                            {f.cpf && (
                              <span className="text-[11px] opacity-80">CPF: {f.cpf}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-6 text-sm font-medium text-slate-800 dark:text-slate-200">
                      {f.cargo || "—"}
                    </TableCell>
                    <TableCell className="py-4 px-6 text-sm font-medium text-slate-600 dark:text-slate-400">
                      {f.setor || "—"}
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <Pendencias c={c} />
                    </TableCell>
                    <TableCell className="py-4 px-6 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 px-3.5 text-xs font-semibold rounded-lg bg-background hover:bg-primary hover:text-primary-foreground border-slate-200 dark:border-slate-700 shadow-2xs transition-all gap-1.5 ml-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/arquivo-digital/dossie/${f.id}`);
                        }}
                      >
                        <FolderOpen className="w-4 h-4 mr-0.5" />
                        Abrir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="hidden lg:block">{rodape}</div>
        </CardContent>
      </Card>
    </div>
  );
}
