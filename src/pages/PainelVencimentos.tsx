import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { AlertTriangle, Clock, CheckCircle2, Archive, FileStack, ExternalLink, FolderOpen, Search, Info } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  ROTULO_SITUACAO, COR_SITUACAO, urlTemporaria, registrarAcesso,
  type SituacaoDocumento, type DocumentoSituacao,
} from "@/lib/arquivoDigital";

const TABELA_AUSENTE = new Set(["42P01", "PGRST205", "PGRST202"]);
const ehTabelaAusente = (e: any) =>
  !!e && (TABELA_AUSENTE.has(e.code) || /does not exist|schema cache/i.test(e.message || ""));

interface Funcionario { id: string; nome: string; }

function Kpi({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

const dataBr = (iso?: string | null) =>
  iso ? format(parseISO(iso), "dd/MM/yyyy") : "—";

export default function PainelVencimentos() {
  const navigate = useNavigate();
  const { empresaId, empresaScopeIds, isSuperAdmin, user } = useAuth();
  const perms = usePermissions("arquivo_digital");

  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroSituacao, setFiltroSituacao] = useState("todos");
  const [indisponivel, setIndisponivel] = useState(false);

  const { data: documentos = [] } = useQuery({
    queryKey: ["arquivo-digital-vencimentos", empresaId, empresaScopeIds.join(",")],
    enabled: perms.canView,
    queryFn: async () => {
      let q = (supabase.from as any)("internal_documents_situacao")
        .select("id, versao_id, colaborador_id, tipo_documento_id, tipo_nome, categoria, data_validade, situacao, dias_para_vencer, caminho_arquivo, empresa_id")
        .not("colaborador_id", "is", null);
      if (empresaScopeIds.length && !isSuperAdmin) q = q.in("empresa_id", empresaScopeIds);
      else if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q.order("dias_para_vencer", { ascending: true, nullsFirst: false });
      if (error) { if (ehTabelaAusente(error)) setIndisponivel(true); return []; }
      return (data || []) as DocumentoSituacao[];
    },
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["arquivo-digital-vencimentos-funcionarios", empresaId, empresaScopeIds.join(",")],
    enabled: perms.canView && documentos.length > 0,
    queryFn: async () => {
      let q = supabase.from("funcionarios").select("id, nome");
      if (empresaScopeIds.length && !isSuperAdmin) q = q.in("empresa_id", empresaScopeIds);
      else if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      return (data || []) as Funcionario[];
    },
  });

  const nomePorColaborador = useMemo(() => new Map(funcionarios.map((f) => [f.id, f.nome])), [funcionarios]);

  const tipos = useMemo(
    () => [...new Set(documentos.map((d) => d.tipo_nome))].sort((a, b) => a.localeCompare(b)),
    [documentos],
  );

  const kpis = useMemo(() => {
    const contagem: Record<SituacaoDocumento, number> = {
      nao_enviado: 0, vigente: 0, vence_em_breve: 0, vencido: 0, arquivado: 0,
    };
    documentos.forEach((d) => { contagem[d.situacao] = (contagem[d.situacao] || 0) + 1; });
    return contagem;
  }, [documentos]);

  const linhas = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return documentos.filter((d) => {
      if (filtroTipo !== "todos" && d.tipo_nome !== filtroTipo) return false;
      if (filtroSituacao !== "todos" && d.situacao !== filtroSituacao) return false;
      if (b) {
        const nome = (d.colaborador_id && nomePorColaborador.get(d.colaborador_id)) || "";
        if (!nome.toLowerCase().includes(b) && !d.tipo_nome.toLowerCase().includes(b)) return false;
      }
      return true;
    });
  }, [documentos, filtroTipo, filtroSituacao, busca, nomePorColaborador]);

  const abrir = async (d: DocumentoSituacao) => {
    if (!d.caminho_arquivo) return;
    const url = await urlTemporaria(d.caminho_arquivo);
    if (!url) return;
    window.open(url, "_blank", "noopener");
    void registrarAcesso({
      documentoId: d.id, versaoId: d.versao_id, empresaId: d.empresa_id,
      colaboradorId: d.colaborador_id, userId: user?.id,
    });
  };

  if (!perms.canView) return null;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <PageHeader
        title="Vencimentos"
        subtitle="Arquivo Digital SST — ASO, Capacitações, Ficha de EPI e Ordem de Serviço num lugar só."
      />

      {indisponivel && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-800 flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            O Arquivo Digital ainda não foi ativado neste banco.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Vencidos" value={kpis.vencido} icon={AlertTriangle} color="bg-red-100 text-red-700" />
        <Kpi label="Vence em breve" value={kpis.vence_em_breve} icon={Clock} color="bg-orange-100 text-orange-700" />
        <Kpi label="Vigentes" value={kpis.vigente} icon={CheckCircle2} color="bg-green-100 text-green-700" />
        <Kpi label="Arquivados" value={kpis.arquivado} icon={Archive} color="bg-slate-100 text-slate-600" />
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0" />
        Mostra só documentos que já foram anexados pelo menos uma vez — colaborador sem nenhum
        anexo pra um tipo de documento não aparece aqui.
      </p>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por colaborador ou tipo…" className="pl-8" />
            </div>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroSituacao} onValueChange={setFiltroSituacao}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as situações</SelectItem>
                {(Object.keys(ROTULO_SITUACAO) as SituacaoDocumento[]).map((s) => (
                  <SelectItem key={s} value={s}>{ROTULO_SITUACAO[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Tipo de Documento</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Dias</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <FileStack className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    Nenhum documento encontrado.
                  </TableCell></TableRow>
                )}
                {linhas.map((d, i) => (
                  <TableRow key={`${d.colaborador_id}-${d.tipo_documento_id}-${i}`}>
                    <TableCell className="font-medium">
                      {(d.colaborador_id && nomePorColaborador.get(d.colaborador_id)) || "—"}
                    </TableCell>
                    <TableCell className="text-sm">{d.tipo_nome}</TableCell>
                    <TableCell><Badge className={COR_SITUACAO[d.situacao] + " border"}>{ROTULO_SITUACAO[d.situacao]}</Badge></TableCell>
                    <TableCell className="text-sm">{dataBr(d.data_validade)}</TableCell>
                    <TableCell className="text-sm">
                      {d.dias_para_vencer === null ? "—" : d.dias_para_vencer}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {d.caminho_arquivo && (
                        <Button size="icon" variant="ghost" title="Ver PDF" onClick={() => abrir(d)}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      {d.colaborador_id && (
                        <Button size="icon" variant="ghost" title="Abrir Dossiê"
                          onClick={() => navigate(`/cadastro/funcionarios/${d.colaborador_id}/dossie`)}>
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
