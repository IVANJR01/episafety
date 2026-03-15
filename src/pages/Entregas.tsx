import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useFormDraft } from "@/hooks/useFormDraft";
import { Plus, Trash2, FileText, Search, Loader2, PenLine, CheckCircle2, AlertCircle, Fingerprint, ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useSupabaseCrud, useSupabaseQuery } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { isOnline, addToSyncQueue, getCachedData, setCachedData } from "@/lib/offlineStorage";
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

interface Entrega { id: string; funcionario_id: string; epi_id: string; quantidade: number; data: string; tipo: string; observacao: string | null; status: string; created_at: string; assinatura_colaborador: string | null; }
interface Funcionario { id: string; nome: string; cargo: string | null; setor: string | null; cpf: string | null; matricula: string | null; data_admissao: string | null; }
interface EPI { id: string; nome: string; estoque: number; ca: string | null; descricao: string | null; validade: string | null; }
interface EpiItem { epi: EPI; quantidade: number; }

const tipoLabels: Record<string, string> = { entrega: "Entrega", substituicao: "Substituição", perda: "Perda", dano: "Dano" };
const tipoBadge: Record<string, "default" | "secondary" | "outline" | "destructive"> = { entrega: "default", substituicao: "secondary", perda: "destructive", dano: "outline" };

export default function Entregas() {
  const { data: entregas, loading, add, remove, refetch } = useSupabaseCrud<Entrega>("entregas", "created_at");
  const { data: funcionarios } = useSupabaseQuery<Funcionario>("funcionarios");
  const { data: epis } = useSupabaseQuery<EPI>("epis");
  const { toast } = useToast();
  const { canEdit, canCreate, canDelete } = usePermissions("entregas");
  const { empresaId } = useAuth();

  const [open, setOpen] = useState(false);
  const [fichaOpen, setFichaOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [fichaSearch, setFichaSearch] = useState("");
  const [fichaFuncId, setFichaFuncId] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedUnsigned, setSelectedUnsigned] = useState<string[]>([]);
  const [signMode, setSignMode] = useState<"new" | "existing">("new");
  const [signFuncId, setSignFuncId] = useState<string>("");

  const [pendingEntrega, setPendingEntrega] = useState<any>(null);
  const sigEntregaRef = useRef<SignatureCanvasRef>(null);
  const [signInputType, setSignInputType] = useState<"assinatura" | "biometria">("assinatura");

  const entregaDefaults = {
    funcionario_id: "", quantidade: 1,
    data: new Date().toISOString().split("T")[0],
    tipo: "entrega" as string, observacao: "",
  };
  const { form, setForm, resetForm, hasDraft } = useFormDraft("entregas_mov", entregaDefaults);

  const [epiCaSearch, setEpiCaSearch] = useState("");
  const [epiSearching, setEpiSearching] = useState(false);
  const [epiDropdownResults, setEpiDropdownResults] = useState<EPI[]>([]);
  const [epiList, setEpiList] = useState<EpiItem[]>([]);
  const [epiQtd, setEpiQtd] = useState(1);

  const addEpiToList = useCallback((epi: EPI) => {
    setEpiList(prev => {
      const existing = prev.find(e => e.epi.id === epi.id);
      if (existing) return prev.map(e => e.epi.id === epi.id ? { ...e, quantidade: e.quantidade + epiQtd } : e);
      return [...prev, { epi, quantidade: epiQtd }];
    });
    setEpiCaSearch("");
    setEpiDropdownResults([]);
    setEpiQtd(1);
  }, [epiQtd]);

  const removeEpiFromList = (epiId: string) => {
    setEpiList(prev => prev.filter(e => e.epi.id !== epiId));
  };

  // Auto-search locally as user types
  useEffect(() => {
    const term = epiCaSearch.trim().toLowerCase();
    if (!term || term.length < 2) {
      setEpiDropdownResults([]);
      return;
    }
    const matched = epis.filter(e =>
      e.nome.toLowerCase().includes(term) ||
      (e.descricao && e.descricao.toLowerCase().includes(term)) ||
      (e.ca && e.ca.includes(term))
    );
    setEpiDropdownResults(matched);
  }, [epiCaSearch, epis]);

  const handleSearchCA = async () => {
    if (!epiCaSearch.trim()) return;
    // If there's a local exact CA match, add directly
    const foundByCA = epis.find(e => e.ca === epiCaSearch.trim());
    if (foundByCA) {
      addEpiToList(foundByCA);
      return;
    }
    // If local results exist, don't call external API
    if (epiDropdownResults.length > 0) return;

    setEpiSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("consulta-ca", {
        body: { ca: epiCaSearch.trim() },
      });
      if (error || !data?.nome) {
        toast({ title: "C.A. não encontrado", description: "Verifique o número do C.A. e tente novamente.", variant: "destructive" });
        setEpiSearching(false);
        return;
      }
      const { data: newEpi, error: insertErr } = await (supabase.from as any)("epis").insert({
        nome: data.nome,
        ca: epiCaSearch.trim(),
        categoria: data.categoria || null,
        fabricante: data.fabricante || null,
        descricao: data.descricao || null,
        aprovado_para: data.aprovado_para || null,
        validade: data.validade || null,
        estoque: 0,
        empresa_id: empresaId,
      }).select().single();
      if (insertErr) {
        toast({ title: "Erro ao cadastrar EPI", variant: "destructive" });
      } else {
        addEpiToList(newEpi);
        toast({ title: `EPI "${data.nome}" cadastrado automaticamente via C.A.` });
      }
    } catch {
      toast({ title: "Erro na consulta do C.A.", variant: "destructive" });
    }
    setEpiSearching(false);
  };

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

  const handleSave = async () => {
    if (saving) return;
    if (!form.funcionario_id || epiList.length === 0) {
      toast({ title: "Preencha funcionário e adicione ao menos um EPI", variant: "destructive" });
      return;
    }
    setSaving(true);
    const statusMap: Record<string, string> = { entrega: "ativo", substituicao: "ativo", perda: "perdido", dano: "danificado" };
    const status = statusMap[form.tipo] || "ativo";

    if (!isOnline()) {
      const insertedIds: string[] = [];
      epiList.forEach(item => {
        const tempId = crypto.randomUUID();
        const payload = {
          id: tempId,
          funcionario_id: form.funcionario_id,
          epi_id: item.epi.id,
          quantidade: item.quantidade,
          data: form.data,
          tipo: form.tipo,
          status,
          observacao: form.observacao || null,
          empresa_id: empresaId,
        };
        addToSyncQueue({ table: "entregas", type: "insert", payload });
        insertedIds.push(tempId);
      });
      // Update cache
      const cached = getCachedData<Entrega>("entregas") || [];
      insertedIds.forEach((id, i) => {
        cached.unshift({
          id,
          funcionario_id: form.funcionario_id,
          epi_id: epiList[i].epi.id,
          quantidade: epiList[i].quantidade,
          data: form.data,
          tipo: form.tipo,
          status,
          observacao: form.observacao || null,
          created_at: new Date().toISOString(),
          assinatura_colaborador: null,
        } as Entrega);
      });
      setCachedData("entregas", cached);
      toast({ title: "Salvo offline", description: "Será sincronizado quando houver conexão." });
      setPendingEntrega({ funcionario_id: form.funcionario_id, entrega_ids: insertedIds });
      setOpen(false);
      resetForm();
      setFormFuncSearch("");
      setEpiCaSearch("");
      setEpiList([]);
      setEpiDropdownResults([]);
      setSaving(false);
      refetch();
      return;
    }

    // Parallel inserts for speed
    const results = await Promise.allSettled(
      epiList.map(item =>
        (supabase.from as any)("entregas")
          .insert({
            funcionario_id: form.funcionario_id,
            epi_id: item.epi.id,
            quantidade: item.quantidade,
            data: form.data,
            tipo: form.tipo,
            status,
            observacao: form.observacao || null,
            empresa_id: empresaId,
          })
          .select("id")
          .single()
      )
    );

    const insertedIds: string[] = [];
    const failedEpis: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled" && !r.value.error) {
        insertedIds.push(r.value.data.id);
      } else {
        failedEpis.push(epiList[i].epi.nome);
      }
    });

    if (failedEpis.length > 0) {
      toast({ title: `${failedEpis.length} EPI(s) com erro`, description: `Falha: ${failedEpis.join(", ")}. Os demais foram registrados.`, variant: "destructive" });
    }
    if (insertedIds.length === 0) {
      toast({ title: "Nenhum EPI foi registrado", variant: "destructive" });
      setSaving(false);
      return;
    }

    setPendingEntrega({
      funcionario_id: form.funcionario_id,
      entrega_ids: insertedIds,
    });

    setOpen(false);
    resetForm();
    setFormFuncSearch("");
    setEpiCaSearch("");
    setEpiList([]);
    setEpiDropdownResults([]);

    setSaving(false);
    setSignInputType("assinatura");
    setSignOpen(true);
  };

  const handleSaveSignature = async () => {
    const ids = signMode === "new" ? (pendingEntrega?.entrega_ids || []) : selectedUnsigned;
    if (ids.length === 0) return;

    let assinaturaColaborador: string | null = null;

    if (signInputType === "biometria") {
      try {
        // Try Capacitor native biometric first
        const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
        await BiometricAuth.authenticate({
          reason: "Confirme a identidade do colaborador",
          allowDeviceCredential: true,
        });
        assinaturaColaborador = "BIOMETRIA_DIGITAL";
      } catch (capError: any) {
        // Capacitor not available — try WebAuthn (Touch ID in browser)
        if (capError?.message?.includes("not implemented") || capError?.code === "PLUGIN_NOT_INSTALLED" || capError?.message?.includes("not available")) {
          try {
            if (window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) {
              const challenge = new Uint8Array(32);
              crypto.getRandomValues(challenge);
              const userId = new Uint8Array(16);
              crypto.getRandomValues(userId);
              
              await navigator.credentials.create({
                publicKey: {
                  challenge,
                  rp: { name: "EPISafety" },
                  user: { id: userId, name: "colaborador", displayName: "Colaborador" },
                  pubKeyCredParams: [{ alg: -7, type: "public-key" }],
                  authenticatorSelection: {
                    authenticatorAttachment: "platform",
                    userVerification: "required",
                  },
                  timeout: 60000,
                },
              });
              assinaturaColaborador = "BIOMETRIA_DIGITAL";
            } else {
              toast({ title: "Biometria não disponível", description: "Este dispositivo não possui sensor biométrico compatível. Use a assinatura manual.", variant: "destructive" });
              return;
            }
          } catch (webAuthErr: any) {
            if (webAuthErr?.name === "NotAllowedError") {
              toast({ title: "Biometria cancelada", description: "O colaborador cancelou a autenticação.", variant: "destructive" });
            } else {
              toast({ title: "Erro na biometria", description: "Use a assinatura manual como alternativa.", variant: "destructive" });
            }
            return;
          }
        } else {
          toast({ title: "Biometria não confirmada", description: capError?.message || "Tente novamente", variant: "destructive" });
          return;
        }
      }
    } else {
      assinaturaColaborador = sigEntregaRef.current?.getDataURL() || null;
      if (!assinaturaColaborador) {
        toast({ title: "Desenhe a assinatura antes de salvar", variant: "destructive" });
        return;
      }
    }

    // Parallel updates for speed
    await Promise.all(
      ids.map(id =>
        (supabase.from as any)("entregas")
          .update({ assinatura_colaborador: assinaturaColaborador })
          .eq("id", id)
      )
    );

    refetch();
    toast({ title: signInputType === "biometria" ? `Biometria registrada em ${ids.length} entrega(s)!` : `Assinatura salva em ${ids.length} entrega(s)!` });
    setSignOpen(false);
    setPendingEntrega(null);
    setSelectedUnsigned([]);
    setSignMode("new");
  };

  const unsignedEntregas = useMemo(() => entregas.filter(e => !e.assinatura_colaborador), [entregas]);

  const toggleUnsigned = (id: string) => {
    setSelectedUnsigned(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const openSignExisting = (funcId?: string) => {
    setSignMode("existing");
    if (funcId) {
      setSignFuncId(funcId);
      // Pre-select all unsigned for this employee
      const ids = unsignedEntregas.filter(e => e.funcionario_id === funcId).map(e => e.id);
      setSelectedUnsigned(ids);
    } else {
      setSignFuncId("");
      setSelectedUnsigned([]);
    }
    setSignOpen(true);
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

    const { data: empresaData } = await (supabase.from as any)("empresa_config").select("*").eq("id", empresaId).limit(1);
    const emp = empresaData?.[0] || {};

    const now = new Date();

    const doc = gerarFichaEPI({
      empresa: { nome: emp.nome || "", cnpj: emp.cnpj || "", endereco: emp.endereco || "", logo_url: null },
      funcionario: { nome: func.nome, cargo: func.cargo, setor: func.setor, cpf: func.cpf, matricula: func.matricula, data_admissao: func.data_admissao },
      entregas: funcEntregas.map(e => {
        const epiCa = epis.find(ep => ep.id === e.epi_id)?.ca || null;
        let dataDevolucao: string | null = null;
        if ((e.status === "substituido" || e.status === "devolvido") && epiCa) {
          const newer = funcEntregas.find(other =>
            other.id !== e.id &&
            new Date(other.created_at) > new Date(e.created_at) &&
            (other.tipo === "substituicao" || other.tipo === "devolucao") &&
            epis.find(ep => ep.id === other.epi_id)?.ca === epiCa
          );
          dataDevolucao = newer?.data || e.data;
        }
        const epiObj = epis.find(ep => ep.id === e.epi_id);
        return {
          data: e.data, created_at: e.created_at, quantidade: e.quantidade,
          epi_nome: epiObj?.nome || "—",
          epi_ca: epiCa,
          epi_descricao: epiObj?.descricao || null,
          epi_validade: epiObj?.validade || null,
          observacao: e.observacao,
          tipo: e.tipo,
          status: e.status,
          data_devolucao: dataDevolucao,
          assinatura_colaborador: e.assinatura_colaborador || null,
        };
      }),
    });

    doc.save(`Ficha_EPI_${func.nome.replace(/\s+/g, "_")}_${now.toISOString().split("T")[0]}.pdf`);
    toast({ title: "Ficha gerada com sucesso!", description: "O PDF foi baixado." });
    setFichaOpen(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Entregas de EPI</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">Entrega, troca e devolução de EPIs</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
          {canEdit && unsignedEntregas.length > 0 && (
            <Button variant="outline" onClick={() => openSignExisting()} className="flex-1 sm:flex-none text-xs sm:text-sm border-amber-500 text-amber-600 hover:bg-amber-50">
              <PenLine className="w-4 h-4 mr-1 sm:mr-2" />
              Assinar ({unsignedEntregas.length})
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" onClick={() => openFicha()} className="flex-1 sm:flex-none text-xs sm:text-sm">
              <FileText className="w-4 h-4 mr-1 sm:mr-2" />Ficha
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => setOpen(true)} className="flex-1 sm:flex-none text-xs sm:text-sm">
              <Plus className="w-4 h-4 mr-1 sm:mr-2" />Nova
            </Button>
          )}
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9 text-sm" placeholder="Buscar por CPF, matrícula ou nome..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
      ) : (
        <>
          {/* Mobile card layout */}
          <div className="space-y-3 lg:hidden">
            {filteredEntregas.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">{searchTerm ? "Nenhum resultado encontrado" : "Nenhuma movimentação registrada"}</CardContent></Card>
            ) : filteredEntregas.map(e => (
              <Card key={e.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={tipoBadge[e.tipo] || "default"} className="text-[10px]">{tipoLabels[e.tipo] || e.tipo}</Badge>
                        <span className={`text-[10px] font-medium ${e.status === "ativo" ? "text-success" : e.status === "perdido" || e.status === "danificado" ? "text-destructive" : "text-muted-foreground"}`}>
                          {e.status === "ativo" ? "Ativo" : e.status === "substituido" ? "Substituído" : e.status === "perdido" ? "Perdido" : e.status === "danificado" ? "Danificado" : e.status}
                        </span>
                        {e.assinatura_colaborador ? (
                          e.assinatura_colaborador === "BIOMETRIA_DIGITAL" ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-success font-medium"><Fingerprint className="w-3 h-3" />Biometria</span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-success font-medium"><CheckCircle2 className="w-3 h-3" />Assinado</span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500 font-medium"><AlertCircle className="w-3 h-3" />Pendente</span>
                        )}
                      </div>
                      <p className="font-semibold text-sm">{getName(funcionarios, e.funcionario_id)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{getName(epis, e.epi_id)} • {e.quantidade}x</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] text-muted-foreground font-mono">{e.data}</span>
                      <div className="flex gap-1">
                        {!e.assinatura_colaborador && canEdit && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Assinar" onClick={() => openSignExisting(e.funcionario_id)}>
                            <PenLine className="w-3 h-3 text-amber-500" />
                          </Button>
                        )}
                        {canEdit && <Button size="icon" variant="ghost" className="h-7 w-7" title="Gerar Ficha" onClick={() => openFicha(e.funcionario_id)}><FileText className="w-3 h-3" /></Button>}
                        {canDelete && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(e.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>}
                      </div>
                    </div>
                  </div>
                  {e.observacao && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{e.observacao}</p>}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden lg:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                   <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>EPI</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assinatura</TableHead>
                    <TableHead>Obs</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntregas.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">{searchTerm ? "Nenhum resultado encontrado" : "Nenhuma movimentação registrada"}</TableCell></TableRow>
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
                      <TableCell>
                        {e.assinatura_colaborador ? (
                          e.assinatura_colaborador === "BIOMETRIA_DIGITAL" ? (
                            <span className="inline-flex items-center gap-1 text-xs text-success font-medium"><Fingerprint className="w-3.5 h-3.5" />Biometria</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-success font-medium"><CheckCircle2 className="w-3.5 h-3.5" />Assinado</span>
                          )
                        ) : (
                          <Button size="sm" variant="ghost" className="text-xs text-amber-500 hover:text-amber-600 p-0 h-auto font-medium" onClick={() => openSignExisting(e.funcionario_id)}>
                            <AlertCircle className="w-3.5 h-3.5 mr-1" />Pendente
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs max-w-[150px] truncate">{e.observacao || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          {canEdit && <Button size="icon" variant="ghost" title="Gerar Ficha" onClick={() => openFicha(e.funcionario_id)}><FileText className="w-3.5 h-3.5" /></Button>}
                          {canDelete && <Button size="icon" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setFormFuncSearch(""); setEpiCaSearch(""); setEpiList([]); setEpiDropdownResults([]); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

            <div>
              <Label>EPI (buscar por C.A. ou nome)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Digite o C.A. ou nome do EPI..."
                  value={epiCaSearch}
                  onChange={e => { setEpiCaSearch(e.target.value); setEpiDropdownResults([]); }}
                  onKeyDown={e => e.key === "Enter" && handleSearchCA()}
                />
                <Input
                  type="number"
                  min={1}
                  value={epiQtd}
                  onChange={e => setEpiQtd(Math.max(1, Number(e.target.value)))}
                  className="w-20"
                  placeholder="Qtd"
                />
                <Button type="button" variant="outline" onClick={handleSearchCA} disabled={epiSearching}>
                  {epiSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              {epiDropdownResults.length > 0 && (
                <div className="mt-2 border rounded-md max-h-40 overflow-y-auto">
                  {epiDropdownResults.map(epi => (
                    <button key={epi.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                      onClick={() => addEpiToList(epi)}>
                      <span className="font-medium">{epi.nome}</span>
                      {epi.ca && <span className="text-muted-foreground ml-2">C.A.: {epi.ca}</span>}
                      <span className="text-muted-foreground ml-2">Estoque: {epi.estoque}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Lista de EPIs adicionados */}
              {epiList.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">EPIs adicionados ({epiList.length}):</p>
                  {epiList.map(item => (
                    <div key={item.epi.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{item.epi.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.epi.ca && <>C.A.: {item.epi.ca} — </>}Qtd: {item.quantidade}
                        </p>
                      </div>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => removeEpiFromList(item.epi.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} />
            </div>
            <div><Label>Observação</Label><Textarea value={form.observacao} onChange={e => setForm({...form, observacao: e.target.value})} placeholder="Observações opcionais" /></div>
          </div>
          <DialogFooter><Button onClick={handleSave} disabled={epiList.length === 0 || saving}>{saving ? "Salvando..." : `Registrar (${epiList.length} EPI${epiList.length !== 1 ? "s" : ""})`}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={signOpen} onOpenChange={v => { if (!v) { setSignOpen(false); setPendingEntrega(null); setSelectedUnsigned([]); setSignMode("new"); setSignInputType("assinatura"); } }}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {signInputType === "biometria" ? <Fingerprint className="w-5 h-5" /> : <PenLine className="w-5 h-5" />}
              {signInputType === "biometria" ? "Biometria Digital" : "Assinatura do Colaborador"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {signMode === "new" && pendingEntrega && (
              <p className="text-sm text-muted-foreground">
                Entrega registrada! O colaborador <strong>{getName(funcionarios, pendingEntrega.funcionario_id)}</strong> deve confirmar o recebimento do EPI.
              </p>
            )}
            {signMode === "existing" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Selecione o colaborador e as entregas pendentes de assinatura:</p>
                
                {/* Employee selector */}
                <div>
                  <Label className="text-xs">Colaborador</Label>
                  <Select value={signFuncId} onValueChange={v => { setSignFuncId(v); setSelectedUnsigned([]); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione o colaborador..." /></SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const funcIds = [...new Set(unsignedEntregas.map(e => e.funcionario_id))];
                        return funcIds.map(fid => {
                          const count = unsignedEntregas.filter(e => e.funcionario_id === fid).length;
                          return (
                            <SelectItem key={fid} value={fid}>
                              {getName(funcionarios, fid)} ({count} pendente{count !== 1 ? "s" : ""})
                            </SelectItem>
                          );
                        });
                      })()}
                    </SelectContent>
                  </Select>
                </div>

                {/* Entries for selected employee */}
                {signFuncId && (() => {
                  const funcUnsigned = unsignedEntregas.filter(e => e.funcionario_id === signFuncId);
                  return (
                    <>
                      <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
                        {funcUnsigned.map(e => (
                          <label key={e.id} className="flex items-center gap-3 px-3 py-2 hover:bg-accent/50 cursor-pointer text-sm">
                            <Checkbox checked={selectedUnsigned.includes(e.id)} onCheckedChange={() => toggleUnsigned(e.id)} />
                            <div className="min-w-0 flex-1">
                              <span className="font-medium">{getName(epis, e.epi_id)}</span>
                              <span className="text-muted-foreground ml-2">{e.quantidade}x • {e.data}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                      {funcUnsigned.length > 1 && (
                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => setSelectedUnsigned(prev => prev.length === funcUnsigned.length ? [] : funcUnsigned.map(e => e.id))}>
                          {selectedUnsigned.length === funcUnsigned.length ? "Desmarcar todos" : "Selecionar todos"}
                        </Button>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* Toggle: Assinatura vs Biometria */}
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
              <Button
                type="button"
                size="sm"
                variant={signInputType === "assinatura" ? "default" : "outline"}
                onClick={() => setSignInputType("assinatura")}
                className="flex-1"
              >
                <PenLine className="w-4 h-4 mr-1.5" />
                Assinatura
              </Button>
              <Button
                type="button"
                size="sm"
                variant={signInputType === "biometria" ? "default" : "outline"}
                onClick={() => setSignInputType("biometria")}
                className="flex-1"
              >
                <Fingerprint className="w-4 h-4 mr-1.5" />
                Biometria Digital
              </Button>
            </div>

            {signInputType === "assinatura" ? (
              <SignatureCanvas ref={sigEntregaRef} label="Assinatura do Colaborador" height={400} />
            ) : (
              <div className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed rounded-lg bg-muted/20 space-y-4">
                <Fingerprint className="w-16 h-16 text-primary/60 animate-pulse" />
                <div className="text-center space-y-2">
                  <p className="font-medium text-sm">Touch ID / Biometria Digital</p>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Ao clicar em "Confirmar Biometria", o sensor do aparelho será ativado para o colaborador colocar o dedo e autenticar.
                  </p>
                  <div className="flex items-center gap-1 justify-center text-xs text-primary">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Autenticação via sensor do dispositivo</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setSignOpen(false); setPendingEntrega(null); setSelectedUnsigned([]); setSignMode("new"); setSignFuncId(""); setSignInputType("assinatura"); refetch(); if (signMode === "new") toast({ title: "Entrega registrada sem assinatura." }); }}>
              {signMode === "new" ? "Pular" : "Cancelar"}
            </Button>
            <Button onClick={handleSaveSignature} disabled={signMode === "existing" && selectedUnsigned.length === 0}>
              {signInputType === "biometria" ? (
                <><Fingerprint className="w-4 h-4 mr-1.5" />Confirmar Biometria {signMode === "existing" && selectedUnsigned.length > 0 ? `(${selectedUnsigned.length})` : ""}</>
              ) : (
                <>✍️ Salvar Assinatura {signMode === "existing" && selectedUnsigned.length > 0 ? `(${selectedUnsigned.length})` : ""}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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