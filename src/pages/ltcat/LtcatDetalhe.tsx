import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, Pencil, GitBranch, Send, FileText } from "lucide-react";
import { toast } from "sonner";
import MfaActionButton from "@/components/cat/MfaActionButton";
import LtcatResponsaveisTab from "@/components/ltcat/LtcatResponsaveisTab";
import LtcatSetoresTab from "@/components/ltcat/LtcatSetoresTab";
import LtcatAgentesAvaliacoesTab from "@/components/ltcat/LtcatAgentesAvaliacoesTab";
import LtcatFuncoesTab from "@/components/ltcat/LtcatFuncoesTab";
import LtcatConclusoesTab from "@/components/ltcat/LtcatConclusoesTab";
import LtcatPdfTab from "@/components/ltcat/LtcatPdfTab";
import LtcatChecklistTab from "@/components/ltcat/LtcatChecklistTab";
import {
  LtcatDocumento, LtcatRevisao,
  LTCAT_STATUS_LABEL, LTCAT_STATUS_COLOR, LTCAT_MOTIVO_LABEL,
  LtcatStatus, isLtcatEditavel,
} from "@/lib/ltcatTypes";

function fmtDate(d: string | null) {
  return d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";
}

function Field({ label, children, full = false }: { label: string; children: any; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export default function LtcatDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const perms = usePermissions("ltcat");

  const [showRev, setShowRev] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: doc, isLoading } = useQuery({
    queryKey: ["ltcat-detalhe", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("ltcat_documentos")
        .select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as LtcatDocumento | null;
    },
    enabled: !!id,
  });

  const { data: revisoes = [] } = useQuery({
    queryKey: ["ltcat-revisoes", id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ltcat_revisoes")
        .select("*").eq("ltcat_id", id).order("created_at", { ascending: false });
      return (data || []) as LtcatRevisao[];
    },
    enabled: !!id,
  });

  const { data: pgrInfo } = useQuery({
    queryKey: ["ltcat-pgr-info", doc?.pgr_id],
    queryFn: async () => {
      if (!doc?.pgr_id) return null;
      const { data } = await (supabase.from as any)("pgr_documentos")
        .select("id, versao, status").eq("id", doc.pgr_id).maybeSingle();
      return data;
    },
    enabled: !!doc?.pgr_id,
  });

  if (isLoading) return <Card><CardContent className="p-8 text-center text-muted-foreground">Carregando…</CardContent></Card>;
  if (!doc) return <Card><CardContent className="p-8 text-center text-muted-foreground">LTCAT não encontrado ou fora do seu escopo.</CardContent></Card>;

  const status = doc.status as LtcatStatus;
  const editavel = isLtcatEditavel(status);

  const handleAbrirRevisao = async () => {
    if (motivo.trim().length < 5) { toast.error("Motivo precisa ter pelo menos 5 caracteres"); return; }
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("ltcat_abrir_revisao", { _ltcat_id: id, _motivo: motivo.trim() });
      if (error) throw error;
      toast.success("Revisão aberta — nova versão criada");
      setShowRev(false); setMotivo("");
      qc.invalidateQueries({ queryKey: ["ltcat-list"] });
      if (data?.novo_ltcat_id) navigate(`/ltcat/${data.novo_ltcat_id}`);
    } catch (e: any) {
      toast.error(e.message || "Falha ao abrir revisão");
    } finally { setBusy(false); }
  };

  const handlePublicar = async () => {
    if (!confirm(`Publicar LTCAT v${doc.versao}? A versão anterior vigente será marcada como substituída.`)) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc("ltcat_publicar", { _ltcat_id: id });
      if (error) throw error;
      toast.success("LTCAT publicado como vigente");
      qc.invalidateQueries({ queryKey: ["ltcat-detalhe", id] });
      qc.invalidateQueries({ queryKey: ["ltcat-revisoes", id] });
      qc.invalidateQueries({ queryKey: ["ltcat-list"] });
    } catch (e: any) {
      toast.error(e.message || "Falha ao publicar");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/ltcat")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h1 className="text-xl font-bold">LTCAT v{doc.versao}</h1>
          <Badge className={LTCAT_STATUS_COLOR[status]} variant="outline">{LTCAT_STATUS_LABEL[status]}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {editavel && perms.canEdit && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/ltcat/${id}/editar`)}>
              <Pencil className="h-4 w-4 mr-1" /> Editar
            </Button>
          )}
          {status === "vigente" && perms.canEdit && (
            <MfaActionButton variant="outline" size="sm" onClick={() => setShowRev(true)}>
              <GitBranch className="h-4 w-4 mr-1" /> Abrir revisão
            </MfaActionButton>
          )}
          {(status === "rascunho" || status === "em_revisao") && perms.canEdit && (
            <MfaActionButton size="sm" onClick={handlePublicar} disabled={busy}>
              <Send className="h-4 w-4 mr-1" /> Publicar (vigente)
            </MfaActionButton>
          )}
        </div>
      </div>

      <Tabs defaultValue="resumo">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="rt">Responsáveis Técnicos</TabsTrigger>
          <TabsTrigger value="setores">Setores / GHE</TabsTrigger>
          <TabsTrigger value="funcoes">Funções</TabsTrigger>
          <TabsTrigger value="agentes">Agentes e Avaliações</TabsTrigger>
          <TabsTrigger value="conclusoes">Conclusões Previdenciárias</TabsTrigger>
          <TabsTrigger value="revisoes">Revisões</TabsTrigger>
          <TabsTrigger value="pdf">PDF</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Identificação</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <Field label="Versão">v{doc.versao}</Field>
              <Field label="Status">{LTCAT_STATUS_LABEL[status]}</Field>
              <Field label="Motivo de emissão">{LTCAT_MOTIVO_LABEL[doc.motivo_emissao]}</Field>
              <Field label="Data de emissão">{fmtDate(doc.data_emissao)}</Field>
              <Field label="Vigência">
                {doc.data_vigencia_inicio && doc.data_vigencia_fim
                  ? `${fmtDate(doc.data_vigencia_inicio)} – ${fmtDate(doc.data_vigencia_fim)}` : "—"}
              </Field>
              <Field label="CNAE">{doc.cnae || "—"}</Field>
              <Field label="Grau de risco">{doc.grau_risco ?? "—"}</Field>
              <Field label="PGR vinculado">
                {pgrInfo ? (
                  <button className="underline" onClick={() => navigate(`/pgr/${pgrInfo.id}`)}>
                    PGR v{pgrInfo.versao} ({pgrInfo.status})
                  </button>
                ) : "—"}
              </Field>
              <Field label="Escopo" full>{doc.escopo || "—"}</Field>
              <Field label="Metodologia geral" full>{doc.metodologia_geral || "—"}</Field>
              <Field label="Observações" full>{doc.observacoes || "—"}</Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rt">
          <LtcatResponsaveisTab ltcatId={doc.id} empresaId={doc.empresa_id} editavel={editavel && perms.canEdit} />
        </TabsContent>

        <TabsContent value="setores">
          <LtcatSetoresTab ltcatId={doc.id} empresaId={doc.empresa_id} editavel={editavel && perms.canEdit} />
        </TabsContent>

        <TabsContent value="funcoes">
          <LtcatFuncoesTab ltcatId={doc.id} empresaId={doc.empresa_id} editavel={editavel && perms.canEdit} />
        </TabsContent>

        <TabsContent value="agentes">
          <LtcatAgentesAvaliacoesTab
            ltcatId={doc.id}
            ltcatVersao={doc.versao}
            empresaId={doc.empresa_id}
            editavel={editavel && perms.canEdit}
          />
        </TabsContent>

        <TabsContent value="conclusoes">
          <LtcatConclusoesTab
            ltcatId={doc.id}
            empresaId={doc.empresa_id}
            editavel={editavel && perms.canEdit}
          />
        </TabsContent>

        <TabsContent value="revisoes">
          <Card>
            <CardHeader><CardTitle className="text-base">Histórico de revisões</CardTitle></CardHeader>
            <CardContent>
              {revisoes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma revisão registrada.</p>
              ) : (
                <ul className="space-y-2">
                  {revisoes.map((r) => (
                    <li key={r.id} className="border rounded-md p-3 text-sm">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="font-medium">
                          {r.status_novo === "vigente" ? "Publicação" : "Abertura de revisão"}
                          {r.versao_anterior != null && r.versao_nova != null && (
                            <span className="text-muted-foreground"> · v{r.versao_anterior} → v{r.versao_nova}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleString("pt-BR")} · {r.user_email || "—"}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{r.motivo}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pdf">
          <LtcatPdfTab
            ltcat={doc}
            canExport={perms.canEdit}
            canAssinar={perms.canEdit}
          />
        </TabsContent>

        <TabsContent value="checklist">
          <LtcatChecklistTab ltcat={doc} />
        </TabsContent>
      </Tabs>

      <Dialog open={showRev} onOpenChange={setShowRev}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir revisão do LTCAT</DialogTitle>
            <DialogDescription>
              Será criada uma nova versão em rascunho. A versão atual continua vigente até a publicação da nova.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Motivo da revisão (mín. 5 caracteres) *</Label>
            <Textarea rows={4} value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: revisão periódica anual; mudança de processo produtivo; novo agente identificado." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRev(false)}>Cancelar</Button>
            <Button onClick={handleAbrirRevisao} disabled={busy}>
              {busy ? "Abrindo…" : "Abrir revisão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
