import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Trash2,
  Plus,
  FileWarning,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  TIPO_LABEL,
  TIPO_ACIDENTE_LABEL,
  EMITENTE_LABEL,
  CatTipo,
  CatTipoAcidente,
  CatEmitenteTipo,
} from "@/lib/catTypes";
import CatEsocialStep from "@/components/cat/CatEsocialStep";

const STEPS = [
  "Dados Iniciais",
  "Funcionário",
  "Acidente",
  "Lesão",
  "Atendimento",
  "Afastamento/Óbito",
  "Testemunhas",
  "Anexos",
  "Dados eSocial S-2210",
  "Revisão",
] as const;

interface Testemunha {
  id?: string;
  nome: string;
  cpf: string;
  cargo: string;
  telefone: string;
}

interface CatForm {
  tipo_cat: CatTipo;
  cat_origem_id: string | null;
  unidade_id: string | null;
  contrato_id: string | null;
  funcionario_id: string;
  cbo: string;
  remuneracao_mensal: string;
  jornada_semanal_horas: string;
  data_acidente: string;
  hora_acidente: string;
  tipo_acidente: CatTipoAcidente;
  local_acidente: string;
  endereco_local: string;
  cep: string;
  municipio: string;
  uf: string;
  situacao_geradora_id: string | null;
  agente_causador_id: string | null;
  parte_atingida_id: string | null;
  lateralidade: string;
  natureza_lesao_id: string | null;
  cid_codigo: string;
  cid_descricao: string;
  data_atendimento: string;
  hora_atendimento: string;
  hospital: string;
  medico_nome: string;
  medico_crm: string;
  medico_uf: string;
  houve_internacao: boolean;
  descricao_lesao: string;
  houve_afastamento: boolean;
  ultimo_dia_trabalhado: string;
  obito: boolean;
  data_obito: string;
  emitente_tipo: CatEmitenteTipo;
  emitente_nome: string;
  emitente_cpf: string;
  emitente_cargo: string;
  observacoes: string;
}

const empty: CatForm = {
  tipo_cat: "inicial",
  cat_origem_id: null,
  unidade_id: null,
  contrato_id: null,
  funcionario_id: "",
  cbo: "",
  remuneracao_mensal: "",
  jornada_semanal_horas: "",
  data_acidente: new Date().toISOString().slice(0, 10),
  hora_acidente: "",
  tipo_acidente: "tipico",
  local_acidente: "",
  endereco_local: "",
  cep: "",
  municipio: "",
  uf: "",
  situacao_geradora_id: null,
  agente_causador_id: null,
  parte_atingida_id: null,
  lateralidade: "N",
  natureza_lesao_id: null,
  cid_codigo: "",
  cid_descricao: "",
  data_atendimento: "",
  hora_atendimento: "",
  hospital: "",
  medico_nome: "",
  medico_crm: "",
  medico_uf: "",
  houve_internacao: false,
  descricao_lesao: "",
  houve_afastamento: false,
  ultimo_dia_trabalhado: "",
  obito: false,
  data_obito: "",
  emitente_tipo: "empregador",
  emitente_nome: "",
  emitente_cpf: "",
  emitente_cargo: "",
  observacoes: "",
};

export default function CatNovo() {
  const { id: editId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { empresaId, empresaScopeIds, isSuperAdmin } = useAuth();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CatForm>(empty);
  const [testemunhas, setTestemunhas] = useState<Testemunha[]>([]);
  const [saving, setSaving] = useState(false);

  // Catálogos
  const { data: situacoes = [] } = useQuery({
    queryKey: ["cat-cat-cat_situacoes_geradoras-active"],
    queryFn: async () => (await (supabase.from as any)("cat_situacoes_geradoras").select("*").eq("ativo", true).order("codigo")).data || [],
  });
  const { data: agentes = [] } = useQuery({
    queryKey: ["cat-cat-cat_agentes_causadores-active"],
    queryFn: async () => (await (supabase.from as any)("cat_agentes_causadores").select("*").eq("ativo", true).order("codigo")).data || [],
  });
  const { data: partes = [] } = useQuery({
    queryKey: ["cat-cat-cat_partes_atingidas-active"],
    queryFn: async () => (await (supabase.from as any)("cat_partes_atingidas").select("*").eq("ativo", true).order("codigo")).data || [],
  });
  const { data: naturezas = [] } = useQuery({
    queryKey: ["cat-cat-cat_naturezas_lesao-active"],
    queryFn: async () => (await (supabase.from as any)("cat_naturezas_lesao").select("*").eq("ativo", true).order("codigo")).data || [],
  });

  // Funcionários e unidades — escopo de empresa (RLS já filtra, mas reforçamos no client)
  const { data: funcionarios = [] } = useQuery({
    queryKey: ["cat-novo-funcs", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      let q = (supabase.from as any)("funcionarios").select("id, nome, cpf, cargo, empresa_id, contrato_id");
      if (empresaScopeIds.length && !isSuperAdmin) q = q.in("empresa_id", empresaScopeIds);
      else if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q.eq("ativo", true).order("nome");
      return data || [];
    },
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ["cat-novo-unidades", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data } = await (supabase.from as any)("empresa_config")
        .select("id, nome")
        .or(`id.eq.${empresaId},empresa_pai_id.eq.${empresaId}`);
      return data || [];
    },
  });

  const { data: contratos = [] } = useQuery({
    queryKey: ["cat-novo-contratos", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data } = await (supabase.from as any)("contratos").select("id, nome, unidade_id").eq("empresa_id", empresaId);
      return data || [];
    },
  });

  const { data: catsOrigem = [] } = useQuery({
    queryKey: ["cat-origem", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      let q = (supabase.from as any)("cat_comunicacoes").select("id, numero_cat, data_acidente").eq("tipo_cat", "inicial");
      if (empresaScopeIds.length && !isSuperAdmin) q = q.in("empresa_id", empresaScopeIds);
      else if (empresaId) q = q.eq("empresa_id", empresaId);
      return (await q.order("data_acidente", { ascending: false })).data || [];
    },
    enabled: form.tipo_cat !== "inicial",
  });

  // Hidratação para edição
  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { data, error } = await (supabase.from as any)("cat_comunicacoes").select("*").eq("id", editId).maybeSingle();
      if (error || !data) {
        toast.error("CAT não encontrada ou sem permissão");
        navigate("/cat");
        return;
      }
      setForm({
        tipo_cat: data.tipo_cat,
        cat_origem_id: data.cat_origem_id,
        unidade_id: data.unidade_id,
        contrato_id: data.contrato_id,
        funcionario_id: data.funcionario_id,
        cbo: data.cbo || "",
        remuneracao_mensal: data.remuneracao_mensal?.toString() || "",
        jornada_semanal_horas: data.jornada_semanal_horas?.toString() || "",
        data_acidente: data.data_acidente,
        hora_acidente: data.hora_acidente || "",
        tipo_acidente: data.tipo_acidente,
        local_acidente: data.local_acidente || "",
        endereco_local: data.endereco_local || "",
        cep: data.cep || "",
        municipio: data.municipio || "",
        uf: data.uf || "",
        situacao_geradora_id: data.situacao_geradora_id,
        agente_causador_id: data.agente_causador_id,
        parte_atingida_id: data.parte_atingida_id,
        lateralidade: data.lateralidade || "N",
        natureza_lesao_id: data.natureza_lesao_id,
        cid_codigo: data.cid_codigo || "",
        cid_descricao: data.cid_descricao || "",
        data_atendimento: data.data_atendimento || "",
        hora_atendimento: data.hora_atendimento || "",
        hospital: data.hospital || "",
        medico_nome: data.medico_nome || "",
        medico_crm: data.medico_crm || "",
        medico_uf: data.medico_uf || "",
        houve_internacao: data.houve_internacao || false,
        descricao_lesao: data.descricao_lesao || "",
        houve_afastamento: data.houve_afastamento,
        ultimo_dia_trabalhado: data.ultimo_dia_trabalhado || "",
        obito: data.obito,
        data_obito: data.data_obito || "",
        emitente_tipo: data.emitente_tipo,
        emitente_nome: data.emitente_nome || "",
        emitente_cpf: data.emitente_cpf || "",
        emitente_cargo: data.emitente_cargo || "",
        observacoes: data.observacoes || "",
      });
      const { data: ts } = await (supabase.from as any)("cat_testemunhas").select("*").eq("cat_id", editId);
      setTestemunhas((ts || []).map((t: any) => ({
        id: t.id, nome: t.nome, cpf: t.cpf || "", cargo: t.cargo || "", telefone: t.telefone || "",
      })));
    })();
  }, [editId, navigate]);

  // Auto-fill funcionário ao selecionar
  useEffect(() => {
    const f = (funcionarios as any[]).find((x) => x.id === form.funcionario_id);
    if (f && !form.contrato_id && f.contrato_id) {
      setForm((p) => ({ ...p, contrato_id: f.contrato_id }));
    }
  }, [form.funcionario_id, funcionarios]);

  const update = <K extends keyof CatForm>(k: K, v: CatForm[K]) => setForm((p) => ({ ...p, [k]: v }));

  // Validações por etapa
  const validateStep = (s: number): string | null => {
    if (s === 0) {
      if (form.tipo_cat !== "inicial" && !form.cat_origem_id) return "Selecione a CAT de origem.";
    }
    if (s === 1) {
      if (!form.funcionario_id) return "Selecione o funcionário.";
      // Reforço de tenant no client
      const f = (funcionarios as any[]).find((x) => x.id === form.funcionario_id);
      if (!f) return "Funcionário fora do seu escopo de empresa.";
    }
    if (s === 2) {
      if (!form.data_acidente) return "Informe a data do acidente.";
      if (new Date(form.data_acidente) > new Date()) return "Data não pode ser futura.";
    }
    if (s === 4) {
      // Atendimento livre em rascunho
    }
    if (s === 5) {
      if (form.houve_afastamento && !form.ultimo_dia_trabalhado) return "Informe o último dia trabalhado.";
      if (form.obito && !form.data_obito) return "Informe a data do óbito.";
    }
    return null;
  };

  const next = () => {
    const err = validateStep(step);
    if (err) {
      toast.error(err);
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const addTestemunha = () =>
    setTestemunhas((p) => [...p, { nome: "", cpf: "", cargo: "", telefone: "" }]);
  const updateTestemunha = (i: number, k: keyof Testemunha, v: string) =>
    setTestemunhas((p) => p.map((t, idx) => (idx === i ? { ...t, [k]: v } : t)));
  const removeTestemunha = (i: number) =>
    setTestemunhas((p) => p.filter((_, idx) => idx !== i));

  const salvar = async () => {
    if (!empresaId) {
      toast.error("Selecione uma empresa ativa.");
      return;
    }
    // Validações finais
    for (let i = 0; i <= 5; i++) {
      const err = validateStep(i);
      if (err) {
        toast.error(`Etapa ${STEPS[i]}: ${err}`);
        setStep(i);
        return;
      }
    }
    setSaving(true);
    try {
      const payload: any = {
        empresa_id: empresaId,
        unidade_id: form.unidade_id || null,
        contrato_id: form.contrato_id || null,
        tipo_cat: form.tipo_cat,
        cat_origem_id: form.cat_origem_id || null,
        funcionario_id: form.funcionario_id,
        cbo: form.cbo || null,
        remuneracao_mensal: form.remuneracao_mensal ? Number(form.remuneracao_mensal) : null,
        jornada_semanal_horas: form.jornada_semanal_horas ? Number(form.jornada_semanal_horas) : null,
        data_acidente: form.data_acidente,
        hora_acidente: form.hora_acidente || null,
        tipo_acidente: form.tipo_acidente,
        local_acidente: form.local_acidente || null,
        endereco_local: form.endereco_local || null,
        cep: form.cep || null,
        municipio: form.municipio || null,
        uf: form.uf || null,
        situacao_geradora_id: form.situacao_geradora_id,
        agente_causador_id: form.agente_causador_id,
        parte_atingida_id: form.parte_atingida_id,
        lateralidade: form.lateralidade,
        natureza_lesao_id: form.natureza_lesao_id,
        cid_codigo: form.cid_codigo || null,
        cid_descricao: form.cid_descricao || null,
        data_atendimento: form.data_atendimento || null,
        hora_atendimento: form.hora_atendimento || null,
        hospital: form.hospital || null,
        medico_nome: form.medico_nome || null,
        medico_crm: form.medico_crm || null,
        medico_uf: form.medico_uf || null,
        houve_internacao: form.houve_internacao,
        descricao_lesao: form.descricao_lesao || null,
        houve_afastamento: form.houve_afastamento,
        ultimo_dia_trabalhado: form.ultimo_dia_trabalhado || null,
        obito: form.obito,
        data_obito: form.data_obito || null,
        emitente_tipo: form.emitente_tipo,
        emitente_nome: form.emitente_nome || null,
        emitente_cpf: form.emitente_cpf || null,
        emitente_cargo: form.emitente_cargo || null,
        observacoes: form.observacoes || null,
      };

      let catId = editId;
      if (editId) {
        const { error } = await (supabase.from as any)("cat_comunicacoes").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase.from as any)("cat_comunicacoes").insert(payload).select("id").single();
        if (error) throw error;
        catId = data.id;
      }

      // Sincroniza testemunhas
      if (catId) {
        await (supabase.from as any)("cat_testemunhas").delete().eq("cat_id", catId);
        const valid = testemunhas.filter((t) => t.nome.trim());
        if (valid.length) {
          await (supabase.from as any)("cat_testemunhas").insert(
            valid.map((t) => ({
              cat_id: catId,
              empresa_id: empresaId,
              nome: t.nome,
              cpf: t.cpf || null,
              cargo: t.cargo || null,
              telefone: t.telefone || null,
            }))
          );
        }
      }

      toast.success(editId ? "CAT atualizada" : "CAT criada (rascunho)");
      navigate(`/cat/${catId}`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar CAT");
    } finally {
      setSaving(false);
    }
  };

  const progress = ((step + 1) / STEPS.length) * 100;
  const sel = <T extends { id: string; codigo: string; descricao: string }>(arr: T[], id: string | null) =>
    arr.find((x) => x.id === id)?.descricao || "—";

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate("/cat")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <Badge variant="outline" className="font-mono">
          Etapa {step + 1} / {STEPS.length} — {STEPS[step]}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-primary" />
            {editId ? "Editar CAT" : "Nova CAT"}
          </CardTitle>
          <Progress value={progress} className="h-1.5" />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* STEP 0 */}
          {step === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Tipo da CAT *</Label>
                <Select value={form.tipo_cat} onValueChange={(v) => update("tipo_cat", v as CatTipo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.tipo_cat !== "inicial" && (
                <div>
                  <Label>CAT de origem *</Label>
                  <Select
                    value={form.cat_origem_id || ""}
                    onValueChange={(v) => update("cat_origem_id", v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>
                      {(catsOrigem as any[]).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.numero_cat || "(rascunho)"} — {new Date(c.data_acidente).toLocaleDateString("pt-BR")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Unidade</Label>
                <Select value={form.unidade_id || ""} onValueChange={(v) => update("unidade_id", v || null)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {(unidades as any[]).map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Contrato</Label>
                <Select value={form.contrato_id || ""} onValueChange={(v) => update("contrato_id", v || null)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {(contratos as any[]).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Funcionário acidentado * (somente da sua empresa)</Label>
                <Select value={form.funcionario_id} onValueChange={(v) => update("funcionario_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {(funcionarios as any[]).map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome} {f.cpf ? `— ${f.cpf}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>CBO</Label>
                <Input value={form.cbo} onChange={(e) => update("cbo", e.target.value)} placeholder="Ex.: 7156-15" />
              </div>
              <div>
                <Label>Remuneração mensal (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.remuneracao_mensal}
                  onChange={(e) => update("remuneracao_mensal", e.target.value)}
                />
              </div>
              <div>
                <Label>Jornada semanal (horas)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={form.jornada_semanal_horas}
                  onChange={(e) => update("jornada_semanal_horas", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* STEP 2 — Acidente */}
          {step === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Data do acidente *</Label>
                <Input type="date" value={form.data_acidente} onChange={(e) => update("data_acidente", e.target.value)} />
              </div>
              <div>
                <Label>Hora do acidente</Label>
                <Input type="time" value={form.hora_acidente} onChange={(e) => update("hora_acidente", e.target.value)} />
              </div>
              <div>
                <Label>Tipo de acidente *</Label>
                <Select value={form.tipo_acidente} onValueChange={(v) => update("tipo_acidente", v as CatTipoAcidente)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_ACIDENTE_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Local do acidente</Label>
                <Input value={form.local_acidente} onChange={(e) => update("local_acidente", e.target.value)} placeholder="Ex.: subestação SE-12" />
              </div>
              <div className="md:col-span-2">
                <Label>Endereço</Label>
                <Input value={form.endereco_local} onChange={(e) => update("endereco_local", e.target.value)} />
              </div>
              <div>
                <Label>CEP</Label>
                <Input value={form.cep} onChange={(e) => update("cep", e.target.value)} />
              </div>
              <div>
                <Label>Município</Label>
                <Input value={form.municipio} onChange={(e) => update("municipio", e.target.value)} />
              </div>
              <div>
                <Label>UF</Label>
                <Input maxLength={2} value={form.uf} onChange={(e) => update("uf", e.target.value.toUpperCase())} />
              </div>
            </div>
          )}

          {/* STEP 3 — Lesão */}
          {step === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Situação geradora do acidente</Label>
                <Select value={form.situacao_geradora_id || ""} onValueChange={(v) => update("situacao_geradora_id", v || null)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {(situacoes as any[]).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.codigo} — {s.descricao}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Agente causador</Label>
                <Select value={form.agente_causador_id || ""} onValueChange={(v) => update("agente_causador_id", v || null)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {(agentes as any[]).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.codigo} — {s.descricao}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Parte atingida</Label>
                <Select value={form.parte_atingida_id || ""} onValueChange={(v) => update("parte_atingida_id", v || null)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {(partes as any[]).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.codigo} — {s.descricao}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Lateralidade</Label>
                <Select value={form.lateralidade} onValueChange={(v) => update("lateralidade", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="N">Não aplicável</SelectItem>
                    <SelectItem value="D">Direita</SelectItem>
                    <SelectItem value="E">Esquerda</SelectItem>
                    <SelectItem value="A">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Natureza da lesão</Label>
                <Select value={form.natureza_lesao_id || ""} onValueChange={(v) => update("natureza_lesao_id", v || null)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {(naturezas as any[]).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.codigo} — {s.descricao}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>CID-10</Label>
                <Input value={form.cid_codigo} onChange={(e) => update("cid_codigo", e.target.value.toUpperCase())} placeholder="Ex.: S62.6" />
              </div>
              <div className="md:col-span-2">
                <Label>Descrição do CID</Label>
                <Input value={form.cid_descricao} onChange={(e) => update("cid_descricao", e.target.value)} />
              </div>
            </div>
          )}

          {/* STEP 4 — Atendimento */}
          {step === 4 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Data do atendimento</Label>
                <Input type="date" value={form.data_atendimento} onChange={(e) => update("data_atendimento", e.target.value)} />
              </div>
              <div>
                <Label>Hora do atendimento</Label>
                <Input type="time" value={form.hora_atendimento} onChange={(e) => update("hora_atendimento", e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Hospital / Unidade de atendimento</Label>
                <Input value={form.hospital} onChange={(e) => update("hospital", e.target.value)} />
              </div>
              <div>
                <Label>Médico</Label>
                <Input value={form.medico_nome} onChange={(e) => update("medico_nome", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>CRM</Label>
                  <Input value={form.medico_crm} onChange={(e) => update("medico_crm", e.target.value)} />
                </div>
                <div>
                  <Label>UF</Label>
                  <Input maxLength={2} value={form.medico_uf} onChange={(e) => update("medico_uf", e.target.value.toUpperCase())} />
                </div>
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <Switch checked={form.houve_internacao} onCheckedChange={(v) => update("houve_internacao", v)} />
                <Label>Houve internação</Label>
              </div>
              <div className="md:col-span-2">
                <Label>Descrição da lesão / diagnóstico</Label>
                <Textarea value={form.descricao_lesao} onChange={(e) => update("descricao_lesao", e.target.value)} rows={3} />
              </div>
            </div>
          )}

          {/* STEP 5 — Afastamento/Óbito */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.houve_afastamento} onCheckedChange={(v) => update("houve_afastamento", v)} />
                <Label>Houve afastamento</Label>
              </div>
              {form.houve_afastamento && (
                <div>
                  <Label>Último dia trabalhado *</Label>
                  <Input
                    type="date"
                    value={form.ultimo_dia_trabalhado}
                    onChange={(e) => update("ultimo_dia_trabalhado", e.target.value)}
                  />
                </div>
              )}
              <div className="flex items-center gap-2 pt-2 border-t">
                <Switch checked={form.obito} onCheckedChange={(v) => update("obito", v)} />
                <Label className="text-red-700 dark:text-red-400 font-medium">
                  Acidente fatal (óbito)
                </Label>
              </div>
              {form.obito && (
                <>
                  <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 p-3 text-sm text-red-800 dark:text-red-300 flex gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    Acidentes fatais exigem comunicação <strong>IMEDIATA</strong> ao eSocial.
                  </div>
                  <div>
                    <Label>Data do óbito *</Label>
                    <Input type="date" value={form.data_obito} onChange={(e) => update("data_obito", e.target.value)} />
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label>Emitente *</Label>
                  <Select value={form.emitente_tipo} onValueChange={(v) => update("emitente_tipo", v as CatEmitenteTipo)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(EMITENTE_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nome do emitente</Label>
                  <Input value={form.emitente_nome} onChange={(e) => update("emitente_nome", e.target.value)} />
                </div>
                <div>
                  <Label>CPF do emitente</Label>
                  <Input value={form.emitente_cpf} onChange={(e) => update("emitente_cpf", e.target.value)} />
                </div>
                <div>
                  <Label>Cargo do emitente</Label>
                  <Input value={form.emitente_cargo} onChange={(e) => update("emitente_cargo", e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 6 — Testemunhas */}
          {step === 6 && (
            <div className="space-y-3">
              {testemunhas.map((t, i) => (
                <Card key={i}>
                  <CardContent className="p-3 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
                    <div className="md:col-span-2">
                      <Label className="text-xs">Nome</Label>
                      <Input value={t.nome} onChange={(e) => updateTestemunha(i, "nome", e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">CPF</Label>
                      <Input value={t.cpf} onChange={(e) => updateTestemunha(i, "cpf", e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Cargo</Label>
                      <Input value={t.cargo} onChange={(e) => updateTestemunha(i, "cargo", e.target.value)} />
                    </div>
                    <div className="flex gap-1">
                      <Input
                        placeholder="Telefone"
                        value={t.telefone}
                        onChange={(e) => updateTestemunha(i, "telefone", e.target.value)}
                      />
                      <Button size="sm" variant="ghost" onClick={() => removeTestemunha(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" onClick={addTestemunha}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar testemunha
              </Button>
            </div>
          )}

          {/* STEP 7 — Anexos */}
          {step === 7 && (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground space-y-2">
              <FileWarning className="h-8 w-8 mx-auto opacity-40" />
              <p>
                Anexos (boletim, atestado, fotos, laudo) podem ser enviados para o Google Drive da
                empresa <strong>após salvar a CAT</strong>, na tela de detalhe.
              </p>
              <p className="text-xs">Arquivos são armazenados no Drive vinculado à sua empresa (BYOK) — isolamento físico por tenant.</p>
            </div>
          )}

          {/* STEP 8 — Dados eSocial S-2210 */}
          {step === 8 && (
            <CatEsocialStep catId={editId || null} empresaId={empresaId} />
          )}

          {/* STEP 9 — Revisão */}
          {step === 9 && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md bg-muted p-3 grid grid-cols-2 gap-2">
                <div><strong>Tipo:</strong> {TIPO_LABEL[form.tipo_cat]}</div>
                <div><strong>Data acidente:</strong> {new Date(form.data_acidente).toLocaleDateString("pt-BR")} {form.hora_acidente}</div>
                <div><strong>Funcionário:</strong> {(funcionarios as any[]).find((f) => f.id === form.funcionario_id)?.nome || "—"}</div>
                <div><strong>Tipo acidente:</strong> {TIPO_ACIDENTE_LABEL[form.tipo_acidente]}</div>
                <div><strong>Local:</strong> {form.local_acidente || "—"}</div>
                <div><strong>CID:</strong> {form.cid_codigo || "—"}</div>
                <div><strong>Situação:</strong> {sel(situacoes as any[], form.situacao_geradora_id)}</div>
                <div><strong>Parte atingida:</strong> {sel(partes as any[], form.parte_atingida_id)}</div>
                <div><strong>Afastamento:</strong> {form.houve_afastamento ? `Sim — desde ${form.ultimo_dia_trabalhado}` : "Não"}</div>
                <div><strong>Óbito:</strong> {form.obito ? `Sim — ${form.data_obito}` : "Não"}</div>
                <div className="col-span-2"><strong>Testemunhas:</strong> {testemunhas.filter((t) => t.nome).length}</div>
              </div>
              <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 p-3 text-sm text-blue-800 dark:text-blue-300 flex gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                Ao salvar, a CAT é criada como <strong>rascunho</strong>. A conclusão (com geração de número definitivo) é feita na tela de detalhe.
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={prev} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next}>
                Próximo <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={salvar} disabled={saving}>
                <Save className="h-4 w-4 mr-1" /> {saving ? "Salvando…" : "Salvar CAT"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
