import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Plus, Eye, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatBRL, formatDate } from "@/lib/orcamentoCalc";
import { StatusBadgeOrcamento } from "@/components/comercial/StatusBadgeOrcamento";
import { OrcamentoStatus, STATUS_LABEL } from "@/lib/orcamentoTypes";

type Row = {
  id: string;
  empresa_id: string;
  numero_orcamento: string;
  titulo: string;
  cliente_nome: string | null;
  data_emissao: string;
  data_validade: string | null;
  status: OrcamentoStatus;
  total: number;
};

export default function Orcamentos() {
  const { empresaId } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");

  const { data = [], isLoading } = useQuery({
    queryKey: ["orcamentos_list", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("orcamentos")
        .select("id,empresa_id,numero_orcamento,titulo,cliente_nome,data_emissao,data_validade,status,total")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Row[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("orcamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Orçamento excluído"); qc.invalidateQueries({ queryKey: ["orcamentos_list", empresaId] }); },
    onError: (e: any) => toast.error(e.message || "Erro ao excluir"),
  });

  const duplicar = useMutation({
    mutationFn: async (id: string) => {
      if (!empresaId) throw new Error("Empresa não definida");
      const { data: orig, error: e1 } = await (supabase.from as any)("orcamentos").select("*").eq("id", id).single();
      if (e1) throw e1;
      const { data: itens, error: e2 } = await (supabase.from as any)("orcamentos_itens").select("*").eq("orcamento_id", id);
      if (e2) throw e2;
      const { data: numero, error: e3 } = await (supabase as any).rpc("next_orcamento_numero", { _empresa_id: empresaId });
      if (e3) throw e3;
      const { id: _oid, created_at, updated_at, numero_orcamento, aprovado_em, recusado_em, cancelado_em, enviado_em, visualizado_em, ...rest } = orig;
      const { data: novo, error: e4 } = await (supabase.from as any)("orcamentos")
        .insert({ ...rest, numero_orcamento: numero, status: "rascunho", titulo: (orig.titulo || "") + " (cópia)" })
        .select("id").single();
      if (e4) throw e4;
      if (itens?.length) {
        const novosItens = (itens as any[]).map((it) => {
          const { id: _iid, orcamento_id, created_at, updated_at, ...r } = it;
          return { ...r, orcamento_id: novo.id, empresa_id: empresaId };
        });
        const { error: e5 } = await (supabase.from as any)("orcamentos_itens").insert(novosItens);
        if (e5) throw e5;
      }
      return novo.id;
    },
    onSuccess: (novoId) => { toast.success("Proposta duplicada"); qc.invalidateQueries({ queryKey: ["orcamentos_list", empresaId] }); nav(`/comercial/orcamentos/${novoId}`); },
    onError: (e: any) => toast.error(e.message || "Erro ao duplicar"),
  });

  const filtered = useMemo(() => {
    return data.filter((o) => {
      if (statusFiltro !== "todos" && o.status !== statusFiltro) return false;
      if (!busca) return true;
      const q = busca.toLowerCase();
      return (
        o.numero_orcamento?.toLowerCase().includes(q) ||
        o.cliente_nome?.toLowerCase().includes(q) ||
        o.titulo?.toLowerCase().includes(q)
      );
    });
  }, [data, busca, statusFiltro]);

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Orçamentos e Cotações"
        subtitle="Crie propostas comerciais, acompanhe negociações e gere PDFs profissionais."
        actions={<Button onClick={() => nav("/comercial/orcamentos/novo")}><Plus className="w-4 h-4 mr-2" />Novo orçamento</Button>}
      />

      <div className="grid gap-2 sm:grid-cols-[1fr_200px] mb-4">
        <Input placeholder="Buscar por número, cliente ou título" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {(Object.keys(STATUS_LABEL) as OrcamentoStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum orçamento encontrado"
          description="Crie sua primeira proposta comercial."
          action={<Button onClick={() => nav("/comercial/orcamentos/novo")}><Plus className="w-4 h-4 mr-2" />Novo orçamento</Button>}
        />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden md:block rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2">Nº</th>
                  <th className="text-left px-3 py-2">Cliente</th>
                  <th className="text-left px-3 py-2">Título</th>
                  <th className="text-left px-3 py-2">Emissão</th>
                  <th className="text-left px-3 py-2">Validade</th>
                  <th className="text-right px-3 py-2">Total</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-right px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{o.numero_orcamento}</td>
                    <td className="px-3 py-2">{o.cliente_nome || "—"}</td>
                    <td className="px-3 py-2 truncate max-w-[240px]">{o.titulo}</td>
                    <td className="px-3 py-2">{formatDate(o.data_emissao)}</td>
                    <td className="px-3 py-2">{formatDate(o.data_validade)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatBRL(o.total)}</td>
                    <td className="px-3 py-2"><StatusBadgeOrcamento status={o.status} validade={o.data_validade} /></td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => nav(`/comercial/orcamentos/${o.id}`)}><Eye className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => duplicar.mutate(o.id)}><Copy className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => confirm("Excluir orçamento?") && del.mutate(o.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden grid gap-3">
            {filtered.map((o) => (
              <Card key={o.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-muted-foreground">{o.numero_orcamento}</div>
                      <div className="font-semibold truncate">{o.cliente_nome || "Sem cliente"}</div>
                      <div className="text-xs text-muted-foreground truncate">{o.titulo}</div>
                    </div>
                    <StatusBadgeOrcamento status={o.status} validade={o.data_validade} />
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <div className="text-xs text-muted-foreground">Val: {formatDate(o.data_validade)}</div>
                    <div className="font-semibold">{formatBRL(o.total)}</div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => nav(`/comercial/orcamentos/${o.id}`)}>Abrir</Button>
                    <Button size="sm" variant="outline" onClick={() => duplicar.mutate(o.id)}><Copy className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="outline" onClick={() => confirm("Excluir?") && del.mutate(o.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
