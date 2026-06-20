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
import { ArrowLeft, Pencil, GitBranch, Send, FileText, ListChecks } from "lucide-react";
import { toast } from "sonner";
import MfaActionButton from "@/components/cat/MfaActionButton";
import InventarioTab from "@/components/pgr/InventarioTab";
import PlanoAcaoTab from "@/components/pgr/PlanoAcaoTab";
import {
  PgrDocumento, PgrRevisao, PGR_STATUS_LABEL, PGR_STATUS_COLOR, PgrStatus, isEditavel,
} from "@/lib/pgrTypes";

export default function PgrDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const perms = usePermissions("pgr");

  const [showRev, setShowRev] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: doc, isLoading } = useQuery({
    queryKey: ["pgr-detalhe", id],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("pgr_documentos")
        .select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as PgrDocumento | null;
    },
    enabled: !!id,
  });

  const { data: revisoes = [] } = useQuery({
    queryKey: ["pgr-revisoes", id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_revisoes")
        .select("*").eq("pgr_id", id).order("created_at", { ascending: false });
      return (data || []) as PgrRevisao[];
    },
    enabled: !!id,
  });

  if (isLoading) return <Card><CardContent className="p-8 text-center text-muted-foreground">Carregando…</CardContent></Card>;
  if (!doc) return <Card><CardContent className="p-8 text-center text-muted-foreground">PGR não encontrado ou fora do seu escopo.</CardContent></Card>;

  const status = doc.status as PgrStatus;
  const editavel = isEditavel(status);

  const handleAbrirRevisao = async () => {
    if (motivo.trim().length < 5) { toast.error("Motivo precisa ter pelo menos 5 caracteres"); return; }
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("pgr_abrir_revisao", { _pgr_id: id, _motivo: motivo.trim() });
      if (error) throw error;
      toast.success("Revisão aberta — nova versão criada");
      setShowRev(false); setMotivo("");
      qc.invalidateQueries({ queryKey: ["pgr-list"] });
      if (data?.pgr_id) navigate(`/pgr/${data.pgr_id}`);
    } catch (e: any) {
      toast.error(e.message || "Falha ao abrir revisão");
    } finally { setBusy(false); }
  };

  const handlePublicar = async () => {
    if (!confirm(`Publicar PGR v${doc.versao}? A versão anterior vigente será marcada como substituída.`)) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc("pgr_publicar", { _pgr_id: id });
      if (error) throw error;
      toast.success("PGR publicado como vigente");
      qc.invalidateQueries({ queryKey: ["pgr-detalhe", id] });
      qc.invalidateQueries({ queryKey: ["pgr-revisoes", id] });
      qc.invalidateQueries({ queryKey: ["pgr-list"] });
    } catch (e: any) {
      toast.error(e.message || "Falha ao publicar");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/pgr")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h1 className="text-xl font-bold">PGR v{doc.versao}</h1>
          <Badge className={PGR_STATUS_COLOR[status]} variant="outline">{PGR_STATUS_LABEL[status]}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {editavel && perms.canEdit && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/pgr/${id}/editar`)}>
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
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="revisoes">Revisões</TabsTrigger>
          <TabsTrigger value="inventario">Inventário</TabsTrigger>
          <TabsTrigger value="acoes">Plano de Ação</TabsTrigger>
          <TabsTrigger value="pdf">PDF</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Identificação</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <Field label="Versão">v{doc.versao}</Field>
              <Field label="Status">{PGR_STATUS_LABEL[status]}</Field>
              <Field label="Data de emissão">{fmtDate(doc.data_emissao)}</Field>
              <Field label="Vigência">
                {doc.data_vigencia_inicio && doc.data_vigencia_fim
                  ? `${fmtDate(doc.data_vigencia_inicio)} – ${fmtDate(doc.data_vigencia_fim)}` : "—"}
              </Field>
              <Field label="Responsável Técnico">{doc.resp_tec_nome || "—"}</Field>
              <Field label="Registro">{doc.resp_tec_registro || "—"}</Field>
              <Field label="Escopo" full>{doc.escopo || "—"}</Field>
              <Field label="Metodologia" full>{doc.metodologia_avaliacao || "—"}</Field>
              <Field label="Observações" full>{doc.observacoes || "—"}</Field>
            </CardContent>
          </Card>
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
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">
                          {r.acao === "abrir_revisao" ? "Abertura de revisão" :
                           r.acao === "publicar" ? "Publicação" : r.acao}
                          {r.versao_anterior != null && r.versao_nova != null && (
                            <span className="text-muted-foreground"> · v{r.versao_anterior} → v{r.versao_nova}</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                      {r.motivo && <div className="text-xs text-muted-foreground mt-1">{r.motivo}</div>}
                      {r.user_email && <div className="text-[11px] text-muted-foreground mt-1">por {r.user_email}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventario">
          <InventarioTab pgrId={id!} empresaId={doc.empresa_id} status={status} canEdit={perms.canEdit} />
        </TabsContent>

        <TabsContent value="acoes">
          <PlanoAcaoTab pgrId={id!} empresaId={doc.empresa_id} pgrVersao={doc.versao}
            status={status} canEdit={perms.canEdit} pgr={doc} />
        </TabsContent>

        <TabsContent value="pdf">
          <Card><CardContent className="p-8 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
            PDF técnico interno (assinatura visual + hash SHA-256, sem ICP-Brasil) — disponível na Parte 5.
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showRev} onOpenChange={setShowRev}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir revisão do PGR</DialogTitle>
            <DialogDescription>
              Será criada uma nova versão (v{doc.versao + 1}) com status “Em Revisão”, sem alterar o vigente atual.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs">Motivo *</Label>
            <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: revisão anual / mudança de processo / inclusão de GHE..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRev(false)}>Cancelar</Button>
            <Button onClick={handleAbrirRevisao} disabled={busy}>Abrir revisão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="whitespace-pre-wrap">{children}</div>
    </div>
  );
}
function fmtDate(d: string | null) { return d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—"; }
