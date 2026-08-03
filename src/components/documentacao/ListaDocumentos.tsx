import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Copy, Eye, FileText, History, Loader2, MoreHorizontal, Plus, Search, SquarePen,
} from "lucide-react";
import { PGR_STATUS_COLOR, PGR_STATUS_LABEL, PgrStatus } from "@/lib/pgrTypes";

const TIPOS = [
  { id: "todos", rotulo: "Todos os tipos" },
  { id: "pgr", rotulo: "PGR" },
  { id: "ltcat", rotulo: "LTCAT" },
  { id: "ppp", rotulo: "PPP" },
];

interface Documento {
  id: string;
  tipo: "pgr" | "ltcat" | "ppp";
  nome: string;
  unidade: string;
  versao: string | number;
  status: string;
  atualizado_em: string | null;
  responsavel: string | null;
  progresso: number | null;
  rota: string;
}

/**
 * Lista dos documentos da empresa — os documentos em si, não os tipos.
 *
 * O progresso do PGR é calculado a partir do que existe no banco (etapas com
 * registro). Um documento cujo progresso não pôde ser calculado mostra "—",
 * nunca 0%: "não sei" é diferente de "nada preenchido".
 */
/** Abaixo disto a lista cabe na tela e filtrar não economiza nada. */
const FILTROS_A_PARTIR_DE = 3;

export function ListaDocumentos() {
  const navigate = useNavigate();
  const { empresaId, empresaScopeIds, isSuperAdmin } = useAuth();

  const [tipo, setTipo] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [unidadeFiltro, setUnidadeFiltro] = useState("todas");
  const [busca, setBusca] = useState("");

  const { data: unidades = [] } = useQuery({
    queryKey: ["doc-unidades", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("empresa_config")
        .select("id,nome,nome_fantasia")
        .or(`id.eq.${empresaId},empresa_pai_id.eq.${empresaId}`);
      return (data || []) as any[];
    },
  });

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["doc-lista", empresaId, empresaScopeIds.join(",")],
    enabled: !!empresaId,
    queryFn: async () => {
      const escopo = (q: any) =>
        empresaScopeIds.length && !isSuperAdmin
          ? q.in("empresa_id", empresaScopeIds)
          : q.eq("empresa_id", empresaId);

      /** Uma consulta que falha devolve [] — a lista mostra o que conseguiu ler. */
      const buscar = async (tabela: string) => {
        const { data, error } = await escopo(
          (supabase.from as any)(tabela).select("*"),
        ).order("created_at", { ascending: false });
        return error ? [] : (data || []);
      };

      const [pgrs, ltcats, ppps] = await Promise.all([
        buscar("pgr_documentos"), buscar("ltcat_documentos"), buscar("ppp_documentos"),
      ]);

      // Contagens por PGR para estimar o progresso sem N consultas por linha.
      const idsPgr = pgrs.map((p: any) => p.id);
      const contarPor = async (tabela: string) => {
        if (idsPgr.length === 0) return new Set<string>();
        const { data } = await (supabase.from as any)(tabela)
          .select("pgr_id").in("pgr_id", idsPgr);
        return new Set((data || []).map((r: any) => r.pgr_id));
      };
      const [comInv, comAcoes, comResp, comLev] = await Promise.all([
        contarPor("pgr_inventario_itens"),
        contarPor("pgr_acoes"),
        contarPor("pgr_responsaveis"),
        contarPor("pgr_levantamento_preliminar"),
      ]);

      const linhas: Documento[] = [
        ...pgrs.map((p: any) => {
          const marcos = [
            !!(p.data_emissao || p.escopo),
            !!(p.cnpj_snapshot || p.cnae_principal),
            comLev.has(p.id),
            comInv.has(p.id),
            comAcoes.has(p.id),
            comResp.has(p.id) || !!(p.resp_tec_nome || "").trim(),
          ];
          return {
            id: p.id,
            tipo: "pgr" as const,
            nome: `PGR ${p.data_vigencia_inicio?.slice(0, 4) || ""}`.trim(),
            unidade: p.unidade_id || p.empresa_id,
            versao: p.versao,
            status: p.status,
            atualizado_em: p.updated_at || p.created_at,
            responsavel: p.resp_tec_nome || null,
            progresso: Math.round((marcos.filter(Boolean).length / marcos.length) * 100),
            rota: `/pgr/${p.id}`,
          };
        }),
        ...ltcats.map((l: any) => ({
          id: l.id, tipo: "ltcat" as const,
          nome: `LTCAT ${l.data_emissao?.slice(0, 4) || ""}`.trim(),
          unidade: l.unidade_id || l.empresa_id,
          versao: l.versao ?? 1, status: l.status || "rascunho",
          atualizado_em: l.updated_at || l.created_at,
          responsavel: l.resp_tec_nome || null,
          progresso: null, rota: `/ltcat/${l.id}`,
        })),
        ...ppps.map((p: any) => ({
          id: p.id, tipo: "ppp" as const,
          nome: `PPP ${p.funcionario_nome || ""}`.trim(),
          unidade: p.empresa_id,
          versao: p.versao ?? 1, status: p.status || "rascunho",
          atualizado_em: p.updated_at || p.created_at,
          responsavel: null, progresso: null, rota: `/ppp/${p.id}`,
        })),
      ];
      return linhas;
    },
  });

  const nomeUnidade = (id: string) => {
    const u = unidades.find((x: any) => x.id === id);
    return u?.nome_fantasia || u?.nome || "—";
  };

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return docs.filter((d) => {
      if (tipo !== "todos" && d.tipo !== tipo) return false;
      if (status !== "todos" && d.status !== status) return false;
      if (unidadeFiltro !== "todas" && d.unidade !== unidadeFiltro) return false;
      if (q && !`${d.nome} ${nomeUnidade(d.unidade)} ${d.responsavel || ""}`
        .toLowerCase().includes(q)) return false;
      return true;
    });
  }, [docs, tipo, status, unidadeFiltro, busca, unidades]);

  return (
    <div className="space-y-4">
      {/* Sem botão "Novo documento": ele dizia "documento" e ia direto para
          /pgr/novo — só criava PGR. O grid de tipos acima é o caminho honesto,
          com um destino por tipo. */}
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
        <h2 className="text-lg font-semibold">Documentos da empresa</h2>
        {docs.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {docs.length === 1 ? "1 documento" : `${docs.length} documentos`}
          </span>
        )}
      </div>

      {/* Quatro filtros para um punhado de documentos ocupavam mais altura que
          a própria lista. Só aparecem quando há o que filtrar. */}
      {docs.length > FILTROS_A_PARTIR_DE && (
      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Pesquisar</Label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-3 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)}
                placeholder="Nome, unidade ou responsável" className="pl-8 h-11" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de documento</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => <SelectItem key={t.id} value={t.id}>{t.rotulo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(PGR_STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Unidade</Label>
            <Select value={unidadeFiltro} onValueChange={setUnidadeFiltro}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {unidades.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>{u.nome_fantasia || u.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      )}

      {isLoading ? (
        <Card><CardContent className="p-8 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando documentos…
        </CardContent></Card>
      ) : filtrados.length === 0 ? (
        <Card><CardContent className="p-10 text-center space-y-3">
          <FileText className="h-10 w-10 mx-auto opacity-25" />
          <p className="text-sm text-muted-foreground">
            {docs.length === 0
              ? "Nenhum documento criado ainda."
              : "Nenhum documento corresponde aos filtros."}
          </p>
          {docs.length === 0 && (
            <Button onClick={() => navigate("/pgr/novo")}>
              <Plus className="h-4 w-4 mr-2" /> Criar o primeiro PGR
            </Button>
          )}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtrados.map((d) => (
            <Card key={`${d.tipo}-${d.id}`} className="hover:border-primary/40 transition">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{d.nome}</span>
                    <Badge variant="outline" className="text-[11px] uppercase">{d.tipo}</Badge>
                    <Badge variant="outline" className="text-[11px] font-mono">v{d.versao}</Badge>
                    <Badge variant="outline"
                      className={`text-[11px] ${PGR_STATUS_COLOR[d.status as PgrStatus] || ""}`}>
                      {PGR_STATUS_LABEL[d.status as PgrStatus] || d.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {nomeUnidade(d.unidade)}
                    {d.responsavel && ` · ${d.responsavel}`}
                    {d.atualizado_em &&
                      ` · atualizado em ${new Date(d.atualizado_em).toLocaleDateString("pt-BR")}`}
                  </p>
                </div>

                <div className="shrink-0 w-full sm:w-36">
                  {d.progresso == null ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${d.progresso}%` }} />
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {d.progresso}% preenchido
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" onClick={() => navigate(d.rota)} className="h-10">
                    <SquarePen className="h-4 w-4 mr-1" /> Abrir
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-10 w-10 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => navigate(`${d.rota}${d.tipo === "pgr" ? "?etapa=emissao" : ""}`)}>
                        <Eye className="h-4 w-4 mr-2" /> Visualizar documento
                      </DropdownMenuItem>
                      {d.tipo === "pgr" && (
                        <>
                          <DropdownMenuItem onClick={() => navigate(`/pgr/${d.id}/estrutura`)}>
                            <History className="h-4 w-4 mr-2" /> Estrutura técnica
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/pgr/novo?copiar=${d.id}`)}>
                            <Copy className="h-4 w-4 mr-2" /> Duplicar
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
