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
import { AlertTriangle, CheckCircle2, Download, Loader2, PlayCircle, RefreshCw, ShieldAlert } from "lucide-react";
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

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [ex, lk] = await Promise.all([
        (supabase.from as any)("backup_execucoes").select("*").order("iniciado_em", { ascending: false }).limit(30),
        supabase.functions.invoke("backup-diario", { body: { modo: "links" } }),
      ]);
      setExecucoes((ex.data as ExecucaoCompleta[]) || []);
      setDias((lk.data as any)?.dias || []);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

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
                    <td className="pr-3">{e.modo === "completo" ? "Completo" : "Arquivos"}</td>
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

      <div className="flex items-start gap-3 rounded-lg border p-4 text-sm text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          Esta cópia fica num espaço privado separado, dentro da mesma Supabase: protege contra apagar por engano e
          dado estragado. Para se proteger também de perder a conta inteira, baixe um .zip de vez em quando e guarde
          no seu computador ou Google Drive — ou peça para ligar a cópia automática para o Google Drive.
        </p>
      </div>
    </div>
  );
}
