import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { StatusBadge, StatusTone } from "@/components/ui/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Search, ClipboardList, Pencil, Trash2, FileDown, FileSpreadsheet, Eye, CheckCircle2, ShoppingCart, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import SolicitacaoMaterialFormDialog from "@/components/epis/SolicitacaoMaterialFormDialog";
import SolicitacaoAprovacaoDialog from "@/components/epis/SolicitacaoAprovacaoDialog";
import SolicitacaoRecebimentoDialog from "@/components/epis/SolicitacaoRecebimentoDialog";
import { gerarSolicitacaoPdf } from "@/lib/solicitacaoMateriaisPdf";
import { exportarSolicitacaoExcel } from "@/lib/solicitacaoMateriaisExcel";

type Solicitacao = {
  id: string;
  empresa_id: string;
  numero_solicitacao: string;
  titulo: string;
  data_solicitacao: string;
  data_necessidade: string | null;
  solicitante_nome: string | null;
  setor: string | null;
  local_obra: string | null;
  prioridade: "baixa" | "normal" | "alta" | "urgente";
  status: string;
  justificativa: string | null;
  observacoes: string | null;
  aprovado_por_nome: string | null;
  aprovado_em: string | null;
  motivo_recusa: string | null;
  comprada_em: string | null;
  recebida_em: string | null;
  nota_fiscal: string | null;
};

const STATUS_TONE: Record<string, StatusTone> = {
  rascunho: "neutral",
  enviada: "info",
  aprovada: "success",
  recusada: "danger",
  comprada: "pending",
  recebida: "success",
  recebida_parcial: "warning",
  cancelada: "neutral",
};
const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho", enviada: "Enviada", aprovada: "Aprovada",
  recusada: "Recusada", comprada: "Comprada", recebida: "Recebida",
  recebida_parcial: "Recebida parcial", cancelada: "Cancelada",
};
const PRI_TONE: Record<string, StatusTone> = {
  baixa: "neutral", normal: "info", alta: "warning", urgente: "critical",
};

export default function SolicitacoesMateriais() {
  const { user, empresaId, isSuperAdmin, isPrincipal } = useAuth();
  const [items, setItems] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [priFilter, setPriFilter] = useState("TODAS");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [aprovOpen, setAprovOpen] = useState<string | null>(null);
  const [recebOpen, setRecebOpen] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Solicitacao | null>(null);

  const canApprove = isSuperAdmin || isPrincipal;

  async function load() {
    if (!empresaId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("solicitacoes_materiais")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar solicitações", { description: error.message });
    } else {
      setItems((data || []) as Solicitacao[]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [empresaId]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return items.filter((s) => {
      if (statusFilter !== "TODOS" && s.status !== statusFilter) return false;
      if (priFilter !== "TODAS" && s.prioridade !== priFilter) return false;
      if (!q) return true;
      return (
        s.numero_solicitacao?.toLowerCase().includes(q) ||
        s.titulo?.toLowerCase().includes(q) ||
        (s.solicitante_nome || "").toLowerCase().includes(q) ||
        (s.local_obra || "").toLowerCase().includes(q)
      );
    });
  }, [items, busca, statusFilter, priFilter]);

  const kpis = useMemo(() => ({
    total: items.length,
    pendentes: items.filter((s) => s.status === "enviada").length,
    aprovadas: items.filter((s) => s.status === "aprovada").length,
    compradas: items.filter((s) => s.status === "comprada").length,
    recebidas: items.filter((s) => s.status === "recebida" || s.status === "recebida_parcial").length,
    urgentes: items.filter((s) => s.prioridade === "urgente" && !["cancelada","recebida","recusada"].includes(s.status)).length,
  }), [items]);

  async function loadItens(id: string) {
    const { data, error } = await supabase
      .from("solicitacoes_materiais_itens")
      .select("*")
      .eq("solicitacao_id", id)
      .order("ordem", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function handleExportPdf(s: Solicitacao) {
    try {
      const itens = await loadItens(s.id);
      // Try get empresa
      let empresaNome: string | null = null;
      let empresaCnpj: string | null = null;
      const { data: emp } = await supabase.from("empresa_config").select("nome_fantasia, cnpj").eq("empresa_id", s.empresa_id).maybeSingle();
      if (emp) { empresaNome = (emp as any).nome_fantasia; empresaCnpj = (emp as any).cnpj; }
      gerarSolicitacaoPdf({
        empresa_nome: empresaNome,
        empresa_cnpj: empresaCnpj,
        numero: s.numero_solicitacao,
        titulo: s.titulo,
        data_solicitacao: s.data_solicitacao,
        data_necessidade: s.data_necessidade,
        solicitante: s.solicitante_nome,
        setor: s.setor,
        local_obra: s.local_obra,
        prioridade: s.prioridade,
        status: STATUS_LABEL[s.status] || s.status,
        justificativa: s.justificativa,
        observacoes: s.observacoes,
        aprovador: s.aprovado_por_nome,
        itens: (itens as any[]).map((i) => ({
          tipo_item: i.tipo_item,
          nome_item: i.nome_item,
          ca: i.ca,
          unidade_medida: i.unidade_medida,
          quantidade_solicitada: Number(i.quantidade_solicitada || 0),
          quantidade_aprovada: i.quantidade_aprovada != null ? Number(i.quantidade_aprovada) : null,
          justificativa_item: i.justificativa_item,
          observacoes: i.observacoes,
        })),
      });
    } catch (e: any) {
      toast.error("Erro ao gerar PDF", { description: e.message });
    }
  }

  async function handleExportExcel(s: Solicitacao) {
    try {
      const itens = await loadItens(s.id);
      exportarSolicitacaoExcel({
        numero: s.numero_solicitacao,
        titulo: s.titulo,
        data_solicitacao: s.data_solicitacao,
        data_necessidade: s.data_necessidade,
        solicitante: s.solicitante_nome,
        setor: s.setor,
        local_obra: s.local_obra,
        prioridade: s.prioridade,
        status: STATUS_LABEL[s.status] || s.status,
        justificativa: s.justificativa,
        observacoes: s.observacoes,
        itens: (itens as any[]).map((i) => ({
          tipo_item: i.tipo_item,
          nome_item: i.nome_item,
          ca: i.ca,
          unidade_medida: i.unidade_medida,
          quantidade_solicitada: Number(i.quantidade_solicitada || 0),
          quantidade_aprovada: i.quantidade_aprovada != null ? Number(i.quantidade_aprovada) : null,
          quantidade_comprada: i.quantidade_comprada != null ? Number(i.quantidade_comprada) : null,
          quantidade_recebida: i.quantidade_recebida != null ? Number(i.quantidade_recebida) : null,
          justificativa_item: i.justificativa_item,
          observacoes: i.observacoes,
        })),
      });
    } catch (e: any) {
      toast.error("Erro ao gerar Excel", { description: e.message });
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    const { error } = await supabase.from("solicitacoes_materiais").delete().eq("id", confirmDelete.id);
    if (error) toast.error("Erro ao excluir", { description: error.message });
    else { toast.success("Solicitação excluída"); load(); }
    setConfirmDelete(null);
  }

  async function marcarComprada(s: Solicitacao) {
    const { error } = await supabase.from("solicitacoes_materiais")
      .update({ status: "comprada", comprada_em: new Date().toISOString() })
      .eq("id", s.id);
    if (error) toast.error(error.message);
    else { toast.success("Marcada como comprada"); load(); }
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-full">
      <PageHeader
        title="Solicitação de Materiais"
        subtitle="Solicite EPIs, EPCs e materiais de segurança para compra e controle de recebimento."
        actions={
          <Button onClick={() => { setEditingId(null); setFormOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Solicitação
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {[
          { label: "Total", value: kpis.total, tone: "neutral" as StatusTone },
          { label: "Pendentes", value: kpis.pendentes, tone: "info" as StatusTone },
          { label: "Aprovadas", value: kpis.aprovadas, tone: "success" as StatusTone },
          { label: "Compradas", value: kpis.compradas, tone: "pending" as StatusTone },
          { label: "Recebidas", value: kpis.recebidas, tone: "success" as StatusTone },
          { label: "Urgentes", value: kpis.urgentes, tone: "critical" as StatusTone },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-3">
              <div className="text-[11px] uppercase text-muted-foreground tracking-wide">{k.label}</div>
              <div className="text-2xl font-bold mt-1">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-3 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar número, título, solicitante, obra..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os status</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priFilter} onValueChange={setPriFilter}>
            <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas prioridades</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Lista */}
      {loading ? (
        <ListSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma solicitação encontrada"
          description="Crie sua primeira solicitação de materiais de segurança."
          action={<Button onClick={() => { setEditingId(null); setFormOpen(true); }} className="gap-2"><Plus className="w-4 h-4" /> Nova Solicitação</Button>}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2">Nº</th>
                      <th className="text-left px-3 py-2">Título</th>
                      <th className="text-left px-3 py-2">Data</th>
                      <th className="text-left px-3 py-2">Solicitante</th>
                      <th className="text-left px-3 py-2">Obra/Local</th>
                      <th className="text-left px-3 py-2">Prioridade</th>
                      <th className="text-left px-3 py-2">Status</th>
                      <th className="text-right px-3 py-2">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr key={s.id} className="border-t hover:bg-muted/20">
                        <td className="px-3 py-2 font-mono text-xs">{s.numero_solicitacao}</td>
                        <td className="px-3 py-2">{s.titulo}</td>
                        <td className="px-3 py-2 text-xs">{new Date(s.data_solicitacao + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                        <td className="px-3 py-2 text-xs">{s.solicitante_nome || "-"}</td>
                        <td className="px-3 py-2 text-xs">{s.local_obra || "-"}</td>
                        <td className="px-3 py-2"><StatusBadge tone={PRI_TONE[s.prioridade] || "neutral"} size="sm">{s.prioridade}</StatusBadge></td>
                        <td className="px-3 py-2"><StatusBadge tone={STATUS_TONE[s.status] || "neutral"} size="sm">{STATUS_LABEL[s.status] || s.status}</StatusBadge></td>
                        <td className="px-3 py-2">
                          <RowActions
                            s={s}
                            canApprove={canApprove}
                            onEdit={() => { setEditingId(s.id); setFormOpen(true); }}
                            onDelete={() => setConfirmDelete(s)}
                            onApprove={() => setAprovOpen(s.id)}
                            onReceive={() => setRecebOpen(s.id)}
                            onBuy={() => marcarComprada(s)}
                            onPdf={() => handleExportPdf(s)}
                            onXlsx={() => handleExportExcel(s)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-[10px] text-muted-foreground">{s.numero_solicitacao}</div>
                      <div className="font-semibold text-sm truncate">{s.titulo}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {s.solicitante_nome || "-"} • {new Date(s.data_solicitacao + "T00:00:00").toLocaleDateString("pt-BR")}
                      </div>
                      {s.local_obra && <div className="text-xs text-muted-foreground truncate">📍 {s.local_obra}</div>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    <StatusBadge tone={PRI_TONE[s.prioridade] || "neutral"} size="sm">{s.prioridade}</StatusBadge>
                    <StatusBadge tone={STATUS_TONE[s.status] || "neutral"} size="sm">{STATUS_LABEL[s.status] || s.status}</StatusBadge>
                  </div>
                  <RowActions
                    s={s}
                    mobile
                    canApprove={canApprove}
                    onEdit={() => { setEditingId(s.id); setFormOpen(true); }}
                    onDelete={() => setConfirmDelete(s)}
                    onApprove={() => setAprovOpen(s.id)}
                    onReceive={() => setRecebOpen(s.id)}
                    onBuy={() => marcarComprada(s)}
                    onPdf={() => handleExportPdf(s)}
                    onXlsx={() => handleExportExcel(s)}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <SolicitacaoMaterialFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        solicitacaoId={editingId}
        onSaved={() => { setFormOpen(false); load(); }}
      />
      <SolicitacaoAprovacaoDialog
        open={!!aprovOpen}
        onOpenChange={(v) => !v && setAprovOpen(null)}
        solicitacaoId={aprovOpen}
        onDone={() => { setAprovOpen(null); load(); }}
      />
      <SolicitacaoRecebimentoDialog
        open={!!recebOpen}
        onOpenChange={(v) => !v && setRecebOpen(null)}
        solicitacaoId={recebOpen}
        onDone={() => { setRecebOpen(null); load(); }}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir solicitação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação excluirá permanentemente a solicitação <strong>{confirmDelete?.numero_solicitacao}</strong> e todos os seus itens. Isto não pode ser desfeito.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RowActions({
  s, canApprove, mobile,
  onEdit, onDelete, onApprove, onReceive, onBuy, onPdf, onXlsx,
}: {
  s: Solicitacao;
  canApprove: boolean;
  mobile?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onApprove: () => void;
  onReceive: () => void;
  onBuy: () => void;
  onPdf: () => void;
  onXlsx: () => void;
}) {
  const canEdit = ["rascunho", "enviada"].includes(s.status);
  const canApproveNow = canApprove && s.status === "enviada";
  const canBuyNow = s.status === "aprovada";
  const canReceiveNow = ["aprovada", "comprada", "recebida_parcial"].includes(s.status);
  return (
    <div className={`flex ${mobile ? "flex-wrap" : "justify-end"} gap-1`}>
      <Button size="sm" variant="ghost" onClick={onEdit} disabled={!canEdit} title="Editar"><Pencil className="w-4 h-4" /></Button>
      {canApproveNow && <Button size="sm" variant="outline" onClick={onApprove} className="gap-1 text-success"><CheckCircle2 className="w-4 h-4" />{mobile && "Aprovar"}</Button>}
      {canBuyNow && <Button size="sm" variant="outline" onClick={onBuy} className="gap-1" title="Marcar como comprada"><ShoppingCart className="w-4 h-4" />{mobile && "Comprada"}</Button>}
      {canReceiveNow && <Button size="sm" variant="outline" onClick={onReceive} className="gap-1" title="Registrar recebimento"><PackageCheck className="w-4 h-4" />{mobile && "Receber"}</Button>}
      <Button size="sm" variant="ghost" onClick={onPdf} title="Exportar PDF"><FileDown className="w-4 h-4" /></Button>
      <Button size="sm" variant="ghost" onClick={onXlsx} title="Exportar Excel"><FileSpreadsheet className="w-4 h-4" /></Button>
      <Button size="sm" variant="ghost" onClick={onDelete} title="Excluir" className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
    </div>
  );
}
