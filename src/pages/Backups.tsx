/*
 * Backups — só para super admin.
 *
 * A tela antiga dependia do Google Drive (funções que ficaram no projeto
 * anterior, então nada funcionava) e tinha um botão "Limpar Storage
 * Supabase" que apagava os arquivos do sistema; o próprio "Gerar backup"
 * chamava essa limpeza no fim, sem ter copiado os arquivos antes.
 *
 * Agora: o backup roda sozinho todo dia às 03:00 (função backup-diario,
 * ver supabase/migrations/20261124120000_backup_diario.sql). Esta tela
 * mostra se ele está em dia, deixa rodar na hora e baixar qualquer dia
 * guardado como .zip — montado aqui no navegador, porque no servidor
 * gratuito não há processador para compactar.
 */
import { useCallback, useEffect, useState } from "react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, Cloud, Download, Loader2, PlayCircle, RefreshCw, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { situacaoDoBackup, type Execucao } from "@/lib/situacaoDoBackup";

interface ExecucaoCompleta extends Execucao {
  id: string;
  tabelas: number | null;
  linhas: number | null;
  arquivos_copiados: number | null;
  arquivos_pendentes: number | null;
}

const COR = {
  ok: "border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
  atencao: "border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
  problema: "border-red-500/40 bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-100",
};

const dataBr = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const diaBr = (dia: string) => dia.split("-").reverse().join("/");

export default function Backups() {
  const { toast } = useToast();
  const [execucoes, setExecucoes] = useState<ExecucaoCompleta[]>([]);
  const [dias, setDias] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [rodando, setRodando] = useState(false);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [drive, setDrive] = useState<any>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [ligando, setLigando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [ex, lk, dv] = await Promise.all([
        (supabase.from as any)("backup_execucoes").select("*").order("iniciado_em", { ascending: false }).limit(30),
        supabase.functions.invoke("backup-diario", { body: { modo: "links" } }),
        (supabase.rpc as any)("drive_status"),
      ]);
      setExecucoes((ex.data as ExecucaoCompleta[]) || []);
      setDias((lk.data as any)?.dias || []);
      setDrive(dv.data || null);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  /* Volta do Google: ?drive=ok ou ?drive=erro&motivo=… */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const r = p.get("drive");
    if (!r) return;
    if (r === "ok") toast({ title: "Google Drive conectado", description: "A cópia começa no próximo envio (a cada 2 horas) — ou clique em Enviar agora." });
    else toast({ title: "Não conectou ao Google Drive", description: p.get("motivo") || "", variant: "destructive" });
    window.history.replaceState(null, "", window.location.pathname);
  }, [toast]);

  /** Guarda as chaves (no cofre do banco) e abre o Google para clicar em "Permitir". */
  const conectarDrive = async () => {
    setLigando(true);
    try {
      if (clientId.trim() && clientSecret.trim()) {
        const { error } = await (supabase.rpc as any)("drive_salvar_credenciais", { client_id: clientId, client_secret: clientSecret });
        if (error) throw error;
      }
      const { data, error } = await supabase.functions.invoke("google-drive", { body: { acao: "iniciar" } });
      if (error || !(data as any)?.url) throw new Error((data as any)?.error || error?.message || "falhou");
      window.location.href = (data as any).url;
    } catch (e: any) {
      toast({ title: "Não foi possível conectar", description: e.message, variant: "destructive" });
      setLigando(false);
    }
  };

  const enviarAoDriveAgora = async () => {
    setLigando(true);
    try {
      const { data, error } = await supabase.functions.invoke("backup-diario", { body: { modo: "drive" } });
      if (error || !(data as any)?.ok) throw new Error((data as any)?.erro || error?.message || "falhou");
      const d = data as any;
      toast({ title: "Enviado ao Google Drive", description: `${d.dias} dia(s) e ${d.arquivos} arquivo(s). ${d.pendentes ? `Faltam ${d.pendentes}, seguem no próximo envio.` : ""}` });
    } catch (e: any) {
      toast({ title: "Falhou o envio ao Drive", description: e.message, variant: "destructive" });
    } finally {
      setLigando(false);
      void carregar();
    }
  };

  const rodarAgora = async () => {
    setRodando(true);
    try {
      const { data, error } = await supabase.functions.invoke("backup-diario", { body: { modo: "completo" } });
      if (error || !(data as any)?.ok) throw new Error((data as any)?.erro || error?.message || "falhou");
      toast({ title: "Backup feito", description: `${(data as any).tabelas} tabelas, ${(data as any).linhas} registros.` });
    } catch (e: any) {
      toast({ title: "O backup falhou", description: e.message, variant: "destructive" });
    } finally {
      setRodando(false);
      void carregar();
    }
  };

  /** Busca os arquivos daquele dia e junta num .zip aqui no navegador. */
  const baixar = async (dia: string) => {
    setBaixando(dia);
    try {
      const { data, error } = await supabase.functions.invoke("backup-diario", { body: { modo: "links", dia } });
      if (error) throw error;
      const arquivos: { nome: string; url: string }[] = (data as any)?.arquivos || [];
      if (!arquivos.length) throw new Error("Nenhum arquivo neste dia.");
      const zip = new JSZip();
      for (const a of arquivos) {
        const r = await fetch(a.url);
        if (!r.ok) throw new Error(`Não baixou ${a.nome}`);
        zip.file(a.nome, await r.blob());
      }
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `backup-safetysolucoes-${dia}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
    } catch (e: any) {
      toast({ title: "Não foi possível baixar", description: e.message, variant: "destructive" });
    } finally {
      setBaixando(null);
    }
  };

  const situacao = situacaoDoBackup(execucoes);
  const ultimoArquivos = execucoes.find((e) => e.status !== "rodando" && e.arquivos_pendentes !== null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Backups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cópia automática de tudo — tabelas, usuários e arquivos — todo dia às 03:00. Guarda 30 dias.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={carregando}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${carregando ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button size="sm" onClick={() => void rodarAgora()} disabled={rodando}>
            {rodando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-1.5 h-4 w-4" />}
            Fazer backup agora
          </Button>
        </div>
      </div>

      <div className={`flex items-start gap-3 rounded-lg border p-4 ${COR[situacao.nivel]}`}>
        {situacao.nivel === "ok"
          ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />}
        <div className="text-sm">
          <p className="font-semibold">{situacao.texto}</p>
          {ultimoArquivos && (ultimoArquivos.arquivos_pendentes ?? 0) > 0 && (
            <p className="mt-1 opacity-80">
              Cópia dos arquivos em andamento: faltam {ultimoArquivos.arquivos_pendentes}. Continua sozinha a cada 2 horas.
            </p>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Dias guardados</CardTitle></CardHeader>
        <CardContent>
          {dias.length === 0 ? (
            <p className="text-sm text-muted-foreground">{carregando ? "Carregando…" : "Nenhum backup guardado ainda."}</p>
          ) : (
            <ul className="divide-y">
              {dias.map((d) => (
                <li key={d} className="flex items-center justify-between py-2.5">
                  <span className="text-sm font-medium">{diaBr(d)}</span>
                  <Button variant="outline" size="sm" onClick={() => void baixar(d)} disabled={baixando !== null}>
                    {baixando === d ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
                    Baixar (.zip)
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            O .zip traz uma lista de registros por tabela, as contas de usuário (sem senha) e um resumo.
            Os arquivos (PDFs e fotos) ficam copiados numa pasta privada separada.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Últimas execuções</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {execucoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma execução registrada.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th className="py-1.5 pr-3">Quando</th><th className="pr-3">Tipo</th><th className="pr-3">Resultado</th><th className="pr-3 text-right">Registros</th><th className="text-right">Arquivos</th></tr>
              </thead>
              <tbody className="divide-y">
                {execucoes.slice(0, 15).map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap py-1.5 pr-3">{dataBr(e.iniciado_em)}</td>
                    <td className="pr-3">{{ completo: "Completo", arquivos: "Arquivos", drive: "Google Drive" }[e.modo] || e.modo}</td>
                    <td className="pr-3" title={e.erro || undefined}>
                      {{ ok: "Deu certo", parcial: "Parcial", erro: "Falhou", rodando: "Rodando…" }[e.status] || e.status}
                    </td>
                    <td className="pr-3 text-right tabular-nums">{e.linhas ?? "—"}</td>
                    <td className="text-right tabular-nums">{e.arquivos_copiados ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Cópia fora da Supabase: Google Drive do dono da conta. */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Cloud className="h-4 w-4" /> Cópia no Google Drive</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {drive?.conectado ? (
            <>
              <p className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> Conectado{drive.conta_email ? ` a ${drive.conta_email}` : ""}
              </p>
              <p className="text-muted-foreground">
                Pasta "SafetySoluções - Backups" no seu Drive. Envio automático a cada 2 horas.
                {" "}{drive.dias_no_drive} dia(s) e {drive.arquivos_no_drive} arquivo(s) já estão lá.
                {drive.ultimo_envio_em && ` Último envio: ${dataBr(drive.ultimo_envio_em)}.`}
              </p>
              {drive.ultimo_erro && <p className="text-red-600">Último problema: {drive.ultimo_erro}</p>}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void enviarAoDriveAgora()} disabled={ligando}>
                  {ligando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Cloud className="mr-1.5 h-4 w-4" />} Enviar agora
                </Button>
                <Button size="sm" variant="outline" onClick={() => void conectarDrive()} disabled={ligando}>Conectar outra conta</Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                Ainda não conectado. Siga o passo a passo para criar as chaves no Google, cole aqui e clique em Conectar —
                o Google vai pedir para você clicar em "Permitir". O sistema só enxerga os arquivos que ele mesmo criar no seu Drive.
              </p>
              {!drive?.tem_credenciais && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label htmlFor="gcid">Client ID</Label><Input id="gcid" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="….apps.googleusercontent.com" /></div>
                  <div><Label htmlFor="gcs">Client Secret</Label><Input id="gcs" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="GOCSPX-…" /></div>
                </div>
              )}
              <Button size="sm" onClick={() => void conectarDrive()}
                disabled={ligando || (!drive?.tem_credenciais && (!clientId.trim() || !clientSecret.trim()))}>
                {ligando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Cloud className="mr-1.5 h-4 w-4" />} Conectar ao Google Drive
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 rounded-lg border p-4 text-sm text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          A cópia diária fica numa área privada separada dentro da Supabase (protege contra apagar por engano) e, com o
          Google Drive conectado, também no seu Drive (protege contra perder a conta inteira).
        </p>
      </div>
    </div>
  );
}
