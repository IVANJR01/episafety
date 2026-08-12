import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, FileText, Activity } from "lucide-react";
import { PGR_STATUS_LABEL, PGR_STATUS_COLOR, PgrStatus } from "@/lib/pgrTypes";

// Definindo a interface base (parecida com a do PGR)
interface PcmsoDocumento {
  id: string;
  empresa_id: string;
  unidade_id: string | null;
  pgr_base_id: string | null;
  versao: number;
  status: PgrStatus;
  data_emissao: string | null;
  data_vigencia_inicio: string | null;
  data_vigencia_fim: string | null;
  medico_coordenador_id: string | null;
  medico_nome: string | null;
  created_at: string;
}

export default function PcmsoDashboard() {
  const navigate = useNavigate();
  const { empresaId, empresaScopeIds, isSuperAdmin } = useAuth();
  const perms = usePermissions("pgr"); // Reutilizando a permissão base (ou criar uma pra pcmso)

  const [loadingNovo, setLoadingNovo] = useState(false);

  // Busca os documentos PCMSO
  const { data: pcmsos = [], refetch } = useQuery({
    queryKey: ["pcmso-dash-list", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      let q = (supabase.from as any)("pcmso_documentos").select("*");
      if (empresaScopeIds.length && !isSuperAdmin) q = q.in("empresa_id", empresaScopeIds);
      else if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as PcmsoDocumento[];
    },
    enabled: perms.canView,
  });

  const criarNovoPcmso = async () => {
    if (!empresaId) return;
    setLoadingNovo(true);
    try {
      const { data, error } = await (supabase.from as any)("pcmso_documentos")
        .insert({
          empresa_id: empresaId,
          status: "rascunho",
          versao: 1
        })
        .select("id")
        .single();
      
      if (error) throw error;
      if (data) {
        navigate(`/pcmso/elaborar/${data.id}`);
      }
    } catch (e: any) {
      alert("Erro ao criar documento: " + e.message);
    } finally {
      setLoadingNovo(false);
    }
  };

  // Indicadores simples
  const total = pcmsos.length;
  const vigentes = pcmsos.filter((p) => p.status === "vigente").length;
  const rascunhos = pcmsos.filter((p) => p.status === "rascunho").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="icon" onClick={() => navigate("/documentacao-sst")} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">Documentos PCMSO</h1>
          </div>
          <p className="text-muted-foreground ml-10">
            Gerador do Programa de Controle Médico de Saúde Ocupacional (NR-07).
          </p>
        </div>

        {perms.canEdit && (
          <Button onClick={criarNovoPcmso} disabled={loadingNovo}>
            {loadingNovo ? "Criando..." : <><Plus className="mr-2 h-4 w-4" /> Novo PCMSO</>}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Documentos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vigentes</CardTitle>
            <Activity className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-600">{vigentes}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rascunhos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{rascunhos}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de Documentos</CardTitle>
        </CardHeader>
        <CardContent>
          {pcmsos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum documento PCMSO encontrado.
            </div>
          ) : (
            <div className="space-y-4">
              {pcmsos.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Versão {p.versao}</span>
                      <Badge variant="outline" className={PGR_STATUS_COLOR[p.status] || ""}>
                        {PGR_STATUS_LABEL[p.status] || p.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {p.medico_nome ? `Coord: ${p.medico_nome}` : "Sem médico definido"}
                      {p.data_vigencia_inicio ? ` • Vigência: ${new Date(p.data_vigencia_inicio).toLocaleDateString()} a ${p.data_vigencia_fim ? new Date(p.data_vigencia_fim).toLocaleDateString() : '?'}` : ""}
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => navigate(`/pcmso/elaborar/${p.id}`)}>
                    {p.status === "rascunho" ? "Continuar" : "Visualizar"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
