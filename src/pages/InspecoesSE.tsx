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
import { Plus, Filter, FileDown, Camera, X, Pencil, Trash2 } from "lucide-react";
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

  function generatePDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("GESTÃO DE CONFORMIDADES - INSPEÇÕES", pageWidth / 2, 15, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth / 2, 21, { align: "center" });

    // Table
    const headers = ["N°", "Data", "Situação", "Gravidade", "Ação Corretiva", "Responsável", "Local", "Realizado", "Status"];
    const colWidths = [10, 22, 60, 25, 55, 30, 35, 22, 22];
    let y = 28;

    // Header row
    doc.setFillColor(41, 65, 122);
    doc.rect(10, y, pageWidth - 20, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    let x = 10;
    headers.forEach((h, i) => {
      doc.text(h, x + 1, y + 5.5);
      x += colWidths[i];
    });
    y += 8;

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    const filtered = getFilteredItems();
    filtered.forEach((item, idx) => {
      if (y > 190) {
        doc.addPage();
        y = 15;
      }
      const bgColor = idx % 2 === 0 ? 245 : 255;
      doc.setFillColor(bgColor, bgColor, bgColor);
      doc.rect(10, y, pageWidth - 20, 7, "F");

      const row = [
        String(item.numero || idx + 1),
        item.data_inspecao ? format(new Date(item.data_inspecao + "T12:00:00"), "dd/MM/yyyy") : "",
        item.situacao_detectada?.substring(0, 60) || "",
        item.gravidade || "",
        item.acao_corretiva?.substring(0, 50) || "",
        item.responsavel || "",
        item.local || "",
        item.data_realizado ? format(new Date(item.data_realizado + "T12:00:00"), "dd/MM/yyyy") : "",
        item.status || "",
      ];

      x = 10;
      row.forEach((cell, i) => {
        doc.text(cell, x + 1, y + 5);
        x += colWidths[i];
      });
      y += 7;
    });

    doc.save(`Conformidades_${format(new Date(), "yyyy-MM-dd")}.pdf`);
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

      {/* Table */}
      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm border rounded-lg">
          Nenhum registro encontrado.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[50px]">N°</TableHead>
                <TableHead className="w-[100px]">Data</TableHead>
                <TableHead>Situação Detectada</TableHead>
                <TableHead className="w-[80px]">Antes</TableHead>
                <TableHead className="w-[80px]">Depois</TableHead>
                <TableHead className="w-[120px]">Gravidade</TableHead>
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
