import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, FileText, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { PGR_SECOES, PGR_SECAO_PADRAO } from "@/lib/pgrTextosPadrao";

interface Props {
  pgrId: string;
  empresaId: string;
  canEdit: boolean;
}

/*
 * Estado de cada seção, do ponto de vista de quem vai emitir o documento:
 * o que falta escrever, o que já está escrito e o que mexi e não salvei.
 */
type EstadoSecao = "nao_salvo" | "preenchido" | "vazio";

const ESTADO: Record<EstadoSecao, { label: string; chip: string; ponto: string }> = {
  nao_salvo: {
    label: "Não salvo",
    chip: "bg-amber-50 text-amber-700 ring-amber-200",
    ponto: "bg-amber-500",
  },
  preenchido: {
    label: "Preenchido",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    ponto: "bg-emerald-500",
  },
  vazio: {
    label: "Não usado",
    chip: "bg-muted text-muted-foreground ring-border",
    ponto: "bg-muted-foreground/30",
  },
};

export default function TextosTab({ pgrId, empresaId, canEdit }: Props) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  /*
   * Eram quinze textareas de seis linhas empilhadas: uns dois metros de
   * rolagem para achar a seção que interessa. Agora cada seção é uma linha e
   * só abre a que está sendo escrita.
   */
  const [abertas, setAbertas] = useState<string[]>([]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["pgr-textos", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_textos")
        .select("*").eq("pgr_id", pgrId);
      return (data || []) as Array<{ secao: string; conteudo: string }>;
    },
  });

  const map = useMemo(() => {
    const m: Record<string, string> = {};
    rows.forEach((r) => { m[r.secao] = r.conteudo || ""; });
    return m;
  }, [rows]);

  useEffect(() => { setDrafts({}); setAbertas([]); }, [pgrId]);

  const valor = (k: string) => drafts[k] ?? map[k] ?? "";
  const dirty = (k: string) => (drafts[k] ?? map[k] ?? "") !== (map[k] ?? "");

  const estado = (k: string): EstadoSecao => {
    if (dirty(k)) return "nao_salvo";
    return (map[k] || "").trim() ? "preenchido" : "vazio";
  };

  const preenchidas = PGR_SECOES.filter((s) => (map[s.key] || "").trim()).length;
  const pct = Math.round((preenchidas / PGR_SECOES.length) * 100);
  const pendentesDeSalvar = PGR_SECOES.filter((s) => dirty(s.key)).length;

  function alternar(key: string) {
    setAbertas((a) => (a.includes(key) ? a.filter((k) => k !== key) : [...a, key]));
  }

  async function salvar(secao: string) {
    setSaving(secao);
    try {
      const conteudo = valor(secao);
      const { error } = await (supabase.from as any)("pgr_textos")
        .upsert({ pgr_id: pgrId, empresa_id: empresaId, secao, conteudo }, { onConflict: "pgr_id,secao" });
      if (error) throw error;
      toast.success("Texto salvo");
      setDrafts((d) => { const c = { ...d }; delete c[secao]; return c; });
      qc.invalidateQueries({ queryKey: ["pgr-textos", pgrId] });
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar");
    } finally { setSaving(null); }
  }

  function restaurar(secao: string) {
    setDrafts((d) => ({ ...d, [secao]: PGR_SECAO_PADRAO[secao] || "" }));
    setAbertas((a) => (a.includes(secao) ? a : [...a, secao]));
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">Carregando…</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 ring-1 ring-slate-100">
                <FileText className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-semibold leading-tight">Textos do documento</h3>
                <p className="mt-0.5 max-w-prose text-xs leading-relaxed text-muted-foreground">
                  Seções opcionais. Só entram no PDF se forem preenchidas, junto com os dados da
                  empresa, o inventário de riscos e o plano de ação. O quadro de EPIs não sai no
                  documento — a NR-01 não o exige, e ele ficou como registro de apoio.
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-semibold leading-none tabular-nums">
                {preenchidas}
                <span className="text-base font-normal text-muted-foreground">
                  /{PGR_SECOES.length}
                </span>
              </div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                preenchidas
              </div>
            </div>
          </div>

          <Progress value={pct} className="h-1.5" />

          {pendentesDeSalvar > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
              {pendentesDeSalvar === 1
                ? "1 seção alterada e ainda não salva."
                : `${pendentesDeSalvar} seções alteradas e ainda não salvas.`}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden shadow-sm">
        <ul className="divide-y">
          {PGR_SECOES.map((s, indice) => {
            const aberta = abertas.includes(s.key);
            const est = ESTADO[estado(s.key)];
            const caracteres = valor(s.key).trim().length;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => alternar(s.key)}
                  aria-expanded={aberta}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="w-5 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                    {String(indice + 1).padStart(2, "0")}
                  </span>
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${est.ponto}`} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.titulo}</span>
                  <span
                    className={`hidden shrink-0 rounded-full px-2 py-px text-[10px] font-semibold uppercase tracking-wide ring-1 sm:inline ${est.chip}`}
                  >
                    {est.label}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${aberta ? "rotate-180" : ""}`}
                  />
                </button>

                {aberta && (
                  <div className="space-y-3 border-t bg-muted/20 px-4 py-4">
                    <Textarea
                      rows={8}
                      value={valor(s.key)}
                      placeholder={PGR_SECAO_PADRAO[s.key]}
                      onChange={(e) => setDrafts((d) => ({ ...d, [s.key]: e.target.value }))}
                      disabled={!canEdit}
                      className="resize-y bg-background text-sm leading-relaxed"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {caracteres === 0
                          ? "Vazio — a seção não sai no PDF"
                          : `${caracteres} caracteres`}
                      </span>
                      {canEdit && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => restaurar(s.key)}
                            title="Preencher com o texto padrão"
                          >
                            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Padrão
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => salvar(s.key)}
                            disabled={!dirty(s.key) || saving === s.key}
                          >
                            <Save className="mr-1 h-3.5 w-3.5" />
                            {saving === s.key ? "Salvando…" : "Salvar"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
