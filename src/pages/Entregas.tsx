import { useState, useRef, useMemo } from "react";
import { Plus, Trash2, FileText, Search } from "lucide-react";
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

const tipoLabels: Record<string, string> = { entrega: "Entrega", troca: "Troca", devolucao: "Devolução" };
const tipoBadge: Record<string, "default" | "secondary" | "outline"> = { entrega: "default", troca: "secondary", devolucao: "outline" };

export default function Entregas() {
  const { data: entregas, loading, add, remove } = useSupabaseCrud<Entrega>("entregas", "created_at");
  const { data: funcionarios } = useSupabaseQuery<Funcionario>("funcionarios");
  const { data: epis } = useSupabaseQuery<EPI>("epis");
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [fichaOpen, setFichaOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [fichaSearch, setFichaSearch] = useState("");
  const [fichaFuncId, setFichaFuncId] = useState("");

  const sigColabRef = useRef<SignatureCanvasRef>(null);

  const [form, setForm] = useState({
    funcionario_id: "", epi_id: "", quantidade: 1,
    data: new Date().toISOString().split("T")[0],
    tipo: "entrega" as string, observacao: "",
  });

  // Search helper: match funcionario by nome, cpf, or matricula
  const matchFunc = (func: Funcionario, term: string) => {
    if (!term) return true;
    const t = term.toLowerCase();
    return (
      func.nome.toLowerCase().includes(t) ||
      (func.cpf && func.cpf.includes(t)) ||
      (func.matricula && func.matricula.toLowerCase().includes(t))
    );
  };

  // Filter entregas by search
  const filteredEntregas = useMemo(() => {
    if (!searchTerm) return entregas;
    return entregas.filter(e => {
      const func = funcionarios.find(f => f.id === e.funcionario_id);
      return func && matchFunc(func, searchTerm);
    });
  }, [entregas, funcionarios, searchTerm]);

  // Filtered funcionarios for ficha dialog
  const fichaFilteredFuncs = useMemo(() => {
    if (!fichaSearch) return funcionarios;
    return funcionarios.filter(f => matchFunc(f, fichaSearch));
  }, [funcionarios, fichaSearch]);

  // Filtered funcionarios for new movimentação dialog
  const [formFuncSearch, setFormFuncSearch] = useState("");
  const formFilteredFuncs = useMemo(() => {
    if (!formFuncSearch) return funcionarios;
    return funcionarios.filter(f => matchFunc(f, formFuncSearch));
  }, [funcionarios, formFuncSearch]);

  const handleSave = async () => {
    if (!form.funcionario_id || !form.epi_id) return;
    const status = form.tipo === "devolucao" ? "devolvido" : form.tipo === "troca" ? "trocado" : "ativo";
    await add({ ...form, status, observacao: form.observacao || null } as any);
    setOpen(false);
    setForm({ funcionario_id: "", epi_id: "", quantidade: 1, data: new Date().toISOString().split("T")[0], tipo: "entrega", observacao: "" });
    setFormFuncSearch("");
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

    // Auto-load empresa data
    const { data: empresaData } = await (supabase.from as any)("empresa_config").select("*").limit(1);
    const emp = empresaData?.[0] || {};

    const assinaturaColaborador = sigColabRef.current?.getDataURL() || null;
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
      })),
      assinaturaColaborador,
      dataAssinatura,
    });

    // Save ficha record
    await (supabase.from as any)("fichas_entrega").insert({
      funcionario_id: fichaFuncId,
      assinatura_colaborador: assinaturaColaborador,
      data_assinatura: now.toISOString(),
      entrega_ids: funcEntregas.map(e => e.id),
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
        <Input
          className="pl-9"
          placeholder="Buscar por CPF, matrícula ou nome do funcionário..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
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
                      <span className={`text-xs font-medium ${e.status === "ativo" ? "text-success" : "text-muted-foreground"}`}>
                        {e.status === "ativo" ? "Ativo" : e.status === "devolvido" ? "Devolvido" : "Trocado"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs max-w-[150px] truncate">{e.observacao || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" title="Gerar Ficha" onClick={() => openFicha(e.funcionario_id)}>
                          <FileText className="w-3.5 h-3.5" />
                        </Button>
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
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setFormFuncSearch(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Movimentação</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm({...form, tipo: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrega">📦 Entrega</SelectItem>
                  <SelectItem value="troca">🔄 Troca</SelectItem>
                  <SelectItem value="devolucao">↩️ Devolução</SelectItem>
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
                    <button
                      key={f.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                      onClick={() => { setForm({...form, funcionario_id: f.id}); setFormFuncSearch(f.nome); }}
                    >
                      <span className="font-medium">{f.nome}</span>
                      {f.cpf && <span className="text-muted-foreground ml-2">CPF: {f.cpf}</span>}
                      {f.matricula && <span className="text-muted-foreground ml-2">Mat: {f.matricula}</span>}
                    </button>
                  ))}
                </div>
              )}
              {form.funcionario_id && (
                <p className="text-xs text-muted-foreground mt-1">
                  ✓ {getName(funcionarios, form.funcionario_id)} selecionado
                </p>
              )}
            </div>
            <div>
              <Label>EPI</Label>
              <Select value={form.epi_id} onValueChange={v => setForm({...form, epi_id: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{epis.map(e => <SelectItem key={e.id} value={e.id}>{e.nome} (estoque: {e.estoque})</SelectItem>)}</SelectContent>
              </Select>
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

            {/* Funcionário search */}
            <div>
              <Label>Colaborador</Label>
              <Input
                placeholder="Buscar por CPF, matrícula ou nome..."
                value={fichaSearch}
                onChange={e => { setFichaSearch(e.target.value); setFichaFuncId(""); }}
                className="mb-2"
              />
              {fichaSearch && fichaFilteredFuncs.length > 0 && !fichaFuncId && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {fichaFilteredFuncs.map(f => (
                    <button
                      key={f.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                      onClick={() => { setFichaFuncId(f.id); setFichaSearch(f.nome); }}
                    >
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

            {/* Assinatura */}
            <SignatureCanvas ref={sigColabRef} label="Assinatura do Colaborador" height={120} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFichaOpen(false)}>Cancelar</Button>
            <Button onClick={handleGerarFicha}>
              <FileText className="w-4 h-4 mr-2" />Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
