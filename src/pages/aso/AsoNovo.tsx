import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Save, FileDown, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { addDays, addMonths, addYears, format } from "date-fns";
import { gerarPdfAso } from "@/lib/asoPdf";
import { loadGheRiscosExames } from "@/lib/asoFromGhe";

const TIPO_EXAMES = [
  { v: "admissional", l: "Admissional" },
  { v: "periodico", l: "Periódico" },
  { v: "retorno", l: "Retorno ao Trabalho" },
  { v: "mudanca_risco", l: "Mudança de Risco" },
  { v: "mudanca_funcao", l: "Mudança de Função" },
  { v: "demissional", l: "Demissional" },
];

const GRUPOS_RISCO = [
  { k: "fisico", l: "Físicos" },
  { k: "quimico", l: "Químicos" },
  { k: "biologico", l: "Biológicos" },
  { k: "ergonomico", l: "Ergonômicos" },
  { k: "acidente", l: "Acidentes / Mecânicos" },
  { k: "outro", l: "Outros" },
];

const STEPS = ["Funcionário", "Tipo", "Riscos", "Exames", "Aptidão", "Validade", "Médico", "Revisão"];

export default function AsoNovo({ editingId, onSaved }: { editingId: string | null; onSaved: () => void }) {
  const { empresaId, empresaScopeIds, isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);

  const [funcionarioId, setFuncionarioId] = useState<string>("");
  const [empresaSel, setEmpresaSel] = useState<string>(empresaId || "");
  const [tipoExame, setTipoExame] = useState<string>("admissional");
  const [riscos, setRiscos] = useState<{ grupo: string; descricao: string }[]>([]);
  const [exames, setExames] = useState<{ exame_id?: string; nome_exame: string; realizado: boolean; data_realizacao?: string; resultado?: string; observacao?: string }[]>([]);
  const [aptidao, setAptidao] = useState<"apto" | "inapto" | "apto_restricao">("apto");
  const [nr35, setNr35] = useState<"apto" | "inapto" | "na">("na");
  const [observacoes, setObservacoes] = useState("");
  const [validadeTipo, setValidadeTipo] = useState<string>("1ano");
  const [dataEmissao, setDataEmissao] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dataVencimento, setDataVencimento] = useState("");
  const [medicoId, setMedicoId] = useState<string>("");
  const [localEmissao, setLocalEmissao] = useState("");
  const [saving, setSaving] = useState(false);

  // Calc validade
  useEffect(() => {
    const base = new Date(dataEmissao);
    if (isNaN(base.getTime())) return;
    let venc = base;
    if (validadeTipo === "90d") venc = addDays(base, 90);
    else if (validadeTipo === "6m") venc = addMonths(base, 6);
    else if (validadeTipo === "1ano") venc = addYears(base, 1);
    else if (validadeTipo === "2anos") venc = addYears(base, 2);
    else return;
    setDataVencimento(format(venc, "yyyy-MM-dd"));
  }, [validadeTipo, dataEmissao]);

  const { data: empresas = [] } = useQuery({
    queryKey: ["aso-empresas", empresaScopeIds.join(",")],
    queryFn: async () => {
      let q = supabase.from("empresa_config").select("id, nome, cnpj").order("nome");
      if (isSuperAdmin && empresaScopeIds.length > 0) q = q.in("id", empresaScopeIds);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["aso-funcionarios", empresaSel],
    enabled: !!empresaSel,
    queryFn: async () => {
      const { data, error } = await supabase.from("funcionarios").select("id, nome, cpf, cargo, setor, data_admissao, matricula, ghe_id, ghe_ges(id, codigo, nome, setor)").eq("empresa_id", empresaSel).order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: medicos = [] } = useQuery({
    queryKey: ["aso-medicos-sel"],
    queryFn: async () => {
      const { data, error } = await supabase.from("aso_medicos").select("id, nome, crm, uf_crm, responsavel_pcmso").eq("ativo", true).order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: catalogo = [] } = useQuery({
    queryKey: ["aso-cat-sel", empresaSel],
    enabled: !!empresaSel,
    queryFn: async () => {
      const { data, error } = await supabase.from("aso_exames_catalogo").select("id, nome").eq("ativo", true).or(`empresa_id.eq.${empresaSel},empresa_id.is.null`).order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  // Load editing
  useEffect(() => {
    if (!editingId) return;
    (async () => {
      const { data: a } = await supabase.from("asos").select("*").eq("id", editingId).maybeSingle();
      if (!a) return;
      setEmpresaSel(a.empresa_id);
      setFuncionarioId(a.funcionario_id);
      setTipoExame(a.tipo_exame);
      setAptidao((a.status_aptidao as any) || "apto");
      setNr35(a.apto_nr35 ? "apto" : a.inapto_nr35 ? "inapto" : "na");
      setObservacoes(a.observacoes || "");
      setValidadeTipo(a.validade_tipo || "1ano");
      setDataEmissao(a.data_emissao);
      setDataVencimento(a.data_vencimento || "");
      setMedicoId(a.medico_id || "");
      setLocalEmissao(a.local_emissao || "");
      const [{ data: r }, { data: e }] = await Promise.all([
        supabase.from("aso_riscos").select("*").eq("aso_id", editingId),
        supabase.from("aso_exames").select("*").eq("aso_id", editingId),
      ]);
      setRiscos((r || []).map((x: any) => ({ grupo: x.grupo, descricao: x.descricao })));
      setExames((e || []).map((x: any) => ({ exame_id: x.exame_id, nome_exame: x.nome_exame, realizado: x.realizado, data_realizacao: x.data_realizacao, resultado: x.resultado, observacao: x.observacao })));
    })();
  }, [editingId]);

  const funcSel = useMemo(() => funcionarios.find((f: any) => f.id === funcionarioId), [funcionarios, funcionarioId]);
  const empSel = useMemo(() => empresas.find((e: any) => e.id === empresaSel), [empresas, empresaSel]);
  const gheVinculado = (funcSel as any)?.ghe_ges;

  // Auto-carregar riscos e exames do GHE quando funcionário ou tipo mudar (apenas se não estiver editando)
  useEffect(() => {
    if (editingId) return;
    const gheId = (funcSel as any)?.ghe_id;
    if (!gheId || !tipoExame) return;
    (async () => {
      try {
        const { riscos: r, exames: ex } = await loadGheRiscosExames(gheId, tipoExame);
        if (r.length || ex.length) {
          setRiscos(r);
          setExames(ex.map((e) => ({ nome_exame: e.nome_exame, realizado: true, data_realizacao: dataEmissao })));
          toast.success(`Carregados ${r.length} risco(s) e ${ex.length} exame(s) do GHE`);
        }
      } catch (e) { /* silent */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funcionarioId, tipoExame]);

  const addRisco = (grupo: string) => setRiscos((r) => [...r, { grupo, descricao: "" }]);
  const updRisco = (i: number, descricao: string) => setRiscos((r) => r.map((x, idx) => idx === i ? { ...x, descricao } : x));
  const rmRisco = (i: number) => setRiscos((r) => r.filter((_, idx) => idx !== i));

  const addExame = () => setExames((e) => [...e, { nome_exame: "", realizado: true, data_realizacao: dataEmissao }]);
  const updExame = (i: number, patch: any) => setExames((e) => e.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const rmExame = (i: number) => setExames((e) => e.filter((_, idx) => idx !== i));

  const validate = () => {
    if (!empresaSel) return "Selecione a empresa";
    if (!funcionarioId) return "Selecione o funcionário";
    if (!tipoExame) return "Selecione o tipo de exame";
    if (!aptidao) return "Defina a aptidão";
    if (!dataEmissao || !dataVencimento) return "Defina datas de emissão e vencimento";
    if (!medicoId) return "Selecione o médico responsável";
    return null;
  };

  const save = async (gerarPdf = false) => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      let asoId = editingId;
      const payload: any = {
        empresa_id: empresaSel,
        funcionario_id: funcionarioId,
        medico_id: medicoId || null,
        tipo_exame: tipoExame,
        data_emissao: dataEmissao,
        data_vencimento: dataVencimento,
        validade_tipo: validadeTipo,
        status_aptidao: aptidao,
        apto_cargo: aptidao === "apto",
        inapto_cargo: aptidao === "inapto",
        apto_restricao: aptidao === "apto_restricao",
        apto_nr35: nr35 === "apto",
        inapto_nr35: nr35 === "inapto",
        nr35_nao_aplica: nr35 === "na",
        observacoes,
        local_emissao: localEmissao,
        status: "emitido",
        ghe_id: (funcSel as any)?.ghe_id || null,
        riscos_snapshot: riscos.filter(r => r.descricao.trim()),
        exames_snapshot: exames.filter(e => e.nome_exame.trim()).map(e => ({ nome_exame: e.nome_exame })),
      };

      if (!asoId) {
        const { data: num } = await supabase.rpc("gerar_numero_aso", { _empresa_id: empresaSel });
        payload.numero_aso = num || `ASO-${Date.now()}`;
        const { data: u } = await supabase.auth.getUser();
        payload.created_by = u.user?.id || null;
        const { data, error } = await supabase.from("asos").insert(payload).select().single();
        if (error) throw error;
        asoId = data.id;
      } else {
        const { error } = await supabase.from("asos").update(payload).eq("id", asoId);
        if (error) throw error;
        await supabase.from("aso_riscos").delete().eq("aso_id", asoId);
        await supabase.from("aso_exames").delete().eq("aso_id", asoId);
      }

      if (riscos.length) {
        await supabase.from("aso_riscos").insert(riscos.filter(r => r.descricao.trim()).map((r) => ({ ...r, aso_id: asoId })));
      }
      if (exames.length) {
        await supabase.from("aso_exames").insert(exames.filter(e => e.nome_exame.trim()).map((e) => ({ ...e, aso_id: asoId })));
      }

      // verificação hash
      const hash = `${asoId!.slice(0, 8)}${Date.now().toString(36)}`;
      await supabase.from("aso_verificacao").upsert({ hash, aso_id: asoId! }, { onConflict: "hash" });

      toast.success(editingId ? "ASO atualizado" : "ASO emitido com sucesso");
      qc.invalidateQueries({ queryKey: ["asos-list"] });
      qc.invalidateQueries({ queryKey: ["aso-dashboard"] });

      if (gerarPdf && asoId) await gerarPdfAso(asoId);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg">{editingId ? "Editar ASO" : "Novo ASO"} — Etapa {step + 1}/{STEPS.length}: <span className="text-primary">{STEPS[step]}</span></CardTitle>
          <div className="flex gap-1 overflow-x-auto">
            {STEPS.map((s, i) => (
              <Badge key={s} variant={i === step ? "default" : i < step ? "secondary" : "outline"} className="cursor-pointer" onClick={() => setStep(i)}>{i + 1}</Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 0 && (
          <div className="space-y-3">
            <div>
              <Label>Empresa *</Label>
              <Select value={empresaSel} onValueChange={(v) => { setEmpresaSel(v); setFuncionarioId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>{empresas.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
              </Select>
              {empSel?.cnpj && <p className="text-xs text-muted-foreground mt-1">CNPJ: {empSel.cnpj}</p>}
            </div>
            <div>
              <Label>Funcionário *</Label>
              <Select value={funcionarioId} onValueChange={setFuncionarioId}>
                <SelectTrigger><SelectValue placeholder={empresaSel ? "Selecione…" : "Escolha a empresa primeiro"} /></SelectTrigger>
                <SelectContent>{funcionarios.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.nome} {f.cpf ? `— ${f.cpf}` : ""}</SelectItem>)}</SelectContent>
              </Select>
              {funcSel && (
                <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                  <div>Cargo: <strong>{funcSel.cargo || "—"}</strong></div>
                  <div>Setor: <strong>{funcSel.setor || "—"}</strong></div>
                  <div>Admissão: <strong>{funcSel.data_admissao || "—"}</strong></div>
                  {gheVinculado ? (
                    <div className="mt-1 p-2 rounded bg-primary/10 border border-primary/20">
                      <strong>GHE/GES:</strong> {gheVinculado.codigo} — {gheVinculado.nome}
                      {gheVinculado.setor && <span className="text-muted-foreground"> ({gheVinculado.setor})</span>}
                      <div className="text-[11px] text-muted-foreground mt-0.5">Riscos e exames serão preenchidos automaticamente conforme o PCMSO.</div>
                    </div>
                  ) : (
                    <div className="mt-1 p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive">
                      Colaborador sem GHE/GES vinculado. Vá em <strong>PCMSO / GHE</strong> ou no cadastro do colaborador para vincular.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <Label>Tipo de exame *</Label>
            <RadioGroup value={tipoExame} onValueChange={setTipoExame} className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
              {TIPO_EXAMES.map((t) => (
                <Label key={t.v} className="flex items-center gap-2 border rounded-md p-3 cursor-pointer hover:bg-accent">
                  <RadioGroupItem value={t.v} />{t.l}
                </Label>
              ))}
            </RadioGroup>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Adicione os fatores de risco aplicáveis à função do colaborador.</p>
            {GRUPOS_RISCO.map((g) => (
              <div key={g.k} className="border rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-sm">{g.l}</h4>
                  <Button size="sm" variant="outline" onClick={() => addRisco(g.k)}><Plus className="h-3 w-3 mr-1" />Adicionar</Button>
                </div>
                {riscos.filter(r => r.grupo === g.k).length === 0 && <p className="text-xs text-muted-foreground italic">N.A. (Não se aplica)</p>}
                {riscos.map((r, i) => r.grupo === g.k && (
                  <div key={i} className="flex gap-2">
                    <Input value={r.descricao} onChange={(e) => updRisco(i, e.target.value)} placeholder="Descrição do risco…" />
                    <Button size="icon" variant="ghost" onClick={() => rmRisco(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">Exames realizados</h4>
              <Button size="sm" onClick={addExame}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
            </div>
            {exames.length === 0 && <p className="text-sm text-muted-foreground">Nenhum exame ainda. Adicione os exames realizados.</p>}
            {exames.map((e, i) => (
              <div key={i} className="border rounded-lg p-3 grid grid-cols-12 gap-2">
                <div className="col-span-12 md:col-span-5">
                  <Label className="text-xs">Exame</Label>
                  <Select value={e.exame_id || ""} onValueChange={(v) => {
                    const cat: any = catalogo.find((c: any) => c.id === v);
                    updExame(i, { exame_id: v, nome_exame: cat?.nome || e.nome_exame });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Selecionar do catálogo…" /></SelectTrigger>
                    <SelectContent>{catalogo.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input className="mt-1" placeholder="ou digite o nome" value={e.nome_exame} onChange={(ev) => updExame(i, { nome_exame: ev.target.value })} />
                </div>
                <div className="col-span-6 md:col-span-2">
                  <Label className="text-xs">Data</Label>
                  <Input type="date" value={e.data_realizacao || ""} onChange={(ev) => updExame(i, { data_realizacao: ev.target.value })} />
                </div>
                <div className="col-span-6 md:col-span-4">
                  <Label className="text-xs">Resultado</Label>
                  <Input value={e.resultado || ""} onChange={(ev) => updExame(i, { resultado: ev.target.value })} placeholder="Normal, alterado…" />
                </div>
                <div className="col-span-12 md:col-span-1 flex items-end">
                  <Button size="icon" variant="ghost" onClick={() => rmExame(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div>
              <Label>Conclusão sobre capacidade laborativa *</Label>
              <RadioGroup value={aptidao} onValueChange={(v) => setAptidao(v as any)} className="space-y-2 mt-2">
                <Label className="flex items-center gap-2 border rounded p-3 cursor-pointer"><RadioGroupItem value="apto" />Apto para as atividades do cargo</Label>
                <Label className="flex items-center gap-2 border rounded p-3 cursor-pointer"><RadioGroupItem value="apto_restricao" />Apto com restrições</Label>
                <Label className="flex items-center gap-2 border rounded p-3 cursor-pointer"><RadioGroupItem value="inapto" />Inapto para as atividades do cargo</Label>
              </RadioGroup>
            </div>
            <div>
              <Label>NR-35 (Trabalho em Altura)</Label>
              <RadioGroup value={nr35} onValueChange={(v) => setNr35(v as any)} className="grid grid-cols-3 gap-2 mt-2">
                <Label className="flex items-center gap-2 border rounded p-2 cursor-pointer text-sm"><RadioGroupItem value="apto" />Apto NR-35</Label>
                <Label className="flex items-center gap-2 border rounded p-2 cursor-pointer text-sm"><RadioGroupItem value="inapto" />Inapto NR-35</Label>
                <Label className="flex items-center gap-2 border rounded p-2 cursor-pointer text-sm"><RadioGroupItem value="na" />Não se aplica</Label>
              </RadioGroup>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} />
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data de emissão *</Label>
              <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
            </div>
            <div>
              <Label>Validade *</Label>
              <Select value={validadeTipo} onValueChange={setValidadeTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="90d">90 dias</SelectItem>
                  <SelectItem value="6m">6 meses</SelectItem>
                  <SelectItem value="1ano">1 ano</SelectItem>
                  <SelectItem value="2anos">2 anos</SelectItem>
                  <SelectItem value="personalizada">Personalizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Data de vencimento</Label>
              <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} disabled={validadeTipo !== "personalizada"} />
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-3">
            <div>
              <Label>Médico responsável *</Label>
              <Select value={medicoId} onValueChange={setMedicoId}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>{medicos.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.nome} — CRM {m.crm}{m.uf_crm ? `/${m.uf_crm}` : ""}</SelectItem>)}</SelectContent>
              </Select>
              {medicos.length === 0 && <p className="text-xs text-destructive mt-1">Cadastre um médico na aba "Médicos" primeiro.</p>}
            </div>
            <div>
              <Label>Local de emissão</Label>
              <Input value={localEmissao} onChange={(e) => setLocalEmissao(e.target.value)} placeholder="Cidade/UF" />
            </div>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-2 text-sm">
            <h4 className="font-semibold">Resumo do ASO</h4>
            <div className="border rounded-lg p-3 space-y-1">
              <p><strong>Empresa:</strong> {empSel?.nome}</p>
              <p><strong>Funcionário:</strong> {funcSel?.nome} — {funcSel?.cpf}</p>
              <p><strong>Cargo / Setor:</strong> {funcSel?.cargo || "—"} / {funcSel?.setor || "—"}</p>
              <p><strong>Tipo:</strong> {TIPO_EXAMES.find(t => t.v === tipoExame)?.l}</p>
              <p><strong>Aptidão:</strong> {aptidao} {nr35 !== "na" && `(NR-35: ${nr35})`}</p>
              <p><strong>Emissão:</strong> {dataEmissao} — <strong>Vence:</strong> {dataVencimento}</p>
              <p><strong>Médico:</strong> {medicos.find((m: any) => m.id === medicoId)?.nome || "—"}</p>
              <p><strong>Riscos:</strong> {riscos.filter(r => r.descricao).length} / <strong>Exames:</strong> {exames.filter(e => e.nome_exame).length}</p>
            </div>
            <p className="text-xs text-muted-foreground italic">Em caso de transferência, mudança de função, alteração dos riscos ocupacionais ou mudança de risco, o ASO deverá ser reavaliado conforme PCMSO e PGR da organização.</p>
          </div>
        )}

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={prev} disabled={step === 0}><ChevronLeft className="h-4 w-4 mr-1" />Anterior</Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>Próximo <ChevronRight className="h-4 w-4 ml-1" /></Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => save(false)} disabled={saving}><Save className="h-4 w-4 mr-1" />Salvar</Button>
              <Button onClick={() => save(true)} disabled={saving}><FileDown className="h-4 w-4 mr-1" />Salvar e gerar PDF</Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
