import { useState, useCallback, useRef } from "react";
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

interface Funcionario {
  id: string;
  nome: string;
  cargo: string | null;
  cpf: string | null;
  matricula: string | null;
  setor: string | null;
}

interface UploadFile {
  file: File;
  id: string;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  errorMsg?: string;
}

interface Props {
  funcionarios: Funcionario[];
  cursos: string[];
  empresaId: string | null;
  onComplete: () => void;
}

const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function BulkDocumentUpload({ funcionarios, cursos, empresaId, onComplete }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);

  // Association form
  const [selectedFuncionarios, setSelectedFuncionarios] = useState<string[]>([]);
  const [selectedCurso, setSelectedCurso] = useState("");
  const [funcSearch, setFuncSearch] = useState("");
  const [cursoSearch, setCursoSearch] = useState("");

  const filteredFuncs = (() => {
    if (!funcSearch.trim()) return funcionarios.slice().sort((a, b) => a.nome.localeCompare(b.nome));
    const q = normalize(funcSearch);
    return funcionarios.filter(f =>
      normalize(f.nome).includes(q) ||
      (f.matricula && normalize(f.matricula).includes(q)) ||
      (f.cpf && f.cpf.replace(/\D/g, "").includes(q.replace(/\D/g, ""))) ||
      (f.cargo && normalize(f.cargo).includes(q)) ||
      (f.setor && normalize(f.setor).includes(q))
    ).sort((a, b) => {
      const aName = normalize(a.nome);
      const bName = normalize(b.nome);
      const aStarts = aName.startsWith(q) ? 0 : aName.includes(q) ? 1 : 2;
      const bStarts = bName.startsWith(q) ? 0 : bName.includes(q) ? 1 : 2;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.nome.localeCompare(b.nome);
    });
  })();

  const filteredCursos = (() => {
    if (!cursoSearch.trim()) return cursos;
    const q = normalize(cursoSearch);
    return cursos.filter(c => normalize(c).includes(q));
  })();

  const addFiles = useCallback((newFiles: File[]) => {
    const pdfs = newFiles.filter(f => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length < newFiles.length) {
      toast({ title: "Alguns arquivos ignorados", description: "Apenas arquivos PDF são aceitos.", variant: "destructive" });
    }
    if (pdfs.length === 0) return;

    const uploadFiles: UploadFile[] = pdfs.map(f => ({
      file: f,
      id: crypto.randomUUID(),
      status: "pending",
      progress: 0,
    }));
    setFiles(prev => [...prev, ...uploadFiles]);
  }, [toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, [addFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  }, [addFiles]);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const toggleFuncionario = (id: string) => {
    setSelectedFuncionarios(prev =>
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    const filteredIds = filteredFuncs.map(f => f.id);
    setSelectedFuncionarios(prev => {
      const existing = new Set(prev);
      filteredIds.forEach(id => existing.add(id));
      return Array.from(existing);
    });
  };

  const clearSelection = () => setSelectedFuncionarios([]);

  const handleUpload = async () => {
    if (files.length === 0) {
      toast({ title: "Nenhum arquivo", description: "Adicione PDFs para enviar.", variant: "destructive" });
      return;
    }
    if (selectedFuncionarios.length === 0) {
      toast({ title: "Nenhum funcionário", description: "Selecione pelo menos um funcionário.", variant: "destructive" });
      return;
    }

    setUploading(true);
    let completed = 0;
    const total = files.length;

    for (let i = 0; i < files.length; i++) {
      const uf = files[i];
      setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, status: "uploading", progress: 50 } : f));

      try {
        // Upload to storage for each selected employee
        for (const funcId of selectedFuncionarios) {
          const func = funcionarios.find(f => f.id === funcId);
          const safeName = func?.nome.replace(/[^a-zA-Z0-9]/g, "_") || funcId;
          const timestamp = Date.now();
          const path = `${empresaId}/${safeName}_${funcId}/${selectedCurso || "geral"}/${timestamp}_${uf.file.name}`;

          const { error: uploadError } = await supabase.storage
            .from("documentos-treinamento")
            .upload(path, uf.file, { upsert: false });

          if (uploadError) throw uploadError;
        }

        setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, status: "success", progress: 100 } : f));
      } catch (err: any) {
        setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, status: "error", progress: 0, errorMsg: err.message || "Erro no upload" } : f));
      }

      completed++;
      setOverallProgress(Math.round((completed / total) * 100));
    }

    setUploading(false);

    const successCount = files.filter(f => f.status === "success").length + files.filter(f => f.status === "pending").length;
    toast({
      title: "Upload concluído",
      description: `${completed} arquivo(s) processado(s) para ${selectedFuncionarios.length} funcionário(s).`,
    });

    onComplete();
  };

  const funcMap = funcionarios.reduce((acc, f) => { acc[f.id] = f; return acc; }, {} as Record<string, Funcionario>);

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-300
          ${isDragging
            ? "border-primary bg-primary/5 scale-[1.01] shadow-lg shadow-primary/10"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-3">
          <div className={`p-4 rounded-2xl transition-colors ${isDragging ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            <Upload className="w-8 h-8" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">
              {isDragging ? "Solte os arquivos aqui!" : "Arraste e solte os PDFs aqui"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              ou clique para selecionar • Apenas arquivos PDF
            </p>
          </div>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base font-semibold">
                {files.length} arquivo(s) selecionado(s)
              </Label>
              {!uploading && (
                <Button variant="ghost" size="sm" onClick={() => setFiles([])}>
                  <X className="w-4 h-4 mr-1" />Limpar
                </Button>
              )}
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {files.map(uf => (
                <div key={uf.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{uf.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(uf.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  {uf.status === "uploading" && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                  {uf.status === "success" && <CheckCircle className="w-4 h-4 text-success" />}
                  {uf.status === "error" && (
                    <span className="text-xs text-destructive" title={uf.errorMsg}>
                      <AlertCircle className="w-4 h-4" />
                    </span>
                  )}
                  {uf.status === "pending" && !uploading && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(uf.id)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {uploading && (
              <div className="mt-3">
                <Progress value={overallProgress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1 text-center">{overallProgress}% concluído</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Course Selection */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <Label className="text-base font-semibold">Vincular a qual curso/documento? (opcional)</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar curso..."
              value={cursoSearch}
              onChange={e => { setCursoSearch(e.target.value); setSelectedCurso(e.target.value); }}
              className="pl-9"
            />
          </div>
          {cursoSearch.trim() && filteredCursos.length > 0 && (
            <div className="border rounded-lg max-h-32 overflow-y-auto bg-background">
              {filteredCursos.map(c => (
                <button
                  key={c}
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
                  onClick={() => { setSelectedCurso(c); setCursoSearch(c); }}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          {selectedCurso && (
            <Badge variant="secondary" className="gap-1">
              {selectedCurso}
              <X className="h-3 w-3 cursor-pointer" onClick={() => { setSelectedCurso(""); setCursoSearch(""); }} />
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Employee Selection */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Funcionários *</Label>
            <div className="flex gap-2">
              {selectedFuncionarios.length > 0 && (
                <Badge variant="default" className="text-xs">
                  {selectedFuncionarios.length} selecionado(s)
                </Badge>
              )}
              <Button type="button" variant="outline" size="sm" onClick={selectAllFiltered}>
                Selecionar todos filtrados
              </Button>
              {selectedFuncionarios.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                  Limpar
                </Button>
              )}
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome, matrícula, CPF, função ou setor..."
              value={funcSearch}
              onChange={e => setFuncSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Selected employees tags */}
          {selectedFuncionarios.length > 0 && (
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
              {selectedFuncionarios.map(id => (
                <Badge key={id} variant="secondary" className="text-xs gap-1">
                  {funcMap[id]?.nome || id}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => toggleFuncionario(id)} />
                </Badge>
              ))}
            </div>
          )}

          <div className="border rounded-lg max-h-60 overflow-y-auto bg-background">
            {filteredFuncs.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">
                Nenhum colaborador encontrado com estes dados
              </p>
            ) : filteredFuncs.map(f => (
              <label
                key={f.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
              >
                <Checkbox
                  checked={selectedFuncionarios.includes(f.id)}
                  onCheckedChange={() => toggleFuncionario(f.id)}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{f.nome}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {f.cargo || ""} {f.matricula ? `• ${f.matricula}` : ""} {f.setor ? `• ${f.setor}` : ""}
                </span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upload Button */}
      <div className="flex justify-end">
        <Button
          size="lg"
          disabled={uploading || files.length === 0 || selectedFuncionarios.length === 0}
          onClick={handleUpload}
          className="shadow-lg shadow-primary/25"
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Enviar {files.length} arquivo(s) para {selectedFuncionarios.length} funcionário(s)
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
