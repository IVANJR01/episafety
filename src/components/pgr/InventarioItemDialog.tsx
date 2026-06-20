import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import MatrizRisco from "./MatrizRisco";
import {
  classificarRisco, nivelRisco, necessitaAcao, CLASSE_TEXT, CLASSE_LABEL,
  GRUPO_LABEL, EXPOSICAO_LABEL, AVALIACAO_LABEL, PgrClasse,
} from "@/lib/pgrMatriz";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  pgrId: string;
  empresaId: string;
  itemId?: string | null;
  onSaved: () => void;
}

const GRUPOS = ["fisico","quimico","biologico","ergonomico","acidente","psicossocial","outro"];
const EXPOSICOES = ["continua","intermitente","eventual","nao_aplicavel"];
const AVALIACOES = ["qualitativa","quantitativa"];

export default function InventarioItemDialog({ open, onOpenChange, pgrId, empresaId, itemId, onSaved }: Props) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<any>({
    ghe_id: "",
    grupo: "fisico",
    perigo_descricao: "",
    fonte_geradora: "",
    meio_propagacao: "",
    tipo_exposicao: "continua",
    avaliacao_tipo: "qualitativa",
    medicao_valor: "",
    medicao_unidade: "",
    limite_tolerancia: "",
    excedente: false,
    severidade: 3,
    probabilidade: 3,
    trabalhadores_expostos: 0,
    trabalhadores_calculados: 0,
    trabalhadores_ajuste_manual: false,
    controles_existentes: "",
    justificativa: "",
  });

  const { data: ghes = [] } = useQuery({
    queryKey: ["pgr-ghes", empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("ghe_ges").select("id, codigo, nome").eq("empresa_id", empresaId).eq("status", "ativo").order("codigo");
      return data || [];
    },
    enabled: open && !!empresaId,
  });

  useEffect(() => {
    if (!open) return;
    if (itemId) {
      (async () => {
        const { data } = await (supabase.from as any)("pgr_inventario_itens").select("*").eq("id", itemId).maybeSingle();
        if (data) setForm({
          ...data,
          controles_existentes: Array.isArray(data.controles_existentes) ? data.controles_existentes.join("\n") : "",
          medicao_valor: data.medicao_valor ?? "",
        });
      })();
    } else {
      setForm((f: any) => ({ ...f, ghe_id: "", perigo_descricao: "", fonte_geradora: "" }));
    }
  }, [open, itemId]);

  // Recalcula trabalhadores quando GHE muda (apenas modo automático)
  useEffect(() => {
    if (!form.ghe_id || form.trabalhadores_ajuste_manual) return;
    (async () => {
      const { data } = await (supabase as any).rpc("pgr_funcionarios_por_ghe", { _ghe_id: form.ghe_id });
      const n = Number(data) || 0;
      setForm((f: any) => ({ ...f, trabalhadores_calculados: n, trabalhadores_expostos: n }));
    })();
  }, [form.ghe_id, form.trabalhadores_ajuste_manual]);

  const classe: PgrClasse = classificarRisco(form.severidade, form.probabilidade);
  const nivel = nivelRisco(form.severidade, form.probabilidade);
  const needAcao = necessitaAcao(classe);

  const salvar = async () => {
    if (!form.perigo_descricao || form.perigo_descricao.length < 2) { toast.error("Descreva o perigo"); return; }
    if (form.trabalhadores_ajuste_manual && (!form.justificativa || form.justificativa.length < 5)) {
      toast.error("Justificativa obrigatória para ajuste manual de trabalhadores"); return;
    }
    setBusy(true);
    try {
      const payload: any = {
        pgr_id: pgrId,
        empresa_id: empresaId,
        ghe_id: form.ghe_id || null,
        grupo: form.grupo,
        perigo_descricao: form.perigo_descricao,
        fonte_geradora: form.fonte_geradora || null,
        meio_propagacao: form.meio_propagacao || null,
        tipo_exposicao: form.tipo_exposicao,
        avaliacao_tipo: form.avaliacao_tipo,
        medicao_valor: form.avaliacao_tipo === "quantitativa" && form.medicao_valor !== "" ? Number(form.medicao_valor) : null,
        medicao_unidade: form.avaliacao_tipo === "quantitativa" ? (form.medicao_unidade || null) : null,
        limite_tolerancia: form.avaliacao_tipo === "quantitativa" ? (form.limite_tolerancia || null) : null,
        excedente: form.avaliacao_tipo === "quantitativa" ? !!form.excedente : null,
        severidade: form.severidade,
        probabilidade: form.probabilidade,
        trabalhadores_expostos: Number(form.trabalhadores_expostos) || 0,
        trabalhadores_calculados: Number(form.trabalhadores_calculados) || 0,
        trabalhadores_ajuste_manual: !!form.trabalhadores_ajuste_manual,
        controles_existentes: form.controles_existentes
          ? form.controles_existentes.split("\n").map((s: string) => s.trim()).filter(Boolean)
          : null,
        justificativa: form.justificativa || null,
      };
      if (itemId) {
        const { error } = await (supabase.from as any)("pgr_inventario_itens").update(payload).eq("id", itemId);
        if (error) throw error;
        toast.success("Item atualizado");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{itemId ? "Editar item do inventário" : "Novo item do inventário"}</DialogTitle>
          <DialogDescription>Classificação calculada pela matriz 5×5 (igual à função SQL).</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">GHE/GES</Label>
            <Select value={form.ghe_id || ""} onValueChange={(v) => setForm({ ...form, ghe_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {ghes.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.codigo} — {g.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Grupo</Label>
            <Select value={form.grupo} onValueChange={(v) => setForm({ ...form, grupo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{GRUPOS.map(g => <SelectItem key={g} value={g}>{GRUPO_LABEL[g]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Perigo / fator de risco *</Label>
            <Input value={form.perigo_descricao} onChange={(e) => setForm({ ...form, perigo_descricao: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Fonte geradora</Label>
            <Input value={form.fonte_geradora || ""} onChange={(e) => setForm({ ...form, fonte_geradora: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Meio de propagação</Label>
            <Input value={form.meio_propagacao || ""} onChange={(e) => setForm({ ...form, meio_propagacao: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Tipo de exposição</Label>
            <Select value={form.tipo_exposicao} onValueChange={(v) => setForm({ ...form, tipo_exposicao: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EXPOSICOES.map(g => <SelectItem key={g} value={g}>{EXPOSICAO_LABEL[g]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Avaliação</Label>
            <Select value={form.avaliacao_tipo} onValueChange={(v) => setForm({ ...form, avaliacao_tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{AVALIACOES.map(g => <SelectItem key={g} value={g}>{AVALIACAO_LABEL[g]}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {form.avaliacao_tipo === "quantitativa" && (
            <>
              <div>
                <Label className="text-xs">Valor medido</Label>
                <Input type="number" step="any" value={form.medicao_valor} onChange={(e) => setForm({ ...form, medicao_valor: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Unidade</Label>
                <Input value={form.medicao_unidade || ""} onChange={(e) => setForm({ ...form, medicao_unidade: e.target.value })} placeholder="dB(A), ppm, mg/m³..." />
              </div>
              <div>
                <Label className="text-xs">Limite de tolerância (NR-15 / ACGIH)</Label>
                <Input value={form.limite_tolerancia || ""} onChange={(e) => setForm({ ...form, limite_tolerancia: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 mt-6">
                <Switch checked={!!form.excedente} onCheckedChange={(b) => setForm({ ...form, excedente: b })} />
                <Label className="text-sm">Excedeu o limite</Label>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[auto,1fr] gap-4 mt-4 border-t pt-4">
          <div>
            <Label className="text-xs mb-1 block">Matriz 5×5 — clique para selecionar</Label>
            <MatrizRisco
              severidade={form.severidade}
              probabilidade={form.probabilidade}
              onSelect={(s, p) => setForm({ ...form, severidade: s, probabilidade: p })}
            />
          </div>
          <div className="space-y-2">
            <div className="text-sm">Severidade: <b>{form.severidade}</b> · Probabilidade: <b>{form.probabilidade}</b></div>
            <div className="text-sm">Nível de risco (S×P): <b>{nivel}</b></div>
            <div>
              <Badge className={CLASSE_TEXT[classe]} variant="outline">Classificação: {CLASSE_LABEL[classe]}</Badge>
            </div>
            {needAcao && <div className="text-xs text-orange-700">⚠ Requer ação (Alto/Crítico) — será marcado automaticamente.</div>}
          </div>
        </div>

        <div className="border-t pt-4 mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Trabalhadores expostos (calculados via funcionarios.ghe_id)</Label>
            <Input value={form.trabalhadores_calculados} readOnly className="bg-muted" />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs">Trabalhadores expostos {form.trabalhadores_ajuste_manual ? "(ajustado)" : ""}</Label>
              <Input type="number" min={0} value={form.trabalhadores_expostos}
                disabled={!form.trabalhadores_ajuste_manual}
                onChange={(e) => setForm({ ...form, trabalhadores_expostos: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch checked={!!form.trabalhadores_ajuste_manual}
                onCheckedChange={(b) => setForm({ ...form, trabalhadores_ajuste_manual: b, trabalhadores_expostos: b ? form.trabalhadores_expostos : form.trabalhadores_calculados })} />
              <Label className="text-xs">Ajuste manual</Label>
            </div>
          </div>
          {form.trabalhadores_ajuste_manual && (
            <div className="md:col-span-2">
              <Label className="text-xs">Justificativa do ajuste manual *</Label>
              <Textarea rows={2} value={form.justificativa || ""} onChange={(e) => setForm({ ...form, justificativa: e.target.value })} placeholder="Ex.: 2 funcionários afastados no período da avaliação..." />
            </div>
          )}

          <div className="md:col-span-2">
            <Label className="text-xs">Controles existentes (um por linha)</Label>
            <Textarea rows={3} value={form.controles_existentes} onChange={(e) => setForm({ ...form, controles_existentes: e.target.value })} placeholder={"Protetor auricular tipo concha\nTreinamento NR-06 anual"} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={busy}>{itemId ? "Salvar alterações" : "Adicionar item"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
