import { useState, useRef } from "react";
import { Plus, Trash2, FileText } from "lucide-react";
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
  const [fichaFuncId, setFichaFuncId] = useState("");
  const [empresaNome, setEmpresaNome] = useState("");
  const [empresaCnpj, setEmpresaCnpj] = useState("");
  const [empresaEndereco, setEmpresaEndereco] = useState("");

  const sigColabRef = useRef<SignatureCanvasRef>(null);

  const [form, setForm] = useState({
    funcionario_id: "", epi_id: "", quantidade: 1,
    data: new Date().toISOString().split("T")[0],
    tipo: "entrega" as string, observacao: "",
  });

  const handleSave = async () => {
    if (!form.funcionario_id || !form.epi_id) return;
    const status = form.tipo === "devolucao" ? "devolvido" : form.tipo === "troca" ? "trocado" : "ativo";
    await add({ ...form, status, observacao: form.observacao || null } as any);
    setOpen(false);
    setForm({ funcionario_id: "", epi_id: "", quantidade: 1, data: new Date().toISOString().split("T")[0], tipo: "entrega", observacao: "" });
  };

  const getName = (list: { id: string; nome: string }[], id: string) => list.find(i => i.id === id)?.nome || "—";

  // Load empresa config
  const loadEmpresa = async () => {
    const { data } = await (supabase.from as any)("empresa_config").select("*").limit(1);
    if (data && data.length > 0) {
      setEmpresaNome(data[0].nome || "");
      setEmpresaCnpj(data[0].cnpj || "");
      setEmpresaEndereco(data[0].endereco || "");
    }
  };

  const openFicha = (funcId?: string) => {
    loadEmpresa();
    setFichaFuncId(funcId || "");
    setFichaOpen(true);
  };

  const handleGerarFicha = async () => {
    if (!fichaFuncId) { toast({ title: "Selecione um funcionário", variant: "destructive" }); return; }

    const func = funcionarios.find(f => f.id === fichaFuncId);
    if (!func) return;

    const funcEntregas = entregas.filter(e => e.funcionario_id === fichaFuncId);
    if (funcEntregas.length === 0) { toast({ title: "Nenhuma entrega encontrada para este funcionário", variant: "destructive" }); return; }

    const assinaturaColaborador = sigColabRef.current?.getDataURL() || null;
    const assinaturaResponsavel = sigRespRef.current?.getDataURL() || null;

    const now = new Date();
    const dataAssinatura = `${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR")}`;

    const doc = gerarFichaEPI({
      empresa: { nome: empresaNome, cnpj: empresaCnpj, endereco: empresaEndereco, logo_url: null },
      funcionario: { nome: func.nome, cargo: func.cargo, setor: func.setor, cpf: func.cpf, matricula: func.matricula, data_admissao: func.data_admissao },
      entregas: funcEntregas.map(e => ({
        data: e.data,
        quantidade: e.quantidade,
        epi_nome: epis.find(ep => ep.id === e.epi_id)?.nome || "—",
        epi_ca: epis.find(ep => ep.id === e.epi_id)?.ca || null,
        observacao: e.observacao,
      })),
      assinaturaColaborador,
      assinaturaResponsavel,
      responsavelNome,
      responsavelCargo,
      dataAssinatura,
    });

    // Save ficha record
    await (supabase.from as any)("fichas_entrega").insert({
      funcionario_id: fichaFuncId,
      assinatura_colaborador: assinaturaColaborador,
      assinatura_responsavel: assinaturaResponsavel,
      responsavel_nome: responsavelNome,
      responsavel_cargo: responsavelCargo,
      data_assinatura: now.toISOString(),
      entrega_ids: funcEntregas.map(e => e.id),
    });

    // Save empresa config
    const { data: existing } = await (supabase.from as any)("empresa_config").select("id").limit(1);
    if (existing && existing.length > 0) {
      await (supabase.from as any)("empresa_config").update({ nome: empresaNome, cnpj: empresaCnpj, endereco: empresaEndereco }).eq("id", existing[0].id);
    } else {
      await (supabase.from as any)("empresa_config").insert({ nome: empresaNome, cnpj: empresaCnpj, endereco: empresaEndereco });
    }

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
                {entregas.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma movimentação registrada</TableCell></TableRow>
                ) : entregas.map(e => (
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
      <Dialog open={open} onOpenChange={setOpen}>
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
              <Select value={form.funcionario_id} onValueChange={v => setForm({...form, funcionario_id: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{funcionarios.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
              </Select>
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
            {/* Empresa */}
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <h3 className="text-sm font-semibold">Dados da Empresa</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Nome da Empresa</Label><Input value={empresaNome} onChange={e => setEmpresaNome(e.target.value)} placeholder="Nome da empresa" /></div>
                <div><Label className="text-xs">CNPJ</Label><Input value={empresaCnpj} onChange={e => setEmpresaCnpj(e.target.value)} placeholder="00.000.000/0000-00" /></div>
              </div>
              <div><Label className="text-xs">Endereço</Label><Input value={empresaEndereco} onChange={e => setEmpresaEndereco(e.target.value)} placeholder="Endereço completo" /></div>
            </div>

            {/* Funcionário */}
            <div>
              <Label>Colaborador</Label>
              <Select value={fichaFuncId} onValueChange={setFichaFuncId}>
                <SelectTrigger><SelectValue placeholder="Selecione o colaborador..." /></SelectTrigger>
                <SelectContent>{funcionarios.map(f => <SelectItem key={f.id} value={f.id}>{f.nome} — {f.cargo || "Sem cargo"}</SelectItem>)}</SelectContent>
              </Select>
              {fichaFuncId && (
                <p className="text-xs text-muted-foreground mt-1">
                  {entregas.filter(e => e.funcionario_id === fichaFuncId).length} entrega(s) encontrada(s)
                </p>
              )}
            </div>

            {/* Responsável */}
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <h3 className="text-sm font-semibold">Responsável pela Entrega</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Nome</Label><Input value={responsavelNome} onChange={e => setResponsavelNome(e.target.value)} placeholder="Nome do responsável" /></div>
                <div><Label className="text-xs">Cargo</Label><Input value={responsavelCargo} onChange={e => setResponsavelCargo(e.target.value)} placeholder="Cargo/Função" /></div>
              </div>
            </div>

            {/* Assinaturas */}
            <div className="grid gap-4 sm:grid-cols-2">
              <SignatureCanvas ref={sigColabRef} label="Assinatura do Colaborador" height={120} />
              <SignatureCanvas ref={sigRespRef} label="Assinatura do Responsável" height={120} />
            </div>
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
