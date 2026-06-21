import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const GRUPOS: { value: string; label: string }[] = [
  { value: "fisico", label: "Físico" },
  { value: "quimico", label: "Químico" },
  { value: "biologico", label: "Biológico" },
  { value: "ergonomico", label: "Ergonômico" },
  { value: "acidente", label: "Acidente / Mecânico" },
];

interface Props {
  open: boolean; onOpenChange: (b: boolean) => void;
  ltcatId: string; empresaId: string;
  gheId: string; agente?: any | null;
}

export default function LtcatAgenteDialog({ open, onOpenChange, ltcatId, empresaId, gheId, agente }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const editing = !!agente;

  const [catalogoId, setCatalogoId] = useState<string>(agente?.catalogo_id || "");
  const [form, setForm] = useState({
    codigo_esocial: agente?.codigo_esocial || "",
    nome: agente?.nome || "",
    grupo: agente?.grupo || "fisico",
    fonte_geradora: agente?.fonte_geradora || "",
    meio_propagacao: agente?.meio_propagacao || "",
    trajetoria: agente?.trajetoria || "",
    tipo_exposicao: agente?.tipo_exposicao || "",
    frequencia: agente?.frequencia || "",
    duracao: agente?.duracao || "",
    epi_descricao: agente?.epi_descricao || "",
    epi_ca: agente?.epi_ca || "",
    epi_eficacia: agente?.epi_eficacia || "",
    epc_descricao: agente?.epc_descricao || "",
    epc_eficacia: agente?.epc_eficacia || "",
    observacoes: agente?.observacoes || "",
  });
  const [saving, setSaving] = useState(false);

  const { data: catalogo = [] } = useQuery({
    queryKey: ["ltcat-cat-agentes", empresaId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ltcat_catalogo_agentes")
        .select("id, codigo_esocial, nome, grupo, unidade_medida, limite_tolerancia, base_normativa, empresa_id")
        .eq("ativo", true)
        .or(`empresa_id.is.null,empresa_id.eq.${empresaId}`)
        .order("codigo_esocial");
      return data || [];
    },
    enabled: open,
  });

  const pickCatalogo = (id: string) => {
    setCatalogoId(id);
    const c = (catalogo as any[]).find((x) => x.id === id);
    if (c) setForm({ ...form, codigo_esocial: c.codigo_esocial, nome: c.nome, grupo: c.grupo });
  };

  const save = async () => {
    if (!form.codigo_esocial.trim() || !form.nome.trim()) { toast.error("Código e nome são obrigatórios"); return; }
    setSaving(true);
    try {
      const payload: any = {
        ltcat_id: ltcatId, empresa_id: empresaId, grupo_homogeneo_id: gheId,
        catalogo_id: catalogoId || null,
        codigo_esocial: form.codigo_esocial.trim(),
        nome: form.nome.trim(),
        grupo: form.grupo,
        fonte_geradora: form.fonte_geradora.trim() || null,
        meio_propagacao: form.meio_propagacao.trim() || null,
        trajetoria: form.trajetoria.trim() || null,
        tipo_exposicao: form.tipo_exposicao.trim() || null,
        frequencia: form.frequencia.trim() || null,
        duracao: form.duracao.trim() || null,
        epi_descricao: form.epi_descricao.trim() || null,
        epi_ca: form.epi_ca.trim() || null,
        epi_eficacia: form.epi_eficacia || null,
        epc_descricao: form.epc_descricao.trim() || null,
        epc_eficacia: form.epc_eficacia || null,
        observacoes: form.observacoes.trim() || null,
      };
      if (editing) {
        const { error } = await (supabase.from as any)("ltcat_agentes").update(payload).eq("id", agente.id);
        if (error) throw error;
        toast.success("Agente atualizado");
      } else {
        const { error } = await (supabase.from as any)("ltcat_agentes").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
        toast.success("Agente adicionado");
      }
      qc.invalidateQueries({ queryKey: ["ltcat-aa", ltcatId] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Editar agente nocivo" : "Novo agente nocivo"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {!editing && (
            <div className="md:col-span-2">
              <Label className="text-xs">Catálogo previdenciário (S-2240 / Anexo IV)</Label>
              <Select value={catalogoId} onValueChange={pickCatalogo}>
                <SelectTrigger><SelectValue placeholder="Selecionar do catálogo (recomendado)" /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {(catalogo as any[]).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.codigo_esocial} · {c.nome}{c.empresa_id ? " (empresa)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">Código eSocial *</Label>
            <Input value={form.codigo_esocial} onChange={(e) => setForm({ ...form, codigo_esocial: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Nome do agente *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Grupo *</Label>
            <Select value={form.grupo} onValueChange={(v) => setForm({ ...form, grupo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GRUPOS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo de exposição</Label>
            <Input value={form.tipo_exposicao} onChange={(e) => setForm({ ...form, tipo_exposicao: e.target.value })}
              placeholder="Habitual e permanente / Intermitente / Eventual" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Fonte geradora</Label>
            <Textarea rows={2} value={form.fonte_geradora} onChange={(e) => setForm({ ...form, fonte_geradora: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Meio de propagação</Label>
            <Input value={form.meio_propagacao} onChange={(e) => setForm({ ...form, meio_propagacao: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Trajetória</Label>
            <Input value={form.trajetoria} onChange={(e) => setForm({ ...form, trajetoria: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Frequência</Label>
            <Input value={form.frequencia} onChange={(e) => setForm({ ...form, frequencia: e.target.value })} placeholder="Diária / Semanal / etc." />
          </div>
          <div>
            <Label className="text-xs">Duração</Label>
            <Input value={form.duracao} onChange={(e) => setForm({ ...form, duracao: e.target.value })} placeholder="Ex.: 8h/dia, 4h/turno" />
          </div>
          <div className="md:col-span-2 border-t pt-2 text-xs font-semibold text-muted-foreground">EPI / EPC existentes</div>
          <div className="md:col-span-2">
            <Label className="text-xs">EPI — descrição</Label>
            <Textarea rows={2} value={form.epi_descricao} onChange={(e) => setForm({ ...form, epi_descricao: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">EPI — CA</Label>
            <Input value={form.epi_ca} onChange={(e) => setForm({ ...form, epi_ca: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">EPI — eficácia informada</Label>
            <Select value={form.epi_eficacia || "__none__"} onValueChange={(v) => setForm({ ...form, epi_eficacia: v === "__none__" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                <SelectItem value="sim">Sim</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">EPC — descrição</Label>
            <Textarea rows={2} value={form.epc_descricao} onChange={(e) => setForm({ ...form, epc_descricao: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">EPC — eficácia informada</Label>
            <Select value={form.epc_eficacia || "__none__"} onValueChange={(v) => setForm({ ...form, epc_eficacia: v === "__none__" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                <SelectItem value="sim">Sim</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
          <div className="md:col-span-2 text-xs text-muted-foreground italic">
            ⚠️ A informação de eficácia do EPI/EPC <strong>não neutraliza</strong> automaticamente a exposição.
            A neutralização exige justificativa técnica documentada na avaliação.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
