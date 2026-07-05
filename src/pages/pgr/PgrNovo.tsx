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
import { PgrDocumento, isEditavel } from "@/lib/pgrTypes";

export default function PgrNovo() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const editing = !!id;
  const { empresaId, user } = useAuth();
  const perms = usePermissions("pgr");
  const qc = useQueryClient();

  const [unidadeId, setUnidadeId] = useState<string>("__matriz__");
  const [dataEmissao, setDataEmissao] = useState("");
  const [vigIni, setVigIni] = useState("");
  const [vigFim, setVigFim] = useState("");
  const [respNome, setRespNome] = useState("");
  const [respRegistro, setRespRegistro] = useState("");
  const [metodologia, setMetodologia] = useState("");
  const [escopo, setEscopo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: matriz } = useQuery({
    queryKey: ["pgr-novo-matriz", empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      const { data } = await (supabase.from as any)("empresa_config")
        .select("id, nome").eq("id", empresaId).maybeSingle();
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ["pgr-novo-unidades", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data } = await (supabase.from as any)("empresa_config")
        .select("id, nome")
        .eq("empresa_pai_id", empresaId)
        .order("nome");
      return data || [];
    },
  });

  const { data: doc } = useQuery({
    queryKey: ["pgr-edit", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("pgr_documentos")
        .select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as PgrDocumento | null;
    },
    enabled: editing,
  });

  useEffect(() => {
    if (!doc) return;
    setUnidadeId(doc.unidade_id || "__matriz__");
    setDataEmissao(doc.data_emissao || "");
    setVigIni(doc.data_vigencia_inicio || "");
    setVigFim(doc.data_vigencia_fim || "");
    setRespNome(doc.resp_tec_nome || "");
    setRespRegistro(doc.resp_tec_registro || "");
    setMetodologia(doc.metodologia_avaliacao || "");
    setEscopo(doc.escopo || "");
    setObservacoes(doc.observacoes || "");
  }, [doc]);

  if (!perms.canCreate && !editing) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">Sem permissão para criar PGR.</CardContent></Card>;
  }
  if (editing && doc && !isEditavel(doc.status)) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground space-y-3">
          <p>Este PGR está em status <strong>{doc.status}</strong> e não pode ser editado diretamente.</p>
          <p className="text-sm">Abra uma revisão a partir da tela de detalhe.</p>
          <Button variant="outline" onClick={() => navigate(`/pgr/${id}`)}>Ver detalhe</Button>
        </CardContent>
      </Card>
    );
  }

  const handleSave = async () => {
    if (!empresaId) { toast.error("Selecione uma empresa ativa"); return; }
    if (!respNome.trim()) { toast.error("Informe o responsável técnico"); return; }
    if (vigIni && vigFim && vigIni > vigFim) { toast.error("Vigência inicial maior que a final"); return; }
    setSaving(true);
    try {
      const payload: any = {
        empresa_id: empresaId,
        unidade_id: unidadeId === "__matriz__" ? null : unidadeId,
        data_emissao: dataEmissao || null,
        data_vigencia_inicio: vigIni || null,
        data_vigencia_fim: vigFim || null,
        resp_tec_nome: respNome.trim(),
        resp_tec_registro: respRegistro.trim() || null,
        metodologia_avaliacao: metodologia.trim() || null,
        escopo: escopo.trim() || null,
        observacoes: observacoes.trim() || null,
      };
      if (editing) {
        const { error } = await (supabase.from as any)("pgr_documentos").update(payload).eq("id", id);
        if (error) throw error;
        toast.success("PGR atualizado");
        qc.invalidateQueries({ queryKey: ["pgr-edit", id] });
        qc.invalidateQueries({ queryKey: ["pgr-detalhe", id] });
        navigate(`/pgr/${id}`);
      } else {
        const { data, error } = await (supabase.from as any)("pgr_documentos")
          .insert({ ...payload, versao: 1, status: "rascunho", created_by: user?.id })
          .select("id").single();
        if (error) throw error;
        toast.success("PGR criado em rascunho");
        qc.invalidateQueries({ queryKey: ["pgr-list"] });
        navigate(`/pgr/${data.id}`);
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
        <Button variant="ghost" size="sm" onClick={() => navigate("/pgr")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <h1 className="text-xl font-bold">{editing ? "Editar PGR" : "Novo PGR"}</h1>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Identificação</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
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
            <Label className="text-xs">Data de emissão</Label>
            <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
          </div>
          <div />
          <div>
            <Label className="text-xs">Vigência inicial</Label>
            <Input type="date" value={vigIni} onChange={(e) => setVigIni(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Vigência final</Label>
            <Input type="date" value={vigFim} onChange={(e) => setVigFim(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Responsável Técnico *</Label>
            <Input value={respNome} onChange={(e) => setRespNome(e.target.value)} placeholder="Nome do RT" />
          </div>
          <div>
            <Label className="text-xs">Registro profissional</Label>
            <Input value={respRegistro} onChange={(e) => setRespRegistro(e.target.value)} placeholder="CREA / MTE / etc." />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Escopo</Label>
            <Textarea rows={3} value={escopo} onChange={(e) => setEscopo(e.target.value)}
              placeholder="Atividades, unidades e processos abrangidos pelo PGR." />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Metodologia de avaliação</Label>
            <Textarea rows={3} value={metodologia} onChange={(e) => setMetodologia(e.target.value)}
              placeholder="Ex.: matriz 5×5 (severidade × probabilidade), avaliação qualitativa e quantitativa..." />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate("/pgr")}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> {saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar rascunho"}
        </Button>
      </div>
    </div>
  );
}
