import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Eye, FileDown, Printer, Search, LogOut, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { differenceInDays, parseISO, format } from "date-fns";
import { gerarPdfAsoBlob } from "@/lib/asoPdf";

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

function maskCpf(cpf?: string | null) {
  if (!cpf) return "—";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
}

async function logAcao(opts: { empresa_id: string; aso_id: string; funcionario_id?: string | null; usuario_id?: string | null; acao: "visualizou_aso" | "baixou_pdf" | "imprimiu_aso" }) {
  try {
    await (supabase.from as any)("aso_download_logs").insert({
      empresa_id: opts.empresa_id,
      aso_id: opts.aso_id,
      funcionario_id: opts.funcionario_id ?? null,
      usuario_id: opts.usuario_id ?? null,
      perfil_usuario: "rh",
      acao: opts.acao,
      user_agent: navigator.userAgent.slice(0, 500),
    });
  } catch { /* silent */ }
}

function slugify(s: string) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "").trim().replace(/\s+/g, "-").toUpperCase();
}

export default function PortalRH() {
  const { user, signOut, empresaScopeIds } = useAuth();
  const [filter, setFilter] = useState("");
  const [tipo, setTipo] = useState<string>("all");
  const [valid, setValid] = useState<string>("all");
  const [setor, setSetor] = useState<string>("all");
  const [funcao, setFuncao] = useState<string>("all");
  const [previewBlob, setPreviewBlob] = useState<{ url: string; nome: string; aso: any } | null>(null);

  const { data: asos = [], isLoading } = useQuery({
    queryKey: ["portal-rh-asos", empresaScopeIds.join(",")],
    queryFn: async () => {
      let q = supabase
        .from("asos")
        .select(`*, funcionarios:funcionario_id (nome, cpf, cargo, setor, matricula), aso_medicos:medico_id (nome, crm, uf_crm)`)
        .neq("status", "cancelado")
        .order("created_at", { ascending: false });
      if (empresaScopeIds.length > 0) q = q.in("empresa_id", empresaScopeIds);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const setores = useMemo(() => Array.from(new Set(asos.map((a: any) => a.funcionarios?.setor).filter(Boolean))).sort(), [asos]);
  const funcoes = useMemo(() => Array.from(new Set(asos.map((a: any) => a.funcionarios?.cargo).filter(Boolean))).sort(), [asos]);

  const rows = useMemo(() => {
    return asos.filter((a: any) => {
      if (tipo !== "all" && a.tipo_exame !== tipo) return false;
      if (setor !== "all" && a.funcionarios?.setor !== setor) return false;
      if (funcao !== "all" && a.funcionarios?.cargo !== funcao) return false;
      const sv = statusValidade(a.data_vencimento).label.toLowerCase();
      if (valid !== "all" && sv !== valid) return false;
      if (!filter) return true;
      const f = filter.toLowerCase();
      const digits = filter.replace(/\D/g, "");
      return (
        a.funcionarios?.nome?.toLowerCase().includes(f) ||
        (digits && a.funcionarios?.cpf?.replace(/\D/g, "").includes(digits)) ||
        a.funcionarios?.matricula?.toLowerCase().includes(f)
      );
    });
  }, [asos, filter, tipo, valid, setor, funcao]);

  const stats = useMemo(() => {
    let validos = 0, vencidos = 0, vencendo = 0;
    asos.forEach((a: any) => {
      const l = statusValidade(a.data_vencimento).label;
      if (l === "Válido") validos++;
      else if (l === "Vencido") vencidos++;
      else if (l === "Vencendo") vencendo++;
    });
    return { total: asos.length, validos, vencidos, vencendo };
  }, [asos]);

  const limpar = () => { setFilter(""); setTipo("all"); setValid("all"); setSetor("all"); setFuncao("all"); };

  const buildFilename = (a: any) => {
    const nome = slugify(a.funcionarios?.nome || "FUNCIONARIO");
    const t = (TIPO[a.tipo_exame] || a.tipo_exame).toUpperCase().replace(/\s+/g, "-");
    const d = a.data_emissao ? format(parseISO(a.data_emissao), "dd-MM-yyyy") : format(new Date(), "dd-MM-yyyy");
    return `ASO_${nome}_${t}_${d}.pdf`;
  };

  const baixar = async (a: any) => {
    try {
      const blob = await gerarPdfAsoBlob(a.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = buildFilename(a);
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      await logAcao({ empresa_id: a.empresa_id, aso_id: a.id, funcionario_id: a.funcionario_id, usuario_id: user?.id, acao: "baixou_pdf" });
    } catch (e: any) { toast.error("Erro ao baixar PDF: " + e.message); }
  };

  const visualizar = async (a: any) => {
    try {
      const blob = await gerarPdfAsoBlob(a.id);
      const url = URL.createObjectURL(blob);
      setPreviewBlob({ url, nome: buildFilename(a), aso: a });
      await logAcao({ empresa_id: a.empresa_id, aso_id: a.id, funcionario_id: a.funcionario_id, usuario_id: user?.id, acao: "visualizou_aso" });
    } catch (e: any) { toast.error("Erro ao abrir ASO: " + e.message); }
  };

  const imprimir = async (a: any) => {
    try {
      const blob = await gerarPdfAsoBlob(a.id);
      const url = URL.createObjectURL(blob);
      const w = window.open(url);
      if (w) setTimeout(() => { try { w.print(); } catch {} }, 800);
      await logAcao({ empresa_id: a.empresa_id, aso_id: a.id, funcionario_id: a.funcionario_id, usuario_id: user?.id, acao: "imprimiu_aso" });
    } catch (e: any) { toast.error("Erro ao imprimir: " + e.message); }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <div className="leading-tight">
              <h1 className="font-bold text-base md:text-lg">Portal RH — Consulta de ASO</h1>
              <p className="text-xs text-muted-foreground hidden md:block">Consulte e baixe ASOs emitidos da sua empresa.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={signOut} className="gap-1"><LogOut className="h-4 w-4" />Sair</Button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto p-4 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total de ASOs", value: stats.total, cls: "text-foreground" },
            { label: "Válidos", value: stats.validos, cls: "text-emerald-600" },
            { label: "Vencendo (30d)", value: stats.vencendo, cls: "text-orange-600" },
            { label: "Vencidos", value: stats.vencidos, cls: "text-destructive" },
          ].map((k) => (
            <Card key={k.label}>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">{k.label}</div>
                <div className={`text-2xl font-bold ${k.cls}`}>{k.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar por nome, CPF ou matrícula…" className="pl-8" />
              </div>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="w-[170px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {Object.entries(TIPO).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={valid} onValueChange={setValid}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="válido">Válido</SelectItem>
                  <SelectItem value="vencendo">Vencendo</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                </SelectContent>
              </Select>
              {setores.length > 0 && (
                <Select value={setor} onValueChange={setSetor}>
                  <SelectTrigger className="w-[170px]"><SelectValue placeholder="Setor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos setores</SelectItem>
                    {setores.map((s: any) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {funcoes.length > 0 && (
                <Select value={funcao} onValueChange={setFuncao}>
                  <SelectTrigger className="w-[170px]"><SelectValue placeholder="Função" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas funções</SelectItem>
                    {funcoes.map((s: any) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Button variant="outline" onClick={limpar}>Limpar filtros</Button>
            </div>

            {/* Tabela desktop */}
            <div className="rounded-lg border overflow-x-auto hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Emissão</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Médico</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>}
                  {!isLoading && rows.length === 0 && (
                    <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      {asos.length === 0 ? "Nenhum ASO encontrado para este colaborador." : "Nenhum documento encontrado com os filtros informados."}
                    </TableCell></TableRow>
                  )}
                  {rows.map((a: any) => {
                    const sv = statusValidade(a.data_vencimento);
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.funcionarios?.nome || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{maskCpf(a.funcionarios?.cpf)}</TableCell>
                        <TableCell className="text-xs">{a.funcionarios?.matricula || "—"}</TableCell>
                        <TableCell className="text-sm">{a.funcionarios?.cargo || "—"}</TableCell>
                        <TableCell className="text-sm">{a.funcionarios?.setor || "—"}</TableCell>
                        <TableCell>{TIPO[a.tipo_exame] || a.tipo_exame}</TableCell>
                        <TableCell className="text-sm">{a.data_emissao ? format(parseISO(a.data_emissao), "dd/MM/yyyy") : "—"}</TableCell>
                        <TableCell className="text-sm">{a.data_vencimento ? format(parseISO(a.data_vencimento), "dd/MM/yyyy") : "—"}</TableCell>
                        <TableCell><Badge className={sv.cls + " border-0"}>{sv.label}</Badge></TableCell>
                        <TableCell className="text-xs">{a.aso_medicos?.nome || "—"}</TableCell>
                        <TableCell className="text-right space-x-1 whitespace-nowrap">
                          <Button size="icon" variant="ghost" onClick={() => visualizar(a)} title="Visualizar"><Eye className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => baixar(a)} title="Baixar PDF" className="text-emerald-600 hover:text-emerald-700"><FileDown className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => imprimir(a)} title="Imprimir"><Printer className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Cards mobile */}
            <div className="md:hidden space-y-2">
              {isLoading && <div className="text-center py-6 text-muted-foreground text-sm">Carregando…</div>}
              {!isLoading && rows.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  {asos.length === 0 ? "Nenhum ASO encontrado." : "Nenhum documento com os filtros informados."}
                </div>
              )}
              {rows.map((a: any) => {
                const sv = statusValidade(a.data_vencimento);
                return (
                  <Card key={a.id}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{a.funcionarios?.nome}</div>
                          <div className="text-xs text-muted-foreground font-mono">{maskCpf(a.funcionarios?.cpf)}</div>
                        </div>
                        <Badge className={sv.cls + " border-0 shrink-0"}>{sv.label}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground grid grid-cols-2 gap-1">
                        <span><b>Tipo:</b> {TIPO[a.tipo_exame] || a.tipo_exame}</span>
                        <span><b>Emissão:</b> {a.data_emissao ? format(parseISO(a.data_emissao), "dd/MM/yyyy") : "—"}</span>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => visualizar(a)}><Eye className="h-3.5 w-3.5 mr-1" />Ver</Button>
                        <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => baixar(a)}><FileDown className="h-3.5 w-3.5 mr-1" />PDF</Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview Modal */}
      {previewBlob && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => { URL.revokeObjectURL(previewBlob.url); setPreviewBlob(null); }}>
          <div className="bg-card rounded-lg w-full max-w-4xl h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-3 border-b">
              <div className="font-medium truncate">{previewBlob.nome}</div>
              <div className="flex gap-2">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => baixar(previewBlob.aso)}><FileDown className="h-4 w-4 mr-1" />Baixar</Button>
                <Button size="sm" variant="outline" onClick={() => imprimir(previewBlob.aso)}><Printer className="h-4 w-4 mr-1" />Imprimir</Button>
                <Button size="icon" variant="ghost" onClick={() => { URL.revokeObjectURL(previewBlob.url); setPreviewBlob(null); }}><X className="h-4 w-4" /></Button>
              </div>
            </div>
            <iframe src={previewBlob.url} className="flex-1 w-full" title="Prévia ASO" />
          </div>
        </div>
      )}
    </div>
  );
}
