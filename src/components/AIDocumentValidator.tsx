import { useState, useCallback, useRef } from "react";
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2, Search, Brain, ScanLine, Shield, ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
}

interface AnalyzedFile {
  file: File;
  id: string;
  status: "pending" | "analyzing" | "analyzed" | "error";
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

  const addFiles = useCallback((newFiles: File[]) => {
    const pdfs = newFiles.filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length === 0) {
      toast({ title: "Apenas PDFs", description: "Somente arquivos PDF são aceitos.", variant: "destructive" });
      return;
    }
    setFiles(prev => [...prev, ...pdfs.map(f => ({
      file: f,
      id: crypto.randomUUID(),
      status: "pending" as const,
      confirmed: false,
    }))]);
  }, [toast]);

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
    if (files.length === 0) return;
    setAnalyzing(true);
    setShowScanModal(true);
    let completed = 0;

    for (const af of files) {
      if (af.status === "analyzed") { completed++; continue; }
      setCurrentFile(af.file.name);
      setFiles(prev => prev.map(f => f.id === af.id ? { ...f, status: "analyzing" } : f));

      setCurrentStep(0);

      // Animate steps during actual API call
      const stepInterval = setInterval(() => {
        setCurrentStep(prev => prev < ANALYSIS_STEPS.length - 1 ? prev + 1 : prev);
      }, 2000);

      try {
        const formData = new FormData();
        formData.append("file", af.file);
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
        setFiles(prev => prev.map(f => f.id === af.id ? { ...f, status: "analyzed", analysis: result.analysis } : f));
      } catch (err: any) {
        clearInterval(stepInterval);
        setFiles(prev => prev.map(f => f.id === af.id ? { ...f, status: "error", errorMsg: err.message } : f));
      }

      completed++;
      setOverallProgress(Math.round((completed / files.length) * 100));
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
          const record: any = {
            funcionario_id: selectedFunc.id,
            nome_curso: af.analysis.curso,
            data_realizacao: af.analysis.data_realizacao || new Date().toISOString().split("T")[0],
            data_renovacao: af.analysis.data_validade || null,
            documento_pendente: af.analysis.descricao_completa || null,
            empresa_id: empresaId,
          };
          await (supabase.from as any)("controle_treinamentos").insert(record);

          // Upload file to storage
          const safeName = selectedFunc.nome.replace(/[^a-zA-Z0-9]/g, "_");
          const path = `${empresaId}/${safeName}_${selectedFunc.id}/${af.analysis.curso}/${Date.now()}_${af.file.name}`;
          await supabase.storage.from("documentos-treinamento").upload(path, af.file, { upsert: false });
          saved++;
        }
      } catch (err) {
        console.error("Save error:", err);
      }
    }

    toast({ title: "Documentos salvos!", description: `${saved} registro(s) criado(s) automaticamente.` });
    onComplete();
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

          {files.length > 0 && (
            <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
              {files.map(af => (
                <div key={af.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{af.file.name}</p>
                    <p className="text-xs text-muted-foreground">{(af.file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  {af.status === "analyzing" && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                  {af.status === "analyzed" && <CheckCircle className="w-4 h-4 text-green-600" />}
                  {af.status === "error" && <AlertCircle className="w-4 h-4 text-destructive" />}
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
      {files.length > 0 && (
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={analyzeFiles}
            disabled={analyzing || files.length === 0}
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
      {files.some(f => f.status === "analyzed") && (
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
            {files.filter(f => f.status === "analyzed" || f.status === "error").map(af => (
              <div key={af.id} className={`border rounded-xl p-4 space-y-3 transition-colors ${
                af.confirmed ? "border-green-500/50 bg-green-50/30 dark:bg-green-950/10" : "border-border"
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {af.status === "analyzed" && (
                      <Checkbox checked={af.confirmed} onCheckedChange={() => toggleConfirm(af.id)} />
                    )}
                    <div>
                      <p className="font-medium text-sm">{af.file.name}</p>
                      {af.analysis?.confianca && (
                        <p className={`text-xs ${getConfiancaColor(af.analysis.confianca)}`}>
                          Confiança: {Math.round(af.analysis.confianca * 100)}%
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
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
                        <ShieldCheck className="w-3.5 h-3.5" /> Matriz Neoenergia ✅
                      </Badge>
                    )}
                    {af.analysis?.conforme_matriz === false && (
                      <Badge variant="destructive" className="gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" /> Matriz ❌
                      </Badge>
                    )}
                  </div>
                </div>

                {af.status === "error" && (
                  <p className="text-sm text-destructive">{af.errorMsg}</p>
                )}

                {af.analysis && (
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
                      <Label className="text-xs text-muted-foreground">Descrição (gerada pela IA)</Label>
                      <p className="text-sm">{af.analysis.descricao_completa || "—"}</p>
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
    </div>
  );
}
