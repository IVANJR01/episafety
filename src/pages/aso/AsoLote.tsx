import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { gerarPdfAsoBlob } from "@/lib/asoPdf";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Layers, Search, Download } from "lucide-react";
import { toast } from "sonner";
import { addDays, addMonths, addYears, format } from "date-fns";

const TIPOS = [
  { v: "admissional", l: "Admissional" }, { v: "periodico", l: "Periódico" },
  { v: "retorno", l: "Retorno" }, { v: "mudanca_risco", l: "Mudança de Risco" }, { v: "demissional", l: "Demissional" },
];

export default function AsoLote() {
  const { empresaId, empresaScopeIds, isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [empresaSel, setEmpresaSel] = useState(empresaId || "");
  useEffect(() => { setEmpresaSel(empresaId || ""); setSelected(new Set()); }, [empresaId]);
  const [filter, setFilter] = useState("");
  const [setor, setSetor] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tipo, setTipo] = useState("periodico");
  const [validade, setValidade] = useState("1ano");
  const [medicoId, setMedicoId] = useState("");
  const [emissao, setEmissao] = useState(format(new Date(), "yyyy-MM-dd"));
  const [local, setLocal] = useState("");
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);

  const { data: empresas = [] } = useQuery({
    queryKey: ["aso-lote-empresas", empresaScopeIds.join(",")],
    queryFn: async () => {
      let q = supabase.from("empresa_config").select("id, nome").order("nome");
      if (isSuperAdmin && empresaScopeIds.length > 0) q = q.in("id", empresaScopeIds);
      return (await q).data || [];
    },
  });
  const { data: funcs = [] } = useQuery({
    queryKey: ["aso-lote-funcs", empresaSel],
    enabled: !!empresaSel,
    queryFn: async () => (await supabase.from("funcionarios").select("id, nome, cpf, cargo, setor, data_demissao").eq("empresa_id", empresaSel).order("nome")).data || [],
  });
  const { data: medicos = [] } = useQuery({
    queryKey: ["aso-lote-medicos", empresaSel],
    enabled: !!empresaSel,
    queryFn: async () => (await supabase.from("aso_medicos").select("id, nome, crm, uf_crm").eq("ativo", true).eq("empresa_id", empresaSel).order("nome")).data || [],
  });

  const setores = useMemo(() => [...new Set(funcs.map((f: any) => f.setor).filter(Boolean))], [funcs]);
  const filtered = useMemo(() => funcs.filter((f: any) => {
    if (setor !== "all" && f.setor !== setor) return false;
    if (filter && !(`${f.nome} ${f.cpf}`.toLowerCase().includes(filter.toLowerCase()))) return false;
    return !f.data_demissao;
  }), [funcs, filter, setor]);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected((s) => s.size === filtered.length ? new Set() : new Set(filtered.map((f: any) => f.id)));

  const calcVenc = () => {
    const base = new Date(emissao);
    if (validade === "90d") return format(addDays(base, 90), "yyyy-MM-dd");
    if (validade === "6m") return format(addMonths(base, 6), "yyyy-MM-dd");
    if (validade === "2anos") return format(addYears(base, 2), "yyyy-MM-dd");
    return format(addYears(base, 1), "yyyy-MM-dd");
  };

  const executar = async () => {
    if (!empresaSel || !medicoId || selected.size === 0) return toast.error("Selecione empresa, médico e funcionários");
    setRunning(true); setProgress(0);
    const zip = new JSZip();
    const ids = [...selected];
    const venc = calcVenc();
    const { data: { user } } = await supabase.auth.getUser();
    let ok = 0, fail = 0;

    for (let i = 0; i < ids.length; i++) {
      const fId = ids[i];
      try {
        const { data: num } = await supabase.rpc("gerar_numero_aso", { _empresa_id: empresaSel });
        const { data: aso, error } = await supabase.from("asos").insert({
          empresa_id: empresaSel, funcionario_id: fId, medico_id: medicoId,
          numero_aso: num, tipo_exame: tipo, data_emissao: emissao, data_vencimento: venc,
          validade_tipo: validade, status_aptidao: "apto", apto_cargo: true,
          local_emissao: local, status: "emitido", created_by: user?.id || null,
        }).select().single();
        if (error || !aso) throw error;
        const hash = `${aso.id.slice(0, 8)}${Date.now().toString(36)}${i}`;
        await supabase.from("aso_verificacao").insert({ aso_id: aso.id, hash });

        const pdf = await gerarPdfAsoBlob(aso.id);
        const funcNome = filtered.find((f: any) => f.id === fId)?.nome?.replace(/[^a-zA-Z0-9]/g, "_") || fId;
        zip.file(`ASO-${num}-${funcNome}.pdf`, pdf);
        ok++;
      } catch (e) { fail++; }
      setProgress(Math.round(((i + 1) / ids.length) * 100));
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `ASOs-Lote-${format(new Date(), "yyyyMMdd-HHmm")}.zip`; a.click();
    URL.revokeObjectURL(url);

    qc.invalidateQueries({ queryKey: ["asos-list"] });
    qc.invalidateQueries({ queryKey: ["aso-dashboard"] });
    toast.success(`${ok} ASOs emitidos${fail ? `, ${fail} falharam` : ""}`);
    setSelected(new Set()); setRunning(false);
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Layers className="h-5 w-5" />Emissão de ASO em Lote</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div><Label>Empresa *</Label>
            <Select value={empresaSel} onValueChange={setEmpresaSel}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>{empresas.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Tipo de exame *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Validade *</Label>
            <Select value={validade} onValueChange={setValidade}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="90d">90 dias</SelectItem><SelectItem value="6m">6 meses</SelectItem>
                <SelectItem value="1ano">1 ano</SelectItem><SelectItem value="2anos">2 anos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Médico responsável *</Label>
            <Select value={medicoId} onValueChange={setMedicoId}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>{medicos.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.nome} — CRM {m.crm}/{m.uf_crm}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Data emissão</Label><Input type="date" value={emissao} onChange={(e) => setEmissao(e.target.value)} /></div>
          <div className="md:col-span-3"><Label>Local da emissão</Label><Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Cidade — UF" /></div>
        </div>

        {empresaSel && (
          <>
            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar nome ou CPF…" className="pl-8" />
              </div>
              <Select value={setor} onValueChange={setSetor}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  {setores.map((s: any) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg max-h-[400px] overflow-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-10"><Checkbox checked={selected.size > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead>Nome</TableHead><TableHead>CPF</TableHead><TableHead>Função</TableHead><TableHead>Setor</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map((f: any) => (
                    <TableRow key={f.id} className="cursor-pointer" onClick={() => toggle(f.id)}>
                      <TableCell><Checkbox checked={selected.has(f.id)} /></TableCell>
                      <TableCell>{f.nome}</TableCell>
                      <TableCell className="font-mono text-xs">{f.cpf}</TableCell>
                      <TableCell className="text-sm">{f.cargo || "—"}</TableCell>
                      <TableCell className="text-sm">{f.setor || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">{selected.size} selecionado(s)</div>
              <Button onClick={executar} disabled={running || selected.size === 0 || !medicoId}>
                <Download className="h-4 w-4 mr-1" />Gerar {selected.size} ASOs (ZIP)
              </Button>
            </div>
            {running && <Progress value={progress} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}
