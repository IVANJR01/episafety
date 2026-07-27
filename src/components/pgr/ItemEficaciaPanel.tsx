import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  acaoId: string | null;
  canEdit: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_verificacao: "Em verificação",
  eficaz: "Eficaz",
  parcialmente_eficaz: "Parcialmente eficaz",
  ineficaz: "Ineficaz",
};

const STATUS_COR: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-800 border-amber-300",
  em_verificacao: "bg-blue-100 text-blue-800 border-blue-300",
  eficaz: "bg-emerald-100 text-emerald-800 border-emerald-300",
  parcialmente_eficaz: "bg-orange-100 text-orange-800 border-orange-300",
  ineficaz: "bg-red-100 text-red-800 border-red-300",
};

/** Status que fecham a verificação e, por isso, exigem método e resultado. */
const CONCLUSIVOS = ["eficaz", "parcialmente_eficaz", "ineficaz"];

export default function ItemEficaciaPanel({ acaoId, canEdit }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(null);

  const { data: registro, isLoading } = useQuery({
    queryKey: ["pgr-eficacia", acaoId],
    enabled: !!acaoId,
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_acao_eficacia")
        .select("*").eq("acao_id", acaoId).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!registro) { setForm(null); return; }
    setForm({
      status: registro.status,
      data_prevista: registro.data_prevista || "",
      data_verificacao: registro.data_verificacao || "",
      responsavel_nome: registro.responsavel_nome || "",
      metodo_afericao: registro.metodo_afericao || "",
      resultado: registro.resultado || "",
      evidencia_url: registro.evidencia_url || "",
      necessita_ajuste: registro.necessita_ajuste ?? false,
      ajuste_descricao: registro.ajuste_descricao || "",
      risco_residual_confirmado: registro.risco_residual_confirmado ?? false,
      observacao: registro.observacao || "",
    });
  }, [registro]);

  const salvar = useMutation({
    mutationFn: async () => {
      // Espelha o CHECK do banco, para a mensagem chegar em português antes do
      // round-trip em vez de um erro cru de constraint.
      if (CONCLUSIVOS.includes(form.status)) {
        if (!form.data_verificacao) throw new Error("Informe a data da verificação.");
        if (!form.metodo_afericao.trim()) throw new Error("Informe como a eficácia foi aferida.");
        if (!form.resultado.trim()) throw new Error("Informe o resultado da aferição.");
      }
      const { error } = await (supabase.from as any)("pgr_acao_eficacia").update({
        status: form.status,
        data_prevista: form.data_prevista || null,
        data_verificacao: form.data_verificacao || null,
        responsavel_nome: form.responsavel_nome.trim() || null,
        metodo_afericao: form.metodo_afericao.trim() || null,
        resultado: form.resultado.trim() || null,
        evidencia_url: form.evidencia_url.trim() || null,
        necessita_ajuste: form.necessita_ajuste,
        ajuste_descricao: form.ajuste_descricao.trim() || null,
        risco_residual_confirmado: form.risco_residual_confirmado,
        observacao: form.observacao.trim() || null,
      }).eq("id", registro.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Verificação de eficácia atualizada");
      qc.invalidateQueries({ queryKey: ["pgr-eficacia", acaoId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!acaoId) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Salve a ação primeiro.</p>;
  }
  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…
      </p>
    );
  }
  if (!registro || !form) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center space-y-1">
        <p>A verificação de eficácia é aberta automaticamente quando a ação é concluída.</p>
        <p className="text-xs">Esta ação ainda não foi concluída.</p>
      </div>
    );
  }

  const conclusivo = CONCLUSIVOS.includes(form.status);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 text-xs border rounded p-2 bg-blue-50 text-blue-900">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Concluir a ação não encerra o risco. O risco residual só é confirmado depois de
          aferir se a medida realmente funcionou (NR-01 1.5.4.4.6).
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className={STATUS_COR[registro.status]}>
          {STATUS_LABEL[registro.status]}
        </Badge>
        {registro.data_prevista && (
          <span className="text-xs text-muted-foreground">
            Prevista para {registro.data_prevista.split("-").reverse().join("/")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Resultado da verificação</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}
            disabled={!canEdit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">
            Data da verificação {conclusivo && <span className="text-red-500">*</span>}
          </Label>
          <Input type="date" value={form.data_verificacao} disabled={!canEdit}
            onChange={(e) => setForm({ ...form, data_verificacao: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Responsável pela verificação</Label>
          <Input value={form.responsavel_nome} disabled={!canEdit}
            onChange={(e) => setForm({ ...form, responsavel_nome: e.target.value })} />
        </div>
      </div>

      <div>
        <Label className="text-xs">
          Como foi aferida {conclusivo && <span className="text-red-500">*</span>}
        </Label>
        <Textarea rows={2} value={form.metodo_afericao} disabled={!canEdit}
          onChange={(e) => setForm({ ...form, metodo_afericao: e.target.value })}
          placeholder="Nova medição, inspeção, indicador acompanhado, entrevista…" />
      </div>

      <div>
        <Label className="text-xs">
          Resultado da aferição {conclusivo && <span className="text-red-500">*</span>}
        </Label>
        <Textarea rows={2} value={form.resultado} disabled={!canEdit}
          onChange={(e) => setForm({ ...form, resultado: e.target.value })}
          placeholder="O que foi constatado" />
      </div>

      <div className="space-y-2 border rounded-md p-3">
        <div className="flex items-start gap-2">
          <Checkbox id="ajuste" checked={form.necessita_ajuste} disabled={!canEdit}
            onCheckedChange={(c) => setForm({ ...form, necessita_ajuste: !!c })} />
          <Label htmlFor="ajuste" className="text-xs font-medium">Necessita ajuste</Label>
        </div>
        {form.necessita_ajuste && (
          <Textarea rows={2} value={form.ajuste_descricao} disabled={!canEdit}
            onChange={(e) => setForm({ ...form, ajuste_descricao: e.target.value })}
            placeholder="Qual ajuste é necessário?" />
        )}
        <div className="flex items-start gap-2">
          <Checkbox id="residual" checked={form.risco_residual_confirmado} disabled={!canEdit}
            onCheckedChange={(c) => setForm({ ...form, risco_residual_confirmado: !!c })} />
          <div>
            <Label htmlFor="residual" className="text-xs font-medium">
              Risco residual confirmado no inventário
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Marque após reavaliar o risco no inventário com os controles já implantados.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Link da evidência</Label>
          <Input value={form.evidencia_url} disabled={!canEdit}
            onChange={(e) => setForm({ ...form, evidencia_url: e.target.value })}
            placeholder="https://…" />
        </div>
        <div>
          <Label className="text-xs">Observação</Label>
          <Input value={form.observacao} disabled={!canEdit}
            onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Salvar verificação
          </Button>
        </div>
      )}
    </div>
  );
}
