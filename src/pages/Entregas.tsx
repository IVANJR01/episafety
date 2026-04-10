import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useFormDraft } from "@/hooks/useFormDraft";
import { Plus, Trash2, FileText, Search, Loader2, PenLine, CheckCircle2, AlertCircle, ScanFace, ShieldCheck, Camera, WifiOff, Undo2, RotateCcw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useSupabaseCrud, useSupabaseQuery } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { isOnline, addToSyncQueue, getCachedData, setCachedData, getSyncQueue, removeFromSyncQueue } from "@/lib/offlineStorage";
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
import FullscreenSignature from "@/components/FullscreenSignature";
import { gerarFichaEPI, preloadFotosReconhecimento } from "@/lib/gerarFichaEPI";
import CameraCapture from "@/components/CameraCapture";


interface Entrega { id: string; funcionario_id: string; epi_id: string; quantidade: number; data: string; tipo: string; observacao: string | null; status: string; created_at: string; assinatura_colaborador: string | null; foto_reconhecimento: string | null; empresa_id?: string | null; }
interface Funcionario { id: string; nome: string; cargo: string | null; setor: string | null; cpf: string | null; matricula: string | null; data_admissao: string | null; empresa_id?: string | null; }
interface EPI { id: string; nome: string; estoque: number; ca: string | null; descricao: string | null; validade: string | null; empresa_id?: string | null; source_epi_id?: string; tamanho?: string | null; }
interface EpiItem { epi: EPI; quantidade: number; }

const tipoLabels: Record<string, string> = { entrega: "Entrega", substituicao: "Substituição", perda: "Perda", dano: "Dano" };
const tipoBadge: Record<string, "default" | "secondary" | "outline" | "destructive"> = { entrega: "default", substituicao: "secondary", perda: "destructive", dano: "outline" };
const devolucaoDestinos = [
  { value: "estoque", label: "Retornar ao estoque" },
  { value: "descarte", label: "Descarte / Avaria" },
] as const;

const normalizeEntregaTipo = (value?: string | null): keyof typeof tipoLabels => {
  const normalized = (value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalized.includes("substit")) return "substituicao";
  if (normalized.includes("perda")) return "perda";
  if (normalized.includes("dano")) return "dano";
  return "entrega";
};

const parseDevolucaoAudit = (observacao?: string | null) => {
  const sourceEntregaId = observacao?.match(/Entrega origem:\s*([0-9a-f-]{36})/i)?.[1] ?? null;
  const previousStatus = observacao?.match(/Status anterior:\s*([a-z_]+)/i)?.[1] ?? null;
  const processedBy = observacao?.match(/Processado por:\s*([^•]+)/i)?.[1]?.trim() ?? null;

  return {
    sourceEntregaId,
    previousStatus,
    processedBy,
  };
};

const appendObservacao = (current: string | null | undefined, note: string) =>
  [current?.trim(), note.trim()].filter(Boolean).join(" • ");

export default function Entregas() {
  const { data: entregas, loading, add, remove, refetch } = useSupabaseCrud<Entrega>("entregas", "created_at");
  const { data: funcionarios } = useSupabaseQuery<Funcionario>("funcionarios");
  const { data: epis, refetch: refetchEpis } = useSupabaseQuery<EPI>("epis");
  const { toast } = useToast();
  const { canEdit, canCreate, canDelete } = usePermissions("entregas");
  const { user, empresaId, contratoId } = useAuth();


  const offlinePendingIds = useMemo(() => {
    const queue = getSyncQueue();
    return new Set(queue.filter(op => op.table === "entregas").map(op => op.payload?.id).filter(Boolean));
  }, [entregas]);

  const [open, setOpen] = useState(false);
  const [fichaOpen, setFichaOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [fichaSearch, setFichaSearch] = useState("");
  const [fichaFuncId, setFichaFuncId] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingConfirmation, setSavingConfirmation] = useState(false);
  const [selectedUnsigned, setSelectedUnsigned] = useState<string[]>([]);
  const [signMode, setSignMode] = useState<"new" | "existing">("new");
  const [signFuncId, setSignFuncId] = useState<string>("");

  const [pendingEntrega, setPendingEntrega] = useState<any>(null);
  const [shouldOpenSignatureAfterSave, setShouldOpenSignatureAfterSave] = useState(false);
  const sigEntregaRef = useRef<SignatureCanvasRef>(null);
  const [signInputType, setSignInputType] = useState<"assinatura" | "facial">("assinatura");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [fullscreenSigOpen, setFullscreenSigOpen] = useState(false);
  const [savedSignatureDataUrl, setSavedSignatureDataUrl] = useState<string | null>(null);
  const [sigNonce, setSigNonce] = useState(0);

  // Devolução confirmation modal state
  const [devolucaoDialogOpen, setDevolucaoDialogOpen] = useState(false);
  const [devolucaoTarget, setDevolucaoTarget] = useState<Entrega | null>(null);
  const [devolucaoObs, setDevolucaoObs] = useState("");
  const [devolucaoDestino, setDevolucaoDestino] = useState<"estoque" | "descarte">("estoque");
  const [devolucaoSaving, setDevolucaoSaving] = useState(false);
  const [estornoDialogOpen, setEstornoDialogOpen] = useState(false);
  const [estornoTarget, setEstornoTarget] = useState<Entrega | null>(null);
  const [estornoSaving, setEstornoSaving] = useState(false);

  // Substituição + descarte automático
  const [descarteSubstituicao, setDescarteSubstituicao] = useState(true);
  const [descarteDescricao, setDescarteDescricao] = useState("");

  const resetSignState = useCallback(() => {
    setSignOpen(false);
    setPendingEntrega(null);
    setSelectedUnsigned([]);
    setSignMode("new");
    setSignFuncId("");
    setSignInputType("assinatura");
    setCapturedPhoto(null);
    setSavedSignatureDataUrl(null);
    setFullscreenSigOpen(false);
    setSigNonce(n => n + 1);
  }, []);

  const rollbackPendingEntrega = useCallback(async () => {
    const ids = pendingEntrega?.entrega_ids || [];
    if (signMode !== "new" || ids.length === 0) return true;

    if (!isOnline()) {
      const queueIdsToRemove = getSyncQueue()
        .filter(op => op.table === "entregas" && ids.includes(op.payload?.id))
        .map(op => op.id);

      queueIdsToRemove.forEach(removeFromSyncQueue);

      const cached = getCachedData<Entrega>("entregas") || [];
      setCachedData("entregas", cached.filter((e) => !ids.includes(e.id)));
      toast({ title: "Entrega cancelada", description: "Registro temporário removido do histórico local." });
      refetch();
      return true;
    }

    const { error } = await (supabase.from as any)("entregas")
      .delete()
      .in("id", ids);

    if (error) {
      toast({ title: "Falha ao cancelar entrega", description: "Tente novamente para remover do histórico.", variant: "destructive" });
      return false;
    }

    toast({ title: "Entrega cancelada", description: "Nenhum registro foi mantido no histórico." });
    refetch();
    return true;
  }, [pendingEntrega, signMode, toast, refetch]);

  const handleCancelSignatureFlow = useCallback(async () => {
    if (savingConfirmation) return;
    const rolledBack = await rollbackPendingEntrega();
    if (!rolledBack) return;
    resetSignState();
  }, [rollbackPendingEntrega, resetSignState, savingConfirmation]);

  const openFullscreenSignature = useCallback(() => {
    setShouldOpenSignatureAfterSave(false);
    setSignOpen(false);
    setSigNonce(n => n + 1);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setFullscreenSigOpen(true));
    });
  }, []);

  const closeFullscreenSignature = useCallback((dataUrl?: string) => {
    if (savingConfirmation) return;

    if (!dataUrl) {
      if (signMode === "new" && pendingEntrega) {
        void handleCancelSignatureFlow();
        return;
      }

      setFullscreenSigOpen(false);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setSignOpen(true));
      });
      return;
    }

    setSavedSignatureDataUrl(dataUrl);
    setFullscreenSigOpen(false);

    if (dataUrl && signMode === "new" && pendingEntrega) {
      const saveDirectly = async () => {
        const ids = pendingEntrega?.entrega_ids || [];
        if (ids.length === 0) return;

        setSavingConfirmation(true);
        try {
          const updatePayload = { assinatura_colaborador: dataUrl };

          if (!isOnline()) {
            for (const id of ids) {
              addToSyncQueue({ table: "entregas", type: "update", payload: { id, ...updatePayload } });
            }
            const cached = getCachedData<Entrega>("entregas") || [];
            setCachedData("entregas", cached.map(e => ids.includes(e.id) ? { ...e, ...updatePayload } : e));
            toast({ title: "Assinatura salva offline", description: `${ids.length} entrega(s) atualizada(s).` });
          } else {
            await Promise.all(
              ids.map(id =>
                (supabase.from as any)("entregas").update(updatePayload).eq("id", id)
              )
            );
            toast({ title: `Assinatura salva em ${ids.length} entrega(s)!` });
          }
          refetch();
        } finally {
          setSavingConfirmation(false);
          setPendingEntrega(null);
          setSavedSignatureDataUrl(null);
        }
      };
      saveDirectly();
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setSignOpen(true));
    });
  }, [savingConfirmation, signMode, pendingEntrega, refetch, toast, handleCancelSignatureFlow]);

  const entregaDefaults = {
    funcionario_id: "", quantidade: 1,
    data: new Date().toISOString().split("T")[0],
    tipo: "entrega" as string, observacao: "",
  };
  const { form, setForm, resetForm, hasDraft } = useFormDraft("entregas_mov", entregaDefaults);

  useEffect(() => {
    const normalizedTipo = normalizeEntregaTipo(form.tipo);
    if (form.tipo !== normalizedTipo) {
      setForm(prev => ({ ...prev, tipo: normalizedTipo }));
    }
  }, [form.tipo, setForm]);

  const [epiCaSearch, setEpiCaSearch] = useState("");
  const [epiSearching, setEpiSearching] = useState(false);
  const [epiDropdownResults, setEpiDropdownResults] = useState<EPI[]>([]);
  const [epiList, setEpiList] = useState<EpiItem[]>([]);
  const [epiQtd, setEpiQtd] = useState(1);
  const [contractEpis, setContractEpis] = useState<EPI[]>([]);

  useEffect(() => {
    const loadContractEpis = async () => {
      if (!contratoId) {
        setContractEpis([]);
        return;
      }

      const { data, error } = await supabase
        .from("contrato_epis")
        .select("epi_id, estoque, empresa_id, epis!inner(id, nome, ca, descricao, validade, empresa_id, tamanho)")
        .eq("contrato_id", contratoId);

      if (error) {
        console.error("Erro ao carregar EPIs do contrato:", error);
        // Fallback: if RLS blocks the inner join, try without inner join
        const { data: fallbackData } = await supabase
          .from("contrato_epis")
          .select("epi_id, estoque, empresa_id")
          .eq("contrato_id", contratoId);

        if (fallbackData && fallbackData.length > 0) {
          // Load EPI details separately
          const epiIds = fallbackData.map((d: any) => d.epi_id);
          const { data: episData } = await supabase
            .from("epis")
            .select("id, nome, ca, descricao, validade, empresa_id, tamanho")
            .in("id", epiIds);

          const episMap = new Map((episData || []).map((e: any) => [e.id, e]));
          const mapped = fallbackData
            .filter((item: any) => episMap.has(item.epi_id))
            .map((item: any) => {
              const ep = episMap.get(item.epi_id)!;
              return {
                id: item.epi_id,
                source_epi_id: item.epi_id,
                nome: ep.nome,
                ca: ep.ca,
                descricao: ep.descricao,
                validade: ep.validade,
                empresa_id: item.empresa_id ?? ep.empresa_id,
                estoque: item.estoque || 0,
                tamanho: ep.tamanho,
              };
            });
          setContractEpis(mapped);
          return;
        }
      }

      const mapped = ((data || []) as any[]).map((item) => ({
        id: item.epi_id,
        source_epi_id: item.epi_id,
        nome: item.epis.nome,
        ca: item.epis.ca,
        descricao: item.epis.descricao,
        validade: item.epis.validade,
        empresa_id: item.empresa_id ?? item.epis.empresa_id,
        estoque: item.estoque || 0,
        tamanho: item.epis.tamanho,
      }));

      setContractEpis(mapped);
    };

    loadContractEpis();
  }, [contratoId, open, empresaId]);

  const availableEpis = useMemo(() => {
    if (contratoId) return contractEpis;
    return epis;
  }, [contratoId, contractEpis, epis]);

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

  useEffect(() => {
    const term = epiCaSearch.trim().toLowerCase();
    if (!term || term.length < 2) {
      setEpiDropdownResults([]);
      return;
    }
    const matched = availableEpis.filter(e =>
      e.nome.toLowerCase().includes(term) ||
      (e.descricao && e.descricao.toLowerCase().includes(term)) ||
      (e.ca && e.ca.includes(term))
    );
    setEpiDropdownResults(matched);
  }, [epiCaSearch, availableEpis]);

  const handleSearchCA = async () => {
    if (!epiCaSearch.trim()) return;
    const foundByCA = availableEpis.find(e => e.ca === epiCaSearch.trim());
    if (foundByCA) {
      addEpiToList(foundByCA);
      return;
    }
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
        if (!contratoId) {
          addEpiToList(newEpi);
        } else {
          toast({ title: "C.A. encontrado", description: "Esse item precisa ser primeiro vinculado ao estoque do contrato para aparecer na entrega.", variant: "destructive" });
        }
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

  const optimizePhotoDataUrl = useCallback(async (dataUrl: string) => {
    try {
      return await new Promise<string>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const maxSide = 960;
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext("2d");

          if (!ctx) {
            resolve(dataUrl);
            return;
          }

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.72));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      });
    } catch {
      return dataUrl;
    }
  }, []);

  useEffect(() => {
    if (!shouldOpenSignatureAfterSave || !pendingEntrega) return;
    if (open || fullscreenSigOpen || signOpen) return;

    setShouldOpenSignatureAfterSave(false);
    setSignMode("new");
    setSignInputType("assinatura");
    setSigNonce(n => n + 1);
    setFullscreenSigOpen(true);
  }, [shouldOpenSignatureAfterSave, open, pendingEntrega, fullscreenSigOpen, signOpen]);

  const handleSave = async () => {
    if (saving) return;
    if (!form.funcionario_id || epiList.length === 0) {
      toast({ title: "Preencha funcionário e adicione ao menos um EPI", variant: "destructive" });
      return;
    }
    if (!empresaId) {
      toast({ title: "Erro de sessão", description: "Empresa não identificada. Faça logout e entre novamente.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const normalizedTipo = normalizeEntregaTipo(form.tipo);
    const statusMap: Record<string, string> = { entrega: "ativo", substituicao: "ativo", perda: "perdido", dano: "danificado" };
    const status = statusMap[normalizedTipo] || "ativo";


    if (!isOnline()) {
      const insertedIds: string[] = [];
      const cached = getCachedData<Entrega>("entregas") || [];

      for (const item of epiList) {
        const tempId = crypto.randomUUID();
        const payload = {
          id: tempId,
          funcionario_id: form.funcionario_id,
          epi_id: item.epi.source_epi_id || item.epi.id,
          quantidade: item.quantidade,
          data: form.data,
          tipo: normalizedTipo,
          status,
          observacao: form.observacao || null,
          empresa_id: empresaId,
        };

        const queued = addToSyncQueue({ table: "entregas", type: "insert", payload });
        if (!queued) {
          toast({
            title: "Memória offline cheia",
            description: "Não foi possível salvar todas as movimentações offline. Sincronize pendências e tente novamente.",
            variant: "destructive",
          });
          break;
        }

        insertedIds.push(tempId);
        cached.unshift({
          id: tempId,
          funcionario_id: form.funcionario_id,
          epi_id: item.epi.id,
          quantidade: item.quantidade,
          data: form.data,
          tipo: normalizedTipo,
          status,
          observacao: form.observacao || null,
          created_at: new Date().toISOString(),
          assinatura_colaborador: null,
          foto_reconhecimento: null,
        } as Entrega);
      }

      if (insertedIds.length === 0) {
        setSaving(false);
        return;
      }

      setCachedData("entregas", cached);
      toast({
        title: insertedIds.length === epiList.length ? "Salvo offline" : "Salvo parcialmente offline",
        description: `${insertedIds.length} de ${epiList.length} item(ns) salvo(s).`,
      });
      setPendingEntrega({ funcionario_id: form.funcionario_id, entrega_ids: insertedIds });
      setOpen(false);
      resetForm();
      setFormFuncSearch("");
      setEpiCaSearch("");
      setEpiList([]);
      setEpiDropdownResults([]);
      setSaving(false);
      setShouldOpenSignatureAfterSave(true);
      return;
    }

    const userResult = await supabase.auth.getUser();
    const currentUserId = userResult.data.user?.id || null;
    let responsavelNome: string | null = null;

    if (currentUserId) {
      const { data: profile } = await (supabase.from as any)("profiles")
        .select("nome")
        .eq("user_id", currentUserId)
        .maybeSingle();
      responsavelNome = profile?.nome || null;
    }

    const results = await Promise.allSettled(
      epiList.map(async (item) => {
        const insertResult = await (supabase.from as any)("entregas")
          .insert({
            funcionario_id: form.funcionario_id,
            epi_id: item.epi.source_epi_id || item.epi.id,
            quantidade: item.quantidade,
            data: form.data,
            tipo: normalizedTipo,
            status,
            observacao: form.observacao || null,
            empresa_id: empresaId,
            created_by: currentUserId,
          })
          .select("id")
          .single();

        if (insertResult.error) {
          console.error("Entrega insert error:", JSON.stringify(insertResult.error), "payload:", { funcionario_id: form.funcionario_id, epi_id: item.epi.id, empresa_id: empresaId, tipo: normalizedTipo, tipo_raw: form.tipo });
          throw insertResult.error;
        }

        // Contract stock sync is now handled by DB trigger (trg_sync_contrato_stock)

        return insertResult.data.id as string;
      })
    );

    const insertedIds: string[] = [];
    const failedEpis: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        insertedIds.push(r.value);
      } else {
        failedEpis.push(epiList[i].epi.nome);
        console.error("Erro ao registrar entrega:", JSON.stringify(r.reason));
      }
    });

    if (failedEpis.length > 0) {
      const errorDetails = results
        .filter((r): r is PromiseRejectedResult => r.status === "rejected")
        .map(r => r.reason?.message || r.reason?.details || JSON.stringify(r.reason))
        .join("; ");
      toast({ title: `${failedEpis.length} EPI(s) com erro`, description: `Falha: ${failedEpis.join(", ")}. ${errorDetails}`, variant: "destructive" });
    }
    if (insertedIds.length === 0) {
      toast({ title: "Nenhum EPI foi registrado", description: "Verifique permissões ou tente novamente.", variant: "destructive" });
      setSaving(false);
      return;
    }

    // Auto-discard old items when discard is enabled and employee has active items
    if (descarteSubstituicao && insertedIds.length > 0) {
      for (const item of epiList) {
        const epiId = item.epi.source_epi_id || item.epi.id;
        // Find the active delivery for same employee + same EPI
        const activeEntrega = entregas.find(e =>
          e.funcionario_id === form.funcionario_id &&
          e.epi_id === epiId &&
          e.status === "ativo" &&
          e.tipo !== "devolucao"
        );

        if (activeEntrega) {
          const obsDescarte = [
            `Descarte automático por substituição em ${form.data}`,
            `Entrega origem: ${activeEntrega.id}`,
            `Status anterior: ${activeEntrega.status}`,
            `Processado por: ${user?.email || "usuário autenticado"}`,
            "[DESCARTE/AVARIA - não retornado ao estoque]",
            descarteDescricao.trim() ? `Estado: ${descarteDescricao.trim()}` : null,
          ].filter(Boolean).join(" • ");

          try {
            // Create devolução record with qty 0 (descarte = não retorna ao estoque)
            await (supabase.from as any)("entregas").insert({
              funcionario_id: activeEntrega.funcionario_id,
              epi_id: activeEntrega.epi_id,
              quantidade: 0,
              data: form.data,
              tipo: "devolucao",
              status: "devolvido",
              observacao: obsDescarte,
              empresa_id: (activeEntrega as any).empresa_id || empresaId,
              created_by: currentUserId,
            });

            // Mark old delivery as "substituido"
            await (supabase.from as any)("entregas")
              .update({ status: "substituido" })
              .eq("id", activeEntrega.id);
          } catch (err) {
            console.error("Erro ao descartar item antigo automaticamente:", err);
          }
        }
      }
    }

    setPendingEntrega({ funcionario_id: form.funcionario_id, entrega_ids: insertedIds });
    setOpen(false);
    resetForm();
    setFormFuncSearch("");
    setEpiCaSearch("");
    setEpiList([]);
    setEpiDropdownResults([]);
    setDescarteSubstituicao(true);
    setDescarteDescricao("");
    setSaving(false);
    setShouldOpenSignatureAfterSave(true);
  };

  const handleDevolver = async (entrega: Entrega) => {
    if (!canEdit) return;
    setDevolucaoTarget(entrega);
    setDevolucaoObs("");
    setDevolucaoDestino("estoque");
    setDevolucaoDialogOpen(true);
  };

  const confirmDevolver = async () => {
    if (!devolucaoTarget) return;
    setDevolucaoSaving(true);

    const entrega = devolucaoTarget;
    const epiObj = epis.find(ep => ep.id === entrega.epi_id);
    const funcObj = funcionarios.find(f => f.id === entrega.funcionario_id);
    const obsText = [
      `Devolução ref. entrega de ${entrega.data}`,
      `Entrega origem: ${entrega.id}`,
      `Status anterior: ${entrega.status || "ativo"}`,
      `Processado por: ${user?.email || user?.id || "usuário autenticado"}`,
      devolucaoDestino === "descarte" ? "[DESCARTE/AVARIA - não retornado ao estoque]" : null,
      devolucaoObs.trim() || null,
    ].filter(Boolean).join(" • ");

    try {
      const { data: devolucaoCriada, error: devolucaoError } = await (supabase.from as any)("entregas").insert({
        funcionario_id: entrega.funcionario_id,
        epi_id: entrega.epi_id,
        quantidade: devolucaoDestino === "estoque" ? entrega.quantidade : 0,
        data: new Date().toISOString().split("T")[0],
        tipo: "devolucao",
        status: "devolvido",
        observacao: obsText,
        empresa_id: (entrega as any).empresa_id || empresaId,
        created_by: user?.id || null,
      }).select("id").single();

      if (devolucaoError) throw devolucaoError;

      const { error: updateEntregaError } = await (supabase.from as any)("entregas")
        .update({ status: "devolvido" })
        .eq("id", entrega.id);

      if (updateEntregaError) {
        if (devolucaoCriada?.id) {
          await (supabase.from as any)("entregas").delete().eq("id", devolucaoCriada.id);
        }
        throw updateEntregaError;
      }

      // Contract stock sync is now handled by DB trigger (trg_sync_contrato_stock)

      toast({
        title: devolucaoDestino === "estoque" ? "EPI devolvido ao estoque!" : "EPI registrado como descarte/avaria",
        description: `${epiObj?.nome || "EPI"} — ${funcObj?.nome || "colaborador"}.`,
      });
      setDevolucaoDialogOpen(false);
      refetch();
      refetchEpis();
    } catch {
      toast({ title: "Erro ao devolver EPI", variant: "destructive" });
    } finally {
      setDevolucaoSaving(false);
    }
  };

  const resolveEntregaOrigem = useCallback((devolucao: Entrega) => {
    const audit = parseDevolucaoAudit(devolucao.observacao);

    if (audit.sourceEntregaId) {
      const entregaOrigem = entregas.find((item) => item.id === audit.sourceEntregaId) || null;
      if (entregaOrigem) {
        return { entregaOrigem, audit };
      }
    }

    const devolucaoTs = new Date(devolucao.created_at).getTime();
    const entregaOrigem = [...entregas]
      .filter((item) =>
        item.id !== devolucao.id &&
        item.tipo !== "devolucao" &&
        item.funcionario_id === devolucao.funcionario_id &&
        item.epi_id === devolucao.epi_id &&
        new Date(item.created_at).getTime() <= devolucaoTs,
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null;

    return { entregaOrigem, audit };
  }, [entregas]);

  const handleOpenEstorno = (devolucao: Entrega) => {
    if (!canEdit) return;
    setEstornoTarget(devolucao);
    setEstornoDialogOpen(true);
  };

  const confirmEstornoDevolucao = async () => {
    if (!estornoTarget) return;
    if (!isOnline()) {
      toast({ title: "Conecte-se para desfazer a devolução", variant: "destructive" });
      return;
    }

    const { entregaOrigem, audit } = resolveEntregaOrigem(estornoTarget);

    if (!entregaOrigem) {
      toast({ title: "Não foi possível localizar a entrega original", variant: "destructive" });
      return;
    }

    setEstornoSaving(true);

    try {
      const restoredStatus = audit.previousStatus || "ativo";
      const operadorDevolucao = audit.processedBy || (estornoTarget as any).created_by || "não identificado";
      const operadorEstorno = user?.email || user?.id || "usuário autenticado";
      const auditNote = `Estorno de devolução por erro em ${new Date().toLocaleDateString("pt-BR")} por ${operadorEstorno}. Devolução original: ${estornoTarget.data}${audit.processedBy ? `, processada por ${operadorDevolucao}` : ", sem operador identificado"}.`;

      const { data: contratoTarget, error: contratoTargetError } = await (supabase.rpc as any)("resolve_contrato_target_for_entrega", {
        _funcionario_id: estornoTarget.funcionario_id,
        _unidade_id: (estornoTarget as any).empresa_id,
        _selected_epi_id: estornoTarget.epi_id,
      });

      if (contratoTargetError) throw contratoTargetError;

      const shouldAdjustUnitStock = !Array.isArray(contratoTarget) || !contratoTarget[0]?.contrato_epi_id;

      const { error: restoreEntregaError } = await (supabase.from as any)("entregas")
        .update({
          status: restoredStatus,
          observacao: appendObservacao(entregaOrigem.observacao, auditNote),
        })
        .eq("id", entregaOrigem.id);

      if (restoreEntregaError) throw restoreEntregaError;

      const { error: deleteDevolucaoError } = await (supabase.from as any)("entregas")
        .delete()
        .eq("id", estornoTarget.id);

      if (deleteDevolucaoError) throw deleteDevolucaoError;

      if (shouldAdjustUnitStock && estornoTarget.quantidade > 0) {
        const { data: epiRow, error: epiLoadError } = await (supabase.from as any)("epis")
          .select("estoque")
          .eq("id", estornoTarget.epi_id)
          .maybeSingle();

        if (epiLoadError) throw epiLoadError;

        const nextStock = Math.max(Number(epiRow?.estoque || 0) - estornoTarget.quantidade, 0);
        const { error: epiUpdateError } = await (supabase.from as any)("epis")
          .update({ estoque: nextStock })
          .eq("id", estornoTarget.epi_id);

        if (epiUpdateError) throw epiUpdateError;
      }

      toast({ title: "Devolução desfeita com sucesso" });
      setEstornoDialogOpen(false);
      setEstornoTarget(null);
      refetch();
      refetchEpis();
    } catch {
      toast({ title: "Erro ao desfazer devolução", variant: "destructive" });
    } finally {
      setEstornoSaving(false);
    }
  };

  const handleSaveSignature = async () => {
    if (savingConfirmation) return;

    const ids = signMode === "new" ? (pendingEntrega?.entrega_ids || []) : selectedUnsigned;
    if (ids.length === 0) return;

    setSavingConfirmation(true);

    try {
      let assinaturaColaborador: string | null = null;
      let fotoUrl: string | null = null;
      let fotoFallbackDataUrl: string | null = null;

      if (signInputType === "facial") {
        if (!capturedPhoto) {
          toast({ title: "Tire a foto do colaborador antes de confirmar", variant: "destructive" });
          return;
        }

        assinaturaColaborador = "RECONHECIMENTO_FACIAL";
        fotoFallbackDataUrl = await optimizePhotoDataUrl(capturedPhoto);

        if (isOnline()) {
          try {
            const blob = await (await fetch(fotoFallbackDataUrl)).blob();
            const { uploadToDrive } = await import("@/lib/googleDriveStorage");
            const result = await uploadToDrive(
              blob,
              "fotos-reconhecimento",
              `${Date.now()}_${crypto.randomUUID().slice(0, 8)}.jpg`
            );
            fotoUrl = result.publicUrl;
          } catch (uploadErr) {
            console.error("Photo upload failed:", uploadErr);
          }
        }
      } else {
        assinaturaColaborador = savedSignatureDataUrl || sigEntregaRef.current?.getDataURL() || null;
        if (!assinaturaColaborador) {
          toast({ title: "Desenhe a assinatura antes de salvar", variant: "destructive" });
          return;
        }
      }

      const updatePayload: any = { assinatura_colaborador: assinaturaColaborador };
      if (fotoUrl) updatePayload.foto_reconhecimento = fotoUrl;
      if (!fotoUrl && fotoFallbackDataUrl) updatePayload.foto_reconhecimento = fotoFallbackDataUrl;

      if (!isOnline()) {
        const queuedIds: string[] = [];

        for (const id of ids) {
          const queued = addToSyncQueue({ table: "entregas", type: "update", payload: { id, ...updatePayload } });
          if (!queued) break;
          queuedIds.push(id);
        }

        if (queuedIds.length === 0) {
          toast({
            title: "Não foi possível salvar offline",
            description: "A memória offline está cheia. Sincronize as pendências e tente novamente.",
            variant: "destructive",
          });
          return;
        }

        const cached = getCachedData<Entrega>("entregas") || [];
        setCachedData("entregas", cached.map(e => queuedIds.includes(e.id) ? { ...e, ...updatePayload } : e));

        toast({
          title: signInputType === "facial" ? "Confirmação por foto salva offline" : "Assinatura salva offline",
          description: `${queuedIds.length} entrega(s) atualizada(s) e pronta(s) para sincronização.`,
        });
      } else {
        const results = await Promise.all(
          ids.map(id =>
            (supabase.from as any)("entregas")
              .update(updatePayload)
              .eq("id", id)
          )
        );

        const failed = results.filter(r => r.error);
        if (failed.length === ids.length) {
          toast({ title: "Falha ao salvar confirmação", description: "Tente novamente.", variant: "destructive" });
          return;
        }

        if (failed.length > 0) {
          toast({
            title: "Salvo parcialmente",
            description: `${ids.length - failed.length} de ${ids.length} entrega(s) confirmada(s).`,
            variant: "destructive",
          });
        } else {
          toast({ title: signInputType === "facial" ? `Reconhecimento facial registrado em ${ids.length} entrega(s)!` : `Assinatura salva em ${ids.length} entrega(s)!` });
        }
      }

      refetch();
      setSignOpen(false);
      setPendingEntrega(null);
      setSelectedUnsigned([]);
      setSignMode("new");
      setSignFuncId("");
      setCapturedPhoto(null);
    } finally {
      setSavingConfirmation(false);
    }
  };

  const unsignedEntregas = useMemo(() => entregas.filter(e => !e.assinatura_colaborador && e.tipo !== "devolucao"), [entregas]);

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

    // Fetch current unit, then resolve parent (empresa mãe) for header
    let emp: any = {};
    if (isOnline()) {
      const { data: empresaData } = await (supabase.from as any)("empresa_config").select("*").eq("id", empresaId).limit(1);
      let unit = empresaData?.[0] || {};
      // If this is a filial, fetch the empresa mãe
      if (unit.empresa_pai_id) {
        const { data: matrizData } = await (supabase.from as any)("empresa_config").select("*").eq("id", unit.empresa_pai_id).limit(1);
        emp = matrizData?.[0] || unit;
      } else {
        emp = unit;
      }
    } else {
      const cached = getCachedData<any>("empresa_config");
      let unit = cached?.find((c: any) => c.id === empresaId) || cached?.[0] || {};
      if (unit.empresa_pai_id) {
        emp = cached?.find((c: any) => c.id === unit.empresa_pai_id) || unit;
      } else {
        emp = unit;
      }
    }

    const now = new Date();

    const entregasData = funcEntregas.map(e => {
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
        foto_reconhecimento: (e as any).foto_reconhecimento || null,
      };
    });

    // Pre-load photos + logo as base64 for PDF embedding
    const fotosBase64 = await preloadFotosReconhecimento(entregasData);
    if (emp.logo_url && !emp.logo_url.startsWith("data:")) {
      const { urlToBase64 } = await import("@/lib/gerarFichaEPI");
      const logoB64 = await urlToBase64(emp.logo_url);
      if (logoB64) fotosBase64.set(emp.logo_url, logoB64);
    }

    const doc = gerarFichaEPI({
      empresa: { nome: emp.nome || "", cnpj: emp.cnpj || "", endereco: emp.endereco || "", logo_url: emp.logo_url || null },
      funcionario: { nome: func.nome, cargo: func.cargo, setor: func.setor, cpf: func.cpf, matricula: func.matricula, data_admissao: func.data_admissao },
      entregas: entregasData,
      fotosBase64,
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
            <Button onClick={() => { refetchEpis(); setOpen(true); }} className="flex-1 sm:flex-none text-xs sm:text-sm">
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
                        {offlinePendingIds.has(e.id) && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 rounded px-1 py-0.5 font-medium"><WifiOff className="w-3 h-3" />Offline</span>
                        )}
                        <Badge variant={tipoBadge[e.tipo] || "default"} className="text-[10px]">{tipoLabels[e.tipo] || e.tipo}</Badge>
                        <span className={`text-[10px] font-medium ${e.status === "ativo" ? "text-success" : e.status === "perdido" || e.status === "danificado" ? "text-destructive" : "text-muted-foreground"}`}>
                          {e.status === "ativo" ? "Ativo" : e.status === "substituido" ? "Substituído" : e.status === "perdido" ? "Perdido" : e.status === "danificado" ? "Danificado" : e.status}
                        </span>
                        {e.tipo === "devolucao" ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-medium">—</span>
                        ) : e.assinatura_colaborador ? (
                          e.assinatura_colaborador === "BIOMETRIA_DIGITAL" || e.assinatura_colaborador === "RECONHECIMENTO_FACIAL" ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-success font-medium">
                              <ScanFace className="w-3 h-3" />Rec. Facial
                              {(e as any).foto_reconhecimento && <Camera className="w-3 h-3 ml-0.5" />}
                            </span>
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
                        {e.tipo === "devolucao" && e.status === "devolvido" && canEdit && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Desfazer devolução" onClick={() => handleOpenEstorno(e)}>
                            <RotateCcw className="w-3 h-3 text-primary" />
                          </Button>
                        )}
                        {!e.assinatura_colaborador && canEdit && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Assinar" onClick={() => openSignExisting(e.funcionario_id)}>
                            <PenLine className="w-3 h-3 text-amber-500" />
                          </Button>
                        )}
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
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={tipoBadge[e.tipo] || "default"}>{tipoLabels[e.tipo] || e.tipo}</Badge>
                          {offlinePendingIds.has(e.id) && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400 rounded px-1.5 py-0.5 font-medium"><WifiOff className="w-3 h-3" />Offline</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{getName(funcionarios, e.funcionario_id)}</TableCell>
                      <TableCell>{getName(epis, e.epi_id)}</TableCell>
                      <TableCell className="text-right">{e.quantidade}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium ${e.status === "ativo" ? "text-success" : e.status === "perdido" || e.status === "danificado" ? "text-destructive" : "text-muted-foreground"}`}>
                          {e.status === "ativo" ? "Ativo" : e.status === "substituido" ? "Substituído" : e.status === "perdido" ? "Perdido" : e.status === "danificado" ? "Danificado" : e.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {e.tipo === "devolucao" ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : e.assinatura_colaborador ? (
                          e.assinatura_colaborador === "BIOMETRIA_DIGITAL" || e.assinatura_colaborador === "RECONHECIMENTO_FACIAL" ? (
                            <span className="inline-flex items-center gap-1 text-xs text-success font-medium">
                              <ScanFace className="w-3.5 h-3.5" />Rec. Facial
                              {(e as any).foto_reconhecimento && <Camera className="w-3 h-3 ml-0.5" />}
                            </span>
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
                          {e.tipo === "devolucao" && e.status === "devolvido" && canEdit && (
                            <Button size="icon" variant="ghost" title="Desfazer devolução" onClick={() => handleOpenEstorno(e)}>
                              <RotateCcw className="w-3.5 h-3.5 text-primary" />
                            </Button>
                          )}
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

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setFormFuncSearch(""); setEpiCaSearch(""); setEpiList([]); setEpiDropdownResults([]); setDescarteSubstituicao(true); setDescarteDescricao(""); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Movimentação</DialogTitle>
            {contratoId && contractEpis.length > 0 && (
              <p className="text-xs text-muted-foreground">Usando estoque do contrato ({contractEpis.length} EPIs disponíveis)</p>
            )}
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Tipo</Label>
              <Select value={normalizeEntregaTipo(form.tipo)} onValueChange={v => setForm({ ...form, tipo: normalizeEntregaTipo(v) })}>
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
                      <span className="font-medium">{epi.nome}{epi.tamanho ? ` (${epi.tamanho})` : ""}</span>
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
                        <p className="font-medium truncate">{item.epi.nome}{item.epi.tamanho ? ` (${item.epi.tamanho})` : ""}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.epi.ca && <>C.A.: {item.epi.ca} — </>}Estoque: {item.epi.estoque} — Qtd: {item.quantidade}
                        </p>
                      </div>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => removeEpiFromList(item.epi.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Descarte de material antigo */}
              {form.funcionario_id && epiList.length > 0 && (() => {
                const episComAtivo = epiList.filter(item => {
                  const epiId = item.epi.source_epi_id || item.epi.id;
                  return entregas.some(e =>
                    e.funcionario_id === form.funcionario_id &&
                    e.epi_id === epiId &&
                    e.status === "ativo" &&
                    e.tipo !== "devolucao"
                  );
                });
                if (episComAtivo.length === 0) return null;
                return (
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <Label htmlFor="descarte-substituicao" className="text-xs cursor-pointer">
                      ♻️ Descarte de material antigo?
                    </Label>
                    <Checkbox
                      id="descarte-substituicao"
                      checked={descarteSubstituicao}
                      onCheckedChange={(v) => setDescarteSubstituicao(!!v)}
                    />
                  </div>
                );
              })()}
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

      <Dialog open={signOpen} onOpenChange={(v) => {
        if (!v) {
          if (fullscreenSigOpen) {
            setSignOpen(false);
            return;
          }
          void handleCancelSignatureFlow();
          return;
        }
        setSignOpen(true);
      }}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {signInputType === "facial" ? <ScanFace className="w-5 h-5" /> : <PenLine className="w-5 h-5" />}
              {signInputType === "facial" ? "Reconhecimento Facial" : "Assinatura do Colaborador"}
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
                variant={signInputType === "facial" ? "default" : "outline"}
                onClick={() => setSignInputType("facial")}
                className="flex-1"
              >
                <ScanFace className="w-4 h-4 mr-1.5" />
                Rec. Facial
              </Button>
            </div>

            {signInputType === "assinatura" ? (
              <div className="space-y-3">
                {savedSignatureDataUrl ? (
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Assinatura do Colaborador</span>
                    <div className="border border-input rounded-lg p-2 bg-white">
                      <img src={savedSignatureDataUrl} alt="Assinatura" className="w-full h-24 object-contain" />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={openFullscreenSignature}>
                      <PenLine className="w-3.5 h-3.5 mr-1" /> Refazer assinatura
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" className="w-full h-20 border-dashed flex flex-col gap-1" onClick={openFullscreenSignature}>
                    <PenLine className="w-5 h-5" />
                    <span className="text-sm">Toque para assinar em tela cheia</span>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-lg border bg-muted/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Camera className="w-4 h-4 text-primary" />
                    <p className="font-medium text-sm">Foto do Colaborador</p>
                  </div>
                  <CameraCapture
                    capturedPhoto={capturedPhoto}
                    onCapture={setCapturedPhoto}
                    onClear={() => setCapturedPhoto(null)}
                  />
                </div>
                <div className="flex items-center gap-1 justify-center text-xs text-primary">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Conforme NR-6 — Portaria Nº 2.175/2022</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => void handleCancelSignatureFlow()} disabled={savingConfirmation}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveSignature}
              disabled={savingConfirmation || (signMode === "existing" && selectedUnsigned.length === 0)}
            >
              {savingConfirmation ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Salvando...</>
              ) : signInputType === "facial" ? (
                <><ScanFace className="w-4 h-4 mr-1.5" />Confirmar com Foto {signMode === "existing" && selectedUnsigned.length > 0 ? `(${selectedUnsigned.length})` : ""}</>
              ) : (
                <>✍️ Salvar Assinatura {signMode === "existing" && selectedUnsigned.length > 0 ? `(${selectedUnsigned.length})` : ""}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FullscreenSignature
        key={sigNonce}
        open={fullscreenSigOpen}
        employeeName={(() => {
          const fid = signMode === "new" ? pendingEntrega?.funcionario_id : signFuncId;
          const func = funcionarios?.find((f: any) => f.id === fid);
          return func?.nome;
        })()}
        employeeRole={(() => {
          const fid = signMode === "new" ? pendingEntrega?.funcionario_id : signFuncId;
          const func = funcionarios?.find((f: any) => f.id === fid);
          return func?.cargo || undefined;
        })()}
        onCancel={() => closeFullscreenSignature()}
        onSave={(dataUrl) => closeFullscreenSignature(dataUrl)}
        onFacialRecognition={() => {
          setFullscreenSigOpen(false);
          setSignInputType("facial");
          setCapturedPhoto(null);
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => setSignOpen(true));
          });
        }}
      />

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

      {/* Devolução confirmation dialog */}
      <Dialog open={devolucaoDialogOpen} onOpenChange={(v) => { if (!devolucaoSaving) setDevolucaoDialogOpen(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="w-5 h-5" />
              Confirmar Devolução de EPI
            </DialogTitle>
          </DialogHeader>
          {devolucaoTarget && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border p-3 space-y-1 bg-muted/30">
                <p className="text-sm"><span className="text-muted-foreground">Colaborador:</span> <strong>{getName(funcionarios, devolucaoTarget.funcionario_id)}</strong></p>
                <p className="text-sm"><span className="text-muted-foreground">EPI:</span> <strong>{getName(epis, devolucaoTarget.epi_id)}</strong></p>
                <p className="text-sm"><span className="text-muted-foreground">Quantidade:</span> <strong>{devolucaoTarget.quantidade}</strong></p>
                <p className="text-sm"><span className="text-muted-foreground">Data entrega:</span> {devolucaoTarget.data}</p>
              </div>

              <div>
                <Label>Destino do item</Label>
                <Select value={devolucaoDestino} onValueChange={(v) => setDevolucaoDestino(v as "estoque" | "descarte")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {devolucaoDestinos.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {devolucaoDestino === "estoque"
                    ? "O item será devolvido ao saldo disponível da unidade."
                    : "O item será registrado como avaria/descarte e NÃO voltará ao estoque."}
                </p>
              </div>

              <div>
                <Label>Observações sobre o estado do item</Label>
                <Textarea
                  placeholder="Ex: Item com defeito, vencido, sem uso, etc."
                  value={devolucaoObs}
                  onChange={(e) => setDevolucaoObs(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDevolucaoDialogOpen(false)} disabled={devolucaoSaving}>Cancelar</Button>
            <Button onClick={confirmDevolver} disabled={devolucaoSaving}>
              {devolucaoSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Undo2 className="w-4 h-4 mr-2" />}
              Confirmar Devolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={estornoDialogOpen} onOpenChange={(v) => { if (!estornoSaving) setEstornoDialogOpen(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5" />
              Desfazer devolução
            </DialogTitle>
          </DialogHeader>
          {estornoTarget && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border p-3 space-y-1 bg-muted/30">
                <p className="text-sm"><span className="text-muted-foreground">Colaborador:</span> <strong>{getName(funcionarios, estornoTarget.funcionario_id)}</strong></p>
                <p className="text-sm"><span className="text-muted-foreground">EPI:</span> <strong>{getName(epis, estornoTarget.epi_id)}</strong></p>
                <p className="text-sm"><span className="text-muted-foreground">Quantidade:</span> <strong>{estornoTarget.quantidade}</strong></p>
                <p className="text-sm"><span className="text-muted-foreground">Ação:</span> restaurar para <strong>{parseDevolucaoAudit(estornoTarget.observacao).previousStatus || "ativo"}</strong></p>
              </div>

              <p className="text-sm text-muted-foreground">
                Confirme apenas se a devolução foi registrada por engano. O item voltará para <strong className="text-foreground">Em uso</strong> e o estoque será estornado automaticamente.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEstornoDialogOpen(false)} disabled={estornoSaving}>Cancelar</Button>
            <Button onClick={confirmEstornoDevolucao} disabled={estornoSaving}>
              {estornoSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
              Confirmar estorno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}