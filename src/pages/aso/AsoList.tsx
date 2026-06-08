import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Eye, Pencil, FileDown, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { differenceInDays, parseISO, format } from "date-fns";
import { gerarPdfAso } from "@/lib/asoPdf";

const TIPO: Record<string, string> = {
  admissional: "Admissional", periodico: "Periódico", retorno: "Retorno",
  mudanca_risco: "Mudança de Risco", demissional: "Demissional",
};

function statusValidade(dv?: string | null) {
  if (!dv) return { label: "—", cls: "bg-muted text-muted-foreground" };
  const d = differenceInDays(parseISO(dv), new Date());
  if (d < 0) return { label: "Vencido", cls: "bg-destructive/15 text-destructive" };
  if (d <= 30) return { label: "Vencendo", cls: "bg-orange-500/15 text-orange-600" };
  return { label: "Válido", cls: "bg-emerald-500/15 text-emerald-600" };
}

function aptidaoBadge(a?: string | null) {
  if (a === "apto") return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">Apto</Badge>;
  if (a === "inapto") return <Badge className="bg-destructive/15 text-destructive border-destructive/30">Inapto</Badge>;
  if (a === "apto_restricao") return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">Apto c/ restrição</Badge>;
  return <Badge variant="outline">—</Badge>;
}

import { usePermissions } from "@/hooks/usePermissions";

export default function AsoList({ onEdit }: { onEdit?: (id: string) => void }) {
  const { empresaScopeIds, isSuperAdmin } = useAuth();
  const { canEdit, canDelete } = usePermissions("aso");
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [tipo, setTipo] = useState<string>("all");
  const [valid, setValid] = useState<string>("all");

  const { data: asos = [], isLoading } = useQuery({
    queryKey: ["asos-list", empresaScopeIds.join(",")],
    queryFn: async () => {
      let q = supabase
        .from("asos")
        .select(`*, funcionarios:funcionario_id (nome, cpf, cargo, setor), aso_medicos:medico_id (nome, crm, uf_crm), empresa_config:empresa_id (nome, cnpj)`)
        .order("created_at", { ascending: false });
      
      if (empresaScopeIds.length > 0) {
        q = q.in("empresa_id", empresaScopeIds);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const rows = useMemo(() => {
    return asos.filter((a: any) => {
      if (tipo !== "all" && a.tipo_exame !== tipo) return false;
      const sv = statusValidade(a.data_vencimento).label.toLowerCase();
      if (valid !== "all" && sv !== valid) return false;
      if (!filter) return true;
      const f = filter.toLowerCase();
      return (
        a.numero_aso?.toLowerCase().includes(f) ||
        a.funcionarios?.nome?.toLowerCase().includes(f) ||
        a.funcionarios?.cpf?.includes(f) ||
        a.empresa_config?.nome?.toLowerCase().includes(f)
      );
    });
  }, [asos, filter, tipo, valid]);

  const remove = async (id: string) => {
    if (!confirm("Cancelar este ASO? Ele permanecerá no histórico como cancelado.")) return;
    const { error } = await supabase.from("asos").update({ status: "cancelado" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("ASO cancelado");
    qc.invalidateQueries({ queryKey: ["asos-list"] });
    qc.invalidateQueries({ queryKey: ["aso-dashboard"] });
  };

  const gerarPdf = async (id: string) => {
    try {
      await gerarPdfAso(id);
    } catch (e: any) {
      toast.error("Erro ao gerar PDF: " + e.message);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar por nº, nome, CPF ou empresa…" className="pl-8" />
          </div>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(TIPO).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={valid} onValueChange={setValid}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="válido">Válido</SelectItem>
              <SelectItem value="vencendo">Vencendo</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº ASO</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Aptidão</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>}
              {!isLoading && rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum ASO encontrado.</TableCell></TableRow>}
              {rows.map((a: any) => {
                const sv = statusValidade(a.data_vencimento);
                return (
                  <TableRow key={a.id} className={a.status === "cancelado" ? "opacity-50" : ""}>
                    <TableCell className="font-mono text-xs">{a.numero_aso}</TableCell>
                    <TableCell>
                      <div className="font-medium">{a.funcionarios?.nome || "—"}</div>
                      <div className="text-xs text-muted-foreground">{a.funcionarios?.cpf}</div>
                    </TableCell>
                    <TableCell className="text-sm">{a.empresa_config?.nome}</TableCell>
                    <TableCell>{TIPO[a.tipo_exame] || a.tipo_exame}</TableCell>
                    <TableCell>{aptidaoBadge(a.status_aptidao)}</TableCell>
                    <TableCell className="text-sm">{a.data_emissao ? format(parseISO(a.data_emissao), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell className="text-sm">{a.data_vencimento ? format(parseISO(a.data_vencimento), "dd/MM/yyyy") : "—"}</TableCell>
                    <TableCell>
                      {a.status === "cancelado"
                        ? <Badge variant="outline">Cancelado</Badge>
                        : <Badge className={sv.cls + " border-0"}>{sv.label}</Badge>}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => gerarPdf(a.id)} title="Gerar PDF"><FileDown className="h-4 w-4" /></Button>
                      {canEdit && <Button size="icon" variant="ghost" onClick={() => onEdit?.(a.id)} title="Editar"><Pencil className="h-4 w-4" /></Button>}
                      {canDelete && <Button size="icon" variant="ghost" onClick={() => remove(a.id)} title="Cancelar"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
