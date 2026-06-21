import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ShieldAlert, Info } from "lucide-react";
import { toast } from "sonner";
import { useMfaStatus } from "@/hooks/useMfaStatus";
import {
  LtcatConclusao, LtcatConclusaoAposentadoria, LtcatEnquadramento, LtcatAgenteConsiderado,
  LTCAT_CONCLUSAO_LABEL, LTCAT_ENQUADRAMENTO_LABEL,
} from "@/lib/ltcatTypes";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  ltcatId: string;
  empresaId: string;
  editing: LtcatConclusao | null;
  defaultGheId?: string;
}

export default function LtcatConclusaoDialog({ open, onOpenChange, ltcatId, empresaId, editing, defaultGheId }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const mfa = useMfaStatus();

  const [gheId, setGheId] = useState<string>("");
  const [funcaoId, setFuncaoId] = useState<string>("");
  const [conclusao, setConclusao] = useState<LtcatConclusaoAposentadoria>("nao_especial");
  const [enquadramento, setEnquadramento] = useState<LtcatEnquadramento>("nao_aplicavel");
  const [tipoExposicao, setTipoExposicao] = useState("");
  const [fundamento, setFundamento] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [epi, setEpi] = useState("");
  const [epc, setEpc] = useState("");
  const [obs, setObs] = useState("");
  const [selecionados, setSelecionados] = useState<Record<string, { aval_id?: string; conclusao_agente?: string; obs?: string }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setGheId(editing.grupo_homogeneo_id);
      setFuncaoId(editing.funcao_id || "");
      setConclusao(editing.conclusao);
      setEnquadramento((editing.enquadramento as any) || "nao_aplicavel");
      setTipoExposicao(editing.tipo_exposicao || "");
      setFundamento(editing.fundamento_legal || "");
      setJustificativa(editing.justificativa || "");
      setEpi(editing.epi_considerados || "");
      setEpc(editing.epc_considerados || "");
      setObs(editing.observacoes || "");
      const sel: any = {};
      (editing.agentes_considerados || []).forEach((a) => {
        sel[a.agente_id] = { aval_id: a.aval_id || undefined, conclusao_agente: a.conclusao_agente || "", obs: a.observacoes || "" };
      });
      setSelecionados(sel);
    } else {
      setGheId(defaultGheId || "");
      setFuncaoId("");
      setConclusao("nao_especial");
      setEnquadramento("nao_aplicavel");
      setTipoExposicao(""); setFundamento(""); setJustificativa("");
      setEpi(""); setEpc(""); setObs("");
      setSelecionados({});
    }
  }, [open, editing, defaultGheId]);

  const { data: ghes = [] } = useQuery({
    queryKey: ["ltcat-ghes-min", ltcatId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ltcat_grupos_homogeneos")
        .select("id, codigo, nome").eq("ltcat_id", ltcatId).order("codigo");
      return data || [];
    },
    enabled: open,
  });

  const { data: funcoes = [] } = useQuery({
    queryKey: ["ltcat-funcoes-by-ghe", ltcatId, gheId],
    queryFn: async () => {
      if (!gheId) return [];
      const { data } = await (supabase.from as any)("ltcat_funcoes")
        .select("id, nome_funcao, cbo").eq("ltcat_id", ltcatId).eq("grupo_homogeneo_id", gheId).order("nome_funcao");
      return data || [];
    },
    enabled: open && !!gheId,
  });

  const { data: agentes = [] } = useQuery({
    queryKey: ["ltcat-agentes-by-ghe", ltcatId, gheId],
    queryFn: async () => {
      if (!gheId) return [];
      const { data } = await (supabase.from as any)("ltcat_agentes")
        .select("*").eq("ltcat_id", ltcatId).eq("grupo_homogeneo_id", gheId).order("nome");
      return data || [];
    },
    enabled: open && !!gheId,
  });

  const { data: avals = [] } = useQuery({
    queryKey: ["ltcat-avals-by-ghe", ltcatId, gheId],
    queryFn: async () => {
      if (!gheId) return [];
      const { data } = await (supabase.from as any)("ltcat_avaliacoes")
        .select("*").eq("ltcat_id", ltcatId).eq("grupo_homogeneo_id", gheId).order("data_medicao", { ascending: false });
      return data || [];
    },
    enabled: open && !!gheId,
  });

  const buildConsiderados = (): LtcatAgenteConsiderado[] => {
    return (agentes as any[])
      .filter((ag) => !!selecionados[ag.id])
      .map((ag) => {
        const sel = selecionados[ag.id];
        const av = (avals as any[]).find((x) => x.id === sel.aval_id) ||
          (avals as any[]).find((x) => x.agente_id === ag.id);
        const intensidade = av?.intensidade ?? null;
        const limite = av?.limite_tolerancia ?? null;
        const acima = intensidade != null && limite != null && Number(intensidade) > Number(limite);
        return {
          agente_id: ag.id,
          agente_nome: ag.nome,
          grupo: ag.grupo,
          aval_id: av?.id || null,
          intensidade: intensidade != null ? Number(intensidade) : null,
          unidade_medida: av?.unidade_medida || null,
          limite_tolerancia: limite != null ? Number(limite) : null,
          tecnica: av?.tecnica || null,
          data_medicao: av?.data_medicao || null,
          acima_limite: !!acima,
          conclusao_agente: sel.conclusao_agente || null,
          observacoes: sel.obs || null,
        };
      });
  };

  const considerados = useMemo(buildConsiderados, [selecionados, agentes, avals]);
  const algumAcima = considerados.some((c) => c.acima_limite);
  const especial = conclusao.startsWith("especial_");
  const needsMfa = especial && mfa.required && mfa.enforced && !mfa.hasMfa;

  const save = async () => {
    if (!gheId) return toast.error("Selecione GHE/GES");
    if (considerados.length === 0) return toast.error("Inclua ao menos um agente considerado");
    if (especial && fundamento.trim().length < 10) return toast.error("Fundamento legal obrigatório (mín. 10 caracteres) para aposentadoria especial");
    if (conclusao === "inconclusivo" && justificativa.trim().length < 10) return toast.error("Justificativa obrigatória (mín. 10) para conclusão inconclusiva");
    if (conclusao === "nao_especial" && algumAcima && justificativa.trim().length < 30) {
      return toast.error("Conclusão 'não especial' com agente acima do limite exige justificativa técnica robusta (mín. 30 caracteres)");
    }
    if (especial && needsMfa) {
      return toast.error("MFA obrigatório para registrar conclusão de aposentadoria especial");
    }

    setSaving(true);
    try {
      const payload: any = {
        ltcat_id: ltcatId,
        empresa_id: empresaId,
        grupo_homogeneo_id: gheId,
        funcao_id: funcaoId || null,
        conclusao,
        enquadramento,
        tipo_exposicao: tipoExposicao.trim() || null,
        fundamento_legal: fundamento.trim() || null,
        justificativa: justificativa.trim() || null,
        epi_considerados: epi.trim() || null,
        epc_considerados: epc.trim() || null,
        observacoes: obs.trim() || null,
        agentes_considerados: considerados,
      };
      if (editing) {
        const { error } = await (supabase.from as any)("ltcat_conclusoes").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Conclusão atualizada");
      } else {
        payload.created_by = user?.id || null;
        const { error } = await (supabase.from as any)("ltcat_conclusoes").insert(payload);
        if (error) throw error;
        toast.success("Conclusão registrada");
      }
      qc.invalidateQueries({ queryKey: ["ltcat-conclusoes", ltcatId] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar conclusão previdenciária" : "Nova conclusão previdenciária"}</DialogTitle>
          <DialogDescription>
            Análise técnica por GHE × Função. Não constitui promessa de concessão de benefício pelo INSS.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">GHE/GES *</Label>
              <Select value={gheId} onValueChange={setGheId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(ghes as any[]).map((g) => <SelectItem key={g.id} value={g.id}>{g.codigo} — {g.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Função (opcional)</Label>
              <Select value={funcaoId || "__none"} onValueChange={(v) => setFuncaoId(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Sem função (conclusão por GHE)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Sem função (conclusão genérica) —</SelectItem>
                  {(funcoes as any[]).map((f) => <SelectItem key={f.id} value={f.id}>{f.nome_funcao}{f.cbo ? ` · ${f.cbo}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {gheId && !funcaoId && (
            <Alert className="bg-amber-50 border-amber-300">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Conclusão sem função vinculada é considerada <strong>genérica</strong> — recomenda-se análise por função para PPP/S-2240.
              </AlertDescription>
            </Alert>
          )}

          <div>
            <Label className="text-xs">Agentes considerados *</Label>
            {(agentes as any[]).length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nenhum agente cadastrado para este GHE.</p>
            ) : (
              <div className="border rounded-md max-h-72 overflow-y-auto divide-y">
                {(agentes as any[]).map((ag) => {
                  const isSel = !!selecionados[ag.id];
                  const agAvals = (avals as any[]).filter((a) => a.agente_id === ag.id);
                  const selAvalId = selecionados[ag.id]?.aval_id || agAvals[0]?.id;
                  const av = agAvals.find((x) => x.id === selAvalId);
                  const acima = av && av.intensidade != null && av.limite_tolerancia != null
                    && Number(av.intensidade) > Number(av.limite_tolerancia);
                  return (
                    <div key={ag.id} className="p-2 space-y-1">
                      <div className="flex items-start gap-2">
                        <Checkbox checked={isSel}
                          onCheckedChange={(c) => {
                            const next = { ...selecionados };
                            if (c) next[ag.id] = { aval_id: agAvals[0]?.id };
                            else delete next[ag.id];
                            setSelecionados(next);
                          }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium flex flex-wrap items-center gap-2">
                            {ag.nome}
                            <Badge variant="outline" className="text-xs">{ag.grupo}</Badge>
                            {acima && <Badge variant="outline" className="text-xs bg-rose-100 text-rose-800 border-rose-300"><AlertTriangle className="h-3 w-3 mr-1" />Acima do LT</Badge>}
                          </div>
                          {isSel && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-1">
                              <Select value={selecionados[ag.id]?.aval_id || ""}
                                onValueChange={(v) => setSelecionados({ ...selecionados, [ag.id]: { ...selecionados[ag.id], aval_id: v } })}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Avaliação" /></SelectTrigger>
                                <SelectContent>
                                  {agAvals.length === 0 ? (
                                    <SelectItem value="__none" disabled>Sem avaliações</SelectItem>
                                  ) : agAvals.map((a) => (
                                    <SelectItem key={a.id} value={a.id}>
                                      {a.tecnica} · {a.intensidade ?? "—"} {a.unidade_medida || ""} {a.data_medicao ? `· ${a.data_medicao}` : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input className="h-8 text-xs" placeholder="Conclusão deste agente"
                                value={selecionados[ag.id]?.conclusao_agente || ""}
                                onChange={(e) => setSelecionados({ ...selecionados, [ag.id]: { ...selecionados[ag.id], conclusao_agente: e.target.value } })} />
                              <Input className="h-8 text-xs" placeholder="Observação"
                                value={selecionados[ag.id]?.obs || ""}
                                onChange={(e) => setSelecionados({ ...selecionados, [ag.id]: { ...selecionados[ag.id], obs: e.target.value } })} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {algumAcima && conclusao === "nao_especial" && (
            <Alert className="bg-rose-50 border-rose-300">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Há agente <strong>acima do limite</strong>. Sugere-se análise de enquadramento especial. Se mantida "não especial", justificativa robusta é obrigatória.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Enquadramento previdenciário *</Label>
              <Select value={conclusao} onValueChange={(v) => setConclusao(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(LTCAT_CONCLUSAO_LABEL) as LtcatConclusaoAposentadoria[]).map((k) =>
                    <SelectItem key={k} value={k}>{LTCAT_CONCLUSAO_LABEL[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Habitualidade/Permanência</Label>
              <Select value={enquadramento} onValueChange={(v) => setEnquadramento(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(LTCAT_ENQUADRAMENTO_LABEL) as LtcatEnquadramento[]).map((k) =>
                    <SelectItem key={k} value={k}>{LTCAT_ENQUADRAMENTO_LABEL[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Tipo de exposição</Label>
              <Input value={tipoExposicao} onChange={(e) => setTipoExposicao(e.target.value)}
                placeholder="Ex.: contínua, direta, indireta…" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Fundamento legal {especial && <span className="text-rose-600">*</span>}</Label>
              <Textarea rows={2} value={fundamento} onChange={(e) => setFundamento(e.target.value)}
                placeholder="Ex.: Anexo IV Dec. 3.048/99 — cód. 2.0.1; NR-15 Anexo X…" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">
                Justificativa técnica
                {(conclusao === "inconclusivo" || (conclusao === "nao_especial" && algumAcima)) && <span className="text-rose-600"> *</span>}
              </Label>
              <Textarea rows={3} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">EPI considerados</Label>
              <Textarea rows={2} value={epi} onChange={(e) => setEpi(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">EPC considerados</Label>
              <Textarea rows={2} value={epc} onChange={(e) => setEpc(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Observações</Label>
              <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
          </div>

          <Alert className="bg-blue-50 border-blue-300">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              EPI/EPC não neutraliza automaticamente a exposição. A avaliação técnica deve considerar eficácia comprovada, registro de uso e demais critérios da legislação previdenciária.
            </AlertDescription>
          </Alert>

          {needsMfa && (
            <Alert className="bg-rose-50 border-rose-300">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Conclusão de aposentadoria especial exige MFA configurado. Configure em sua conta antes de salvar.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar conclusão"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
