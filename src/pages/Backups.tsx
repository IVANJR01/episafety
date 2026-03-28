import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Download, RefreshCw, HardDrive, Trash2, FileJson, FileSpreadsheet, Clock, CheckCircle2, AlertCircle, Loader2, CloudUpload, DatabaseZap, Cloud, ShieldCheck, ArrowRightLeft } from "lucide-react";
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
  const [cleaningStorage, setCleaningStorage] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [sanityTesting, setSanityTesting] = useState(false);
  const [sanityResult, setSanityResult] = useState<any>(null);

  const validateDriveConnection = async () => {
    setValidating(true);
    setValidationResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("migrate-to-drive", {
        headers: { "x-action": "validate" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setValidationResult(data);
      toast({ title: "✅ Conexão com Google Drive ativa!", description: `Pasta raiz: EPISafety` });
    } catch (err: any) {
      setValidationResult({ success: false, error: err.message });
      toast({ title: "Erro na validação", description: err.message, variant: "destructive" });
    } finally {
      setValidating(false);
    }
  };

  const runMigration = async () => {
    if (!confirm("Isso vai mover TODOS os arquivos do Storage interno para o Google Drive e deletar os originais. Deseja continuar?")) return;
    setMigrating(true);
    setMigrationResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("migrate-to-drive");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMigrationResult(data);
      toast({
        title: "✅ Migração concluída!",
        description: data.summary || `${data.totalMigrated} arquivos migrados`,
      });
    } catch (err: any) {
      setMigrationResult({ success: false, error: err.message });
      toast({ title: "Erro na migração", description: err.message, variant: "destructive" });
    } finally {
      setMigrating(false);
    }
  };

  const runSanityTest = async () => {
    setSanityTesting(true);
    setSanityResult(null);
    const log: string[] = [];
    try {
      log.push("⏳ Obtendo token de acesso ao Google Drive...");
      setSanityResult({ inProgress: true, log: [...log] });

      const access = await getDriveAccess("teste-homologacao");
      log.push(`✅ Token obtido. Empresa: ${access.empresaNome}`);
      log.push(`📁 Pasta criada/encontrada: EPISafety > ${access.empresaNome} > teste-homologacao`);
      setSanityResult({ inProgress: true, log: [...log] });

      // Create a small test PDF (minimal valid PDF)
      const testContent = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>>>endobj
4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000240 00000 n 
trailer<</Size 5/Root 1 0 R>>
startxref
315
%%EOF`;
      const testFileName = `teste_homologacao_${Date.now()}.pdf`;
      const testBlob = new Blob([testContent], { type: "application/pdf" });

      log.push(`⏳ Enviando arquivo de teste: ${testFileName} (${testBlob.size} bytes)...`);
      setSanityResult({ inProgress: true, log: [...log] });

      const metadata = { name: testFileName, parents: [access.folderId] };
      const formData = new FormData();
      formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      formData.append("file", testBlob);

      const uploadRes = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size",
        { method: "POST", headers: { Authorization: `Bearer ${access.accessToken}` }, body: formData }
      );
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        throw new Error(`Upload falhou (${uploadRes.status}): ${uploadData?.error?.message || JSON.stringify(uploadData)}`);
      }

      log.push(`✅ Upload concluído! File ID: ${uploadData.id}`);

      // Set public permission
      await fetch(`https://www.googleapis.com/drive/v3/files/${uploadData.id}/permissions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      });
      log.push("🔓 Permissão pública aplicada");

      const viewLink = uploadData.webViewLink || `https://drive.google.com/file/d/${uploadData.id}/view`;
      const previewLink = `https://drive.google.com/file/d/${uploadData.id}/preview`;

      log.push(`🔗 Link: ${viewLink}`);
      log.push("✅ TESTE PASSOU — Arquivo visível no Google Drive!");

      // Cleanup: delete test file after verification
      await fetch(`https://www.googleapis.com/drive/v3/files/${uploadData.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${access.accessToken}` },
      });
      log.push("🧹 Arquivo de teste removido do Drive (cleanup automático)");

      setSanityResult({
        success: true,
        log,
        fileId: uploadData.id,
        viewLink,
        previewLink,
        empresaNome: access.empresaNome,
      });

      toast({ title: "✅ Teste de homologação passou!", description: `Pasta EPISafety > ${access.empresaNome} validada com sucesso.` });
    } catch (err: any) {
      const errorCode = err.message.includes("401") ? "401 (Token expirado)" :
                        err.message.includes("403") ? "403 (Permissão negada)" :
                        err.message.includes("404") ? "404 (Pasta não encontrada)" : err.message;
      log.push(`❌ FALHA: ${errorCode}`);
      setSanityResult({ success: false, log, error: errorCode });
      toast({ title: "Teste falhou", description: errorCode, variant: "destructive" });
    } finally {
      setSanityTesting(false);
    }
  };

  const cleanupSupabaseStorage = async () => {
    setCleaningStorage(true);
    try {
      const { data, error } = await supabase.functions.invoke("cleanup-storage");
      if (error) throw error;
      toast({
        title: "✅ Storage limpo!",
        description: data?.message || "Todos os arquivos do storage foram removidos.",
      });
    } catch (err: any) {
      toast({ title: "Erro ao limpar storage", description: err.message, variant: "destructive" });
    } finally {
      setCleaningStorage(false);
    }
  };

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
      const access = await ensureDriveAccess();
      setProgress(10);

      // Step 1: Fetch all companies in user's tree
      setProgressLabel("Identificando empresas...");
      const { data: mainEmpresa } = await supabase
        .from("empresa_config")
        .select("id, nome")
        .eq("id", empresaId)
        .single();

      const { data: filiais } = await supabase
        .from("empresa_config")
        .select("id, nome")
        .eq("empresa_pai_id", empresaId);

      const allEmpresas = [
        ...(mainEmpresa ? [mainEmpresa] : []),
        ...(filiais || []),
      ];

      if (allEmpresas.length === 0) {
        throw new Error("Nenhuma empresa encontrada");
      }

      setProgress(15);

      // Step 2: Create timestamped root folder
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toISOString().slice(11, 19).replace(/:/g, "-");
      const backupFolderName = `backup_${dateStr}_${timeStr}`;
      const backupRootId = await findOrCreateFolder(access.accessToken, access.folderId, backupFolderName);
      setProgress(20);

      // Step 3: For each empresa, create folder and export data
      const totalSteps = allEmpresas.length * TABLES.length;
      let stepsDone = 0;
      const summaryLog: Record<string, { tables: number; records: number }> = {};

      for (const empresa of allEmpresas) {
        const empresaFolderName = empresa.nome || empresa.id;
        setProgressLabel(`Criando pasta: ${empresaFolderName}...`);
        const empresaFolderId = await findOrCreateFolder(access.accessToken, backupRootId, empresaFolderName);

        const backup: Record<string, unknown[]> = {};
        let totalRecords = 0;

        for (const table of TABLES) {
          setProgressLabel(`${empresaFolderName} → ${TABLE_LABELS[table] || table}...`);
          let query = (supabase.from as any)(table).select("*");
          if (table === "empresa_config") {
            query = query.eq("id", empresa.id);
          } else {
            query = query.eq("empresa_id", empresa.id);
          }
          const { data } = await query;
          backup[table] = data || [];
          totalRecords += (data || []).length;
          stepsDone++;
          setProgress(20 + Math.round((stepsDone / totalSteps) * 50));
        }

        // Upload individual table JSONs
        let uploaded = 0;
        for (const [table, rows] of Object.entries(backup)) {
          const fileName = `${TABLE_LABELS[table] || table}.json`;
          await uploadJsonToDrive(access.accessToken, empresaFolderId, fileName, JSON.stringify(rows, null, 2));
          uploaded++;
          setProgressLabel(`${empresaFolderName} → Enviando ${uploaded}/${Object.keys(backup).length}...`);
        }

        // Upload consolidated per company
        await uploadJsonToDrive(access.accessToken, empresaFolderId, "backup_completo.json", JSON.stringify({
          generated_at: now.toISOString(),
          empresa_id: empresa.id,
          empresa_nome: empresa.nome,
          tables: backup,
          table_labels: TABLE_LABELS,
        }, null, 2));

        summaryLog[empresaFolderName] = { tables: uploaded, records: totalRecords };
      }

      setProgress(90);

      // Step 4: Upload summary log at root level
      setProgressLabel("Finalizando...");
      await uploadJsonToDrive(access.accessToken, backupRootId, "log_backup.json", JSON.stringify({
        generated_at: now.toISOString(),
        empresas: summaryLog,
        total_empresas: allEmpresas.length,
      }, null, 2));

      setProgress(95);
      setProgressLabel("Limpando storage antigo...");

      try {
        await supabase.functions.invoke("cleanup-storage");
      } catch { /* non-critical */ }

      setProgress(100);
      toast({
        title: "✅ Backup enviado!",
        description: `${allEmpresas.length} empresa(s) exportadas em pastas separadas para "${backupFolderName}".`,
      });

      setDriveAccess(null);
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
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { setDriveAccess(null); loadBackups(); }} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={cleanupSupabaseStorage} disabled={cleaningStorage} className="text-destructive border-destructive/30 hover:bg-destructive/10">
            {cleaningStorage ? <Loader2 className="w-4 h-4 animate-spin" /> : <DatabaseZap className="w-4 h-4" />}
            Limpar Storage Supabase
          </Button>
          <Button onClick={generateAndSendBackup} disabled={generating} size="sm">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
            Gerar Backup → Google Drive
          </Button>
        </div>
      </div>

      {/* Migration & Validation Panel */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Cloud className="w-5 h-5 text-primary" />
            Migração para Google Drive
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Migre todos os arquivos do Storage interno para o Google Drive e libere espaço na plataforma.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={validateDriveConnection} disabled={validating}>
              {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Validar Armazenamento Externo
            </Button>
            <Button size="sm" onClick={runMigration} disabled={migrating} variant="default">
              {migrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
              {migrating ? "Migrando..." : "Migrar Arquivos → Google Drive"}
            </Button>
          </div>

          {validationResult && (
            <div className={`p-3 rounded-lg border text-sm ${validationResult.success ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-destructive/10 border-destructive/30"}`}>
              {validationResult.success ? (
                <div className="space-y-1">
                  <p className="font-medium flex items-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircle2 className="w-4 h-4" /> Conexão ativa com Google Drive
                  </p>
                  {validationResult.storageQuota && (
                    <p className="text-xs text-muted-foreground">
                      Espaço usado: {(parseInt(validationResult.storageQuota.usage || "0") / 1024 / 1024 / 1024).toFixed(2)} GB
                      {" / "}
                      {(parseInt(validationResult.storageQuota.limit || "0") / 1024 / 1024 / 1024).toFixed(0)} GB
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-destructive font-medium">❌ Erro: {validationResult.error}</p>
              )}
            </div>
          )}

          {migrationResult && (
            <div className={`p-4 rounded-lg border text-sm ${migrationResult.success ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-destructive/10 border-destructive/30"}`}>
              {migrationResult.success ? (
                <div className="space-y-2">
                  <p className="font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Migração Concluída!
                  </p>
                  <p className="text-foreground font-semibold">{migrationResult.summary}</p>
                  {migrationResult.errors?.length > 0 && (
                    <div className="text-xs text-destructive mt-2">
                      <p className="font-medium">Erros ({migrationResult.errors.length}):</p>
                      <ul className="list-disc ml-4 mt-1 space-y-0.5">
                        {migrationResult.errors.slice(0, 5).map((e: string, i: number) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {migrationResult.results?.length > 0 && (
                    <details className="text-xs mt-2">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Ver {migrationResult.results.length} arquivo(s) detalhados
                      </summary>
                      <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                        {migrationResult.results.map((r: any, i: number) => (
                          <div key={i} className="flex items-center gap-2">
                            <Badge variant={r.status === "migrated" ? "default" : "destructive"} className="text-[10px]">
                              {r.status === "migrated" ? "✓" : "✗"}
                            </Badge>
                            <span className="truncate">{r.bucket}/{r.file}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ) : (
                <p className="text-destructive font-medium">❌ Erro: {migrationResult.error}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
