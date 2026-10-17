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
import { Save, Loader2, Link2, Stethoscope, CalendarRange, Building2, UserPlus, Sparkles, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { PgrStatus, PGR_STATUS_LABEL } from "@/lib/pgrTypes";
import PcmsoProfissionalModal from "./PcmsoProfissionalModal";
import { buscarProfissionalPorCrm } from "@/lib/consultaCrm";

interface PcmsoCapaTabProps {
  pcmso: any;
}

export default function PcmsoCapaTab({ pcmso }: PcmsoCapaTabProps) {
  const [searchParams] = useSearchParams();
  const { empresaId, empresaScopeIds } = useAuth();
  const perms = usePermissions("pgr");
  const queryClient = useQueryClient();

  const alvoEmpresaId = pcmso?.empresa_id || searchParams.get("empresa_id") || empresaId;

  const [pgrBaseId, setPgrBaseId] = useState(pcmso.pgr_base_id || "");
  const [medicoId, setMedicoId] = useState(pcmso.medico_coordenador_id || "");
  const [medicoNome, setMedicoNome] = useState(pcmso.medico_nome || "");
  const [medicoCrm, setMedicoCrm] = useState(pcmso.medico_crm || "");
  const [medicoUf, setMedicoUf] = useState(pcmso.medico_uf || "CE");
  const [modoManualMedico, setModoManualMedico] = useState(!pcmso.medico_coordenador_id && !!pcmso.medico_nome);

  const [dataInicio, setDataInicio] = useState(pcmso.data_vigencia_inicio || "");
  const [dataFim, setDataFim] = useState(pcmso.data_vigencia_fim || "");
  const [modalProfissionalAberto, setModalProfissionalAberto] = useState(false);

  // Busca dados da empresa para conferência
  const { data: dadosEmpresa } = useQuery({
    queryKey: ["empresa-info-pcmso", alvoEmpresaId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("empresa_config")
        .select("nome, cnpj, cnae_principal, grau_risco, telefone, email, endereco, logradouro, numero, bairro, cidade, uf, cep")
        .eq("id", alvoEmpresaId)
        .maybeSingle();
      return data;
    },
    enabled: !!alvoEmpresaId,
  });

  const { data: pgrs = [], isLoading: loadPgrs } = useQuery({
    queryKey: ["pgr-lista-base", alvoEmpresaId, empresaScopeIds?.join(",")],
    queryFn: async () => {
      let q = (supabase.from as any)("pgr_documentos")
        .select("id, versao, status, data_vigencia_inicio, data_vigencia_fim, empresa_id");

      if (alvoEmpresaId) {
        q = q.eq("empresa_id", alvoEmpresaId);
      }

      const { data, error } = await q.order("versao", { ascending: false });

      if (error) {
        console.error("Erro ao carregar PGRs:", error);
        return [];
      }
      return ((data || []) as any[]).filter(
        (p) => p.status !== "arquivado" && p.status !== "substituido",
      );
    },
    enabled: true,
  });

  const { data: medicos = [], isLoading: loadMedicos, refetch: refetchMedicos } = useQuery({
    queryKey: ["medicos-trabalho-lista", alvoEmpresaId],
    queryFn: async () => {
      let q = (supabase.from as any)("aso_medicos")
        .select("id, nome, crm, uf_crm, responsavel_pcmso, empresa_id")
        .eq("ativo", true);

      if (alvoEmpresaId) {
        q = q.or(`empresa_id.eq.${alvoEmpresaId},empresa_id.is.null`);
      }

      let { data, error } = await q.order("nome");

      if (!data || data.length === 0) {
        const fb = await (supabase.from as any)("aso_medicos")
          .select("id, nome, crm, uf_crm, responsavel_pcmso, empresa_id")
          .eq("ativo", true)
          .order("nome");
        if (fb.data && fb.data.length > 0) {
          data = fb.data;
        }
      }

      if (error && (!data || data.length === 0)) {
        return [];
      }
      return (data || []).map((m: any) => ({
        ...m,
        uf: m.uf_crm || "",
      }));
    },
    enabled: true,
  });

  const updateMutation = useMutation({
    mutationFn: async (dados: any) => {
      const { error } = await supabase
        .from("pcmso_documentos")
        .update(dados)
        .eq("id", pcmso.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pcmso-detalhe", pcmso.id] });
      toast.success("Dados do PCMSO atualizados!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao salvar: ${err.message}`);
    },
  });

  // Auto-selecionar PGR
  useEffect(() => {
    if ((!pgrBaseId || pgrBaseId === "none" || !pcmso.pgr_base_id) && pgrs.length > 0) {
      const primeiro = pgrs[0];
      setPgrBaseId(primeiro.id);
      const ini = dataInicio || primeiro.data_vigencia_inicio || null;
      const fim = dataFim || primeiro.data_vigencia_fim || null;
      if (!dataInicio && primeiro.data_vigencia_inicio) setDataInicio(primeiro.data_vigencia_inicio);
      if (!dataFim && primeiro.data_vigencia_fim) setDataFim(primeiro.data_vigencia_fim);

      if (!pcmso.pgr_base_id) {
        updateMutation.mutate({
          pgr_base_id: primeiro.id,
          data_vigencia_inicio: ini,
          data_vigencia_fim: fim,
        });
      }
    }
  }, [pgrs, pcmso.pgr_base_id]);

  // Se já tiver médico nos dados do PCMSO, preenche
  useEffect(() => {
    if (pcmso.medico_nome && !medicoNome) setMedicoNome(pcmso.medico_nome);
    if (pcmso.medico_crm && !medicoCrm) setMedicoCrm(pcmso.medico_crm);
    if (pcmso.medico_uf && !medicoUf) setMedicoUf(pcmso.medico_uf);
  }, [pcmso]);

  const handlePgrChange = (val: string) => {
    setPgrBaseId(val);
    const pgrIdFinal = val === "none" ? null : val;
    let novIni = dataInicio;
    let novFim = dataFim;
    if (val && val !== "none") {
      const p = pgrs.find((item: any) => item.id === val);
      if (p) {
        if (!novIni && p.data_vigencia_inicio) novIni = p.data_vigencia_inicio;
        if (!novFim && p.data_vigencia_fim) novFim = p.data_vigencia_fim;
        setDataInicio(novIni);
        setDataFim(novFim);
      }
    }
    updateMutation.mutate({
      pgr_base_id: pgrIdFinal,
      data_vigencia_inicio: novIni || null,
      data_vigencia_fim: novFim || null,
    });
  };

  const handleMedicoChange = (val: string) => {
    setMedicoId(val);
    const medIdFinal = val === "none" ? null : val;
    const med = medicos.find((m: any) => m.id === medIdFinal);
    if (med) {
      setMedicoNome(med.nome);
      setMedicoCrm(med.crm);
      setMedicoUf(med.uf || med.uf_crm || "CE");
      updateMutation.mutate({
        medico_coordenador_id: medIdFinal,
        medico_nome: med.nome,
        medico_crm: med.crm,
        medico_uf: med.uf || med.uf_crm || null,
      });
    } else {
      updateMutation.mutate({
        medico_coordenador_id: null,
      });
    }
  };

  const preencherMedicoModelo = () => {
    setModoManualMedico(true);
    setMedicoNome("Roger Catunda Rocha");
    setMedicoCrm("6353");
    setMedicoUf("CE");
    toast.success("Dados do Dr. Roger Catunda Rocha preenchidos!");
  };

  const cadastrarMedicoNaTabela = async () => {
    if (!medicoNome || !medicoCrm) {
      toast.error("Informe pelo menos Nome e CRM do médico.");
      return;
    }
    try {
      const { data, error } = await (supabase.from as any)("aso_medicos")
        .insert({
          empresa_id: alvoEmpresaId || null,
          nome: medicoNome,
          crm: medicoCrm,
          uf_crm: medicoUf || "CE",
          responsavel_pcmso: true,
          ativo: true,
        })
        .select("id")
        .single();

      if (error) throw error;
      toast.success("Médico salvo no banco com sucesso!");
      refetchMedicos();
      if (data) {
        setMedicoId(data.id);
        setModoManualMedico(false);
      }
    } catch (e: any) {
      toast.error("Erro ao salvar médico: " + e.message);
    }
  };

  const handleSalvar = () => {
    const obj: any = {};
    const pgrIdFinal = pgrBaseId === "none" ? null : (pgrBaseId || null);
    const medIdFinal = modoManualMedico ? null : (medicoId === "none" ? null : (medicoId || null));

    obj.pgr_base_id = pgrIdFinal;
    obj.medico_coordenador_id = medIdFinal;
    obj.medico_nome = medicoNome || null;
    obj.medico_crm = medicoCrm || null;
    obj.medico_uf = medicoUf || null;
    obj.data_vigencia_inicio = dataInicio || null;
    obj.data_vigencia_fim = dataFim || null;

    updateMutation.mutate(obj);
  };

  const formDisabled = !perms.canEdit || pcmso.status === "arquivado" || pcmso.status === "substituido";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Dados Cadastrais da Empresa */}
      {dadosEmpresa && (
        <Card className="bg-slate-50/50 dark:bg-slate-900/30 border shadow-sm">
          <CardHeader className="py-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-200">
              <Building2 className="h-4 w-4 text-primary" /> Dados do Empregador (NR-07)
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 text-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-muted-foreground">
            <div>
              <span className="font-semibold text-foreground">Empresa:</span> {dadosEmpresa.nome}
            </div>
            <div>
              <span className="font-semibold text-foreground">CNPJ:</span> {dadosEmpresa.cnpj || "—"}
            </div>
            <div>
              <span className="font-semibold text-foreground">Grau de Risco:</span> {dadosEmpresa.grau_risco || "02"}
            </div>
            <div>
              <span className="font-semibold text-foreground">CNAE:</span> {dadosEmpresa.cnae_principal || "—"}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vínculo com PGR Base */}
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
            <div className="flex items-center justify-between">
              <Label>PGR Origem (Obrigatório)</Label>
              {loadPgrs && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Buscando PGRs...
                </span>
              )}
            </div>
            <Select 
              value={pgrBaseId} 
              onValueChange={handlePgrChange} 
              disabled={formDisabled || loadPgrs}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadPgrs ? "Carregando..." : "Selecione o PGR Base"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-muted-foreground italic">Nenhum vínculo (Não recomendado)</SelectItem>
                {pgrs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    PGR Versão {p.versao} — Status: {PGR_STATUS_LABEL[p.status as PgrStatus]} 
                    {p.data_vigencia_inicio ? ` (De ${new Date(p.data_vigencia_inicio).toLocaleDateString("pt-BR")})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Médico Coordenador */}
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Stethoscope className="h-5 w-5 text-blue-600" /> Médico Coordenador
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setModoManualMedico(!modoManualMedico)}
                className="text-xs text-primary"
              >
                {modoManualMedico ? "Selecionar da Lista" : "Digitar Dados"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {!modoManualMedico ? (
                <div className="space-y-2">
                  <Label>Médico do Trabalho (Responsável Técnico)</Label>
                  <Select 
                    value={medicoId} 
                    onValueChange={handleMedicoChange} 
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
                    <div className="rounded-lg p-3 bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                      <p>Nenhum médico cadastrado na lista. Você pode digitar os dados diretamente:</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setModoManualMedico(true)}>
                          Digitar Nome e CRM
                        </Button>
                        <Button size="sm" variant="secondary" onClick={preencherMedicoModelo}>
                          <Sparkles className="h-3.5 w-3.5 mr-1" /> Usar Dr. Roger Catunda (Padrão)
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 bg-muted/20 p-3 rounded-lg border">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs font-semibold">CRM</Label>
                      <Input
                        placeholder="Ex: 9245 ou 6353"
                        value={medicoCrm}
                        onChange={(e) => setMedicoCrm(e.target.value)}
                        onBlur={async () => {
                          const digitos = medicoCrm.replace(/\D/g, "");
                          if (digitos.length >= 2 && !medicoNome) {
                            const achado = await buscarProfissionalPorCrm(medicoCrm, medicoUf);
                            if (achado) {
                              setMedicoNome(achado.nome);
                              if (achado.uf) setMedicoUf(achado.uf);
                              toast.success(`Médico localizado: ${achado.nome}`);
                            }
                          }
                        }}
                        disabled={formDisabled}
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">UF CRM</Label>
                      <Input
                        placeholder="Ex: CE"
                        value={medicoUf}
                        onChange={(e) => setMedicoUf(e.target.value.toUpperCase())}
                        disabled={formDisabled}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Nome Completo do Médico</Label>
                    <Input
                      placeholder="Ex: Carlos Virgilio de Andrade Chaves"
                      value={medicoNome}
                      onChange={(e) => setMedicoNome(e.target.value)}
                      disabled={formDisabled}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={cadastrarMedicoNaTabela}
                      className="text-xs flex-1"
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-1" /> Salvar na Base de Médicos
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={preencherMedicoModelo}
                      className="text-xs text-primary"
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-1" /> Padrão
                    </Button>
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                O médico selecionado será o assinante oficial e responsável técnico pelo PCMSO perante a NR-07.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Vigência e Validade */}
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
            <p className="text-xs text-muted-foreground mt-4">
              Geralmente a vigência do PCMSO é de 1 ano, acompanhando o ciclo de monitoramento da saúde e do PGR.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Equipe de Saúde e Examinadores Credenciados (NR-07) */}
      <Card className="shadow-sm border-t-4 border-t-blue-500">
        <CardHeader className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <UserCheck className="h-4 w-4 text-blue-600" /> Equipe de Saúde e Examinadores Credenciados (NR-07)
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Médicos examinadores e Fonoaudiólogos legalmente habilitados cadastrados para a realização e emissão de exames ocupacionais.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setModalProfissionalAberto(true)}
              className="text-xs gap-1.5 shrink-0 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30"
            >
              <UserPlus className="h-3.5 w-3.5" /> Adicionar Médico / Fonoaudiólogo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="py-2">
          {medicos.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Nenhum profissional cadastrado na base da empresa. Use o botão acima para adicionar.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {medicos.map((m: any) => {
                const isFono = (m.uf_crm || "").toUpperCase().includes("CRFA") || (m.crm || "").toUpperCase().includes("CRFA");
                const isCoord = m.id === medicoId || m.responsavel_pcmso;

                return (
                  <div
                    key={m.id}
                    className="p-2.5 rounded-lg border bg-slate-50/50 dark:bg-slate-900/20 text-xs flex flex-col justify-between gap-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-foreground truncate">
                        {isFono
                          ? m.nome
                          : /^dr[aªº\.]*\s+/i.test((m.nome || "").trim())
                          ? m.nome.trim()
                          : `Dr(a). ${(m.nome || "").trim()}`}
                      </span>
                      {isCoord && (
                        <Badge className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 shrink-0 border-none">
                          Coordenador
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground flex-wrap">
                      <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                        {isFono ? `CRFa: ${m.crm}/${m.uf_crm || "8"}` : `CRM: ${m.crm}/${m.uf_crm || "CE"}`}
                      </Badge>
                      <span className="text-[10px]">
                        {isFono ? "Fonoaudiólogo(a)" : "Médico Examinador"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {!formDisabled && (
        <div className="flex justify-end pt-4 border-t">
          <Button 
            size="lg" 
            onClick={handleSalvar} 
            disabled={updateMutation.isPending || formDisabled}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90"
          >
            {updateMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {pcmso.status === "rascunho" ? "Salvar Dados Iniciais" : "Salvar Alterações"}
          </Button>
        </div>
      )}

      {/* Modal de Cadastro de Profissional (Médico / Fonoaudiólogo) */}
      <PcmsoProfissionalModal
        open={modalProfissionalAberto}
        onOpenChange={setModalProfissionalAberto}
        empresaId={alvoEmpresaId}
        onSuccess={() => refetchMedicos()}
      />
    </div>
  );
}
