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
import { FileText, Download, RefreshCw, PenLine, Eye, AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import MfaActionButton from "@/components/cat/MfaActionButton";
import { PppDocumento, isPppEditavel } from "@/lib/pppTypes";
import { generateAndUploadPppPdf, PppPdfContext } from "@/lib/pppPdf";
import { resolveDocumentoUrl, SUPABASE_STORAGE_REF_PREFIX } from "@/lib/secureStorage";

interface Props {
  ppp: PppDocumento;
  funcionario: any | null;
  empresa: any | null;
  canExport: boolean;
  canAssinar: boolean;
}

function isSupabaseStorageRow(v: any): boolean {
  return (
    v?.storage_provider === "supabase_storage" ||
    !!v?.storage_path ||
    (typeof v?.drive_id === "string" && v.drive_id.startsWith(SUPABASE_STORAGE_REF_PREFIX)) ||
    (typeof v?.drive_file_id === "string" && v.drive_file_id.startsWith(SUPABASE_STORAGE_REF_PREFIX))
  );
}

export default function PppPdfTab({ ppp, funcionario, empresa, canExport, canAssinar }: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [showSig, setShowSig] = useState(false);
  const [sigNome, setSigNome] = useState("");
  const [sigReg, setSigReg] = useState("");
  const [sigObs, setSigObs] = useState("");

  const editavel = isPppEditavel(ppp.status);
  const bloqueado = ppp.status === "substituido" || ppp.status === "arquivado";

  const { data: versoes = [], refetch } = useQuery({
    queryKey: ["ppp-pdf-versoes", ppp.id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ppp_pdf_versoes")
        .select("*").eq("ppp_id", ppp.id).order("pdf_versao", { ascending: false });
      return (data || []) as any[];
    },
  });
  const { data: assinaturas = [] } = useQuery({
    queryKey: ["ppp-assinaturas", ppp.id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ppp_assinaturas")
        .select("*").eq("ppp_id", ppp.id).order("assinado_em", { ascending: false });
      return (data || []) as any[];
    },
  });

  const ultima = versoes[0];
  const ultimaSupabase = ultima ? isSupabaseStorageRow(ultima) : false;
  const desatualizado = ultima && ppp.conteudo_atualizado_em &&
    new Date(ppp.conteudo_atualizado_em).getTime() > new Date(ultima.gerado_em).getTime() + 500;

  async function carregarContexto(): Promise<PppPdfContext> {
    const [per, exp, ra, rm, ex, rev] = await Promise.all([
      (supabase.from as any)("ppp_periodos").select("*").eq("ppp_id", ppp.id).order("data_inicio"),
      (supabase.from as any)("ppp_exposicoes").select("*").eq("ppp_id", ppp.id).order("created_at"),
      (supabase.from as any)("ppp_responsaveis_ambientais").select("*").eq("ppp_id", ppp.id).order("created_at"),
      (supabase.from as any)("ppp_responsaveis_medicos").select("*").eq("ppp_id", ppp.id).order("created_at"),
      (supabase.from as any)("ppp_exames_referenciados").select("*").eq("ppp_id", ppp.id).order("data", { ascending: false }),
      (supabase.from as any)("ppp_revisoes").select("*").eq("ppp_id", ppp.id).order("created_at", { ascending: false }),
    ]);
    return {
      doc: ppp,
      empresaNome: empresa?.nome ?? null,
      empresaCnpj: empresa?.cnpj ?? null,
      funcionario,
      periodos: per.data || [],
      exposicoes: exp.data || [],
      respAmbientais: ra.data || [],
      respMedicos: rm.data || [],
      exames: ex.data || [],
      revisoes: rev.data || [],
      assinaturas,
    };
  }

  async function abrirPdfSeguro(v: any, download = false) {
    try {
      if (isSupabaseStorageRow(v)) {
        const url = await resolveDocumentoUrl({
          provider: "supabase_storage",
          bucket: v.storage_bucket || null,
          path: v.storage_path || null,
          driveFileId: v.drive_id || null,
          driveViewLink: null,
          ttl: 300,
          download,
        });
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      if (v.drive_link) {
        window.open(v.drive_link, "_blank", "noopener,noreferrer");
        return;
      }
      toast.error("Arquivo indisponível");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao abrir PDF");
    }
  }

  async function handleGerar() {
    if (bloqueado) { toast.error(`PPP ${ppp.status} — não é permitido gerar nova versão.`); return; }
    setBusy(true);
    try {
      const ctx = await carregarContexto();
      const r = await generateAndUploadPppPdf(ctx);
      toast.success(`PDF v${r.pdfVersao} gerado e salvo no Storage privado`);
      refetch();
      qc.invalidateQueries({ queryKey: ["ppp-detalhe", ppp.id] });
      qc.invalidateQueries({ queryKey: ["ppp-revisoes", ppp.id] });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar PDF");
    } finally { setBusy(false); }
  }

  async function handleAssinar() {
    if (!ultima) { toast.error("Gere o PDF antes de assinar"); return; }
    if (ultima.com_marca_dagua) { toast.error("Gere a versão final (sem marca d'água) antes de assinar"); return; }
    if (sigNome.trim().length < 3) { toast.error("Informe o nome do responsável"); return; }
    setBusy(true);
    try {
      const { error } = await (supabase.rpc as any)("ppp_assinar_visual", {
        _ppp_id: ppp.id,
        _pdf_hash: ultima.pdf_hash,
        _responsavel_nome: sigNome.trim(),
        _responsavel_registro: sigReg.trim() || null,
        _ip_origem: null,
        _observacao: sigObs.trim() || null,
      });
      if (error) throw error;
      toast.success("Assinatura visual registrada");
      setShowSig(false); setSigObs("");
      qc.invalidateQueries({ queryKey: ["ppp-assinaturas", ppp.id] });
      qc.invalidateQueries({ queryKey: ["ppp-revisoes", ppp.id] });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao assinar");
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
            Hash SHA-256 + QR Code de validação interna restrito à empresa. Não enviado ao eSocial.
          </div>
          {desatualizado && (
            <div className="rounded-md p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> PDF desatualizado — o PPP foi alterado após a última geração. Regenere antes de publicar.
            </div>
          )}
          {bloqueado && (
            <div className="rounded-md p-3 bg-zinc-50 border border-zinc-200 text-zinc-700 text-sm">
              PPP <b>{ppp.status}</b> — apenas visualização das versões anteriores.
            </div>
          )}
          {ultima ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Info label="Última versão" value={`v${ultima.pdf_versao}${ultima.com_marca_dagua ? " (RASCUNHO)" : ""}`} />
                <Info label="Gerado em" value={new Date(ultima.gerado_em).toLocaleString("pt-BR")} />
                <Info label="Tamanho" value={ultima.tamanho_bytes ? `${Math.round(ultima.tamanho_bytes / 1024)} KB` : "—"} />
                <Info
                  label="Armazenamento"
                  value={
                    <Badge variant="outline" className="text-[10px]">
                      {ultimaSupabase ? "Supabase Storage (privado)" : "Google Drive (BYOK)"}
                    </Badge>
                  }
                />
                {ultimaSupabase && ultima.storage_path && (
                  <div className="md:col-span-2">
                    <span className="text-xs text-muted-foreground">Path: </span>
                    <span className="font-mono text-[11px] break-all">{ultima.storage_path}</span>
                  </div>
                )}
                <div className="md:col-span-2">
                  <span className="text-xs text-muted-foreground">Hash SHA-256: </span>
                  <span className="font-mono text-[11px] break-all">{ultima.pdf_hash}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => abrirPdfSeguro(ultima, false)}>
                  <Eye className="h-3 w-3 mr-1" /> Visualizar PDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => abrirPdfSeguro(ultima, true)}>
                  <Download className="h-3 w-3 mr-1" /> Baixar PDF
                </Button>
              </div>
            </>
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
              {versoes.map((v: any) => {
                const sb = isSupabaseStorageRow(v);
                return (
                  <li key={v.id} className="border rounded-md p-3 text-sm flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-medium flex items-center gap-2 flex-wrap">
                        PDF v{v.pdf_versao}
                        {v.com_marca_dagua && <Badge variant="outline" className="text-[10px]">RASCUNHO</Badge>}
                        {v.status_no_momento && <Badge variant="outline" className="text-[10px]">{v.status_no_momento}</Badge>}
                        <Badge variant="outline" className="text-[10px]">
                          {sb ? "Supabase Storage (privado)" : "Google Drive (BYOK)"}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono break-all">{v.pdf_hash}</div>
                      <div className="text-[11px] text-muted-foreground">{new Date(v.gerado_em).toLocaleString("pt-BR")}</div>
                      {sb && v.storage_path && (
                        <div className="text-[11px] text-muted-foreground font-mono break-all">{v.storage_path}</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => abrirPdfSeguro(v, false)}>
                        <Eye className="h-3 w-3 mr-1" /> Abrir
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => abrirPdfSeguro(v, true)}>
                        <Download className="h-3 w-3 mr-1" /> Baixar
                      </Button>
                    </div>
                  </li>
                );
              })}
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
                  <div className="font-medium">{a.responsavel_nome || a.nome} <span className="text-xs text-muted-foreground">· {a.responsavel_registro || "—"}</span></div>
                  <div className="text-xs text-muted-foreground">
                    PDF v{a.pdf_versao ?? "—"} · {new Date(a.assinado_em).toLocaleString("pt-BR")} · MFA {a.auth_aal || "—"} · {a.user_email || "—"}
                  </div>
                  <div className="text-[11px] font-mono break-all text-muted-foreground">{a.pdf_hash}</div>
                  {a.observacao && <div className="text-xs mt-1">{a.observacao}</div>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={showSig} onOpenChange={setShowSig}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assinatura visual do PPP</DialogTitle>
            <DialogDescription>
              Registro com hash SHA-256 e MFA (AAL2). <b>Não é assinatura digital ICP-Brasil.</b>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Responsável *</Label>
              <Input value={sigNome} onChange={(e) => setSigNome(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Registro profissional</Label>
              <Input value={sigReg} onChange={(e) => setSigReg(e.target.value)} placeholder="CREA / CRM / MTE…" />
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
