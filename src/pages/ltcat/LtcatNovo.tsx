import { useEffect, useState } from "react";
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
import { LtcatDocumento, LTCAT_MOTIVO_LABEL, LtcatMotivoEmissao, isLtcatEditavel } from "@/lib/ltcatTypes";

export default function LtcatNovo() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const editing = !!id;
  const { empresaId, user } = useAuth();
  const perms = usePermissions("ltcat");
  const qc = useQueryClient();

  const [unidadeId, setUnidadeId] = useState<string>("__matriz__");
  const [pgrId, setPgrId] = useState<string>("__none__");
  const [motivo, setMotivo] = useState<LtcatMotivoEmissao>("inicial");
  const [dataEmissao, setDataEmissao] = useState("");
  const [vigIni, setVigIni] = useState("");
  const [vigFim, setVigFim] = useState("");
  const [cnae, setCnae] = useState("");
  const [grauRisco, setGrauRisco] = useState<string>("");
  const [escopo, setEscopo] = useState("");
  const [metodologia, setMetodologia] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: unidades = [] } = useQuery({
    queryKey: ["ltcat-novo-unidades", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data } = await (supabase.from as any)("empresa_config")
        .select("id, nome").eq("empresa_pai_id", empresaId).order("nome");
      return data || [];
    },
  });

  const { data: pgrs = [] } = useQuery({
    queryKey: ["ltcat-novo-pgrs", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data } = await (supabase.from as any)("pgr_documentos")
        .select("id, versao, status, unidade_id")
        .eq("empresa_id", empresaId).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: doc } = useQuery({
    queryKey: ["ltcat-edit", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("ltcat_documentos")
        .select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as LtcatDocumento | null;
    },
    enabled: editing,
  });

  useEffect(() => {
    if (!doc) return;
    setUnidadeId(doc.unidade_id || "__matriz__");
    setPgrId(doc.pgr_id || "__none__");
    setMotivo(doc.motivo_emissao);
    setDataEmissao(doc.data_emissao || "");
    setVigIni(doc.data_vigencia_inicio || "");
    setVigFim(doc.data_vigencia_fim || "");
    setCnae(doc.cnae || "");
    setGrauRisco(doc.grau_risco != null ? String(doc.grau_risco) : "");
    setEscopo(doc.escopo || "");
    setMetodologia(doc.metodologia_geral || "");
    setObservacoes(doc.observacoes || "");
  }, [doc]);

  if (!perms.canCreate && !editing) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">Sem permissão para criar LTCAT.</CardContent></Card>;
  }
  if (editing && doc && !isLtcatEditavel(doc.status)) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground space-y-3">
          <p>Este LTCAT está em status <strong>{doc.status}</strong> e não pode ser editado diretamente.</p>
          <p className="text-sm">Abra uma revisão a partir da tela de detalhe.</p>
          <Button variant="outline" onClick={() => navigate(`/ltcat/${id}`)}>Ver detalhe</Button>
        </CardContent>
      </Card>
    );
  }

  const handleSave = async () => {
    if (!empresaId) { toast.error("Selecione uma empresa ativa"); return; }
    if (vigIni && vigFim && vigIni > vigFim) { toast.error("Vigência inicial maior que a final"); return; }
    setSaving(true);
    try {
      const payload: any = {
        empresa_id: empresaId,
        unidade_id: unidadeId === "__matriz__" ? null : unidadeId,
        pgr_id: pgrId === "__none__" ? null : pgrId,
        motivo_emissao: motivo,
        data_emissao: dataEmissao || null,
        data_vigencia_inicio: vigIni || null,
        data_vigencia_fim: vigFim || null,
        cnae: cnae.trim() || null,
        grau_risco: grauRisco ? Number(grauRisco) : null,
        escopo: escopo.trim() || null,
        metodologia_geral: metodologia.trim() || null,
        observacoes: observacoes.trim() || null,
      };
      if (editing) {
        const { error } = await (supabase.from as any)("ltcat_documentos")
          .update({ ...payload, updated_by: user?.id }).eq("id", id);
        if (error) throw error;
        toast.success("LTCAT atualizado");
        qc.invalidateQueries({ queryKey: ["ltcat-edit", id] });
        qc.invalidateQueries({ queryKey: ["ltcat-detalhe", id] });
        navigate(`/ltcat/${id}`);
      } else {
        const { data, error } = await (supabase.from as any)("ltcat_documentos")
          .insert({ ...payload, versao: 1, status: "rascunho", created_by: user?.id, updated_by: user?.id })
          .select("id").single();
        if (error) throw error;
        toast.success("LTCAT criado em rascunho");
        qc.invalidateQueries({ queryKey: ["ltcat-list"] });
        navigate(`/ltcat/${data.id}`);
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
        <Button variant="ghost" size="sm" onClick={() => navigate("/ltcat")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <h1 className="text-xl font-bold">{editing ? "Editar LTCAT" : "Novo LTCAT"}</h1>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Identificação</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Unidade</Label>
            <Select value={unidadeId} onValueChange={setUnidadeId}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__matriz__">Matriz (empresa ativa)</SelectItem>
                {(unidades as any[]).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">PGR vinculado</Label>
            <Select value={pgrId} onValueChange={setPgrId}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Sem PGR vinculado —</SelectItem>
                {(pgrs as any[]).map((p) => (
                  <SelectItem key={p.id} value={p.id}>PGR v{p.versao} ({p.status})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Motivo de emissão *</Label>
            <Select value={motivo} onValueChange={(v) => setMotivo(v as LtcatMotivoEmissao)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(LTCAT_MOTIVO_LABEL).map(([k, v]) => (
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
            <Label className="text-xs">Vigência inicial</Label>
            <Input type="date" value={vigIni} onChange={(e) => setVigIni(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Vigência final</Label>
            <Input type="date" value={vigFim} onChange={(e) => setVigFim(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">CNAE</Label>
            <Input value={cnae} onChange={(e) => setCnae(e.target.value)} placeholder="0000-0/00" />
          </div>
          <div>
            <Label className="text-xs">Grau de risco</Label>
            <Input type="number" min={1} max={4} value={grauRisco} onChange={(e) => setGrauRisco(e.target.value)} placeholder="1 a 4" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Escopo / período avaliado</Label>
            <Textarea rows={3} value={escopo} onChange={(e) => setEscopo(e.target.value)}
              placeholder="Atividades, setores, funções e período abrangidos pelo LTCAT." />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Metodologia geral</Label>
            <Textarea rows={3} value={metodologia} onChange={(e) => setMetodologia(e.target.value)}
              placeholder="Normas de referência (NHO-01, NHO-06, NR-15), instrumentos, técnicas de coleta..." />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
          <div className="md:col-span-2 text-xs text-muted-foreground">
            * O responsável técnico, agentes nocivos e conclusões previdenciárias são cadastrados na tela de detalhe.
            A empresa do laudo é definida automaticamente pela empresa ativa e não pode ser alterada depois.
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate("/ltcat")}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> {saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar rascunho"}
        </Button>
      </div>
    </div>
  );
}
