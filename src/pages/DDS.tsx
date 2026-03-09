import { useState, useRef } from "react";
import { useSupabaseCrud, useSupabaseQuery } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { supabase } from "@/integrations/supabase/client";
import { gerarFichaDDS } from "@/lib/gerarFichaDDS";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import SignatureCanvas, { SignatureCanvasRef } from "@/components/SignatureCanvas";
import { useToast } from "@/hooks/use-toast";
import { Plus, Eye, Trash2, FileText, Users, Calendar, Download } from "lucide-react";
import { format } from "date-fns";

interface DDS {
  id: string;
  empresa_id: string;
  data: string;
  tema: string;
  palestrante: string | null;
  local: string | null;
  duracao: string | null;
  observacao: string | null;
  created_by: string | null;
  created_at: string;
}

interface DDSParticipante {
  id: string;
  dds_id: string;
  funcionario_id: string;
  assinatura: string | null;
  empresa_id: string | null;
}

interface Funcionario {
  id: string;
  nome: string;
  matricula: string | null;
  setor: string | null;
  cargo: string | null;
}

interface Empresa {
  id: string;
  nome: string;
  cnpj: string | null;
  logo_url: string | null;
}

export default function DDS() {
  const { empresaId, modulosPermitidos, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const { data: ddsList, loading, refetch, remove } = useSupabaseCrud<DDS>("dds", "created_at");
  const { data: funcionarios } = useSupabaseQuery<Funcionario>("funcionarios", "nome");
  const { data: empresas } = useSupabaseQuery<Empresa>("empresa_config");

  const canCreate = isSuperAdmin || hasPermission(modulosPermitidos, "dds", "create");
  const canDelete = isSuperAdmin || hasPermission(modulosPermitidos, "dds", "delete");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDDS, setDetailDDS] = useState<DDS | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [tema, setTema] = useState("");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [palestrante, setPalestrante] = useState("");
  const [local, setLocal] = useState("");
  const [duracao, setDuracao] = useState("15 minutos");
  const [observacao, setObservacao] = useState("");
  const [selectedFuncionarios, setSelectedFuncionarios] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const sigRefs = useRef<Map<string, SignatureCanvasRef>>(new Map());

  const [participantes, setParticipantes] = useState<(DDSParticipante & { funcionario?: Funcionario })[]>([]);
  const [loadingParticipantes, setLoadingParticipantes] = useState(false);

  const empresa = empresas.find((e) => e.id === empresaId) || { id: "", nome: "Empresa", cnpj: null, logo_url: null };

  const resetForm = () => {
    setTema("");
    setData(new Date().toISOString().split("T")[0]);
    setPalestrante("");
    setLocal("");
    setDuracao("15 minutos");
    setObservacao("");
    setSelectedFuncionarios([]);
    sigRefs.current.clear();
  };

  const handleSave = async () => {
    if (!tema.trim()) {
      toast({ title: "Preencha o tema do DDS", variant: "destructive" });
      return;
    }
    if (selectedFuncionarios.length === 0) {
      toast({ title: "Selecione ao menos um participante", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const ddsId = crypto.randomUUID();
      const { error: ddsError } = await (supabase.from as any)("dds").insert({
        id: ddsId,
        empresa_id: empresaId,
        data,
        tema: tema.trim(),
        palestrante: palestrante.trim() || null,
        local: local.trim() || null,
        duracao: duracao.trim() || null,
        observacao: observacao.trim() || null,
      });
      if (ddsError) throw ddsError;

      const participantesData = selectedFuncionarios.map((funcId) => {
        const sigRef = sigRefs.current.get(funcId);
        const assinatura = sigRef && !sigRef.isEmpty() ? sigRef.getDataURL() : null;
        return {
          dds_id: ddsId,
          funcionario_id: funcId,
          assinatura,
          empresa_id: empresaId,
        };
      });

      const { error: partError } = await (supabase.from as any)("dds_participantes").insert(participantesData);
      if (partError) throw partError;

      toast({ title: "DDS registrado com sucesso!" });
      resetForm();
      setDialogOpen(false);
      refetch();
    } catch (err: any) {
      toast({ title: "Erro ao salvar DDS", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este DDS?")) return;
    await remove(id);
  };

  const loadParticipantes = async (ddsId: string) => {
    setLoadingParticipantes(true);
    const { data: parts } = await (supabase.from as any)("dds_participantes")
      .select("*")
      .eq("dds_id", ddsId);
    const enriched = (parts || []).map((p: DDSParticipante) => ({
      ...p,
      funcionario: funcionarios.find((f) => f.id === p.funcionario_id),
    }));
    setParticipantes(enriched);
    setLoadingParticipantes(false);
    return enriched;
  };

  const openDetail = async (dds: DDS) => {
    setDetailDDS(dds);
    setDetailOpen(true);
    await loadParticipantes(dds.id);
  };

  const handleDownloadPDF = async (dds: DDS) => {
    const parts = await loadParticipantes(dds.id);
    const doc = gerarFichaDDS({
      empresa: { nome: empresa.nome, cnpj: empresa.cnpj, logo_url: empresa.logo_url },
      data: dds.data,
      tema: dds.tema,
      palestrante: dds.palestrante,
      local: dds.local,
      duracao: dds.duracao,
      observacao: dds.observacao,
      participantes: parts.map((p: any) => ({
        nome: p.funcionario?.nome || "—",
        matricula: p.funcionario?.matricula || null,
        setor: p.funcionario?.setor || null,
        cargo: p.funcionario?.cargo || null,
        assinatura: p.assinatura,
      })),
    });
    doc.save(`DDS_${dds.tema.replace(/\s+/g, "_").substring(0, 30)}_${dds.data}.pdf`);
  };

  const toggleFuncionario = (id: string) => {
    setSelectedFuncionarios((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedFuncionarios.length === funcionarios.length) {
      setSelectedFuncionarios([]);
    } else {
      setSelectedFuncionarios(funcionarios.map((f) => f.id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">DDS - Diálogo Diário de Segurança</h1>
          <p className="text-sm text-muted-foreground">Lista de presença com assinatura digital</p>
        </div>
        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Novo DDS</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Registrar DDS</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tema *</Label>
                    <Input value={tema} onChange={(e) => setTema(e.target.value)} placeholder="Ex: Uso correto de EPIs" />
                  </div>
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Palestrante</Label>
                    <Input value={palestrante} onChange={(e) => setPalestrante(e.target.value)} placeholder="Nome do palestrante" />
                  </div>
                  <div className="space-y-2">
                    <Label>Duração</Label>
                    <Select value={duracao} onValueChange={setDuracao}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5 minutos">5 minutos</SelectItem>
                        <SelectItem value="10 minutos">10 minutos</SelectItem>
                        <SelectItem value="15 minutos">15 minutos</SelectItem>
                        <SelectItem value="20 minutos">20 minutos</SelectItem>
                        <SelectItem value="30 minutos">30 minutos</SelectItem>
                        <SelectItem value="45 minutos">45 minutos</SelectItem>
                        <SelectItem value="60 minutos">60 minutos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Local</Label>
                    <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Local do DDS" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Observação</Label>
                  <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Observações adicionais..." rows={2} />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Participantes e Assinaturas</Label>
                    <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                      {selectedFuncionarios.length === funcionarios.length ? "Desmarcar todos" : "Selecionar todos"}
                    </Button>
                  </div>

                  {funcionarios.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum funcionário cadastrado.</p>
                  )}

                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                    {funcionarios.map((func) => {
                      const selected = selectedFuncionarios.includes(func.id);
                      return (
                        <div key={func.id} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={selected}
                              onCheckedChange={() => toggleFuncionario(func.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{func.nome}</p>
                              <p className="text-xs text-muted-foreground">
                                {func.matricula && `Mat: ${func.matricula}`}
                                {func.setor && ` • ${func.setor}`}
                              </p>
                            </div>
                          </div>
                          {selected && (
                            <SignatureCanvas
                              label="Assinatura"
                              height={100}
                              ref={(el) => {
                                if (el) sigRefs.current.set(func.id, el);
                                else sigRefs.current.delete(func.id);
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Salvando..." : "Salvar DDS"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <FileText className="w-4 h-4" />
              <span className="text-xs">Total DDS</span>
            </div>
            <p className="text-2xl font-bold">{ddsList.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="w-4 h-4" />
              <span className="text-xs">Este mês</span>
            </div>
            <p className="text-2xl font-bold">
              {ddsList.filter((d) => {
                const now = new Date();
                const dDate = new Date(d.data);
                return dDate.getMonth() === now.getMonth() && dDate.getFullYear() === now.getFullYear();
              }).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : ddsList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum DDS registrado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tema</TableHead>
                  <TableHead className="hidden sm:table-cell">Palestrante</TableHead>
                  <TableHead className="hidden sm:table-cell">Duração</TableHead>
                  <TableHead className="hidden md:table-cell">Local</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ddsList.map((dds) => (
                  <TableRow key={dds.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(dds.data + "T00:00:00"), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{dds.tema}</TableCell>
                    <TableCell className="hidden sm:table-cell">{dds.palestrante || "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell">{dds.duracao || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell">{dds.local || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openDetail(dds)} title="Ver detalhes">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDownloadPDF(dds)} title="Baixar PDF">
                          <Download className="w-4 h-4" />
                        </Button>
                        {canDelete && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(dds.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do DDS</DialogTitle>
          </DialogHeader>
          {detailDDS && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Data:</span> <strong>{format(new Date(detailDDS.data + "T00:00:00"), "dd/MM/yyyy")}</strong></div>
                <div><span className="text-muted-foreground">Duração:</span> <strong>{detailDDS.duracao || "—"}</strong></div>
                <div className="col-span-2"><span className="text-muted-foreground">Tema:</span> <strong>{detailDDS.tema}</strong></div>
                <div><span className="text-muted-foreground">Palestrante:</span> <strong>{detailDDS.palestrante || "—"}</strong></div>
                <div><span className="text-muted-foreground">Local:</span> <strong>{detailDDS.local || "—"}</strong></div>
                {detailDDS.observacao && (
                  <div className="col-span-2"><span className="text-muted-foreground">Observação:</span> <strong>{detailDDS.observacao}</strong></div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4" /> Participantes ({participantes.length})
                  </h3>
                  <Button size="sm" variant="outline" onClick={() => handleDownloadPDF(detailDDS)}>
                    <Download className="w-4 h-4 mr-2" /> Baixar PDF
                  </Button>
                </div>
                {loadingParticipantes ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {participantes.map((p) => (
                      <div key={p.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{p.funcionario?.nome || "—"}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.funcionario?.matricula && `Mat: ${p.funcionario.matricula}`}
                              {p.funcionario?.setor && ` • ${p.funcionario.setor}`}
                            </p>
                          </div>
                          <div className="shrink-0">
                            {p.assinatura ? (
                              <div className="border rounded bg-background p-1 w-[120px]">
                                <img src={p.assinatura} alt="Assinatura" className="h-10 w-full object-contain" />
                              </div>
                            ) : (
                              <Badge variant="secondary">Sem assinatura</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
