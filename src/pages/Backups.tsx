import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Download, RefreshCw, HardDrive, Trash2, FileJson, FileSpreadsheet, Clock, CheckCircle2, AlertCircle, Loader2, CloudUpload } from "lucide-react";
import * as XLSX from "xlsx";

interface BackupFile {
  name: string;
  created_at: string;
  metadata: { size: number } | null;
  id: string;
}

const TABLE_LABELS: Record<string, string> = {
  funcionarios: "Funcionários",
  epis: "EPIs",
  entregas: "Entregas",
  fichas_entrega: "Fichas de Entrega",
  dds: "DDS",
  dds_participantes: "DDS Participantes",
  inspecoes: "Inspeções",
  inspecao_itens: "Itens de Inspeção",
  inspecoes_subestacao: "Inspeções Subestação",
  treinamentos: "Treinamentos",
  treinamento_participantes: "Participantes Treinamento",
  controle_treinamentos: "Controle Treinamentos",
  cursos_documentos: "Cursos/Documentos",
  exames: "Exames",
  medicos: "Médicos",
  ordens_servico: "Ordens de Serviço",
  conformidades: "Conformidades",
  empresa_config: "Empresa",
};

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function Backups() {
  const { empresaId } = useAuth();
  const { toast } = useToast();
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sendingToDrive, setSendingToDrive] = useState(false);

  const loadBackups = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.storage.from("backups").list(empresaId, {
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error) throw error;
      setBackups(data || []);
    } catch {
      toast({ title: "Erro ao carregar backups", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [empresaId, toast]);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  const generateBackup = async () => {
    setGenerating(true);
    setProgress(10);
    try {
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 8, 90));
      }, 500);

      const { data, error } = await supabase.functions.invoke("generate-backup");

      clearInterval(progressInterval);

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setProgress(100);
      toast({ title: "Backup gerado com sucesso!", description: `${data.tables} módulos exportados.` });
      await loadBackups();
    } catch (err: any) {
      toast({ title: "Erro ao gerar backup", description: err.message, variant: "destructive" });
    } finally {
      setTimeout(() => {
        setGenerating(false);
        setProgress(0);
      }, 600);
    }
  };

  const sendToDrive = async () => {
    setSendingToDrive(true);
    try {
      const { data, error } = await supabase.functions.invoke("backup-to-drive");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Backup enviado ao Google Drive!",
        description: `${data.tables} módulos exportados para a pasta "${data.folder}".`,
      });
    } catch (err: any) {
      toast({ title: "Erro ao enviar para o Drive", description: err.message, variant: "destructive" });
    } finally {
      setSendingToDrive(false);
    }
  };

  const downloadAsJson = async (file: BackupFile) => {
    if (!empresaId) return;
    setDownloadingId(file.id);
    try {
      const { data, error } = await supabase.storage.from("backups").download(`${empresaId}/${file.name}`);
      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Erro ao baixar backup", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const downloadAsExcel = async (file: BackupFile) => {
    if (!empresaId) return;
    setDownloadingId(file.id + "_xlsx");
    try {
      const { data: blob, error } = await supabase.storage.from("backups").download(`${empresaId}/${file.name}`);
      if (error) throw error;

      const text = await blob.text();
      const backupData = JSON.parse(text);
      const wb = XLSX.utils.book_new();

      const tables = backupData.tables || {};
      const labels = backupData.table_labels || TABLE_LABELS;

      for (const [table, rows] of Object.entries(tables)) {
        if (!Array.isArray(rows) || rows.length === 0) continue;
        const ws = XLSX.utils.json_to_sheet(rows);
        const sheetName = (labels[table] || table).slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      XLSX.writeFile(wb, file.name.replace(".json", ".xlsx"));
    } catch {
      toast({ title: "Erro ao converter para Excel", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const deleteBackup = async (file: BackupFile) => {
    if (!empresaId) return;
    try {
      const { error } = await supabase.storage.from("backups").remove([`${empresaId}/${file.name}`]);
      if (error) throw error;
      toast({ title: "Backup excluído" });
      setBackups((prev) => prev.filter((b) => b.id !== file.id));
    } catch {
      toast({ title: "Erro ao excluir backup", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Backups</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os backups de todos os módulos do sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadBackups} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button onClick={generateBackup} disabled={generating} size="sm">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
            Gerar Backup Agora
          </Button>
        </div>
      </div>

      {generating && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm font-medium">Gerando backup de todos os módulos...</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Exportando: Funcionários, EPIs, Entregas, DDS, Inspeções, Treinamentos, Exames, Conformidades...
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Histórico de Backups
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <HardDrive className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">Nenhum backup encontrado</p>
              <p className="text-xs mt-1">Clique em "Gerar Backup Agora" para criar o primeiro.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((file, idx) => (
                <div
                  key={file.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{file.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{formatDate(file.created_at)}</span>
                        {file.metadata?.size && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {formatBytes(file.metadata.size)}
                          </Badge>
                        )}
                        {idx === 0 && (
                          <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0">
                            Mais recente
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none text-xs"
                      onClick={() => downloadAsJson(file)}
                      disabled={downloadingId === file.id}
                    >
                      {downloadingId === file.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileJson className="w-3.5 h-3.5" />}
                      JSON
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none text-xs"
                      onClick={() => downloadAsExcel(file)}
                      disabled={downloadingId === file.id + "_xlsx"}
                    >
                      {downloadingId === file.id + "_xlsx" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                      Excel
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteBackup(file)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Informações sobre o Backup</p>
              <ul className="list-disc ml-4 space-y-0.5 text-xs">
                <li>O backup diário automático é gerado e mantém os <strong>7 mais recentes</strong>.</li>
                <li>Todos os módulos são incluídos: Funcionários, EPIs, Entregas, DDS, Inspeções, Treinamentos, Exames, Conformidades e mais.</li>
                <li>Baixe em <strong>JSON</strong> (restauração técnica) ou <strong>Excel</strong> (consulta/planilha).</li>
                <li>Os dados são isolados por empresa e protegidos por autenticação.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
