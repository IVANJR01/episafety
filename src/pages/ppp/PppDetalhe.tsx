import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Pencil } from "lucide-react";
import {
  PPP_STATUS_LABEL, PPP_STATUS_COLOR, PPP_MOTIVO_LABEL,
  PppDocumento, isPppEditavel,
} from "@/lib/pppTypes";
import PppHistoricoTab from "@/components/ppp/PppHistoricoTab";
import PppExposicoesTab from "@/components/ppp/PppExposicoesTab";

function Placeholder({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <Card>
      <CardContent className="p-10 text-center text-muted-foreground">
        <div className="text-sm font-medium mb-1">{titulo}</div>
        <div className="text-xs">{descricao}</div>
      </CardContent>
    </Card>
  );
}

export default function PppDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { empresaScopeIds, isSuperAdmin } = useAuth();
  const perms = usePermissions("ppp");

  const { data: ppp, isLoading } = useQuery({
    queryKey: ["ppp-detalhe", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("ppp_documentos")
        .select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as PppDocumento | null;
    },
    enabled: !!id,
  });

  const { data: funcionario } = useQuery({
    queryKey: ["ppp-detalhe-func", ppp?.funcionario_id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("funcionarios")
        .select("id, nome, cpf, matricula, cargo, setor, ghe_id, empresa_id, data_admissao, data_demissao")
        .eq("id", ppp!.funcionario_id).maybeSingle();
      return data;
    },
    enabled: !!ppp?.funcionario_id,
  });

  const { data: empresa } = useQuery({
    queryKey: ["ppp-detalhe-emp", ppp?.empresa_id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("empresa_config")
        .select("id, nome, cnpj").eq("id", ppp!.empresa_id).maybeSingle();
      return data;
    },
    enabled: !!ppp?.empresa_id,
  });

  const { data: revisoes = [] } = useQuery({
    queryKey: ["ppp-revisoes", id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ppp_revisoes")
        .select("*").eq("ppp_id", id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  if (!perms.canView) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">Sem permissão.</CardContent></Card>;
  }
  if (isLoading) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">Carregando…</CardContent></Card>;
  }
  if (!ppp) {
    return (
      <Card><CardContent className="p-8 text-center text-muted-foreground">
        PPP não encontrado ou fora do escopo.
      </CardContent></Card>
    );
  }
  // Defense-in-depth tenant check
  if (!isSuperAdmin && empresaScopeIds.length && !empresaScopeIds.includes(ppp.empresa_id)) {
    return (
      <Card><CardContent className="p-8 text-center text-muted-foreground">
        PPP não encontrado ou fora do escopo.
      </CardContent></Card>
    );
  }

  const editavel = isPppEditavel(ppp.status);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/ppp")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div className="flex gap-2">
          {perms.canEdit && editavel && (
            <Button size="sm" onClick={() => navigate(`/ppp/${ppp.id}/editar`)}>
              <Pencil className="h-4 w-4 mr-1" /> Editar
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs text-muted-foreground">Funcionário</div>
            <div className="text-base font-semibold">{funcionario?.nome || "—"}</div>
          </div>
          <div>
            <Badge className={PPP_STATUS_COLOR[ppp.status]} variant="outline">
              {PPP_STATUS_LABEL[ppp.status]}
            </Badge>
          </div>
          <div className="text-xs font-mono">v{ppp.versao}</div>
        </CardContent>
      </Card>

      <Tabs defaultValue="resumo">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="trabalhador">Dados do trabalhador</TabsTrigger>
          <TabsTrigger value="historico">Histórico laboral</TabsTrigger>
          <TabsTrigger value="exposicoes">Exposições</TabsTrigger>
          <TabsTrigger value="responsaveis">Responsáveis</TabsTrigger>
          <TabsTrigger value="exames">Exames referenciados</TabsTrigger>
          <TabsTrigger value="revisoes">Revisões</TabsTrigger>
          <TabsTrigger value="pdf">PDF</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Identificação do PPP</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div><b>Empresa:</b> {empresa?.nome || "—"}</div>
              <div><b>CNPJ:</b> {empresa?.cnpj || "—"}</div>
              <div><b>Motivo:</b> {PPP_MOTIVO_LABEL[ppp.motivo_emissao]}</div>
              <div><b>Data de emissão:</b> {ppp.data_emissao ? new Date(ppp.data_emissao + "T00:00:00").toLocaleDateString("pt-BR") : "—"}</div>
              <div><b>Versão:</b> {ppp.versao}</div>
              <div><b>Status:</b> {PPP_STATUS_LABEL[ppp.status]}</div>
              <div><b>CBO consolidado:</b> {ppp.cbo_consolidado || "—"}</div>
              <div><b>Conteúdo atualizado em:</b> {new Date(ppp.conteudo_atualizado_em).toLocaleString("pt-BR")}</div>
              <div className="md:col-span-2"><b>Descrição da atividade:</b> {ppp.descricao_atividade_consolidada || "—"}</div>
              <div className="md:col-span-2"><b>Observações:</b> {ppp.observacoes || "—"}</div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trabalhador">
          <Card>
            <CardHeader><CardTitle className="text-base">Dados do trabalhador</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div><b>Nome:</b> {funcionario?.nome || "—"}</div>
              <div><b>CPF:</b> {funcionario?.cpf || "—"}</div>
              <div><b>Matrícula:</b> {funcionario?.matricula || "—"}</div>
              <div><b>Função atual:</b> {funcionario?.cargo || "—"}</div>
              <div><b>Setor:</b> {funcionario?.setor || "—"}</div>
              <div><b>Data de admissão:</b> {funcionario?.data_admissao || "—"}</div>
              <div><b>Data de demissão:</b> {funcionario?.data_demissao || "—"}</div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <PppHistoricoTab ppp={ppp} funcionario={funcionario} />
        </TabsContent>
        <TabsContent value="exposicoes">
          <Placeholder titulo="Exposições a agentes nocivos" descricao="Disponível em fase futura (Parte 4)." />
        </TabsContent>
        <TabsContent value="responsaveis">
          <Placeholder titulo="Responsáveis ambientais e médicos" descricao="Estrutura básica disponível; gestão na Parte 4." />
        </TabsContent>
        <TabsContent value="exames">
          <Placeholder titulo="Exames referenciados (ASO/PCMSO)" descricao="Disponível em fase futura." />
        </TabsContent>

        <TabsContent value="revisoes">
          <Card>
            <CardHeader><CardTitle className="text-base">Histórico de revisões</CardTitle></CardHeader>
            <CardContent>
              {revisoes.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhuma revisão registrada.</div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {(revisoes as any[]).map((r) => (
                    <li key={r.id} className="border rounded p-2">
                      <div className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </div>
                      <div>{r.acao || "—"} {r.status_anterior ? `(${r.status_anterior} → ${r.status_novo || "—"})` : ""}</div>
                      {r.descricao && <div className="text-xs">{r.descricao}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pdf">
          <Placeholder titulo="PDF técnico" descricao="Geração de PDF, assinatura visual e QR Code serão entregues em fase futura." />
        </TabsContent>
      </Tabs>
    </div>
  );
}
