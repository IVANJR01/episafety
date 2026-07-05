import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { PGR_SECOES, PGR_SECAO_PADRAO } from "@/lib/pgrTextosPadrao";

interface Props {
  pgrId: string;
  empresaId: string;
  canEdit: boolean;
}

export default function TextosTab({ pgrId, empresaId, canEdit }: Props) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

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

  useEffect(() => { setDrafts({}); }, [pgrId]);

  const valor = (k: string) => drafts[k] ?? map[k] ?? "";
  const dirty = (k: string) => (drafts[k] ?? map[k] ?? "") !== (map[k] ?? "");

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
  }

  if (isLoading) return <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">Carregando…</CardContent></Card>;

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 text-xs text-muted-foreground">
          Edite os textos padrão do PGR. Eles serão utilizados na geração do PDF, junto com os dados da empresa, inventário de riscos, quadro de EPIs e plano de ação.
        </CardContent>
      </Card>

      {PGR_SECOES.map((s) => (
        <Card key={s.key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between gap-2">
              <span>{s.titulo}</span>
              {canEdit && (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => restaurar(s.key)} title="Restaurar padrão">
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Padrão
                  </Button>
                  <Button size="sm" onClick={() => salvar(s.key)} disabled={!dirty(s.key) || saving === s.key}>
                    <Save className="h-3.5 w-3.5 mr-1" /> Salvar
                  </Button>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={6}
              value={valor(s.key)}
              placeholder={PGR_SECAO_PADRAO[s.key]}
              onChange={(e) => setDrafts((d) => ({ ...d, [s.key]: e.target.value }))}
              disabled={!canEdit}
              className="text-sm"
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
