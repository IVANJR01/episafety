import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Eye, FileDown, Printer, Search, LogOut, FileText, X, FilePlus2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { differenceInDays, parseISO, format, addYears, addDays } from "date-fns";
import { gerarPdfAso, gerarPdfAsoBlob } from "@/lib/asoPdf";
import { loadGheRiscosExames, GRUPOS_RISCO } from "@/lib/asoFromGhe";

const TIPO: Record<string, string> = {
  admissional: "Admissional", periodico: "Periódico", retorno: "Retorno ao Trabalho",
  mudanca_risco: "Mudança de Risco", mudanca_funcao: "Mudança de Função", demissional: "Demissional",
};

// Regra de validade automática por tipo de exame
// Demissional = 90 dias; demais = 1 ano
function calcularValidade(tipo: string, emissao: string): { vencimento: string; validade_tipo: string } {
  const base = parseISO(emissao);
  if (tipo === "demissional") {
    return { vencimento: format(addDays(base, 90), "yyyy-MM-dd"), validade_tipo: "90dias" };
  }
  return { vencimento: format(addYears(base, 1), "yyyy-MM-dd"), validade_tipo: "1ano" };
}

function statusValidade(dv?: string | null) {
  if (!dv) return { label: "—", cls: "bg-muted text-muted-foreground" };
  const d = differenceInDays(parseISO(dv), new Date());
  if (d < 0) return { label: "Vencido", cls: "bg-destructive/15 text-destructive" };
  if (d <= 30) return { label: "Vencendo", cls: "bg-orange-500/15 text-orange-600" };
  return { label: "Válido", cls: "bg-emerald-500/15 text-emerald-600" };
}

function maskCpf(cpf?: string | null) {
  if (!cpf) return "—";
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.***.***-${d.slice(9)}`;
}

function slugify(s: string) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "").trim().replace(/\s+/g, "-").toUpperCase();
}

async function logAcao(opts: { empresa_id: string; aso_id: string; funcionario_id?: string | null; usuario_id?: string | null; acao: string }) {
  try {
    await (supabase.from as any)("aso_download_logs").insert({
      empresa_id: opts.empresa_id, aso_id: opts.aso_id,
      funcionario_id: opts.funcionario_id ?? null, usuario_id: opts.usuario_id ?? null,
      perfil_usuario: "rh", acao: opts.acao, user_agent: navigator.userAgent.slice(0, 500),
    });
  } catch { /* silent */ }
}

export default function PortalRH() {
  const { user, signOut, empresaScopeIds, isSuperAdmin } = useAuth() as any;
  const qc = useQueryClient();
  const [tab, setTab] = useState<"emitir" | "historico">("emitir");

  // -------- EMITIR --------
  const [funcSearch, setFuncSearch] = useState("");
  const [funcionarioId, setFuncionarioId] = useState<string>("");
  const [tipoExame, setTipoExame] = useState<string>("admissional");
  const [medicoId, setMedicoId] = useState<string>("");
  const [dataEmissao, setDataEmissao] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dataVencimento, setDataVencimento] = useState(format(addYears(new Date(), 1), "yyyy-MM-dd"));
  const [validadeTipoSel, setValidadeTipoSel] = useState<string>("1ano");
  const [observacoes, setObservacoes] = useState("");
  const [localEmissao, setLocalEmissao] = useState("");
  const [riscos, setRiscos] = useState<{ grupo: string; descricao: string }[]>([]);
  const [exames, setExames] = useState<{ nome_exame: string }[]>([]);
  const [loadingGhe, setLoadingGhe] = useState(false);
  const [saving, setSaving] = useState(false);

  const validadeBloqueada = !isSuperAdmin; // RH: bloqueado; Admin/TST: pode alterar

  // Recalcula validade automaticamente ao mudar tipo de exame ou emissão
  useEffect(() => {
    if (!dataEmissao) return;
    const { vencimento, validade_tipo } = calcularValidade(tipoExame, dataEmissao);
    setDataVencimento(vencimento);
    setValidadeTipoSel(validade_tipo);
  }, [tipoExame, dataEmissao]);

  // Funcionários da empresa
  const { data: funcionarios = [] } = useQuery({
    queryKey: ["rh-funcionarios-ghe", empresaScopeIds.join(",")],
    queryFn: async () => {
      let q = supabase.from("funcionarios")
        .select("id, nome, cpf, cargo, setor, matricula, data_admissao, empresa_id, ghe_id, ghe_ges!inner(id, codigo, nome, setor), empresa_config:empresa_id(id, nome, cnpj)")
        .not("ghe_id", "is", null)
        .is("data_demissao", null)
        .order("nome");
      if (empresaScopeIds.length > 0) q = q.in("empresa_id", empresaScopeIds);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: medicos = [] } = useQuery({
    queryKey: ["rh-medicos"],
    queryFn: async () => (await supabase.from("aso_medicos").select("id, nome, crm, uf_crm").eq("ativo", true).order("nome")).data || [],
  });

  const funcSel: any = useMemo(() => funcionarios.find((f: any) => f.id === funcionarioId), [funcionarios, funcionarioId]);
  const filteredFuncs = useMemo(() => {
    if (!funcSearch) return funcionarios.slice(0, 50);
    const q = funcSearch.toLowerCase();
    const digits = funcSearch.replace(/\D/g, "");
    return funcionarios.filter((f: any) =>
      f.nome?.toLowerCase().includes(q) ||
      (digits && f.cpf?.replace(/\D/g, "").includes(digits)) ||
      f.matricula?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [funcionarios, funcSearch]);

  // Carrega riscos/exames do GHE
  useEffect(() => {
    if (!funcSel?.ghe_id) { setRiscos([]); setExames([]); return; }
    setLoadingGhe(true);
    loadGheRiscosExames(funcSel.ghe_id, tipoExame)
      .then(({ riscos: r, exames: ex }) => {
        setRiscos(r);
        setExames(ex.map((e) => ({ nome_exame: e.nome_exame })));
      })
      .catch(() => { setRiscos([]); setExames([]); })
      .finally(() => setLoadingGhe(false));
  }, [funcSel?.ghe_id, tipoExame]);

  const gruposPreenchidos = useMemo(() => {
    const map: Record<string, number> = {};
    GRUPOS_RISCO.forEach((g) => { map[g.k] = riscos.filter((r) => r.grupo === g.k && r.descricao.trim()).length; });
    return map;
  }, [riscos]);

  const podeEmitir = !!funcSel && !!funcSel.ghe_id && !!dataEmissao && !!dataVencimento && !!localEmissao.trim();

  const resetForm = () => {
    setFuncionarioId(""); setFuncSearch(""); setTipoExame("admissional");
    setMedicoId(""); setObservacoes(""); setLocalEmissao("");
    setRiscos([]); setExames([]);
    setDataEmissao(format(new Date(), "yyyy-MM-dd"));
    setDataVencimento(format(addYears(new Date(), 1), "yyyy-MM-dd"));
    setValidadeTipoSel("1ano");
  };

  const emitirAso = async (alsoPrint = false): Promise<string | null> => {
    if (!funcSel) { toast.error("Selecione um colaborador"); return null; }
    if (!funcSel.ghe_id) { toast.error("Colaborador sem GHE/GES vinculado"); return null; }
    if (!localEmissao.trim()) { toast.error("Informe o local de emissão do ASO."); return null; }
    setSaving(true);
    try {
      const empresa_id = funcSel.empresa_id;
      const { data: num } = await supabase.rpc("gerar_numero_aso", { _empresa_id: empresa_id });
      const payload: any = {
        empresa_id, funcionario_id: funcSel.id, medico_id: medicoId || null,
        tipo_exame: tipoExame, data_emissao: dataEmissao, data_vencimento: dataVencimento,
        validade_tipo: validadeTipoSel, status_aptidao: "apto",
        apto_cargo: false, inapto_cargo: false, apto_restricao: false,
        apto_nr35: false, inapto_nr35: false, nr35_nao_aplica: false,
        observacoes, local_emissao: localEmissao, status: "emitido",
        ghe_id: funcSel.ghe_id,
        riscos_snapshot: riscos.filter((r) => r.descricao.trim()),
        exames_snapshot: exames.filter((e) => e.nome_exame.trim()),
        numero_aso: num || `ASO-${Date.now()}`,
        created_by: user?.id || null,
      };
      const { data: ins, error } = await supabase.from("asos").insert(payload).select().single();
      if (error) throw error;
      const asoId = ins.id;
      if (riscos.length) {
        await supabase.from("aso_riscos").insert(riscos.filter((r) => r.descricao.trim()).map((r) => ({ ...r, aso_id: asoId })));
      }
      if (exames.length) {
        await supabase.from("aso_exames").insert(exames.filter((e) => e.nome_exame.trim()).map((e) => ({
          nome_exame: e.nome_exame, realizado: true, data_realizacao: dataEmissao, aso_id: asoId,
        })));
      }
      const hash = `${asoId.slice(0, 8)}${Date.now().toString(36)}`;
      await supabase.from("aso_verificacao").upsert({ hash, aso_id: asoId }, { onConflict: "hash" });
      toast.success(`ASO ${payload.numero_aso} emitido`);
      await logAcao({ empresa_id, aso_id: asoId, funcionario_id: funcSel.id, usuario_id: user?.id, acao: "baixou_pdf" });
      qc.invalidateQueries({ queryKey: ["portal-rh-asos"] });
      if (alsoPrint) {
        const blob = await gerarPdfAsoBlob(asoId);
        const url = URL.createObjectURL(blob);
        const w = window.open(url);
        if (w) setTimeout(() => { try { w.print(); } catch {} }, 800);
      } else {
        await gerarPdfAso(asoId);
      }
      return asoId;
    } catch (e: any) {
      toast.error("Erro ao emitir ASO: " + (e.message || e));
      return null;
    } finally {
      setSaving(false);
    }
  };

  // -------- HISTÓRICO --------
  const [hFilter, setHFilter] = useState("");
  const [previewBlob, setPreviewBlob] = useState<{ url: string; nome: string; aso: any } | null>(null);

  const { data: asos = [], isLoading: hLoading } = useQuery({
    queryKey: ["portal-rh-asos", empresaScopeIds.join(",")],
    queryFn: async () => {
      let q = supabase.from("asos")
        .select(`*, funcionarios:funcionario_id (nome, cpf, cargo, setor, matricula), aso_medicos:medico_id (nome, crm, uf_crm), ghe_ges:ghe_id (codigo, nome)`)
        .neq("status", "cancelado").order("created_at", { ascending: false });
      if (empresaScopeIds.length > 0) q = q.in("empresa_id", empresaScopeIds);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const hRows = useMemo(() => {
    if (!hFilter) return asos;
    const f = hFilter.toLowerCase(); const digits = hFilter.replace(/\D/g, "");
    return asos.filter((a: any) =>
      a.funcionarios?.nome?.toLowerCase().includes(f) ||
      (digits && a.funcionarios?.cpf?.replace(/\D/g, "").includes(digits)) ||
      a.numero_aso?.toLowerCase().includes(f)
    );
  }, [asos, hFilter]);

  const buildFilename = (a: any) => {
    const nome = slugify(a.funcionarios?.nome || "FUNCIONARIO");
    const t = (TIPO[a.tipo_exame] || a.tipo_exame).toUpperCase().replace(/\s+/g, "-");
    const d = a.data_emissao ? format(parseISO(a.data_emissao), "dd-MM-yyyy") : format(new Date(), "dd-MM-yyyy");
    return `ASO_${nome}_${t}_${d}.pdf`;
  };

  const baixar = async (a: any) => {
    try {
      const blob = await gerarPdfAsoBlob(a.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = buildFilename(a);
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      await logAcao({ empresa_id: a.empresa_id, aso_id: a.id, funcionario_id: a.funcionario_id, usuario_id: user?.id, acao: "baixou_pdf" });
    } catch (e: any) { toast.error("Erro: " + e.message); }
  };
  const visualizar = async (a: any) => {
    try {
      const blob = await gerarPdfAsoBlob(a.id);
      const url = URL.createObjectURL(blob);
      setPreviewBlob({ url, nome: buildFilename(a), aso: a });
      await logAcao({ empresa_id: a.empresa_id, aso_id: a.id, funcionario_id: a.funcionario_id, usuario_id: user?.id, acao: "visualizou_aso" });
    } catch (e: any) { toast.error("Erro: " + e.message); }
  };
  const imprimir = async (a: any) => {
    try {
      const blob = await gerarPdfAsoBlob(a.id);
      const url = URL.createObjectURL(blob);
      const w = window.open(url);
      if (w) setTimeout(() => { try { w.print(); } catch {} }, 800);
      await logAcao({ empresa_id: a.empresa_id, aso_id: a.id, funcionario_id: a.funcionario_id, usuario_id: user?.id, acao: "imprimiu_aso" });
    } catch (e: any) { toast.error("Erro: " + e.message); }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <div className="leading-tight">
              <h1 className="font-bold text-base md:text-lg">Portal RH — ASO</h1>
              <p className="text-xs text-muted-foreground hidden md:block">
                Selecione o colaborador, escolha o tipo de exame e gere o ASO em PDF com base no PCMSO/GHE.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={signOut} className="gap-1"><LogOut className="h-4 w-4" />Sair</Button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto p-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-2 w-full md:w-[400px]">
            <TabsTrigger value="emitir"><FilePlus2 className="h-4 w-4 mr-1" />Emitir ASO</TabsTrigger>
            <TabsTrigger value="historico"><FileText className="h-4 w-4 mr-1" />Histórico</TabsTrigger>
          </TabsList>

          {/* ============ EMITIR ============ */}
          <TabsContent value="emitir" className="space-y-4 mt-4">
            {funcionarios.length === 0 && (
              <Card><CardContent className="p-6 text-center text-sm space-y-2">
                <AlertTriangle className="h-6 w-6 mx-auto text-orange-500" />
                <p className="font-medium">Nenhum colaborador vinculado ao GHE/GES.</p>
                <p className="text-muted-foreground">
                  Vincule colaboradores na <b>Gestão de ASO → PCMSO / GHE</b> antes de emitir o ASO.<br />
                  <span className="text-xs">RH: solicite ao setor de Segurança do Trabalho a vinculação do colaborador ao GHE/GES.</span>
                </p>
              </CardContent></Card>
            )}

            {funcionarios.length > 0 && (
              <div className="grid lg:grid-cols-2 gap-4">
                {/* Coluna 1: Seleção */}
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <Label>Buscar colaborador</Label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input className="pl-8" value={funcSearch} onChange={(e) => setFuncSearch(e.target.value)}
                          placeholder="Nome, CPF ou matrícula…" />
                      </div>
                    </div>
                    <div>
                      <Label>Colaborador *</Label>
                      <Select value={funcionarioId} onValueChange={setFuncionarioId}>
                        <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                        <SelectContent>
                          {filteredFuncs.map((f: any) => (
                            <SelectItem key={f.id} value={f.id}>{f.nome}{f.cpf ? ` — ${f.cpf}` : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!funcionarioId && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Selecione um colaborador para gerar o ASO com base no GHE/GES vinculado.
                        </p>
                      )}
                    </div>

                    {funcSel && (
                      <div className="rounded-lg border p-3 text-sm space-y-1 bg-muted/30">
                        <div><b>Empresa:</b> {funcSel.empresa_config?.nome || "—"}</div>
                        <div><b>CNPJ:</b> {funcSel.empresa_config?.cnpj || "—"}</div>
                        <div><b>CPF:</b> {maskCpf(funcSel.cpf)}</div>
                        <div><b>Matrícula:</b> {funcSel.matricula || "—"}</div>
                        <div><b>Função:</b> {funcSel.cargo || "—"}</div>
                        <div><b>Setor:</b> {funcSel.setor || "—"}</div>
                        <div><b>Admissão:</b> {funcSel.data_admissao || "—"}</div>
                        {funcSel.ghe_ges ? (
                          <div className="mt-1 p-2 rounded bg-primary/10 border border-primary/20">
                            <b>GHE/GES:</b> {funcSel.ghe_ges.codigo} — {funcSel.ghe_ges.nome}
                            {funcSel.ghe_ges.setor && <span className="text-muted-foreground"> ({funcSel.ghe_ges.setor})</span>}
                          </div>
                        ) : (
                          <div className="mt-1 p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive flex gap-2 items-start">
                            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                            <div>
                              Este colaborador ainda não possui GHE/GES vinculado.<br />
                              <span className="text-xs">Solicite ao setor de Segurança do Trabalho a vinculação do colaborador ao GHE/GES.</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <Label>Tipo de exame *</Label>
                      <Select value={tipoExame} onValueChange={setTipoExame}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(TIPO).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Data de emissão *</Label>
                        <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
                      </div>
                      <div>
                        <Label>Validade *</Label>
                        <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <Label>Médico responsável <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                      <Select value={medicoId} onValueChange={setMedicoId}>
                        <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                        <SelectContent>
                          {medicos.map((m: any) => (
                            <SelectItem key={m.id} value={m.id}>{m.nome} — CRM {m.crm}{m.uf_crm ? "/" + m.uf_crm : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Local de emissão</Label>
                      <Input value={localEmissao} onChange={(e) => setLocalEmissao(e.target.value)} placeholder="Cidade — UF" />
                    </div>
                    <div>
                      <Label>Observações</Label>
                      <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} />
                    </div>
                  </CardContent>
                </Card>

                {/* Coluna 2: Prévia do PCMSO/GHE */}
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Prévia do ASO (dados do GHE)</h3>
                      {loadingGhe && <span className="text-xs text-muted-foreground">Carregando…</span>}
                    </div>

                    {!funcSel && (
                      <p className="text-sm text-muted-foreground italic">Selecione um colaborador para visualizar os riscos e exames do GHE.</p>
                    )}

                    {funcSel && !funcSel.ghe_id && (
                      <p className="text-sm text-destructive">Sem GHE vinculado — não é possível gerar o ASO.</p>
                    )}

                    {funcSel?.ghe_id && (
                      <>
                        <div>
                          <h4 className="text-sm font-medium mb-1">Fatores de risco</h4>
                          <div className="space-y-1 text-sm">
                            {GRUPOS_RISCO.map((g) => {
                              const items = riscos.filter((r) => r.grupo === g.k && r.descricao.trim());
                              return (
                                <div key={g.k} className="flex gap-2">
                                  <span className="font-medium w-32 shrink-0">{g.l}:</span>
                                  <span className={items.length ? "" : "text-muted-foreground italic"}>
                                    {items.length ? items.map((i) => i.descricao).join("; ") : "N.A."}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          {Object.values(gruposPreenchidos).every((v) => v === 0) && (
                            <div className="mt-2 p-2 rounded bg-orange-500/10 border border-orange-500/30 text-orange-700 text-xs flex gap-2">
                              <AlertTriangle className="h-4 w-4 shrink-0" />
                              O GHE/GES deste colaborador ainda não possui riscos cadastrados. Cadastre os riscos do PCMSO antes de gerar o ASO.
                            </div>
                          )}
                        </div>

                        <div>
                          <h4 className="text-sm font-medium mb-1">Exames previstos para {TIPO[tipoExame]}</h4>
                          {exames.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">Nenhum exame configurado para este tipo no GHE.</p>
                          ) : (
                            <ul className="text-sm list-disc pl-5">
                              {exames.map((e, i) => <li key={i}>{e.nome_exame}</li>)}
                            </ul>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground border-t pt-2">
                          Tipo: <b>{TIPO[tipoExame]}</b> · Emissão {dataEmissao && format(parseISO(dataEmissao), "dd/MM/yyyy")} · Validade {dataVencimento && format(parseISO(dataVencimento), "dd/MM/yyyy")}
                        </div>
                      </>
                    )}

                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <Button onClick={() => emitirAso(false)} disabled={!podeEmitir || saving} className="bg-emerald-600 hover:bg-emerald-700">
                        <FileDown className="h-4 w-4 mr-1" />{saving ? "Gerando…" : "Gerar PDF"}
                      </Button>
                      <Button onClick={() => emitirAso(true)} disabled={!podeEmitir || saving} variant="outline">
                        <Printer className="h-4 w-4 mr-1" />Gerar e Imprimir
                      </Button>
                      <Button onClick={resetForm} variant="ghost">Limpar</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* ============ HISTÓRICO ============ */}
          <TabsContent value="historico" className="space-y-3 mt-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="relative max-w-md">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-8" value={hFilter} onChange={(e) => setHFilter(e.target.value)}
                    placeholder="Buscar por nome, CPF ou nº do ASO…" />
                </div>

                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº ASO</TableHead>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead>GHE/GES</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Emissão</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hLoading && <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>}
                      {!hLoading && hRows.length === 0 && (
                        <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                          Nenhum ASO emitido ainda. Use a aba <b>Emitir ASO</b> para gerar.
                        </TableCell></TableRow>
                      )}
                      {hRows.map((a: any) => {
                        const sv = statusValidade(a.data_vencimento);
                        return (
                          <TableRow key={a.id}>
                            <TableCell className="font-mono text-xs">{a.numero_aso}</TableCell>
                            <TableCell className="font-medium">{a.funcionarios?.nome || "—"}</TableCell>
                            <TableCell className="font-mono text-xs">{maskCpf(a.funcionarios?.cpf)}</TableCell>
                            <TableCell className="text-sm">{a.funcionarios?.cargo || "—"}</TableCell>
                            <TableCell className="text-xs">{a.ghe_ges ? `${a.ghe_ges.codigo} — ${a.ghe_ges.nome}` : "—"}</TableCell>
                            <TableCell>{TIPO[a.tipo_exame] || a.tipo_exame}</TableCell>
                            <TableCell className="text-sm">{a.data_emissao ? format(parseISO(a.data_emissao), "dd/MM/yyyy") : "—"}</TableCell>
                            <TableCell className="text-sm">{a.data_vencimento ? format(parseISO(a.data_vencimento), "dd/MM/yyyy") : "—"}</TableCell>
                            <TableCell><Badge className={sv.cls + " border-0"}>{sv.label}</Badge></TableCell>
                            <TableCell className="text-right space-x-1 whitespace-nowrap">
                              <Button size="icon" variant="ghost" onClick={() => visualizar(a)} title="Visualizar"><Eye className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => baixar(a)} title="Baixar PDF" className="text-emerald-600"><FileDown className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => imprimir(a)} title="Imprimir"><Printer className="h-4 w-4" /></Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Preview Modal */}
      {previewBlob && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => { URL.revokeObjectURL(previewBlob.url); setPreviewBlob(null); }}>
          <div className="bg-card rounded-lg w-full max-w-4xl h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-3 border-b">
              <div className="font-medium truncate">{previewBlob.nome}</div>
              <div className="flex gap-2">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => baixar(previewBlob.aso)}><FileDown className="h-4 w-4 mr-1" />Baixar</Button>
                <Button size="sm" variant="outline" onClick={() => imprimir(previewBlob.aso)}><Printer className="h-4 w-4 mr-1" />Imprimir</Button>
                <Button size="icon" variant="ghost" onClick={() => { URL.revokeObjectURL(previewBlob.url); setPreviewBlob(null); }}><X className="h-4 w-4" /></Button>
              </div>
            </div>
            <iframe src={previewBlob.url} className="flex-1 w-full" title="Prévia ASO" />
          </div>
        </div>
      )}
    </div>
  );
}
