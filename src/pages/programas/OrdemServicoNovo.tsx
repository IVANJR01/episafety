import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Save, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { loadGheFicha, riscosToSnapshot, GRUPO_RISCO_LABEL } from "@/lib/gesFicha";
import { OsEscopo, OsRiscoSnapshot, OsEpiSnapshot, OrdemServicoSst } from "@/lib/osTypes";

export default function OrdemServicoNovo() {
  const nav = useNavigate();
  const { id } = useParams();
  const editing = !!id;
  const { empresaId, empresaScopeIds } = useAuth();

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(editing);

  const [empresas, setEmpresas] = useState<{ id: string; nome: string }[]>([]);
  const [ghes, setGhes] = useState<{ id: string; codigo: string; nome: string; empresa_id: string }[]>([]);
  const [funcoes, setFuncoes] = useState<{ id: string; nome_funcao: string; ghe_id: string; descricao_atividade: string | null }[]>([]);
  const [funcionarios, setFuncionarios] = useState<{ id: string; nome: string; matricula: string | null; empresa_id: string }[]>([]);

  const [form, setForm] = useState<any>({
    empresa_id: empresaId || "",
    ghe_id: "",
    funcao_id: "",
    funcionario_id: "",
    escopo: "ghe" as OsEscopo,
    titulo: "",
    atividades: "",
    medidas_preventivas: "",
    proibicoes: "",
    procedimentos_acidente: "",
    responsabilidades: "",
    responsavel_tecnico_nome: "",
    responsavel_tecnico_registro: "",
    data_emissao: new Date().toISOString().slice(0, 10),
    riscos_snapshot: [] as OsRiscoSnapshot[],
    epis_snapshot: [] as OsEpiSnapshot[],
  });

  // Empresas do escopo
  useEffect(() => {
    (async () => {
      let q = (supabase as any).from("empresa_config").select("id, nome").order("nome");
      if (empresaScopeIds.length > 0) q = q.in("id", empresaScopeIds);
      const { data } = await q;
      setEmpresas((data || []) as any);
    })();
  }, [empresaScopeIds.join(",")]);

  // GHEs da empresa selecionada
  useEffect(() => {
    if (!form.empresa_id) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("ghe_ges")
        .select("id, codigo, nome, empresa_id")
        .eq("empresa_id", form.empresa_id)
        .eq("status", "ativo")
        .order("codigo");
      setGhes((data || []) as any);
    })();
  }, [form.empresa_id]);

  // Funcões do GHE selecionado
  useEffect(() => {
    if (!form.ghe_id) {
      setFuncoes([]);
      return;
    }
    (async () => {
      const { data, error } = await (supabase as any)
        .from("ghe_funcoes")
        .select("id, nome_funcao, ghe_id, descricao_atividade")
        .eq("ghe_id", form.ghe_id)
        .order("nome_funcao");
      
      if (error) console.error("Erro ao buscar ghe_funcoes:", error);
      setFuncoes((data || []) as any);
    })();
  }, [form.ghe_id]);

  // Funcionários da empresa
  useEffect(() => {
    if (!form.empresa_id) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("funcionarios")
        .select("id, nome, matricula, empresa_id")
        .eq("empresa_id", form.empresa_id)
        .is("data_demissao", null)
        .order("nome");
      setFuncionarios((data || []) as any);
    })();
  }, [form.empresa_id]);

  // Carrega OS existente
  useEffect(() => {
    if (!editing) return;
    (async () => {
      const { data, error } = await (supabase as any)
        .from("ordens_servico_sst")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) {
        toast.error("OS não encontrada");
        nav("/programas/ordem-servico");
        return;
      }
      setForm({
        ...data,
        data_emissao: data.data_emissao || new Date().toISOString().slice(0, 10),
        riscos_snapshot: data.riscos_snapshot || [],
        epis_snapshot: data.epis_snapshot || [],
      });
      setLoading(false);
    })();
  }, [id]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const carregarDoGhe = async (gheId = form.ghe_id, funcaoId = form.funcao_id, escopo = form.escopo) => {
    if (!gheId) return toast.error("Selecione um GES/GHE primeiro");
    try {
      const ficha = await loadGheFicha(gheId);
      const riscos = riscosToSnapshot(ficha.riscos);
      
      const fnSelecionada = escopo === "funcao" && funcaoId 
        ? funcoes.find((f: any) => f.id === funcaoId) 
        : null;
      
      // A descrição vem da própria linha de ghe_funcoes. Não existe coluna
      // ligando ghe_funcoes a sst_funcoes, então a consulta que ficava aqui
      // nunca chegava a rodar.
      const atividadesFuncao = fnSelecionada?.descricao_atividade || null;
      
      const atividades = atividadesFuncao || ficha.cabecalho.descricao_atividades || form.atividades;
      const medidas = [ficha.cabecalho.medidas_controle_existentes, ficha.cabecalho.medidas_controle_recomendadas]
        .filter(Boolean)
        .join("\n");
      const proibicoesBase = form.proibicoes ||
        "É proibido executar a atividade sem os EPIs indicados, sem treinamento, sob efeito de álcool ou substâncias entorpecentes, ou fora dos procedimentos operacionais estabelecidos.";
      const procedBase = form.procedimentos_acidente ||
        "Em caso de acidente: interromper a atividade, prestar primeiros socorros, acionar o supervisor imediato e o SESMT, isolar o local e comunicar formalmente para abertura de CAT.";
      setForm((f: any) => ({
        ...f,
        titulo: f.titulo || `Ordem de Serviço — ${ficha.cabecalho.codigo} ${ficha.cabecalho.nome}`,
        atividades,
        riscos_snapshot: riscos,
        medidas_preventivas: f.medidas_preventivas || medidas,
        proibicoes: proibicoesBase,
        procedimentos_acidente: procedBase,
        responsabilidades: f.responsabilidades ||
          "Cumprir integralmente as medidas de segurança; usar corretamente os EPIs fornecidos; comunicar imediatamente ao superior qualquer condição insegura; não realizar atividade para a qual não tenha sido treinado.",
      }));
      toast.success(`Dados carregados do GES/GHE (${riscos.length} riscos)`);
    } catch (e: any) {
      toast.error(e.message || "Falha ao carregar GES/GHE");
    }
  };

  const salvar = async () => {
    if (!form.empresa_id) return toast.error("Selecione a empresa");
    if (!form.titulo?.trim()) return toast.error("Informe o título");
    if (form.escopo === "funcionario" && !form.funcionario_id) return toast.error("Selecione o funcionário");
    if (form.escopo === "funcao" && !form.funcao_id) return toast.error("Selecione a função");
    if ((form.escopo === "ghe" || form.escopo === "funcao") && !form.ghe_id) return toast.error("Selecione o GES/GHE");

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      empresa_id: form.empresa_id,
      ghe_id: form.ghe_id || null,
      funcao_id: form.funcao_id || null,
      funcionario_id: form.funcionario_id || null,
      escopo: form.escopo,
      titulo: form.titulo.trim(),
      atividades: form.atividades || null,
      riscos_snapshot: form.riscos_snapshot || [],
      epis_snapshot: form.epis_snapshot || [],
      medidas_preventivas: form.medidas_preventivas || null,
      proibicoes: form.proibicoes || null,
      procedimentos_acidente: form.procedimentos_acidente || null,
      responsabilidades: form.responsabilidades || null,
      responsavel_tecnico_nome: form.responsavel_tecnico_nome || null,
      responsavel_tecnico_registro: form.responsavel_tecnico_registro || null,
      data_emissao: form.data_emissao || null,
    };
    if (!editing) payload.created_by = user?.id || null;
    const q = editing
      ? await (supabase as any).from("ordens_servico_sst").update(payload).eq("id", id).select("id").maybeSingle()
      : await (supabase as any).from("ordens_servico_sst").insert(payload).select("id").maybeSingle();
    
    if (!q.error && form.escopo === "funcao" && form.funcao_id) {
      try {
        const fn = funcoes.find(f => f.id === form.funcao_id);
        if (fn) {
          // Garante que existe o tipo "Ordem de Serviço" no Arquivo Digital
          let { data: tipos } = await (supabase as any).from("internal_document_types")
            .select("id").eq("empresa_id", form.empresa_id).ilike("nome", "%Ordem de Serviço%").limit(1);
          let tipoId = tipos?.[0]?.id;
          if (!tipoId) {
            const ins = await (supabase as any).from("internal_document_types").insert({
              empresa_id: form.empresa_id, nome: "Ordem de Serviço", categoria: "Segurança", created_by: user?.id
            }).select("id").single();
            tipoId = ins.data?.id;
          }
          if (tipoId) {
            // Verifica se o requisito já existe para não dar erro de constraint
            const { data: reqs } = await (supabase as any).from("internal_document_requirements")
              .select("id").eq("empresa_id", form.empresa_id).eq("tipo_documento_id", tipoId).eq("cargo", fn.nome_funcao);
            if (!reqs || reqs.length === 0) {
              await (supabase as any).from("internal_document_requirements").insert({
                empresa_id: form.empresa_id, tipo_documento_id: tipoId, cargo: fn.nome_funcao, obrigatorio: true, created_by: user?.id
              });
            }
          }
        }
      } catch (err) {
        console.error("Erro na automação do Dossiê", err);
      }
    }

    setSaving(false);
    if (q.error) return toast.error(q.error.message);
    toast.success(editing ? "OS atualizada e vinculada ao Dossiê" : "OS criada e vinculada ao Dossiê");
    nav(`/programas/ordem-servico/${q.data?.id || id}`);
  };

  const riscosPorGrupo = useMemo(() => {
    const g: Record<string, OsRiscoSnapshot[]> = {};
    for (const r of form.riscos_snapshot || []) (g[r.grupo] = g[r.grupo] || []).push(r);
    return g;
  }, [form.riscos_snapshot]);

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin inline" /></div>;

  return (
    <div className="space-y-4">
      <PageHeader
        title={editing ? "Editar Ordem de Serviço" : "Nova Ordem de Serviço"}
        subtitle="Documento gerado a partir do GES/GHE — riscos, EPIs e medidas são reaproveitados."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => nav("/programas/ordem-servico")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <Button onClick={salvar} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Salvar
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-sm">1. Identificação</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Empresa *</Label>
              <Select value={form.empresa_id} onValueChange={(v) => set("empresa_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Escopo *</Label>
              <Select value={form.escopo} onValueChange={(v) => {
                set("escopo", v);
                if (form.ghe_id) {
                  carregarDoGhe(form.ghe_id, form.funcao_id, v);
                }
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ghe">Por GES/GHE</SelectItem>
                  <SelectItem value="funcao">Por Função</SelectItem>
                  <SelectItem value="funcionario">Por Funcionário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data de emissão</Label>
              <Input type="date" value={form.data_emissao} onChange={(e) => set("data_emissao", e.target.value)} />
            </div>
            <div>
              <Label>GES/GHE {form.escopo !== "funcionario" ? "*" : ""}</Label>
              <Select value={form.ghe_id} onValueChange={(v) => {
                setForm((f: any) => ({ ...f, ghe_id: v, funcao_id: "" }));
                carregarDoGhe(v, "", form.escopo);
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {ghes.map((g) => <SelectItem key={g.id} value={g.id}>{g.codigo} — {g.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Função</Label>
              <Select value={form.funcao_id || "__none__"} onValueChange={(v) => {
                const newVal = v === "__none__" ? "" : v;
                set("funcao_id", newVal);
                if (form.ghe_id) carregarDoGhe(form.ghe_id, newVal, form.escopo);
              }}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— nenhum —</SelectItem>
                  {funcoes.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome_funcao}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Funcionário</Label>
              <Select value={form.funcionario_id || "__none__"} onValueChange={(v) => set("funcionario_id", v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— nenhum —</SelectItem>
                  {funcionarios.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Título *</Label>
            <Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ex.: OS — Eletricistas de Subestação" />
          </div>
          <div>
            <Button variant="outline" size="sm" onClick={carregarDoGhe} disabled={!form.ghe_id}>
              Carregar dados do GES/GHE
            </Button>
            <span className="text-xs text-muted-foreground ml-2">Popula riscos, atividades e medidas.</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-sm">2. Atividades e Riscos</h3>
          <div>
            <Label>Atividades desenvolvidas</Label>
            <Textarea rows={3} value={form.atividades} onChange={(e) => set("atividades", e.target.value)} />
          </div>
          <div>
            <Label>Riscos identificados ({(form.riscos_snapshot || []).length})</Label>
            <div className="border rounded p-2 max-h-48 overflow-y-auto text-xs space-y-2">
              {Object.keys(riscosPorGrupo).length === 0 && <p className="text-muted-foreground">Nenhum risco carregado. Use "Carregar dados do GES/GHE".</p>}
              {Object.entries(riscosPorGrupo).map(([g, arr]) => (
                <div key={g}>
                  <Badge variant="outline" className="mb-1">{GRUPO_RISCO_LABEL[g] || g}</Badge>
                  <ul className="pl-4 list-disc">
                    {arr.map((r, i) => <li key={i}>{r.descricao}{r.fonte ? ` (${r.fonte})` : ""}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-sm">3. Medidas, proibições e procedimentos</h3>
          <div>
            <Label>Medidas preventivas e de controle</Label>
            <Textarea rows={3} value={form.medidas_preventivas} onChange={(e) => set("medidas_preventivas", e.target.value)} />
          </div>
          <div>
            <Label>Proibições</Label>
            <Textarea rows={2} value={form.proibicoes} onChange={(e) => set("proibicoes", e.target.value)} />
          </div>
          <div>
            <Label>Procedimentos em caso de acidente</Label>
            <Textarea rows={2} value={form.procedimentos_acidente} onChange={(e) => set("procedimentos_acidente", e.target.value)} />
          </div>
          <div>
            <Label>Responsabilidades do trabalhador</Label>
            <Textarea rows={2} value={form.responsabilidades} onChange={(e) => set("responsabilidades", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-sm">4. Responsável técnico</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.responsavel_tecnico_nome} onChange={(e) => set("responsavel_tecnico_nome", e.target.value)} />
            </div>
            <div>
              <Label>Registro (CREA / MTE / etc.)</Label>
              <Input value={form.responsavel_tecnico_registro} onChange={(e) => set("responsavel_tecnico_registro", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
