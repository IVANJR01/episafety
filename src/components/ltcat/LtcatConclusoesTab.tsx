import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Lock, AlertTriangle, FileBadge, BookOpen } from "lucide-react";
import { toast } from "sonner";
import LtcatConclusaoDialog from "./LtcatConclusaoDialog";
import LtcatCatalogoAgentesDialog from "./LtcatCatalogoAgentesDialog";
import {
  LtcatConclusao, LTCAT_CONCLUSAO_LABEL, LTCAT_CONCLUSAO_COLOR, LTCAT_ENQUADRAMENTO_LABEL,
} from "@/lib/ltcatTypes";

interface Props {
  ltcatId: string;
  empresaId: string;
  editavel: boolean;
}

export default function LtcatConclusoesTab({ ltcatId, empresaId, editavel }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LtcatConclusao | null>(null);
  const [catOpen, setCatOpen] = useState(false);

  const { data: conclusoes = [], isLoading } = useQuery({
    queryKey: ["ltcat-conclusoes", ltcatId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ltcat_conclusoes")
        .select("*").eq("ltcat_id", ltcatId).order("created_at", { ascending: false });
      return (data || []) as LtcatConclusao[];
    },
  });

  const { data: ghes = [] } = useQuery({
    queryKey: ["ltcat-ghes-min", ltcatId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ltcat_grupos_homogeneos")
        .select("id, codigo, nome").eq("ltcat_id", ltcatId);
      return data || [];
    },
  });

  const { data: funcoes = [] } = useQuery({
    queryKey: ["ltcat-funcoes-all", ltcatId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ltcat_funcoes")
        .select("id, nome_funcao, cbo").eq("ltcat_id", ltcatId);
      return data || [];
    },
  });

  const gheMap = useMemo(() => Object.fromEntries((ghes as any[]).map((g) => [g.id, g])), [ghes]);
  const funcMap = useMemo(() => Object.fromEntries((funcoes as any[]).map((f) => [f.id, f])), [funcoes]);

  const resumo = useMemo(() => {
    const total = conclusoes.length;
    const especial = conclusoes.filter((c) => c.conclusao.startsWith("especial_")).length;
    const naoEsp = conclusoes.filter((c) => c.conclusao === "nao_especial").length;
    const inc = conclusoes.filter((c) => c.conclusao === "inconclusivo").length;
    const acima: Record<string, number> = {};
    let avalAcima = 0;
    conclusoes.forEach((c) =>
      (c.agentes_considerados || []).forEach((a) => {
        if (a.acima_limite) {
          acima[a.agente_nome] = (acima[a.agente_nome] || 0) + 1;
          avalAcima++;
        }
      })
    );
    const top = Object.entries(acima).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { total, especial, naoEsp, inc, top, avalAcima };
  }, [conclusoes]);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (c: LtcatConclusao) => { setEditing(c); setOpen(true); };

  const remove = async (id: string) => {
    if (!confirm("Remover esta conclusão?")) return;
    const { error } = await (supabase.from as any)("ltcat_conclusoes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Conclusão removida");
    qc.invalidateQueries({ queryKey: ["ltcat-conclusoes", ltcatId] });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Total conclusões</div>
          <div className="text-2xl font-bold">{resumo.total}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Especial</div>
          <div className="text-2xl font-bold text-rose-700">{resumo.especial}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Não enquadradas</div>
          <div className="text-2xl font-bold">{resumo.naoEsp}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Inconclusivas</div>
          <div className="text-2xl font-bold text-amber-700">{resumo.inc}</div>
        </CardContent></Card>
      </div>

      {resumo.top.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600" /> Agentes mais críticos · {resumo.avalAcima} avaliações acima do limite
          </CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2 pt-0">
            {resumo.top.map(([nome, n]) => (
              <Badge key={nome} variant="outline" className="bg-rose-50 text-rose-800 border-rose-300">{nome} · {n}</Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">{conclusoes.length} conclusão(ões)</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCatOpen(true)}>
            <BookOpen className="h-4 w-4 mr-1" /> Catálogo de agentes
          </Button>
          {editavel ? (
            <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova conclusão</Button>
          ) : (
            <Badge variant="outline" className="bg-zinc-100 text-zinc-700"><Lock className="h-3 w-3 mr-1" /> Somente leitura</Badge>
          )}
        </div>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Carregando…</CardContent></Card>
      ) : conclusoes.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground space-y-2">
          <FileBadge className="h-10 w-10 mx-auto opacity-30" />
          <p>Nenhuma conclusão previdenciária registrada.</p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GHE/GES</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Agentes</TableHead>
                  <TableHead>Habitualidade</TableHead>
                  <TableHead>Conclusão</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conclusoes.map((c) => {
                  const g = gheMap[c.grupo_homogeneo_id];
                  const f = c.funcao_id ? funcMap[c.funcao_id] : null;
                  const ags = c.agentes_considerados || [];
                  const acima = ags.filter((a) => a.acima_limite).length;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">
                        {g ? <><span className="font-mono">{g.codigo}</span> <span className="text-muted-foreground">{g.nome}</span></> : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {f ? <>{f.nome_funcao}{f.cbo ? ` · ${f.cbo}` : ""}</> : <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700">Genérica</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span>{ags.length}</span>
                          {acima > 0 && <Badge variant="outline" className="text-xs bg-rose-50 text-rose-800 border-rose-300">{acima} acima LT</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{c.enquadramento ? LTCAT_ENQUADRAMENTO_LABEL[c.enquadramento] : "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={LTCAT_CONCLUSAO_COLOR[c.conclusao]}>{LTCAT_CONCLUSAO_LABEL[c.conclusao]}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {editavel && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-3 w-3" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-3 w-3" /></Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <LtcatConclusaoDialog
        open={open} onOpenChange={setOpen}
        ltcatId={ltcatId} empresaId={empresaId}
        editing={editing}
      />
      <LtcatCatalogoAgentesDialog
        open={catOpen} onOpenChange={setCatOpen}
        empresaId={empresaId} canEdit={editavel}
      />
    </div>
  );
}
