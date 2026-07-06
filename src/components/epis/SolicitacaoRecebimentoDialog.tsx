import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, PackageCheck } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  solicitacaoId: string | null;
  onDone: () => void;
}

export default function SolicitacaoRecebimentoDialog({ open, onOpenChange, solicitacaoId, onDone }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [itens, setItens] = useState<any[]>([]);
  const [dataRec, setDataRec] = useState(new Date().toISOString().slice(0, 10));
  const [nf, setNf] = useState("");
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (!open || !solicitacaoId) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase.from("solicitacoes_materiais_itens").select("*").eq("solicitacao_id", solicitacaoId).order("ordem");
      setItens(((data as any[]) || []).map((i) => ({
        ...i,
        quantidade_recebida: i.quantidade_recebida ?? i.quantidade_aprovada ?? i.quantidade_solicitada,
        quantidade_comprada: i.quantidade_comprada ?? i.quantidade_aprovada ?? i.quantidade_solicitada,
      })));
      setDataRec(new Date().toISOString().slice(0, 10));
      setNf(""); setObs("");
      setLoading(false);
    })();
  }, [open, solicitacaoId]);

  async function registrar() {
    if (!solicitacaoId) return;
    setSaving(true);
    try {
      let allComplete = true;
      for (const it of itens) {
        const rec = Number(it.quantidade_recebida || 0);
        const comp = Number(it.quantidade_comprada || 0);
        const alvo = Number(it.quantidade_aprovada ?? it.quantidade_solicitada ?? 0);
        if (rec < alvo) allComplete = false;
        await supabase.from("solicitacoes_materiais_itens").update({
          quantidade_recebida: rec,
          quantidade_comprada: comp || null,
        }).eq("id", it.id);
      }
      const novoStatus = allComplete ? "recebida" : "recebida_parcial";
      const { error } = await supabase.from("solicitacoes_materiais").update({
        status: novoStatus,
        recebida_em: new Date(dataRec + "T12:00:00").toISOString(),
        recebida_por_nome: user?.email?.split("@")[0] || null,
        nota_fiscal: nf || null,
        observacoes: obs || undefined,
      }).eq("id", solicitacaoId);
      if (error) throw error;
      toast.success(novoStatus === "recebida" ? "Recebimento total registrado" : "Recebimento parcial registrado");
      onDone();
    } catch (e: any) {
      toast.error("Erro ao registrar", { description: e.message });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Registrar Recebimento</DialogTitle></DialogHeader>
        {loading ? (
          <div className="p-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Data do recebimento</Label>
                <Input type="date" value={dataRec} onChange={(e) => setDataRec(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Nota Fiscal (opcional)</Label>
                <Input value={nf} onChange={(e) => setNf(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              {itens.map((it, idx) => (
                <div key={it.id} className="border rounded p-2 grid grid-cols-1 sm:grid-cols-8 gap-2 items-end">
                  <div className="sm:col-span-3">
                    <div className="text-xs text-muted-foreground">#{idx + 1} — {it.tipo_item}</div>
                    <div className="font-medium text-sm">{it.nome_item}</div>
                  </div>
                  <div>
                    <Label className="text-[10px]">Solic.</Label>
                    <Input value={it.quantidade_solicitada} readOnly disabled />
                  </div>
                  <div>
                    <Label className="text-[10px]">Aprov.</Label>
                    <Input value={it.quantidade_aprovada ?? "-"} readOnly disabled />
                  </div>
                  <div>
                    <Label className="text-[10px]">Comprada</Label>
                    <Input type="number" min={0} value={it.quantidade_comprada}
                      onChange={(e) => setItens((prev) => prev.map((x, i) => i === idx ? { ...x, quantidade_comprada: Number(e.target.value) } : x))} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-[10px]">Recebida</Label>
                    <Input type="number" min={0} value={it.quantidade_recebida}
                      onChange={(e) => setItens((prev) => prev.map((x, i) => i === idx ? { ...x, quantidade_recebida: Number(e.target.value) } : x))} />
                  </div>
                </div>
              ))}
            </div>
            <div>
              <Label className="text-xs">Observação (opcional)</Label>
              <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
            {/* Futura integração com estoque de EPIs. */}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={registrar} disabled={saving} className="gap-1"><PackageCheck className="w-4 h-4" /> Registrar recebimento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
