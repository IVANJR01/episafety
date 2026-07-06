import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import MatrizRisco from "./MatrizRisco";
import { GRUPO_LABEL } from "@/lib/pgrMatriz";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  pgrId: string;
  empresaId: string;
  itemId?: string | null;
  groupItemIds?: string[];
  onSaved: () => void;
}

const GRUPOS = ["fisico", "quimico", "biologico", "ergonomico", "acidente", "psicossocial", "outro"];
const NA = "N.A";

// Classificação por faixas do usuário (Total = Prob × Sev, 1..25)
function classifPorTotal(total: number): { label: string; className: string } {
  if (total <= 3) return { label: "Trivial", className: "bg-slate-100 text-slate-700 border-slate-300" };
  if (total <= 8) return { label: "Tolerável", className: "bg-green-100 text-green-800 border-green-300" };
  if (total <= 12) return { label: "Moderado", className: "bg-yellow-100 text-yellow-800 border-yellow-300" };
  if (total <= 15) return { label: "Substancial", className: "bg-orange-100 text-orange-800 border-orange-300" };
  return { label: "Intolerável", className: "bg-red-100 text-red-800 border-red-300" };
}

const clean = (v: any) => {
  const s = (v ?? "").toString().trim();
  if (!s) return "";
  const up = s.toUpperCase();
  return up === "N.A" || up === "N/A" ? "" : s;
};
const toSave = (v: any) => {
  const c = clean(v);
  return c === "" ? NA : c;
};

export default function InventarioItemDialog({ open, onOpenChange, pgrId, empresaId, itemId, groupItemIds = [], onSaved }: Props) {
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("estrutura");
  const [form, setForm] = useState<any>({
    ghe_id: "",
    descricao_ambiente: "",
    setor: "",
    processo: "",
    funcoes_text: "",
    grupo: "fisico",
    tipo_agente: "",
    perigo_descricao: "",
    fonte_geradora: "",
    lesoes: "",
    limite_tolerancia: "",
    intensidade: "",
    tempo_exposicao: "",
    tecnica_utilizada: "",
    controles_text: "",
    epi: "",
    atenuacao: "",
    severidade: 3,
    probabilidade: 3,
  });

  const { data: ghes = [] } = useQuery({
    queryKey: ["pgr-ghes", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ghe_ges")
        .select("id, codigo, nome, descricao_ambiente, ambiente, setor, processo")
        .eq("empresa_id", empresaId).eq("status", "ativo").order("codigo");
      return data || [];
    },
    enabled: open && !!empresaId,
  });

  useEffect(() => {
    if (!open) return;
    setTab("estrutura");
    if (itemId) {
      (async () => {
        const { data } = await (supabase.from as any)("pgr_inventario_itens")
          .select("*, ghe:ghe_id(descricao_ambiente, ambiente, setor, processo)")
          .eq("id", itemId).maybeSingle();
        if (data) {
          setForm({
            ghe_id: data.ghe_id || "",
            descricao_ambiente: clean(data.descricao_ambiente) || clean(data.ghe?.descricao_ambiente) || clean(data.ghe?.ambiente) || "",
            setor: clean(data.setor) || clean(data.ghe?.setor) || "",
            processo: clean(data.processo) || clean(data.ghe?.processo) || "",
            funcoes_text: Array.isArray(data.funcoes_snapshot) ? data.funcoes_snapshot.join("\n") : "",
            grupo: data.grupo || "fisico",
            tipo_agente: clean(data.tipo_agente),
            perigo_descricao: clean(data.perigo_descricao),
            fonte_geradora: clean(data.fonte_geradora),
            lesoes: clean(data.lesoes),
            limite_tolerancia: clean(data.limite_tolerancia),
            intensidade: clean(data.intensidade) || (data.medicao_valor != null ? `${data.medicao_valor}${data.medicao_unidade ? " " + data.medicao_unidade : ""}` : ""),
            tempo_exposicao: clean(data.tempo_exposicao) || clean(data.tipo_exposicao),
            tecnica_utilizada: clean(data.tecnica_utilizada),
            controles_text: Array.isArray(data.controles_existentes) ? data.controles_existentes.join("\n") : "",
            epi: clean(data.epi),
            atenuacao: clean(data.atenuacao),
            severidade: data.severidade ?? 3,
            probabilidade: data.probabilidade ?? 3,
          });
        }
      })();
    } else {
      setForm((f: any) => ({ ...f, ghe_id: "", perigo_descricao: "", fonte_geradora: "" }));
    }
  }, [open, itemId]);

  // Preencher automaticamente ambiente/setor/processo ao escolher GES (apenas para novo item)
  useEffect(() => {
    if (!form.ghe_id || itemId) return;
    const g = ghes.find((x: any) => x.id === form.ghe_id);
    if (!g) return;
    setForm((f: any) => ({
      ...f,
      descricao_ambiente: f.descricao_ambiente || clean(g.descricao_ambiente) || clean(g.ambiente) || "",
      setor: f.setor || clean(g.setor) || "",
      processo: f.processo || clean(g.processo) || "",
    }));
  }, [form.ghe_id, ghes, itemId]);

  const total = Number(form.severidade) * Number(form.probabilidade);
  const classif = classifPorTotal(total);

  const salvar = async () => {
    if (!form.perigo_descricao || form.perigo_descricao.trim().length < 2) {
      toast.error("Preencha Perigo / Fonte Exposição"); setTab("risco"); return;
    }
    setBusy(true);
    try {
      const funcoesArr = form.funcoes_text
        .split(/\n|,/).map((s: string) => s.trim()).filter(Boolean);
      const controlesArr = form.controles_text
        .split("\n").map((s: string) => s.trim()).filter(Boolean);

      const payload: any = {
        pgr_id: pgrId,
        empresa_id: empresaId,
        ghe_id: form.ghe_id || null,
        descricao_ambiente: toSave(form.descricao_ambiente),
        setor: toSave(form.setor),
        processo: toSave(form.processo),
        funcoes_snapshot: funcoesArr.length ? funcoesArr : null,
        grupo: form.grupo,
        tipo_agente: toSave(form.tipo_agente),
        perigo_descricao: form.perigo_descricao.trim(),
        fonte_geradora: toSave(form.fonte_geradora),
        lesoes: toSave(form.lesoes),
        limite_tolerancia: toSave(form.limite_tolerancia),
        intensidade: toSave(form.intensidade),
        tempo_exposicao: toSave(form.tempo_exposicao),
        tecnica_utilizada: toSave(form.tecnica_utilizada),
        controles_existentes: controlesArr.length ? controlesArr : null,
        epi: toSave(form.epi),
        atenuacao: toSave(form.atenuacao),
        severidade: Number(form.severidade),
        probabilidade: Number(form.probabilidade),
      };

      if (itemId) {
        const idsToUpdate = groupItemIds && groupItemIds.length > 1 ? groupItemIds : [itemId];
        if (idsToUpdate.length > 1) {
          // Atualiza somente campos compartilhados do grupo de risco.
          // Preserva por-linha: ghe_id, descricao_ambiente, setor, processo, funcoes_snapshot.
          const { ghe_id, descricao_ambiente, setor, processo, funcoes_snapshot, ...shared } = payload;
          const { error } = await (supabase.from as any)("pgr_inventario_itens").update(shared).in("id", idsToUpdate);
          if (error) throw error;
          toast.success(`Grupo atualizado (${idsToUpdate.length} setores)`);
        } else {
          const { error } = await (supabase.from as any)("pgr_inventario_itens").update(payload).eq("id", itemId);
          if (error) throw error;
          toast.success("Item atualizado");
        }
      } else {
        const { error } = await (supabase.from as any)("pgr_inventario_itens").insert(payload);
        if (error) throw error;
        toast.success("Item adicionado");
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar");
    } finally { setBusy(false); }
  };

  const upd = (k: string) => (e: any) => setForm({ ...form, [k]: e?.target ? e.target.value : e });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden
          w-screen h-[100dvh] max-w-none rounded-none translate-x-0 translate-y-0 left-0 top-0
          sm:w-[90vw] sm:h-auto sm:max-w-[1150px] sm:max-h-[90vh] sm:rounded-lg sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]
          flex flex-col"
      >
        <DialogHeader className="px-4 sm:px-6 pt-4 pb-3 border-b shrink-0">
          <DialogTitle className="text-base sm:text-lg">{itemId ? "Editar item do inventário" : "Novo item do inventário"}</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">Campos alinhados à planilha do Inventário de Riscos. Vazios são salvos como N.A.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="px-4 sm:px-6 pt-3 border-b shrink-0 overflow-x-auto">
            <TabsList className="inline-flex sm:grid sm:grid-cols-4 sm:w-full min-w-max sm:min-w-0">
              <TabsTrigger value="estrutura" className="whitespace-nowrap">1. Estrutura</TabsTrigger>
              <TabsTrigger value="risco" className="whitespace-nowrap">2. Risco</TabsTrigger>
              <TabsTrigger value="exposicao" className="whitespace-nowrap">3. Exposição e Medidas</TabsTrigger>
              <TabsTrigger value="classif" className="whitespace-nowrap">4. Classificação</TabsTrigger>
            </TabsList>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 min-h-0">

          {/* Aba 1 — Estrutura */}
          <TabsContent value="estrutura" className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label className="text-xs">Descrição do ambiente</Label>
                <Input value={form.descricao_ambiente} onChange={upd("descricao_ambiente")} placeholder="Ex.: Escritório administrativo" />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">GES</Label>
                <Select value={form.ghe_id || ""} onValueChange={(v) => setForm({ ...form, ghe_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {ghes.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.codigo} — {g.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 text-xs text-muted-foreground border rounded p-2 bg-muted/40">
                Setor, funções expostas e processo são definidos na Estrutura do GES.
              </div>
            </div>
          </TabsContent>



          {/* Aba 2 — Risco */}
          <TabsContent value="risco" className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Agente</Label>
                <Select value={form.grupo} onValueChange={(v) => setForm({ ...form, grupo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GRUPOS.map(g => <SelectItem key={g} value={g}>{GRUPO_LABEL[g]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tipo de Agente</Label>
                <Input value={form.tipo_agente} onChange={upd("tipo_agente")} placeholder="Ex.: Ruído, Poeira, Postura inadequada" />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Perigo / Fonte Exposição *</Label>
                <Textarea rows={2} value={form.perigo_descricao} onChange={upd("perigo_descricao")} />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Possíveis Lesões ou Agravos à Saúde</Label>
                <Textarea rows={2} value={form.lesoes} onChange={upd("lesoes")} placeholder="Ex.: LER/DORT, fadiga visual" />
              </div>
            </div>
          </TabsContent>

          {/* Aba 3 — Exposição e Medidas */}
          <TabsContent value="exposicao" className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Limite de Exposição</Label>
                <Input value={form.limite_tolerancia} onChange={upd("limite_tolerancia")} placeholder="Ex.: 85 dB(A) — NR-15" />
              </div>
              <div>
                <Label className="text-xs">Intensidade / Concentração</Label>
                <Input value={form.intensidade} onChange={upd("intensidade")} placeholder="Ex.: 78 dB(A)" />
              </div>
              <div>
                <Label className="text-xs">Tipo / Tempo de Exposição</Label>
                <Input value={form.tempo_exposicao} onChange={upd("tempo_exposicao")} placeholder="Ex.: Habitual e permanente / 8h" />
              </div>
              <div>
                <Label className="text-xs">Técnica Utilizada</Label>
                <Input value={form.tecnica_utilizada} onChange={upd("tecnica_utilizada")} placeholder="Ex.: Qualitativa / Dosimetria" />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Procedimento Administrativo / EPC / Organização do Trabalho <span className="text-muted-foreground">(um por linha)</span></Label>
                <Textarea rows={3} value={form.controles_text} onChange={upd("controles_text")}
                  placeholder={"Pausas programadas\nRodízio de tarefas\nBarreira acústica"} />
              </div>
              <div>
                <Label className="text-xs">EPI</Label>
                <Input value={form.epi} onChange={upd("epi")} placeholder="Ex.: Protetor auricular tipo concha CA 12345" />
              </div>
              <div>
                <Label className="text-xs">Atenuação / Fator de Proteção</Label>
                <Input value={form.atenuacao} onChange={upd("atenuacao")} placeholder="Ex.: NRRsf 17 dB" />
              </div>
            </div>
          </TabsContent>

          {/* Aba 4 — Classificação */}
          <TabsContent value="classif" className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-[auto,1fr] gap-4">
              <div>
                <Label className="text-xs mb-1 block">Matriz 5×5 — clique para selecionar</Label>
                <MatrizRisco
                  severidade={form.severidade}
                  probabilidade={form.probabilidade}
                  onSelect={(s, p) => setForm({ ...form, severidade: s, probabilidade: p })}
                />
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Probabilidade</Label>
                    <Input readOnly value={form.probabilidade} className="bg-muted text-center font-semibold" />
                  </div>
                  <div>
                    <Label className="text-xs">Severidade</Label>
                    <Input readOnly value={form.severidade} className="bg-muted text-center font-semibold" />
                  </div>
                  <div>
                    <Label className="text-xs">Total (P × S)</Label>
                    <Input readOnly value={total} className="bg-muted text-center font-bold text-lg" />
                  </div>
                  <div>
                    <Label className="text-xs">Classificação do Risco</Label>
                    <div className="mt-1">
                      <Badge variant="outline" className={`${classif.className} text-sm px-3 py-1`}>{classif.label}</Badge>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground border rounded p-2 bg-muted/40">
                  <b>Faixas:</b> 1–3 Trivial · 4–8 Tolerável · 9–12 Moderado · 13–15 Substancial · 16–25 Intolerável
                </div>
              </div>
            </div>
          </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="px-4 sm:px-6 py-3 border-t shrink-0 bg-background flex-col-reverse sm:flex-row gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto min-h-11">Cancelar</Button>
          <Button onClick={salvar} disabled={busy} className="w-full sm:w-auto min-h-11">{itemId ? "Salvar alterações" : "Adicionar item"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
