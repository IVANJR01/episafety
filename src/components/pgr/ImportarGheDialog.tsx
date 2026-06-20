import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Download } from "lucide-react";

interface PreviewItem {
  ghe_id: string;
  perigo_descricao: string;
  acao: "criar" | "ignorar";
}
interface PreviewResp {
  dry_run: boolean;
  criar: number;
  ignorar: number;
  total_origem: number;
  itens: PreviewItem[];
}

export default function ImportarGheDialog({
  open, onOpenChange, pgrId, onImported,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  pgrId: string;
  onImported: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewResp | null>(null);

  const loadPreview = async () => {
    setBusy(true); setPreview(null);
    try {
      const { data, error } = await (supabase as any).rpc("pgr_importar_ghe", { _pgr_id: pgrId, _dry_run: true });
      if (error) throw error;
      setPreview(data as PreviewResp);
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar preview");
    } finally { setBusy(false); }
  };

  const confirmar = async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("pgr_importar_ghe", { _pgr_id: pgrId, _dry_run: false });
      if (error) throw error;
      const r = data as PreviewResp;
      toast.success(`Importação concluída — ${r.criar} criados, ${r.ignorar} ignorados (duplicados)`);
      onImported();
      onOpenChange(false);
      setPreview(null);
    } catch (e: any) {
      toast.error(e.message || "Falha ao importar");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(b) => { onOpenChange(b); if (!b) setPreview(null); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar GHE/GES → Inventário</DialogTitle>
          <DialogDescription>
            Importa os perigos cadastrados nos GHE/GES da empresa para o inventário deste PGR.
            A deduplicação considera: PGR + GHE + perigo + fonte geradora + tipo de avaliação.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Clique para carregar uma prévia. Nenhum item será gravado até a confirmação.
            </p>
            <Button onClick={loadPreview} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Carregar prévia
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Origem: {preview.total_origem}</Badge>
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">A criar: {preview.criar}</Badge>
              <Badge className="bg-zinc-100 text-zinc-700 border-zinc-300">A ignorar (já existem): {preview.ignorar}</Badge>
            </div>
            <div className="max-h-72 overflow-y-auto border rounded">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr><th className="p-2 text-left">GHE</th><th className="p-2 text-left">Perigo</th><th className="p-2 text-left">Ação</th></tr>
                </thead>
                <tbody>
                  {preview.itens.map((it, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 font-mono text-[10px]">{it.ghe_id.slice(0,8)}</td>
                      <td className="p-2">{it.perigo_descricao}</td>
                      <td className="p-2">
                        {it.acao === "criar"
                          ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">criar</Badge>
                          : <Badge variant="outline">ignorar</Badge>}
                      </td>
                    </tr>
                  ))}
                  {preview.itens.length === 0 && (
                    <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">Nenhum GHE/risco cadastrado para esta empresa.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {preview && (
            <Button onClick={confirmar} disabled={busy || preview.criar === 0}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmar — criar {preview.criar} itens
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
