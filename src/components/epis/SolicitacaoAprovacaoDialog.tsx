import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  solicitacaoId: string | null;
  onDone: () => void;
}

export default function SolicitacaoAprovacaoDialog({ open, onOpenChange, solicitacaoId, onDone }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [itens, setItens] = useState<any[]>([]);
  const [motivoRecusa, setMotivoRecusa] = useState("");

  useEffect(() => {
    if (!open || !solicitacaoId) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase.from("solicitacoes_materiais_itens").select("*").eq("solicitacao_id", solicitacaoId).order("ordem");
      setItens(((data as any[]) || []).map((i) => ({ ...i, quantidade_aprovada: i.quantidade_aprovada ?? i.quantidade_solicitada })));
      setMotivoRecusa("");
      setLoading(false);
    })();
  }, [open, solicitacaoId]);

  async function aprovar() {
    if (!solicitacaoId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("solicitacoes_materiais").update({
        status: "aprovada",
        aprovado_por: user?.id || null,
        aprovado_por_nome: user?.email?.split("@")[0] || null,
        aprovado_em: new Date().toISOString(),
      }).eq("id", solicitacaoId);
      if (error) throw error;
      for (const it of itens) {
        await supabase.from("solicitacoes_materiais_itens").update({
          quantidade_aprovada: Number(it.quantidade_aprovada || 0),
        }).eq("id", it.id);
      }
      toast.success("Solicitação aprovada");
      onDone();
    } catch (e: any) {
      toast.error("Erro ao aprovar", { description: e.message });
    } finally { setSaving(false); }
  }

  async function recusar() {
    if (!solicitacaoId) return;
    if (!motivoRecusa.trim()) { toast.error("Informe o motivo da recusa"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("solicitacoes_materiais").update({
        status: "recusada",
        motivo_recusa: motivoRecusa,
        aprovado_por: user?.id || null,
        aprovado_por_nome: user?.email?.split("@")[0] || null,
        aprovado_em: new Date().toISOString(),
      }).eq("id", solicitacaoId);
      if (error) throw error;
      toast.success("Solicitação recusada");
      onDone();
    } catch (e: any) {
      toast.error("Erro", { description: e.message });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Aprovar / Recusar Solicitação</DialogTitle></DialogHeader>
        {loading ? (
          <div className="p-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="text-sm text-muted-foreground">Ajuste as quantidades aprovadas por item, se necessário.</div>
            <div className="space-y-2">
              {itens.map((it, idx) => (
                <div key={it.id} className="border rounded p-2 grid grid-cols-1 sm:grid-cols-6 gap-2 items-end">
                  <div className="sm:col-span-3">
                    <div className="text-xs text-muted-foreground">#{idx + 1} — {it.tipo_item}</div>
                    <div className="font-medium text-sm">{it.nome_item}</div>
                    {it.ca && <div className="text-xs text-muted-foreground">CA {it.ca}</div>}
                  </div>
                  <div>
                    <Label className="text-xs">Solicitada</Label>
                    <Input value={it.quantidade_solicitada} readOnly disabled />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs">Aprovada</Label>
                    <Input type="number" min={0} value={it.quantidade_aprovada}
                      onChange={(e) => setItens((prev) => prev.map((x, i) => i === idx ? { ...x, quantidade_aprovada: Number(e.target.value) } : x))} />
                  </div>
                </div>
              ))}
            </div>
            <div>
              <Label className="text-xs">Motivo (obrigatório apenas para recusar)</Label>
              <Textarea rows={2} value={motivoRecusa} onChange={(e) => setMotivoRecusa(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button variant="destructive" onClick={recusar} disabled={saving} className="gap-1"><XCircle className="w-4 h-4" /> Recusar</Button>
          <Button onClick={aprovar} disabled={saving} className="gap-1"><CheckCircle2 className="w-4 h-4" /> Aprovar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
