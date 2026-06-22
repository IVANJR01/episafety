import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { FileText, Download, RefreshCw, PenLine, ExternalLink, AlertTriangle, ShieldCheck, Eye } from "lucide-react";
import { toast } from "sonner";
import MfaActionButton from "@/components/cat/MfaActionButton";
import { PgrDocumento, PgrStatus } from "@/lib/pgrTypes";
import { generateAndUploadPgrPdf } from "@/lib/pgrPdf";
import { resolveDocumentoUrl } from "@/lib/secureStorage";

async function abrirPdfVersao(v: any) {
  try {
    const provider =
      (v.storage_provider as "supabase_storage" | "google_drive_byok") ||
      (v.storage_path ? "supabase_storage" : "google_drive_byok");
    const url = await resolveDocumentoUrl({
      provider,
      bucket: v.storage_bucket,
      path: v.storage_path,
      driveViewLink: v.drive_view_link,
      ttl: 300,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (e: any) {
    toast.error(e?.message || "Falha ao abrir PDF");
  }
}

interface Props {
  pgr: PgrDocumento;
  canEdit: boolean;
  canExport: boolean;
  canAssinar: boolean;
}

export default function PgrPdfTab({ pgr, canEdit, canExport, canAssinar }: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [showSig, setShowSig] = useState(false);
  const [sigNome, setSigNome] = useState(pgr.resp_tec_nome || "");
  const [sigReg, setSigReg] = useState(pgr.resp_tec_registro || "");
  const [sigObs, setSigObs] = useState("");

  const { data: versoes = [], refetch } = useQuery({
    queryKey: ["pgr-pdf-versoes", pgr.id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_pdf_versoes")
        .select("*").eq("pgr_id", pgr.id).order("pdf_versao", { ascending: false });
      return (data || []) as Array<any>;
    },
  });
  const { data: assinaturas = [] } = useQuery({
    queryKey: ["pgr-assinaturas", pgr.id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_assinaturas")
        .select("*").eq("pgr_id", pgr.id).order("assinado_em", { ascending: false });
      return (data || []) as Array<any>;
    },
  });

  const ultima = versoes[0];
  const status = pgr.status as PgrStatus;
  const bloqueado = status === "substituido" || status === "arquivado";
  const desatualizado = ultima && (pgr as any).conteudo_atualizado_em &&
    new Date((pgr as any).conteudo_atualizado_em).getTime() > new Date(ultima.gerado_em).getTime() + 500;

  async function carregarContexto() {
    const [emp, uni, inv, acoes, evid, rev, ghes] = await Promise.all([
      (supabase.from as any)("empresa_config").select("nome, cnpj").eq("id", pgr.empresa_id).maybeSingle(),
      pgr.unidade_id ? (supabase.from as any)("empresa_config").select("nome").eq("id", pgr.unidade_id).maybeSingle() : Promise.resolve({ data: null }),
      (supabase.from as any)("pgr_inventario_itens").select("*").eq("pgr_id", pgr.id).order("classificacao"),
      (supabase.from as any)("pgr_acoes").select("*").eq("pgr_id", pgr.id).order("prazo"),
      (supabase.from as any)("pgr_acao_evidencias").select("*").eq("pgr_id", pgr.id),
      (supabase.from as any)("pgr_revisoes").select("*").eq("pgr_id", pgr.id).order("created_at", { ascending: false }),
      (supabase.from as any)("ghe_ges").select("id,nome").eq("empresa_id", pgr.empresa_id),
    ]);
    const ghesMap: Record<string, string> = {};
    (ghes.data || []).forEach((g: any) => { ghesMap[g.id] = g.nome; });
    return {
      doc: pgr,
      empresaNome: emp.data?.nome ?? null,
      empresaCnpj: emp.data?.cnpj ?? null,
      unidadeNome: uni?.data?.nome ?? null,
      inventario: inv.data || [],
      acoes: acoes.data || [],
      evidencias: (evid.data || []).map((e: any) => ({
        id: e.id, acao_id: e.acao_id, nome_arquivo: e.nome_arquivo,
        uploaded_at: e.created_at, uploaded_by_email: e.uploaded_by_email,
        drive_view_link: e.drive_view_link,
      })),
      revisoes: rev.data || [],
      assinaturas: assinaturas as any[],
      ghes: ghesMap,
    };
  }

  async function handleGerar() {
    if (bloqueado) { toast.error(`PGR ${status} — não é permitido gerar nova versão de PDF.`); return; }
    setBusy(true);
    try {
      const ctx = await carregarContexto();
      const r = await generateAndUploadPgrPdf(ctx as any);
      toast.success(`PDF v${r.pdfVersao} gerado e salvo no Drive`);
      refetch();
      qc.invalidateQueries({ queryKey: ["pgr-detalhe", pgr.id] });
      qc.invalidateQueries({ queryKey: ["pgr-revisoes", pgr.id] });
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
      const { error } = await (supabase.rpc as any)("pgr_assinar_visual", {
        _pgr_id: pgr.id,
        _pdf_hash: ultima.pdf_hash,
        _responsavel_nome: sigNome.trim(),
        _responsavel_registro: sigReg.trim() || null,
        _ip_origem: null,
        _observacao: sigObs.trim() || null,
      });
      if (error) throw error;
      toast.success("Assinatura visual registrada");
      setShowSig(false); setSigObs("");
      qc.invalidateQueries({ queryKey: ["pgr-assinaturas", pgr.id] });
      qc.invalidateQueries({ queryKey: ["pgr-revisoes", pgr.id] });
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
              {ultima && (
                <Button size="sm" variant="outline" onClick={() => abrirPdfVersao(ultima)}>
                  <Eye className="h-4 w-4 mr-1" /> Visualizar PDF
                </Button>
              )}
              {!bloqueado && canExport && (
                <MfaActionButton size="sm" onClick={handleGerar} disabled={busy}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${busy ? "animate-spin" : ""}`} />
                  {ultima ? "Regenerar PDF" : "Gerar PDF"}
                </MfaActionButton>
              )}
              {ultima && !ultima.com_marca_dagua && canAssinar && (
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
            Hash SHA-256 + QR Code de validação interna.
          </div>
          {desatualizado && (
            <div className="rounded-md p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> PDF desatualizado — o conteúdo do PGR foi alterado após a última geração.
            </div>
          )}
          {bloqueado && (
            <div className="rounded-md p-3 bg-zinc-50 border border-zinc-200 text-zinc-700 text-sm">
              PGR <b>{status}</b> — apenas visualização das versões anteriores.
            </div>
          )}
          {ultima ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Info label="Última versão" value={`v${ultima.pdf_versao}${ultima.com_marca_dagua ? " (RASCUNHO)" : ""}`} />
              <Info label="Gerado em" value={new Date(ultima.gerado_em).toLocaleString("pt-BR")} />
              <Info label="Tamanho" value={ultima.tamanho_bytes ? `${Math.round(ultima.tamanho_bytes / 1024)} KB` : "—"} />
              <Info label="Armazenamento" value={
                ultima.storage_provider === "supabase_storage" || ultima.storage_path
                  ? <span className="text-xs">Supabase Storage (privado)</span>
                  : ultima.drive_view_link
                  ? <a className="text-primary underline inline-flex items-center gap-1" href={ultima.drive_view_link} target="_blank" rel="noreferrer">Drive <ExternalLink className="h-3 w-3" /></a>
                  : "—"
              } />
              <div className="md:col-span-2">
                <span className="text-xs text-muted-foreground">Hash SHA-256: </span>
                <span className="font-mono text-[11px] break-all">{ultima.pdf_hash}</span>
              </div>
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
                      PDF v{v.pdf_versao} · PGR v{v.pgr_versao}
                      {v.com_marca_dagua && <Badge variant="outline" className="ml-2 text-[10px]">RASCUNHO</Badge>}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono break-all">{v.pdf_hash}</div>
                    <div className="text-[11px] text-muted-foreground">{new Date(v.gerado_em).toLocaleString("pt-BR")}</div>
                  </div>
                  {(v.storage_path || v.drive_view_link) && (
                    <Button size="sm" variant="outline" onClick={() => abrirPdfVersao(v)}>
                      <Eye className="h-3 w-3 mr-1" /> Visualizar
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
                  <div className="text-xs text-muted-foreground">PDF v{a.pdf_versao} · {new Date(a.assinado_em).toLocaleString("pt-BR")} · MFA {a.mfa_verificado ? "OK" : "—"}</div>
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
            <DialogTitle>Assinatura visual do PGR</DialogTitle>
            <DialogDescription>
              Registro de assinatura visual com hash SHA-256 e MFA. <b>Não é assinatura digital ICP-Brasil.</b>
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
