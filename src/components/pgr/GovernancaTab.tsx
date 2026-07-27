import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { PGR_FLUXO, PGR_STATUS_COLOR, PGR_STATUS_LABEL, PgrDocumento, PgrStatus } from "@/lib/pgrTypes";

interface Props {
  pgr: PgrDocumento;
  canEdit: boolean;
}

const GATILHO_LABEL: Record<string, string> = {
  medida_implementada: "Medida implementada — avaliar risco residual",
  mudanca_tecnologia: "Mudança de tecnologia",
  mudanca_ambiente: "Mudança de ambiente",
  mudanca_processo: "Mudança de processo",
  mudanca_organizacao: "Mudança na organização do trabalho",
  controle_inadequado: "Controle inadequado, insuficiente ou ineficaz",
  acidente: "Acidente de trabalho",
  doenca_ocupacional: "Doença relacionada ao trabalho",
  requisito_legal: "Mudança de requisito legal",
  solicitacao_trabalhadores: "Solicitação justificada de trabalhadores",
  solicitacao_cipa: "Solicitação da CIPA",
  prazo_vencido: "Prazo de revisão vencido",
  outro: "Outro",
};

const GAT_STATUS_COR: Record<string, string> = {
  aberto: "bg-red-100 text-red-800 border-red-300",
  em_tratamento: "bg-amber-100 text-amber-800 border-amber-300",
  tratado: "bg-emerald-100 text-emerald-800 border-emerald-300",
  dispensado: "bg-slate-100 text-slate-700 border-slate-300",
};

const GAT_STATUS_LABEL: Record<string, string> = {
  aberto: "Aberto", em_tratamento: "Em tratamento",
  tratado: "Tratado", dispensado: "Dispensado",
};

const novoGatilho = {
  tipo: "mudanca_processo",
  descricao: "",
  data_ocorrencia: new Date().toISOString().slice(0, 10),
};

export default function GovernancaTab({ pgr, canEdit }: Props) {
  const qc = useQueryClient();
  const pgrId = pgr.id;
  const [abrirNovo, setAbrirNovo] = useState(false);
  const [form, setForm] = useState<any>(novoGatilho);
  const [tratando, setTratando] = useState<any>(null);
  const [justificativa, setJustificativa] = useState("");

  const { data: gatilhos = [], isLoading } = useQuery({
    queryKey: ["pgr-gatilhos", pgrId],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("pgr_gatilhos_revisao")
        .select("*").eq("pgr_id", pgrId).order("data_ocorrencia", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: aprovacoes = [] } = useQuery({
    queryKey: ["pgr-aprovacoes", pgrId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_aprovacoes")
        .select("*").eq("pgr_id", pgrId).order("decidido_em", { ascending: false });
      return (data || []) as any[];
    },
  });

  const abertos = useMemo(
    () => gatilhos.filter((g) => ["aberto", "em_tratamento"].includes(g.status)),
    [gatilhos],
  );

  const criar = useMutation({
    mutationFn: async () => {
      if (form.descricao.trim().length < 5) throw new Error("Descreva o gatilho (mín. 5 caracteres).");
      const { error } = await (supabase.from as any)("pgr_gatilhos_revisao").insert({
        pgr_id: pgrId, empresa_id: pgr.empresa_id,
        tipo: form.tipo, descricao: form.descricao.trim(),
        data_ocorrencia: form.data_ocorrencia,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gatilho registrado");
      qc.invalidateQueries({ queryKey: ["pgr-gatilhos", pgrId] });
      setForm(novoGatilho); setAbrirNovo(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resolver = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      // Espelha o CHECK do banco: dispensar um gatilho normativo sem justificativa
      // é exatamente o que a fiscalização questiona.
      if (status === "dispensado" && justificativa.trim().length < 10) {
        throw new Error("Dispensar exige justificativa de no mínimo 10 caracteres.");
      }
      const { error } = await (supabase.from as any)("pgr_gatilhos_revisao").update({
        status,
        tratado_em: new Date().toISOString().slice(0, 10),
        justificativa_dispensa: status === "dispensado" ? justificativa.trim() : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gatilho atualizado");
      qc.invalidateQueries({ queryKey: ["pgr-gatilhos", pgrId] });
      setTratando(null); setJustificativa("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusAtual = pgr.status as PgrStatus;
  const idxFluxo = PGR_FLUXO.indexOf(statusAtual);

  if (isLoading) {
    return (
      <Card><CardContent className="p-8 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando governança…
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Fluxo de aprovação</CardTitle>
          <CardDescription>
            O PGR é um programa contínuo. Os prazos abaixo são de revisão da avaliação,
            não de validade do documento.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-1">
          {PGR_FLUXO.map((s, i) => (
            <span key={s} className="flex items-center gap-1">
              <Badge
                variant="outline"
                className={s === statusAtual
                  ? PGR_STATUS_COLOR[s]
                  : i < idxFluxo
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-muted text-muted-foreground"}
              >
                {i < idxFluxo && <CheckCircle2 className="h-3 w-3 mr-1" />}
                {PGR_STATUS_LABEL[s]}
              </Badge>
              {i < PGR_FLUXO.length - 1 && <span className="text-muted-foreground text-xs">→</span>}
            </span>
          ))}
          {!PGR_FLUXO.includes(statusAtual) && (
            <Badge variant="outline" className={PGR_STATUS_COLOR[statusAtual]}>
              {PGR_STATUS_LABEL[statusAtual]}
            </Badge>
          )}
        </CardContent>
      </Card>

      {abertos.length > 0 && (
        <div className="flex items-start gap-2 text-sm border rounded p-3 bg-red-50 text-red-900">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            <b>{abertos.length} gatilho(s) de revisão em aberto.</b> Enquanto houver gatilho
            pendente, a avaliação de riscos precisa ser revista — trate ou dispense com
            justificativa antes de emitir.
          </span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span>Gatilhos de revisão</span>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setAbrirNovo(true)}>
                <Plus className="h-4 w-4 mr-1" /> Registrar gatilho
              </Button>
            )}
          </CardTitle>
          <CardDescription>
            Eventos que obrigam revisar a avaliação de riscos (NR-01 1.5.4.4.5). Concluir uma
            ação gera automaticamente o gatilho de reavaliação do risco residual.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Ocorrência</TableHead>
                <TableHead>Situação</TableHead>
                {canEdit && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {gatilhos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 5 : 4} className="text-center py-8 text-muted-foreground">
                    Nenhum gatilho registrado.
                  </TableCell>
                </TableRow>
              ) : gatilhos.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="text-xs max-w-[200px]">{GATILHO_LABEL[g.tipo] || g.tipo}</TableCell>
                  <TableCell className="text-sm max-w-[280px]">
                    {g.descricao}
                    {g.justificativa_dispensa && (
                      <span className="block text-[11px] text-muted-foreground italic mt-0.5">
                        Dispensa: {g.justificativa_dispensa}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {g.data_ocorrencia?.split("-").reverse().join("/")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`${GAT_STATUS_COR[g.status]} text-[11px]`}>
                      {GAT_STATUS_LABEL[g.status]}
                    </Badge>
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right whitespace-nowrap">
                      {["aberto", "em_tratamento"].includes(g.status) && (
                        <>
                          <Button variant="ghost" size="sm"
                            onClick={() => resolver.mutate({ id: g.id, status: "tratado" })}>
                            Tratar
                          </Button>
                          <Button variant="ghost" size="sm"
                            onClick={() => { setTratando(g); setJustificativa(""); }}>
                            Dispensar
                          </Button>
                        </>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Trilha de aprovações</CardTitle>
          <CardDescription>Registro append-only das decisões do fluxo.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Etapa</TableHead>
                <TableHead>Decisão</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Comentário</TableHead>
                <TableHead>Quando</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aprovacoes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    Nenhuma decisão registrada.
                  </TableCell>
                </TableRow>
              ) : aprovacoes.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs">{a.etapa}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      a.decisao === "aprovado" ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                      : a.decisao === "reprovado" ? "bg-red-100 text-red-800 border-red-300"
                      : "bg-amber-100 text-amber-800 border-amber-300"}>
                      {a.decisao}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{a.responsavel_nome || a.user_email || "—"}</TableCell>
                  <TableCell className="text-xs max-w-[240px]">{a.comentario || "—"}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(a.decidido_em).toLocaleString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={abrirNovo} onOpenChange={setAbrirNovo}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar gatilho de revisão</DialogTitle>
            <DialogDescription>
              Registrar o evento é o que permite demonstrar depois que ele foi tratado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <Label className="text-xs">Tipo *</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(GATILHO_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Data da ocorrência *</Label>
              <Input type="date" value={form.data_ocorrencia}
                onChange={(e) => setForm({ ...form, data_ocorrencia: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Descrição *</Label>
              <Textarea rows={3} value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="O que ocorreu e por que exige revisar a avaliação de riscos" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbrirNovo(false)}>Cancelar</Button>
            <Button onClick={() => criar.mutate()} disabled={criar.isPending}>
              {criar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tratando} onOpenChange={(o) => !o && setTratando(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dispensar gatilho</DialogTitle>
            <DialogDescription>
              Dispensar um gatilho normativo sem justificativa é exatamente o que a
              fiscalização questiona. Explique por que a revisão não é necessária.
            </DialogDescription>
          </DialogHeader>
          <Textarea rows={4} value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Justificativa técnica (mín. 10 caracteres)" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTratando(null)}>Cancelar</Button>
            <Button
              onClick={() => resolver.mutate({ id: tratando.id, status: "dispensado" })}
              disabled={resolver.isPending}
            >
              Dispensar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
