import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Download, ArrowLeft } from "lucide-react";

interface PreviewItem {
  ghe_id: string;
  ghe_codigo?: string;
  ghe_nome?: string;
  perigo_descricao: string;
  grupo?: string;
  fonte_geradora?: string;
  exposicao?: string;
  severidade?: number;
  probabilidade?: number;
  acao: "criar" | "ignorar";
}
interface PreviewResp {
  dry_run: boolean;
  criar: number;
  ignorar: number;
  total_origem: number;
  itens: PreviewItem[];
}

interface GheOption {
  id: string;
  codigo: string;
  nome: string;
  setor: string | null;
  riscos_count: number;
}

type Step = "select" | "preview";

export default function ImportarGheDialog({
  open, onOpenChange, pgrId, onImported,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  pgrId: string;
  onImported: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>("select");
  const [ghes, setGhes] = useState<GheOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PreviewResp | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("select"); setPreview(null); setSelected(new Set());
    loadGhes();
  }, [open, pgrId]);

  const loadGhes = async () => {
    setBusy(true);
    try {
      // Empresa do PGR
      const { data: pgr, error: pgrErr } = await (supabase as any)
        .from("pgr_documentos").select("empresa_id").eq("id", pgrId).maybeSingle();
      if (pgrErr) throw pgrErr;
      if (!pgr?.empresa_id) throw new Error("PGR sem empresa");

      const { data, error } = await (supabase as any)
        .from("ghe_ges")
        .select("id, codigo, nome, setor, ghe_riscos(id)")
        .eq("empresa_id", pgr.empresa_id)
        .eq("status", "ativo")
        .order("codigo");
      if (error) throw error;
      setGhes((data || []).map((g: any) => ({
        id: g.id, codigo: g.codigo, nome: g.nome, setor: g.setor,
        riscos_count: (g.ghe_riscos || []).length,
      })));
    } catch (e: any) {
      toast.error(e.message || "Falha ao carregar GES/GHE");
    } finally { setBusy(false); }
  };

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };
  const toggleAll = () => {
    if (selected.size === ghes.length) setSelected(new Set());
    else setSelected(new Set(ghes.map((g) => g.id)));
  };

  const loadPreview = async () => {
    if (selected.size === 0) { toast.error("Selecione ao menos um GES/GHE"); return; }
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("pgr_importar_ghe", {
        _pgr_id: pgrId, _dry_run: true, _ghe_ids: Array.from(selected),
      });
      if (error) throw error;
      setPreview(data as PreviewResp);
      setStep("preview");
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar prévia");
    } finally { setBusy(false); }
  };

  const confirmar = async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("pgr_importar_ghe", {
        _pgr_id: pgrId, _dry_run: false, _ghe_ids: Array.from(selected),
      });
      if (error) throw error;
      const r = data as PreviewResp;
      toast.success(`Importação concluída — ${r.criar} criados, ${r.ignorar} já existiam`);
      onImported();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Falha ao importar");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar GES/GHE → Inventário do PGR</DialogTitle>
          <DialogDescription>
            {step === "select"
              ? "Selecione os GES/GHE cujos riscos você deseja importar para o inventário deste PGR."
              : "Confira a prévia. Nada será gravado até você confirmar. Itens duplicados são ignorados automaticamente."}
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-3">
            {busy ? (
              <p className="text-center py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />Carregando GES/GHE…
              </p>
            ) : ghes.length === 0 ? (
              <p className="text-center py-8 text-sm text-muted-foreground">
                Nenhum GES/GHE ativo cadastrado nesta empresa. Cadastre em <b>Cadastro → GES</b>.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{ghes.length} GES/GHE encontrado(s)</span>
                  <Button size="sm" variant="ghost" onClick={toggleAll}>
                    {selected.size === ghes.length ? "Desmarcar todos" : "Selecionar todos"}
                  </Button>
                </div>
                <div className="max-h-[50vh] overflow-y-auto border rounded divide-y">
                  {ghes.map((g) => (
                    <label key={g.id} className="flex items-start gap-3 p-3 hover:bg-muted/40 cursor-pointer">
                      <Checkbox checked={selected.has(g.id)} onCheckedChange={() => toggle(g.id)} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-sm">{g.codigo}</span>
                          <span className="text-sm">— {g.nome}</span>
                          <Badge variant="outline" className="text-[10px]">{g.riscos_count} risco(s)</Badge>
                        </div>
                        {g.setor && <div className="text-xs text-muted-foreground mt-0.5">Setor: {g.setor}</div>}
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {selected.size} selecionado(s). A importação puxa: perigo, fonte, exposição, medidas de controle (existentes/EPCs/recomendadas) e severidade×probabilidade do GES.
                </p>
              </>
            )}
          </div>
        )}

        {step === "preview" && preview && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Origem: {preview.total_origem}</Badge>
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">A criar: {preview.criar}</Badge>
              <Badge className="bg-zinc-100 text-zinc-700 border-zinc-300">Ignorar (já existem): {preview.ignorar}</Badge>
            </div>
            <div className="max-h-[50vh] overflow-y-auto border rounded">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 text-left">GES/GHE</th>
                    <th className="p-2 text-left">Perigo</th>
                    <th className="p-2 text-left">Fonte</th>
                    <th className="p-2 text-center">S×P</th>
                    <th className="p-2 text-left">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.itens.map((it, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">
                        <div className="font-medium">{it.ghe_codigo || "—"}</div>
                        <div className="text-muted-foreground text-[10px]">{it.ghe_nome}</div>
                      </td>
                      <td className="p-2">{it.perigo_descricao}</td>
                      <td className="p-2 text-muted-foreground">{it.fonte_geradora || "—"}</td>
                      <td className="p-2 text-center">
                        {it.severidade && it.probabilidade ? `${it.severidade}×${it.probabilidade}` : "—"}
                      </td>
                      <td className="p-2">
                        {it.acao === "criar"
                          ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">criar</Badge>
                          : <Badge variant="outline">ignorar</Badge>}
                      </td>
                    </tr>
                  ))}
                  {preview.itens.length === 0 && (
                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Os GES selecionados não possuem riscos cadastrados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "preview" && (
            <Button variant="ghost" onClick={() => { setStep("select"); setPreview(null); }}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {step === "select" && (
            <Button onClick={loadPreview} disabled={busy || selected.size === 0}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Gerar prévia ({selected.size})
            </Button>
          )}
          {step === "preview" && preview && (
            <Button onClick={confirmar} disabled={busy || preview.criar === 0}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmar — criar {preview.criar} item(ns)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
