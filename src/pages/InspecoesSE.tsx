import { useState, useEffect, useRef } from "react";
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
import { Plus, Filter, FileDown, Camera, X, Pencil, Trash2, Sparkles, Loader2 } from "lucide-react";
import DriveImage from "@/components/DriveImage";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { isOnline, addToSyncQueue, getCachedData, setCachedData } from "@/lib/offlineStorage";
import jsPDF from "jspdf";

const GRAVIDADE_OPTIONS = ["LEVE", "MODERADO", "GRAVE", "RISCO CRÍTICO"];
const STATUS_OPTIONS = ["PENDENTE", "SOLUCIONADO"];

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
  const { form, setForm, resetForm: resetDraft, hasDraft } = useFormDraft("inspecoes_se", emptyForm);
  const [fotoAntesFile, setFotoAntesFile] = useState<File | null>(null);
  const [fotoAntesPreview, setFotoAntesPreview] = useState<string | null>(null);
  const [fotoDepoisFile, setFotoDepoisFile] = useState<File | null>(null);
  const [fotoDepoisPreview, setFotoDepoisPreview] = useState<string | null>(null);
  const [existingFotoAntes, setExistingFotoAntes] = useState<string | null>(null);
  const [existingFotoDepois, setExistingFotoDepois] = useState<string | null>(null);
  const antesRef = useRef<HTMLInputElement>(null);
  const depoisRef = useRef<HTMLInputElement>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterGravidade, setFilterGravidade] = useState("all");

  useEffect(() => { loadData(); }, [empresaId]);

  async function loadData() {
    setLoading(true);
    try {
      if (isOnline() && empresaId) {
        const { data, error } = await (supabase.from as any)("conformidades")
          .select("*")
          .eq("empresa_id", empresaId)
          .order("numero", { ascending: true });
        if (error) throw error;
        const records = (data || []) as Conformidade[];
        setItems(records);
        setCachedData("conformidades", records);
      } else {
        setItems(getCachedData<Conformidade>("conformidades") || []);
      }
    } catch {
      setItems(getCachedData<Conformidade>("conformidades") || []);
    }
    setLoading(false);
  }

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
    if (!hasDraft()) resetDraft();
    else setForm(form); // keep draft
    clearPhotoPreviews();
    setDialogOpen(true);
  }

  function openEdit(item: Conformidade) {
    setEditingId(item.id);
    setForm({
      data_inspecao: item.data_inspecao,
      situacao_detectada: item.situacao_detectada,
      gravidade: item.gravidade,
      acao_corretiva: item.acao_corretiva || "",
      responsavel: item.responsavel || "",
      local: item.local || "",
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

  function handleFileSelect(file: File, type: "antes" | "depois") {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (type === "antes") {
        setFotoAntesFile(file);
        setFotoAntesPreview(e.target?.result as string);
      } else {
        setFotoDepoisFile(file);
        setFotoDepoisPreview(e.target?.result as string);
      }
    };
    reader.readAsDataURL(file);
  }

  async function uploadPhoto(file: File): Promise<string | null> {
    try {
      const { uploadToDrive } = await import("@/lib/googleDriveStorage");
      const result = await uploadToDrive(
        file,
        "inspecoes",
        `${Date.now()}_${Math.random().toString(36).slice(2)}.${file.name.split(".").pop()}`
      );
      return result.publicUrl;
    } catch {
      return null;
    }
  }

  async function handleSave() {
    if (!form.situacao_detectada.trim()) {
      toast({ title: "Preencha a situação detectada", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let foto_antes = existingFotoAntes;
      let foto_depois = existingFotoDepois;

      if (isOnline()) {
        if (fotoAntesFile) foto_antes = await uploadPhoto(fotoAntesFile);
        if (fotoDepoisFile) foto_depois = await uploadPhoto(fotoDepoisFile);
      } else {
        // Store base64 previews for offline viewing
        if (fotoAntesPreview) foto_antes = fotoAntesPreview;
        if (fotoDepoisPreview) foto_depois = fotoDepoisPreview;
      }

      const payload: any = {
        data_inspecao: form.data_inspecao,
        situacao_detectada: form.situacao_detectada,
        gravidade: form.gravidade,
        acao_corretiva: form.acao_corretiva || null,
        responsavel: form.responsavel || null,
        local: form.local || null,
        data_realizado: form.data_realizado || null,
        status: form.status,
        foto_antes: foto_antes || null,
        foto_depois: foto_depois || null,
        referencia_normativa: form.referencia_normativa || null,
      };

      if (editingId) {
        if (isOnline()) {
          const { error } = await (supabase.from as any)("conformidades").update(payload).eq("id", editingId);
          if (error) throw error;
        } else {
          addToSyncQueue({ table: "conformidades", type: "update", payload: { id: editingId, ...payload } });
          // Update local cache optimistically
          const cached = getCachedData<Conformidade>("conformidades") || [];
          setCachedData("conformidades", cached.map(c => c.id === editingId ? { ...c, ...payload } : c));
        }
        toast({ title: editingId && !isOnline() ? "Atualizado offline" : "Registro atualizado!" });
      } else {
        payload.empresa_id = empresaId;
        payload.created_by = user?.id;
        if (isOnline()) {
          const { error } = await (supabase.from as any)("conformidades").insert(payload);
          if (error) throw error;
        } else {
          payload.id = crypto.randomUUID();
          payload.numero = (items.length > 0 ? Math.max(...items.map(i => i.numero || 0)) : 0) + 1;
          payload.created_at = new Date().toISOString();
          addToSyncQueue({ table: "conformidades", type: "insert", payload });
          // Update local cache optimistically
          const cached = getCachedData<Conformidade>("conformidades") || [];
          cached.push(payload as Conformidade);
          setCachedData("conformidades", cached);
        }
        toast({ title: !isOnline() ? "Salvo offline" : "Registro criado!", description: !isOnline() ? "Será sincronizado quando houver conexão." : undefined });
      }

      resetDraft();
      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      if (!isOnline() || err?.message?.includes("fetch")) {
        const payload: any = {
          data_inspecao: form.data_inspecao, situacao_detectada: form.situacao_detectada,
          gravidade: form.gravidade, acao_corretiva: form.acao_corretiva || null,
          responsavel: form.responsavel || null, local: form.local || null,
          data_realizado: form.data_realizado || null, status: form.status,
          foto_antes: fotoAntesPreview || null, foto_depois: fotoDepoisPreview || null,
          empresa_id: empresaId, created_by: user?.id,
          referencia_normativa: form.referencia_normativa || null,
        };
        const cached = getCachedData<Conformidade>("conformidades") || [];
        if (editingId) {
          addToSyncQueue({ table: "conformidades", type: "update", payload: { id: editingId, ...payload } });
          setCachedData("conformidades", cached.map(c => c.id === editingId ? { ...c, ...payload } : c));
        } else {
          payload.id = crypto.randomUUID();
          payload.numero = (items.length > 0 ? Math.max(...items.map(i => i.numero || 0)) : 0) + 1;
          payload.created_at = new Date().toISOString();
          addToSyncQueue({ table: "conformidades", type: "insert", payload });
          cached.push(payload as Conformidade);
          setCachedData("conformidades", cached);
        }
        toast({ title: "Salvo offline", description: "Será sincronizado quando houver conexão." });
        resetDraft();
        setDialogOpen(false);
        loadData();
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
      } else {
        addToSyncQueue({ table: "conformidades", type: "delete", payload: { id } });
        // Update local cache optimistically
        const cached = getCachedData<Conformidade>("conformidades") || [];
        setCachedData("conformidades", cached.filter(c => c.id !== id));
      }
      toast({ title: !isOnline() ? "Excluído offline" : "Registro excluído" });
      loadData();
    } catch {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  }

  function extractDriveFileId(url: string): string | null {
    const patterns = [/[?&]id=([a-zA-Z0-9_-]+)/, /\/d\/([a-zA-Z0-9_-]+)/];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  }

  async function resolveDriveUrl(url: string): Promise<string> {
    if (!url.includes("drive.google.com")) return url;
    const fileId = extractDriveFileId(url);
    if (!fileId) return url;
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("gdrive-proxy", {
        body: { id: fileId },
      });
      if (fnErr || data?.error) return `https://lh3.googleusercontent.com/d/${fileId}=w800`;
      return data.url;
    } catch {
      return `https://lh3.googleusercontent.com/d/${fileId}=w800`;
    }
  }

  async function loadImageAsDataUrl(url: string): Promise<string | null> {
    try {
      const resolvedUrl = await resolveDriveUrl(url);
      // For Drive images, fetch as blob to avoid CORS canvas tainting
      if (url.includes("drive.google.com") || resolvedUrl.includes("googleusercontent.com")) {
        const resp = await fetch(resolvedUrl, { mode: "cors" });
        if (!resp.ok) return null;
        const blob = await resp.blob();
        return await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      }
      // Non-Drive URLs: use canvas approach
      const img = new Image();
      img.crossOrigin = "anonymous";
      return await new Promise<string | null>((resolve) => {
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          canvas.getContext("2d")!.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });
    } catch {
      return null;
    }
  }

  async function generatePDF() {
    toast({ title: "Gerando PDF...", description: "Aguarde, carregando imagens." });

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
        if (empresa?.logo_url) {
          logoDataUrl = await loadImageAsDataUrl(empresa.logo_url);
        }
        empresaNome = empresa?.nome || "";
      }
    } catch {}

    // Pre-load all item photos
    const filtered = getFilteredItems();
    const photoCache: Record<string, { antes: string | null; depois: string | null }> = {};
    await Promise.all(
      filtered.map(async (item) => {
        const [antes, depois] = await Promise.all([
          item.foto_antes ? loadImageAsDataUrl(item.foto_antes) : Promise.resolve(null),
          item.foto_depois ? loadImageAsDataUrl(item.foto_depois) : Promise.resolve(null),
        ]);
        photoCache[item.id] = { antes, depois };
      })
    );

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const ROW_H = 36;
    const IMG_H = 30;
    const IMG_W = 34;
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
    if (empresaNome) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(empresaNome, pageWidth / 2, headerY + 11, { align: "center" });
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth / 2, headerY + 16, { align: "center" });
    doc.setTextColor(0, 0, 0);

    // Table columns - use full page width
    const headers = ["N°", "Data", "Situação Detectada", "Ref. Normativa", "Foto Antes", "Foto Depois", "Gravidade", "Ação Corretiva", "Responsável", "Local", "Realizado", "Status"];
    const usableWidth = pageWidth - MARGIN * 2;
    const colWidths = [9, 17, 36, 24, 36, 36, 20, 36, 20, 20, 17, 28];
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
      drawCenteredText(String(item.numero || idx + 1), x, y, scaledWidths[0], ROW_H, 7, true);
      x += scaledWidths[0];

      // Data - centered
      const dataStr = item.data_inspecao ? format(new Date(item.data_inspecao + "T12:00:00"), "dd/MM/yyyy") : "";
      drawCenteredText(dataStr, x, y, scaledWidths[1], ROW_H, 6);
      x += scaledWidths[1];

      // Situação - centered wrapped
      drawCenteredText(item.situacao_detectada || "", x, y, scaledWidths[2], ROW_H, 5.5);
      x += scaledWidths[2];

      // Ref. Normativa - centered wrapped
      drawCenteredText(item.referencia_normativa || "", x, y, scaledWidths[3], ROW_H, 5.5);
      x += scaledWidths[3];

      // Foto Antes - centered image
      const cache = photoCache[item.id];
      if (cache?.antes) {
        try {
          const imgX = x + (scaledWidths[4] - (IMG_W - 2)) / 2;
          const imgY = y + (ROW_H - IMG_H) / 2;
          doc.addImage(cache.antes, "JPEG", imgX, imgY, IMG_W - 2, IMG_H);
        } catch {}
      } else {
        drawCenteredText("Sem foto", x, y, scaledWidths[4], ROW_H, 5.5, false, [180, 180, 180]);
      }
      x += scaledWidths[4];

      // Foto Depois - centered image
      if (cache?.depois) {
        try {
          const imgX = x + (scaledWidths[5] - (IMG_W - 2)) / 2;
          const imgY = y + (ROW_H - IMG_H) / 2;
          doc.addImage(cache.depois, "JPEG", imgX, imgY, IMG_W - 2, IMG_H);
        } catch {}
      } else {
        drawCenteredText("Sem foto", x, y, scaledWidths[5], ROW_H, 5.5, false, [180, 180, 180]);
      }
      x += scaledWidths[5];

      // Gravidade - filled cell background with white text for critical levels
      const gravText = item.gravidade || "";
      const gravUpper = gravText.toUpperCase();
      const isGravCritical = gravUpper.includes("CRÍTICO") || gravUpper.includes("CRITICO") || gravUpper.includes("GRAVE") || gravUpper.includes("ALTA");
      const isGravModerado = gravUpper.includes("MODERADO");
      if (isGravCritical) {
        doc.setFillColor(220, 38, 38);
        doc.rect(x, y, scaledWidths[6], ROW_H, "F");
        drawCenteredText(gravText, x, y, scaledWidths[6], ROW_H, 6.5, true, [255, 255, 255]);
      } else if (isGravModerado) {
        doc.setFillColor(234, 179, 8);
        doc.rect(x, y, scaledWidths[6], ROW_H, "F");
        drawCenteredText(gravText, x, y, scaledWidths[6], ROW_H, 6.5, true, [255, 255, 255]);
      } else {
        // Leve - blue bg
        doc.setFillColor(59, 130, 246);
        doc.rect(x, y, scaledWidths[6], ROW_H, "F");
        drawCenteredText(gravText, x, y, scaledWidths[6], ROW_H, 6.5, true, [255, 255, 255]);
      }
      x += scaledWidths[6];

      // Ação Corretiva - centered wrapped
      drawCenteredText(item.acao_corretiva || "", x, y, scaledWidths[7], ROW_H, 5.5);
      x += scaledWidths[7];

      // Responsável - centered
      drawCenteredText(item.responsavel || "", x, y, scaledWidths[8], ROW_H, 6);
      x += scaledWidths[8];

      // Local - centered
      drawCenteredText(item.local || "", x, y, scaledWidths[9], ROW_H, 6);
      x += scaledWidths[9];

      // Realizado - centered
      const realStr = item.data_realizado ? format(new Date(item.data_realizado + "T12:00:00"), "dd/MM/yyyy") : "—";
      drawCenteredText(realStr, x, y, scaledWidths[10], ROW_H, 6);
      x += scaledWidths[10];

      // Status - filled cell background with white text
      const statusText = item.status || "";
      const isPendente = statusText.toUpperCase() === "PENDENTE";
      const isSolucionado = statusText.toUpperCase() === "SOLUCIONADO";
      if (isPendente) {
        doc.setFillColor(220, 38, 38);
        doc.rect(x, y, scaledWidths[11], ROW_H, "F");
        drawCenteredText(statusText, x, y, scaledWidths[11], ROW_H, 6.5, true, [255, 255, 255]);
      } else if (isSolucionado) {
        doc.setFillColor(22, 163, 74);
        doc.rect(x, y, scaledWidths[11], ROW_H, "F");
        drawCenteredText(statusText, x, y, scaledWidths[11], ROW_H, 6.5, true, [255, 255, 255]);
      } else {
        drawCenteredText(statusText, x, y, scaledWidths[11], ROW_H, 6, true);
      }

      y += ROW_H;
    });

    // Footer on last page
    doc.setFontSize(6);
    doc.setTextColor(150);
    doc.text(`Página ${doc.getNumberOfPages()}`, pageWidth / 2, pageHeight - 5, { align: "center" });
    doc.setTextColor(0);

    doc.save(`Conformidades_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast({ title: "PDF gerado com sucesso!" });
  }

  function getFilteredItems() {
    return items.filter(i => {
      if (filterStatus !== "all" && i.status !== filterStatus) return false;
      if (filterGravidade !== "all" && i.gravidade !== filterGravidade) return false;
      return true;
    });
  }

  const filtered = getFilteredItems();
  const pendentes = items.filter(i => i.status === "PENDENTE").length;
  const solucionados = items.filter(i => i.status === "SOLUCIONADO").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Inspeções</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} registro(s) — <span className="text-amber-600">{pendentes} pendente(s)</span> — <span className="text-green-600">{solucionados} solucionado(s)</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canCreate && (
            <Button onClick={openNew} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Novo Registro
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={generatePDF}>
            <FileDown className="w-4 h-4 mr-1" /> Gerar PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            <SelectItem value="PENDENTE">Pendente</SelectItem>
            <SelectItem value="SOLUCIONADO">Solucionado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterGravidade} onValueChange={setFilterGravidade}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Gravidade" /></SelectTrigger>
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
        <div className="py-12 text-center text-muted-foreground text-sm border rounded-lg">
          Nenhum registro encontrado.
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[50px]">N°</TableHead>
                  <TableHead className="w-[100px]">Data</TableHead>
                  <TableHead>Situação Detectada</TableHead>
                  <TableHead className="w-[80px]">Antes</TableHead>
                  <TableHead className="w-[80px]">Depois</TableHead>
                  <TableHead className="w-[120px]">Gravidade</TableHead>
                  <TableHead>Ref. Normativa</TableHead>
                  <TableHead>O Que Fazer</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead className="w-[100px]">Realizado</TableHead>
                  <TableHead className="w-[110px]">Status</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item, idx) => (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-muted/30" onClick={() => openEdit(item)}>
                    <TableCell className="font-medium">{item.numero || idx + 1}</TableCell>
                    <TableCell className="text-xs">
                      {item.data_inspecao ? format(new Date(item.data_inspecao + "T12:00:00"), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">{item.situacao_detectada}</TableCell>
                    <TableCell>
                    {item.foto_antes ? (
                        <DriveImage src={item.foto_antes} alt="Antes" className="w-14 h-10" />
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {item.foto_depois ? (
                        <DriveImage src={item.foto_depois} alt="Depois" className="w-14 h-10" />
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <GravidadeBadge gravidade={item.gravidade} />
                    </TableCell>
                    <TableCell className="text-xs max-w-[150px]">
                      {item.referencia_normativa ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
                          <Sparkles className="w-3 h-3" />{item.referencia_normativa}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate">{item.acao_corretiva || "—"}</TableCell>
                    <TableCell className="text-xs">{item.responsavel || "—"}</TableCell>
                    <TableCell className="text-xs">{item.local || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {item.data_realizado ? format(new Date(item.data_realizado + "T12:00:00"), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === "SOLUCIONADO" ? "default" : "secondary"}
                        className={item.status === "SOLUCIONADO" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-amber-500 hover:bg-amber-600 text-white"}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {canDelete && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((item, idx) => (
              <div key={item.id} className="border rounded-lg p-3 space-y-3 bg-card" onClick={() => openEdit(item)}>
                {/* Top row: N°, Status, Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">#{item.numero || idx + 1}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.data_inspecao ? format(new Date(item.data_inspecao + "T12:00:00"), "dd/MM/yyyy") : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
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
                <p className="text-sm leading-snug">{item.situacao_detectada}</p>

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
                  <div className="grid grid-cols-2 gap-2">
                    {item.foto_antes ? (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1 font-medium">ANTES</p>
                        <DriveImage src={item.foto_antes} alt="Antes" className="w-full h-24" />
                      </div>
                    ) : <div />}
                    {item.foto_depois ? (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1 font-medium">DEPOIS</p>
                        <DriveImage src={item.foto_depois} alt="Depois" className="w-full h-24" />
                      </div>
                    ) : <div />}
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Registro" : "Novo Registro de Conformidade"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data da Inspeção *</Label>
                <Input type="date" value={form.data_inspecao} onChange={e => setForm(p => ({ ...p, data_inspecao: e.target.value }))} />
              </div>
              <div>
                <Label>Gravidade *</Label>
                <Select value={form.gravidade} onValueChange={v => setForm(p => ({ ...p, gravidade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRAVIDADE_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Situação Detectada *</Label>
              <Textarea placeholder="Descreva a não conformidade ou irregularidade..." value={form.situacao_detectada} onChange={e => setForm(p => ({ ...p, situacao_detectada: e.target.value }))} rows={3} />
              <Button type="button" variant="outline" size="sm" className="mt-2 gap-1.5" onClick={askAI} disabled={aiLoading || form.situacao_detectada.trim().length < 5}>
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {aiLoading ? "Analisando..." : "Sugerir NR, Gravidade e Ação (IA)"}
              </Button>
            </div>

            <div>
              <Label>Referência Normativa</Label>
              <Input placeholder="Ex: NR-10, Item 10.2.1" value={form.referencia_normativa} onChange={e => setForm(p => ({ ...p, referencia_normativa: e.target.value }))} />
            </div>

            {/* Photos */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Foto ANTES</Label>
                <input ref={antesRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0], "antes"); e.target.value = ""; }} />
                {(fotoAntesPreview || existingFotoAntes) ? (
                  <div className="relative mt-1">
                    <img src={fotoAntesPreview || existingFotoAntes!} alt="Antes" className="w-full h-28 object-cover rounded-lg border" />
                    <button className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                      onClick={() => { setFotoAntesFile(null); setFotoAntesPreview(null); setExistingFotoAntes(null); }}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full mt-1" onClick={() => antesRef.current?.click()}>
                    <Camera className="w-4 h-4 mr-1" /> Capturar
                  </Button>
                )}
              </div>
              <div>
                <Label>Foto DEPOIS</Label>
                <input ref={depoisRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0], "depois"); e.target.value = ""; }} />
                {(fotoDepoisPreview || existingFotoDepois) ? (
                  <div className="relative mt-1">
                    <img src={fotoDepoisPreview || existingFotoDepois!} alt="Depois" className="w-full h-28 object-cover rounded-lg border" />
                    <button className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                      onClick={() => { setFotoDepoisFile(null); setFotoDepoisPreview(null); setExistingFotoDepois(null); }}>
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full mt-1"
                    onClick={() => depoisRef.current?.click()}
                    disabled={form.status !== "SOLUCIONADO"}>
                    <Camera className="w-4 h-4 mr-1" /> {form.status !== "SOLUCIONADO" ? "Somente após solução" : "Capturar"}
                  </Button>
                )}
              </div>
            </div>

            <div>
              <Label>O Que Fazer (Ação Corretiva)</Label>
              <Textarea placeholder="Descreva a ação corretiva necessária..." value={form.acao_corretiva} onChange={e => setForm(p => ({ ...p, acao_corretiva: e.target.value }))} rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Responsável</Label>
                <Input placeholder="Nome ou setor" value={form.responsavel} onChange={e => setForm(p => ({ ...p, responsavel: e.target.value }))} />
              </div>
              <div>
                <Label>Local</Label>
                <Input placeholder="Ex: SE Jardim de Piranhas" value={form.local} onChange={e => setForm(p => ({ ...p, local: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data Realizado</Label>
                <Input type="date" value={form.data_realizado} onChange={e => setForm(p => ({ ...p, data_realizado: e.target.value }))} />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GravidadeBadge({ gravidade }: { gravidade: string }) {
  const colors: Record<string, string> = {
    "LEVE": "bg-blue-100 text-blue-800 border-blue-200",
    "MODERADO": "bg-amber-100 text-amber-800 border-amber-200",
    "GRAVE": "bg-orange-100 text-orange-800 border-orange-200",
    "RISCO CRÍTICO": "bg-red-100 text-red-800 border-red-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colors[gravidade] || "bg-muted text-muted-foreground"}`}>
      {gravidade}
    </span>
  );
}
