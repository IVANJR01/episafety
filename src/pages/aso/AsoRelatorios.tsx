import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, FileText, Download } from "lucide-react";
import { differenceInDays, format, parseISO } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const RELATORIOS = [
  { v: "emitidos", l: "ASOs emitidos por período" },
  { v: "vencidos", l: "ASOs vencidos" },
  { v: "vencendo", l: "ASOs vencendo em 30 dias" },
  { v: "por_tipo", l: "ASOs por tipo de exame" },
  { v: "por_setor", l: "ASOs por setor" },
  { v: "sem_aso", l: "Funcionários ativos sem ASO" },
];

const TIPO: Record<string, string> = {
  admissional: "Admissional", periodico: "Periódico", retorno: "Retorno",
  mudanca_risco: "Mudança de Risco", demissional: "Demissional",
};

export default function AsoRelatorios() {
  const { empresaScopeIds, empresaId } = useAuth();
  const [tipoRel, setTipoRel] = useState("emitidos");
  const [from, setFrom] = useState(format(new Date(Date.now() - 90 * 86400000), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [empresaSel, setEmpresaSel] = useState<string>(empresaId || "all");

  const scopeKey = (empresaScopeIds || []).join(",");

  const { data: empresas = [] } = useQuery({
    queryKey: ["aso-rel-empresas", scopeKey],
    queryFn: async () => {
      let q = supabase.from("empresa_config").select("id, nome").order("nome");
      const ids = (empresaScopeIds || []);
      if (ids.length > 0) q = q.in("id", ids);
      return (await q).data || [];
    },
  });

  const { data: asos = [] } = useQuery({
    queryKey: ["aso-rel-data", scopeKey],
    queryFn: async () => {
      let q = supabase.from("asos").select(`*, funcionarios:funcionario_id (nome, cpf, cargo, setor), empresa_config:empresa_id (nome)`);
      const ids = (empresaScopeIds || []);
      if (ids.length > 0) q = q.in("empresa_id", ids);
      return (await q).data || [];
    },
  });

  const { data: funcs = [] } = useQuery({
    queryKey: ["aso-rel-funcs", scopeKey],
    queryFn: async () => {
      let q = supabase.from("funcionarios").select("id, nome, cpf, cargo, setor, empresa_id, ativo, empresa_config:empresa_id (nome)");
      const ids = (empresaScopeIds || []);
      if (ids.length > 0) q = q.in("empresa_id", ids);
      return (await q).data || [];
    },
  });

  const dados = useMemo(() => {
    // FILTRO EXTRA DE SEGURANÇA NO FRONTEND
    const empScope = (a: any) => {
      if (empresaSel !== "all" && a.empresa_id !== empresaSel) return false;
      if (empresaScopeIds && empresaScopeIds.length > 0) {
        return empresaScopeIds.includes(a.empresa_id);
      }
      return true;
    };
    
    const today = new Date();
    let ativos = asos.filter((a: any) => a.status !== "cancelado" && empScope(a));

    if (tipoRel === "emitidos") {
      return ativos.filter((a: any) => a.data_emissao >= from && a.data_emissao <= to);
    }
    if (tipoRel === "vencidos") {
      return ativos.filter((a: any) => a.data_vencimento && differenceInDays(parseISO(a.data_vencimento), today) < 0);
    }
    if (tipoRel === "vencendo") {
      return ativos.filter((a: any) => {
        if (!a.data_vencimento) return false;
        const d = differenceInDays(parseISO(a.data_vencimento), today);
        return d >= 0 && d <= 30;
      });
    }
    if (tipoRel === "por_tipo") {
      const grp = new Map<string, number>();
      ativos.forEach((a: any) => grp.set(a.tipo_exame, (grp.get(a.tipo_exame) || 0) + 1));
      return [...grp.entries()].map(([k, v]) => ({ tipo: TIPO[k] || k, total: v }));
    }
    if (tipoRel === "por_setor") {
      const grp = new Map<string, number>();
      ativos.forEach((a: any) => {
        const s = a.funcionarios?.setor || "Sem setor";
        grp.set(s, (grp.get(s) || 0) + 1);
      });
      return [...grp.entries()].map(([k, v]) => ({ setor: k, total: v }));
    }
    if (tipoRel === "sem_aso") {
      const comAso = new Set(ativos.map((a: any) => a.funcionario_id));
      return funcs.filter((f: any) => {
        if (empresaSel !== "all" && f.empresa_id !== empresaSel) return false;
        if (empresaScopeIds && empresaScopeIds.length > 0 && !empresaScopeIds.includes(f.empresa_id)) return false;
        return f.ativo !== false && !comAso.has(f.id);
      });
    }
    return [];
  }, [asos, funcs, tipoRel, from, to, empresaSel, empresaScopeIds]);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(dados as any[]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
    XLSX.writeFile(wb, `ASO-${tipoRel}-${format(new Date(), "yyyyMMdd")}.xlsx`);
  };

  const exportCsv = () => {
    if (!dados.length) return;
    const cols = Object.keys((dados[0] as any));
    const csv = [cols.join(";"), ...dados.map((r: any) => cols.map((c) => JSON.stringify(r[c] ?? "")).join(";"))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `ASO-${tipoRel}.csv`; a.click();
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text(RELATORIOS.find(r => r.v === tipoRel)?.l || "Relatório ASO", 14, 14);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 20);
    if (dados.length) {
      const cols = Object.keys((dados[0] as any));
      autoTable(doc, {
        startY: 25, head: [cols],
        body: dados.map((r: any) => cols.map((c) => {
          const v = r[c];
          if (v && typeof v === "object") return v.nome || JSON.stringify(v);
          return String(v ?? "");
        })),
        styles: { fontSize: 7 }, headStyles: { fillColor: [60, 60, 60] },
      });
    }
    doc.save(`ASO-${tipoRel}.pdf`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5" />Relatórios</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div><Label>Relatório</Label>
            <Select value={tipoRel} onValueChange={setTipoRel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{RELATORIOS.map((r) => <SelectItem key={r.v} value={r.v}>{r.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Empresa</Label>
            <Select value={empresaSel} onValueChange={setEmpresaSel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {empresas.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {tipoRel === "emitidos" && (
            <>
              <div><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline">Resultados: {dados.length}</Badge>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
            <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>
            <Button size="sm" variant="outline" onClick={exportPdf}><FileText className="h-4 w-4 mr-1" />PDF</Button>
          </div>
        </div>

        <div className="border rounded-lg max-h-[500px] overflow-auto">
          <Table>
            <TableHeader><TableRow>
              {tipoRel === "por_tipo" && <><TableHead>Tipo</TableHead><TableHead>Total</TableHead></>}
              {tipoRel === "por_setor" && <><TableHead>Setor</TableHead><TableHead>Total</TableHead></>}
              {tipoRel === "sem_aso" && <><TableHead>Funcionário</TableHead><TableHead>CPF</TableHead><TableHead>Cargo</TableHead><TableHead>Empresa</TableHead></>}
              {["emitidos", "vencidos", "vencendo"].includes(tipoRel) && <>
                <TableHead>Nº</TableHead><TableHead>Funcionário</TableHead><TableHead>Empresa</TableHead>
                <TableHead>Tipo</TableHead><TableHead>Emissão</TableHead><TableHead>Vencimento</TableHead>
              </>}
            </TableRow></TableHeader>
            <TableBody>
              {dados.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Sem dados.</TableCell></TableRow>}
              {tipoRel === "por_tipo" && (dados as any[]).map((r, i) => <TableRow key={i}><TableCell>{r.tipo}</TableCell><TableCell>{r.total}</TableCell></TableRow>)}
              {tipoRel === "por_setor" && (dados as any[]).map((r, i) => <TableRow key={i}><TableCell>{r.setor}</TableCell><TableCell>{r.total}</TableCell></TableRow>)}
              {tipoRel === "sem_aso" && (dados as any[]).map((r) => (
                <TableRow key={r.id}><TableCell>{r.nome}</TableCell><TableCell className="font-mono text-xs">{r.cpf}</TableCell><TableCell>{r.cargo || "—"}</TableCell><TableCell>{r.empresa_config?.nome}</TableCell></TableRow>
              ))}
              {["emitidos", "vencidos", "vencendo"].includes(tipoRel) && (dados as any[]).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs">{a.numero_aso}</TableCell>
                  <TableCell>{a.funcionarios?.nome}</TableCell>
                  <TableCell className="text-sm">{a.empresa_config?.nome}</TableCell>
                  <TableCell>{TIPO[a.tipo_exame]}</TableCell>
                  <TableCell className="text-sm">{a.data_emissao ? format(parseISO(a.data_emissao), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell className="text-sm">{a.data_vencimento ? format(parseISO(a.data_vencimento), "dd/MM/yyyy") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
