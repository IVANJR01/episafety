import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  ltcatId: string;
  empresaId: string;
}

export default function LtcatImportarPgrDialog({ open, onOpenChange, ltcatId, empresaId }: Props) {
  const qc = useQueryClient();
  const [pgrId, setPgrId] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const { data: pgrs = [] } = useQuery({
    queryKey: ["ltcat-imp-pgrs", empresaId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_documentos")
        .select("id, versao, status").eq("empresa_id", empresaId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: open,
  });

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["ltcat-imp-itens", pgrId],
    queryFn: async () => {
      if (!pgrId) return [];
      const { data } = await (supabase.from as any)("pgr_inventario_itens")
        .select("id, ghe_id, perigo_id, perigo_descricao, fonte_geradora, medicao_valor, medicao_unidade, limite_tolerancia, avaliacao_tipo")
        .eq("pgr_id", pgrId).eq("avaliacao_tipo", "quantitativa");
      return data || [];
    },
    enabled: !!pgrId,
  });

  const { data: jaImportados = [] } = useQuery({
    queryKey: ["ltcat-imp-existentes", ltcatId, pgrId],
    queryFn: async () => {
      if (!pgrId) return [];
      const { data } = await (supabase.from as any)("ltcat_avaliacoes")
        .select("origem_pgr_item_id").eq("ltcat_id", ltcatId).eq("pgr_id", pgrId);
      return (data || []).map((r: any) => r.origem_pgr_item_id).filter(Boolean);
    },
    enabled: !!pgrId,
  });

  const jaSet = new Set(jaImportados);

  const toggle = (id: string) => {
    const ns = new Set(selected);
    if (ns.has(id)) ns.delete(id); else ns.add(id);
    setSelected(ns);
  };

  const toggleAll = () => {
    const importaveis = (itens as any[]).filter((i) => !jaSet.has(i.id)).map((i) => i.id);
    if (selected.size === importaveis.length) setSelected(new Set());
    else setSelected(new Set(importaveis));
  };

  const handleImport = async () => {
    if (!pgrId || selected.size === 0) { toast.error("Selecione ao menos uma avaliação"); return; }
    setImporting(true);
    try {
      const { data, error } = await (supabase as any).rpc("ltcat_importar_avaliacoes_pgr", {
        _ltcat_id: ltcatId,
        _pgr_id: pgrId,
        _item_ids: Array.from(selected),
      });
      if (error) throw error;
      const r = data || {};
      toast.success(`Importação concluída: ${r.criadas || 0} criadas, ${r.ignoradas || 0} ignoradas, ${r.sem_agente_no_catalogo || 0} sem agente no catálogo, ${r.sem_ghe || 0} sem GHE`);
      qc.invalidateQueries({ queryKey: ["ltcat-aa", ltcatId] });
      onOpenChange(false);
      setSelected(new Set()); setPgrId("");
    } catch (e: any) {
      toast.error(e.message || "Falha na importação");
    } finally { setImporting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" /> Importar avaliações do PGR
          </DialogTitle>
          <DialogDescription>
            Reaproveite as avaliações quantitativas existentes no PGR vinculado. Você revisa o que será criado antes de confirmar.
            A deduplicação usa: <code className="text-xs">ltcat × pgr × ghe × agente × técnica × data</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">PGR de origem (mesma empresa)</Label>
            <Select value={pgrId} onValueChange={setPgrId}>
              <SelectTrigger><SelectValue placeholder="Selecionar PGR" /></SelectTrigger>
              <SelectContent>
                {(pgrs as any[]).map((p) => (
                  <SelectItem key={p.id} value={p.id}>PGR v{p.versao} ({p.status})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {pgrId && (
            <div className="border rounded-md max-h-96 overflow-y-auto">
              <div className="flex items-center justify-between p-2 border-b bg-muted/50 sticky top-0">
                <div className="text-xs text-muted-foreground">
                  {(itens as any[]).length} avaliações quantitativas · {jaImportados.length} já importadas
                </div>
                <Button size="sm" variant="ghost" onClick={toggleAll}>
                  {selected.size > 0 ? "Limpar seleção" : "Selecionar todos importáveis"}
                </Button>
              </div>
              {isLoading ? (
                <p className="p-4 text-center text-sm text-muted-foreground">Carregando…</p>
              ) : (itens as any[]).length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma avaliação quantitativa neste PGR.</p>
              ) : (
                <ul className="divide-y">
                  {(itens as any[]).map((i) => {
                    const dup = jaSet.has(i.id);
                    return (
                      <li key={i.id} className="p-2 flex items-start gap-2">
                        <Checkbox
                          checked={selected.has(i.id)} disabled={dup}
                          onCheckedChange={() => toggle(i.id)}
                        />
                        <div className="flex-1 text-sm">
                          <div className="font-medium">{i.perigo_descricao}</div>
                          <div className="text-xs text-muted-foreground">
                            {i.fonte_geradora ? `Fonte: ${i.fonte_geradora}` : "—"}
                            {i.medicao_valor != null && <> · Medido: <strong>{i.medicao_valor} {i.medicao_unidade || ""}</strong></>}
                            {i.limite_tolerancia && <> · LT: {i.limite_tolerancia}</>}
                          </div>
                          {dup && (
                            <Badge variant="outline" className="mt-1 bg-zinc-100 text-zinc-700 border-zinc-300">
                              Já importada
                            </Badge>
                          )}
                          {!i.ghe_id && (
                            <Badge variant="outline" className="mt-1 ml-1 bg-amber-100 text-amber-800 border-amber-300">
                              <AlertTriangle className="h-3 w-3 mr-1" /> Sem GHE — será ignorada
                            </Badge>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Itens cujo perigo não tenha correspondência no catálogo de agentes nocivos serão contados como
            "sem agente no catálogo" — você pode cadastrá-los no catálogo da empresa e reimportar.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleImport} disabled={importing || selected.size === 0}>
            {importing ? "Importando…" : `Importar ${selected.size} avaliação(ões)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
