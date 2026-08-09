import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertTriangle, Clock, CheckCircle2, Archive, FileStack, ExternalLink, FolderOpen, Search, Info,
} from "lucide-react";
import SituacaoBadge from "@/components/arquivo-digital/SituacaoBadge";
import {
  urlTemporaria, registrarAcesso, ROTULO_SITUACAO, PESO_SITUACAO, type SituacaoDocumento,
} from "@/lib/arquivoDigital";

const TABELA_AUSENTE = new Set(["42P01", "PGRST205", "PGRST202"]);
const ehTabelaAusente = (e: any) =>
  !!e && (TABELA_AUSENTE.has(e.code) || /does not exist|schema cache/i.test(e.message || ""));

const dataBr = (iso?: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

interface DocSituacao {
  id: string; empresa_id: string; colaborador_id: string | null; tipo_documento_id: string;
  tipo_nome: string; situacao: SituacaoDocumento; data_validade: string | null;
  dias_para_vencer: number | null; caminho_arquivo: string | null; versao_id: string | null;
}
interface Funcionario { id: string; nome: string; cargo: string | null; empresa_id: string | null }
interface Requisito { tipo_documento_id: string; cargo: string | null; obrigatorio: boolean }
interface Tipo { id: string; nome: string }

/** Uma linha do painel — documento real ou pendência derivada de requisito. */
interface Linha {
  chave: string;
  colaboradorId: string | null;
  colaborador: string;
  tipoNome: string;
  situacao: SituacaoDocumento;
  dataValidade: string | null;
  diasParaVencer: number | null;
  doc: DocSituacao | null;
}

function Kpi({ label, value, icon: Icon, color, ativo, onClick }: {
  label: string; value: number; icon: any; color: string; ativo?: boolean; onClick?: () => void;
}) {
  return (
    <Card className={ativo ? "ring-2 ring-primary" : undefined}>
      <CardContent className="p-4 flex items-center gap-3 cursor-pointer" onClick={onClick}>
        <div className={`p-2 rounded-lg ${color}`}><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Painel de vencimentos do Arquivo Digital.
 *
 * Serve os três itens de menu (Vencidos / Vencendo / Não enviados) pela
 * URL (`?situacao=`). "Não enviado" NÃO sai da view: a view só tem linha
 * para documento que existe. A pendência de verdade — tipo exigido da
 * função e nunca anexado — é cruzada aqui entre colaboradores e
 * requisitos, senão a tela mais importante viria sempre vazia.
 */
export default function PainelVencimentos() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { empresaId, empresaScopeIds, isSuperAdmin, user } = useAuth();
  const perms = usePermissions("arquivo_digital");

  const filtroSituacao = searchParams.get("situacao") || "todos";
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [indisponivel, setIndisponivel] = useState(false);

  const definirSituacao = (v: string) => {
    const p = new URLSearchParams(searchParams);
    if (v === "todos") p.delete("situacao"); else p.set("situacao", v);
    setSearchParams(p, { replace: true });
  };

  const escopo = (q: any) => {
    if (empresaScopeIds.length && !isSuperAdmin) return q.in("empresa_id", empresaScopeIds);
    if (empresaId) return q.eq("empresa_id", empresaId);
    return q;
  };

  const { data: documentos = [] } = useQuery({
    queryKey: ["arquivo-digital-vencimentos", empresaId, empresaScopeIds.join(",")],
    enabled: perms.canView,
    queryFn: async () => {
      const { data, error } = await escopo(
        (supabase.from as any)("internal_documents_situacao")
          .select("id, empresa_id, colaborador_id, tipo_documento_id, tipo_nome, situacao, data_validade, dias_para_vencer, caminho_arquivo, versao_id")
          .not("colaborador_id", "is", null),
      ).order("dias_para_vencer", { ascending: true, nullsFirst: false });
      if (error) { if (ehTabelaAusente(error)) setIndisponivel(true); return []; }
      return (data || []) as DocSituacao[];
    },
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["arquivo-digital-venc-func", empresaId, empresaScopeIds.join(",")],
    enabled: perms.canView,
    queryFn: async () => {
      const { data } = await escopo(
        supabase.from("funcionarios").select("id, nome, cargo, empresa_id").is("data_demissao", null),
      );
      return (data || []) as Funcionario[];
    },
  });

  const { data: requisitos = [] } = useQuery({
    queryKey: ["arquivo-digital-venc-req", empresaId],
    enabled: perms.canView && !!empresaId,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("internal_document_requirements")
        .select("tipo_documento_id, cargo, obrigatorio").eq("empresa_id", empresaId);
      return (data || []) as Requisito[];
    },
  });

  const { data: tipos = [] } = useQuery({
    queryKey: ["arquivo-digital-venc-tipos"],
    enabled: perms.canView,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("internal_document_types")
        .select("id, nome").eq("ativo", true);
      return (data || []) as Tipo[];
    },
  });

  const nomePorColaborador = useMemo(() => new Map(funcionarios.map((f) => [f.id, f.nome])), [funcionarios]);
  const nomePorTipo = useMemo(() => new Map(tipos.map((t) => [t.id, t.nome])), [tipos]);

  /** Documentos reais + pendências derivadas dos requisitos por função. */
  const todasLinhas = useMemo<Linha[]>(() => {
    const reais: Linha[] = documentos.map((d) => ({
      chave: d.id,
      colaboradorId: d.colaborador_id,
      colaborador: (d.colaborador_id && nomePorColaborador.get(d.colaborador_id)) || "—",
      tipoNome: d.tipo_nome,
      situacao: d.situacao,
      dataValidade: d.data_validade,
      diasParaVencer: d.dias_para_vencer,
      doc: d,
    }));

    // Cruzamento: para cada colaborador ativo, todo tipo que a função dele
    // exige e que não tem documento nenhum vira "Não enviado".
    const temDoc = new Set(documentos.map((d) => `${d.colaborador_id}|${d.tipo_documento_id}`));
    const faltantes: Linha[] = [];
    funcionarios.forEach((f) => {
      const cargo = (f.cargo || "").trim().toLowerCase();
      requisitos.forEach((r) => {
        if (r.obrigatorio === false) return;
        if (r.cargo && r.cargo.trim().toLowerCase() !== cargo) return;
        if (temDoc.has(`${f.id}|${r.tipo_documento_id}`)) return;
        faltantes.push({
          chave: `falta:${f.id}:${r.tipo_documento_id}`,
          colaboradorId: f.id,
          colaborador: f.nome,
          tipoNome: nomePorTipo.get(r.tipo_documento_id) || "—",
          situacao: "nao_enviado",
          dataValidade: null,
          diasParaVencer: null,
          doc: null,
        });
      });
    });

    return [...reais, ...faltantes].sort((a, b) => {
      const p = PESO_SITUACAO[a.situacao] - PESO_SITUACAO[b.situacao];
      if (p !== 0) return p;
      const da = a.diasParaVencer ?? 9999, db = b.diasParaVencer ?? 9999;
      return da !== db ? da - db : a.colaborador.localeCompare(b.colaborador);
    });
  }, [documentos, funcionarios, requisitos, nomePorColaborador, nomePorTipo]);

  const kpis = useMemo(() => {
    const c: Partial<Record<SituacaoDocumento, number>> = {};
    todasLinhas.forEach((l) => { c[l.situacao] = (c[l.situacao] || 0) + 1; });
    return c;
  }, [todasLinhas]);

  const tiposListados = useMemo(
    () => [...new Set(todasLinhas.map((l) => l.tipoNome))].sort((a, b) => a.localeCompare(b)),
    [todasLinhas],
  );

  const linhas = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return todasLinhas.filter((l) => {
      if (filtroTipo !== "todos" && l.tipoNome !== filtroTipo) return false;
      if (filtroSituacao !== "todos" && l.situacao !== filtroSituacao) return false;
      if (b && !l.colaborador.toLowerCase().includes(b) && !l.tipoNome.toLowerCase().includes(b)) return false;
      return true;
    });
  }, [todasLinhas, filtroTipo, filtroSituacao, busca]);

  const titulo = filtroSituacao === "vencido" ? "Documentos Vencidos"
    : filtroSituacao === "vence_em_breve" ? "Vencendo em breve"
    : filtroSituacao === "nao_enviado" ? "Documentos Não Enviados"
    : "Vencimentos";

  const abrir = async (l: Linha) => {
    if (!l.doc?.caminho_arquivo) return;
    const url = await urlTemporaria(l.doc.caminho_arquivo);
    if (!url) return;
    window.open(url, "_blank", "noopener");
    void registrarAcesso({
      documentoId: l.doc.id, versaoId: l.doc.versao_id, empresaId: l.doc.empresa_id,
      colaboradorId: l.colaboradorId, userId: user?.id, userEmail: user?.email,
    });
  };

  if (!perms.canView) return null;

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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Vencidos" value={kpis.vencido || 0} icon={AlertTriangle}
          color="bg-red-100 text-red-700" ativo={filtroSituacao === "vencido"}
          onClick={() => definirSituacao(filtroSituacao === "vencido" ? "todos" : "vencido")} />
        <Kpi label="Vence em breve" value={kpis.vence_em_breve || 0} icon={Clock}
          color="bg-orange-100 text-orange-700" ativo={filtroSituacao === "vence_em_breve"}
          onClick={() => definirSituacao(filtroSituacao === "vence_em_breve" ? "todos" : "vence_em_breve")} />
        <Kpi label="Não enviados" value={kpis.nao_enviado || 0} icon={FileStack}
          color="bg-amber-100 text-amber-700" ativo={filtroSituacao === "nao_enviado"}
          onClick={() => definirSituacao(filtroSituacao === "nao_enviado" ? "todos" : "nao_enviado")} />
        <Kpi label="Vigentes" value={kpis.vigente || 0} icon={CheckCircle2}
          color="bg-green-100 text-green-700" ativo={filtroSituacao === "vigente"}
          onClick={() => definirSituacao(filtroSituacao === "vigente" ? "todos" : "vigente")} />
      </div>

      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        "Não enviado" cruza cada colaborador ativo com os documentos que a função dele exige — o que
        depende dos requisitos estarem configurados em
        <Button variant="link" className="px-1 h-auto text-xs"
          onClick={() => navigate("/arquivo-digital/tipos")}>Configuração de Tipos</Button>.
      </p>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por colaborador ou tipo…" className="pl-8" />
            </div>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {tiposListados.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroSituacao} onValueChange={definirSituacao}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as situações</SelectItem>
                {(Object.keys(ROTULO_SITUACAO) as SituacaoDocumento[])
                  .filter((s) => s !== "substituido" && s !== "nao_aplicavel")
                  .map((s) => <SelectItem key={s} value={s}>{ROTULO_SITUACAO[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground whitespace-nowrap">{linhas.length} registro(s)</span>
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="whitespace-nowrap">Validade</TableHead>
                  <TableHead className="whitespace-nowrap">Dias</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <FileStack className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    Nenhum documento nesta situação.
                  </TableCell></TableRow>
                )}
                {linhas.map((l) => (
                  <TableRow key={l.chave}>
                    <TableCell className="font-medium text-sm">{l.colaborador}</TableCell>
                    <TableCell className="text-sm">{l.tipoNome}</TableCell>
                    <TableCell><SituacaoBadge situacao={l.situacao} /></TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {l.dataValidade ? dataBr(l.dataValidade) : (l.doc ? "Permanente" : "—")}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {l.diasParaVencer === null ? "—" : (
                        <span className={l.diasParaVencer < 0 ? "text-destructive font-medium" : ""}>
                          {l.diasParaVencer}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {l.doc?.caminho_arquivo && (
                        <Button size="icon" variant="ghost" title="Ver arquivo" onClick={() => abrir(l)}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      {l.colaboradorId && (
                        <Button size="icon" variant="ghost" title="Abrir dossiê"
                          onClick={() => navigate(`/arquivo-digital/dossie/${l.colaboradorId}`)}>
                          <FolderOpen className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
