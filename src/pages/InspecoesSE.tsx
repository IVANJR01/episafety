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
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { ClipboardCheck, Search as SearchIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Filter, FileDown, Camera, X, Pencil, Trash2, Sparkles, Loader2, ImageIcon, CalendarIcon, Upload } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import InspecaoImage from "@/components/InspecaoImage";
import { uploadInspecaoPhoto, getInspecaoPhotoSignedUrl, getInspecaoPhotoSignedUrls, deleteInspecaoPhoto } from "@/lib/inspecoesStorage";
import { saveOfflinePhoto, deleteOfflinePhoto } from "@/lib/inspecoesOfflinePhotos";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { isOnline, addToSyncQueue, getCachedData, setCachedData } from "@/lib/offlineStorage";
import { isNetworkFailure } from "@/lib/offlineViewCache";
import ImportarFotosDialog from "@/components/inspecoes/ImportarFotosDialog";
import ObraCombobox from "@/components/inspecoes/ObraCombobox";
import { criarObra } from "@/lib/obras";
import jsPDF from "jspdf";
import { getGDriveImageProxyUrl } from "@/lib/googleDrive";
import { mapearComLimite } from "@/lib/limitarConcorrencia";

const GRAVIDADE_OPTIONS = ["LEVE", "MODERADO", "GRAVE", "RISCO CRÍTICO"];
const NR_SUGESTOES = [
  "NR-01 — Item 1.4.1 — Disposições Gerais e Gerenciamento de Riscos Ocupacionais",
  "NR-04 — SESMT — Serviços Especializados em Segurança e Medicina do Trabalho",
  "NR-05 — CIPA — Comissão Interna de Prevenção de Acidentes",
  "NR-06 — Item 6.6.1 — Uso obrigatório de Equipamento de Proteção Individual",
  "NR-07 — PCMSO — Programa de Controle Médico de Saúde Ocupacional",
  "NR-08 — Edificações — Condições estruturais dos locais de trabalho",
  "NR-09 — PGR — Avaliação e controle de agentes físicos, químicos e biológicos",
  "NR-10 — Item 10.2.8 — Medidas de controle em instalações elétricas",
  "NR-10 — Item 10.4 — Segurança em projetos elétricos",
  "NR-11 — Movimentação e armazenagem de materiais",
  "NR-12 — Item 12.38 — Dispositivos de segurança em máquinas e equipamentos",
  "NR-12 — Capítulo XII — Capacitação em máquinas e equipamentos",
  "NR-13 — Caldeiras e vasos de pressão",
  "NR-15 — Atividades e operações insalubres",
  "NR-16 — Atividades e operações perigosas",
  "NR-17 — Ergonomia no ambiente de trabalho",
  "NR-18 — Item 18.6.1 — Instalações elétricas temporárias em canteiros de obra",
  "NR-20 — Segurança e saúde no trabalho com inflamáveis e combustíveis",
  "NR-23 — Item 23.1.1 — Proteção contra incêndios",
  "NR-24 — Seção 24.2 — Instalações sanitárias",
  "NR-24 — Seção 24.8 — Disposições gerais (água potável)",
  "NR-26 — Sinalização de segurança",
  "NR-33 — Segurança e saúde nos trabalhos em espaços confinados",
  "NR-35 — Item 35.4.5 — Sistema de proteção contra quedas em trabalho em altura",
];
const STATUS_OPTIONS = ["PENDENTE", "EM ANDAMENTO", "SOLUCIONADO"];
const LOAD_TIMEOUT_MS = 3000;

function isVencido(_item: { prazo_correcao?: string | null; status: string }): boolean {
  // Prazo/data limite deixou de ser obrigatório — não marcamos mais como vencido.
  return false;
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

export interface Conformidade {
  id: string;
  numero: number;
  data_inspecao: string;
  situacao_detectada: string;
  foto_antes: string | null;
  foto_depois: string | null;
  foto_antes_path: string | null;
  foto_depois_path: string | null;
  gravidade: string;
  acao_corretiva: string | null;
  responsavel: string | null;
  local: string | null;
  local_especifico?: string | null;
  obra_id?: string | null;
  data_realizado: string | null;
  prazo_correcao: string | null;
  resolved_by: string | null;
  status: string;
  empresa_id: string | null;
  created_at: string;
  referencia_normativa: string | null;
  trecho_norma: string | null;
}

type ObraOption = {
  id: string;
  nome: string;
  codigo: string | null;
  status: string;
};

const emptyForm = {
  data_inspecao: format(new Date(), "yyyy-MM-dd"),
  situacao_detectada: "",
  gravidade: "LEVE",
  acao_corretiva: "",
  responsavel: "",
  local: "",
  
  obra_id: "",
  prazo_correcao: "",
  data_realizado: "",
  status: "PENDENTE",
  referencia_normativa: "",
  trecho_norma: "",
};

export default function InspecoesSE() {
  const { user, empresaId, empresasIds, empresaScopeIds, isSuperAdmin, isPrincipal } = useAuth();
  const { canCreate, canDelete } = usePermissions("inspecoes_se");
  const [items, setItems] = useState<Conformidade[]>([]);
  const [obras, setObras] = useState<ObraOption[]>([]);
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
  const [existingFotoAntesPath, setExistingFotoAntesPath] = useState<string | null>(null);
  const [existingFotoDepoisPath, setExistingFotoDepoisPath] = useState<string | null>(null);
  const originalFotoAntesPathRef = useRef<string | null>(null);
  const originalFotoDepoisPathRef = useRef<string | null>(null);
  const antesRef = useRef<HTMLInputElement>(null);
  const depoisRef = useRef<HTMLInputElement>(null);
  const antesGalleryRef = useRef<HTMLInputElement>(null);
  const depoisGalleryRef = useRef<HTMLInputElement>(null);
  const antesAppRef = useRef<HTMLInputElement>(null);
  const depoisAppRef = useRef<HTMLInputElement>(null);
  const [cameraChooserFor, setCameraChooserFor] = useState<"antes" | "depois" | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const pdfImageCacheRef = useRef<Map<string, string | null>>(new Map());

  const [importarFotosAberto, setImportarFotosAberto] = useState(false);

  // Filters
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterGravidade, setFilterGravidade] = useState("all");
  const [filterObra, setFilterObra] = useState("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    const targetIds = empresaScopeIds && empresaScopeIds.length > 0 ? empresaScopeIds : (empresaId ? [empresaId] : []);

    if (targetIds.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    /*
     * A listagem mostra o que esta no banco, e so.
     *
     * Havia aqui uma lista de registros escrita dentro do proprio codigo, que
     * era acrescentada aos resultados de duas empresas especificas. Como esses
     * registros nao existem no banco, excluir nao tinha efeito: a exclusao
     * apagava zero linhas, o aviso dizia "Registro excluido" e no recarregar a
     * lista eles voltavam, para sempre. Editar tinha o mesmo destino.
     */

    if (!isOnline()) {
      const cached = getCachedData<Conformidade>("conformidades") || [];
      const filtered = cached.filter(item => item.empresa_id && targetIds.includes(item.empresa_id));
      setItems(filtered);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await withTimeout(
        (supabase.from as any)("conformidades")
          .select("*")
          .in("empresa_id", targetIds)
          .order("numero", { ascending: true })
      ) as any;

      if (error) throw error;

      const records = (data || []) as Conformidade[];
      setItems(records);
      /*
       * Resposta vazia nao apaga a copia local.
       *
       * Uma consulta pode voltar sem nada por motivo passageiro — a empresa
       * ativa ainda carregando, a permissao momentaneamente negada, um filtro
       * de escopo vazio. Gravar esse vazio por cima do cache destruiria a
       * unica copia offline dos registros, e ela nao volta sozinha. So se
       * grava quando ha o que gravar; para esvaziar de verdade existe a
       * exclusao, que age no banco.
       */
      if (records.length > 0) setCachedData("conformidades", records);
    } catch (error) {
      const cached = (getCachedData<Conformidade>("conformidades") || []).filter(item => item.empresa_id && targetIds.includes(item.empresa_id));
      setItems(cached);
    } finally {
      setLoading(false);
    }
  }, [empresaId, empresaScopeIds]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /*
   * Carrega obras (inclusive concluídas, caso uma inspeção antiga aponte
   * para elas).
   *
   * O escopo aqui tem que ser o MESMO das inspeções, que carregam com
   * `.in("empresa_id", targetIds)`. Buscar obra só da empresa ativa deixava
   * de fora a obra de qualquer outra empresa do escopo — e a inspeção dela
   * aparecia como "Obra removida", embora a obra existisse e estivesse
   * listada normalmente no Cadastro de Local.
   */
  useEffect(() => {
    const escopo = empresaScopeIds && empresaScopeIds.length > 0 ? empresaScopeIds : (empresaId ? [empresaId] : []);
    if (escopo.length === 0) { setObras([]); return; }
    (async () => {
      const { data } = await (supabase.from as any)("obras")
        .select("id,nome,codigo,status")
        .in("empresa_id", escopo)
        .order("nome", { ascending: true });
      setObras((data || []) as ObraOption[]);
    })();
  }, [empresaId, empresaScopeIds]);

  /*
   * Segunda passada: busca pelo id exato que as inspeções referenciam.
   *
   * A busca por empresa acima depende de a obra estar numa empresa do
   * escopo atual. Quando não está — e a inspeção continua apontando para
   * ela — a tela dizia "Obra removida" para uma obra viva e cadastrada.
   * Aqui o filtro de empresa sai: pergunta-se pelos ids em si.
   *
   * O que sobrar sem resposta depois disso não é obra apagada; é obra que
   * este usuário não tem permissão de ler. São coisas diferentes e a tela
   * passa a dizer cada uma pelo nome.
   */
  const idsTentados = useRef<Set<string>>(new Set());
  const [obrasSemAcesso, setObrasSemAcesso] = useState(false);

  useEffect(() => {
    const conhecidas = new Set(obras.map(o => o.id));
    const faltando = [...new Set(
      items.map(i => i.obra_id).filter((id): id is string => !!id && !conhecidas.has(id) && !idsTentados.current.has(id)),
    )];
    if (faltando.length === 0) return;
    faltando.forEach(id => idsTentados.current.add(id));
    (async () => {
      const { data } = await (supabase.from as any)("obras")
        .select("id,nome,codigo,status")
        .in("id", faltando);
      const achadas = (data || []) as ObraOption[];
      if (achadas.length > 0) setObras(prev => [...prev, ...achadas.filter(a => !prev.some(p => p.id === a.id))]);
      if (achadas.length < faltando.length) setObrasSemAcesso(true);
    })();
  }, [items, obras]);

  /**
   * Cria a obra digitada no próprio seletor e devolve o id, para o campo já
   * ficar preenchido. Nasce com o nome e o próximo código da sequência —
   * cidade, UF e status ficam para o Cadastro de Local, e não é preciso
   * ter nada disso à mão para registrar a não conformidade agora.
   */
  const criarObraRapida = useCallback(async (nome: string): Promise<string | null> => {
    if (!empresaId) return null;
    try {
      const nova = await criarObra({ empresaId, nome, userId: user?.id, existentes: obras });
      setObras(prev => [...prev, nova as ObraOption].sort((a, b) => a.nome.localeCompare(b.nome)));
      toast({ title: `Obra "${nova.nome}" criada`, description: `Código ${nova.codigo}` });
      return nova.id as string;
    } catch (e: any) {
      toast({ title: "Erro ao criar obra", description: e?.message, variant: "destructive" });
      return null;
    }
  }, [empresaId, obras, user?.id]);

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
          // O trecho da norma ia só para o aviso de canto de tela, que some em
          // segundos: a IA gerava e o sistema jogava fora. Num relatório de
          // inspeção é justamente ele que sustenta a autuação.
          trecho_norma: data.trecho_norma || p.trecho_norma,
        }));
        toast({
          title: "Sugestão aplicada",
          description: "Confira a referência, o trecho da norma e a ação antes de salvar.",
        });
      }
    } catch (err: any) {
      toast({ title: "Erro ao consultar IA", description: err?.message || "Tente novamente", variant: "destructive" });
    }
    setAiLoading(false);
  }

  /**
   * Contexto do último registro lançado: data, obra e local.
   *
   * Uma inspeção rende dezenas de não conformidades, todas do MESMO dia e do
   * mesmo local — as 22 desta empresa são todas de 03/07/2026. O formulário
   * voltava para a data de hoje a cada novo registro, obrigando a redigitar a
   * data da inspeção 22 vezes. Agora o próximo registro começa de onde o
   * anterior parou; quem estiver lançando outro dia é só trocar.
   *
   * Vem da lista carregada, não de um estado em memória: continua valendo
   * depois de recarregar a página.
   */
  function contextoAnterior() {
    // A lista vem ordenada por `numero` crescente: o último com data é o
    // lançamento mais recente, e é dele que o próximo registro continua.
    const ultimo = [...items].reverse().find((i) => i.data_inspecao);
    if (!ultimo) return null;
    return {
      data_inspecao: ultimo.data_inspecao,
      obra_id: ultimo.obra_id || "",
      local: ultimo.local || "",
    };
  }

  function openNew() {
    setEditingId(null);
    setErrors({});
    if (!hasDraft()) {
      resetDraft();
      const anterior = contextoAnterior();
      if (anterior) setForm({ ...emptyForm, ...anterior });
    } else setForm(form); // keep draft
    clearPhotoPreviews();
    originalFotoAntesPathRef.current = null;
    originalFotoDepoisPathRef.current = null;
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
      
      obra_id: item.obra_id || "",
      prazo_correcao: item.prazo_correcao || "",
      data_realizado: item.data_realizado || "",
      status: item.status,
      referencia_normativa: item.referencia_normativa || "",
      trecho_norma: item.trecho_norma || "",
    });
    setExistingFotoAntes(item.foto_antes);
    setExistingFotoDepois(item.foto_depois);
    setExistingFotoAntesPath(item.foto_antes_path || null);
    setExistingFotoDepoisPath(item.foto_depois_path || null);
    originalFotoAntesPathRef.current = item.foto_antes_path || null;
    originalFotoDepoisPathRef.current = item.foto_depois_path || null;
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
    setExistingFotoAntesPath(null);
    setExistingFotoDepoisPath(null);
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

  function buildPayload(
    foto_antes: string | null,
    foto_depois: string | null,
    foto_antes_path: string | null,
    foto_depois_path: string | null,
  ) {
    const isSolucionado = form.status === "SOLUCIONADO";
    return {
      data_inspecao: form.data_inspecao,
      situacao_detectada: form.situacao_detectada,
      gravidade: form.gravidade,
      acao_corretiva: form.acao_corretiva || null,
      responsavel: form.responsavel || null,
      obra_id: form.obra_id || null,
      local_especifico: null,
      // "local" mantido em branco (obra_id substitui). Preservamos coluna para dados antigos.
      local: null,
      prazo_correcao: form.prazo_correcao || null,
      // data_realizado só quando SOLUCIONADO; em novas/pendentes fica null
      data_realizado: isSolucionado ? (form.data_realizado || format(new Date(), "yyyy-MM-dd")) : null,
      resolved_by: isSolucionado ? (user?.id || null) : null,
      status: form.status,
      foto_antes,
      foto_depois,
      foto_antes_path,
      foto_depois_path,
      referencia_normativa: form.referencia_normativa || null,
      trecho_norma: form.trecho_norma || null,
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
      id: payload.id || crypto.randomUUID(),
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
    if (!form.obra_id) newErrors.obra_id = "Selecione a obra.";
    if (!form.situacao_detectada.trim()) newErrors.situacao_detectada = "Descreva a situação detectada.";
    if (!form.acao_corretiva.trim()) newErrors.acao_corretiva = "Descreva a ação corretiva.";
    // Responsável agora é opcional; Data da correção só é usada quando SOLUCIONADO (auto).

    if (!fotoAntesFile && !fotoAntesPreview && !existingFotoAntes && !existingFotoAntesPath) {
      newErrors.foto_antes = "Anexe a foto ANTES (obrigatória).";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({ title: "Verifique os campos obrigatórios", variant: "destructive" });
      setTimeout(() => {
        const el = document.querySelector("[data-error='true']") as HTMLElement | null;
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }
    setErrors({});

    if (!empresaId) {
      toast({ title: "Empresa não identificada", description: "Faça login novamente.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // OFFLINE — grava foto em IndexedDB (evita perder evidência se localStorage for limpo).
      if (!isOnline()) {
        const offlineId = editingId || crypto.randomUUID();
        let antesMarker: string | null = existingFotoAntes;
        let depoisMarker: string | null = form.status === "SOLUCIONADO" ? existingFotoDepois : null;
        try {
          if (fotoAntesFile) {
            antesMarker = await saveOfflinePhoto(offlineId, "antes", fotoAntesFile);
          }
          if (form.status === "SOLUCIONADO" && fotoDepoisFile) {
            depoisMarker = await saveOfflinePhoto(offlineId, "depois", fotoDepoisFile);
          }
        } catch (idbErr) {
          console.error("[Inspecoes] Falha ao salvar foto no IndexedDB:", idbErr);
          toast({
            title: "Não foi possível armazenar a foto no dispositivo",
            description: "Tente novamente ou libere espaço no aparelho.",
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
        const payload = buildPayload(
          antesMarker,
          depoisMarker,
          existingFotoAntesPath,
          form.status === "SOLUCIONADO" ? existingFotoDepoisPath : null,
        );
        if (!editingId) (payload as any).id = offlineId;
        saveOffline(payload);
        toast({ title: "Inspeção salva offline", description: "As fotos serão enviadas quando a conexão voltar." });
        resetDraft();
        setDialogOpen(false);
        setSaving(false);
        return;
      }


      // ONLINE — fluxo Storage do backend
      const shouldUploadDepois = form.status === "SOLUCIONADO" && !!fotoDepoisFile;

      // Determina o ID do registro (para compor o path do Storage)
      let inspectionId = editingId;
      let insertedRecord: any = null;
      if (!inspectionId) {
        // Cria o registro primeiro (sem fotos novas). Assim garantimos o id no path.
        const initialPayload = buildPayload(
          existingFotoAntes,
          existingFotoDepois,
          existingFotoAntesPath,
          existingFotoDepoisPath,
        );
        const { data, error } = await (supabase.from as any)("conformidades")
          .insert(initialPayload)
          .select("id")
          .single();
        if (error) throw error;
        insertedRecord = data;
        inspectionId = data.id;
      }

      // Upload das fotos para Supabase Storage
      let foto_antes_path = existingFotoAntesPath;
      let foto_depois_path = form.status === "SOLUCIONADO" ? existingFotoDepoisPath : null;
      let foto_antes = existingFotoAntes;
      let foto_depois = form.status === "SOLUCIONADO" ? existingFotoDepois : null;

      try {
        const uploads = await Promise.all([
          fotoAntesFile
            ? uploadInspecaoPhoto(fotoAntesFile, empresaId, inspectionId!, "antes")
            : Promise.resolve(null),
          shouldUploadDepois
            ? uploadInspecaoPhoto(fotoDepoisFile!, empresaId, inspectionId!, "depois")
            : Promise.resolve(null),
        ]);
        if (uploads[0]) {
          foto_antes_path = uploads[0].path;
          foto_antes = null; // path é a nova fonte-de-verdade; limpa legado
        }
        if (uploads[1]) {
          foto_depois_path = uploads[1].path;
          foto_depois = null;
        }
      } catch (upErr: any) {
        console.error("[Inspecoes] Falha no upload para o Storage:", upErr);
        toast({
          title: "Não foi possível enviar a foto para o Supabase Storage. Verifique a conexão e tente novamente.",
          variant: "destructive",
        });
        // Se foi um insert recém-criado sem foto, remove-o para não deixar registro órfão.
        if (insertedRecord && !editingId) {
          await (supabase.from as any)("conformidades").delete().eq("id", insertedRecord.id).eq("empresa_id", empresaId);
        }
        setSaving(false);
        return;
      }

      // Atualiza o registro com paths finais + demais campos do formulário
      const finalPayload = buildPayload(foto_antes, foto_depois, foto_antes_path, foto_depois_path);
      const { error: upErr } = await (supabase.from as any)("conformidades")
        .update(finalPayload)
        .eq("id", inspectionId!)
        .eq("empresa_id", empresaId);
      if (upErr) throw upErr;

      // C1 — Limpa fotos antigas do bucket que foram substituídas ou removidas.
      // Só apagamos APÓS o DB ter sido atualizado com sucesso, garantindo que a
      // inspeção nunca fique sem foto por causa de uma falha intermediária.
      const originalAntes = originalFotoAntesPathRef.current;
      const originalDepois = originalFotoDepoisPathRef.current;
      if (originalAntes && originalAntes !== foto_antes_path) {
        deleteInspecaoPhoto(originalAntes).catch(() => {});
      }
      if (originalDepois && originalDepois !== foto_depois_path) {
        deleteInspecaoPhoto(originalDepois).catch(() => {});
      }
      originalFotoAntesPathRef.current = foto_antes_path;
      originalFotoDepoisPathRef.current = foto_depois_path;

      toast({ title: editingId ? "Registro atualizado!" : "Registro criado!" });
      resetDraft();
      setDialogOpen(false);
      void loadData();
    } catch (err: any) {
      if (isNetworkFailure(err) || err?.message?.includes("fetch")) {
        const offlineId = editingId || crypto.randomUUID();
        let antesMarker: string | null = existingFotoAntes;
        let depoisMarker: string | null = form.status === "SOLUCIONADO" ? existingFotoDepois : null;
        try {
          if (fotoAntesFile) antesMarker = await saveOfflinePhoto(offlineId, "antes", fotoAntesFile);
          if (form.status === "SOLUCIONADO" && fotoDepoisFile) {
            depoisMarker = await saveOfflinePhoto(offlineId, "depois", fotoDepoisFile);
          }
        } catch (idbErr) {
          console.error("[Inspecoes] Falha ao salvar foto no IndexedDB (fallback):", idbErr);
        }
        const payload = buildPayload(
          antesMarker,
          depoisMarker,
          existingFotoAntesPath,
          form.status === "SOLUCIONADO" ? existingFotoDepoisPath : null,
        );
        if (!editingId) (payload as any).id = offlineId;
        saveOffline(payload);
        toast({ title: "Sem conexão", description: "Inspeção salva no dispositivo. Enviaremos as fotos quando a rede voltar." });
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
    // Captura paths antes de remover para conseguir apagar as fotos do bucket.
    const target = items.find(i => i.id === id);
    const antesPath = target?.foto_antes_path || null;
    const depoisPath = target?.foto_depois_path || null;
    // Também limpa qualquer foto pendente no IDB (caso o registro seja offline).
    deleteOfflinePhoto(`idbphoto://${id}__antes`).catch(() => {});
    deleteOfflinePhoto(`idbphoto://${id}__depois`).catch(() => {});
    try {
      if (isOnline()) {
        /*
         * `select()` no fim devolve as linhas que foram REALMENTE apagadas.
         *
         * Sem isso a exclusao mentia: quando nenhuma linha era atingida — por
         * o registro nao existir no banco, ou pertencer a uma filial diferente
         * da empresa ativa, ou a permissao barrar — o Supabase nao devolve
         * erro nenhum, apenas apaga zero linhas. O aviso dizia "Registro
         * excluido", a lista recarregava e o registro continuava la.
         *
         * O filtro de empresa passa a ser a arvore que a propria listagem usa,
         * senao um registro de filial aparece na tela e nao pode ser apagado.
         */
        const escopo = empresaScopeIds && empresaScopeIds.length > 0
          ? empresaScopeIds
          : (empresaId ? [empresaId] : []);
        const { data: apagados, error } = await (supabase.from as any)("conformidades")
          .delete().eq("id", id).in("empresa_id", escopo).select("id");
        if (error) throw error;
        if (!apagados || apagados.length === 0) {
          toast({
            title: "Nada foi excluído",
            description: "Este registro não foi encontrado no banco para a empresa ativa. Recarregue a tela; se ele continuar aparecendo, avise o suporte.",
            variant: "destructive",
          });
          void loadData();
          return;
        }
        // C1 — melhor esforço: apaga fotos órfãs do bucket após remoção no DB.
        if (antesPath) deleteInspecaoPhoto(antesPath).catch(() => {});
        if (depoisPath) deleteInspecaoPhoto(depoisPath).catch(() => {});
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

      // Sem a mensagem do erro nao dava para saber o que houve — nem para
      // quem usa, nem para quem vai corrigir.
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[inspecoes] falha ao excluir:", error);
      toast({ title: "Erro ao excluir", description: msg, variant: "destructive" });
    }
  }

  const MAX_IMG_WIDTH = 600;
  const IMG_TIMEOUT_MS = 15000;

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
      const result = await fetchImageAsDataUrl(url, IMG_TIMEOUT_MS);
      if (result) {
        pdfImageCacheRef.current.set(url, result);
        return result;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Carrega a imagem, tentando de novo quando falha.
   *
   * Duas tentativas, não três: a terceira quase nunca salvava e o laço custava
   * caro no agregado. Numa foto cuja origem simplesmente não devolve imagem —
   * link do Drive antes da correção do proxy —, cada tentativa extra é espera
   * pura, multiplicada por quantas fotos estiverem no mesmo estado.
   *
   * A espera entre tentativas dobra em vez de ser fixa: se a origem está
   * congestionada, insistir no mesmo ritmo piora.
   */
  async function loadImageAsDataUrl(url: string): Promise<string | null> {
    const TENTATIVAS = 2;
    for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
      const result = await loadImageAsDataUrlOnce(url);
      if (result) return result;
      // Limpa o registro da falha para a próxima tentativa não devolver o
      // resultado negativo guardado.
      pdfImageCacheRef.current.delete(url);
      // Sem espera depois da última: ela só atrasaria o retorno do erro.
      if (tentativa < TENTATIVAS) {
        await new Promise((r) => setTimeout(r, 400 * tentativa));
      }
    }
    return null;
  }

  function bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  function crc32(bytes: Uint8Array): number {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function adler32(bytes: Uint8Array): number {
    let a = 1;
    let b = 0;
    for (let i = 0; i < bytes.length; i++) {
      a = (a + bytes[i]) % 65521;
      b = (b + a) % 65521;
    }
    return ((b << 16) | a) >>> 0;
  }

  function writeU32(target: number[], value: number) {
    target.push((value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255);
  }

  function pngChunk(type: string, data: Uint8Array): Uint8Array {
    const typeBytes = new TextEncoder().encode(type);
    const crcInput = new Uint8Array(typeBytes.length + data.length);
    crcInput.set(typeBytes, 0);
    crcInput.set(data, typeBytes.length);
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    out.set(typeBytes, 4);
    out.set(data, 8);
    view.setUint32(8 + data.length, crc32(crcInput));
    return out;
  }

  function zlibStore(bytes: Uint8Array): Uint8Array {
    const out: number[] = [0x78, 0x01];
    let offset = 0;
    while (offset < bytes.length) {
      const len = Math.min(65535, bytes.length - offset);
      const finalBlock = offset + len >= bytes.length ? 1 : 0;
      out.push(finalBlock, len & 255, (len >>> 8) & 255, (~len) & 255, ((~len) >>> 8) & 255);
      for (let i = offset; i < offset + len; i++) out.push(bytes[i]);
      offset += len;
    }
    writeU32(out, adler32(bytes));
    return new Uint8Array(out);
  }

  function canvasToOpaqueRgbPngDataUrl(canvas: HTMLCanvasElement): string {
    const ctx = canvas.getContext("2d")!;
    const { width, height } = canvas;
    const rgba = ctx.getImageData(0, 0, width, height).data;
    const raw = new Uint8Array(height * (1 + width * 3));
    let p = 0;
    for (let y = 0; y < height; y++) {
      raw[p++] = 0;
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const alpha = rgba[i + 3] / 255;
        raw[p++] = Math.round(rgba[i] * alpha + 255 * (1 - alpha));
        raw[p++] = Math.round(rgba[i + 1] * alpha + 255 * (1 - alpha));
        raw[p++] = Math.round(rgba[i + 2] * alpha + 255 * (1 - alpha));
      }
    }

    const ihdr = new Uint8Array(13);
    const view = new DataView(ihdr.buffer);
    view.setUint32(0, width);
    view.setUint32(4, height);
    ihdr[8] = 8;  // bit depth
    ihdr[9] = 2;  // truecolor RGB, sem canal alpha
    ihdr[10] = 0; // compression
    ihdr[11] = 0; // filter
    ihdr[12] = 0; // interlace

    const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const chunks = [signature, pngChunk("IHDR", ihdr), pngChunk("IDAT", zlibStore(raw)), pngChunk("IEND", new Uint8Array())];
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const png = new Uint8Array(total);
    let offset = 0;
    chunks.forEach((chunk) => { png.set(chunk, offset); offset += chunk.length; });
    return `data:image/png;base64,${bytesToBase64(png)}`;
  }

  /**
   * Carrega a logo, achata sobre fundo BRANCO e exporta como PNG opaco.
   * Suporta PNG (com/sem alpha), JPG, WEBP e SVG.
   */
  async function loadLogoAsPngDataUrl(url: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
    const loadViaImage = (src: string) =>
      new Promise<{ dataUrl: string; w: number; h: number }>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const MAX = 800;
          let w = img.naturalWidth || img.width || 300;
          let h = img.naturalHeight || img.height || 120;
          if (!w || !h) { w = 300; h = 120; }
          if (w > MAX) { h = Math.round(h * (MAX / w)); w = MAX; }
          if (h > MAX) { w = Math.round(w * (MAX / h)); h = MAX; }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          try {
            resolve({ dataUrl: canvas.toDataURL("image/png"), w, h });
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = () => reject(new Error("image load failed"));
        img.src = src;
      });

    // 1) Try direct load first (public URLs, same-origin)
    try {
      return await loadViaImage(url);
    } catch {}

    // 2) Fallback: fetch as blob then use blob URL (helps CORS/signed URLs)
    try {
      const resp = await fetch(url, { mode: "cors" });
      if (!resp.ok) return null;
      const blob = await resp.blob();
      if (blob.size < 50) return null;
      const blobUrl = URL.createObjectURL(blob);
      try {
        return await loadViaImage(blobUrl);
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    } catch {
      return null;
    }
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
    let logoData: { dataUrl: string; w: number; h: number } | null = null;
    let empresaNome = "";
    try {
      if (empresaId && isOnline()) {
        const { data: empresa } = await (supabase.from as any)("empresa_config")
          .select("logo_url, nome")
          .eq("id", empresaId)
          .maybeSingle();

        const logoSourceUrl = isValidPdfImageUrl(empresa?.logo_url) ? empresa.logo_url : null;
        if (logoSourceUrl) {
          logoData = await loadLogoAsPngDataUrl(logoSourceUrl);
        }

        empresaNome = empresa?.nome || "";

        // Fallback: try to read nome from empresas table if empresa_config is empty
        if (!empresaNome) {
          try {
            const { data: emp } = await (supabase.from as any)("empresas")
              .select("nome")
              .eq("id", empresaId)
              .maybeSingle();
            empresaNome = emp?.nome || "";
          } catch {}
        }
      }
    } catch {}

    // Pre-load all item photos IN PARALLEL with allSettled (never skip slow images)
    const filtered = getFilteredItems(dateRange);
    const photoCache: Record<string, { antes: string | null; depois: string | null }> = {};
    const placeholderDataUrl = generatePlaceholderDataUrl();

    /*
     * Assinar TODAS as fotos do storage numa requisição só.
     *
     * Antes era uma chamada por foto, espremida dentro de lotes de dois itens:
     * num relatório de 28 não conformidades, 17 idas ao servidor só para
     * assinar, em série, antes de qualquer download começar.
     */
    const caminhos = filtered.flatMap((i) =>
      [i.foto_antes_path, i.foto_depois_path].filter(Boolean) as string[]);
    const assinadas = await getInspecaoPhotoSignedUrls(caminhos, 900);

    /*
     * Foto do Google Drive precisa passar pelo proxy.
     *
     * As inspeções antigas guardaram a foto como link do Drive
     * (drive.google.com/uc?export=view&id=...) em vez de arquivo no storage.
     * Esse endereço não devolve os bytes da imagem para o navegador: não manda
     * cabeçalho de CORS e costuma responder uma página HTML de confirmação.
     *
     * A função gdrive-proxy já existe e resolve isso — busca no servidor e
     * devolve com CORS. Só não estava sendo usada aqui.
     */
    const resolvePhotoSrc = (path: string | null, legacy: string | null): string | null => {
      if (path) return assinadas.get(path) || null;
      if (!isValidPdfImageUrl(legacy)) return null;
      return getGDriveImageProxyUrl(legacy) || legacy;
    };

    /** Quantas fotos existiam no cadastro e não entraram no PDF. */
    let fotosQueFalharam = 0;

    /*
     * Downloads com teto, sem lote travado.
     *
     * O formato anterior era: dois itens por rodada, esperar a foto mais lenta
     * da rodada, dormir 600ms, repetir. Com 28 itens isso dava 14 esperas em
     * série mais 7,8 segundos de pausa fixa — quase tudo tempo parado.
     *
     * A pausa fixa existia para segurar o rate-limit da API. Ela deixa de ser
     * necessária porque o grosso das requisições era a assinatura uma a uma,
     * que agora é uma só; o que sobra é download de arquivo, que não passa
     * pelo mesmo limite. O teto de 6 continua respeitando o limite de conexões
     * por domínio do navegador.
     */
    await mapearComLimite(filtered, 6, async (item) => {
      const antesSrc = resolvePhotoSrc(item.foto_antes_path, item.foto_antes);
      const depoisSrc = resolvePhotoSrc(item.foto_depois_path, item.foto_depois);
      const [antes, depois] = await Promise.all([
        antesSrc ? loadImageAsDataUrl(antesSrc) : Promise.resolve(null),
        depoisSrc ? loadImageAsDataUrl(depoisSrc) : Promise.resolve(null),
      ]);
      if (antesSrc && !antes) fotosQueFalharam++;
      if (depoisSrc && !depois) fotosQueFalharam++;
      photoCache[item.id] = {
        antes: antesSrc ? (antes || placeholderDataUrl) : null,
        depois: depoisSrc ? (depois || placeholderDataUrl) : null,
      };
    });
    // ======================================================================
    // RELATÓRIO FOTOGRÁFICO DE INSPEÇÕES — formato laudo profissional
    // ======================================================================
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();   // 210
    const pageHeight = doc.internal.pageSize.getHeight(); // 297
    const MARGIN = 14;
    const contentW = pageWidth - MARGIN * 2;

    // ---------- Paleta ----------
    const NAVY: [number, number, number] = [30, 58, 110];
    const NAVY_SOFT: [number, number, number] = [235, 240, 250];
    const GREY_LINE: [number, number, number] = [220, 220, 220];
    const GREY_TXT: [number, number, number] = [110, 110, 110];
    const ORANGE: [number, number, number] = [234, 88, 12];
    const GREEN: [number, number, number] = [22, 163, 74];
    const RED: [number, number, number] = [220, 38, 38];
    const BLUE: [number, number, number] = [37, 99, 235];
    const YELLOW: [number, number, number] = [202, 138, 4];

    const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
    const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);
    const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);

    const statusColor = (s: string): [number, number, number] => {
      const u = (s || "").toUpperCase();
      if (u === "SOLUCIONADO") return GREEN;
      if (u === "EM ANDAMENTO" || u === "EM_ANDAMENTO") return BLUE;
      if (u === "PENDENTE") return ORANGE;
      return GREY_TXT;
    };
    const gravidadeColor = (g: string): [number, number, number] => {
      const u = (g || "").toUpperCase();
      if (u.includes("CRÍTICO") || u.includes("CRITICO")) return RED;
      if (u.includes("GRAVE") || u.includes("ALTA")) return RED;
      if (u.includes("MODERADO") || u.includes("MÉDIA") || u.includes("MEDIA")) return YELLOW;
      if (u.includes("LEVE")) return BLUE;
      return GREY_TXT;
    };

    // ---------- Helpers ----------
    const getImgDims = (dataUrl: string): { w: number; h: number } => {
      try {
        const props = (doc as any).getImageProperties(dataUrl);
        if (props?.width > 0 && props?.height > 0) return { w: props.width, h: props.height };
      } catch {}
      return { w: 0, h: 0 };
    };

    const drawBadge = (text: string, x: number, y: number, color: [number, number, number], padX = 3, padY = 1.4, fontSize = 8) => {
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", "bold");
      const tw = doc.getTextWidth(text);
      const w = tw + padX * 2;
      const h = fontSize * 0.42 + padY * 2;
      setFill(color);
      doc.roundedRect(x, y, w, h, 1.4, 1.4, "F");
      setText([255, 255, 255]);
      doc.text(text, x + padX, y + h - padY - 0.6);
      setText([0, 0, 0]);
      doc.setFont("helvetica", "normal");
      return { w, h };
    };

    const drawPageFooter = () => {
      const total = doc.getNumberOfPages();
      const cur = (doc as any).getCurrentPageInfo?.().pageNumber ?? total;
      doc.setFontSize(7.5);
      setText(GREY_TXT);
      doc.text(
        `${empresaNome || ""}${empresaNome ? "  ·  " : ""}Página ${cur}`,
        pageWidth / 2, pageHeight - 6, { align: "center" }
      );
      setText([0, 0, 0]);
    };

    let pageIsFirst = true;
    const drawTopBar = () => {
      setFill(NAVY);
      doc.rect(0, 0, pageWidth, 6, "F");
    };

    const ensureSpace = (needed: number, cursor: number): number => {
      if (cursor + needed > pageHeight - 14) {
        drawPageFooter();
        doc.addPage();
        drawTopBar();
        return 14;
      }
      return cursor;
    };

    // ---------- CAPA ----------
    drawTopBar();
    let y = 16;

    let logoDrawn = false;
    if (logoData?.dataUrl) {
      try {
        const maxH = 20, maxW = 45;
        const ar = logoData.w && logoData.h ? logoData.w / logoData.h : 2;
        let w = maxW, h = w / ar;
        if (h > maxH) { h = maxH; w = h * ar; }
        doc.setFillColor(255, 255, 255);
        doc.rect(MARGIN, y, w, h, "F");
        doc.addImage(logoData.dataUrl, "PNG", MARGIN, y, w, h, undefined, "FAST");
        logoDrawn = true;
      } catch {}
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    setText(NAVY);
    // Se não houver logo, mostra o nome da empresa em destaque à esquerda também
    if (!logoDrawn && empresaNome) {
      doc.text(empresaNome, MARGIN, y + 7);
    }
    doc.text(empresaNome || "Empresa", pageWidth - MARGIN, y + 5, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setText(GREY_TXT);
    doc.text(`Emitido em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, pageWidth - MARGIN, y + 11, { align: "right" });
    setText([0, 0, 0]);

    y += 28;

    // Título
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    setText(NAVY);
    doc.text("RELATÓRIO DE INSPEÇÃO DE SEGURANÇA", pageWidth / 2, y, { align: "center" });
    y += 5;
    setDraw(NAVY);
    doc.setLineWidth(0.6);
    doc.line(pageWidth / 2 - 40, y, pageWidth / 2 + 40, y);
    setText([0, 0, 0]);
    y += 8;

    // Metadados da capa
    const uniqueLocais = Array.from(new Set(
      filtered.map(it => {
        const o = obras.find(o => o.id === it.obra_id);
        return o?.nome || it.local || "";
      }).filter(Boolean)
    ));
    const localCapa = uniqueLocais.length === 1
      ? uniqueLocais[0]
      : uniqueLocais.length === 0 ? "—" : `${uniqueLocais.length} locais`;

    const periodoTxt = dateRange?.start || dateRange?.end
      ? `${dateRange?.start ? format(dateRange.start, "dd/MM/yyyy") : "—"} a ${dateRange?.end ? format(dateRange.end, "dd/MM/yyyy") : "—"}`
      : "Todos os registros";

    const metaRows: [string, string][] = [
      ["Local / Obra", localCapa],
      ["Período", periodoTxt],
      ["Total de inspeções", String(filtered.length)],
    ];

    doc.setFontSize(9.5);
    metaRows.forEach(([k, v]) => {
      doc.setFont("helvetica", "bold");
      setText(GREY_TXT);
      doc.text(k.toUpperCase(), MARGIN, y);
      doc.setFont("helvetica", "normal");
      setText([0, 0, 0]);
      const lines = doc.splitTextToSize(v, contentW - 50);
      doc.text(lines, MARGIN + 50, y);
      y += Math.max(6, lines.length * 5);
    });
    y += 4;

    // ---------- RESUMO ----------
    const summarize = () => {
      const total = filtered.length;
      const pend = filtered.filter(i => (i.status || "").toUpperCase() === "PENDENTE").length;
      const andamento = filtered.filter(i => (i.status || "").toUpperCase().replace("_", " ") === "EM ANDAMENTO").length;
      const sol = filtered.filter(i => (i.status || "").toUpperCase() === "SOLUCIONADO").length;
      const grave = filtered.filter(i => {
        const g = (i.gravidade || "").toUpperCase();
        return g.includes("GRAVE") || g.includes("ALTA");
      }).length;
      const critico = filtered.filter(i => {
        const g = (i.gravidade || "").toUpperCase();
        return g.includes("CRÍTICO") || g.includes("CRITICO");
      }).length;
      return { total, pend, andamento, sol, grave, critico };
    };
    const s = summarize();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    setText(NAVY);
    doc.text("RESUMO", MARGIN, y);
    setText([0, 0, 0]);
    y += 4;
    setDraw(GREY_LINE);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    y += 4;

    const cards: [string, string, [number, number, number]][] = [
      ["Total", String(s.total), NAVY],
      ["Pendentes", String(s.pend), ORANGE],
      ["Em andamento", String(s.andamento), BLUE],
      ["Solucionadas", String(s.sol), GREEN],
      ["Graves", String(s.grave), RED],
      ["Risco crítico", String(s.critico), RED],
    ];
    const cardW = (contentW - 5 * 3) / 6;
    const cardH = 20;
    cards.forEach((c, i) => {
      const cx = MARGIN + i * (cardW + 3);
      setFill(NAVY_SOFT);
      doc.roundedRect(cx, y, cardW, cardH, 1.5, 1.5, "F");
      setFill(c[2]);
      doc.rect(cx, y, cardW, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      setText(c[2]);
      doc.text(c[1], cx + cardW / 2, y + 11, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      setText(GREY_TXT);
      doc.text(c[0], cx + cardW / 2, y + 16.5, { align: "center" });
    });
    setText([0, 0, 0]);
    y += cardH + 8;

    // ---------- BLOCOS DE INSPEÇÕES ----------
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    setText(NAVY);
    doc.text("INSPEÇÕES", MARGIN, y);
    setText([0, 0, 0]);
    y += 3;
    setDraw(GREY_LINE);
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    y += 5;

    if (filtered.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      setText(GREY_TXT);
      doc.text("Nenhuma inspeção encontrada para os filtros selecionados.", pageWidth / 2, y + 10, { align: "center" });
      setText([0, 0, 0]);
    }

    // Helper: draw one inspection block, returns new Y
    const drawBlock = (item: any, idx: number, startY: number): number => {
      // Bloco começa com estimativa mínima; nova página se necessário
      let cy = ensureSpace(70, startY);

      const obra = obras.find(o => o.id === item.obra_id);
      const obraNome = obra?.nome || item.local || "—";
      const statusTxt = (item.status || "").toUpperCase() || "—";
      const gravTxt = (item.gravidade || "").toUpperCase() || "—";
      const dataInsp = item.data_inspecao
        ? format(new Date(item.data_inspecao + "T12:00:00"), "dd/MM/yyyy")
        : "—";
      const dataReal = item.data_realizado
        ? format(new Date(item.data_realizado + "T12:00:00"), "dd/MM/yyyy")
        : null;

      // Cabeçalho do bloco
      setFill(NAVY_SOFT);
      doc.roundedRect(MARGIN, cy, contentW, 10, 1.5, 1.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      setText(NAVY);
      const titulo = `NÃO CONFORMIDADE Nº ${String(idx + 1).padStart(3, "0")}`;
      doc.text(titulo, MARGIN + 3, cy + 6.6);

      // Badges à direita
      let bx = pageWidth - MARGIN - 3;
      const stBadge = { text: statusTxt, color: statusColor(statusTxt) };
      const grBadge = { text: gravTxt, color: gravidadeColor(gravTxt) };
      // Desenhar da direita para a esquerda
      const measureBadge = (t: string, fs = 7.5) => {
        doc.setFontSize(fs); doc.setFont("helvetica", "bold");
        return doc.getTextWidth(t) + 6;
      };
      const stW = measureBadge(stBadge.text);
      const grW = measureBadge(grBadge.text);
      drawBadge(stBadge.text, bx - stW, cy + 2.4, stBadge.color, 3, 1.4, 7.5);
      bx -= (stW + 3);
      drawBadge(grBadge.text, bx - grW, cy + 2.4, grBadge.color, 3, 1.4, 7.5);
      setText([0, 0, 0]);
      cy += 13;

      // Linha meta: data | local | responsavel | data correção
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      const metaLine = (label: string, value: string, col: number, colW: number, baseY: number) => {
        setText(GREY_TXT);
        doc.setFont("helvetica", "bold");
        doc.text(label.toUpperCase(), MARGIN + col, baseY);
        doc.setFont("helvetica", "normal");
        setText([0, 0, 0]);
        const lines = doc.splitTextToSize(value || "—", colW - 2);
        doc.text(lines, MARGIN + col, baseY + 4);
        return lines.length;
      };
      const colW = contentW / 4;
      const nl1 = Math.max(
        metaLine("Data da inspeção", dataInsp, 0, colW, cy),
        metaLine("Local", obraNome, colW, colW, cy),
        metaLine("Responsável", item.responsavel || "—", colW * 2, colW, cy),
        metaLine("Data da correção", dataReal || "—", colW * 3, colW, cy),
      );
      cy += 4 + nl1 * 4 + 2;

      // Referência normativa
      if (item.referencia_normativa) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        setText(GREY_TXT);
        doc.text("REFERÊNCIA NORMATIVA", MARGIN, cy);
        cy += 4;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        setText(NAVY);
        const nrLines = doc.splitTextToSize(item.referencia_normativa, contentW);
        doc.text(nrLines, MARGIN, cy);
        cy += nrLines.length * 4.5 + 2;

        // O que a norma exige, logo abaixo da citação. Sem isto o relatório
        // afirma "descumpre a NR-10 item 10.3.2" e deixa quem lê procurando o
        // texto da norma para saber o que isso quer dizer.
        if (item.trecho_norma) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          setText(GREY_TXT);
          const trechoLines = doc.splitTextToSize(item.trecho_norma, contentW);
          doc.text(trechoLines, MARGIN, cy);
          cy += trechoLines.length * 4 + 2;
        }
        setText([0, 0, 0]);
      }

      // Situação detectada
      cy = ensureSpace(20, cy);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setText(GREY_TXT);
      doc.text("SITUAÇÃO DETECTADA", MARGIN, cy);
      cy += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      setText([0, 0, 0]);
      const sitLines = doc.splitTextToSize(item.situacao_detectada || "—", contentW);
      // page-break inside long text
      for (let i = 0; i < sitLines.length; i++) {
        cy = ensureSpace(5, cy);
        doc.text(sitLines[i], MARGIN, cy);
        cy += 4.5;
      }
      cy += 2;

      // Ação corretiva
      cy = ensureSpace(20, cy);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setText(GREY_TXT);
      doc.text("AÇÃO CORRETIVA", MARGIN, cy);
      cy += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      setText([0, 0, 0]);
      const acLines = doc.splitTextToSize(item.acao_corretiva || "—", contentW);
      for (let i = 0; i < acLines.length; i++) {
        cy = ensureSpace(5, cy);
        doc.text(acLines[i], MARGIN, cy);
        cy += 4.5;
      }
      cy += 3;

      // Fotos — antes / depois lado a lado
      const cache = photoCache[item.id];
      const photoH = 62;
      const gap = 4;
      const photoW = (contentW - gap) / 2;

      cy = ensureSpace(photoH + 12, cy);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setText(GREY_TXT);
      doc.text("EVIDÊNCIAS FOTOGRÁFICAS", MARGIN, cy);
      setText([0, 0, 0]);
      cy += 3.5;

      const drawPhotoBox = (label: string, dataUrl: string | null, x: number, boxY: number, w: number, h: number, emptyMsg: string) => {
        // legenda
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        setText(NAVY);
        doc.text(label, x, boxY - 1);
        setText([0, 0, 0]);
        // moldura
        setFill([248, 248, 248]);
        setDraw(GREY_LINE);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, boxY, w, h, 1.5, 1.5, "FD");
        if (dataUrl) {
          try {
            const d = getImgDims(dataUrl);
            const pad = 2;
            const maxW = w - pad * 2, maxH = h - pad * 2;
            const ar = d.w && d.h ? d.w / d.h : maxW / maxH;
            let dw = maxW, dh = dw / ar;
            if (dh > maxH) { dh = maxH; dw = dh * ar; }
            const dx = x + (w - dw) / 2;
            const dy = boxY + (h - dh) / 2;
            doc.addImage(dataUrl, "JPEG", dx, dy, dw, dh);
          } catch {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(9);
            setText(GREY_TXT);
            doc.text(emptyMsg, x + w / 2, boxY + h / 2, { align: "center" });
            setText([0, 0, 0]);
            doc.setFont("helvetica", "normal");
          }
        } else {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(9);
          setText(GREY_TXT);
          const lines = doc.splitTextToSize(emptyMsg, w - 6);
          const bh = lines.length * 4.5;
          doc.text(lines, x + w / 2, boxY + h / 2 - bh / 2 + 3, { align: "center" });
          setText([0, 0, 0]);
          doc.setFont("helvetica", "normal");
        }
      };

      const isPend = statusTxt === "PENDENTE";
      const emptyDepois = isPend ? "Correção ainda não registrada." : "Sem foto";
      drawPhotoBox("Foto ANTES", cache?.antes || null, MARGIN, cy + 3, photoW, photoH, "Sem foto");
      drawPhotoBox("Foto DEPOIS", cache?.depois || null, MARGIN + photoW + gap, cy + 3, photoW, photoH, emptyDepois);
      cy += photoH + 6;

      // Separador entre blocos
      cy += 4;
      setDraw(GREY_LINE);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, cy, pageWidth - MARGIN, cy);
      cy += 6;

      return cy;
    };

    filtered.forEach((item, idx) => {
      y = drawBlock(item, idx, y);
    });

    // Rodapé final
    drawPageFooter();

    doc.save(`Relatorio_Inspecoes_${format(new Date(), "yyyy-MM-dd")}.pdf`);

    // Free memory: clear cached Base64 strings
    pdfImageCacheRef.current.clear();
    Object.keys(photoCache).forEach((k) => delete photoCache[k]);

    /*
     * Falha de foto não pode sair calada.
     *
     * Quando o carregamento falha, o quadro recebe um retângulo cinza
     * "Imagem Indisponível" — e quem gerou o relatório não fica sabendo de
     * nada. Foi assim que 11 fotos sumiram de um laudo de 28 não
     * conformidades sem ninguém perceber na hora. Pior: o jsPDF reaproveita a
     * mesma imagem repetida, então o arquivo nem fica maior para denunciar.
     */
    if (fotosQueFalharam > 0) {
      toast({
        title: `PDF gerado — ${fotosQueFalharam} ${fotosQueFalharam === 1 ? "foto não carregou" : "fotos não carregaram"}`,
        description: "Os quadros dessas fotos saíram marcados como indisponíveis. Reenvie a foto pelo formulário da inspeção para corrigir.",
        variant: "destructive",
      });
    } else {
      toast({ title: "PDF gerado com sucesso!" });
    }
  }

  function getFilteredItems(opts?: { start?: Date; end?: Date }) {
    const result = items.filter(i => {
      if (filterStatus !== "all" && i.status !== filterStatus) return false;
      if (filterGravidade !== "all" && i.gravidade !== filterGravidade) return false;
      if (filterObra !== "all" && i.obra_id !== filterObra) return false;
      if (opts?.start || opts?.end) {
        const d = i.data_inspecao ? new Date(i.data_inspecao + "T00:00:00") : null;
        if (!d) return false;
        if (opts.start && d < new Date(format(opts.start, "yyyy-MM-dd") + "T00:00:00")) return false;
        if (opts.end && d > new Date(format(opts.end, "yyyy-MM-dd") + "T23:59:59")) return false;
      }
      return true;
    });

    // Ordenar por data mais recente primeiro para que inspeções do mesmo dia não fiquem "misturadas" com outras datas
    return result.sort((a, b) => {
      const dateA = a.data_inspecao ? new Date(a.data_inspecao + "T00:00:00").getTime() : 0;
      const dateB = b.data_inspecao ? new Date(b.data_inspecao + "T00:00:00").getTime() : 0;
      return dateB - dateA;
    });
  }

  const filtered = getFilteredItems();
  const pendentes = items.filter(i => i.status === "PENDENTE").length;
  const solucionados = items.filter(i => i.status === "SOLUCIONADO").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        title="Inspeções"
        subtitle="Registro de não conformidades, evidências fotográficas e ações corretivas."
        actions={
          <>
            {canCreate && (
              <Button onClick={openNew} className="text-xs sm:text-sm">
                <Plus className="w-4 h-4 mr-1 sm:mr-2" /> Nova Inspeção
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setExportDateStart(undefined);
                setExportDateEnd(undefined);
                setExportDialogOpen(true);
              }}
              className="text-xs sm:text-sm"
            >
              <FileDown className="w-4 h-4 mr-1 sm:mr-2" /> Gerar Relatório
            </Button>
            {canCreate && items.some((i) => !i.foto_antes_path && !i.foto_antes) && (
              <Button variant="outline" onClick={() => setImportarFotosAberto(true)} className="text-xs sm:text-sm">
                <Upload className="w-4 h-4 mr-1 sm:mr-2" /> Importar fotos
              </Button>
            )}
          </>
        }
      />

      {obrasSemAcesso && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-medium text-destructive">Algumas obras não puderam ser lidas.</p>
          <p className="mt-1 text-muted-foreground">
            As inspeções abaixo continuam ligadas às suas obras — elas não foram apagadas. O banco de dados está
            recusando a leitura da tabela <code className="text-xs">obras</code> para este usuário (política RLS).
            Enquanto isso não for ajustado, o nome da obra não aparece aqui nem no relatório.
          </p>
        </div>
      )}

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
        <Select value={filterObra} onValueChange={setFilterObra}>
          <SelectTrigger className="w-[200px] h-10"><SelectValue placeholder="Obra" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Obras</SelectItem>
            {obras.map(o => (
              <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <ListSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        items.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Nenhuma inspeção registrada"
            description="Registre a primeira inspeção para acompanhar não conformidades e ações corretivas."
            action={canCreate ? (
              <Button onClick={openNew}>
                <Plus className="w-4 h-4 mr-2" /> Nova Inspeção
              </Button>
            ) : undefined}
          />
        ) : (
          <EmptyState
            icon={SearchIcon}
            title="Nenhum registro encontrado"
            description="Nenhuma inspeção corresponde aos filtros atuais. Ajuste os filtros para ver outros resultados."
          />
        )
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
                      {(item.foto_antes_path || item.foto_antes) ? (
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground font-semibold mb-1">ANTES</p>
                          <InspecaoImage path={item.foto_antes_path} legacyUrl={item.foto_antes} alt="Antes" className="w-28 h-20 object-cover rounded-md border" thumbnail />
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground font-semibold mb-1">ANTES</p>
                          <div className="w-28 h-20 rounded-md border bg-muted/40 flex items-center justify-center">
                            <span className="text-[10px] text-muted-foreground">Sem foto</span>
                          </div>
                        </div>
                      )}
                      {(item.foto_depois_path || item.foto_depois) ? (
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground font-semibold mb-1">DEPOIS</p>
                          <InspecaoImage path={item.foto_depois_path} legacyUrl={item.foto_depois} alt="Depois" className="w-28 h-20 object-cover rounded-md border" thumbnail />
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
                        <span
                          className="inline-flex items-start gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-medium max-w-full whitespace-normal break-words leading-snug"
                          title={item.referencia_normativa}
                        >
                          <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span className="break-words whitespace-pre-line">{item.referencia_normativa}</span>
                        </span>
                      )}
                      {(() => {
                        const obra = obras.find(o => o.id === item.obra_id);
                        // "Removida" so quando a obra realmente sumiu; sem permissao
                        // de leitura a obra existe, e dizer o contrario e mentira.
                        const obraNome = obra?.nome || (item.obra_id ? (obrasSemAcesso ? "Obra sem permissão de leitura" : "Obra removida") : null);
                        const partes: string[] = [];
                        if (obraNome) partes.push(`Obra: ${obraNome}`);
                        if (!obraNome && item.local) partes.push(`📍 ${item.local}`);
                        return partes.length > 0 ? (
                          <span className="text-xs text-muted-foreground break-words">{partes.join(" • ")}</span>
                        ) : null;
                      })()}
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
                    <StatusBadge tone={item.status === "SOLUCIONADO" ? "success" : "pending"} size="sm">
                      {item.status === "SOLUCIONADO" ? "Solucionado" : "Pendente"}
                    </StatusBadge>
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
                    <StatusBadge tone={item.status === "SOLUCIONADO" ? "success" : "pending"} size="sm">
                      {item.status === "SOLUCIONADO" ? "Solucionado" : "Pendente"}
                    </StatusBadge>
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => openEdit(item)} aria-label="Editar inspeção">
                        <Pencil className="w-5 h-5" />
                      </Button>
                      {canDelete && (
                        <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => handleDelete(item.id)} aria-label="Excluir inspeção">
                          <Trash2 className="w-5 h-5 text-destructive" />
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
                  <div className="flex items-start gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-xs font-medium text-primary break-words whitespace-pre-line leading-snug" title={item.referencia_normativa}>
                      {item.referencia_normativa}
                    </span>
                  </div>
                )}

                {/* Gravidade + Local */}
                <div className="flex items-center gap-2 flex-wrap">
                  <GravidadeBadge gravidade={item.gravidade} />
                  {(() => {
                    const obra = obras.find(o => o.id === item.obra_id);
                    const obraNome = obra?.nome || (item.obra_id ? (obrasSemAcesso ? "Obra sem permissão de leitura" : "Obra removida") : null);
                    const partes: string[] = [];
                    if (obraNome) partes.push(`Obra: ${obraNome}`);
                    if (!obraNome && item.local) partes.push(`📍 ${item.local}`);
                    return partes.length > 0 ? (
                      <span className="text-xs text-muted-foreground break-words">{partes.join(" • ")}</span>
                    ) : null;
                  })()}
                </div>

                {/* Photos */}
                {(item.foto_antes_path || item.foto_antes || item.foto_depois_path || item.foto_depois) && (
                  <div className={`grid gap-2 ${(item.foto_antes_path || item.foto_antes) && (item.foto_depois_path || item.foto_depois) ? "grid-cols-2" : "grid-cols-1"}`}>
                    {(item.foto_antes_path || item.foto_antes) && (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1 font-semibold">ANTES</p>
                        <InspecaoImage path={item.foto_antes_path} legacyUrl={item.foto_antes} alt="Antes" className="w-full h-auto aspect-[4/3] object-contain" thumbnail />
                      </div>
                    )}
                    {(item.foto_depois_path || item.foto_depois) && (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-1 font-semibold">DEPOIS</p>
                        <InspecaoImage path={item.foto_depois_path} legacyUrl={item.foto_depois} alt="Depois" className="w-full h-auto aspect-[4/3] object-contain" thumbnail />
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
        {/*
          A janela acompanha o tamanho da tela.
          Celular: ocupa tudo. Tablet: quase tudo, com margem. Computador: até
          1100px — antes ficava presa em 672px mesmo num monitor largo, e o
          formulário virava uma coluna estreita com rolagem enorme, sobrando
          espaço vazio dos dois lados.
          As sobreposições de desktop precisam do prefixo da faixa (sm:/lg:):
          o DialogContent base traz sm:max-w-lg, e classe sem prefixo não
          substitui classe com prefixo.
        */}
        <DialogContent className={[
          "p-0 gap-0 flex flex-col overflow-hidden",
          "w-full h-[100dvh] rounded-none",
          "sm:h-auto sm:max-h-[92vh] sm:rounded-lg",
          "sm:w-[calc(100vw-3rem)] sm:max-w-2xl",
          "lg:max-w-4xl xl:max-w-[1100px]",
        ].join(" ")}>
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
                <div data-error={!!errors.obra_id}>
                  <Label className="font-semibold">Obra *</Label>
                  <ObraCombobox
                    obras={obras}
                    valor={form.obra_id}
                    invalido={!!errors.obra_id}
                    onSelecionar={id => { setForm(p => ({ ...p, obra_id: id })); setErrors(prev => ({ ...prev, obra_id: "" })); }}
                    onCriar={criarObraRapida}
                  />
                  {errors.obra_id && <p className="text-xs text-destructive mt-1">{errors.obra_id}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    Obra que falta? Digite o nome e crie sem sair daqui — cidade e UF você
                    completa depois em <strong>Cadastro de Local</strong>.
                  </p>
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
                  <div className="md:col-span-2">
                    <Label className="font-semibold">Referência Normativa</Label>
                    <Textarea
                      placeholder={"Ex: NR-18 — Item 18.6.10 — Quadros de distribuição devem possuir partes vivas inacessíveis...\nNR-18 — Item 18.6.12(c) — Dispositivos de manobra devem possuir condições para bloqueio e sinalização."}
                      value={form.referencia_normativa}
                      onChange={e => setForm(p => ({ ...p, referencia_normativa: e.target.value }))}
                      className="min-h-[96px] w-full resize-y text-sm"
                      rows={4}
                      title={form.referencia_normativa}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Formato: <strong>NR-XX — Item X.X.X — Descrição curta</strong>. Múltiplas referências: uma por linha (norma principal primeiro).
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="font-semibold">O que a norma exige</Label>
                    <Textarea
                      placeholder="Trecho resumido do requisito da norma citada acima."
                      value={form.trecho_norma}
                      onChange={e => setForm(p => ({ ...p, trecho_norma: e.target.value }))}
                      className="min-h-[72px] w-full resize-y text-sm"
                      rows={3}
                      title={form.trecho_norma}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Preenchido pela sugestão de IA. Confira antes de emitir — quem responde pelo laudo é o responsável técnico.
                    </p>
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
                  <input ref={antesAppRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0], "antes"); e.target.value = ""; }} />
                  <input ref={antesGalleryRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0], "antes"); e.target.value = ""; }} />
                  {(fotoAntesPreview || existingFotoAntes || existingFotoAntesPath) ? (
                    <div className="relative mt-1">
                      {fotoAntesPreview ? (
                        <img src={fotoAntesPreview} alt="Antes" className="w-full h-48 object-contain bg-muted/30 rounded-md" />
                      ) : (
                        <InspecaoImage path={existingFotoAntesPath} legacyUrl={existingFotoAntes} alt="Antes" className="w-full h-48 object-contain bg-muted/30 rounded-md" />
                      )}
                      <button
                        type="button"
                        aria-label="Remover foto antes"
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                        onClick={() => { setFotoAntesFile(null); setFotoAntesPreview(null); setExistingFotoAntes(null); setExistingFotoAntesPath(null); }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className={cn("flex flex-col gap-1.5 mt-1 p-2 rounded-md", errors.foto_antes && "border border-destructive")}>
                      <Button variant="outline" size="sm" className="w-full min-h-[44px]" onClick={() => setCameraChooserFor("antes")}>
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
                  <input ref={depoisAppRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0], "depois"); e.target.value = ""; }} />
                  <input ref={depoisGalleryRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0], "depois"); e.target.value = ""; }} />
                  {(fotoDepoisPreview || existingFotoDepois || existingFotoDepoisPath) ? (
                    <div className="relative mt-1">
                      {fotoDepoisPreview ? (
                        <img src={fotoDepoisPreview} alt="Depois" className="w-full h-48 object-contain bg-muted/30 rounded-md" />
                      ) : (
                        <InspecaoImage path={existingFotoDepoisPath} legacyUrl={existingFotoDepois} alt="Depois" className="w-full h-48 object-contain bg-muted/30 rounded-md" />
                      )}
                      <button
                        type="button"
                        aria-label="Remover foto depois"
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                        onClick={() => { setFotoDepoisFile(null); setFotoDepoisPreview(null); setExistingFotoDepois(null); setExistingFotoDepoisPath(null); }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5 mt-1">
                      <Button variant="outline" size="sm" className="w-full min-h-[44px]"
                        onClick={() => setCameraChooserFor("depois")}
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

            {/* Dialog: escolha de câmera */}
            <Dialog open={cameraChooserFor !== null} onOpenChange={(o) => { if (!o) setCameraChooserFor(null); }}>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Como deseja tirar a foto?</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-2 mt-2">
                  <Button
                    variant="default"
                    className="w-full min-h-[48px] justify-start"
                    onClick={() => {
                      const target = cameraChooserFor;
                      setCameraChooserFor(null);
                      setTimeout(() => (target === "antes" ? antesRef : depoisRef).current?.click(), 50);
                    }}
                  >
                    <Camera className="w-4 h-4 mr-2" /> Câmera do celular
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full min-h-[48px] justify-start"
                    onClick={() => {
                      const target = cameraChooserFor;
                      setCameraChooserFor(null);
                      setTimeout(() => (target === "antes" ? antesAppRef : depoisAppRef).current?.click(), 50);
                    }}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" /> Escolher aplicativo de câmera
                  </Button>
                  <p className="text-xs text-muted-foreground px-1">
                    Caso seu aplicativo de câmera (ex.: Conota) não apareça, tire a foto pelo aplicativo e depois envie pela Galeria.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="ghost" className="w-full" onClick={() => setCameraChooserFor(null)}>Cancelar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Seção: Ação Corretiva */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Ação Corretiva</p>
              <div className="space-y-3">
                <div data-error={!!errors.acao_corretiva}>
                  <Label className="font-semibold">O Que Fazer *</Label>
                  <Textarea placeholder="Descreva a ação corretiva necessária..." value={form.acao_corretiva} onChange={e => { setForm(p => ({ ...p, acao_corretiva: e.target.value })); setErrors(prev => ({ ...prev, acao_corretiva: "" })); }} rows={2} className={cn("resize-y min-h-[72px]", errors.acao_corretiva && "border-destructive")} />
                  {errors.acao_corretiva && <p className="text-xs text-destructive mt-1">{errors.acao_corretiva}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <Label className="font-semibold">Responsável</Label>
                    <Input placeholder="Nome ou setor (opcional)" value={form.responsavel} onChange={e => setForm(p => ({ ...p, responsavel: e.target.value }))} className="min-h-[44px]" />
                    <p className="text-xs text-muted-foreground mt-1">Campo opcional.</p>
                  </div>
                  <div>
                    <Label className="font-semibold">Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={v => setForm(p => {
                        const next = { ...p, status: v };
                        // Ao marcar como SOLUCIONADO, preencher automaticamente a data da correção (se estiver vazia)
                        if (v === "SOLUCIONADO" && !p.data_realizado) {
                          next.data_realizado = format(new Date(), "yyyy-MM-dd");
                        }
                        // Ao voltar para PENDENTE / EM ANDAMENTO, limpar data da correção
                        if (v !== "SOLUCIONADO") {
                          next.data_realizado = "";
                        }
                        return next;
                      })}
                    >
                      <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {form.status === "SOLUCIONADO" ? (
                  <div>
                    <Label className="font-semibold">Data da correção</Label>
                    <Input
                      type="date"
                      value={form.data_realizado}
                      onChange={e => setForm(p => ({ ...p, data_realizado: e.target.value }))}
                      className="min-h-[44px]"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Data em que a não conformidade foi corrigida. Preenchida automaticamente ao marcar como Solucionado — você pode ajustar se necessário.</p>
                  </div>
                ) : (
                  <div>
                    <Label className="font-semibold text-muted-foreground">Data da correção</Label>
                    <Input type="date" value="" disabled className="min-h-[44px] opacity-60" />
                    <p className="text-xs text-muted-foreground mt-1">Disponível apenas quando o status for <strong>Solucionado</strong>.</p>
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

      <ImportarFotosDialog
        open={importarFotosAberto}
        onOpenChange={setImportarFotosAberto}
        empresaId={empresaId}
        alvos={items.map((i) => ({
          id: i.id,
          numero: i.numero,
          temFoto: !!(i.foto_antes_path || i.foto_antes),
        }))}
        onConcluido={() => void loadData()}
      />
    </div>
  );
}

function GravidadeBadge({ gravidade }: { gravidade: string }) {
  const toneMap: Record<string, StatusTone> = {
    "LEVE": "neutral",
    "MODERADO": "warning",
    "GRAVE": "danger",
    "RISCO CRÍTICO": "critical",
  };
  return <StatusBadge tone={toneMap[gravidade] || "neutral"} size="sm">{gravidade}</StatusBadge>;
}
