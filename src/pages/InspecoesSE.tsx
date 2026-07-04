import { useState, useEffect, useRef, useCallback } from "react";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Filter, FileDown, Camera, X, Pencil, Trash2, Sparkles, Loader2, ImageIcon, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import DriveImage from "@/components/DriveImage";
import { extractGDriveFileId, getGDriveImageProxyUrl, getGDriveThumbnailUrl } from "@/lib/googleDrive";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { isOnline, addToSyncQueue, getCachedData, setCachedData } from "@/lib/offlineStorage";
import { isNetworkFailure } from "@/lib/offlineViewCache";
import jsPDF from "jspdf";

const GRAVIDADE_OPTIONS = ["LEVE", "MODERADO", "GRAVE", "RISCO CRÍTICO"];
const STATUS_OPTIONS = ["PENDENTE", "SOLUCIONADO"];
const LOAD_TIMEOUT_MS = 3000;

function isVencido(item: { prazo_correcao?: string | null; status: string }): boolean {
  if (!item.prazo_correcao || item.status === "SOLUCIONADO") return false;
  const today = format(new Date(), "yyyy-MM-dd");
  return item.prazo_correcao < today;
}

const withTimeout = <T,>(promise: Promise<T>, timeoutMs = LOAD_TIMEOUT_MS) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("timeout")), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  }) as Promise<T>;
};

interface Conformidade {
  id: string;
  numero: number;
  data_inspecao: string;
  situacao_detectada: string;
  foto_antes: string | null;
  foto_depois: string | null;
  gravidade: string;
  acao_corretiva: string | null;
  responsavel: string | null;
  local: string | null;
  data_realizado: string | null;
  prazo_correcao: string | null;
  resolved_by: string | null;
  status: string;
  empresa_id: string | null;
  created_at: string;
  referencia_normativa: string | null;
}

const emptyForm = {
  data_inspecao: format(new Date(), "yyyy-MM-dd"),
  situacao_detectada: "",
  gravidade: "LEVE",
  acao_corretiva: "",
  responsavel: "",
  local: "",
  prazo_correcao: "",
  data_realizado: "",
  status: "PENDENTE",
  referencia_normativa: "",
};

export default function InspecoesSE() {
  const { user, empresaId } = useAuth();
  const { canCreate, canDelete } = usePermissions("inspecoes_se");
  const [items, setItems] = useState<Conformidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportDateStart, setExportDateStart] = useState<Date | undefined>(undefined);
  const [exportDateEnd, setExportDateEnd] = useState<Date | undefined>(undefined);
  const { form, setForm, resetForm: resetDraft, hasDraft } = useFormDraft("inspecoes_se", emptyForm);
  const [fotoAntesFile, setFotoAntesFile] = useState<File | null>(null);
  const [fotoAntesPreview, setFotoAntesPreview] = useState<string | null>(null);
  const [fotoDepoisFile, setFotoDepoisFile] = useState<File | null>(null);
  const [fotoDepoisPreview, setFotoDepoisPreview] = useState<string | null>(null);
  const [existingFotoAntes, setExistingFotoAntes] = useState<string | null>(null);
  const [existingFotoDepois, setExistingFotoDepois] = useState<string | null>(null);
  const antesRef = useRef<HTMLInputElement>(null);
  const depoisRef = useRef<HTMLInputElement>(null);
  const antesGalleryRef = useRef<HTMLInputElement>(null);
  const depoisGalleryRef = useRef<HTMLInputElement>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const pdfImageCacheRef = useRef<Map<string, string | null>>(new Map());

  // Filters
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterGravidade, setFilterGravidade] = useState("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    const cached = (getCachedData<Conformidade>("conformidades") || []).filter(item => item.empresa_id === empresaId);

    if (!empresaId) {
      setItems([]);
      setLoading(false);
      return;
    }

    if (!isOnline()) {
      setItems(cached);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await withTimeout(
        (supabase.from as any)("conformidades")
          .select("*")
          .eq("empresa_id", empresaId)
          .order("numero", { ascending: true })
      ) as any;

      if (error) throw error;

      const records = (data || []) as Conformidade[];
      setItems(records);
      setCachedData("conformidades", records);
    } catch (error) {
      if (cached.length > 0 || isNetworkFailure(error)) {
        setItems(cached);
      } else {
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const handleOnline = () => {
      void loadData();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [loadData]);

  async function askAI() {
    if (!form.situacao_detectada.trim() || form.situacao_detectada.trim().length < 5) {
      toast({ title: "Digite pelo menos 5 caracteres na situação detectada", variant: "destructive" });
      return;
    }
    setAiLoading(true);
    try {
      const res = await supabase.functions.invoke("sugerir-nr", {
        body: { situacao: form.situacao_detectada },
      });
      if (res.error) throw res.error;
      const data = res.data;
      if (data.error) {
        toast({ title: "Erro da IA", description: data.error, variant: "destructive" });
      } else {
        setForm(p => ({
          ...p,
          referencia_normativa: data.referencia_normativa || p.referencia_normativa,
          gravidade: data.gravidade || p.gravidade,
          acao_corretiva: data.acao_corretiva || p.acao_corretiva,
        }));
        const desc = data.trecho_norma
          ? `NR: ${data.referencia_normativa}\n📖 ${data.trecho_norma}`
          : `NR: ${data.referencia_normativa}`;
        toast({ title: "Sugestão aplicada!", description: desc });
      }
    } catch (err: any) {
      toast({ title: "Erro ao consultar IA", description: err?.message || "Tente novamente", variant: "destructive" });
    }
    setAiLoading(false);
  }

  function openNew() {
    setEditingId(null);
    setErrors({});
    if (!hasDraft()) resetDraft();
    else setForm(form); // keep draft
    clearPhotoPreviews();
    setDialogOpen(true);
  }

  function openEdit(item: Conformidade) {
    setEditingId(item.id);
    setErrors({});
    setForm({
      data_inspecao: item.data_inspecao,
      situacao_detectada: item.situacao_detectada,
      gravidade: item.gravidade,
      acao_corretiva: item.acao_corretiva || "",
      responsavel: item.responsavel || "",
      local: item.local || "",
      prazo_correcao: item.prazo_correcao || "",
      data_realizado: item.data_realizado || "",
      status: item.status,
      referencia_normativa: item.referencia_normativa || "",
    });
    setExistingFotoAntes(item.foto_antes);
    setExistingFotoDepois(item.foto_depois);
    setFotoAntesFile(null);
    setFotoAntesPreview(null);
    setFotoDepoisFile(null);
    setFotoDepoisPreview(null);
    setDialogOpen(true);
  }

  function clearPhotoPreviews() {
    setFotoAntesFile(null);
    setFotoAntesPreview(null);
    setFotoDepoisFile(null);
    setFotoDepoisPreview(null);
    setExistingFotoAntes(null);
    setExistingFotoDepois(null);
  }

  async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<File> {
    try {
      if (!file.type.startsWith("image/")) return file;
      const bitmap = await createImageBitmap(file).catch(() => null);
      if (!bitmap) return file;
      let { width, height } = bitmap;
      const scale = Math.min(1, maxDim / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob: Blob | null = await new Promise(r => canvas.toBlob(r, "image/jpeg", quality));
      if (!blob) return file;
      return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
    } catch {
      return file;
    }
  }

  async function handleFileSelect(file: File, type: "antes" | "depois") {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Selecione uma imagem (JPG, PNG ou WEBP).", variant: "destructive" });
      return;
    }
    const compressed = await compressImage(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (type === "antes") {
        setFotoAntesFile(compressed);
        setFotoAntesPreview(dataUrl);
        setErrors(prev => ({ ...prev, foto_antes: "" }));
      } else {
        setFotoDepoisFile(compressed);
        setFotoDepoisPreview(dataUrl);
      }
    };
    reader.readAsDataURL(compressed);
  }

  async function uploadPhoto(file: File, label: "antes" | "depois"): Promise<string> {
    if (!file || !(file instanceof Blob) || file.size === 0) {
      throw new Error(`Foto ${label} inválida (arquivo vazio).`);
    }
    console.log(`[Inspecoes] uploadPhoto ${label}`, {
      empresaId,
      userId: user?.id,
      folder: "inspecoes",
      fileName: file.name,
      fileType: file.type,
      sizeKB: Math.round(file.size / 1024),
    });
    const { uploadToDrive } = await import("@/lib/googleDriveStorage");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const result = await uploadToDrive(
      file,
      "inspecoes",
      `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    );
    console.log(`[Inspecoes] uploadPhoto ${label} OK →`, result.publicUrl);
    return result.publicUrl;
  }

  function buildPayload(foto_antes: string | null, foto_depois: string | null) {
    const isSolucionado = form.status === "SOLUCIONADO";
    return {
      data_inspecao: form.data_inspecao,
      situacao_detectada: form.situacao_detectada,
      gravidade: form.gravidade,
      acao_corretiva: form.acao_corretiva || null,
      responsavel: form.responsavel || null,
      local: form.local || null,
      prazo_correcao: form.prazo_correcao || null,
      // data_realizado only when solucionado; on new/pending inspections stays null
      data_realizado: isSolucionado ? (form.data_realizado || format(new Date(), "yyyy-MM-dd")) : null,
      resolved_by: isSolucionado ? (user?.id || null) : null,
      status: form.status,
      foto_antes,
      foto_depois,
      referencia_normativa: form.referencia_normativa || null,
      empresa_id: empresaId,
      created_by: user?.id,
    };
  }

  function saveOffline(payload: any) {
    const cached = (getCachedData<Conformidade>("conformidades") || []).filter(item => item.empresa_id === empresaId);

    if (editingId) {
      addToSyncQueue({ table: "conformidades", type: "update", payload: { id: editingId, ...payload } });
      const updated = cached.map(c => c.id === editingId ? { ...c, ...payload } : c);
      setCachedData("conformidades", updated);
      setItems(updated);
      toast({ title: "Atualizado offline", description: "Será sincronizado quando houver conexão." });
      return;
    }

    const nextNumero = (cached.length > 0 ? Math.max(...cached.map(i => i.numero || 0)) : 0) + 1;
    const offlineRecord = {
      ...payload,
      id: crypto.randomUUID(),
      numero: nextNumero,
      created_at: new Date().toISOString(),
    } as Conformidade;

    addToSyncQueue({ table: "conformidades", type: "insert", payload: offlineRecord });
    const updated = [...cached, offlineRecord].sort((a, b) => a.numero - b.numero);
    setCachedData("conformidades", updated);
    setItems(updated);
    toast({ title: "Salvo offline", description: "Será sincronizado quando houver conexão." });
  }

  async function handleSave() {
    const newErrors: Record<string, string> = {};
    if (!form.data_inspecao) newErrors.data_inspecao = "Informe a data.";
    if (!form.local.trim()) newErrors.local = "Informe o local.";
    if (!form.situacao_detectada.trim()) newErrors.situacao_detectada = "Descreva a situação detectada.";
    if (!form.acao_corretiva.trim()) newErrors.acao_corretiva = "Descreva a ação corretiva.";
    if (!form.responsavel.trim()) newErrors.responsavel = "Informe o responsável.";
    if (!form.prazo_correcao) newErrors.prazo_correcao = "Informe o prazo de correção.";
    if (!fotoAntesFile && !fotoAntesPreview && !existingFotoAntes) {
      newErrors.foto_antes = "Anexe a foto ANTES (obrigatória).";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({ title: "Verifique os campos obrigatórios", variant: "destructive" });
      // scroll to first error
      setTimeout(() => {
        const el = document.querySelector("[data-error='true']") as HTMLElement | null;
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }
    setErrors({});

    setSaving(true);
    try {
      let foto_antes = existingFotoAntes;
      let foto_depois = existingFotoDepois;
      let shouldSaveOffline = !isOnline();

      if (!shouldSaveOffline) {
        // Safety: Foto DEPOIS só faz sentido quando SOLUCIONADO. Ignora arquivo em outros status.
        const shouldUploadDepois = form.status === "SOLUCIONADO" && !!fotoDepoisFile;
        console.log("[Inspecoes] handleSave upload plan", {
          status: form.status,
          hasFotoAntesFile: !!fotoAntesFile,
          hasFotoDepoisFile: !!fotoDepoisFile,
          willUploadDepois: shouldUploadDepois,
          empresaId,
        });
        try {
          const uploads = await Promise.all([
            fotoAntesFile ? uploadPhoto(fotoAntesFile, "antes") : Promise.resolve(null),
            shouldUploadDepois ? uploadPhoto(fotoDepoisFile!, "depois") : Promise.resolve(null),
          ]);

          if (uploads[0]) foto_antes = uploads[0];
          if (uploads[1]) foto_depois = uploads[1];
        } catch (error: any) {
          console.error("[Inspecoes] Falha no upload Google Drive:", error, {
            message: error?.message,
            stack: error?.stack,
          });
          if (isNetworkFailure(error)) {
            shouldSaveOffline = true;
          } else {
            // Fallback: salva offline com base64 e a fila de sync tenta reenviar depois.
            toast({
              title: "Não foi possível enviar a foto",
              description: "Verifique a conexão ou permissão do Google Drive. Salvamos localmente e tentaremos reenviar automaticamente.",
              variant: "destructive",
            });
            shouldSaveOffline = true;
          }
        }
      }

      if (shouldSaveOffline) {
        if (fotoAntesPreview) foto_antes = fotoAntesPreview;
        if (fotoDepoisPreview && form.status === "SOLUCIONADO") foto_depois = fotoDepoisPreview;
      }

      const payload = buildPayload(foto_antes || null, foto_depois || null);

      if (editingId) {
        if (!shouldSaveOffline) {
          const { error } = await (supabase.from as any)("conformidades").update(payload).eq("id", editingId);
          if (error) throw error;
        } else {
          saveOffline(payload);
        }
        if (!shouldSaveOffline) {
          toast({ title: "Registro atualizado!" });
        }
      } else {
        if (!shouldSaveOffline) {
          const { error } = await (supabase.from as any)("conformidades").insert(payload);
          if (error) throw error;
        } else {
          saveOffline(payload);
        }
        if (!shouldSaveOffline) {
          toast({ title: "Registro criado!" });
        }
      }

      resetDraft();
      setDialogOpen(false);
      if (!shouldSaveOffline) {
        void loadData();
      }
    } catch (err: any) {
      if (!isOnline() || isNetworkFailure(err) || err?.message?.includes("fetch")) {
        const payload = buildPayload(
          fotoAntesPreview || existingFotoAntes || null,
          fotoDepoisPreview || existingFotoDepois || null,
        );
        saveOffline(payload);
        resetDraft();
        setDialogOpen(false);
      } else {
        toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
      }
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este registro?")) return;
    try {
      if (isOnline()) {
        const { error } = await (supabase.from as any)("conformidades").delete().eq("id", id);
        if (error) throw error;
      }
      toast({ title: "Registro excluído" });
      void loadData();
    } catch (error) {
      if (!isOnline() || isNetworkFailure(error)) {
        addToSyncQueue({ table: "conformidades", type: "delete", payload: { id } });
        const cached = (getCachedData<Conformidade>("conformidades") || []).filter(item => item.empresa_id === empresaId);
        const updated = cached.filter(c => c.id !== id);
        setCachedData("conformidades", updated);
        setItems(updated);
        toast({ title: "Excluído offline", description: "Será sincronizado quando houver conexão." });
        return;
      }

      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  }

  const MAX_IMG_WIDTH = 600;
  const IMG_TIMEOUT_MS = 9000;

  async function resolveDriveUrl(url: string): Promise<string> {
    if (!url.includes("drive.google.com")) return url;

    // Priority 1: proxy URL (avoids CORS, most reliable for PDF fetch)
    const proxyUrl = getGDriveImageProxyUrl(url);
    if (proxyUrl) return proxyUrl;

    // Fallback: thumbnail URL
    const thumbnailUrl = getGDriveThumbnailUrl(url, MAX_IMG_WIDTH);
    if (thumbnailUrl) return thumbnailUrl;

    const fileId = extractGDriveFileId(url);
    if (!fileId) return url;

    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${MAX_IMG_WIDTH}`;
  }

  /** Gera um placeholder base64 "Imagem Indisponível" para fallback */
  function generatePlaceholderDataUrl(): string {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 200;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(0, 0, 320, 200);
    ctx.fillStyle = "#9ca3af";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Imagem Indisponível", 160, 100);
    return canvas.toDataURL("image/jpeg", 0.8);
  }

  /** Redimensiona imagem no canvas para max 800px de largura e comprime como JPEG */
  function resizeImageToDataUrl(source: HTMLImageElement | ImageBitmap): string {
    let w = "width" in source ? source.width : (source as any).width;
    let h = "height" in source ? source.height : (source as any).height;
    if (w > MAX_IMG_WIDTH) {
      h = Math.round(h * (MAX_IMG_WIDTH / w));
      w = MAX_IMG_WIDTH;
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(source as any, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.5);
  }

  /** Tenta carregar imagem via fetch blob, retorna dataUrl ou null */
  async function fetchImageAsDataUrl(fetchUrl: string, timeoutMs: number): Promise<string | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(fetchUrl, { mode: "cors", signal: controller.signal });
      clearTimeout(timeoutId);
      if (!resp.ok) return null;
      const blob = await resp.blob();
      // Accept image types OR octet-stream (proxy may not always set correct type)
      const isImage = blob.type.startsWith("image/") || blob.type === "application/octet-stream" || blob.type === "";
      if (!isImage && blob.size < 500) return null;
      // Extra check: if blob is too small it's likely an error page
      if (blob.size < 200) return null;
      const blobUrl = URL.createObjectURL(blob);
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        const dataUrl = await new Promise<string>((resolve, reject) => {
          img.onload = () => resolve(resizeImageToDataUrl(img));
          img.onerror = () => reject(new Error("img load failed"));
          img.src = blobUrl;
        });
        return dataUrl;
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }

  async function loadImageAsDataUrlOnce(url: string): Promise<string | null> {
    const cached = pdfImageCacheRef.current.get(url);
    if (cached !== undefined) return cached;

    try {
      const resolvedUrl = await resolveDriveUrl(url);
      const result = await fetchImageAsDataUrl(resolvedUrl, IMG_TIMEOUT_MS);
      if (result) {
        pdfImageCacheRef.current.set(url, result);
        return result;
      }

      const fileId = extractGDriveFileId(url);
      if (fileId) {
        const proxyUrl = getGDriveImageProxyUrl(url);
        if (proxyUrl && proxyUrl !== resolvedUrl) {
          const proxyResult = await fetchImageAsDataUrl(proxyUrl, IMG_TIMEOUT_MS);
          if (proxyResult) {
            pdfImageCacheRef.current.set(url, proxyResult);
            return proxyResult;
          }
        }

        const thumbUrl = getGDriveThumbnailUrl(url, MAX_IMG_WIDTH);
        if (thumbUrl && thumbUrl !== resolvedUrl) {
          const thumbResult = await fetchImageAsDataUrl(thumbUrl, IMG_TIMEOUT_MS);
          if (thumbResult) {
            pdfImageCacheRef.current.set(url, thumbResult);
            return thumbResult;
          }
        }

        const imgSrc = proxyUrl || thumbUrl;
        if (imgSrc) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          const imgResult = await new Promise<string | null>((resolve) => {
            const t = setTimeout(() => resolve(null), IMG_TIMEOUT_MS);
            img.onload = () => { clearTimeout(t); resolve(resizeImageToDataUrl(img)); };
            img.onerror = () => { clearTimeout(t); resolve(null); };
            img.src = imgSrc;
          });
          if (imgResult) {
            pdfImageCacheRef.current.set(url, imgResult);
            return imgResult;
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /** loadImageAsDataUrl com retry (até 3 tentativas, intervalo 500ms) */
  async function loadImageAsDataUrl(url: string): Promise<string | null> {
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const result = await loadImageAsDataUrlOnce(url);
      if (result) return result;
      // Limpa cache de falha para permitir nova tentativa
      pdfImageCacheRef.current.delete(url);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    return null;
  }

  function isValidPdfImageUrl(url: string | null | undefined): url is string {
    if (!url || typeof url !== "string") return false;
    return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:");
  }

  async function generatePDF(dateRange?: { start?: Date; end?: Date }) {
    toast({ title: "Gerando PDF...", description: "Aguarde, carregando imagens." });

    // Clear stale cache so failed attempts don't persist across PDFs
    pdfImageCacheRef.current.clear();

    // Load empresa logo & name
    let logoDataUrl: string | null = null;
    let empresaNome = "";
    try {
      if (empresaId && isOnline()) {
        const { data: empresa } = await (supabase.from as any)("empresa_config")
          .select("logo_url, nome")
          .eq("id", empresaId)
          .limit(1)
          .single();
        if (isValidPdfImageUrl(empresa?.logo_url)) {
          logoDataUrl = await loadImageAsDataUrl(empresa.logo_url);
        }
        empresaNome = empresa?.nome || "";
      }
    } catch {}

    // Pre-load all item photos IN PARALLEL with allSettled (never skip slow images)
    const filtered = getFilteredItems(dateRange);
    const photoCache: Record<string, { antes: string | null; depois: string | null }> = {};
    const placeholderDataUrl = generatePlaceholderDataUrl();
    const photoPromises = filtered.map(async (item) => {
      const [antes, depois] = await Promise.all([
        isValidPdfImageUrl(item.foto_antes) ? loadImageAsDataUrl(item.foto_antes) : Promise.resolve(null),
        isValidPdfImageUrl(item.foto_depois) ? loadImageAsDataUrl(item.foto_depois) : Promise.resolve(null),
      ]);
      photoCache[item.id] = {
        antes: isValidPdfImageUrl(item.foto_antes) ? (antes || placeholderDataUrl) : null,
        depois: isValidPdfImageUrl(item.foto_depois) ? (depois || placeholderDataUrl) : null,
      };
    });
    await Promise.allSettled(photoPromises);

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const ROW_H = 58;
    const IMG_H = 48;
    const IMG_W = 48;
    const MARGIN = 10;
    const tableWidth = pageWidth - MARGIN * 2;

    // Color helpers
    const getGravidadeColor = (g: string): [number, number, number] => {
      const upper = (g || "").toUpperCase();
      if (upper.includes("CRÍTICO") || upper.includes("CRITICO") || upper.includes("GRAVE")) return [220, 38, 38]; // red
      if (upper.includes("MODERADO")) return [202, 138, 4]; // amber/yellow
      if (upper.includes("LEVE")) return [37, 99, 235]; // blue
      return [0, 0, 0];
    };

    const getStatusColor = (s: string): [number, number, number] => {
      const upper = (s || "").toUpperCase();
      if (upper === "PENDENTE") return [220, 38, 38]; // red
      if (upper === "SOLUCIONADO") return [22, 163, 74]; // green
      return [0, 0, 0];
    };


    // --- Header ---
    let headerY = 8;
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", MARGIN, 5, 30, 15);
    }
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("GESTÃO DE CONFORMIDADES - INSPEÇÕES", pageWidth / 2, headerY + 5, { align: "center" });
    // Company name removed from PDF header per user request
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth / 2, headerY + 16, { align: "center" });
    doc.setTextColor(0, 0, 0);

    // Table columns - Ref. Normativa merged into Situação; extra space to photos
    const headers = ["N°", "Data", "Situação Detectada", "Foto Antes", "Foto Depois", "Gravidade", "Ação Corretiva", "Responsável", "Local", "Realizado", "Status"];
    const usableWidth = pageWidth - MARGIN * 2;
    const colWidths = [9, 17, 52, 42, 42, 18, 36, 20, 20, 17, 26];
    const totalCols = colWidths.reduce((a, b) => a + b, 0);
    // Scale columns to fill usable width
    const scale = usableWidth / totalCols;
    const scaledWidths = colWidths.map(w => w * scale);
    const totalScaled = scaledWidths.reduce((a, b) => a + b, 0);
    const tableStartX = (pageWidth - totalScaled) / 2;

    let y = headerY + 22;

    // Draw table header
    const drawTableHeader = () => {
      doc.setFillColor(30, 58, 110);
      doc.rect(tableStartX, y, totalScaled, 9, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      let x = tableStartX;
      headers.forEach((h, i) => {
        const textW = doc.getTextWidth(h);
        doc.text(h, x + (scaledWidths[i] - textW) / 2, y + 6);
        x += scaledWidths[i];
      });
      y += 9;
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
    };

    drawTableHeader();

    // Helper: draw vertically & horizontally centered wrapped text
    const drawCenteredText = (text: string, cellX: number, cellY: number, cellW: number, cellH: number, fontSize = 6, bold = false, color?: [number, number, number]) => {
      doc.setFontSize(fontSize);
      if (bold) doc.setFont("helvetica", "bold");
      else doc.setFont("helvetica", "normal");
      if (color) doc.setTextColor(color[0], color[1], color[2]);
      const lines: string[] = doc.splitTextToSize(text, cellW - 4);
      const lineH = fontSize * 0.4;
      const blockH = lines.length * lineH;
      const startY = cellY + (cellH - blockH) / 2 + lineH;
      lines.forEach((line: string, li: number) => {
        const lw = doc.getTextWidth(line);
        doc.text(line, cellX + (cellW - lw) / 2, startY + li * lineH);
      });
      if (color) doc.setTextColor(0, 0, 0);
      if (bold) doc.setFont("helvetica", "normal");
    };

    // Draw rows
    filtered.forEach((item, idx) => {
      if (y + ROW_H > pageHeight - 10) {
        doc.setFontSize(6);
        doc.setTextColor(150);
        doc.text(`Página ${doc.getNumberOfPages()}`, pageWidth / 2, pageHeight - 5, { align: "center" });
        doc.setTextColor(0);
        doc.addPage();
        y = 12;
        drawTableHeader();
      }

      // Row background
      const rowBg = idx % 2 === 0 ? [250, 250, 250] : [255, 255, 255];
      doc.setFillColor(rowBg[0], rowBg[1], rowBg[2]);
      doc.rect(tableStartX, y, totalScaled, ROW_H, "F");

      // Border
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.rect(tableStartX, y, totalScaled, ROW_H, "S");

      // Vertical cell lines
      let xLine = tableStartX;
      scaledWidths.forEach((w) => {
        doc.line(xLine, y, xLine, y + ROW_H);
        xLine += w;
      });

      let x = tableStartX;

      // N° - centered bold
      drawCenteredText(String(idx + 1), x, y, scaledWidths[0], ROW_H, 7, true);
      x += scaledWidths[0];

      // Data - centered
      const dataStr = item.data_inspecao ? format(new Date(item.data_inspecao + "T12:00:00"), "dd/MM/yyyy") : "";
      drawCenteredText(dataStr, x, y, scaledWidths[1], ROW_H, 6);
      x += scaledWidths[1];

      // Situação + Ref. Normativa merged
      {
        const nrPrefix = item.referencia_normativa ? `[${item.referencia_normativa}]\n` : "";
        const situacaoText = nrPrefix + (item.situacao_detectada || "");

        // Draw NR in bold then situação in normal
        if (item.referencia_normativa) {
          const cellW = scaledWidths[2];
          const cellH = ROW_H;
          const nrLine = `[${item.referencia_normativa}]`;
          doc.setFontSize(5.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 58, 110);
          const nrLines: string[] = doc.splitTextToSize(nrLine, cellW - 4);
          const lineH = 5.5 * 0.4;

          doc.setFont("helvetica", "normal");
          doc.setTextColor(0, 0, 0);
          const sitLines: string[] = doc.splitTextToSize(item.situacao_detectada || "", cellW - 4);
          const totalLines = nrLines.length + sitLines.length;
          const blockH = totalLines * lineH;
          const startY = y + (cellH - blockH) / 2 + lineH;

          // Draw NR bold
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 58, 110);
          nrLines.forEach((line: string, li: number) => {
            doc.text(line, x + 2, startY + li * lineH);
          });

          // Draw situação normal
          doc.setFont("helvetica", "normal");
          doc.setTextColor(0, 0, 0);
          sitLines.forEach((line: string, li: number) => {
            doc.text(line, x + 2, startY + (nrLines.length + li) * lineH);
          });
        } else {
          drawCenteredText(item.situacao_detectada || "", x, y, scaledWidths[2], ROW_H, 5.5);
        }
      }
      x += scaledWidths[2];

      // Helper: get image dimensions from base64 data URL synchronously via jsPDF
      const getImageDimensions = (dataUrl: string): { w: number; h: number } => {
        try {
          // Use jsPDF's internal getImageProperties to read real dimensions
          const props = (doc as any).getImageProperties(dataUrl);
          if (props && props.width > 0 && props.height > 0) {
            return { w: props.width, h: props.height };
          }
        } catch { /* fallback below */ }
        return { w: 0, h: 0 };
      };

      // Helper: draw image fitted inside cell with padding, preserving aspect ratio
      const CELL_PAD = 2; // mm padding inside cell
      const drawFittedImage = (dataUrl: string, cellX: number, cellY: number, cellW: number, cellH: number) => {
        const maxW = cellW - CELL_PAD * 2;
        const maxH = cellH - CELL_PAD * 2;
        if (maxW <= 0 || maxH <= 0) return;

        const dims = getImageDimensions(dataUrl);
        const naturalW = dims.w || maxW;
        const naturalH = dims.h || maxH;
        const aspect = naturalW / naturalH;

        let drawW: number;
        let drawH: number;

        if (aspect >= 1) {
          // Landscape or square: fit to width first
          drawW = maxW;
          drawH = drawW / aspect;
          if (drawH > maxH) {
            drawH = maxH;
            drawW = drawH * aspect;
          }
        } else {
          // Portrait: fit to height first
          drawH = maxH;
          drawW = drawH * aspect;
          if (drawW > maxW) {
            drawW = maxW;
            drawH = drawW / aspect;
          }
        }

        const drawX = cellX + (cellW - drawW) / 2;
        const drawY = cellY + (cellH - drawH) / 2;
        doc.addImage(dataUrl, "JPEG", drawX, drawY, drawW, drawH);
      };

      // Helper: draw "sem foto" placeholder as grey box
      const drawNoPhoto = (cellX: number, cellY: number, cellW: number, cellH: number) => {
        const boxW = Math.min(cellW - 4, IMG_W - 4);
        const boxH = Math.min(cellH - 4, IMG_H - 4);
        const bx = cellX + (cellW - boxW) / 2;
        const by = cellY + (cellH - boxH) / 2;
        doc.setFillColor(240, 240, 240);
        doc.setDrawColor(210, 210, 210);
        doc.roundedRect(bx, by, boxW, boxH, 1.5, 1.5, "FD");
        doc.setFontSize(5);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(170, 170, 170);
        const label = "Sem foto";
        const lw = doc.getTextWidth(label);
        doc.text(label, bx + (boxW - lw) / 2, by + boxH / 2 + 1.5);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
      };

      // Foto Antes - fitted inside cell
      const cache = photoCache[item.id];
      if (cache?.antes) {
        try {
          drawFittedImage(cache.antes, x, y, scaledWidths[3], ROW_H);
        } catch {
          drawNoPhoto(x, y, scaledWidths[3], ROW_H);
        }
      } else {
        drawNoPhoto(x, y, scaledWidths[3], ROW_H);
      }
      x += scaledWidths[3];

      // Foto Depois - fitted inside cell
      if (cache?.depois) {
        try {
          drawFittedImage(cache.depois, x, y, scaledWidths[4], ROW_H);
        } catch {
          drawNoPhoto(x, y, scaledWidths[4], ROW_H);
        }
      } else {
        drawNoPhoto(x, y, scaledWidths[4], ROW_H);
      }
      x += scaledWidths[4];

      // Gravidade - filled cell background with white text for critical levels
      const gravText = item.gravidade || "";
      const gravUpper = gravText.toUpperCase();
      const isGravCritical = gravUpper.includes("CRÍTICO") || gravUpper.includes("CRITICO") || gravUpper.includes("GRAVE") || gravUpper.includes("ALTA");
      const isGravModerado = gravUpper.includes("MODERADO");
      if (isGravCritical) {
        doc.setFillColor(220, 38, 38);
        doc.rect(x, y, scaledWidths[5], ROW_H, "F");
        drawCenteredText(gravText, x, y, scaledWidths[5], ROW_H, 6.5, true, [255, 255, 255]);
      } else if (isGravModerado) {
        doc.setFillColor(234, 179, 8);
        doc.rect(x, y, scaledWidths[5], ROW_H, "F");
        drawCenteredText(gravText, x, y, scaledWidths[5], ROW_H, 6.5, true, [255, 255, 255]);
      } else {
        doc.setFillColor(59, 130, 246);
        doc.rect(x, y, scaledWidths[5], ROW_H, "F");
        drawCenteredText(gravText, x, y, scaledWidths[5], ROW_H, 6.5, true, [255, 255, 255]);
      }
      x += scaledWidths[5];

      // Ação Corretiva - centered wrapped
      drawCenteredText(item.acao_corretiva || "", x, y, scaledWidths[6], ROW_H, 5.5);
      x += scaledWidths[6];

      // Responsável - centered
      drawCenteredText(item.responsavel || "", x, y, scaledWidths[7], ROW_H, 6);
      x += scaledWidths[7];

      // Local - centered
      drawCenteredText(item.local || "", x, y, scaledWidths[8], ROW_H, 6);
      x += scaledWidths[8];

      // Realizado - centered
      const realStr = item.data_realizado ? format(new Date(item.data_realizado + "T12:00:00"), "dd/MM/yyyy") : "—";
      drawCenteredText(realStr, x, y, scaledWidths[9], ROW_H, 6);
      x += scaledWidths[9];

      // Status - filled cell background with white text
      const statusText = item.status || "";
      const isPendente = statusText.toUpperCase() === "PENDENTE";
      const isSolucionado = statusText.toUpperCase() === "SOLUCIONADO";
      if (isPendente) {
        doc.setFillColor(220, 38, 38);
        doc.rect(x, y, scaledWidths[10], ROW_H, "F");
        drawCenteredText(statusText, x, y, scaledWidths[10], ROW_H, 6.5, true, [255, 255, 255]);
      } else if (isSolucionado) {
        doc.setFillColor(22, 163, 74);
        doc.rect(x, y, scaledWidths[10], ROW_H, "F");
        drawCenteredText(statusText, x, y, scaledWidths[10], ROW_H, 6.5, true, [255, 255, 255]);
      } else {
        drawCenteredText(statusText, x, y, scaledWidths[10], ROW_H, 6, true);
      }

      y += ROW_H;
    });

    // Footer on last page
    doc.setFontSize(6);
    doc.setTextColor(150);
    doc.text(`Página ${doc.getNumberOfPages()}`, pageWidth / 2, pageHeight - 5, { align: "center" });
    doc.setTextColor(0);

    doc.save(`Conformidades_${format(new Date(), "yyyy-MM-dd")}.pdf`);

    // Free memory: clear cached Base64 strings
    pdfImageCacheRef.current.clear();
    Object.keys(photoCache).forEach((k) => delete photoCache[k]);

    toast({ title: "PDF gerado com sucesso!" });
  }

  function getFilteredItems(opts?: { start?: Date; end?: Date }) {
    return items.filter(i => {
      if (filterStatus !== "all" && i.status !== filterStatus) return false;
      if (filterGravidade !== "all" && i.gravidade !== filterGravidade) return false;
      if (opts?.start || opts?.end) {
        const d = i.data_inspecao ? new Date(i.data_inspecao + "T00:00:00") : null;
        if (!d) return false;
        if (opts.start && d < new Date(format(opts.start, "yyyy-MM-dd") + "T00:00:00")) return false;
        if (opts.end && d > new Date(format(opts.end, "yyyy-MM-dd") + "T23:59:59")) return false;
      }
      return true;
    });
  }

  const filtered = getFilteredItems();
  const pendentes = items.filter(i => i.status === "PENDENTE").length;
  const solucionados = items.filter(i => i.status === "SOLUCIONADO").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inspeções</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de conformidades e não conformidades</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canCreate && (
            <Button onClick={openNew} size="sm" className="min-h-[40px]">
              <Plus className="w-4 h-4 mr-1.5" /> Novo Registro
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setExportDateStart(undefined);
              setExportDateEnd(undefined);
              setExportDialogOpen(true);
            }}
            className="min-h-[40px]"
          >
            <FileDown className="w-4 h-4 mr-1.5" /> Gerar PDF
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold">{items.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total de Registros</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{pendentes}</p>
          <p className="text-xs text-amber-600 mt-1">Pendentes</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{solucionados}</p>
          <p className="text-xs text-green-600 mt-1">Solucionados</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px] h-10"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            <SelectItem value="PENDENTE">Pendente</SelectItem>
            <SelectItem value="SOLUCIONADO">Solucionado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterGravidade} onValueChange={setFilterGravidade}>
          <SelectTrigger className="w-[160px] h-10"><SelectValue placeholder="Gravidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Gravidades</SelectItem>
            {GRAVIDADE_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="py-16 px-6 text-center border rounded-lg bg-muted/20 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Camera className="w-7 h-7 text-primary" />
          </div>
          <p className="text-base font-semibold">
            {items.length === 0 ? "Nenhuma inspeção registrada ainda." : "Nenhum registro encontrado com os filtros atuais."}
          </p>
          {canCreate && items.length === 0 && (
            <Button onClick={openNew} className="mt-2 min-h-[44px]">
              <Plus className="w-4 h-4 mr-1.5" /> Criar primeira inspeção
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Cards */}
          <div className="hidden md:block space-y-3">
            {filtered.map((item, idx) => (
              <div key={item.id} className="border rounded-lg bg-card hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => openEdit(item)}>
                <div className="flex gap-4 p-4">
                  {/* Left: Number + Photos */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-2">
                    <span className="text-lg font-bold text-muted-foreground w-8 text-center">{idx + 1}</span>
                    <div className="flex gap-2">
                      {item.foto_antes ? (
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground font-semibold mb-1">ANTES</p>
                          <DriveImage src={item.foto_antes} alt="Antes" className="w-28 h-20 object-cover rounded-md border" thumbnail />
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground font-semibold mb-1">ANTES</p>
                          <div className="w-28 h-20 rounded-md border bg-muted/40 flex items-center justify-center">
                            <span className="text-[10px] text-muted-foreground">Sem foto</span>
                          </div>
                        </div>
                      )}
                      {item.foto_depois ? (
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground font-semibold mb-1">DEPOIS</p>
                          <DriveImage src={item.foto_depois} alt="Depois" className="w-28 h-20 object-cover rounded-md border" thumbnail />
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground font-semibold mb-1">DEPOIS</p>
                          <div className="w-28 h-20 rounded-md border bg-muted/40 flex items-center justify-center">
                            <span className="text-[10px] text-muted-foreground">Sem foto</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Center: Main content */}
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Top badges row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {item.data_inspecao ? format(new Date(item.data_inspecao + "T12:00:00"), "dd/MM/yyyy") : "—"}
                      </span>
                      <GravidadeBadge gravidade={item.gravidade} />
                      {item.referencia_normativa && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-medium">
                          <Sparkles className="w-3 h-3" />{item.referencia_normativa}
                        </span>
                      )}
                      {item.local && <span className="text-xs text-muted-foreground">📍 {item.local}</span>}
                    </div>

                    {/* Situação detectada */}
                    <p className="text-sm leading-relaxed break-words">{item.situacao_detectada}</p>

                    {/* Ação corretiva */}
                    {item.acao_corretiva && (
                      <div className="bg-muted/30 rounded-md px-3 py-2">
                        <p className="text-[10px] text-muted-foreground font-semibold mb-0.5">AÇÃO CORRETIVA</p>
                        <p className="text-xs leading-relaxed">{item.acao_corretiva}</p>
                      </div>
                    )}

                    {/* Bottom info */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {item.responsavel && <span><strong>Resp:</strong> {item.responsavel}</span>}
                      {item.data_realizado && (
                        <span><strong>Realizado:</strong> {format(new Date(item.data_realizado + "T12:00:00"), "dd/MM/yyyy")}</span>
                      )}
                    </div>
                  </div>

                  {/* Right: Status + Actions */}
                  <div className="flex-shrink-0 flex flex-col items-end justify-between">
                    <Badge variant={item.status === "SOLUCIONADO" ? "default" : "secondary"}
                      className={item.status === "SOLUCIONADO" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-amber-500 hover:bg-amber-600 text-white"}>
                      {item.status}
                    </Badge>
                    {isVencido(item) && (
                      <Badge className="bg-red-600 hover:bg-red-700 text-white mt-1">VENCIDO</Badge>
                    )}
                    {!item.prazo_correcao && item.status !== "SOLUCIONADO" && (
                      <Badge variant="outline" className="border-dashed text-muted-foreground mt-1">Prazo não informado</Badge>
                    )}
                    <div className="flex gap-1 mt-2" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {canDelete && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((item, idx) => (
              <div key={item.id} className="border rounded-lg p-3 space-y-3 bg-card" onClick={() => openEdit(item)}>
                {/* Top row: N°, Status, Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.data_inspecao ? format(new Date(item.data_inspecao + "T12:00:00"), "dd/MM/yyyy") : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isVencido(item) && (
                      <Badge className="bg-red-600 text-white text-[10px]">VENCIDO</Badge>
                    )}
                    {!item.prazo_correcao && item.status !== "SOLUCIONADO" && (
                      <Badge variant="outline" className="border-dashed text-[10px] text-muted-foreground">Prazo não informado</Badge>
                    )}
                    <Badge variant={item.status === "SOLUCIONADO" ? "default" : "secondary"}
                      className={item.status === "SOLUCIONADO" ? "bg-green-600 text-white text-[10px]" : "bg-amber-500 text-white text-[10px]"}>
                      {item.status}
                    </Badge>
                    <div className="flex gap-0.5" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      {canDelete && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Situação */}
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold mb-0.5">SITUAÇÃO DETECTADA</p>
                  <p className="text-sm leading-snug break-words">{item.situacao_detectada}</p>
                </div>

                {/* Ref Normativa */}
                {item.referencia_normativa && (
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-medium text-primary">{item.referencia_normativa}</span>
                  </div>
                )}

                {/* Gravidade + Local */}
                <div className="flex items-center gap-2 flex-wrap">
                  <GravidadeBadge gravidade={item.gravidade} />
                  {item.local && <span className="text-xs text-muted-foreground">📍 {item.local}</span>}
                </div>

                {/* Photos */}
                {(item.foto_antes || item.foto_depois) && (
                  <div className={`grid gap-2 ${item.foto_antes && item.foto_depois ? "grid-cols-2" : "grid-cols-1"}`}>
                    {item.foto_antes && (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1 font-semibold">ANTES</p>
                        <DriveImage src={item.foto_antes} alt="Antes" className="w-full h-auto aspect-[4/3] object-contain" thumbnail />
                      </div>
                    )}
                    {item.foto_depois && (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1 font-semibold">DEPOIS</p>
                        <DriveImage src={item.foto_depois} alt="Depois" className="w-full h-auto aspect-[4/3] object-contain" thumbnail />
                      </div>
                    )}
                  </div>
                )}

                {/* Ação + Responsável */}
                {item.acao_corretiva && (
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium">AÇÃO CORRETIVA</p>
                    <p className="text-xs">{item.acao_corretiva}</p>
                  </div>
                )}
                <div className="flex gap-4 text-xs">
                  {item.responsavel && (
                    <div>
                      <span className="text-muted-foreground">Resp: </span>
                      <span>{item.responsavel}</span>
                    </div>
                  )}
                  {item.data_realizado && (
                    <div>
                      <span className="text-muted-foreground">Realizado: </span>
                      <span>{format(new Date(item.data_realizado + "T12:00:00"), "dd/MM/yyyy")}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="p-0 gap-0 max-w-2xl w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-lg flex flex-col overflow-hidden">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b flex-shrink-0">
            <DialogTitle className="text-base sm:text-lg">{editingId ? "Editar Registro" : "Novo Registro de Conformidade"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 overflow-y-auto flex-1 px-4 sm:px-6 py-4" style={{ WebkitOverflowScrolling: "touch" as any }}>
            {/* Seção: Localização */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Localização</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div data-error={!!errors.data_inspecao}>
                  <Label className="font-semibold">Data da Inspeção *</Label>
                  <Input type="date" value={form.data_inspecao} onChange={e => { setForm(p => ({ ...p, data_inspecao: e.target.value })); setErrors(prev => ({ ...prev, data_inspecao: "" })); }} className={cn("min-h-[44px]", errors.data_inspecao && "border-destructive")} />
                  {errors.data_inspecao && <p className="text-xs text-destructive mt-1">{errors.data_inspecao}</p>}
                </div>
                <div data-error={!!errors.local}>
                  <Label className="font-semibold">Local *</Label>
                  <Input placeholder="Ex: SE Jardim de Piranhas" value={form.local} onChange={e => { setForm(p => ({ ...p, local: e.target.value })); setErrors(prev => ({ ...prev, local: "" })); }} className={cn("min-h-[44px]", errors.local && "border-destructive")} />
                  {errors.local && <p className="text-xs text-destructive mt-1">{errors.local}</p>}
                </div>
              </div>
            </div>

            {/* Seção: Detalhamento */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Detalhamento</p>
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="font-semibold">Gravidade *</Label>
                    <Select value={form.gravidade} onValueChange={v => setForm(p => ({ ...p, gravidade: v }))}>
                      <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GRAVIDADE_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="font-semibold">Referência Normativa</Label>
                    <Input placeholder="Ex: NR-10, Item 10.2.1" value={form.referencia_normativa} onChange={e => setForm(p => ({ ...p, referencia_normativa: e.target.value }))} className="min-h-[44px]" />
                  </div>
                </div>

                <div data-error={!!errors.situacao_detectada}>
                  <Label className="font-semibold">Situação Detectada *</Label>
                  <Textarea placeholder="Descreva a não conformidade ou irregularidade..." value={form.situacao_detectada} onChange={e => { setForm(p => ({ ...p, situacao_detectada: e.target.value })); setErrors(prev => ({ ...prev, situacao_detectada: "" })); }} rows={4} className={cn("resize-y min-h-[96px]", errors.situacao_detectada && "border-destructive")} />
                  {errors.situacao_detectada && <p className="text-xs text-destructive mt-1">{errors.situacao_detectada}</p>}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 gap-1.5"
                    onClick={() => {
                      if (form.situacao_detectada.trim().length < 5) {
                        toast({ title: "Descreva a situação detectada antes de usar a IA.", variant: "destructive" });
                        return;
                      }
                      askAI();
                    }}
                    disabled={aiLoading}
                  >
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {aiLoading ? "Analisando..." : "Sugerir NR, Gravidade e Ação (IA)"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Seção: Evidências */}
            <div data-error={!!errors.foto_antes}>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Evidências Fotográficas</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="font-semibold">Foto ANTES *</Label>
                  <input ref={antesRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0], "antes"); e.target.value = ""; }} />
                  <input ref={antesGalleryRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0], "antes"); e.target.value = ""; }} />
                  {(fotoAntesPreview || existingFotoAntes) ? (
                    <div className="relative mt-1">
                      <DriveImage src={fotoAntesPreview || existingFotoAntes!} alt="Antes" className="w-full h-48 object-contain bg-muted/30 rounded-md" />
                      <button
                        type="button"
                        aria-label="Remover foto antes"
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                        onClick={() => { setFotoAntesFile(null); setFotoAntesPreview(null); setExistingFotoAntes(null); }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className={cn("flex flex-col gap-1.5 mt-1 p-2 rounded-md", errors.foto_antes && "border border-destructive")}>
                      <Button variant="outline" size="sm" className="w-full min-h-[44px]" onClick={() => antesRef.current?.click()}>
                        <Camera className="w-4 h-4 mr-1" /> Câmera
                      </Button>
                      <Button variant="outline" size="sm" className="w-full min-h-[44px] text-primary border-primary/30" onClick={() => antesGalleryRef.current?.click()}>
                        <ImageIcon className="w-4 h-4 mr-1" /> Galeria
                      </Button>
                    </div>
                  )}
                  {errors.foto_antes && <p className="text-xs text-destructive mt-1">{errors.foto_antes}</p>}
                </div>
                <div>
                  <Label className="font-semibold">Foto DEPOIS</Label>
                  <input ref={depoisRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0], "depois"); e.target.value = ""; }} />
                  <input ref={depoisGalleryRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0], "depois"); e.target.value = ""; }} />
                  {(fotoDepoisPreview || existingFotoDepois) ? (
                    <div className="relative mt-1">
                      <DriveImage src={fotoDepoisPreview || existingFotoDepois!} alt="Depois" className="w-full h-48 object-contain bg-muted/30 rounded-md" />
                      <button
                        type="button"
                        aria-label="Remover foto depois"
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                        onClick={() => { setFotoDepoisFile(null); setFotoDepoisPreview(null); setExistingFotoDepois(null); }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5 mt-1">
                      <Button variant="outline" size="sm" className="w-full min-h-[44px]"
                        onClick={() => depoisRef.current?.click()}
                        disabled={form.status !== "SOLUCIONADO"}>
                        <Camera className="w-4 h-4 mr-1" /> {form.status !== "SOLUCIONADO" ? "Após solução" : "Câmera"}
                      </Button>
                      <Button variant="outline" size="sm" className="w-full min-h-[44px] text-primary border-primary/30"
                        onClick={() => depoisGalleryRef.current?.click()}
                        disabled={form.status !== "SOLUCIONADO"}>
                        <ImageIcon className="w-4 h-4 mr-1" /> Galeria
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Seção: Ação Corretiva */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Ação Corretiva</p>
              <div className="space-y-3">
                <div data-error={!!errors.acao_corretiva}>
                  <Label className="font-semibold">O Que Fazer *</Label>
                  <Textarea placeholder="Descreva a ação corretiva necessária..." value={form.acao_corretiva} onChange={e => { setForm(p => ({ ...p, acao_corretiva: e.target.value })); setErrors(prev => ({ ...prev, acao_corretiva: "" })); }} rows={2} className={cn("resize-y min-h-[72px]", errors.acao_corretiva && "border-destructive")} />
                  {errors.acao_corretiva && <p className="text-xs text-destructive mt-1">{errors.acao_corretiva}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div data-error={!!errors.responsavel}>
                    <Label className="font-semibold">Responsável *</Label>
                    <Input placeholder="Nome ou setor" value={form.responsavel} onChange={e => { setForm(p => ({ ...p, responsavel: e.target.value })); setErrors(prev => ({ ...prev, responsavel: "" })); }} className={cn("min-h-[44px]", errors.responsavel && "border-destructive")} />
                    {errors.responsavel && <p className="text-xs text-destructive mt-1">{errors.responsavel}</p>}
                  </div>
                  <div>
                    <Label className="font-semibold">Status</Label>
                    <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                      <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div data-error={!!errors.prazo_correcao}>
                  <Label className="font-semibold">Prazo de correção *</Label>
                  <Input type="date" value={form.prazo_correcao} onChange={e => { setForm(p => ({ ...p, prazo_correcao: e.target.value })); setErrors(prev => ({ ...prev, prazo_correcao: "" })); }} className={cn("min-h-[44px]", errors.prazo_correcao && "border-destructive")} />
                  {errors.prazo_correcao && <p className="text-xs text-destructive mt-1">{errors.prazo_correcao}</p>}
                  <p className="text-xs text-muted-foreground mt-1">Data limite para resolver a não conformidade.</p>
                </div>
                {form.status === "SOLUCIONADO" && (
                  <div>
                    <Label className="font-semibold">Data de solução</Label>
                    <Input type="date" value={form.data_realizado} onChange={e => setForm(p => ({ ...p, data_realizado: e.target.value }))} className="min-h-[44px]" />
                    <p className="text-xs text-muted-foreground mt-1">Preenchida automaticamente ao marcar como Solucionado.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Spacer for iOS safe area */}
            <div className="h-2" />
          </div>

          <DialogFooter className="gap-2 flex-shrink-0 bg-background px-4 sm:px-6 py-3 border-t flex flex-row sm:flex-row justify-end" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving} className="flex-1 sm:flex-none min-h-[44px]">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 sm:flex-none min-h-[44px]">
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Enviando...</>
              ) : "Salvar Inspeção"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Exportação de PDF com filtro por intervalo de datas */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar Relatório</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Data de Início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !exportDateStart && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {exportDateStart
                      ? format(exportDateStart, "dd/MM/yyyy", { locale: ptBR })
                      : <span>Selecione a data de início</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={exportDateStart}
                    onSelect={setExportDateStart}
                    initialFocus
                    locale={ptBR}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-2">
              <Label>Data de Fim</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !exportDateEnd && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {exportDateEnd
                      ? format(exportDateEnd, "dd/MM/yyyy", { locale: ptBR })
                      : <span>Selecione a data de fim</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={exportDateEnd}
                    onSelect={setExportDateEnd}
                    disabled={(date) => exportDateStart ? date < exportDateStart : false}
                    initialFocus
                    locale={ptBR}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!exportDateStart || !exportDateEnd}
              onClick={async () => {
                if (!exportDateStart || !exportDateEnd) return;
                setExportDialogOpen(false);
                await generatePDF({ start: exportDateStart, end: exportDateEnd });
              }}
            >
              <FileDown className="w-4 h-4 mr-1.5" />
              Exportar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GravidadeBadge({ gravidade }: { gravidade: string }) {
  const colors: Record<string, string> = {
    "LEVE": "bg-green-100 text-green-800 border-green-300",
    "MODERADO": "bg-amber-100 text-amber-800 border-amber-300",
    "GRAVE": "bg-red-100 text-red-800 border-red-300",
    "RISCO CRÍTICO": "bg-red-200 text-red-900 border-red-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colors[gravidade] || "bg-muted text-muted-foreground"}`}>
      {gravidade}
    </span>
  );
}
