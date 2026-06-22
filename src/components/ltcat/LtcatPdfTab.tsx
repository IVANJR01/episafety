import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { FileText, Download, RefreshCw, PenLine, ExternalLink, AlertTriangle, ShieldCheck, Eye } from "lucide-react";
import { toast } from "sonner";
import MfaActionButton from "@/components/cat/MfaActionButton";
import { LtcatDocumento, LtcatStatus, isLtcatEditavel } from "@/lib/ltcatTypes";
import { generateAndUploadLtcatPdf, LtcatPdfContext } from "@/lib/ltcatPdf";
import { resolveDocumentoUrl, SUPABASE_STORAGE_REF_PREFIX } from "@/lib/secureStorage";

function isSupabaseStorageRow(v: any): boolean {
  return (
    v?.storage_provider === "supabase_storage" ||
    Boolean(v?.storage_path) ||
    Boolean(v?.drive_file_id?.startsWith?.(SUPABASE_STORAGE_REF_PREFIX))
  );
}

async function abrirPdfSeguro(v: any, download = false) {
  try {
    const url = await resolveDocumentoUrl({
      provider: isSupabaseStorageRow(v) ? "supabase_storage" : "google_drive_byok",
      bucket: v.storage_bucket || null,
      path: v.storage_path || null,
      driveFileId: v.drive_file_id || null,
      driveViewLink: isSupabaseStorageRow(v) ? null : v.drive_view_link || null,
      ttl: 300,
      download,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (e: any) {
    toast.error(e.message || "Falha ao abrir PDF");
  }
}

interface Props {
  ltcat: LtcatDocumento;
  canExport: boolean;
  canAssinar: boolean;
}

export default function LtcatPdfTab({ ltcat, canExport, canAssinar }: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [showSig, setShowSig] = useState(false);
  const [sigNome, setSigNome] = useState("");
  const [sigReg, setSigReg] = useState("");
  const [sigObs, setSigObs] = useState("");

  const status = ltcat.status as LtcatStatus;
  const editavel = isLtcatEditavel(status);
  const bloqueado = status === "substituido" || status === "arquivado";

  const { data: versoes = [], refetch } = useQuery({
    queryKey: ["ltcat-pdf-versoes", ltcat.id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ltcat_pdf_versoes")
        .select("*").eq("ltcat_id", ltcat.id).order("pdf_versao", { ascending: false });
      return (data || []) as any[];
    },
  });
  const { data: assinaturas = [] } = useQuery({
    queryKey: ["ltcat-assinaturas", ltcat.id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ltcat_assinaturas")
        .select("*").eq("ltcat_id", ltcat.id).order("assinado_em", { ascending: false });
      return (data || []) as any[];
    },
  });

  const ultima = versoes[0];
  const desatualizado = ultima && (ltcat as any).conteudo_atualizado_em &&
    new Date((ltcat as any).conteudo_atualizado_em).getTime() > new Date(ultima.gerado_em).getTime() + 500;

  async function carregarContexto(): Promise<LtcatPdfContext> {
    const [emp, uni, rts, ghes, funcoes, agentes, avals, concl, rev] = await Promise.all([
      (supabase.from as any)("empresa_config").select("nome, cnpj").eq("id", ltcat.empresa_id).maybeSingle(),
      ltcat.unidade_id
        ? (supabase.from as any)("empresa_config").select("nome").eq("id", ltcat.unidade_id).maybeSingle()
        : Promise.resolve({ data: null }),
      (supabase.from as any)("ltcat_responsaveis_tecnicos").select("*").eq("ltcat_id", ltcat.id).order("ordem"),
      (supabase.from as any)("ltcat_grupos_homogeneos").select("*").eq("ltcat_id", ltcat.id).order("codigo"),
      (supabase.from as any)("ltcat_funcoes").select("*").eq("ltcat_id", ltcat.id).order("nome_funcao"),
      (supabase.from as any)("ltcat_agentes").select("*").eq("ltcat_id", ltcat.id).order("nome"),
      (supabase.from as any)("ltcat_avaliacoes").select("*").eq("ltcat_id", ltcat.id).order("data_medicao", { ascending: false }),
      (supabase.from as any)("ltcat_conclusoes").select("*").eq("ltcat_id", ltcat.id).order("created_at"),
      (supabase.from as any)("ltcat_revisoes").select("*").eq("ltcat_id", ltcat.id).order("created_at", { ascending: false }),
    ]);
    return {
      doc: ltcat,
      empresaNome: emp.data?.nome ?? null,
      empresaCnpj: emp.data?.cnpj ?? null,
      unidadeNome: uni?.data?.nome ?? null,
      responsaveis: rts.data || [],
      ghes: ghes.data || [],
      funcoes: funcoes.data || [],
      agentes: agentes.data || [],
      avaliacoes: avals.data || [],
      conclusoes: concl.data || [],
      revisoes: rev.data || [],
      assinaturas,
    };
  }

  async function handleGerar() {
    if (bloqueado) { toast.error(`LTCAT ${status} — não é permitido gerar nova versão de PDF.`); return; }
    setBusy(true);
    try {
      const ctx = await carregarContexto();
      const r = await generateAndUploadLtcatPdf(ctx);
      toast.success(`PDF v${r.pdfVersao} gerado e salvo no Storage privado`);
      refetch();
      qc.invalidateQueries({ queryKey: ["ltcat-detalhe", ltcat.id] });
      qc.invalidateQueries({ queryKey: ["ltcat-revisoes", ltcat.id] });
    } catch (e: any) {
      toast.error(e.message || "Falha ao gerar PDF");
    } finally { setBusy(false); }
  }

  async function handleAssinar() {
    if (!ultima) { toast.error("Gere o PDF antes de assinar"); return; }
    if (ultima.com_marca_dagua) { toast.error("Gere a versão final (sem marca d'água) antes de assinar"); return; }
    if (sigNome.trim().length < 3) { toast.error("Informe o nome do responsável técnico"); return; }
    setBusy(true);
    try {
      const { error } = await (supabase.rpc as any)("ltcat_assinar_visual", {
        _ltcat_id: ltcat.id,
        _pdf_hash: ultima.pdf_hash,
        _responsavel_nome: sigNome.trim(),
        _responsavel_registro: sigReg.trim() || null,
        _ip_origem: null,
        _observacao: sigObs.trim() || null,
      });
      if (error) throw error;
      toast.success("Assinatura visual registrada");
      setShowSig(false); setSigObs("");
      qc.invalidateQueries({ queryKey: ["ltcat-assinaturas", ltcat.id] });
      qc.invalidateQueries({ queryKey: ["ltcat-revisoes", ltcat.id] });
    } catch (e: any) {
      toast.error(e.message || "Falha ao assinar");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> PDF técnico interno
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              {!bloqueado && canExport && editavel && (
                <MfaActionButton size="sm" onClick={handleGerar} disabled={busy}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${busy ? "animate-spin" : ""}`} />
                  {ultima ? "Regenerar PDF" : "Gerar PDF"}
                </MfaActionButton>
              )}
              {ultima && !ultima.com_marca_dagua && canAssinar && editavel && (
                <MfaActionButton size="sm" variant="outline" onClick={() => setShowSig(true)} disabled={busy}>
                  <PenLine className="h-4 w-4 mr-1" /> Assinar (visual)
                </MfaActionButton>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-md p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <b>Documento técnico interno.</b> Assinatura ICP-Brasil não implementada nesta fase.
            Hash SHA-256 + QR Code de validação interna restrito à empresa.
          </div>
          {desatualizado && (
            <div className="rounded-md p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> PDF desatualizado — o LTCAT foi alterado após a última geração. Regenere antes de publicar.
            </div>
          )}
          {bloqueado && (
            <div className="rounded-md p-3 bg-zinc-50 border border-zinc-200 text-zinc-700 text-sm">
              LTCAT <b>{status}</b> — apenas visualização das versões anteriores.
            </div>
          )}
          {ultima ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Info label="Última versão" value={`v${ultima.pdf_versao}${ultima.com_marca_dagua ? " (RASCUNHO)" : ""}`} />
              <Info label="Gerado em" value={new Date(ultima.gerado_em).toLocaleString("pt-BR")} />
              <Info label="Tamanho" value={ultima.tamanho_bytes ? `${Math.round(ultima.tamanho_bytes / 1024)} KB` : "—"} />
              <Info label="Armazenamento" value={
                isSupabaseStorageRow(ultima)
                  ? <Badge variant="outline" className="text-[10px]">Supabase Storage (privado)</Badge>
                  : <Badge variant="outline" className="text-[10px]">Google Drive (BYOK)</Badge>
              } />
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => abrirPdfSeguro(ultima, false)}>
                  <Eye className="h-3 w-3 mr-1" /> Visualizar PDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => abrirPdfSeguro(ultima, true)}>
                  <Download className="h-3 w-3 mr-1" /> Baixar PDF
                </Button>
              </div>
              <div className="md:col-span-2">
                <span className="text-xs text-muted-foreground">Hash SHA-256: </span>
                <span className="font-mono text-[11px] break-all">{ultima.pdf_hash}</span>
              </div>
              {isSupabaseStorageRow(ultima) && ultima.storage_path && (
                <div className="md:col-span-2 text-[11px] text-muted-foreground">
                  <span>Path: </span>
                  <span className="font-mono break-all">{ultima.storage_bucket}/{ultima.storage_path}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Nenhum PDF gerado ainda.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Versões do PDF</CardTitle></CardHeader>
        <CardContent>
          {versoes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma versão registrada.</p>
          ) : (
            <ul className="space-y-2">
              {versoes.map((v: any) => (
                <li key={v.id} className="border rounded-md p-3 text-sm flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-medium">
                      PDF v{v.pdf_versao}
                      {v.com_marca_dagua && <Badge variant="outline" className="ml-2 text-[10px]">RASCUNHO</Badge>}
                      <Badge variant="outline" className="ml-2 text-[10px]">{v.status_no_momento}</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono break-all">{v.pdf_hash}</div>
                    <div className="text-[11px] text-muted-foreground">{new Date(v.gerado_em).toLocaleString("pt-BR")}</div>
                  </div>
                  {v.drive_view_link && (
                    <Button asChild size="sm" variant="outline">
                      <a href={v.drive_view_link} target="_blank" rel="noreferrer">
                        <Download className="h-3 w-3 mr-1" /> Abrir
                      </a>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Assinaturas visuais
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assinaturas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma assinatura registrada.</p>
          ) : (
            <ul className="space-y-2">
              {assinaturas.map((a: any) => (
                <li key={a.id} className="border rounded-md p-3 text-sm">
                  <div className="font-medium">{a.responsavel_nome} <span className="text-xs text-muted-foreground">· {a.responsavel_registro || "—"}</span></div>
                  <div className="text-xs text-muted-foreground">PDF v{a.pdf_versao} · {new Date(a.assinado_em).toLocaleString("pt-BR")} · MFA OK · {a.user_email || "—"}</div>
                  <div className="text-[11px] font-mono break-all text-muted-foreground">{a.pdf_hash}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={showSig} onOpenChange={setShowSig}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assinatura visual do LTCAT</DialogTitle>
            <DialogDescription>
              Registro com hash SHA-256 e MFA. <b>Não é assinatura digital ICP-Brasil.</b>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Responsável técnico *</Label>
              <Input value={sigNome} onChange={(e) => setSigNome(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Registro profissional</Label>
              <Input value={sigReg} onChange={(e) => setSigReg(e.target.value)} placeholder="CREA / MTE / etc." />
            </div>
            <div>
              <Label className="text-xs">Observação</Label>
              <Textarea rows={2} value={sigObs} onChange={(e) => setSigObs(e.target.value)} />
            </div>
            {ultima && (
              <div className="text-[11px] text-muted-foreground">
                Hash a ser assinado: <span className="font-mono break-all">{ultima.pdf_hash}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSig(false)}>Cancelar</Button>
            <Button onClick={handleAssinar} disabled={busy}>Assinar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}
