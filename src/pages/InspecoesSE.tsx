import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, ClipboardCheck, AlertTriangle, CheckCircle2, ArrowLeft, Trash2, Camera, X, Eye, Calendar, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { isOnline, addToSyncQueue, getCachedData, setCachedData } from "@/lib/offlineStorage";

const CHECKLIST_ITEMS_DEFAULT = [
  { id: "transformadores", label: "Estado dos Transformadores", descricao: "Verificar nível de óleo, terminais, buchas e conexões" },
  { id: "disjuntores", label: "Disjuntores", descricao: "Funcionamento, estado de conservação, sinalização" },
  { id: "aterramento", label: "Sistema de Aterramento", descricao: "Malha de aterramento, conexões, medição de resistência" },
  { id: "cercas_portoes", label: "Cercas e Portões", descricao: "Integridade física, cadeados, controle de acesso" },
  { id: "sinalizacao", label: "Sinalização de Segurança", descricao: "Placas de advertência, identificação de circuitos" },
  { id: "limpeza", label: "Limpeza da Área", descricao: "Vegetação, detritos, organização geral" },
  { id: "iluminacao", label: "Iluminação", descricao: "Luminárias, postes, iluminação de emergência" },
  { id: "para_raios", label: "Para-raios", descricao: "Estado de conservação, aterramento, contador de descargas" },
  { id: "cabos_conexoes", label: "Cabos e Conexões", descricao: "Estado dos cabos, conectores, emendas" },
  { id: "paineis", label: "Painéis Elétricos", descricao: "Organização interna, identificação, aquecimento" },
];

type CheckStatus = "conforme" | "nao_conforme" | "nao_aplicavel";

interface CheckItem {
  id: string;
  label: string;
  descricao: string;
  status: CheckStatus;
  observacao: string;
}

interface InspecaoRecord {
  id: string;
  data_inspecao: string;
  inspetor: string;
  identificacao_se: string;
  clima: string | null;
  itens_json: CheckItem[];
  fotos: string[] | null;
  observacoes: string | null;
  status_geral: string;
  created_at: string;
}

type ViewMode = "dashboard" | "form" | "history" | "detail";

export default function InspecoesSE() {
  const { user, empresaId } = useAuth();
  const { canView, canCreate, canDelete } = usePermissions("inspecoes_se");
  const [view, setView] = useState<ViewMode>("dashboard");
  const [inspecoes, setInspecoes] = useState<InspecaoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedInspecao, setSelectedInspecao] = useState<InspecaoRecord | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDate, setFilterDate] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    data_inspecao: format(new Date(), "yyyy-MM-dd"),
    inspetor: "",
    identificacao_se: "",
    clima: "",
    observacoes: "",
  });
  const [checkItems, setCheckItems] = useState<CheckItem[]>(
    CHECKLIST_ITEMS_DEFAULT.map(i => ({ ...i, status: "conforme" as CheckStatus, observacao: "" }))
  );
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadInspecoes(); }, [empresaId]);

  async function loadInspecoes() {
    setLoading(true);
    try {
      if (isOnline() && empresaId) {
        const { data, error } = await supabase
          .from("inspecoes_subestacao")
          .select("*")
          .eq("empresa_id", empresaId)
          .order("data_inspecao", { ascending: false });
        if (error) throw error;
        const records = (data || []) as unknown as InspecaoRecord[];
        setInspecoes(records);
        setCachedData("inspecoes_subestacao", records);
      } else {
        const cached = getCachedData<InspecaoRecord>("inspecoes_subestacao");
        setInspecoes(cached || []);
      }
    } catch {
      const cached = getCachedData<InspecaoRecord>("inspecoes_subestacao");
      setInspecoes(cached || []);
    }
    setLoading(false);
  }

  function resetForm() {
    setFormData({ data_inspecao: format(new Date(), "yyyy-MM-dd"), inspetor: "", identificacao_se: "", clima: "", observacoes: "" });
    setCheckItems(CHECKLIST_ITEMS_DEFAULT.map(i => ({ ...i, status: "conforme" as CheckStatus, observacao: "" })));
    setPhotos([]);
    setPhotoPreviewUrls([]);
  }

  function handlePhotoAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setPhotos(prev => [...prev, ...files]);
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreviewUrls(prev => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(f);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(idx: number) {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
    setPhotoPreviewUrls(prev => prev.filter((_, i) => i !== idx));
  }

  function updateCheckItem(id: string, field: "status" | "observacao", value: string) {
    setCheckItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  }

  function computeStatus(): string {
    const hasNonConform = checkItems.some(i => i.status === "nao_conforme");
    return hasNonConform ? "Com Pendências" : "Aprovado";
  }

  async function handleSave() {
    if (!formData.inspetor.trim() || !formData.identificacao_se.trim()) {
      toast({ title: "Preencha os campos obrigatórios", description: "Inspetor e Identificação da SE são obrigatórios.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Upload photos
      let photoUrls: string[] = [];
      if (isOnline() && photos.length > 0) {
        for (const photo of photos) {
          const ext = photo.name.split(".").pop();
          const path = `${empresaId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: upErr } = await supabase.storage.from("inspecoes").upload(path, photo);
          if (!upErr) {
            const { data: urlData } = supabase.storage.from("inspecoes").getPublicUrl(path);
            photoUrls.push(urlData.publicUrl);
          }
        }
      }

      const record = {
        data_inspecao: formData.data_inspecao,
        inspetor: formData.inspetor,
        identificacao_se: formData.identificacao_se,
        clima: formData.clima || null,
        itens_json: checkItems,
        fotos: photoUrls,
        observacoes: formData.observacoes || null,
        status_geral: computeStatus(),
        empresa_id: empresaId,
        created_by: user?.id,
      };

      if (isOnline()) {
        const { error } = await supabase.from("inspecoes_subestacao").insert(record as any);
        if (error) throw error;
        toast({ title: "Inspeção salva com sucesso!" });
      } else {
        addToSyncQueue({ table: "inspecoes_subestacao", type: "insert", payload: record });
        toast({ title: "Inspeção salva offline", description: "Será sincronizada quando houver conexão." });
      }

      resetForm();
      setView("dashboard");
      loadInspecoes();
    } catch (err: any) {
      // Fallback offline
      if (!isOnline() || err?.message?.includes("fetch")) {
        const record = {
          data_inspecao: formData.data_inspecao, inspetor: formData.inspetor,
          identificacao_se: formData.identificacao_se, clima: formData.clima || null,
          itens_json: checkItems, fotos: [], observacoes: formData.observacoes || null,
          status_geral: computeStatus(), empresa_id: empresaId, created_by: user?.id,
        };
        addToSyncQueue({ table: "inspecoes_subestacao", type: "insert", payload: record });
        toast({ title: "Inspeção salva offline", description: "Será sincronizada quando houver conexão." });
        resetForm();
        setView("dashboard");
      } else {
        toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
      }
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta inspeção?")) return;
    const { error } = await supabase.from("inspecoes_subestacao").delete().eq("id", id);
    if (error) { toast({ title: "Erro ao excluir", variant: "destructive" }); return; }
    toast({ title: "Inspeção excluída" });
    loadInspecoes();
    if (view === "detail") setView("history");
  }

  // Stats
  const totalInspecoes = inspecoes.length;
  const comPendencias = inspecoes.filter(i => i.status_geral === "Com Pendências").length;
  const aprovadas = inspecoes.filter(i => i.status_geral === "Aprovado").length;

  // Filtered
  const filteredInspecoes = inspecoes.filter(i => {
    if (filterStatus !== "all" && i.status_geral !== filterStatus) return false;
    if (filterDate && i.data_inspecao !== filterDate) return false;
    return true;
  });

  // DASHBOARD
  if (view === "dashboard") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold">Inspeções de Subestação</h1>
            <p className="text-sm text-muted-foreground">Gestão de inspeções de segurança</p>
          </div>
          <div className="flex gap-2">
            {canCreate && (
              <Button onClick={() => { resetForm(); setView("form"); }}>
                <Plus className="w-4 h-4 mr-1" /> Nova Inspeção
              </Button>
            )}
            <Button variant="outline" onClick={() => setView("history")}>
              <Calendar className="w-4 h-4 mr-1" /> Histórico
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><ClipboardCheck className="w-5 h-5 text-primary" /></div>
                <div>
                  <p className="text-2xl font-bold">{totalInspecoes}</p>
                  <p className="text-xs text-muted-foreground">Total de Inspeções</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
                <div>
                  <p className="text-2xl font-bold">{comPendencias}</p>
                  <p className="text-xs text-muted-foreground">Com Pendências</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100"><CheckCircle2 className="w-5 h-5 text-green-600" /></div>
                <div>
                  <p className="text-2xl font-bold">{aprovadas}</p>
                  <p className="text-xs text-muted-foreground">Aprovadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent inspections */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Inspeções Recentes</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : inspecoes.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhuma inspeção registrada.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {inspecoes.slice(0, 5).map(insp => (
                <InspecaoCard key={insp.id} insp={insp} onView={() => { setSelectedInspecao(insp); setView("detail"); }} onDelete={canDelete ? () => handleDelete(insp.id) : undefined} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // FORM
  if (view === "form") {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setView("dashboard")}><ArrowLeft className="w-5 h-5" /></Button>
          <h1 className="text-xl font-bold">Nova Inspeção</h1>
        </div>

        {/* Header */}
        <Card>
          <CardHeader><CardTitle className="text-base">Cabeçalho</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><Label>Data *</Label><Input type="date" value={formData.data_inspecao} onChange={e => setFormData(p => ({ ...p, data_inspecao: e.target.value }))} /></div>
              <div><Label>Inspetor *</Label><Input placeholder="Nome do inspetor" value={formData.inspetor} onChange={e => setFormData(p => ({ ...p, inspetor: e.target.value }))} /></div>
              <div><Label>Identificação da SE *</Label><Input placeholder="Ex: SE Caraúbas" value={formData.identificacao_se} onChange={e => setFormData(p => ({ ...p, identificacao_se: e.target.value }))} /></div>
              <div><Label>Clima</Label><Input placeholder="Ex: Ensolarado, 32°C" value={formData.clima} onChange={e => setFormData(p => ({ ...p, clima: e.target.value }))} /></div>
            </div>
          </CardContent>
        </Card>

        {/* Checklist */}
        <Card>
          <CardHeader><CardTitle className="text-base">Itens de Verificação</CardTitle><CardDescription>Marque o status de cada item</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            {checkItems.map(item => (
              <div key={item.id} className="border rounded-lg p-4 space-y-3">
                <div>
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.descricao}</p>
                </div>
                <RadioGroup value={item.status} onValueChange={v => updateCheckItem(item.id, "status", v)} className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-1.5"><RadioGroupItem value="conforme" id={`${item.id}-c`} /><Label htmlFor={`${item.id}-c`} className="text-xs font-normal cursor-pointer">Conforme</Label></div>
                  <div className="flex items-center gap-1.5"><RadioGroupItem value="nao_conforme" id={`${item.id}-nc`} /><Label htmlFor={`${item.id}-nc`} className="text-xs font-normal cursor-pointer">Não Conforme</Label></div>
                  <div className="flex items-center gap-1.5"><RadioGroupItem value="nao_aplicavel" id={`${item.id}-na`} /><Label htmlFor={`${item.id}-na`} className="text-xs font-normal cursor-pointer">N/A</Label></div>
                </RadioGroup>
                {item.status === "nao_conforme" && (
                  <Input placeholder="Observação sobre a não conformidade..." value={item.observacao} onChange={e => updateCheckItem(item.id, "observacao", e.target.value)} />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Photos */}
        <Card>
          <CardHeader><CardTitle className="text-base">Evidências Fotográficas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" multiple onChange={handlePhotoAdd} className="hidden" />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} type="button">
              <Camera className="w-4 h-4 mr-1" /> Adicionar Fotos
            </Button>
            {photoPreviewUrls.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {photoPreviewUrls.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt="" className="w-full h-24 object-cover rounded-lg border" />
                    <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Observações */}
        <Card>
          <CardHeader><CardTitle className="text-base">Observações / Recomendações</CardTitle></CardHeader>
          <CardContent>
            <Textarea placeholder="Observações gerais sobre a inspeção..." value={formData.observacoes} onChange={e => setFormData(p => ({ ...p, observacoes: e.target.value }))} rows={4} />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="flex-1">{saving ? "Salvando..." : "Salvar Inspeção"}</Button>
          <Button variant="outline" onClick={() => setView("dashboard")}>Cancelar</Button>
        </div>
      </div>
    );
  }

  // HISTORY
  if (view === "history") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setView("dashboard")}><ArrowLeft className="w-5 h-5" /></Button>
          <h1 className="text-xl font-bold">Histórico de Inspeções</h1>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="Aprovado">Aprovado</SelectItem>
                <SelectItem value="Com Pendências">Com Pendências</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-[180px]" />
          {filterDate && <Button variant="ghost" size="sm" onClick={() => setFilterDate("")}>Limpar data</Button>}
        </div>

        {filteredInspecoes.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhuma inspeção encontrada.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {filteredInspecoes.map(insp => (
              <InspecaoCard key={insp.id} insp={insp} onView={() => { setSelectedInspecao(insp); setView("detail"); }} onDelete={canDelete ? () => handleDelete(insp.id) : undefined} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // DETAIL
  if (view === "detail" && selectedInspecao) {
    const insp = selectedInspecao;
    const itens: CheckItem[] = typeof insp.itens_json === "string" ? JSON.parse(insp.itens_json) : (insp.itens_json || []);
    const naoConformes = itens.filter(i => i.status === "nao_conforme");

    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setView("history")}><ArrowLeft className="w-5 h-5" /></Button>
          <h1 className="text-xl font-bold">Detalhes da Inspeção</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{insp.identificacao_se}</CardTitle>
              <Badge variant={insp.status_geral === "Aprovado" ? "default" : "destructive"}>{insp.status_geral}</Badge>
            </div>
            <CardDescription>
              {format(new Date(insp.data_inspecao + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })} — Inspetor: {insp.inspetor}
              {insp.clima && ` — Clima: ${insp.clima}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Checklist summary */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Itens de Verificação</h3>
              <div className="space-y-2">
                {itens.map(item => (
                  <div key={item.id} className="flex items-start gap-2 text-sm">
                    {item.status === "conforme" ? <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" /> :
                     item.status === "nao_conforme" ? <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" /> :
                     <span className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0 text-center">—</span>}
                    <div>
                      <span className={item.status === "nao_conforme" ? "font-medium text-destructive" : ""}>{item.label}</span>
                      {item.observacao && <p className="text-xs text-muted-foreground">{item.observacao}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Photos */}
            {insp.fotos && insp.fotos.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Evidências</h3>
                <div className="grid grid-cols-3 gap-2">
                  {insp.fotos.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt="" className="w-full h-24 object-cover rounded-lg border hover:opacity-80 transition" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {insp.observacoes && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Observações</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{insp.observacoes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

// Card component for list items
function InspecaoCard({ insp, onView, onDelete }: { insp: InspecaoRecord; onView: () => void; onDelete?: () => void }) {
  const itens: CheckItem[] = typeof insp.itens_json === "string" ? JSON.parse(insp.itens_json) : (insp.itens_json || []);
  const naoConformes = itens.filter(i => i.status === "nao_conforme").length;
  const conformes = itens.filter(i => i.status === "conforme").length;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="py-4 px-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0" onClick={onView} role="button">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-sm truncate">{insp.identificacao_se}</p>
              <Badge variant={insp.status_geral === "Aprovado" ? "default" : "destructive"} className="text-[10px] shrink-0">{insp.status_geral}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {format(new Date(insp.data_inspecao + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })} — {insp.inspetor}
            </p>
            <div className="flex gap-3 mt-1.5 text-xs">
              <span className="text-green-600">✓ {conformes} conforme(s)</span>
              {naoConformes > 0 && <span className="text-destructive">✗ {naoConformes} não conforme(s)</span>}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" onClick={onView}><Eye className="w-4 h-4" /></Button>
            {onDelete && <Button variant="ghost" size="icon" onClick={onDelete}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
