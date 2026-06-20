import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Wand2, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import PgrAcaoDialog from "./PgrAcaoDialog";
import {
  ACAO_STATUS_LABEL, ACAO_STATUS_COLOR, MEDIDA_LABEL, PgrAcaoStatus, isAtrasada,
  prazoSugerido, PRIORIDADE_POR_CLASSE,
} from "@/lib/pgrAcoes";
import { classificarRisco } from "@/lib/pgrMatriz";
import { isEditavel, PgrStatus } from "@/lib/pgrTypes";

interface Props {
  pgrId: string;
  empresaId: string;
  pgrVersao: number;
  status: PgrStatus;
  canEdit: boolean;
  pgr: any;
}

const STATUS_COLS: PgrAcaoStatus[] = ["pendente","em_andamento","atrasada","concluida","cancelada"];

export default function PlanoAcaoTab({ pgrId, empresaId, pgrVersao, status, canEdit, pgr }: Props) {
  const qc = useQueryClient();
  const editavel = isEditavel(status) && canEdit;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [defaults, setDefaults] = useState<any>(null);
  const [vista, setVista] = useState<"kanban"|"lista">("kanban");
  const [fStatus, setFStatus] = useState<string>("todos");
  const [fResp, setFResp] = useState("");
  const [fPrio, setFPrio] = useState<string>("todas");
  const [soAtrasadas, setSoAtrasadas] = useState(false);

  const { data: acoes = [] } = useQuery({
    queryKey: ["pgr-acoes", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_acoes").select("*").eq("pgr_id", pgrId).order("prazo", { ascending: true });
      return data || [];
    },
  });

  // Itens do inventário sem ação associada e com classe alto/crítico
  const { data: inventario = [] } = useQuery({
    queryKey: ["pgr-inventario", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_inventario_itens").select("*").eq("pgr_id", pgrId);
      return data || [];
    },
  });

  const sugestoes = useMemo(() => {
    const idsComAcao = new Set(acoes.map((a: any) => a.inventario_item_id).filter(Boolean));
    return inventario
      .filter((i: any) => {
        const cls = i.classificacao || classificarRisco(i.severidade, i.probabilidade);
        return (cls === "alto" || cls === "critico") && !idsComAcao.has(i.id);
      })
      .map((i: any) => ({
        ...i,
        classe: i.classificacao || classificarRisco(i.severidade, i.probabilidade),
      }));
  }, [inventario, acoes]);

  const filtradas = useMemo(() => {
    return acoes.filter((a: any) => {
      if (fStatus !== "todos" && a.status !== fStatus) return false;
      if (fResp && !(a.responsavel_nome || "").toLowerCase().includes(fResp.toLowerCase())) return false;
      if (fPrio !== "todas" && String(a.prioridade) !== fPrio) return false;
      if (soAtrasadas && !isAtrasada(a)) return false;
      return true;
    });
  }, [acoes, fStatus, fResp, fPrio, soAtrasadas]);

  const stats = useMemo(() => {
    const s: any = { total: acoes.length, atrasadas: 0 };
    STATUS_COLS.forEach(c => s[c] = 0);
    acoes.forEach((a: any) => { s[a.status]++; if (isAtrasada(a)) s.atrasadas++; });
    return s;
  }, [acoes]);

  const onSaved = () => qc.invalidateQueries({ queryKey: ["pgr-acoes", pgrId] });

  const novaManual = () => { setEditId(null); setDefaults({
    responsavel_nome: pgr?.resp_tec_nome || "",
    responsavel_id: pgr?.responsavel_tecnico_id || null,
  }); setDialogOpen(true); };

  const aceitarSugestao = (item: any) => {
    const prazo = prazoSugerido(item.classe);
    setEditId(null);
    setDefaults({
      inventario_item_id: item.id,
      descricao: `Controle para: ${item.perigo_descricao}`,
      tipo: "engenharia",
      prioridade: PRIORIDADE_POR_CLASSE[item.classe as keyof typeof PRIORIDADE_POR_CLASSE] ?? 3,
      prazo: prazo || "",
      responsavel_nome: pgr?.resp_tec_nome || "",
      responsavel_id: pgr?.responsavel_tecnico_id || null,
      what: `Implantar controle do risco "${item.perigo_descricao}"`,
      why: `Risco classificado como ${item.classe.toUpperCase()} no inventário.`,
      where_local: item.fonte_geradora || "",
    });
    setDialogOpen(true);
  };

  const marcarAtrasadas = async () => {
    try {
      const { data, error } = await (supabase as any).rpc("pgr_marcar_atrasadas", { _pgr_id: pgrId });
      if (error) throw error;
      toast.success(`${data ?? 0} ação(ões) marcada(s) como atrasada(s)`);
      onSaved();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-3">
      {!editavel && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-3 text-sm text-amber-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            PGR <b>{status}</b> não permite edição direta do Plano de Ação. Abra uma revisão para alterar.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Total: {stats.total}</Badge>
            {STATUS_COLS.map(s => (
              <Badge key={s} className={ACAO_STATUS_COLOR[s]} variant="outline">{ACAO_STATUS_LABEL[s]}: {stats[s]}</Badge>
            ))}
            {stats.atrasadas > 0 && <Badge className="bg-red-600 text-white">Atrasadas: {stats.atrasadas}</Badge>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={marcarAtrasadas} disabled={!editavel}><RefreshCw className="h-4 w-4 mr-1" /> Recalcular atrasadas</Button>
            {editavel && <Button size="sm" onClick={novaManual}><Plus className="h-4 w-4 mr-1" /> Nova ação</Button>}
          </div>
        </CardContent>
      </Card>

      {editavel && sugestoes.length > 0 && (
        <Card className="border-orange-300">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Wand2 className="h-4 w-4 text-orange-700" />
              <div className="font-semibold text-sm">Sugestões automáticas — riscos Alto/Crítico sem ação ({sugestoes.length})</div>
            </div>
            <ul className="divide-y">
              {sugestoes.slice(0, 8).map((it: any) => (
                <li key={it.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{it.perigo_descricao}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      Classe <b className="uppercase">{it.classe}</b> · SLA sugerido até {prazoSugerido(it.classe) && new Date(prazoSugerido(it.classe)!+"T00:00:00").toLocaleDateString("pt-BR")} · prioridade {PRIORIDADE_POR_CLASSE[it.classe as keyof typeof PRIORIDADE_POR_CLASSE]}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => aceitarSugestao(it)}>Criar ação</Button>
                </li>
              ))}
            </ul>
            {sugestoes.length > 8 && <div className="text-[11px] text-muted-foreground mt-1">+ {sugestoes.length-8} sugestões — abra o inventário para ver todas.</div>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3">
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos status</SelectItem>
                {STATUS_COLS.map(s => <SelectItem key={s} value={s}>{ACAO_STATUS_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Responsável" value={fResp} onChange={(e) => setFResp(e.target.value)} />
            <Select value={fPrio} onValueChange={setFPrio}>
              <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas prioridades</SelectItem>
                {[1,2,3,4,5].map(p => <SelectItem key={p} value={String(p)}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={soAtrasadas} onChange={(e) => setSoAtrasadas(e.target.checked)} /> Só atrasadas
            </label>
            <Tabs value={vista} onValueChange={(v: any) => setVista(v)}>
              <TabsList className="w-full">
                <TabsTrigger value="kanban" className="flex-1">Kanban</TabsTrigger>
                <TabsTrigger value="lista" className="flex-1">Lista</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {vista === "kanban" ? (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {STATUS_COLS.map(col => (
                <div key={col} className="bg-muted/40 rounded p-2 min-h-[200px]">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={ACAO_STATUS_COLOR[col]} variant="outline">{ACAO_STATUS_LABEL[col]}</Badge>
                    <span className="text-xs text-muted-foreground">{filtradas.filter((a: any) => a.status === col).length}</span>
                  </div>
                  <div className="space-y-2">
                    {filtradas.filter((a: any) => a.status === col).map((a: any) => {
                      const atras = isAtrasada(a);
                      return (
                        <button key={a.id} onClick={() => { setEditId(a.id); setDefaults(null); setDialogOpen(true); }}
                          className="w-full text-left bg-background border rounded p-2 text-xs hover:shadow">
                          <div className="font-medium line-clamp-2">{a.descricao}</div>
                          <div className="flex flex-wrap gap-1 mt-1 text-[10px]">
                            <span className="bg-muted px-1.5 py-0.5 rounded">P{a.prioridade}</span>
                            <span className="bg-muted px-1.5 py-0.5 rounded">{MEDIDA_LABEL[a.tipo as keyof typeof MEDIDA_LABEL]}</span>
                            {a.prazo && <span className={`px-1.5 py-0.5 rounded ${atras ? "bg-red-100 text-red-800" : "bg-muted"}`}>
                              {new Date(a.prazo+"T00:00:00").toLocaleDateString("pt-BR")}
                            </span>}
                          </div>
                          {a.responsavel_nome && <div className="text-[10px] text-muted-foreground mt-1 truncate">👤 {a.responsavel_nome}</div>}
                        </button>
                      );
                    })}
                    {filtradas.filter((a: any) => a.status === col).length === 0 && (
                      <div className="text-[11px] text-muted-foreground text-center py-2">vazio</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted"><tr>
                  <th className="p-2 text-left">Descrição</th>
                  <th className="p-2 text-left">Tipo</th>
                  <th className="p-2 text-center">P</th>
                  <th className="p-2 text-left">Responsável</th>
                  <th className="p-2 text-left">Prazo</th>
                  <th className="p-2 text-left">Status</th>
                </tr></thead>
                <tbody>
                  {filtradas.map((a: any) => {
                    const atras = isAtrasada(a);
                    return (
                      <tr key={a.id} className="border-t hover:bg-muted/40 cursor-pointer"
                          onClick={() => { setEditId(a.id); setDefaults(null); setDialogOpen(true); }}>
                        <td className="p-2 max-w-[260px] truncate" title={a.descricao}>{a.descricao}</td>
                        <td className="p-2">{MEDIDA_LABEL[a.tipo as keyof typeof MEDIDA_LABEL]}</td>
                        <td className="p-2 text-center">{a.prioridade}</td>
                        <td className="p-2">{a.responsavel_nome || "—"}</td>
                        <td className={`p-2 ${atras ? "text-red-700 font-medium" : ""}`}>{a.prazo ? new Date(a.prazo+"T00:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                        <td className="p-2">
                          <Badge className={ACAO_STATUS_COLOR[a.status as PgrAcaoStatus]} variant="outline">{ACAO_STATUS_LABEL[a.status as PgrAcaoStatus]}</Badge>
                          {atras && a.status !== "atrasada" && <Badge className="ml-1 bg-red-100 text-red-800 border-red-300" variant="outline">vencida</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                  {filtradas.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhuma ação.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <PgrAcaoDialog
        open={dialogOpen} onOpenChange={setDialogOpen}
        pgrId={pgrId} empresaId={empresaId} pgrVersao={pgrVersao}
        acaoId={editId} defaults={defaults}
        canEdit={canEdit} pgrEditavel={editavel} onSaved={onSaved}
      />
    </div>
  );
}
