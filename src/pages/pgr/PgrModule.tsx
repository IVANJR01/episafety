import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Plus, FileWarning, ShieldCheck, History, Edit } from "lucide-react";
import { PGR_STATUS_LABEL, PGR_STATUS_COLOR, PgrDocumento, PgrStatus } from "@/lib/pgrTypes";

export default function PgrModule() {
  const navigate = useNavigate();
  const { empresaId, empresaScopeIds, isSuperAdmin } = useAuth();
  const perms = usePermissions("pgr");

  const { data: pgrs = [], isLoading } = useQuery({
    queryKey: ["pgr-list-gestao", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      let q = (supabase.from as any)("pgr_documentos").select("*");
      if (empresaScopeIds.length && !isSuperAdmin) q = q.in("empresa_id", empresaScopeIds);
      else if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q.order("versao", { ascending: false });
      if (error) throw error;
      return (data || []) as PgrDocumento[];
    },
    enabled: perms.canView,
  });

  const { data: empresaAtual } = useQuery({
    queryKey: ["pgr-empresa", empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      const { data } = await (supabase.from as any)("empresa_config")
        .select("id, nome, nome_fantasia, cnpj")
        .eq("id", empresaId).maybeSingle();
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ["pgr-unidades-gestao", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data } = await (supabase.from as any)("empresa_config")
        .select("id, nome, cnpj")
        .or(`id.eq.${empresaId},empresa_pai_id.eq.${empresaId}`);
      return data || [];
    },
  });

  const unidadeMap = useMemo(() => {
    const m = new Map<string, string>();
    (unidades as any[]).forEach((u) => m.set(u.id, u.nome));
    return m;
  }, [unidades]);
  
  const pgrAtivo = pgrs.length > 0 ? pgrs[0] : null; // O mais recente (versao desc)
  const historico = pgrs.length > 1 ? pgrs.slice(1) : [];

  const formatarVersao = (p: PgrDocumento) => {
    const nomeUnidade = unidadeMap.get(p.unidade_id || p.empresa_id) || "Unidade";
    const ano = p.data_emissao?.slice(0, 4) || p.created_at?.slice(0, 4) || new Date().getFullYear();
    const ver = String(p.versao || 0).padStart(2, '0');
    return `PGR — ${nomeUnidade} — Rev. ${ver} — ${ano}`;
  };

  if (!perms.canView) {
    return (
      <Card><CardContent className="p-8 text-center text-muted-foreground">Você não tem permissão para acessar o PGR.</CardContent></Card>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800 tracking-tight">
            <ShieldCheck className="h-6 w-6 text-indigo-600" /> Gestão do PGR
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Programa de Gerenciamento de Riscos e acompanhamento das revisões
          </p>
        </div>
        <div className="flex gap-2">
          {perms.canCreate && (
            <Button onClick={() => navigate("/pgr/novo")} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="h-4 w-4 mr-2" /> Iniciar / Nova Revisão
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground">Carregando Gestão do PGR...</div>
      ) : !pgrAtivo ? (
        <Card className="border-dashed shadow-sm">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center">
            <FileWarning className="h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-700 mb-2">Nenhum PGR foi iniciado para este estabelecimento</h3>
            <p className="text-sm text-slate-500 max-w-md mb-6">
              Inicie a elaboração do Programa de Gerenciamento de Riscos agora mesmo. Os dados da estrutura e do inventário serão unificados.
            </p>
            {perms.canCreate && (
              <Button size="lg" onClick={() => navigate("/pgr/novo")} className="bg-indigo-600 hover:bg-indigo-700">
                Iniciar Elaboração do PGR
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="border-indigo-100 shadow-md ring-1 ring-indigo-50">
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <Badge variant="outline" className={`mb-2 ${PGR_STATUS_COLOR[pgrAtivo.status as PgrStatus]}`}>
                    {PGR_STATUS_LABEL[pgrAtivo.status as PgrStatus] || "Rascunho"}
                  </Badge>
                  <CardTitle className="text-xl text-slate-800">{formatarVersao(pgrAtivo)}</CardTitle>
                  <CardDescription className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                    <span className="font-medium text-slate-600">Empresa: {empresaAtual?.nome_fantasia || empresaAtual?.nome || "Não informada"}</span>
                    <span>CNPJ: {empresaAtual?.cnpj || "—"}</span>
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  {pgrAtivo.status !== "arquivado" && (
                     <Button onClick={() => navigate(`/pgr/${pgrAtivo.id}`)} className="bg-indigo-600 hover:bg-indigo-700">
                       <Edit className="h-4 w-4 mr-2" /> 
                       {pgrAtivo.status === "vigente" ? "Revisar" : "Continuar elaboração"}
                     </Button>
                  )}
                  <Button variant="outline" onClick={() => navigate(`/pgr/${pgrAtivo.id}/classico`)}>
                    <Eye className="h-4 w-4 mr-2" /> Visualizar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-slate-500 font-medium mb-1">Responsável Técnico</p>
                  <p className="text-sm text-slate-800 font-semibold">{pgrAtivo.resp_tec_nome || "Não atribuído"}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium mb-1">Data de Emissão</p>
                  <p className="text-sm text-slate-800">{pgrAtivo.data_emissao ? new Date(pgrAtivo.data_emissao + "T00:00:00").toLocaleDateString("pt-BR") : "Não emitido"}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium mb-1">Última Alteração</p>
                  <p className="text-sm text-slate-800">{new Date(pgrAtivo.updated_at || pgrAtivo.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium mb-1">Progresso</p>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${pgrAtivo.status === 'vigente' ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: pgrAtivo.status === 'vigente' ? '100%' : '40%' }}></div>
                    </div>
                    <span className="text-xs font-medium text-slate-600">{pgrAtivo.status === 'vigente' ? '100%' : 'Em andamento'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {historico.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4 text-slate-500" /> Histórico de Versões e Rascunhos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Identificação da Versão</TableHead>
                      <TableHead>Emissão</TableHead>
                      <TableHead>Vigência</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium text-slate-700">
                          {formatarVersao(p)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {p.data_emissao ? new Date(p.data_emissao + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {p.data_vigencia_inicio && p.data_vigencia_fim
                            ? `${new Date(p.data_vigencia_inicio + "T00:00:00").toLocaleDateString("pt-BR")} a ${new Date(p.data_vigencia_fim + "T00:00:00").toLocaleDateString("pt-BR")}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={PGR_STATUS_COLOR[p.status as PgrStatus]} variant="outline">
                            {PGR_STATUS_LABEL[p.status as PgrStatus]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" className="text-indigo-600" onClick={() => navigate(`/pgr/${p.id}`)}>
                            <Eye className="h-4 w-4 mr-1.5" /> Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
