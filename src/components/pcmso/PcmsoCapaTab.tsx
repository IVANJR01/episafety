import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Loader2, Link2, Stethoscope, CalendarRange } from "lucide-react";
import { toast } from "sonner";
import { PgrStatus, PGR_STATUS_LABEL } from "@/lib/pgrTypes";

interface PcmsoCapaTabProps {
  pcmso: any;
}

export default function PcmsoCapaTab({ pcmso }: PcmsoCapaTabProps) {
  const [searchParams] = useSearchParams();
  const { empresaId, empresaScopeIds, isSuperAdmin } = useAuth();
  const perms = usePermissions("pgr"); // Reutilizando a permissão master do módulo
  const queryClient = useQueryClient();

  // Garante a empresa correta: prioriza o documento do PCMSO ou parâmetro de URL
  const alvoEmpresaId = pcmso?.empresa_id || searchParams.get("empresa_id") || empresaId;

  const [pgrBaseId, setPgrBaseId] = useState(pcmso.pgr_base_id || "");
  const [medicoId, setMedicoId] = useState(pcmso.medico_coordenador_id || "");
  const [dataInicio, setDataInicio] = useState(pcmso.data_vigencia_inicio || "");
  const [dataFim, setDataFim] = useState(pcmso.data_vigencia_fim || "");

  const { data: pgrs = [], isLoading: loadPgrs } = useQuery({
    queryKey: ["pgr-lista-base", alvoEmpresaId, empresaScopeIds?.join(",")],
    queryFn: async () => {
      let q = (supabase.from as any)("pgr_documentos")
        .select("id, versao, status, data_vigencia_inicio, data_vigencia_fim, empresa_id");

      if (alvoEmpresaId) {
        q = q.eq("empresa_id", alvoEmpresaId);
      } else if (empresaScopeIds?.length && !isSuperAdmin) {
        q = q.in("empresa_id", empresaScopeIds);
      }

      const { data, error } = await q
        .neq("status", "inativo")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao carregar PGRs:", error);
        return [];
      }
      return (data || []) as any[];
    },
    enabled: true,
  });

  const { data: medicos = [], isLoading: loadMedicos } = useQuery({
    queryKey: ["medicos-trabalho-lista", alvoEmpresaId],
    queryFn: async () => {
      let q = (supabase.from as any)("aso_medicos")
        .select("id, nome, crm, uf_crm, responsavel_pcmso")
        .eq("ativo", true);

      if (alvoEmpresaId) {
        q = q.or(`empresa_id.eq.${alvoEmpresaId},empresa_id.is.null`);
      }

      const { data, error } = await q.order("nome");
      if (error) {
        console.error("Erro ao carregar médicos:", error);
        return [];
      }
      return (data || []).map((m: any) => ({
        ...m,
        uf: m.uf_crm || "",
      }));
    },
    enabled: true,
  });

  // Auto-selecionar o PGR mais recente se não estiver selecionado
  useEffect(() => {
    if (!pgrBaseId && pgrs.length > 0) {
      const primeiro = pgrs[0];
      setPgrBaseId(primeiro.id);
      if (!dataInicio && primeiro.data_vigencia_inicio) setDataInicio(primeiro.data_vigencia_inicio);
      if (!dataFim && primeiro.data_vigencia_fim) setDataFim(primeiro.data_vigencia_fim);
    }
  }, [pgrs, pgrBaseId]);

  // Auto-selecionar médico coordenador se houver médico cadastrado
  useEffect(() => {
    if (!medicoId && medicos.length > 0) {
      const resp = medicos.find((m: any) => m.responsavel_pcmso) || (medicos.length === 1 ? medicos[0] : null);
      if (resp) setMedicoId(resp.id);
    }
  }, [medicos, medicoId]);

  const handlePgrChange = (val: string) => {
    setPgrBaseId(val);
    if (val && val !== "none") {
      const p = pgrs.find((item: any) => item.id === val);
      if (p) {
        if (!dataInicio && p.data_vigencia_inicio) setDataInicio(p.data_vigencia_inicio);
        if (!dataFim && p.data_vigencia_fim) setDataFim(p.data_vigencia_fim);
      }
    }
  };

  const updateMutation = useMutation({
    mutationFn: async (dados: any) => {
      const { error } = await supabase
        .from("pcmso_documentos")
        .update(dados)
        .eq("id", pcmso.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados iniciais salvos com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["pcmso-detalhe", pcmso.id] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao salvar: ${err.message}`);
    },
  });

  const handleSalvar = () => {
    const obj: any = {};
    const pgrIdFinal = pgrBaseId === "none" ? null : (pgrBaseId || null);
    const medIdFinal = medicoId === "none" ? null : (medicoId || null);

    if (pgrIdFinal !== (pcmso.pgr_base_id || null)) obj.pgr_base_id = pgrIdFinal;
    if (medIdFinal !== (pcmso.medico_coordenador_id || null)) {
      obj.medico_coordenador_id = medIdFinal;
      const med = medicos.find(m => m.id === medIdFinal);
      if (med) {
        obj.medico_nome = med.nome;
        obj.medico_crm = med.crm;
        obj.medico_uf = med.uf || med.uf_crm || null;
      } else {
        obj.medico_nome = null;
        obj.medico_crm = null;
        obj.medico_uf = null;
      }
    }
    if (dataInicio !== (pcmso.data_vigencia_inicio || "")) obj.data_vigencia_inicio = dataInicio || null;
    if (dataFim !== (pcmso.data_vigencia_fim || "")) obj.data_vigencia_fim = dataFim || null;

    if (Object.keys(obj).length === 0) {
      toast.info("Nenhuma alteração para salvar.");
      return;
    }

    updateMutation.mutate(obj);
  };

  const formDisabled = !perms.canEdit || pcmso.status !== "rascunho";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="border-t-4 border-t-emerald-600 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Link2 className="h-5 w-5 text-emerald-600" /> Vínculo com PGR Base
          </CardTitle>
          <CardDescription>
            A nova Norma Regulamentadora 07 (NR-07) obriga que o PCMSO seja baseado 
            exclusivamente no inventário de riscos do PGR (NR-01). Selecione o PGR que originou este programa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>PGR Origem (Obrigatório)</Label>
            <Select 
              value={pgrBaseId} 
              onValueChange={handlePgrChange} 
              disabled={formDisabled || loadPgrs}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadPgrs ? "Carregando..." : "Selecione o PGR da empresa"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-muted-foreground italic">Nenhum (Não recomendado)</SelectItem>
                {pgrs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    PGR Versão {p.versao} — Status: {PGR_STATUS_LABEL[p.status as PgrStatus]} 
                    {p.data_vigencia_inicio ? ` (De ${new Date(p.data_vigencia_inicio).toLocaleDateString()})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!pgrBaseId && pcmso.status === "rascunho" && (
              <p className="text-xs text-amber-600 font-medium">Atenção: A Matriz de Saúde não listará riscos enquanto o PGR não for vinculado.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Stethoscope className="h-5 w-5 text-blue-600" /> Médico Coordenador
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Médico do Trabalho (Responsável Técnico)</Label>
                <Select 
                  value={medicoId} 
                  onValueChange={setMedicoId} 
                  disabled={formDisabled || loadMedicos}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadMedicos ? "Carregando..." : "Selecione o Médico"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-muted-foreground italic">Selecione...</SelectItem>
                    {medicos.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        Dr(a). {m.nome} (CRM: {m.crm}-{m.uf})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {medicos.length === 0 && !loadMedicos && (
                  <div className="rounded-lg p-2.5 bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2">
                    <span>Nenhum médico cadastrado ainda.</span>
                    <a
                      href="/aso/medicos"
                      target="_blank"
                      rel="noreferrer"
                      className="underline font-semibold text-primary hover:text-primary/80"
                    >
                      Cadastrar Médico
                    </a>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                O médico selecionado será o assinante oficial do documento. Ele precisa estar cadastrado na tela de "Médicos".
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarRange className="h-5 w-5 text-indigo-600" /> Vigência e Validade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Input 
                  type="date" 
                  value={dataInicio} 
                  onChange={(e) => setDataInicio(e.target.value)}
                  disabled={formDisabled}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Final</Label>
                <Input 
                  type="date" 
                  value={dataFim} 
                  onChange={(e) => setDataFim(e.target.value)}
                  disabled={formDisabled}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {pcmso.status === "rascunho" && (
        <div className="flex justify-end pt-4 border-t">
          <Button 
            size="lg" 
            onClick={handleSalvar} 
            disabled={updateMutation.isPending || formDisabled}
            className="w-full sm:w-auto"
          >
            {updateMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar Dados Iniciais
          </Button>
        </div>
      )}
    </div>
  );
}
