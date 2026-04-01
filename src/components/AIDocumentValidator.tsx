import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2, Search, Brain, ScanLine, Shield, ShieldCheck, ShieldAlert, AlertTriangle, Trash2, CloudOff, RefreshCw, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface Funcionario {
  id: string;
  nome: string;
  cargo: string | null;
  cpf: string | null;
  matricula: string | null;
  setor: string | null;
}

interface AIAnalysis {
  nome_certificado?: string;
  cpf?: string;
  curso?: string;
  carga_horaria?: number;
  data_realizacao?: string;
  data_validade?: string;
  instituicao?: string;
  instrutor_nome?: string;
  instrutor_registro?: string;
  conteudo_programatico?: string;
  descricao_completa?: string;
  alerta_nome?: boolean;
  alerta_nome_msg?: string;
  nr_referencia?: string;
  conforme_nr?: boolean;
  motivo_nr?: string;
  conforme_matriz?: boolean;
  motivo_nao_conforme?: string;
  requisito_atendido?: string;
  confianca?: number;
  // Bernhoeft audit fields
  assinatura_colaborador?: boolean;
  assinatura_instrutor?: boolean;
  assinatura_responsavel?: boolean;
  parecer_bernhoeft?: "APROVADO" | "REPROVADO" | "COM_RESSALVA";
  motivo_reprovacao_bernhoeft?: string;
  dias_para_vencimento?: number;
}

interface AnalyzedFile {
  file?: File;
  id: string;
  dbId?: string;
  fileName: string;
  status: "pending" | "analyzing" | "analyzed" | "error" | "pending_credit";
  analysis?: AIAnalysis;
  errorMsg?: string;
  confirmed: boolean;
}

interface Props {
  funcionarios: Funcionario[];
  cursos: string[];
  empresaId: string | null;
  onComplete: () => void;
}

const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const ANALYSIS_STEPS = [
  "Enviando documento para análise...",
  "IA processando certificado...",
  "Validando conformidade NR e Matriz...",
];

export default function AIDocumentValidator({ funcionarios, cursos, empresaId, onComplete }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<AnalyzedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);
  const [funcSearch, setFuncSearch] = useState("");
  const [showScanModal, setShowScanModal] = useState(false);
  const [currentFile, setCurrentFile] = useState<string>("");
  const [loadingPrevious, setLoadingPrevious] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<any[] | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Persist selected employee across navigation/refresh
  const [selectedFunc, setSelectedFuncState] = useState<Funcionario | null>(() => {
    try {
      const saved = localStorage.getItem("ai_validator_selected_func");
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
    return null;
  });

  const setSelectedFunc = useCallback((func: Funcionario | null) => {
    setSelectedFuncState(func);
    if (func) {
      localStorage.setItem("ai_validator_selected_func", JSON.stringify(func));
    } else {
      localStorage.removeItem("ai_validator_selected_func");
    }
  }, []);

  // Show sync status indicator
  const showSyncSaved = useCallback(() => {
    setSyncStatus("saved");
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => setSyncStatus("idle"), 3000);
  }, []);

  // Load previous analysis results - show restore dialog if pending drafts exist
  useEffect(() => {
    if (!selectedFunc || !empresaId) {
      setFiles([]);
      return;
    }

    const loadPreviousAnalyses = async () => {
      setLoadingPrevious(true);
      try {
        const { data, error } = await supabase
          .from("analises_ia" as any)
          .select("*")
          .eq("empresa_id", empresaId)
          .eq("funcionario_id", selectedFunc.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Error loading previous analyses:", error);
          setLoadingPrevious(false);
          return;
        }

        if (data && (data as any[]).length > 0) {
          const rows = data as any[];
          const hasPending = rows.some((r: any) => r.status === "analisado" || r.status === "pendente" || r.status === "pending_credit");

          if (hasPending) {
            setPendingRestoreData(rows);
            setShowRestoreDialog(true);
          } else {
            loadFilesFromData(rows);
          }
        } else {
          setFiles([]);
        }
      } catch (err) {
        console.error("Error loading analyses:", err);
      }
      setLoadingPrevious(false);
    };

    loadPreviousAnalyses();
  }, [selectedFunc?.id, empresaId]);

  const loadFilesFromData = (rows: any[]) => {
    const previousFiles: AnalyzedFile[] = rows.map((row: any) => ({
      id: crypto.randomUUID(),
      dbId: row.id,
      fileName: row.arquivo_nome,
      status: row.status === "pending_credit" ? "pending_credit" as const : "analyzed" as const,
      analysis: row.status === "pending_credit" ? undefined : (row.ia_metadata as AIAnalysis),
      errorMsg: row.status === "pending_credit" ? "Créditos insuficientes. Aguardando reprocessamento." : undefined,
      confirmed: false,
    }));
    setFiles(previousFiles);
  };

  const handleRestore = () => {
    if (pendingRestoreData) {
      loadFilesFromData(pendingRestoreData);
      toast({ title: "Análise restaurada", description: "Os dados da análise anterior foram recuperados." });
    }
    setPendingRestoreData(null);
    setShowRestoreDialog(false);
  };

  const handleDiscardRestore = async () => {
    if (pendingRestoreData && empresaId && selectedFunc) {
      // Delete pending drafts from database
      for (const row of pendingRestoreData.filter((r: any) => r.status === "analisado" || r.status === "pendente")) {
        await (supabase.from as any)("analises_ia").delete().eq("id", row.id);
      }
    }
    setPendingRestoreData(null);
    setShowRestoreDialog(false);
    setFiles([]);
    toast({ title: "Rascunhos descartados", description: "Os rascunhos anteriores foram removidos." });
  };

  const filteredFuncs = (() => {
    if (!funcSearch.trim()) return funcionarios.slice().sort((a, b) => a.nome.localeCompare(b.nome));
    const q = normalize(funcSearch);
    return funcionarios.filter(f =>
      normalize(f.nome).includes(q) ||
      (f.matricula && normalize(f.matricula).includes(q)) ||
      (f.cpf && f.cpf.replace(/\D/g, "").includes(q.replace(/\D/g, "")))
    ).sort((a, b) => {
      const aName = normalize(a.nome);
      const bName = normalize(b.nome);
      const aStarts = aName.startsWith(q) ? 0 : 1;
      const bStarts = bName.startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.nome.localeCompare(b.nome);
    });
  })();

  // Duplicate detection: check if file was already analyzed for this employee
  const checkDuplicate = useCallback(async (fileName: string): Promise<boolean> => {
    if (!selectedFunc || !empresaId) return false;
    const { data } = await supabase
      .from("analises_ia" as any)
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("funcionario_id", selectedFunc.id)
      .eq("arquivo_nome", fileName)
      .limit(1);
    return (data as any[] | null)?.length ? true : false;
  }, [selectedFunc, empresaId]);

  const addFiles = useCallback(async (newFiles: File[]) => {
    const pdfs = newFiles.filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length === 0) {
      toast({ title: "Apenas PDFs", description: "Somente arquivos PDF são aceitos.", variant: "destructive" });
      return;
    }

    const filesToAdd: File[] = [];
    for (const pdf of pdfs) {
      // Check local duplicates
      const alreadyLocal = files.some(f => f.fileName === pdf.name);
      if (alreadyLocal) {
        toast({ title: "Arquivo duplicado", description: `"${pdf.name}" já está na lista.`, variant: "destructive" });
        continue;
      }
      // Check DB duplicates
      const alreadyInDb = await checkDuplicate(pdf.name);
      if (alreadyInDb) {
        toast({ title: "Documento já processado", description: `"${pdf.name}" já foi analisado para este colaborador.`, variant: "destructive" });
        continue;
      }
      filesToAdd.push(pdf);
    }

    if (filesToAdd.length > 0) {
      setFiles(prev => [...prev, ...filesToAdd.map(f => ({
        file: f,
        id: crypto.randomUUID(),
        fileName: f.name,
        status: "pending" as const,
        confirmed: false,
      }))]);
    }
  }, [toast, files, checkDuplicate]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) { addFiles(Array.from(e.target.files)); e.target.value = ""; }
  }, [addFiles]);

  const analyzeFiles = async () => {
    const pendingFiles = files.filter(f => f.status === "pending" && f.file);
    if (pendingFiles.length === 0) return;
    setAnalyzing(true);
    setShowScanModal(true);
    let completed = 0;

    for (const af of pendingFiles) {
      setCurrentFile(af.fileName);
      setFiles(prev => prev.map(f => f.id === af.id ? { ...f, status: "analyzing" } : f));
      setCurrentStep(0);
      setSyncStatus("saving");

      const stepInterval = setInterval(() => {
        setCurrentStep(prev => prev < ANALYSIS_STEPS.length - 1 ? prev + 1 : prev);
      }, 2000);

      try {
        const formData = new FormData();
        formData.append("file", af.file!);
        if (empresaId) formData.append("empresa_id", empresaId);
        if (selectedFunc) {
          formData.append("funcionario_id", selectedFunc.id);
          formData.append("funcionario_nome", selectedFunc.nome);
          formData.append("funcionario_cargo", selectedFunc.cargo || "");
          if (selectedFunc.cpf) formData.append("funcionario_cpf", selectedFunc.cpf);
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-certificate`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: formData,
          }
        );

        clearInterval(stepInterval);

        if (!response.ok) {
          const errData = await response.json().catch(() => ({ error: "Erro desconhecido" }));
          throw new Error(errData.error || `Erro ${response.status}`);
        }

        const result = await response.json();

        // Handle pending_credit queue status (credits exhausted but document saved)
        if (result.status === "pending_credit") {
          setFiles(prev => prev.map(f => f.id === af.id ? {
            ...f,
            status: "pending_credit" as const,
            dbId: result.analysisId || undefined,
            errorMsg: result.error || "Créditos insuficientes. Documento na fila.",
          } : f));
          toast({
            title: "⚠️ Créditos insuficientes",
            description: `"${af.fileName}" salvo na fila. Reprocesse quando houver créditos.`,
            variant: "destructive",
          });
          showSyncSaved();
          clearInterval(stepInterval);
          completed++;
          setOverallProgress(Math.round((completed / pendingFiles.length) * 100));
          continue;
        }

        setFiles(prev => prev.map(f => f.id === af.id ? {
          ...f,
          status: "analyzed",
          analysis: result.analysis,
          dbId: result.analysisId || undefined,
        } : f));
        showSyncSaved();
      } catch (err: any) {
        clearInterval(stepInterval);
        setSyncStatus("error");
        setFiles(prev => prev.map(f => f.id === af.id ? { ...f, status: "error", errorMsg: err.message } : f));
      }

      completed++;
      setOverallProgress(Math.round((completed / pendingFiles.length) * 100));
    }

    setAnalyzing(false);
    setShowScanModal(false);
    toast({ title: "Análise concluída", description: `${completed} documento(s) analisado(s) pela IA.` });
  };

  const confirmAndSave = async () => {
    const toSave = files.filter(f => f.status === "analyzed" && f.confirmed);
    if (toSave.length === 0) {
      toast({ title: "Selecione documentos", description: "Confirme pelo menos um documento para salvar.", variant: "destructive" });
      return;
    }

    let saved = 0;
    for (const af of toSave) {
      try {
        if (selectedFunc && af.analysis?.curso) {
          // Duplicate prevention: check CPF + date + course
          const cpf = af.analysis.cpf || selectedFunc.cpf;
          const dataRealizacao = af.analysis.data_realizacao || new Date().toISOString().split("T")[0];

          if (cpf && dataRealizacao) {
            const { data: existing } = await supabase
              .from("controle_treinamentos")
              .select("id")
              .eq("empresa_id", empresaId!)
              .eq("funcionario_id", selectedFunc.id)
              .eq("nome_curso", af.analysis.curso)
              .eq("data_realizacao", dataRealizacao)
              .limit(1);

            if (existing && existing.length > 0) {
              toast({
                title: "Documento duplicado",
                description: `"${af.analysis.curso}" com data ${dataRealizacao} já existe para este colaborador.`,
                variant: "destructive",
              });
              continue;
            }
          }

          const record: any = {
            funcionario_id: selectedFunc.id,
            nome_curso: af.analysis.curso,
            data_realizacao: dataRealizacao,
            data_renovacao: af.analysis.data_validade || null,
            documento_pendente: af.analysis.descricao_completa || null,
            empresa_id: empresaId,
          };
          await (supabase.from as any)("controle_treinamentos").insert(record);

          // Upload file to Google Drive organized by collaborator/course
          if (af.file) {
            const safeName = selectedFunc.nome.replace(/[^a-zA-Z0-9]/g, "_");
            const folderPath = `${safeName}/Certificados`;
            const { uploadToDrive } = await import("@/lib/googleDriveStorage");
            await uploadToDrive(af.file, folderPath, `${Date.now()}_${af.fileName}`);
          }

          // Update the analysis status in analises_ia to "confirmado"
          if (af.dbId) {
            await (supabase.from as any)("analises_ia").update({ status: "confirmado" }).eq("id", af.dbId);
          }

          saved++;
        }
      } catch (err) {
        console.error("Save error:", err);
      }
    }

    toast({ title: "Documentos salvos!", description: `${saved} registro(s) criado(s) automaticamente.` });
    onComplete();
  };

  const deleteAnalysis = async (id: string, dbId?: string) => {
    if (dbId) {
      await (supabase.from as any)("analises_ia").delete().eq("id", dbId);
    }
    setFiles(prev => prev.filter(f => f.id !== id));
    toast({ title: "Rascunho descartado", description: "A análise foi removida." });
  };

  const reanalyzeFile = async (id: string) => {
    const af = files.find(f => f.id === id);
    if (!af?.file || !selectedFunc) return;

    // Delete old draft from DB
    if (af.dbId) {
      await (supabase.from as any)("analises_ia").delete().eq("id", af.dbId);
    }

    // Reset to pending and re-analyze
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: "analyzing" as const, analysis: undefined, dbId: undefined, confirmed: false } : f));
    setSyncStatus("saving");
    setShowScanModal(true);
    setCurrentFile(af.fileName);
    setCurrentStep(0);

    const stepInterval = setInterval(() => {
      setCurrentStep(prev => prev < ANALYSIS_STEPS.length - 1 ? prev + 1 : prev);
    }, 2000);

    try {
      const formData = new FormData();
      formData.append("file", af.file);
      if (empresaId) formData.append("empresa_id", empresaId);
      formData.append("funcionario_id", selectedFunc.id);
      formData.append("funcionario_nome", selectedFunc.nome);
      formData.append("funcionario_cargo", selectedFunc.cargo || "");
      if (selectedFunc.cpf) formData.append("funcionario_cpf", selectedFunc.cpf);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-certificate`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: formData,
        }
      );

      clearInterval(stepInterval);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(errData.error || `Erro ${response.status}`);
      }

      const result = await response.json();
      setFiles(prev => prev.map(f => f.id === id ? {
        ...f, status: "analyzed" as const, analysis: result.analysis, dbId: result.analysisId || undefined,
      } : f));
      showSyncSaved();
      toast({ title: "Reanálise concluída", description: `"${af.fileName}" foi reanalisado com sucesso.` });
    } catch (err: any) {
      clearInterval(stepInterval);
      setSyncStatus("error");
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: "error" as const, errorMsg: err.message } : f));
    }

    setShowScanModal(false);
  };
  // Retry pending_credit documents - immediately re-analyze via Gemini
  const retryPendingCredit = async (id: string, dbId?: string) => {
    const af = files.find(f => f.id === id);
    if (!af || !selectedFunc) return;

    if (!af.file) {
      toast({
        title: "Arquivo não disponível",
        description: "O arquivo original não está mais disponível. Faça o upload novamente.",
        variant: "destructive",
      });
      return;
    }

    // Delete old pending_credit record
    if (dbId) {
      await (supabase.from as any)("analises_ia").delete().eq("id", dbId);
    }

    // Immediately re-analyze (same flow as reanalyzeFile)
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: "analyzing" as const, analysis: undefined, dbId: undefined, confirmed: false, errorMsg: undefined } : f));
    setSyncStatus("saving");
    setShowScanModal(true);
    setCurrentFile(af.fileName);
    setCurrentStep(0);

    const stepInterval = setInterval(() => {
      setCurrentStep(prev => prev < ANALYSIS_STEPS.length - 1 ? prev + 1 : prev);
    }, 2000);

    try {
      const formData = new FormData();
      formData.append("file", af.file);
      if (empresaId) formData.append("empresa_id", empresaId);
      formData.append("funcionario_id", selectedFunc.id);
      formData.append("funcionario_nome", selectedFunc.nome);
      formData.append("funcionario_cargo", selectedFunc.cargo || "");
      if (selectedFunc.cpf) formData.append("funcionario_cpf", selectedFunc.cpf);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-certificate`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: formData,
        }
      );

      clearInterval(stepInterval);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(errData.error || `Erro ${response.status}`);
      }

      const result = await response.json();

      if (result.status === "pending_credit") {
        setFiles(prev => prev.map(f => f.id === id ? {
          ...f,
          status: "pending_credit" as const,
          dbId: result.analysisId || undefined,
          errorMsg: result.error || "Créditos insuficientes. Documento na fila.",
        } : f));
        toast({ title: "⚠️ Ainda pendente", description: "Ambos provedores falharam. Tente novamente mais tarde.", variant: "destructive" });
      } else {
        setFiles(prev => prev.map(f => f.id === id ? {
          ...f, status: "analyzed" as const, analysis: result.analysis, dbId: result.analysisId || undefined,
        } : f));
        toast({ title: "✅ Validado via Gemini", description: `"${af.fileName}" foi reprocessado com sucesso.` });
      }
      showSyncSaved();
    } catch (err: any) {
      clearInterval(stepInterval);
      setSyncStatus("error");
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: "error" as const, errorMsg: err.message } : f));
      toast({ title: "Erro no reprocessamento", description: err.message, variant: "destructive" });
    }

    setShowScanModal(false);
  };

  const toggleConfirm = (id: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, confirmed: !f.confirmed } : f));
  };

  const confirmAll = () => {
    setFiles(prev => prev.map(f => f.status === "analyzed" ? { ...f, confirmed: true } : f));
  };

  const getConfiancaColor = (val?: number) => {
    if (!val) return "text-muted-foreground";
    if (val >= 0.8) return "text-green-600";
    if (val >= 0.5) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      {/* Sync Status Indicator */}
      {syncStatus !== "idle" && (
        <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg transition-all ${
          syncStatus === "saving" ? "bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400" :
          syncStatus === "saved" ? "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400" :
          "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400"
        }`}>
          {syncStatus === "saving" && <><Loader2 className="w-3 h-3 animate-spin" /> Salvando rascunho da IA...</>}
          {syncStatus === "saved" && <><Save className="w-3 h-3" /> ✓ Rascunho da IA salvo automaticamente</>}
          {syncStatus === "error" && <><CloudOff className="w-3 h-3" /> Erro ao salvar rascunho</>}
        </div>
      )}

      {/* Step 1: Select Employee */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Etapa 1 — Selecionar Colaborador
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome, matrícula ou CPF..."
              value={funcSearch}
              onChange={e => setFuncSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {selectedFunc && (
            <Badge variant="default" className="gap-1 text-sm py-1">
              {selectedFunc.nome} {selectedFunc.cargo ? `• ${selectedFunc.cargo}` : ""}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedFunc(null)} />
            </Badge>
          )}
          {!selectedFunc && funcSearch.trim() && (
            <div className="border rounded-lg max-h-40 overflow-y-auto bg-background">
              {filteredFuncs.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3 text-center">Nenhum colaborador encontrado</p>
              ) : filteredFuncs.slice(0, 20).map(f => (
                <button key={f.id} type="button" className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-b-0"
                  onClick={() => { setSelectedFunc(f); setFuncSearch(""); }}>
                  <span className="font-medium">{f.nome}</span>
                  <span className="text-muted-foreground ml-2">{f.cargo || ""} {f.setor ? `• ${f.setor}` : ""}</span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Upload Zone */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Etapa 2 — Upload dos Certificados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
              isDragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
            }`}
          >
            <input ref={fileInputRef} type="file" accept=".pdf" multiple onChange={handleFileSelect} className="hidden" />
            <div className="flex flex-col items-center gap-2">
              <div className={`p-3 rounded-2xl ${isDragging ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                <Upload className="w-7 h-7" />
              </div>
              <p className="font-semibold text-foreground">{isDragging ? "Solte aqui!" : "Arraste os certificados PDF"}</p>
              <p className="text-sm text-muted-foreground">ou clique para selecionar</p>
            </div>
          </div>

          {/* File list (pending + loading previous) */}
          {loadingPrevious && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando análises anteriores...
            </div>
          )}

          {files.filter(f => f.status === "pending" || f.status === "analyzing").length > 0 && (
            <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
              {files.filter(f => f.status === "pending" || f.status === "analyzing").map(af => (
                <div key={af.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{af.fileName}</p>
                    {af.file && <p className="text-xs text-muted-foreground">{(af.file.size / 1024 / 1024).toFixed(2)} MB</p>}
                  </div>
                  {af.status === "analyzing" && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                  {af.status === "pending" && !analyzing && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setFiles(prev => prev.filter(f => f.id !== af.id)); }}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 3: Analyze Button */}
      {files.some(f => f.status === "pending") && (
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={analyzeFiles}
            disabled={analyzing || !files.some(f => f.status === "pending")}
            className="gap-2 shadow-lg shadow-primary/25 bg-gradient-to-r from-primary to-primary/80"
          >
            {analyzing ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Analisando...</>
            ) : (
              <><Brain className="w-5 h-5" /> Analisar com IA ({files.filter(f => f.status === "pending").length} arquivo(s))</>
            )}
          </Button>
        </div>
      )}

      {/* Analysis Results */}
      {files.some(f => f.status === "analyzed" || f.status === "error" || f.status === "pending_credit") && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-primary" />
                Etapa 3 — Conferência dos Resultados
              </CardTitle>
              <Button variant="outline" size="sm" onClick={confirmAll}>Confirmar Todos</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {files.filter(f => f.status === "analyzed" || f.status === "error" || f.status === "pending_credit").map(af => (
              <div key={af.id} className={`border rounded-xl p-4 space-y-3 transition-colors ${
                af.confirmed ? "border-green-500/50 bg-green-50/30 dark:bg-green-950/10" : "border-border"
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {af.status === "analyzed" && (
                      <Checkbox checked={af.confirmed} onCheckedChange={() => toggleConfirm(af.id)} />
                    )}
                    <div>
                      <p className="font-medium text-sm">{af.fileName}</p>
                      {af.analysis?.confianca && (
                        <p className={`text-xs ${getConfiancaColor(af.analysis.confianca)}`}>
                          Confiança: {Math.round(af.analysis.confianca * 100)}%
                        </p>
                      )}
                      {af.dbId && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Save className="w-3 h-3" /> Rascunho salvo no sistema
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* NR Badge */}
                    {af.analysis?.conforme_nr === true && (
                      <Badge className="gap-1 bg-green-600 hover:bg-green-700">
                        <ShieldCheck className="w-3.5 h-3.5" /> {af.analysis.nr_referencia || "NR"} ✅
                      </Badge>
                    )}
                    {af.analysis?.conforme_nr === false && (
                      <Badge variant="destructive" className="gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" /> {af.analysis.nr_referencia || "NR"} ❌
                      </Badge>
                    )}
                    {/* Matriz Badge */}
                    {af.analysis?.conforme_matriz === true && (
                      <Badge className="gap-1 bg-blue-600 hover:bg-blue-700">
                        <ShieldCheck className="w-3.5 h-3.5" /> Matriz ✅
                      </Badge>
                    )}
                    {af.analysis?.conforme_matriz === false && (
                      <Badge variant="destructive" className="gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" /> Matriz ❌
                      </Badge>
                    )}
                    {/* Re-analyze button */}
                    {af.status === "analyzed" && af.file && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
                        title="Forçar Reanálise"
                        onClick={() => reanalyzeFile(af.id)}>
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {/* Delete/Discard button */}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      title="Descartar análise"
                      onClick={() => deleteAnalysis(af.id, af.dbId)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {af.status === "error" && (
                  <p className="text-sm text-destructive">{af.errorMsg}</p>
                )}

                {af.status === "pending_credit" && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Pendente — Requer Re-upload</p>
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        {af.file 
                          ? "Arquivo disponível. Clique em Reprocessar via Gemini para analisar agora." 
                          : "Faça o upload deste PDF novamente para reprocessar via Gemini (sem custo de créditos)."}
                      </p>
                    </div>
                    {af.file ? (
                      <Button variant="outline" size="sm" className="shrink-0 gap-1 border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30"
                        onClick={() => retryPendingCredit(af.id, af.dbId)}>
                        <RefreshCw className="w-3.5 h-3.5" /> Reprocessar via Gemini
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="shrink-0 gap-1"
                        onClick={() => {
                          deleteAnalysis(af.id, af.dbId);
                          toast({ title: "Registro removido", description: `Faça o upload de "${af.fileName}" novamente na área acima.` });
                        }}>
                        <Trash2 className="w-3.5 h-3.5" /> Remover e Re-enviar
                      </Button>
                    )}
                  </div>
                )}

                {af.analysis && (
                  <div className="space-y-3">
                    {/* Bernhoeft Audit Badge */}
                    {af.analysis.parecer_bernhoeft && (
                      <div className={`p-3 rounded-lg border-2 ${
                        af.analysis.parecer_bernhoeft === "APROVADO" 
                          ? "border-green-500 bg-green-50 dark:bg-green-950/20" 
                          : af.analysis.parecer_bernhoeft === "COM_RESSALVA"
                          ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
                          : "border-destructive bg-red-50 dark:bg-red-950/20"
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Parecer Bernhoeft</span>
                          <Badge className={`text-xs ${
                            af.analysis.parecer_bernhoeft === "APROVADO" ? "bg-green-600 hover:bg-green-700" :
                            af.analysis.parecer_bernhoeft === "COM_RESSALVA" ? "bg-yellow-600 hover:bg-yellow-700" :
                            "bg-destructive hover:bg-destructive/90"
                          }`}>
                            {af.analysis.parecer_bernhoeft === "APROVADO" ? "✅ APROVADO PARA CAMPO" :
                             af.analysis.parecer_bernhoeft === "COM_RESSALVA" ? "⚠️ COM RESSALVA" :
                             "❌ REPROVADO / BLOQUEADO"}
                          </Badge>
                        </div>
                        {af.analysis.motivo_reprovacao_bernhoeft && (
                          <p className="text-sm text-destructive font-medium">{af.analysis.motivo_reprovacao_bernhoeft}</p>
                        )}
                        {af.analysis.dias_para_vencimento != null && (
                          <p className={`text-xs mt-1 font-medium ${
                            af.analysis.dias_para_vencimento < 0 ? "text-destructive" :
                            af.analysis.dias_para_vencimento <= 30 ? "text-yellow-600 dark:text-yellow-400" :
                            "text-green-600 dark:text-green-400"
                          }`}>
                            {af.analysis.dias_para_vencimento < 0 
                              ? `⛔ VENCIDO há ${Math.abs(af.analysis.dias_para_vencimento)} dias`
                              : af.analysis.dias_para_vencimento <= 30
                              ? `⚠️ Vence em ${af.analysis.dias_para_vencimento} dias — RISCO DE BLOQUEIO`
                              : `✅ ${af.analysis.dias_para_vencimento} dias até o vencimento`}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Signature Checklist */}
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Verificação de Assinaturas</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex items-center gap-1.5 text-xs">
                          {af.analysis.assinatura_colaborador 
                            ? <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                            : <AlertCircle className="w-4 h-4 text-destructive shrink-0" />}
                          <span>Colaborador</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          {af.analysis.assinatura_instrutor 
                            ? <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                            : <AlertCircle className="w-4 h-4 text-destructive shrink-0" />}
                          <span>Instrutor</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          {af.analysis.assinatura_responsavel 
                            ? <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                            : <AlertCircle className="w-4 h-4 text-destructive shrink-0" />}
                          <span>CREA/Carimbo</span>
                        </div>
                      </div>
                    </div>

                    {/* Data Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className={`p-2 rounded-lg ${af.analysis.alerta_nome ? "bg-red-50 dark:bg-red-950/20 border border-red-200" : "bg-muted/50"}`}>
                      <Label className="text-xs text-muted-foreground">Nome no Certificado</Label>
                      <p className="font-medium">{af.analysis.nome_certificado || "—"}</p>
                      {af.analysis.alerta_nome && (
                        <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                          <AlertTriangle className="w-3 h-3" /> {af.analysis.alerta_nome_msg}
                        </p>
                      )}
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <Label className="text-xs text-muted-foreground">Curso Identificado</Label>
                      <p className="font-medium">{af.analysis.curso || "—"}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <Label className="text-xs text-muted-foreground">Carga Horária</Label>
                      <p className="font-medium">{af.analysis.carga_horaria ? `${af.analysis.carga_horaria}h` : "—"}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <Label className="text-xs text-muted-foreground">Instituição</Label>
                      <p className="font-medium">{af.analysis.instituicao || "—"}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <Label className="text-xs text-muted-foreground">NR de Referência</Label>
                      <p className="font-medium">{af.analysis.nr_referencia || "—"}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <Label className="text-xs text-muted-foreground">Instrutor</Label>
                      <p className="font-medium">{af.analysis.instrutor_nome || "—"}</p>
                      {af.analysis.instrutor_registro && (
                        <p className="text-xs text-muted-foreground">{af.analysis.instrutor_registro}</p>
                      )}
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <Label className="text-xs text-muted-foreground">Realização</Label>
                      <p className="font-medium">{af.analysis.data_realizacao || "—"}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                      <Label className="text-xs text-muted-foreground">Validade</Label>
                      <p className="font-medium">{af.analysis.data_validade || "—"}</p>
                    </div>
                    {af.analysis.motivo_nr && (
                      <div className={`col-span-full p-2 rounded-lg border ${af.analysis.conforme_nr === false ? "bg-red-50 dark:bg-red-950/20 border-red-200" : "bg-green-50 dark:bg-green-950/20 border-green-200"}`}>
                        <Label className={`text-xs ${af.analysis.conforme_nr === false ? "text-destructive" : "text-green-700 dark:text-green-400"}`}>
                          Validação NR {af.analysis.nr_referencia || ""}
                        </Label>
                        <p className="text-sm">{af.analysis.motivo_nr}</p>
                      </div>
                    )}
                    {af.analysis.motivo_nao_conforme && (
                      <div className="col-span-full p-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200">
                        <Label className="text-xs text-destructive">Motivo Não Conforme (Matriz Neoenergia)</Label>
                        <p className="text-sm">{af.analysis.motivo_nao_conforme}</p>
                      </div>
                    )}
                    <div className="col-span-full p-2 rounded-lg bg-muted/50">
                      <Label className="text-xs text-muted-foreground">Parecer de Auditoria (IA)</Label>
                      <p className="text-sm whitespace-pre-line">{af.analysis.descricao_completa || "—"}</p>
                    </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="flex justify-end pt-2">
              <Button
                size="lg"
                onClick={confirmAndSave}
                disabled={!files.some(f => f.confirmed) || !selectedFunc}
                className="gap-2 shadow-lg"
              >
                <CheckCircle className="w-4 h-4" />
                Confirmar e Salvar ({files.filter(f => f.confirmed).length})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scanner Modal */}
      <Dialog open={showScanModal} onOpenChange={() => {}}>
        <DialogContent className="max-w-md" onPointerDownOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary animate-pulse" />
              Analisando Documentos com IA
            </DialogTitle>
            <DialogDescription>
              Aguarde enquanto o documento é processado e validado automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="relative overflow-hidden rounded-xl bg-muted/50 p-6">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent animate-pulse" />
              <div className="relative z-10 text-center space-y-3">
                <ScanLine className="w-12 h-12 mx-auto text-primary animate-bounce" />
                <p className="text-sm font-medium truncate">{currentFile}</p>
                <p className="text-xs text-muted-foreground animate-pulse">{ANALYSIS_STEPS[currentStep]}</p>
              </div>
            </div>
            <Progress value={overallProgress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground">{overallProgress}% concluído</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore Draft Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              Análise Pendente Encontrada
            </DialogTitle>
            <DialogDescription>
              Encontramos {pendingRestoreData?.length || 0} análise(s) pendente(s) para este colaborador. Deseja restaurar os dados?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleDiscardRestore} className="gap-1">
              <Trash2 className="w-4 h-4" /> Descartar
            </Button>
            <Button onClick={handleRestore} className="gap-1">
              <RefreshCw className="w-4 h-4" /> Restaurar Dados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
