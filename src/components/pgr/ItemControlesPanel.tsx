import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  apenasControlesInferiores, PGR_HIERARQUIA_LABEL, PGR_HIERARQUIA_ORDENADA,
  PgrHierarquiaControle, PgrRiscoControle,
} from "@/lib/pgrTypes";

interface Props {
  pgrId: string;
  empresaId: string;
  /** Nulo enquanto o item ainda não foi salvo — controles exigem o item persistido. */
  itemId: string | null;
  canEdit: boolean;
}

/** Medidas acima do EPI na hierarquia recebem destaque visual. */
const COR_HIERARQUIA: Record<PgrHierarquiaControle, string> = {
  eliminacao: "bg-emerald-100 text-emerald-800 border-emerald-300",
  substituicao: "bg-emerald-100 text-emerald-800 border-emerald-300",
  engenharia_epc: "bg-lime-100 text-lime-800 border-lime-300",
  administrativa: "bg-yellow-100 text-yellow-800 border-yellow-300",
  treinamento_procedimento: "bg-yellow-100 text-yellow-800 border-yellow-300",
  epi: "bg-orange-100 text-orange-800 border-orange-300",
  monitoramento_saude: "bg-sky-100 text-sky-800 border-sky-300",
  preparacao_emergencia: "bg-sky-100 text-sky-800 border-sky-300",
};

const vazio = {
  hierarquia: "engenharia_epc" as PgrHierarquiaControle,
  descricao: "",
  implementado: true,
  data_implantacao: "",
  eficacia: "nao_avaliada",
  observacao: "",
  epi_ca: "",
  epi_validade: "",
  epi_periodicidade_troca: "",
  epi_fator_protecao: "",
  epi_treinamento_realizado: false,
};

export default function ItemControlesPanel({ pgrId, empresaId, itemId, canEdit }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(vazio);
  const [adicionando, setAdicionando] = useState(false);

  const { data: controles = [], isLoading } = useQuery({
    queryKey: ["pgr-controles", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("pgr_risco_controles")
        .select("*").eq("inventario_item_id", itemId);
      if (error) throw error;
      return (data || []) as PgrRiscoControle[];
    },
  });

  // Mantém a ordem da hierarquia normativa, não a ordem de cadastro.
  const ordenados = [...controles].sort(
    (a, b) => PGR_HIERARQUIA_ORDENADA.indexOf(a.hierarquia) - PGR_HIERARQUIA_ORDENADA.indexOf(b.hierarquia));

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.descricao.trim()) throw new Error("Descreva a medida de controle.");
      const ehEpi = form.hierarquia === "epi";
      const { error } = await (supabase.from as any)("pgr_risco_controles").insert({
        pgr_id: pgrId,
        empresa_id: empresaId,
        inventario_item_id: itemId,
        hierarquia: form.hierarquia,
        descricao: form.descricao.trim(),
        implementado: form.implementado,
        data_implantacao: form.data_implantacao || null,
        eficacia: form.eficacia || null,
        observacao: form.observacao.trim() || null,
        epi_ca: ehEpi ? (form.epi_ca.trim() || null) : null,
        epi_validade: ehEpi ? (form.epi_validade || null) : null,
        epi_periodicidade_troca: ehEpi ? (form.epi_periodicidade_troca.trim() || null) : null,
        epi_fator_protecao: ehEpi ? (form.epi_fator_protecao.trim() || null) : null,
        epi_treinamento_realizado: ehEpi ? form.epi_treinamento_realizado : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Medida registrada");
      qc.invalidateQueries({ queryKey: ["pgr-controles", itemId] });
      setForm(vazio);
      setAdicionando(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("pgr_risco_controles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pgr-controles", itemId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!itemId) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Salve o item primeiro para registrar as medidas de controle.
      </p>
    );
  }

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando medidas…
      </p>
    );
  }

  const soInferiores = apenasControlesInferiores(controles);

  return (
    <div className="space-y-3">
      {soInferiores && (
        <div className="flex items-start gap-2 text-xs border rounded p-2 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Este risco só possui medidas administrativas, de treinamento ou EPI. A NR-01 exige
            avaliar antes eliminação, substituição e proteção coletiva — EPI não é controle
            suficiente por si só.
          </span>
        </div>
      )}

      <div className="space-y-2">
        {ordenados.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma medida de controle registrada.
          </p>
        )}
        {ordenados.map((c) => (
          <div key={c.id} className="border rounded-md p-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={`${COR_HIERARQUIA[c.hierarquia]} text-[11px]`}>
                  {PGR_HIERARQUIA_LABEL[c.hierarquia]}
                </Badge>
                {!c.implementado && (
                  <Badge variant="outline" className="text-[11px] bg-slate-100 text-slate-600">
                    Não implementada
                  </Badge>
                )}
                {c.eficacia && c.eficacia !== "nao_avaliada" && (
                  <span className="text-[11px] text-muted-foreground">Eficácia: {c.eficacia}</span>
                )}
              </div>
              <p className="text-sm mt-1">{c.descricao}</p>
              {c.hierarquia === "epi" && (c.epi_ca || c.epi_fator_protecao) && (
                <p className="text-[11px] text-muted-foreground">
                  {c.epi_ca && `CA ${c.epi_ca}`}
                  {c.epi_ca && c.epi_fator_protecao && " · "}
                  {c.epi_fator_protecao && `Atenuação ${c.epi_fator_protecao}`}
                  {c.epi_treinamento_realizado === false && " · sem treinamento registrado"}
                </p>
              )}
              {c.observacao && (
                <p className="text-[11px] text-muted-foreground italic">{c.observacao}</p>
              )}
            </div>
            {canEdit && (
              <Button variant="ghost" size="sm" onClick={() => excluir.mutate(c.id)}>
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {canEdit && !adicionando && (
        <Button variant="outline" size="sm" onClick={() => setAdicionando(true)}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar medida
        </Button>
      )}

      {canEdit && adicionando && (
        <div className="border rounded-md p-3 space-y-3 bg-muted/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Hierarquia da medida *</Label>
              <Select value={form.hierarquia}
                onValueChange={(v) => setForm({ ...form, hierarquia: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PGR_HIERARQUIA_ORDENADA.map((h) => (
                    <SelectItem key={h} value={h}>{PGR_HIERARQUIA_LABEL[h]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Eficácia</Label>
              <Select value={form.eficacia} onValueChange={(v) => setForm({ ...form, eficacia: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_avaliada">Não avaliada</SelectItem>
                  <SelectItem value="ineficaz">Ineficaz</SelectItem>
                  <SelectItem value="parcialmente_eficaz">Parcialmente eficaz</SelectItem>
                  <SelectItem value="eficaz">Eficaz</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Descrição da medida *</Label>
            <Input value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="Ex.: Enclausuramento acústico do compressor" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data de implantação</Label>
              <Input type="date" value={form.data_implantacao}
                onChange={(e) => setForm({ ...form, data_implantacao: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox id="implementado" checked={form.implementado}
                onCheckedChange={(c) => setForm({ ...form, implementado: !!c })} />
              <Label htmlFor="implementado" className="text-xs">Já implementada</Label>
            </div>
          </div>

          {form.hierarquia === "epi" && (
            <fieldset className="border rounded p-2 space-y-2">
              <legend className="px-1 text-[11px] font-semibold text-slate-600">Dados do EPI</legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <Label className="text-xs">CA</Label>
                  <Input value={form.epi_ca}
                    onChange={(e) => setForm({ ...form, epi_ca: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Validade</Label>
                  <Input type="date" value={form.epi_validade}
                    onChange={(e) => setForm({ ...form, epi_validade: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Troca</Label>
                  <Input value={form.epi_periodicidade_troca}
                    onChange={(e) => setForm({ ...form, epi_periodicidade_troca: e.target.value })}
                    placeholder="Ex.: 6 meses" />
                </div>
                <div>
                  <Label className="text-xs">Atenuação</Label>
                  <Input value={form.epi_fator_protecao}
                    onChange={(e) => setForm({ ...form, epi_fator_protecao: e.target.value })}
                    placeholder="NRRsf 17 dB" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="epitrein" checked={form.epi_treinamento_realizado}
                  onCheckedChange={(c) => setForm({ ...form, epi_treinamento_realizado: !!c })} />
                <Label htmlFor="epitrein" className="text-xs">Treinamento de uso realizado</Label>
              </div>
            </fieldset>
          )}

          <div>
            <Label className="text-xs">Observação</Label>
            <Input value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm"
              onClick={() => { setAdicionando(false); setForm(vazio); }}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Adicionar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
