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
  descricao_ambiente?: string | null;
  setor?: string | null;
  processo?: string | null;
  funcoes_snapshot?: string[] | null;
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
  setores_count: number;
  funcoes_count: number;
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
      const { data: pgr, error: pgrErr } = await (supabase as any)
        .from("pgr_documentos").select("empresa_id").eq("id", pgrId).maybeSingle();
      if (pgrErr) throw pgrErr;
      if (!pgr?.empresa_id) throw new Error("PGR sem empresa");

      const { data, error } = await (supabase as any)
        .from("ghe_ges")
        .select("id, codigo, nome, setor, ghe_setores(id), ghe_funcoes(id)")
        .eq("empresa_id", pgr.empresa_id)
        .eq("status", "ativo")
        .order("codigo");
      if (error) throw error;
      setGhes((data || []).map((g: any) => ({
        id: g.id, codigo: g.codigo, nome: g.nome, setor: g.setor,
        setores_count: (g.ghe_setores || []).length,
        funcoes_count: (g.ghe_funcoes || []).length,
      })));
    } catch (e: any) {
      toast.error(e.message || "Falha ao carregar GES");
    } finally { setBusy(false); }
  };

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };
  /** "Selecionar todos" ignora os GES sem estrutura — não há o que importar deles. */
  const importaveis = ghes.filter((g) => g.setores_count > 0 || g.funcoes_count > 0);
  const toggleAll = () => {
    if (selected.size === importaveis.length) setSelected(new Set());
    else setSelected(new Set(importaveis.map((g) => g.id)));
  };

  const loadPreview = async () => {
    if (selected.size === 0) { toast.error("Selecione ao menos um GES"); return; }
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
      toast.success(`Estrutura importada — ${r.criar} linha(s) criada(s), ${r.ignorar} já existia(m). Cadastre os riscos no Inventário.`);
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
          <DialogTitle>Importar estrutura do GES → Inventário do PGR</DialogTitle>
          <DialogDescription>
            {step === "select"
              ? "Selecione os GES cuja estrutura (ambiente, setor, funções e processo) você deseja importar. Os riscos serão cadastrados depois, dentro do Inventário do PGR."
              : "Confira a prévia da estrutura a ser importada. Nada será gravado até você confirmar. Linhas duplicadas (mesmo GES + setor + processo + funções) são ignoradas."}
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="space-y-3">
            {busy ? (
              <p className="text-center py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin inline" />Carregando GES…
              </p>
            ) : ghes.length === 0 ? (
              <p className="text-center py-8 text-sm text-muted-foreground">
                Nenhum GES ativo cadastrado nesta empresa. Cadastre em <b>Documentação › GES</b>.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {ghes.length} GES encontrado(s)
                    {importaveis.length < ghes.length && ` · ${ghes.length - importaveis.length} sem estrutura`}
                  </span>
                  <Button size="sm" variant="ghost" onClick={toggleAll}>
                    {selected.size === importaveis.length && importaveis.length > 0 ? "Desmarcar todos" : "Selecionar todos"}
                  </Button>
                </div>
                <div className="max-h-[50vh] overflow-y-auto border rounded divide-y">
                  {ghes.map((g) => {
                    // "Estrutura pronta" era um selo FIXO no código: aparecia em
                    // todo GES, inclusive nos que tinham 0 setor e 0 função — ou
                    // seja, nos que não têm nada para importar. Agora o selo
                    // reflete o banco, e o que está vazio não é selecionável:
                    // importar traria um item em branco.
                    const vazio = g.setores_count === 0 && g.funcoes_count === 0;
                    return (
                      <label
                        key={g.id}
                        className={`flex items-start gap-3 p-3 ${vazio ? "opacity-70" : "hover:bg-muted/40 cursor-pointer"}`}
                      >
                        <Checkbox
                          checked={selected.has(g.id)} onCheckedChange={() => toggle(g.id)}
                          disabled={vazio} className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-sm">{g.codigo}</span>
                            <span className="text-sm">— {g.nome}</span>
                            <Badge variant="outline" className="text-[10px]">{g.setores_count} setor(es)</Badge>
                            <Badge variant="outline" className="text-[10px]">{g.funcoes_count} função(ões)</Badge>
                            {vazio ? (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">Sem estrutura</Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">Estrutura pronta</Badge>
                            )}
                          </div>
                          {vazio && (
                            <div className="text-xs text-amber-800 mt-1">
                              Este grupo ainda não tem setores nem funções, então não há o que importar.
                              Cadastre em <b>Documentação › GES</b>, no botão de funções e riscos do grupo.
                            </div>
                          )}
                          {g.setor && <div className="text-xs text-muted-foreground mt-0.5">Setor padrão: {g.setor}</div>}
                        </div>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {selected.size} selecionado(s). A importação traz apenas a <b>estrutura</b> (ambiente, GES, setor, funções e processo). Os campos de risco (agente, perigo, severidade, probabilidade, classificação) devem ser preenchidos no Inventário do PGR após a importação.
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
                    <th className="p-2 text-left">GES</th>
                    <th className="p-2 text-left">Descrição do ambiente</th>
                    <th className="p-2 text-left">Setor</th>
                    <th className="p-2 text-left">Funções expostas</th>
                    <th className="p-2 text-left">Processo</th>
                    <th className="p-2 text-left">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.itens.map((it, i) => {
                    const funcs = it.funcoes_snapshot || [];
                    return (
                    <tr key={i} className="border-t align-top">
                      <td className="p-2">
                        <div className="font-medium">{it.ghe_codigo || "—"}</div>
                        <div className="text-muted-foreground text-[10px]">{it.ghe_nome}</div>
                      </td>
                      <td className="p-2 max-w-[220px] truncate" title={it.descricao_ambiente || ""}>{it.descricao_ambiente || "—"}</td>
                      <td className="p-2">{it.setor || "—"}</td>
                      <td className="p-2 max-w-[220px]">
                        {funcs.length > 0 ? (
                          <span title={funcs.join(", ")}>
                            {funcs.slice(0, 3).join(", ")}
                            {funcs.length > 3 && <span className="text-muted-foreground"> +{funcs.length - 3}</span>}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="p-2 max-w-[180px] truncate" title={it.processo || ""}>{it.processo || "—"}</td>
                      <td className="p-2">
                        {it.acao === "criar"
                          ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">criar</Badge>
                          : <Badge variant="outline">já existente</Badge>}
                      </td>
                    </tr>
                    );
                  })}
                  {preview.itens.length === 0 && (
                    <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Os GES selecionados não possuem estrutura (setores/funções) cadastrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Após confirmar, cada linha aparecerá no Inventário como <b>“Pendente de risco”</b>. Clique no lápis para preencher agente, perigo/fonte, severidade, probabilidade e classificação.
            </p>
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
              Confirmar — criar {preview.criar} linha(s) de estrutura
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
