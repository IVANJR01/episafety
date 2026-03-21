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

const TABLES = [
  "funcionarios", "epis", "entregas", "fichas_entrega",
  "dds", "dds_participantes", "inspecoes", "inspecao_itens",
  "inspecoes_subestacao", "treinamentos", "treinamento_participantes",
  "controle_treinamentos", "cursos_documentos", "exames", "medicos",
  "ordens_servico", "conformidades", "empresa_config",
];

const TABLE_LABELS: Record<string, string> = {
  funcionarios: "Funcionários", epis: "EPIs", entregas: "Entregas",
  fichas_entrega: "Fichas de Entrega", dds: "DDS",
  dds_participantes: "DDS Participantes", inspecoes: "Inspeções",
  inspecao_itens: "Itens de Inspeção", inspecoes_subestacao: "Inspeções Subestação",
  treinamentos: "Treinamentos", treinamento_participantes: "Participantes Treinamento",
  controle_treinamentos: "Controle Treinamentos", cursos_documentos: "Cursos/Documentos",
  exames: "Exames", medicos: "Médicos", ordens_servico: "Ordens de Serviço",
  conformidades: "Conformidades", empresa_config: "Empresa",
};

interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
  webViewLink?: string;
}

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

/** Get Drive token + folder ID from lightweight edge function */
async function getDriveAccess(folder: string) {
  const { data, error } = await supabase.functions.invoke("gdrive-token", {
    body: { folder },
  });
  if (error) throw new Error(error.message || "Failed to get Drive token");
  if (data?.error) throw new Error(data.error);
  return data as { accessToken: string; folderId: string; empresaNome: string };
}

/** Find or create a subfolder directly from the browser */
async function findOrCreateFolder(token: string, parentId: string, name: string): Promise<string> {
  const q = encodeURIComponent(
    `'${parentId}' in parents and name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (data?.files?.length) return data.files[0].id;

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  const created = await createRes.json();
  if (!createRes.ok || !created?.id) throw new Error("Failed to create folder");
  return created.id;
}

/** Upload a JSON string directly to Google Drive from the browser */
async function uploadJsonToDrive(token: string, folderId: string, fileName: string, jsonContent: string) {
  const metadata = { name: fileName, parents: [folderId] };
  const formData = new FormData();
  formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  formData.append("file", new Blob([jsonContent], { type: "application/json" }));

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime,size,webViewLink",
    { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Upload failed: ${data?.error?.message || JSON.stringify(data)}`);
  return data;
}

/** List files in a Drive folder directly from the browser */
async function listDriveFolder(token: string, folderId: string): Promise<DriveBackupFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,createdTime,size,webViewLink)&orderBy=createdTime desc&pageSize=20`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new Error("Failed to list Drive files");
  return data.files || [];
}

/** Download a file from Drive directly in browser */
async function downloadDriveFile(token: string, fileId: string): Promise<Blob> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error("Failed to download file from Drive");
  return res.blob();
}

/** Delete a file from Drive directly */
async function deleteDriveFile(token: string, fileId: string) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok && res.status !== 404) throw new Error("Failed to delete file from Drive");
}

export default function Backups() {
  const { empresaId } = useAuth();
  const { toast } = useToast();
  const [backups, setBackups] = useState<DriveBackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [driveAccess, setDriveAccess] = useState<{ accessToken: string; folderId: string } | null>(null);

  const ensureDriveAccess = useCallback(async () => {
    if (driveAccess) return driveAccess;
    const access = await getDriveAccess("backups");
    setDriveAccess(access);
    return access;
  }, [driveAccess]);

  const loadBackups = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const access = await ensureDriveAccess();
      const files = await listDriveFolder(access.accessToken, access.folderId);
      setBackups(files);
    } catch {
      toast({ title: "Erro ao carregar backups", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [empresaId, toast, ensureDriveAccess]);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  const generateAndSendBackup = async () => {
    if (!empresaId) return;
    setGenerating(true);
    setProgress(5);
    setProgressLabel("Conectando ao Google Drive...");
    try {
      // Step 1: Get Drive access (tiny edge function call ~1KB)
      const access = await ensureDriveAccess();
      setProgress(10);

      // Step 2: Create a timestamped subfolder directly from browser
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toISOString().slice(11, 19).replace(/:/g, "-");
      const backupFolderName = `backup_${dateStr}_${timeStr}`;
      const backupFolderId = await findOrCreateFolder(access.accessToken, access.folderId, backupFolderName);
      setProgress(15);

      // Step 3: Fetch data from Supabase SDK (uses DB server, NOT network)
      const backup: Record<string, unknown[]> = {};
      let tablesDone = 0;

      for (const table of TABLES) {
        setProgressLabel(`Exportando ${TABLE_LABELS[table] || table}...`);
        let query = (supabase.from as any)(table).select("*");
        if (table === "empresa_config") {
          query = query.eq("id", empresaId);
        } else {
          query = query.eq("empresa_id", empresaId);
        }
        const { data } = await query;
        backup[table] = data || [];
        tablesDone++;
        setProgress(15 + Math.round((tablesDone / TABLES.length) * 40));
      }

      // Step 4: Upload individual table JSONs directly to Drive (browser → Drive)
      setProgressLabel("Enviando tabelas ao Google Drive...");
      let uploaded = 0;
      for (const [table, rows] of Object.entries(backup)) {
        const fileName = `${TABLE_LABELS[table] || table}.json`;
        await uploadJsonToDrive(access.accessToken, backupFolderId, fileName, JSON.stringify(rows, null, 2));
        uploaded++;
        setProgress(55 + Math.round((uploaded / Object.keys(backup).length) * 30));
        setProgressLabel(`Enviando ${uploaded}/${Object.keys(backup).length} tabelas...`);
      }

      // Step 5: Upload consolidated backup
      setProgressLabel("Finalizando backup completo...");
      await uploadJsonToDrive(access.accessToken, backupFolderId, "backup_completo.json", JSON.stringify({
        generated_at: now.toISOString(),
        empresa_id: empresaId,
        tables: backup,
        table_labels: TABLE_LABELS,
      }, null, 2));

      setProgress(95);

      // Step 6: Upload log
      await uploadJsonToDrive(access.accessToken, backupFolderId, "log_backup.json", JSON.stringify({
        generated_at: now.toISOString(),
        empresa_id: empresaId,
        total_tables: TABLES.length,
        uploaded_tables: uploaded,
      }, null, 2));

      setProgress(100);
      toast({
        title: "✅ Backup enviado ao Google Drive!",
        description: `${uploaded} módulos exportados para "${backupFolderName}". Nenhum dado passou pelo servidor.`,
      });

      // Refresh list
      setDriveAccess(null); // Force re-fetch to refresh token
      await loadBackups();
    } catch (err: any) {
      toast({ title: "Erro ao gerar backup", description: err.message, variant: "destructive" });
    } finally {
      setTimeout(() => {
        setGenerating(false);
        setProgress(0);
        setProgressLabel("");
      }, 600);
    }
  };

  const downloadAsJson = async (file: DriveBackupFile) => {
    setDownloadingId(file.id);
    try {
      const access = await ensureDriveAccess();
      const blob = await downloadDriveFile(access.accessToken, file.id);
      const url = URL.createObjectURL(blob);
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

  const downloadAsExcel = async (file: DriveBackupFile) => {
    setDownloadingId(file.id + "_xlsx");
    try {
      const access = await ensureDriveAccess();
      const blob = await downloadDriveFile(access.accessToken, file.id);
      const text = await blob.text();
      const backupData = JSON.parse(text);
      const wb = XLSX.utils.book_new();

      const tables = backupData.tables || backupData;
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

  const deleteBackup = async (file: DriveBackupFile) => {
    try {
      const access = await ensureDriveAccess();
      await deleteDriveFile(access.accessToken, file.id);
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
            Backups salvos diretamente no Google Drive — sem uso de rede do servidor
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setDriveAccess(null); loadBackups(); }} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button onClick={generateAndSendBackup} disabled={generating} size="sm">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
            Gerar Backup → Google Drive
          </Button>
        </div>
      </div>

      {generating && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm font-medium">{progressLabel || "Gerando backup..."}</span>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Os dados vão direto do navegador para o Google Drive. Zero uso de rede do servidor.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Backups no Google Drive
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
              <p className="text-xs mt-1">Clique em "Gerar Backup → Google Drive" para criar o primeiro.</p>
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
                        <span className="text-xs text-muted-foreground">{formatDate(file.createdTime)}</span>
                        {file.size && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {formatBytes(parseInt(file.size))}
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
                    {file.name.endsWith(".json") && (
                      <>
                        <Button
                          variant="outline" size="sm" className="flex-1 sm:flex-none text-xs"
                          onClick={() => downloadAsJson(file)}
                          disabled={downloadingId === file.id}
                        >
                          {downloadingId === file.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileJson className="w-3.5 h-3.5" />}
                          JSON
                        </Button>
                        {file.name === "backup_completo.json" && (
                          <Button
                            variant="outline" size="sm" className="flex-1 sm:flex-none text-xs"
                            onClick={() => downloadAsExcel(file)}
                            disabled={downloadingId === file.id + "_xlsx"}
                          >
                            {downloadingId === file.id + "_xlsx" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                            Excel
                          </Button>
                        )}
                      </>
                    )}
                    <Button
                      variant="ghost" size="sm"
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
                <li>Os backups são enviados <strong>direto do navegador para o Google Drive</strong> — zero uso de rede do servidor.</li>
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
