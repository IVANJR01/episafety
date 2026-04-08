import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Pencil, Trash2, FileText, Download, Search, Users } from "lucide-react";
import { useFormDraft } from "@/hooks/useFormDraft";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { gerarPPPPdf } from "@/lib/gerarPPP";

interface RiscoCargo {
  id: string;
  cargo: string;
  tipo_risco: string;
  fator_risco: string;
  intensidade_concentracao: string | null;
  tecnica_utilizada: string | null;
  epc_eficaz: boolean;
  epi_eficaz: boolean;
  ca_epi: string | null;
  profissiografia: string | null;
  cbo: string | null;
}

interface Responsavel {
  id: string;
  tipo: string;
  nome: string;
  nit: string | null;
  registro_conselho: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
}

interface Funcionario {
  id: string;
  nome: string;
  cpf: string | null;
  cargo: string | null;
  setor: string | null;
  data_admissao: string | null;
  data_demissao: string | null;
  matricula: string | null;
}

interface EmpresaConfig {
  id: string;
  nome: string;
  cnpj: string | null;
}

const TIPO_RISCO_LABELS: Record<string, string> = {
  fisico: "Físico",
  quimico: "Químico",
  biologico: "Biológico",
  ergonomico: "Ergonômico",
  acidente: "Acidente",
};

const TIPO_RISCO_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  fisico: "default",
  quimico: "destructive",
  biologico: "secondary",
  ergonomico: "outline",
  acidente: "destructive",
};

const emptyRiscoForm = {
  cargo: "",
  tipo_risco: "fisico",
  fator_risco: "",
  intensidade_concentracao: "",
  tecnica_utilizada: "",
  epc_eficaz: false,
  epi_eficaz: false,
  ca_epi: "",
  profissiografia: "",
  cbo: "",
};

const emptyRespForm = {
  tipo: "engenheiro",
  nome: "",
  nit: "",
  registro_conselho: "",
  periodo_inicio: "",
  periodo_fim: "",
};

export default function CentralPPP() {
  const { empresaId } = useAuth();

  // Data
  const [riscos, setRiscos] = useState<RiscoCargo[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [empresa, setEmpresa] = useState<EmpresaConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [riscoOpen, setRiscoOpen] = useState(false);
  const [respOpen, setRespOpen] = useState(false);
  const [pppOpen, setPppOpen] = useState(false);
  const [editingRisco, setEditingRisco] = useState<RiscoCargo | null>(null);
  const [editingResp, setEditingResp] = useState<Responsavel | null>(null);

  // Forms
  const [riscoForm, setRiscoForm] = useState(emptyRiscoForm);
  const [respForm, setRespForm] = useState(emptyRespForm);
  const [selectedFuncId, setSelectedFuncId] = useState("");
  const [search, setSearch] = useState("");

  // Unique cargos from riscos
  const cargos = useMemo(() => [...new Set(riscos.map((r) => r.cargo))].sort(), [riscos]);

  useEffect(() => {
    if (empresaId) loadAll();
  }, [empresaId]);

  async function loadAll() {
    setLoading(true);
    const [rRes, respRes, fRes, eRes] = await Promise.all([
      supabase.from("ppp_riscos_cargo").select("*").order("cargo"),
      supabase.from("ppp_responsaveis").select("*").order("tipo"),
      supabase.from("funcionarios").select("id, nome, cpf, cargo, setor, data_admissao, data_demissao, matricula").order("nome"),
      supabase.from("empresa_config").select("id, nome, cnpj").eq("id", empresaId!).single(),
    ]);
    if (rRes.data) setRiscos(rRes.data as any);
    if (respRes.data) setResponsaveis(respRes.data as any);
    if (fRes.data) setFuncionarios(fRes.data as any);
    if (eRes.data) setEmpresa(eRes.data as any);
    setLoading(false);
  }

  // === RISCOS CRUD ===
  function openNewRisco() {
    setEditingRisco(null);
    setRiscoForm(emptyRiscoForm);
    setRiscoOpen(true);
  }
  function openEditRisco(r: RiscoCargo) {
    setEditingRisco(r);
    setRiscoForm({
      cargo: r.cargo,
      tipo_risco: r.tipo_risco,
      fator_risco: r.fator_risco,
      intensidade_concentracao: r.intensidade_concentracao || "",
      tecnica_utilizada: r.tecnica_utilizada || "",
      epc_eficaz: r.epc_eficaz,
      epi_eficaz: r.epi_eficaz,
      ca_epi: r.ca_epi || "",
      profissiografia: r.profissiografia || "",
      cbo: r.cbo || "",
    });
    setRiscoOpen(true);
  }

  async function saveRisco() {
    if (!riscoForm.cargo || !riscoForm.fator_risco) {
      toast.error("Preencha cargo e fator de risco");
      return;
    }
    const payload = {
      cargo: riscoForm.cargo.trim(),
      tipo_risco: riscoForm.tipo_risco as "fisico" | "quimico" | "biologico" | "ergonomico" | "acidente",
      fator_risco: riscoForm.fator_risco.trim(),
      intensidade_concentracao: riscoForm.intensidade_concentracao || null,
      tecnica_utilizada: riscoForm.tecnica_utilizada || null,
      epc_eficaz: riscoForm.epc_eficaz,
      epi_eficaz: riscoForm.epi_eficaz,
      ca_epi: riscoForm.ca_epi || null,
      profissiografia: riscoForm.profissiografia || null,
      cbo: riscoForm.cbo || null,
      empresa_id: empresaId,
    };

    if (editingRisco) {
      const { error } = await supabase.from("ppp_riscos_cargo").update(payload).eq("id", editingRisco.id);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Risco atualizado");
    } else {
      const { error } = await supabase.from("ppp_riscos_cargo").insert(payload);
      if (error) { toast.error("Erro ao cadastrar"); return; }
      toast.success("Risco cadastrado");
    }
    setRiscoOpen(false);
    loadAll();
  }

  async function deleteRisco(id: string) {
    await supabase.from("ppp_riscos_cargo").delete().eq("id", id);
    toast.success("Risco removido");
    loadAll();
  }

  // === RESPONSÁVEIS CRUD ===
  function openNewResp() {
    setEditingResp(null);
    setRespForm(emptyRespForm);
    setRespOpen(true);
  }
  function openEditResp(r: Responsavel) {
    setEditingResp(r);
    setRespForm({
      tipo: r.tipo,
      nome: r.nome,
      nit: r.nit || "",
      registro_conselho: r.registro_conselho || "",
      periodo_inicio: r.periodo_inicio || "",
      periodo_fim: r.periodo_fim || "",
    });
    setRespOpen(true);
  }

  async function saveResp() {
    if (!respForm.nome) { toast.error("Preencha o nome"); return; }
    const payload = {
      tipo: respForm.tipo,
      nome: respForm.nome.trim(),
      nit: respForm.nit || null,
      registro_conselho: respForm.registro_conselho || null,
      periodo_inicio: respForm.periodo_inicio || null,
      periodo_fim: respForm.periodo_fim || null,
      empresa_id: empresaId,
    };
    if (editingResp) {
      await supabase.from("ppp_responsaveis").update(payload).eq("id", editingResp.id);
      toast.success("Responsável atualizado");
    } else {
      await supabase.from("ppp_responsaveis").insert(payload);
      toast.success("Responsável cadastrado");
    }
    setRespOpen(false);
    loadAll();
  }

  async function deleteResp(id: string) {
    await supabase.from("ppp_responsaveis").delete().eq("id", id);
    toast.success("Removido");
    loadAll();
  }

  // === GERAR PPP ===
  function openGerarPPP() {
    setSelectedFuncId("");
    setPppOpen(true);
  }

  function gerarPPP() {
    const func = funcionarios.find((f) => f.id === selectedFuncId);
    if (!func) { toast.error("Selecione um funcionário"); return; }

    const cargoRiscos = riscos.filter((r) => r.cargo.toLowerCase() === (func.cargo || "").toLowerCase());
    const eng = responsaveis.find((r) => r.tipo === "engenheiro");
    const med = responsaveis.find((r) => r.tipo === "medico");

    const formatDate = (d: string | null) => {
      if (!d) return "";
      const parts = d.split("-");
      return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
    };

    const profissiografia = cargoRiscos.find((r) => r.profissiografia)?.profissiografia || "";
    const cbo = cargoRiscos.find((r) => r.cbo)?.cbo || "";

    const doc = gerarPPPPdf({
      cnpj: empresa?.cnpj || "",
      nomeEmpresa: empresa?.nome || "",
      cnae: "",
      nomeTrabalhador: func.nome,
      nit: "",
      dataNascimento: "",
      sexo: "",
      ctps: "",
      cpf: func.cpf || "",
      dataAdmissao: formatDate(func.data_admissao),
      dataDemissao: formatDate(func.data_demissao),
      regime: "CLT",
      cargo: func.cargo || "",
      funcao: "",
      cbo,
      setor: func.setor || "",
      profissiografia,
      riscos: cargoRiscos.map((r) => ({
        tipo: r.tipo_risco,
        fatorRisco: r.fator_risco,
        intensidade: r.intensidade_concentracao || "",
        tecnica: r.tecnica_utilizada || "",
        epcEficaz: r.epc_eficaz ? "S" : "N",
        epiEficaz: r.epi_eficaz ? "S" : "N",
        caEpi: r.ca_epi || "",
      })),
      engenheiro: eng
        ? {
            nome: eng.nome,
            nit: eng.nit || "",
            registro: eng.registro_conselho || "",
            periodo: `${formatDate(eng.periodo_inicio)} a ${formatDate(eng.periodo_fim) || "atual"}`,
          }
        : null,
      medico: med
        ? {
            nome: med.nome,
            nit: med.nit || "",
            registro: med.registro_conselho || "",
            periodo: `${formatDate(med.periodo_inicio)} a ${formatDate(med.periodo_fim) || "atual"}`,
          }
        : null,
      dataEmissao: new Date().toLocaleDateString("pt-BR"),
    });

    doc.save(`PPP_${func.nome.replace(/\s+/g, "_")}.pdf`);
    toast.success("PPP gerado com sucesso!");
    setPppOpen(false);
  }

  const filteredRiscos = riscos.filter(
    (r) =>
      r.cargo.toLowerCase().includes(search.toLowerCase()) ||
      r.fator_risco.toLowerCase().includes(search.toLowerCase())
  );

  // Group riscos by cargo
  const groupedRiscos = useMemo(() => {
    const map = new Map<string, RiscoCargo[]>();
    filteredRiscos.forEach((r) => {
      const key = r.cargo;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return map;
  }, [filteredRiscos]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Central PPP</h1>
          <p className="text-muted-foreground text-sm mt-1">Perfil Profissiográfico Previdenciário</p>
        </div>
        <Button onClick={openGerarPPP} className="gap-2">
          <Download className="w-4 h-4" />
          Gerar PPP de Desligamento
        </Button>
      </div>

      <Tabs defaultValue="riscos">
        <TabsList>
          <TabsTrigger value="riscos">Riscos por Cargo</TabsTrigger>
          <TabsTrigger value="responsaveis">Responsáveis Técnicos</TabsTrigger>
        </TabsList>

        {/* === ABA RISCOS === */}
        <TabsContent value="riscos" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cargo ou risco..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={openNewRisco} className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Risco
            </Button>
          </div>

          {groupedRiscos.size === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>Nenhum risco cadastrado. Configure os riscos por cargo para gerar o PPP automaticamente.</p>
              </CardContent>
            </Card>
          ) : (
            Array.from(groupedRiscos.entries()).map(([cargo, items]) => (
              <Card key={cargo}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{cargo}</CardTitle>
                      <CardDescription>CBO: {items[0]?.cbo || "—"} • {items.length} risco(s)</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Fator de Risco</TableHead>
                        <TableHead className="hidden md:table-cell">Intensidade</TableHead>
                        <TableHead className="hidden md:table-cell">Técnica</TableHead>
                        <TableHead className="hidden sm:table-cell">EPC</TableHead>
                        <TableHead className="hidden sm:table-cell">EPI</TableHead>
                        <TableHead className="hidden sm:table-cell">CA</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <Badge variant={TIPO_RISCO_COLORS[r.tipo_risco] || "outline"}>
                              {TIPO_RISCO_LABELS[r.tipo_risco] || r.tipo_risco}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{r.fator_risco}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs">{r.intensidade_concentracao || "—"}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs">{r.tecnica_utilizada || "—"}</TableCell>
                          <TableCell className="hidden sm:table-cell">{r.epc_eficaz ? "✓" : "—"}</TableCell>
                          <TableCell className="hidden sm:table-cell">{r.epi_eficaz ? "✓" : "—"}</TableCell>
                          <TableCell className="hidden sm:table-cell text-xs font-mono">{r.ca_epi || "—"}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              <Button size="icon" variant="ghost" onClick={() => openEditRisco(r)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => deleteRisco(r.id)}>
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* === ABA RESPONSÁVEIS === */}
        <TabsContent value="responsaveis" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openNewResp} className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Responsável
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden sm:table-cell">NIT</TableHead>
                    <TableHead className="hidden sm:table-cell">Reg. Conselho</TableHead>
                    <TableHead className="hidden md:table-cell">Período</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responsaveis.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Cadastre o Engenheiro de Segurança e o Médico do Trabalho
                      </TableCell>
                    </TableRow>
                  ) : (
                    responsaveis.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Badge variant={r.tipo === "engenheiro" ? "default" : "secondary"}>
                            {r.tipo === "engenheiro" ? "Engenheiro" : "Médico"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{r.nome}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs">{r.nit || "—"}</TableCell>
                        <TableCell className="hidden sm:table-cell text-xs">{r.registro_conselho || "—"}</TableCell>
                        <TableCell className="hidden md:table-cell text-xs">
                          {r.periodo_inicio || "—"} a {r.periodo_fim || "atual"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" onClick={() => openEditResp(r)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => deleteResp(r.id)}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* === DIALOG RISCO === */}
      <Dialog open={riscoOpen} onOpenChange={setRiscoOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRisco ? "Editar Risco" : "Novo Risco por Cargo"}</DialogTitle>
            <DialogDescription>Configure os fatores de risco extraídos do LTCAT</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cargo *</Label>
                <Input value={riscoForm.cargo} onChange={(e) => setRiscoForm({ ...riscoForm, cargo: e.target.value })} placeholder="Ex: Servente" list="cargos-list" />
                <datalist id="cargos-list">
                  {cargos.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <Label>CBO</Label>
                <Input value={riscoForm.cbo} onChange={(e) => setRiscoForm({ ...riscoForm, cbo: e.target.value })} placeholder="Ex: 717020" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Risco *</Label>
                <Select value={riscoForm.tipo_risco} onValueChange={(v) => setRiscoForm({ ...riscoForm, tipo_risco: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_RISCO_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fator de Risco *</Label>
                <Input value={riscoForm.fator_risco} onChange={(e) => setRiscoForm({ ...riscoForm, fator_risco: e.target.value })} placeholder="Ex: Ruídos" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Intensidade/Concentração</Label>
                <Input value={riscoForm.intensidade_concentracao} onChange={(e) => setRiscoForm({ ...riscoForm, intensidade_concentracao: e.target.value })} placeholder="Ex: 85 dB(A)" />
              </div>
              <div>
                <Label>Técnica Utilizada</Label>
                <Input value={riscoForm.tecnica_utilizada} onChange={(e) => setRiscoForm({ ...riscoForm, tecnica_utilizada: e.target.value })} placeholder="Ex: NHO-01" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={riscoForm.epc_eficaz} onCheckedChange={(v) => setRiscoForm({ ...riscoForm, epc_eficaz: v })} />
                <Label>EPC Eficaz</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={riscoForm.epi_eficaz} onCheckedChange={(v) => setRiscoForm({ ...riscoForm, epi_eficaz: v })} />
                <Label>EPI Eficaz</Label>
              </div>
              <div>
                <Label>CA do EPI</Label>
                <Input value={riscoForm.ca_epi} onChange={(e) => setRiscoForm({ ...riscoForm, ca_epi: e.target.value })} placeholder="Ex: 33.161" />
              </div>
            </div>
            <div>
              <Label>Profissiografia (Descrição das Atividades)</Label>
              <Textarea
                value={riscoForm.profissiografia}
                onChange={(e) => setRiscoForm({ ...riscoForm, profissiografia: e.target.value })}
                placeholder="Descreva as atividades detalhadas do cargo conforme o item 14.2 do PPP..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveRisco}>{editingRisco ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === DIALOG RESPONSÁVEL === */}
      <Dialog open={respOpen} onOpenChange={setRespOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingResp ? "Editar Responsável" : "Novo Responsável Técnico"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Tipo</Label>
              <Select value={respForm.tipo} onValueChange={(v) => setRespForm({ ...respForm, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="engenheiro">Engenheiro de Segurança</SelectItem>
                  <SelectItem value="medico">Médico do Trabalho</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome *</Label>
              <Input value={respForm.nome} onChange={(e) => setRespForm({ ...respForm, nome: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>NIT</Label>
                <Input value={respForm.nit} onChange={(e) => setRespForm({ ...respForm, nit: e.target.value })} />
              </div>
              <div>
                <Label>Registro Conselho</Label>
                <Input value={respForm.registro_conselho} onChange={(e) => setRespForm({ ...respForm, registro_conselho: e.target.value })} placeholder="Ex: CREA 14552-D" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Período Início</Label>
                <Input type="date" value={respForm.periodo_inicio} onChange={(e) => setRespForm({ ...respForm, periodo_inicio: e.target.value })} />
              </div>
              <div>
                <Label>Período Fim</Label>
                <Input type="date" value={respForm.periodo_fim} onChange={(e) => setRespForm({ ...respForm, periodo_fim: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveResp}>{editingResp ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === DIALOG GERAR PPP === */}
      <Dialog open={pppOpen} onOpenChange={setPppOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar PPP de Desligamento</DialogTitle>
            <DialogDescription>
              Selecione o funcionário. O sistema preencherá o PPP automaticamente com os riscos configurados para o cargo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Funcionário</Label>
              <Select value={selectedFuncId} onValueChange={setSelectedFuncId}>
                <SelectTrigger><SelectValue placeholder="Selecione um funcionário..." /></SelectTrigger>
                <SelectContent>
                  {funcionarios.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome} {f.cargo ? `— ${f.cargo}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedFuncId && (() => {
              const func = funcionarios.find((f) => f.id === selectedFuncId);
              if (!func) return null;
              const cargoRiscos = riscos.filter((r) => r.cargo.toLowerCase() === (func.cargo || "").toLowerCase());
              return (
                <Card className="bg-muted/50">
                  <CardContent className="p-4 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Cargo:</span> <strong>{func.cargo || "—"}</strong></div>
                      <div><span className="text-muted-foreground">CPF:</span> <strong>{func.cpf || "—"}</strong></div>
                      <div><span className="text-muted-foreground">Admissão:</span> <strong>{func.data_admissao || "—"}</strong></div>
                      <div><span className="text-muted-foreground">Demissão:</span> <strong>{func.data_demissao || "—"}</strong></div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Badge variant={cargoRiscos.length > 0 ? "default" : "destructive"}>
                        {cargoRiscos.length} risco(s) configurado(s)
                      </Badge>
                      {cargoRiscos.length === 0 && (
                        <span className="text-xs text-destructive">Configure os riscos para este cargo primeiro</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </div>
          <DialogFooter>
            <Button onClick={gerarPPP} disabled={!selectedFuncId} className="gap-2">
              <Download className="w-4 h-4" />
              Gerar e Baixar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
