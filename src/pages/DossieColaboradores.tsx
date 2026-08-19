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
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${cor}`}
      title={titulo}>
      <Icone className="w-3.5 h-3.5" aria-hidden="true" />{valor}
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
      tipos.add(s.tipo_documento_id);
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
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <p className="text-xs text-muted-foreground">
        Mostrando {inicio + 1}–{Math.min(inicio + porPagina, linhas.length)} de {linhas.length}
      </p>
      <div className="flex items-center gap-2">
        <Select value={String(porPagina)} onValueChange={(v) => setPorPagina(Number(v))}>
          <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[25, 50, 100, 200].map((n) => (
              <SelectItem key={n} value={String(n)}>{n} por página</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="icon" variant="outline" className="h-8 w-8" disabled={paginaAtual <= 1}
          onClick={() => setPagina(paginaAtual - 1)} title="Página anterior">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
          {paginaAtual} / {totalPaginas}
        </span>
        <Button size="icon" variant="outline" className="h-8 w-8" disabled={paginaAtual >= totalPaginas}
          onClick={() => setPagina(paginaAtual + 1)} title="Próxima página">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  /** Pendências do colaborador — mesma leitura no cartão e na tabela. */
  const Pendencias = ({ c }: { c: any }) => (
    <div className="flex gap-1.5 flex-wrap">
      <Contador valor={c.vencido || 0} icone={XCircle} titulo="Vencidos"
        cor="bg-red-50 text-red-700 border-red-200" />
      <Contador valor={c.vence_em_breve || 0} icone={Clock} titulo="Vencendo"
        cor="bg-orange-50 text-orange-700 border-orange-200" />
      <Contador valor={c.nao_enviado || 0} icone={AlertCircle} titulo="Não enviados"
        cor="bg-amber-50 text-amber-700 border-amber-200" />
      {!(c.vencido || c.vence_em_breve || c.nao_enviado) && (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full whitespace-nowrap font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />Sem pendência
        </span>
      )}
    </div>
  );

  return (
    <div className="space-y-4 max-w-6xl mx-auto">

      {indisponivel && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-800 flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            O Arquivo Digital ainda não foi ativado neste banco (migrations pendentes).
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[280px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, CPF, matrícula, função ou setor…" className="pl-8 bg-muted/20" />
            </div>
            <div className="flex items-center gap-4 bg-muted/40 px-3 py-1.5 rounded-md border border-muted">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer hover:opacity-80 transition-opacity">
                <Checkbox checked={soPendentes} onCheckedChange={(v) => setSoPendentes(!!v)} className="rounded-[4px]" />
                Só com pendência
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer hover:opacity-80 transition-opacity">
                <Checkbox checked={incluirDesligados} onCheckedChange={(v) => setIncluirDesligados(!!v)} className="rounded-[4px]" />
                Incluir desligados
              </label>
            </div>
            <div className="ml-auto">
               <Badge variant="secondary" className="font-normal">{linhas.length} colaborador(es)</Badge>
            </div>
          </div>

          {/* Celular: cartões. Tabela de 5 colunas em tela estreita vira
              rolagem lateral, e o botão Abrir — o motivo de a tela existir —
              fica justamente na coluna que some da vista. */}
          <div className="space-y-2 lg:hidden">
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
                className={`w-full text-left rounded-lg border p-3 active:bg-muted/60 transition-colors ${f.data_demissao ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm flex items-center gap-2 flex-wrap">
                      {f.nome}
                      {f.data_demissao && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">Desligado</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[f.cargo, f.setor].filter(Boolean).join(" • ") || "Sem função e setor"}
                    </p>
                    {f.matricula && <p className="text-[11px] text-muted-foreground">Mat. {f.matricula}</p>}
                  </div>
                  <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                </div>
                <div className="mt-2"><Pendencias c={c} /></div>
              </button>
            ))}
            {rodape}
          </div>

          <div className="rounded-lg border overflow-x-auto hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Colaborador</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Pendências</TableHead>
                  <TableHead className="text-right">Dossiê</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
                )}
                {!isLoading && linhas.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <Users className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    Nenhum colaborador encontrado.
                  </TableCell></TableRow>
                )}
                {itensPagina.map(({ f, c }) => (
                  <TableRow key={f.id} className={`hover:bg-muted/30 transition-colors ${f.data_demissao ? "opacity-60" : ""}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 select-none">
                          {getInitials(f.nome)}
                        </div>
                        <div className="flex flex-col">
                          <div className="font-semibold text-[13px] flex items-center gap-2">
                            {f.nome}
                            {f.data_demissao && (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal">Desligado</Badge>
                            )}
                          </div>
                          {f.matricula && (
                            <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                              Matrícula: {f.matricula}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{f.cargo || "—"}</TableCell>
                    <TableCell className="text-sm">{f.setor || "—"}</TableCell>
                    <TableCell><Pendencias c={c} /></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className="h-8 text-xs"
                        onClick={() => navigate(`/arquivo-digital/dossie/${f.id}`)}>
                        <FolderOpen className="w-3.5 h-3.5 mr-1" />Abrir
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
