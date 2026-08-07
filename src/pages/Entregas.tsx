import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { useFormDraft } from "@/hooks/useFormDraft";
import { Plus, Trash2, FileText, Search, Loader2, PenLine, CheckCircle2, AlertCircle, ScanFace, ShieldCheck, Camera, WifiOff, Undo2, RotateCcw, Link } from "lucide-react";
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
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { PackageOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SignatureCanvas, { type SignatureCanvasRef } from "@/components/SignatureCanvas";
import FullscreenSignature from "@/components/FullscreenSignature";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { gerarFichaEPI, preloadFotosReconhecimento } from "@/lib/gerarFichaEPI";
import CameraCapture from "@/components/CameraCapture";

const tipoTone: Record<string, StatusTone> = {
  entrega: "info",
  substituicao: "warning",
  perda: "danger",
  dano: "warning",
  devolucao: "neutral",
};

const statusTone = (status: string): StatusTone => {
  if (status === "ativo") return "success";
  if (status === "perdido" || status === "danificado") return "danger";
  if (status === "substituido") return "warning";
  return "neutral";
};

const statusLabel = (status: string): string => {
  if (status === "ativo") return "Ativo";
  if (status === "substituido") return "Substituído";
  if (status === "perdido") return "Perdido";
  if (status === "danificado") return "Danificado";
  if (status === "devolvido") return "Devolvido";
  return status;
};


interface Entrega { id: string; funcionario_id: string; epi_id: string; quantidade: number; data: string; tipo: string; observacao: string | null; status: string; created_at: string; assinatura_colaborador: string | null; foto_reconhecimento: string | null; empresa_id?: string | null; unidade_origem_id?: string | null; }
interface Funcionario { id: string; nome: string; cargo: string | null; setor: string | null; cpf: string | null; matricula: string | null; data_admissao: string | null; empresa_id?: string | null; }
interface EPI { id: string; nome: string; estoque: number; ca: string | null; descricao: string | null; validade: string | null; empresa_id?: string | null; source_epi_id?: string; tamanho?: string | null; }
interface EpiItem { epi: EPI; quantidade: number; }
interface Unidade { id: string; nome: string; tipo: string; }

const tipoLabels: Record<string, string> = { entrega: "Entrega", substituicao: "Substituição", perda: "Perda", dano: "Dano", devolucao: "Devolução" };

/**
 * A parte da observação que interessa a quem lê a lista.
 *
 * O descarte automático grava uma trilha de auditoria na própria observação —
 * id da entrega de origem, status anterior, quem processou. É informação para
 * conferência posterior, não para a tela: no card aparecia
 * "Entrega origem: 1a61bc1e-7ea4-4d78-a8cd-…", um identificador interno que
 * não diz nada e ainda ocupava as duas linhas disponíveis, escondendo o
 * motivo real do registro. O texto completo continua gravado no banco.
 */
const TRECHOS_TECNICOS = /^(entrega origem|status anterior|processado por)\s*:/i;
const observacaoLegivel = (obs?: string | null): string =>
  (obs || "")
    .split("•")
    .map((p) => p.trim())
    .filter((p) => p && !TRECHOS_TECNICOS.test(p))
    .join(" • ");

/** Data ISO (YYYY-MM-DD) no formato brasileiro, sem passar por fuso. */
const fmtData = (d?: string | null): string => {
  if (!d) return "—";
  const [ano, mes, dia] = d.slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : d;
};



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
  if (normalized.includes("devolu")) return "devolucao";
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
  const { data: entregas, loading: loadingEntregas, add, remove, refetch } = useSupabaseCrud<Entrega>("entregas", "created_at");
  const { data: funcionarios, loading: loadingFuncionarios } = useSupabaseQuery<Funcionario>("funcionarios");
  const { data: epis, loading: loadingEpis, refetch: refetchEpis } = useSupabaseQuery<EPI>("epis");

  /*
   * A lista só faz sentido com as três consultas prontas.
   *
   * Cada linha de entrega guarda apenas os ids do colaborador e do EPI — os
   * nomes vêm de `funcionarios` e `epis`. Com o gate olhando só para
   * `entregas`, a tela abria assim que ela resolvia (o que é imediato quando
   * vem do cache local) e as buscas por id ainda caíam em listas vazias: todo
   * card aparecia com "—" no lugar do colaborador e "EPI não localizado no
   * cadastro", como se os dados tivessem sumido.
   */
  const loading = loadingEntregas || loadingFuncionarios || loadingEpis;
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
  /* Exclusão é definitiva e leva a assinatura junto — precisa passar por
     confirmação que diga exatamente qual registro está sendo apagado. */
  const [confirmDelete, setConfirmDelete] = useState<Entrega | null>(null);
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
    unidade_origem_id: empresaId || "",
  };
  const { form, setForm, resetForm, hasDraft } = useFormDraft("entregas_mov", entregaDefaults);

  const [unidades, setUnidades] = useState<Unidade[]>([]);
  useEffect(() => {
    const loadUnidades = async () => {
      const { data } = await supabase.from("empresa_config").select("id, nome, tipo").order("nome");
      setUnidades((data as Unidade[]) || []);
    };
    loadUnidades();
  }, []);

  // Auto-fill unidade_origem_id when empresaId changes and form is empty
  useEffect(() => {
    if (empresaId && !form.unidade_origem_id) {
      setForm(prev => ({ ...prev, unidade_origem_id: empresaId }));
    }
  }, [empresaId]);

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

      const mapped = ((data || []) as any[])
        .filter((item) => item && item.epi_id)
        .map((item) => {
          const ep = Array.isArray(item.epis) ? item.epis[0] : item.epis;
          return {
            id: item.epi_id,
            source_epi_id: item.epi_id,
            nome: ep?.nome || "EPI não localizado",
            ca: ep?.ca || null,
            descricao: ep?.descricao || null,
            validade: ep?.validade || null,
            empresa_id: item.empresa_id ?? ep?.empresa_id,
            estoque: item.estoque || 0,
            tamanho: ep?.tamanho || null,
          };
        });

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
    return (func.nome || "").toLowerCase().includes(t) || (func.cpf && func.cpf.includes(t)) || (func.matricula && func.matricula.toLowerCase().includes(t));
  };

  /** Contagem de entregas por funcionário — pré-computada uma vez para
   *  evitar O(n×m) toda vez que o dropdown renderiza. */
  const entregaCountByFunc = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entregas) {
      map.set(e.funcionario_id, (map.get(e.funcionario_id) || 0) + 1);
    }
    return map;
  }, [entregas]);

  const filteredEntregas = useMemo(() => {
    if (!searchTerm) return entregas;
    return entregas.filter(e => {
      const func = funcionarios.find(f => f.id === e.funcionario_id);
      return func && matchFunc(func, searchTerm);
    });
  }, [entregas, funcionarios, searchTerm]);

  const fichaFilteredFuncs = useMemo(() => {
    const base = fichaSearch ? funcionarios.filter(f => matchFunc(f, fichaSearch)) : funcionarios;
    return [...base].sort((a, b) => {
      const countA = entregaCountByFunc.get(a.id) || 0;
      const countB = entregaCountByFunc.get(b.id) || 0;
      return countB - countA;
    });
  }, [funcionarios, fichaSearch, entregaCountByFunc]);

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
    if (!form.unidade_origem_id) {
      toast({ title: "Selecione o Local de Baixa", description: "Informe de qual unidade o EPI está saindo.", variant: "destructive" });
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
          unidade_origem_id: form.unidade_origem_id || null,
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
            unidade_origem_id: form.unidade_origem_id || null,
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
      resetSignState();
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

  /**
   * Quando a lixeira faz sentido.
   *
   * Excluir é DELETE definitivo: não devolve estoque, não deixa rastro e não
   * tem desfazer. Só cabe onde não existe caminho melhor — ou seja, num
   * registro ainda sem consequência.
   *
   * - Assinada: a assinatura mora na linha e é a prova de entrega do EPI
   *   (CLT art. 166/167). Sai de circulação por devolução, que preserva o
   *   histórico.
   * - Devolução: já tem "Desfazer devolução", que restaura o status anterior
   *   da entrega original, acerta o estoque e grava auditoria. Apagar a linha
   *   deixaria a entrega original travada como devolvida e o estoque errado.
   */
  const podeExcluir = (e: Entrega) =>
    canDelete && !e.assinatura_colaborador && e.tipo !== "devolucao";

  /**
   * O que o colaborador tem em mãos hoje — as entregas que podem voltar.
   *
   * Devolução não é movimentação solta: ela aponta para uma entrega
   * específica, marca aquela linha como devolvida e é por esse vínculo que o
   * "Desfazer devolução" consegue restaurar o estado anterior. Por isso o
   * formulário pede a entrega de origem em vez de deixar escolher um EPI
   * qualquer do catálogo.
   */
  const entregasDevolviveis = useMemo(
    () => entregas.filter(
      (e) => e.funcionario_id === form.funcionario_id && e.status === "ativo" && e.tipo !== "devolucao",
    ),
    [entregas, form.funcionario_id],
  );

  /*
   * Índices por id. Antes cada célula fazia um `find` na lista inteira: com
   * centenas de entregas × centenas de EPIs isso é varredura sobre varredura a
   * cada render. Aqui também dá acesso ao registro completo — a matrícula do
   * funcionário e o CA do EPI, que o card passou a mostrar.
   */
  const funcionarioPorId = useMemo(
    () => new Map(funcionarios.map(f => [f.id, f])),
    [funcionarios],
  );
  const epiPorId = useMemo(() => new Map(epis.map(e => [e.id, e])), [epis]);

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
    /* pb no celular: o botão flutuante cobriria o rodapé do último card, que
       é justamente onde ficam a observação e os botões de ação. */
    <div className="space-y-4 sm:space-y-6 pb-16 lg:pb-0">
      <PageHeader
        title="Entregas de EPI"
        subtitle="Controle de entregas, assinaturas, devoluções e histórico de EPIs."
        actions={
          <>
            {canEdit && unsignedEntregas.length > 0 && (
              <Button variant="outline" onClick={() => openSignExisting()} className="text-xs sm:text-sm border-amber-500 text-amber-600 hover:bg-amber-50">
                <PenLine className="w-4 h-4 mr-1 sm:mr-2" />
                Assinar ({unsignedEntregas.length})
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" onClick={() => openFicha()} className="text-xs sm:text-sm">
                <FileText className="w-4 h-4 mr-1 sm:mr-2" />Ficha
              </Button>
            )}
            {/* No celular esta ação vira o botão flutuante lá embaixo — perto
                do polegar e sem ocupar altura no topo, que é onde a lista
                precisa de espaço. No desktop não há barra inferior nem
                problema de alcance, então segue como botão comum. */}
            {canCreate && (
              <Button onClick={() => { refetchEpis(); setOpen(true); }} className="hidden lg:inline-flex text-xs sm:text-sm">
                <Plus className="w-4 h-4 mr-1 sm:mr-2" />Nova Entrega
              </Button>
            )}
          </>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9 text-sm" placeholder="Buscar por CPF, matrícula ou nome..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      {loading ? (
        <ListSkeleton rows={5} />
      ) : (
        <>
          {/* Mobile card layout */}
          <div className="space-y-3 lg:hidden">
            {filteredEntregas.length === 0 ? (
              searchTerm ? (
                <EmptyState icon={Search} title="Nenhum resultado encontrado" description="Tente ajustar o termo de busca." />
              ) : (
                <EmptyState
                  icon={PackageOpen}
                  title="Nenhuma entrega registrada"
                  description="Registre a primeira entrega de EPI para iniciar o controle do colaborador."
                  action={canCreate ? (
                    <Button onClick={() => { refetchEpis(); setOpen(true); }}>
                      <Plus className="w-4 h-4 mr-2" />Nova Entrega
                    </Button>
                  ) : undefined}
                />
              )
            ) : filteredEntregas.map(e => (
              <Card key={e.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        {offlinePendingIds.has(e.id) && (
                          <StatusBadge tone="info" size="sm"><WifiOff className="w-3 h-3 mr-0.5" />Offline</StatusBadge>
                        )}
                        {/* Nem tipo nem situação viram selo aqui: os dois
                            aparecem logo abaixo, em campos rotulados. Lado a
                            lado no topo, "Substituição" (motivo) e
                            "Substituído" (situação) liam como a mesma palavra
                            repetida — o rótulo é o que distingue as duas.
                            Na tabela do desktop não há campos rotulados, então
                            lá as colunas Tipo e Status seguem como estão. */}

                        {/* Devolução não é assinada — antes saía um "—" solto
                            entre os selos, que só polui: ausência de selo já
                            diz que não há assinatura a mostrar. */}
                        {e.tipo === "devolucao" ? null : e.assinatura_colaborador ? (
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
                      {/* Identificação em grade de duas colunas: código à
                          esquerda, descrição à direita. É o que alinha a
                          segunda linha de um nome longo com a primeira palavra
                          — e não embaixo do número, que é o que acontece
                          quando código e nome ficam no mesmo parágrafo. */}
                      {(() => {
                        const func = funcionarioPorId.get(e.funcionario_id);
                        const epi = epiPorId.get(e.epi_id);
                        return (
                          <div className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-0.5">
                            <span className="font-mono text-sm text-muted-foreground tabular-nums">
                              {func?.matricula || ""}
                            </span>
                            <span className="font-semibold text-sm leading-snug">{func?.nome || "—"}</span>
                            <span className="font-mono text-sm text-muted-foreground tabular-nums">
                              {epi?.ca || ""}
                            </span>
                            {/* Sem o EPI no cadastro carregado o card mostrava
                                um "—" solto, idêntico a campo vazio. Dizer que
                                não foi localizado evita ler como "sem EPI". */}
                            <span className="text-sm leading-snug">
                              {epi?.nome || <span className="text-muted-foreground italic">EPI não localizado no cadastro</span>}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  {/*
                   * Campos rotulados em grade: rótulo na coluna 1, valor na
                   * coluna 2. Todos os valores começam no mesmo X, o que deixa
                   * as datas alinhadas para leitura em varredura vertical —
                   * com `justify-between` cada valor parava numa posição
                   * diferente, conforme o tamanho do próprio texto.
                   */}
                  <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">Motivo</dt>
                    <dd>{tipoLabels[e.tipo] || e.tipo}</dd>

                    {/* Situação é o estado atual do EPI (ainda com o
                        colaborador, já trocado, devolvido) — informação
                        diferente do motivo, que diz por que a movimentação
                        aconteceu. Uma entrega do tipo "Substituição" pode
                        estar "Ativo" ou "Substituído" conforme já tenha sido
                        trocada de novo. */}
                    <dt className="text-muted-foreground">Situação</dt>
                    <dd className={e.status === "ativo" ? "text-success font-medium" : ""}>
                      {statusLabel(e.status)}
                    </dd>

                    <dt className="text-muted-foreground">Quantidade</dt>
                    <dd className="tabular-nums">{e.quantidade}</dd>

                    <dt className="text-muted-foreground">Data de entrega</dt>
                    <dd className="font-mono tabular-nums">{fmtData(e.data)}</dd>
                  </dl>
                  {observacaoLegivel(e.observacao) && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{observacaoLegivel(e.observacao)}</p>
                  )}

                  {/* Ações em linha própria no rodapé. Ao lado do texto elas
                      comiam a largura útil: num card com três botões o nome do
                      colaborador quebrava em três linhas, e cards com um botão
                      só ficavam com aparência diferente dos demais. */}
                  {/* O rodapé só existe quando há botão para pôr nele. Uma
                      entrega assinada não tem nenhum dos três — antes sobrava
                      a linha divisória com espaço vazio embaixo. */}
                  {(() => {
                    const podeEstornar = e.tipo === "devolucao" && e.status === "devolvido" && canEdit;
                    const podeAssinar = !e.assinatura_colaborador && e.tipo !== "devolucao" && canEdit;
                    if (!podeEstornar && !podeAssinar && !podeExcluir(e)) return null;
                    return (
                    <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
                      {podeEstornar && (
                        <Button size="icon" variant="outline" className="h-10 w-10" title="Desfazer devolução" aria-label="Desfazer devolução" onClick={() => handleOpenEstorno(e)}>
                          <RotateCcw className="w-4 h-4 text-primary" />
                        </Button>
                      )}
                      {podeAssinar && (
                        <Button size="icon" variant="outline" className="h-10 w-10" title="Assinar" aria-label="Assinar" onClick={() => openSignExisting(e.funcionario_id)}>
                          <PenLine className="w-4 h-4 text-amber-500" />
                        </Button>
                      )}
                      {podeExcluir(e) && (
                        <Button size="icon" variant="outline" className="h-10 w-10" title="Excluir" aria-label="Excluir" onClick={() => setConfirmDelete(e)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    );
                  })()}
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
                    <TableRow><TableCell colSpan={9} className="p-0">
                      <EmptyState
                        bare
                        icon={searchTerm ? Search : PackageOpen}
                        title={searchTerm ? "Nenhum resultado encontrado" : "Nenhuma entrega registrada"}
                        description={searchTerm ? "Tente ajustar o termo de busca." : "Registre a primeira entrega de EPI para iniciar o controle do colaborador."}
                      />
                    </TableCell></TableRow>
                  ) : filteredEntregas.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">{e.data}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <StatusBadge tone={tipoTone[e.tipo] || "neutral"} size="sm">{tipoLabels[e.tipo] || e.tipo}</StatusBadge>
                          {offlinePendingIds.has(e.id) && (
                            <StatusBadge tone="info" size="sm"><WifiOff className="w-3 h-3 mr-0.5" />Offline</StatusBadge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {funcionarioPorId.get(e.funcionario_id)?.matricula && (
                          <span className="font-mono text-xs text-muted-foreground mr-1.5">
                            {funcionarioPorId.get(e.funcionario_id)?.matricula}
                          </span>
                        )}
                        {funcionarioPorId.get(e.funcionario_id)?.nome || "—"}
                      </TableCell>
                      <TableCell>
                        {epiPorId.get(e.epi_id)?.ca && (
                          <span className="font-mono text-xs text-muted-foreground mr-1.5">{epiPorId.get(e.epi_id)?.ca}</span>
                        )}
                        {epiPorId.get(e.epi_id)?.nome || (
                          <span className="text-muted-foreground italic text-xs">EPI não localizado</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{e.quantidade}</TableCell>
                      <TableCell>
                        <StatusBadge tone={statusTone(e.status)} size="sm">{statusLabel(e.status)}</StatusBadge>
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
                          {podeExcluir(e) && (
                            <Button size="icon" variant="ghost" title="Excluir" aria-label="Excluir" onClick={() => setConfirmDelete(e)}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
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
        </>
      )}

      {/*
       * Botão flutuante de nova entrega (só no celular).
       *
       * Fica acima da barra de navegação inferior, que é `fixed` com
       * ~3,5rem de altura mais a área segura do aparelho — daí o cálculo no
       * `bottom`, em vez de um valor fixo que encostaria na barra em telas
       * com faixa inferior (iPhone) e flutuaria alto demais nas sem.
       *
       * z-40 fica abaixo do z-50 da barra: o botão não cobre a navegação.
       */}
      {canCreate && (
        <Button
          onClick={() => { refetchEpis(); setOpen(true); }}
          aria-label="Nova entrega"
          className="lg:hidden fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-40 h-14 w-14 rounded-full p-0 shadow-lg"
        >
          <Plus className="w-7 h-7" />
        </Button>
      )}

      {/* Confirmação de exclusão.
          Antes o toque na lixeira apagava na hora — num botão pequeno, num
          celular, em campo. E o registro não vai para lixeira nenhuma: é
          DELETE definitivo. O diálogo nomeia o que será perdido para que dê
          para reconhecer o registro errado antes de confirmar. */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta movimentação?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Esta ação é definitiva e não pode ser desfeita.</p>
                {confirmDelete && (
                  <div className="rounded-md border bg-muted/40 p-3 text-sm text-foreground">
                    <p className="font-semibold">{funcionarioPorId.get(confirmDelete.funcionario_id)?.nome || "—"}</p>
                    <p>{epiPorId.get(confirmDelete.epi_id)?.nome || "EPI não localizado"}</p>
                    <p className="text-muted-foreground text-xs mt-1">
                      {tipoLabels[confirmDelete.tipo] || confirmDelete.tipo} • {confirmDelete.quantidade}x • {fmtData(confirmDelete.data)}
                    </p>
                  </div>
                )}
                <p className="text-xs">
                  O estoque <strong>não</strong> é devolvido automaticamente. Se o EPI voltou para a
                  empresa, use <strong>devolução</strong> em vez de excluir.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (confirmDelete) remove(confirmDelete.id); setConfirmDelete(null); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setFormFuncSearch(""); setEpiCaSearch(""); setEpiList([]); setEpiDropdownResults([]); setDescarteSubstituicao(true); setDescarteDescricao(""); setDevolucaoTarget(null); setDevolucaoObs(""); setDevolucaoDestino("estoque"); } }}>
        <DialogContent className="sm:max-w-lg">
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
                  <SelectItem value="devolucao">↩️ Devolução</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Devolução é o EPI voltando: não há unidade de onde ele sai. */}
            <div className={normalizeEntregaTipo(form.tipo) === "devolucao" ? "hidden" : ""}>
              <Label>Local de Baixa (Unidade de Origem)</Label>
              <Select value={form.unidade_origem_id || ""} onValueChange={v => setForm({ ...form, unidade_origem_id: v })}>
                <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Selecione a unidade..." /></SelectTrigger>
                <SelectContent>
                  {unidades.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome} {u.tipo === "matriz" ? "(Matriz)" : u.tipo === "filial" ? "(Filial)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">De onde o EPI está saindo para esta entrega</p>
            </div>

            <div>
              <Label>Funcionário</Label>
              <Input
                placeholder="Buscar por CPF, matrícula ou nome..."
                value={formFuncSearch}
                onChange={e => { setFormFuncSearch(e.target.value); setForm({...form, funcionario_id: ""}); setDevolucaoTarget(null); }}
                className="mb-2"
              />
              {formFuncSearch && formFilteredFuncs.length > 0 && !form.funcionario_id && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {formFilteredFuncs.map(f => (
                    <button key={f.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                      onClick={() => { setForm({...form, funcionario_id: f.id}); setFormFuncSearch(f.nome); setDevolucaoTarget(null); }}>
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

            {/* Devolução: escolhe entre o que o colaborador tem em mãos, em vez
                de buscar no catálogo. É essa entrega que será marcada como
                devolvida e que o estorno usa para voltar atrás. */}
            {normalizeEntregaTipo(form.tipo) === "devolucao" ? (
              <>
                <div>
                  <Label>EPI a devolver</Label>
                  {!form.funcionario_id ? (
                    <p className="text-xs text-muted-foreground mt-1">Selecione o funcionário acima.</p>
                  ) : entregasDevolviveis.length === 0 ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Este colaborador não tem EPI ativo para devolver.
                    </p>
                  ) : (
                    <div className="mt-1 border rounded-md divide-y max-h-48 overflow-y-auto">
                      {entregasDevolviveis.map((it) => {
                        const epi = epiPorId.get(it.epi_id);
                        const escolhido = devolucaoTarget?.id === it.id;
                        return (
                          <button
                            key={it.id}
                            type="button"
                            onClick={() => setDevolucaoTarget(it)}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors ${escolhido ? "bg-primary/10" : "hover:bg-accent"}`}
                          >
                            <span className="font-medium">{epi?.nome || "EPI não localizado"}</span>
                            {epi?.ca && <span className="text-muted-foreground ml-2">C.A.: {epi.ca}</span>}
                            <span className="block text-xs text-muted-foreground">
                              {it.quantidade}x • entregue em {fmtData(it.data)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Destino</Label>
                  <Select value={devolucaoDestino} onValueChange={(v) => setDevolucaoDestino(v as "estoque" | "descarte")}>
                    <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {devolucaoDestinos.map((d) => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {devolucaoDestino === "estoque"
                      ? "O EPI volta para o estoque e fica disponível."
                      : "O EPI não retorna ao estoque (avaria ou descarte)."}
                  </p>
                </div>
              </>
            ) : (
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
            )}

            {/* Devolução usa a data de hoje (é quando o EPI voltou), definida
                pelo próprio fluxo de devolução. */}
            <div className={normalizeEntregaTipo(form.tipo) === "devolucao" ? "hidden" : ""}>
              <Label>Data</Label>
              <Input type="date" value={form.data} onChange={e => setForm({...form, data: e.target.value})} />
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea
                value={normalizeEntregaTipo(form.tipo) === "devolucao" ? devolucaoObs : form.observacao}
                onChange={e => normalizeEntregaTipo(form.tipo) === "devolucao"
                  ? setDevolucaoObs(e.target.value)
                  : setForm({ ...form, observacao: e.target.value })}
                placeholder="Observações opcionais"
              />
            </div>
          </div>
          <DialogFooter>
            {/* Devolução reaproveita confirmDevolver: é ele que marca a entrega
                de origem como devolvida, acerta o estoque conforme o destino e
                grava a trilha que o estorno usa depois. Duplicar essa lógica
                aqui seria abrir espaço para as duas versões divergirem. */}
            {normalizeEntregaTipo(form.tipo) === "devolucao" ? (
              <Button
                onClick={async () => { await confirmDevolver(); setOpen(false); }}
                disabled={!devolucaoTarget || devolucaoSaving}
              >
                {devolucaoSaving ? "Registrando..." : "Registrar Devolução"}
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={epiList.length === 0 || saving}>
                {saving ? "Salvando..." : `Registrar (${epiList.length} EPI${epiList.length !== 1 ? "s" : ""})`}
              </Button>
            )}
          </DialogFooter>
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
        <DialogContent className="sm:max-w-2xl sm:w-[95vw]">
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
                  
                  const handleCopyLink = () => {
                    const url = `${window.location.origin}/assinar/${signFuncId}`;
                    navigator.clipboard.writeText(`Acesse este link para assinar o recebimento dos seus EPIs: ${url}`);
                    toast({ title: "Link copiado!", description: "Envie este link para o colaborador assinar remotamente pelo celular." });
                  };

                  return (
                    <>
                      <div className="flex justify-end mb-2">
                        <Button variant="outline" size="sm" onClick={handleCopyLink} className="text-xs flex items-center gap-2">
                          <Link className="w-3 h-3" />
                          Copiar link p/ WhatsApp
                        </Button>
                      </div>
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
        <DialogContent className="sm:max-w-2xl">
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
                  {fichaFilteredFuncs.map(f => {
                    const count = entregaCountByFunc.get(f.id) || 0;
                    return (
                      <button key={f.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between"
                        onClick={() => { setFichaFuncId(f.id); setFichaSearch(f.nome); }}>
                        <div>
                          <span className="font-medium">{f.nome}</span>
                          {f.cpf && <span className="text-muted-foreground text-xs ml-2">CPF: {f.cpf}</span>}
                          {f.matricula && <span className="text-muted-foreground text-xs ml-2">Mat: {f.matricula}</span>}
                        </div>
                        <Badge variant={count > 0 ? "default" : "outline"} className="text-xs">
                          {count} {count === 1 ? "entrega" : "entregas"}
                        </Badge>
                      </button>
                    );
                  })}
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
        <DialogContent className="sm:max-w-md">
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
        <DialogContent className="sm:max-w-md">
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