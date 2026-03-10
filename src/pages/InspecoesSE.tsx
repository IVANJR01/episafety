import { useState, useEffect, useRef } from "react";
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
  const [form, setForm] = useState(emptyForm);
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
    setForm(emptyForm);
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
    const ext = file.name.split(".").pop();
    const path = `${empresaId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("conformidades").upload(path, file);
    if (error) return null;
    const { data } = supabase.storage.from("conformidades").getPublicUrl(path);
    return data.publicUrl;
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
        }
        toast({ title: "Registro atualizado!" });
      } else {
        payload.empresa_id = empresaId;
        payload.created_by = user?.id;
        if (isOnline()) {
          const { error } = await (supabase.from as any)("conformidades").insert(payload);
          if (error) throw error;
        } else {
          payload.id = crypto.randomUUID();
          addToSyncQueue({ table: "conformidades", type: "insert", payload });
        }
        toast({ title: "Registro criado!" });
      }

      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      if (!isOnline() || err?.message?.includes("fetch")) {
        const payload: any = {
          data_inspecao: form.data_inspecao, situacao_detectada: form.situacao_detectada,
          gravidade: form.gravidade, acao_corretiva: form.acao_corretiva || null,
          responsavel: form.responsavel || null, local: form.local || null,
          data_realizado: form.data_realizado || null, status: form.status,
          foto_antes: null, foto_depois: null, empresa_id: empresaId, created_by: user?.id,
        };
        if (editingId) {
          addToSyncQueue({ table: "conformidades", type: "update", payload: { id: editingId, ...payload } });
        } else {
          payload.id = crypto.randomUUID();
          addToSyncQueue({ table: "conformidades", type: "insert", payload });
        }
        toast({ title: "Salvo offline", description: "Será sincronizado quando houver conexão." });
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
      }
      toast({ title: "Registro excluído" });
      loadData();
    } catch {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    }
  }

  async function loadImageAsDataUrl(url: string): Promise<string | null> {
    try {
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

    // Load empresa logo
    let logoDataUrl: string | null = null;
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
    const ROW_H = 35; // taller rows for bigger images
    const IMG_H = 30;
    const IMG_W = 35;

    // Header with logo
    let headerY = 10;
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", 10, 5, 30, 15);
      headerY = 12;
    }
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("GESTÃO DE CONFORMIDADES - INSPEÇÕES", pageWidth / 2, headerY, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth / 2, headerY + 6, { align: "center" });

    // Table columns: N°, Data, Situação, Ref. Normativa, Antes, Depois, Gravidade, Ação Corretiva, Responsável, Local, Realizado, Status
    const headers = ["N°", "Data", "Situação", "Ref. Normativa", "Antes", "Depois", "Gravidade", "Ação Corretiva", "Responsável", "Local", "Realizado", "Status"];
    const colWidths = [8, 16, 32, 24, 34, 34, 16, 30, 20, 22, 16, 16];
    let y = headerY + 12;

    // Header row
    doc.setFillColor(41, 65, 122);
    doc.rect(10, y, pageWidth - 20, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    let x = 10;
    headers.forEach((h, i) => {
      doc.text(h, x + 1, y + 5.5);
      x += colWidths[i];
    });
    y += 8;

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);

    filtered.forEach((item, idx) => {
      if (y + ROW_H > 195) {
        doc.addPage();
        y = 15;
      }
      const bgColor = idx % 2 === 0 ? 245 : 255;
      doc.setFillColor(bgColor, bgColor, bgColor);
      doc.rect(10, y, pageWidth - 20, ROW_H, "F");

      const textY = y + 5;
      x = 10;

      // N°
      doc.text(String(item.numero || idx + 1), x + 1, textY);
      x += colWidths[0];

      // Data
      doc.text(item.data_inspecao ? format(new Date(item.data_inspecao + "T12:00:00"), "dd/MM/yyyy") : "", x + 1, textY);
      x += colWidths[1];

      // Situação (wrap text)
      const situacao = item.situacao_detectada?.substring(0, 70) || "";
      const situacaoLines = doc.splitTextToSize(situacao, colWidths[2] - 2);
      doc.text(situacaoLines, x + 1, textY);
      x += colWidths[2];

      // Ref. Normativa
      const refNorm = item.referencia_normativa?.substring(0, 50) || "";
      const refLines = doc.splitTextToSize(refNorm, colWidths[3] - 2);
      doc.text(refLines, x + 1, textY);
      x += colWidths[3];

      // Foto Antes
      const cache = photoCache[item.id];
      if (cache?.antes) {
        try {
          doc.addImage(cache.antes, "JPEG", x + 1, y + 1.5, IMG_W - 2, IMG_H);
        } catch {}
      } else {
        doc.setTextColor(150);
        doc.text("Sem foto", x + 1, textY);
        doc.setTextColor(0);
      }
      x += colWidths[4];

      // Foto Depois
      if (cache?.depois) {
        try {
          doc.addImage(cache.depois, "JPEG", x + 1, y + 1.5, IMG_W - 2, IMG_H);
        } catch {}
      } else {
        doc.setTextColor(150);
        doc.text("Sem foto", x + 1, textY);
        doc.setTextColor(0);
      }
      x += colWidths[5];

      // Gravidade
      doc.text(item.gravidade || "", x + 1, textY);
      x += colWidths[6];

      // Ação Corretiva
      const acao = item.acao_corretiva || "";
      const acaoLines = doc.splitTextToSize(acao, colWidths[7] - 2);
      doc.text(acaoLines, x + 1, textY);
      x += colWidths[7];

      // Responsável
      doc.text(item.responsavel || "", x + 1, textY);
      x += colWidths[8];

      // Local
      const localLines = doc.splitTextToSize(item.local || "", colWidths[9] - 2);
      doc.text(localLines, x + 1, textY);
      x += colWidths[9];

      // Realizado
      doc.text(item.data_realizado ? format(new Date(item.data_realizado + "T12:00:00"), "dd/MM/yyyy") : "", x + 1, textY);
      x += colWidths[10];

      // Status
      doc.text(item.status || "", x + 1, textY);

      y += ROW_H;
    });

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
                        <img src={item.foto_antes} alt="Antes" className="w-14 h-10 object-cover rounded border" />
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {item.foto_depois ? (
                        <img src={item.foto_depois} alt="Depois" className="w-14 h-10 object-cover rounded border" />
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
                        <img src={item.foto_antes} alt="Antes" className="w-full h-24 object-cover rounded-lg border" />
                      </div>
                    ) : <div />}
                    {item.foto_depois ? (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1 font-medium">DEPOIS</p>
                        <img src={item.foto_depois} alt="Depois" className="w-full h-24 object-cover rounded-lg border" />
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
