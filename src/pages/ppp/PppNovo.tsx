import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import {
  PppDocumento, PppMotivoEmissao, PPP_MOTIVO_LABEL, isPppEditavel,
} from "@/lib/pppTypes";

export default function PppNovo() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const editing = !!id;
  const { empresaId, empresaScopeIds, isSuperAdmin, user } = useAuth();
  const perms = usePermissions("ppp");
  const qc = useQueryClient();

  const [funcionarioId, setFuncionarioId] = useState("");
  const [motivo, setMotivo] = useState<PppMotivoEmissao>("inicial");
  const [dataEmissao, setDataEmissao] = useState("");
  const [cbo, setCbo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["ppp-novo-funcs", empresaId, empresaScopeIds.join(",")],
    queryFn: async () => {
      let q = (supabase.from as any)("funcionarios")
        .select("id, nome, cpf, matricula, cargo, setor, ghe_id, empresa_id, data_admissao");
      if (empresaScopeIds.length && !isSuperAdmin) q = q.in("empresa_id", empresaScopeIds);
      else if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q.order("nome");
      return data || [];
    },
  });

  const { data: doc } = useQuery({
    queryKey: ["ppp-edit", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("ppp_documentos")
        .select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as PppDocumento | null;
    },
    enabled: editing,
  });

  useEffect(() => {
    if (!doc) return;
    setFuncionarioId(doc.funcionario_id);
    setMotivo(doc.motivo_emissao);
    setDataEmissao(doc.data_emissao || "");
    setCbo(doc.cbo_consolidado || "");
    setDescricao(doc.descricao_atividade_consolidada || "");
    setObservacoes(doc.observacoes || "");
  }, [doc]);

  const funcSel = useMemo(
    () => (funcionarios as any[]).find((f) => f.id === funcionarioId),
    [funcionarios, funcionarioId]
  );

  const { data: ghe } = useQuery({
    queryKey: ["ppp-novo-ghe", funcSel?.ghe_id],
    queryFn: async () => {
      if (!funcSel?.ghe_id) return null;
      const { data } = await (supabase.from as any)("ghe_ges")
        .select("nome").eq("id", funcSel.ghe_id).maybeSingle();
      return data;
    },
    enabled: !!funcSel?.ghe_id,
  });

  if (!perms.canEdit) {
    return (
      <Card><CardContent className="p-8 text-center text-muted-foreground">
        Você não tem permissão para criar/editar PPP.
      </CardContent></Card>
    );
  }

  if (editing && doc && !isPppEditavel(doc.status)) {
    return (
      <Card><CardContent className="p-8 text-center text-muted-foreground">
        PPP em status <b>{doc.status}</b> não pode ser editado diretamente. Abra uma revisão (em breve).
      </CardContent></Card>
    );
  }

  const handleSave = async () => {
    if (!empresaId) { toast.error("Selecione uma empresa ativa"); return; }
    if (!funcionarioId) { toast.error("Selecione um funcionário"); return; }
    // Cross-tenant guard (defense in depth — RLS já bloqueia)
    if (funcSel && empresaScopeIds.length && !isSuperAdmin &&
        !empresaScopeIds.includes(funcSel.empresa_id)) {
      toast.error("Funcionário fora da empresa autorizada");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        funcionario_id: funcionarioId,
        motivo_emissao: motivo,
        data_emissao: dataEmissao || null,
        cbo_consolidado: cbo.trim() || null,
        descricao_atividade_consolidada: descricao.trim() || null,
        observacoes: observacoes.trim() || null,
      };
      if (editing) {
        const { error } = await (supabase.from as any)("ppp_documentos")
          .update({ ...payload, updated_by: user?.id }).eq("id", id);
        if (error) throw error;
        toast.success("PPP atualizado");
        qc.invalidateQueries({ queryKey: ["ppp-edit", id] });
        qc.invalidateQueries({ queryKey: ["ppp-detalhe", id] });
        qc.invalidateQueries({ queryKey: ["ppp-list"] });
        navigate(`/ppp/${id}`);
      } else {
        const { data, error } = await (supabase.from as any)("ppp_documentos")
          .insert({
            ...payload,
            empresa_id: empresaId,
            versao: 1,
            status: "rascunho",
            created_by: user?.id,
            updated_by: user?.id,
          })
          .select("id").single();
        if (error) throw error;
        toast.success("PPP criado em rascunho");
        qc.invalidateQueries({ queryKey: ["ppp-list"] });
        navigate(`/ppp/${data.id}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/ppp")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <h1 className="text-xl font-bold">{editing ? "Editar PPP" : "Novo PPP"}</h1>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Identificação</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs">Funcionário *</Label>
            <Select value={funcionarioId} onValueChange={setFuncionarioId} disabled={editing}>
              <SelectTrigger><SelectValue placeholder="Selecionar funcionário" /></SelectTrigger>
              <SelectContent>
                {(funcionarios as any[]).map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome} {f.cpf ? `· ${f.cpf}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {editing && <p className="text-[11px] text-muted-foreground mt-1">Funcionário não pode ser alterado após criação.</p>}
          </div>

          {funcSel && (
            <>
              <div><Label className="text-xs">CPF</Label><Input value={funcSel.cpf || ""} disabled /></div>
              <div><Label className="text-xs">Matrícula</Label><Input value={funcSel.matricula || ""} disabled /></div>
              <div><Label className="text-xs">Função atual</Label><Input value={funcSel.cargo || ""} disabled /></div>
              <div><Label className="text-xs">Setor</Label><Input value={funcSel.setor || ""} disabled /></div>
              <div><Label className="text-xs">GHE/GES</Label><Input value={ghe?.nome || (funcSel.ghe_id ? "—" : "não vinculado")} disabled /></div>
              <div><Label className="text-xs">Data de admissão</Label><Input value={funcSel.data_admissao || ""} disabled /></div>
            </>
          )}

          <div>
            <Label className="text-xs">Motivo de emissão *</Label>
            <Select value={motivo} onValueChange={(v) => setMotivo(v as PppMotivoEmissao)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PPP_MOTIVO_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Data de emissão</Label>
            <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs">CBO consolidado</Label>
            <Input value={cbo} onChange={(e) => setCbo(e.target.value)} placeholder="ex.: 7156-15" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Descrição consolidada da atividade</Label>
            <Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate("/ppp")}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving || !funcionarioId}>
          <Save className="h-4 w-4 mr-1" /> {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
