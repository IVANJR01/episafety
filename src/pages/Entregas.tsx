import { useState, useRef, useMemo } from "react";
import { Plus, Trash2, FileText, Search, Loader2 } from "lucide-react";
import { useSupabaseCrud, useSupabaseQuery } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import SignatureCanvas, { type SignatureCanvasRef } from "@/components/SignatureCanvas";
import { gerarFichaEPI } from "@/lib/gerarFichaEPI";

interface Entrega { id: string; funcionario_id: string; epi_id: string; quantidade: number; data: string; tipo: string; observacao: string | null; status: string; }
interface Funcionario { id: string; nome: string; cargo: string | null; setor: string | null; cpf: string | null; matricula: string | null; data_admissao: string | null; }
interface EPI { id: string; nome: string; estoque: number; ca: string | null; }

const tipoLabels: Record<string, string> = { entrega: "Entrega", substituicao: "Substituição", perda: "Perda", dano: "Dano" };
const tipoBadge: Record<string, "default" | "secondary" | "outline" | "destructive"> = { entrega: "default", substituicao: "secondary", perda: "destructive", dano: "outline" };

export default function Entregas() {
  const { data: entregas, loading, add, remove } = useSupabaseCrud<Entrega>("entregas", "created_at");
  const { data: funcionarios } = useSupabaseQuery<Funcionario>("funcionarios");
  const { data: epis } = useSupabaseQuery<EPI>("epis");
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [fichaOpen, setFichaOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [fichaSearch, setFichaSearch] = useState("");
  const [fichaFuncId, setFichaFuncId] = useState("");

  // Pending entrega data waiting for signature
  const [pendingEntrega, setPendingEntrega] = useState<any>(null);

  const sigColabRef = useRef<SignatureCanvasRef>(null);
  const sigEntregaRef = useRef<SignatureCanvasRef>(null);

  const [form, setForm] = useState({
    funcionario_id: "", epi_id: "", quantidade: 1,
    data: new Date().toISOString().split("T")[0],
    tipo: "entrega" as string, observacao: "",
  });

  // EPI search by CA
  const [epiCaSearch, setEpiCaSearch] = useState("");
  const [epiSearching, setEpiSearching] = useState(false);
  const [epiSearchResult, setEpiSearchResult] = useState<EPI | null>(null);

  const handleSearchCA = async () => {
    if (!epiCaSearch.trim()) return;
    setEpiSearching(true);
    setEpiSearchResult(null);
    // First check if EPI with this CA exists locally
    const found = epis.find(e => e.ca === epiCaSearch.trim());
    if (found) {
      setEpiSearchResult(found);
      setForm(f => ({ ...f, epi_id: found.id }));
      setEpiSearching(false);
      return;
    }
    // Not found locally - try consulting online and auto-register
    try {
      const { data, error } = await supabase.functions.invoke("consulta-ca", {
        body: { ca: epiCaSearch.trim() },
      });
      if (error || !data?.nome) {
        toast({ title: "C.A. não encontrado", description: "Verifique o número do C.A. e tente novamente.", variant: "destructive" });
        setEpiSearching(false);
        return;
      }
      // Auto-create EPI in the database
      const { data: newEpi, error: insertErr } = await (supabase.from as any)("epis").insert({
        nome: data.nome,
        ca: epiCaSearch.trim(),
        categoria: data.categoria || null,
        fabricante: data.fabricante || null,
        descricao: data.descricao || null,
        aprovado_para: data.aprovado_para || null,
        validade: data.validade || null,
        estoque: 0,
      }).select().single();
      if (insertErr) {
        toast({ title: "Erro ao cadastrar EPI", variant: "destructive" });
      } else {
        setEpiSearchResult(newEpi);
        setForm(f => ({ ...f, epi_id: newEpi.id }));
        toast({ title: `EPI "${data.nome}" cadastrado automaticamente via C.A.` });
      }
    } catch {
      toast({ title: "Erro na consulta do C.A.", variant: "destructive" });
    }
    setEpiSearching(false);
  };

  // Search helpers
  const matchFunc = (func: Funcionario, term: string) => {
    if (!term) return true;
    const t = term.toLowerCase();
    return func.nome.toLowerCase().includes(t) || (func.cpf && func.cpf.includes(t)) || (func.matricula && func.matricula.toLowerCase().includes(t));
  };

  const filteredEntregas = useMemo(() => {
    if (!searchTerm) return entregas;
    return entregas.filter(e => {
      const func = funcionarios.find(f => f.id === e.funcionario_id);
      return func && matchFunc(func, searchTerm);
    });
  }, [entregas, funcionarios, searchTerm]);

  const fichaFilteredFuncs = useMemo(() => {
    if (!fichaSearch) return funcionarios;
    return funcionarios.filter(f => matchFunc(f, fichaSearch));
  }, [funcionarios, fichaSearch]);

  const [formFuncSearch, setFormFuncSearch] = useState("");
  const formFilteredFuncs = useMemo(() => {
    if (!formFuncSearch) return funcionarios;
    return funcionarios.filter(f => matchFunc(f, formFuncSearch));
  }, [funcionarios, formFuncSearch]);

  // Step 1: Click "Registrar" -> save entrega, then open signature dialog
  const handleSave = async () => {
    if (!form.funcionario_id || !form.epi_id) {
      toast({ title: "Preencha funcionário e EPI", variant: "destructive" });
      return;
    }
    const statusMap: Record<string, string> = { entrega: "ativo", substituicao: "ativo", perda: "perdido", dano: "danificado" };
    const status = statusMap[form.tipo] || "ativo";
    const entregaData = { ...form, status, observacao: form.observacao || null };

    // Save the entrega
    await add(entregaData as any);

    // Store pending data for signature step
    setPendingEntrega({
      funcionario_id: form.funcionario_id,
      epi_id: form.epi_id,
    });

    setOpen(false);
    setForm({ funcionario_id: "", epi_id: "", quantidade: 1, data: new Date().toISOString().split("T")[0], tipo: "entrega", observacao: "" });
    setFormFuncSearch("");
    setEpiCaSearch("");
    setEpiSearchResult(null);

    // Open signature dialog
    setSignOpen(true);
  };

  // Step 2: After signature, generate ficha PDF
  const handleSignAndGenerate = async () => {
    if (!pendingEntrega) return;

    const func = funcionarios.find(f => f.id === pendingEntrega.funcionario_id);
    if (!func) return;

    const funcEntregas = entregas.filter(e => e.funcionario_id === pendingEntrega.funcionario_id);

    // Auto-load empresa data
    const { data: empresaData } = await (supabase.from as any)("empresa_config").select("*").limit(1);
    const emp = empresaData?.[0] || {};

    const assinaturaColaborador = sigEntregaRef.current?.getDataURL() || null;
    const now = new Date();
    const dataAssinatura = `${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR")}`;

    const doc = gerarFichaEPI({
      empresa: { nome: emp.nome || "", cnpj: emp.cnpj || "", endereco: emp.endereco || "", logo_url: null },
      funcionario: { nome: func.nome, cargo: func.cargo, setor: func.setor, cpf: func.cpf, matricula: func.matricula, data_admissao: func.data_admissao },
      entregas: funcEntregas.map(e => ({
        data: e.data,
        quantidade: e.quantidade,
        epi_nome: epis.find(ep => ep.id === e.epi_id)?.nome || "—",
        epi_ca: epis.find(ep => ep.id === e.epi_id)?.ca || null,
        observacao: e.observacao,
        tipo: e.tipo,
        status: e.status,
      })),
      assinaturaColaborador,
      dataAssinatura,
    });

    // Save ficha record
    await (supabase.from as any)("fichas_entrega").insert({
      funcionario_id: pendingEntrega.funcionario_id,
      assinatura_colaborador: assinaturaColaborador,
      data_assinatura: now.toISOString(),
      entrega_ids: funcEntregas.map(e => e.id),
    });

    doc.save(`Ficha_EPI_${func.nome.replace(/\s+/g, "_")}_${now.toISOString().split("T")[0]}.pdf`);
    toast({ title: "Entrega registrada e ficha gerada!", description: "O PDF foi baixado." });
    setSignOpen(false);
    setPendingEntrega(null);
  };

  const getName = (list: { id: string; nome: string }[], id: string) => list.find(i => i.id === id)?.nome || "—";

  const openFicha = (funcId?: string) => {
    setFichaFuncId(funcId || "");
    setFichaSearch("");
    setFichaOpen(true);
  };

  const handleGerarFicha = async () => {
    if (!fichaFuncId) { toast({ title: "Selecione um funcionário", variant: "destructive" }); return; }
    const func = funcionarios.find(f => f.id === fichaFuncId);
    if (!func) return;
    const funcEntregas = entregas.filter(e => e.funcionario_id === fichaFuncId);
    if (funcEntregas.length === 0) { toast({ title: "Nenhuma entrega encontrada para este funcionário", variant: "destructive" }); return; }

    const { data: empresaData } = await (supabase.from as any)("empresa_config").select("*").limit(1);
    const emp = empresaData?.[0] || {};
    const assinaturaColaborador = sigColabRef.current?.getDataURL() || null;
    const now = new Date();
    const dataAssinatura = `${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR")}`;

    const doc = gerarFichaEPI({
      empresa: { nome: emp.nome || "", cnpj: emp.cnpj || "", endereco: emp.endereco || "", logo_url: null },
      funcionario: { nome: func.nome, cargo: func.cargo, setor: func.setor, cpf: func.cpf, matricula: func.matricula, data_admissao: func.data_admissao },
      entregas: funcEntregas.map(e => ({
        data: e.data, quantidade: e.quantidade,
        epi_nome: epis.find(ep => ep.id === e.epi_id)?.nome || "—",
        epi_ca: epis.find(ep => ep.id === e.epi_id)?.ca || null,
        observacao: e.observacao,
      })),
      assinaturaColaborador, dataAssinatura,
    });

    await (supabase.from as any)("fichas_entrega").insert({
      funcionario_id: fichaFuncId, assinatura_colaborador: assinaturaColaborador,
      data_assinatura: now.toISOString(), entrega_ids: funcEntregas.map(e => e.id),
    });

    doc.save(`Ficha_EPI_${func.nome.replace(/\s+/g, "_")}_${now.toISOString().split("T")[0]}.pdf`);
    toast({ title: "Ficha gerada com sucesso!", description: "O PDF foi baixado." });
    setFichaOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Entregas de EPI</h1>
          <p className="text-muted-foreground text-sm mt-1">Entrega, troca e devolução de EPIs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openFicha()}>
            <FileText className="w-4 h-4 mr-2" />Gerar Ficha
          </Button>
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Nova Movimentação</Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por CPF, matrícula ou nome do funcionário..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>EPI</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Obs</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntregas.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{searchTerm ? "Nenhum resultado encontrado" : "Nenhuma movimentação registrada"}</TableCell></TableRow>
                ) : filteredEntregas.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.data}</TableCell>
                    <TableCell><Badge variant={tipoBadge[e.tipo] || "default"}>{tipoLabels[e.tipo] || e.tipo}</Badge></TableCell>
                    <TableCell className="font-medium">{getName(funcionarios, e.funcionario_id)}</TableCell>
                    <TableCell>{getName(epis, e.epi_id)}</TableCell>
                    <TableCell className="text-right">{e.quantidade}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium ${e.status === "ativo" ? "text-success" : e.status === "perdido" || e.status === "danificado" ? "text-destructive" : "text-muted-foreground"}`}>
                        {e.status === "ativo" ? "Ativo" : e.status === "substituido" ? "Substituído" : e.status === "perdido" ? "Perdido" : e.status === "danificado" ? "Danificado" : e.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs max-w-[150px] truncate">{e.observacao || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" title="Gerar Ficha" onClick={() => openFicha(e.funcionario_id)}><FileText className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Nova Movimentação Dialog */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setFormFuncSearch(""); setEpiCaSearch(""); setEpiSearchResult(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Movimentação</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm({...form, tipo: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                 <SelectContent>
                  <SelectItem value="entrega">📦 Entrega</SelectItem>
                  <SelectItem value="substituicao">🔄 Substituição</SelectItem>
                  <SelectItem value="perda">❌ Perda</SelectItem>
                  <SelectItem value="dano">⚠️ Dano</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Funcionário</Label>
              <Input
                placeholder="Buscar por CPF, matrícula ou nome..."
                value={formFuncSearch}
                onChange={e => { setFormFuncSearch(e.target.value); setForm({...form, funcionario_id: ""}); }}
                className="mb-2"
              />
              {formFuncSearch && formFilteredFuncs.length > 0 && !form.funcionario_id && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {formFilteredFuncs.map(f => (
                    <button key={f.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                      onClick={() => { setForm({...form, funcionario_id: f.id}); setFormFuncSearch(f.nome); }}>
                      <span className="font-medium">{f.nome}</span>
                      {f.cpf && <span className="text-muted-foreground ml-2">CPF: {f.cpf}</span>}
                      {f.matricula && <span className="text-muted-foreground ml-2">Mat: {f.matricula}</span>}
                    </button>
                  ))}
                </div>
              )}
              {form.funcionario_id && (
                <p className="text-xs text-muted-foreground mt-1">✓ {getName(funcionarios, form.funcionario_id)} selecionado</p>
              )}
            </div>

            {/* EPI by CA */}
            <div>
              <Label>EPI (buscar por C.A.)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Digite o número do C.A."
                  value={epiCaSearch}
                  onChange={e => { setEpiCaSearch(e.target.value); setEpiSearchResult(null); setForm(f => ({...f, epi_id: ""})); }}
                  onKeyDown={e => e.key === "Enter" && handleSearchCA()}
                />
                <Button type="button" variant="outline" onClick={handleSearchCA} disabled={epiSearching}>
                  {epiSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              {epiSearchResult && (
                <div className="mt-2 p-3 rounded-md bg-muted/50 text-sm space-y-1">
                  <p className="font-medium">✓ {epiSearchResult.nome}</p>
                  <p className="text-xs text-muted-foreground">C.A.: {epiSearchResult.ca} — Estoque: {epiSearchResult.estoque}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div><Label>Quantidade</Label><Input type="number" min={1} value={form.quantidade} onChange={e => setForm({...form, quantidade: Number(e.target.value)})} /></div>
              <div><Label>Data</Label><Input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} /></div>
            </div>
            <div><Label>Observação</Label><Textarea value={form.observacao} onChange={e => setForm({...form, observacao: e.target.value})} placeholder="Observações opcionais" /></div>
          </div>
          <DialogFooter><Button onClick={handleSave}>Registrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assinatura pós-registro Dialog */}
      <Dialog open={signOpen} onOpenChange={v => { if (!v) { setSignOpen(false); setPendingEntrega(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Assinatura do Colaborador
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Entrega registrada! O colaborador <strong>{pendingEntrega ? getName(funcionarios, pendingEntrega.funcionario_id) : ""}</strong> deve assinar abaixo para confirmar o recebimento do EPI.
            </p>
            <SignatureCanvas ref={sigEntregaRef} label="Assinatura do Colaborador" height={150} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSignOpen(false); setPendingEntrega(null); toast({ title: "Entrega registrada sem assinatura." }); }}>
              Pular
            </Button>
            <Button onClick={handleSignAndGenerate}>
              <FileText className="w-4 h-4 mr-2" />Assinar e Gerar Ficha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gerar Ficha Dialog */}
      <Dialog open={fichaOpen} onOpenChange={setFichaOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Gerar Ficha de Entrega de EPI
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-2">
            <p className="text-xs text-muted-foreground">Os dados da empresa serão carregados automaticamente das configurações do sistema.</p>
            <div>
              <Label>Colaborador</Label>
              <Input placeholder="Buscar por CPF, matrícula ou nome..." value={fichaSearch}
                onChange={e => { setFichaSearch(e.target.value); setFichaFuncId(""); }} className="mb-2" />
              {fichaSearch && fichaFilteredFuncs.length > 0 && !fichaFuncId && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {fichaFilteredFuncs.map(f => (
                    <button key={f.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                      onClick={() => { setFichaFuncId(f.id); setFichaSearch(f.nome); }}>
                      <span className="font-medium">{f.nome}</span>
                      {f.cpf && <span className="text-muted-foreground ml-2">CPF: {f.cpf}</span>}
                      {f.matricula && <span className="text-muted-foreground ml-2">Mat: {f.matricula}</span>}
                    </button>
                  ))}
                </div>
              )}
              {fichaFuncId && (
                <p className="text-xs text-muted-foreground mt-1">
                  ✓ {getName(funcionarios, fichaFuncId)} — {entregas.filter(e => e.funcionario_id === fichaFuncId).length} entrega(s) encontrada(s)
                </p>
              )}
            </div>
            <SignatureCanvas ref={sigColabRef} label="Assinatura do Colaborador" height={120} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFichaOpen(false)}>Cancelar</Button>
            <Button onClick={handleGerarFicha}><FileText className="w-4 h-4 mr-2" />Gerar PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
