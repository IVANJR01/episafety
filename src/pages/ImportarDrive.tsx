import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, ExternalLink, Upload, Loader2, RefreshCw, Info, FileStack, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { listDriveFiles, downloadFileFromDrive } from "@/lib/googleDriveStorage";
import { garantirDocumento, publicarVersao } from "@/lib/arquivoDigital";

/** Pasta onde o usuário solta os arquivos pelo próprio Drive antes de importar. */
const PASTA_IMPORTACAO = "importar-arquivo-digital";

interface DriveFile { id: string; name: string; createdTime?: string; size?: string; webViewLink?: string; }
interface Funcionario { id: string; nome: string; }
interface TipoDocumento { id: string; nome: string; validade_meses: number | null; }
interface Selecao { colaboradorId?: string; tipoId?: string; dataEmissao: string }

function tamanhoLegivel(bytes?: string): string {
  const n = bytes ? parseInt(bytes, 10) : 0;
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const hoje = () => new Date().toISOString().slice(0, 10);

/**
 * Importação organizada do Drive — última frente do Arquivo Digital SST.
 *
 * O usuário solta os arquivos numa pasta dedicada do Drive (fora do app,
 * pelo Drive normal); aqui é só escolher pra quem e qual tipo de
 * documento é cada arquivo, arquivo por arquivo — diferente de um upload
 * em lote, porque uma pasta cheia de ASOs tem uma pessoa diferente em
 * cada arquivo.
 */
export default function ImportarDrive() {
  const { empresaId, user } = useAuth();
  const perms = usePermissions("arquivo_digital");

  const [arquivos, setArquivos] = useState<DriveFile[] | null>(null);
  const [indisponivel, setIndisponivel] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [tipos, setTipos] = useState<TipoDocumento[]>([]);
  const [jaImportados, setJaImportados] = useState<Set<string>>(new Set());
  const [selecoes, setSelecoes] = useState<Record<string, Selecao>>({});
  const [importando, setImportando] = useState<Set<string>>(new Set());
  const [popoverAberto, setPopoverAberto] = useState<string | null>(null);

  const carregarArquivos = async () => {
    setCarregando(true);
    setIndisponivel(null);
    try {
      const files = await listDriveFiles(PASTA_IMPORTACAO);
      setArquivos(files);
    } catch (e: any) {
      setIndisponivel(e?.message || "Não foi possível acessar o Drive.");
      setArquivos([]);
    }
    setCarregando(false);
  };

  useEffect(() => { if (perms.canView) void carregarArquivos(); }, [perms.canView]);

  useEffect(() => {
    if (!empresaId) return;
    supabase.from("funcionarios").select("id, nome").eq("empresa_id", empresaId).order("nome")
      .then(({ data }) => setFuncionarios((data as any) || []));
    (supabase.from as any)("internal_document_types")
      .select("id, nome, validade_meses").eq("ativo", true).order("nome")
      .then(({ data }: any) => setTipos(data || []));
  }, [empresaId]);

  // Um arquivo já importado antes (mesmo origem_id) fica marcado — sem
  // precisar mover nem apagar nada no Drive pra evitar duplicar.
  useEffect(() => {
    if (!arquivos || arquivos.length === 0) return;
    const ids = arquivos.map((f) => f.id);
    (supabase.from as any)("internal_document_versions")
      .select("origem_id").eq("origem_tabela", "google_drive").in("origem_id", ids)
      .then(({ data }: any) => setJaImportados(new Set((data || []).map((r: any) => r.origem_id))));
  }, [arquivos]);

  const atualizarSelecao = (fileId: string, patch: Partial<Selecao>) => {
    setSelecoes((prev) => ({ ...prev, [fileId]: { dataEmissao: hoje(), ...prev[fileId], ...patch } }));
  };

  const importar = async (file: DriveFile) => {
    const sel = selecoes[file.id];
    if (!sel?.colaboradorId || !sel?.tipoId) {
      toast({ title: "Selecione o colaborador e o tipo de documento", variant: "destructive" });
      return;
    }
    if (!empresaId) return;
    setImportando((prev) => new Set(prev).add(file.id));
    try {
      const tipo = tipos.find((t) => t.id === sel.tipoId);
      const blob = await downloadFileFromDrive(file.id, PASTA_IMPORTACAO);
      const arquivo = new File([blob], file.name, { type: blob.type || "application/pdf" });
      const documentoId = await garantirDocumento({
        empresaId, colaboradorId: sel.colaboradorId, tipoDocumentoId: sel.tipoId,
        origemTabela: "google_drive", origemId: file.id, userId: user?.id,
      });
      await publicarVersao({
        empresaId, documentoId, colaboradorId: sel.colaboradorId, file: arquivo,
        dataEmissao: sel.dataEmissao || hoje(), validadeMeses: tipo?.validade_meses,
        userId: user?.id, origemTabela: "google_drive", origemId: file.id,
      });
      toast({ title: "Importado", description: file.name });
      setJaImportados((prev) => new Set(prev).add(file.id));
    } catch (e: any) {
      toast({ title: "Erro ao importar", description: e?.message, variant: "destructive" });
    } finally {
      setImportando((prev) => { const next = new Set(prev); next.delete(file.id); return next; });
    }
  };

  if (!perms.canView) return null;

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground flex-1">
          Arquivos soltos em "EPISafety/(sua empresa)/{PASTA_IMPORTACAO}" no Drive, prontos pra entrar no Arquivo Digital.
        </p>
        <Button variant="outline" size="sm" onClick={carregarArquivos} disabled={carregando}>
          <RefreshCw className={cn("w-4 h-4 mr-2", carregando && "animate-spin")} />Atualizar
        </Button>
      </div>

      {indisponivel && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-800 flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            Não foi possível acessar o Drive: {indisponivel}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          {carregando && arquivos === null ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Carregando arquivos do Drive…
            </div>
          ) : arquivos && arquivos.length === 0 && !indisponivel ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileStack className="w-6 h-6 mx-auto mb-2 opacity-50" />
              Nenhum arquivo em "{PASTA_IMPORTACAO}" no Drive ainda. Suba os arquivos por lá e clique em Atualizar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Tipo de Documento</TableHead>
                    <TableHead className="w-[150px]">Emissão</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(arquivos || []).map((file) => {
                    const importado = jaImportados.has(file.id);
                    const sel = selecoes[file.id];
                    const colaboradorSel = funcionarios.find((f) => f.id === sel?.colaboradorId);
                    return (
                      <TableRow key={file.id} className={importado ? "opacity-50" : ""}>
                        <TableCell className="max-w-[220px]">
                          <div className="truncate font-medium text-sm">{file.name}</div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                            {tamanhoLegivel(file.size)}
                            {file.webViewLink && (
                              <a href={file.webViewLink} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-primary hover:underline">
                                Ver no Drive <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[200px]">
                          {importado ? <span className="text-xs text-muted-foreground">—</span> : (
                            <Popover open={popoverAberto === file.id} onOpenChange={(v) => setPopoverAberto(v ? file.id : null)}>
                              <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-9">
                                  <span className="truncate">{colaboradorSel?.nome || "Selecionar…"}</span>
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Buscar colaborador…" />
                                  <CommandList>
                                    <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                                    <CommandGroup>
                                      {funcionarios.map((f) => (
                                        <CommandItem key={f.id} value={f.nome}
                                          onSelect={() => { atualizarSelecao(file.id, { colaboradorId: f.id }); setPopoverAberto(null); }}>
                                          <Check className={cn("mr-2 h-4 w-4", f.id === sel?.colaboradorId ? "opacity-100" : "opacity-0")} />
                                          {f.nome}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          )}
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          {importado ? <span className="text-xs text-muted-foreground">—</span> : (
                            <Select value={sel?.tipoId} onValueChange={(v) => atualizarSelecao(file.id, { tipoId: v })}>
                              <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                              <SelectContent>
                                {tipos.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          {importado ? <span className="text-xs text-muted-foreground">—</span> : (
                            <Input type="date" className="h-9" value={sel?.dataEmissao || hoje()}
                              onChange={(e) => atualizarSelecao(file.id, { dataEmissao: e.target.value })} />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {importado ? (
                            <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-300 text-[11px]">
                              <CheckCircle2 className="w-3 h-3 mr-1" />Já importado
                            </Badge>
                          ) : (
                            <Button size="sm" disabled={importando.has(file.id)} onClick={() => importar(file)}>
                              {importando.has(file.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                              <span className="ml-1">Importar</span>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
