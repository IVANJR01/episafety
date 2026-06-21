import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { isPppEditavel, PppDocumento } from "@/lib/pppTypes";

interface Props { ppp: PppDocumento; }

const CONCLUSAO_OPTS = [
  { v: "nao_especial", l: "Não especial" },
  { v: "especial_15", l: "Especial — 15 anos" },
  { v: "especial_20", l: "Especial — 20 anos" },
  { v: "especial_25", l: "Especial — 25 anos" },
  { v: "inconclusivo", l: "Inconclusivo" },
];

const GRUPO_OPTS = [
  { v: "fisico", l: "Físico" },
  { v: "quimico", l: "Químico" },
  { v: "biologico", l: "Biológico" },
  { v: "ergonomico", l: "Ergonômico" },
  { v: "acidente", l: "Acidente" },
];

interface Exposicao {
  id: string;
  ppp_id: string;
  periodo_id: string;
  empresa_id: string;
  agente_id: string | null;
  agente_nome: string;
  agente_grupo: string | null;
  codigo_esocial: string | null;
  fonte_geradora: string | null;
  intensidade: number | null;
  unidade_medida: string | null;
  limite_tolerancia: number | null;
  acima_limite: boolean | null;
  tecnica_avaliacao: string | null;
  data_medicao: string | null;
  tipo_exposicao: string | null;
  frequencia: string | null;
  duracao: string | null;
  tempo_exposicao_horas: number | null;
  percentual_jornada: number | null;
  epi_descricao: string | null;
  epi_ca: string | null;
  epi_eficacia: string | null;
  epc_descricao: string | null;
  epc_eficacia: string | null;
  ltcat_id: string | null;
  origem_ltcat_aval_id: string | null;
  conclusao_ltcat_id: string | null;
  conclusao_previdenciaria: string | null;
  fundamento_legal: string | null;
  justificativa: string | null;
  observacoes: string | null;
}

const empty = (ppp: PppDocumento): Exposicao => ({
  id: "", ppp_id: ppp.id, periodo_id: "", empresa_id: ppp.empresa_id,
  agente_id: null, agente_nome: "", agente_grupo: null, codigo_esocial: null,
  fonte_geradora: null, intensidade: null, unidade_medida: null,
  limite_tolerancia: null, acima_limite: null, tecnica_avaliacao: null,
  data_medicao: null, tipo_exposicao: null, frequencia: null, duracao: null,
  tempo_exposicao_horas: null, percentual_jornada: null,
  epi_descricao: null, epi_ca: null, epi_eficacia: null,
  epc_descricao: null, epc_eficacia: null,
  ltcat_id: null, origem_ltcat_aval_id: null, conclusao_ltcat_id: null,
  conclusao_previdenciaria: null, fundamento_legal: null, justificativa: null,
  observacoes: null,
});

export default function PppExposicoesTab({ ppp }: Props) {
  const { user } = useAuth();
  const perms = usePermissions("ppp");
  const qc = useQueryClient();
  const editavel = isPppEditavel(ppp.status) && perms.canEdit;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Exposicao>(empty(ppp));
  const [saving, setSaving] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { data: periodos = [] } = useQuery({
    queryKey: ["ppp-periodos", ppp.id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ppp_periodos")
        .select("id, data_inicio, data_fim, funcao_nome, ltcat_id").eq("ppp_id", ppp.id)
        .order("data_inicio");
      return data || [];
    },
  });

  const { data: exposicoes = [] } = useQuery({
    queryKey: ["ppp-exposicoes", ppp.id],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("ppp_exposicoes")
        .select("*").eq("ppp_id", ppp.id).order("created_at");
      if (error) throw error;
      return (data || []) as Exposicao[];
    },
  });

  function openNovo() {
    if ((periodos as any[]).length === 0) {
      toast.error("Cadastre um período laboral antes de registrar exposições.");
      return;
    }
    setForm({ ...empty(ppp), periodo_id: (periodos as any[])[0].id });
    setOpen(true);
  }

  function openEditar(e: Exposicao) {
    setForm({ ...e });
    setOpen(true);
  }

  function validarAlertas(): string[] {
    const a: string[] = [];
    if (form.intensidade != null && form.limite_tolerancia != null
        && form.intensidade > form.limite_tolerancia) {
      a.push("Intensidade acima do limite de tolerância.");
    }
    if (form.conclusao_previdenciaria?.startsWith("especial_") && !form.fundamento_legal) {
      a.push("Conclusão especial exige fundamento legal.");
    }
    if (form.conclusao_previdenciaria === "nao_especial" && form.acima_limite && !form.justificativa) {
      a.push("Conclusão 'não especial' com agente acima do limite exige justificativa.");
    }
    if (form.conclusao_previdenciaria === "inconclusivo" && !form.justificativa) {
      a.push("Conclusão 'inconclusivo' exige justificativa.");
    }
    return a;
  }

  async function salvar() {
    if (!form.periodo_id) { toast.error("Vincule a exposição a um período laboral."); return; }
    if (!form.agente_nome) { toast.error("Informe o agente nocivo."); return; }

    const alertas = validarAlertas();
    const bloqueantes = alertas.filter((m) =>
      m.includes("fundamento legal") || m.includes("justificativa"));
    if (bloqueantes.length) { bloqueantes.forEach((m) => toast.error(m)); return; }
    alertas.forEach((m) => toast.warning(m));

    setSaving(true);
    try {
      const payload: any = {
        ppp_id: ppp.id,
        periodo_id: form.periodo_id,
        empresa_id: ppp.empresa_id,
        agente_id: form.agente_id || null,
        agente_nome: form.agente_nome,
        agente_grupo: form.agente_grupo || null,
        codigo_esocial: form.codigo_esocial || null,
        fonte_geradora: form.fonte_geradora || null,
        intensidade: form.intensidade,
        unidade_medida: form.unidade_medida || null,
        limite_tolerancia: form.limite_tolerancia,
        acima_limite: form.intensidade != null && form.limite_tolerancia != null
          ? form.intensidade > form.limite_tolerancia : form.acima_limite,
        tecnica_avaliacao: form.tecnica_avaliacao || null,
        data_medicao: form.data_medicao || null,
        tipo_exposicao: form.tipo_exposicao || null,
        frequencia: form.frequencia || null,
        duracao: form.duracao || null,
        tempo_exposicao_horas: form.tempo_exposicao_horas,
        percentual_jornada: form.percentual_jornada,
        epi_descricao: form.epi_descricao || null,
        epi_ca: form.epi_ca || null,
        epi_eficacia: form.epi_eficacia || null,
        epc_descricao: form.epc_descricao || null,
        epc_eficacia: form.epc_eficacia || null,
        ltcat_id: form.ltcat_id || null,
        origem_ltcat_aval_id: form.origem_ltcat_aval_id || null,
        conclusao_ltcat_id: form.conclusao_ltcat_id || null,
        conclusao_previdenciaria: form.conclusao_previdenciaria || null,
        fundamento_legal: form.fundamento_legal || null,
        justificativa: form.justificativa || null,
        observacoes: form.observacoes || null,
      };

      let error: any = null;
      if (form.id) {
        ({ error } = await (supabase.from as any)("ppp_exposicoes").update(payload).eq("id", form.id));
      } else {
        ({ error } = await (supabase.from as any)("ppp_exposicoes").insert(payload));
      }
      if (error) {
        if (String(error.message || "").includes("ppp_exposicoes_dedup_idx")) {
          throw new Error("Já existe exposição com mesmo agente, LTCAT, data de medição e técnica neste período.");
        }
        throw error;
      }

      await (supabase.from as any)("ppp_revisoes").insert({
        ppp_id: ppp.id, empresa_id: ppp.empresa_id,
        acao: form.id ? "exposicao_atualizada" : "exposicao_criada",
        descricao: `Exposição: ${form.agente_nome}`,
        created_by: user?.id || null,
      });

      toast.success("Exposição salva.");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["ppp-exposicoes", ppp.id] });
      qc.invalidateQueries({ queryKey: ["ppp-revisoes", ppp.id] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar exposição.");
    } finally {
      setSaving(false);
    }
  }

  async function excluir() {
    if (!delId) return;
    try {
      const { error } = await (supabase.from as any)("ppp_exposicoes").delete().eq("id", delId);
      if (error) throw error;
      await (supabase.from as any)("ppp_revisoes").insert({
        ppp_id: ppp.id, empresa_id: ppp.empresa_id,
        acao: "exposicao_excluida",
        descricao: `Exposição removida (id ${delId.substring(0, 8)})`,
        created_by: user?.id || null,
      });
      toast.success("Exposição excluída.");
      setDelId(null);
      qc.invalidateQueries({ queryKey: ["ppp-exposicoes", ppp.id] });
      qc.invalidateQueries({ queryKey: ["ppp-revisoes", ppp.id] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Exposições a agentes nocivos</CardTitle>
        <div className="flex gap-2">
          {editavel && (
            <>
              <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                <Download className="h-4 w-4 mr-1" /> Importar do LTCAT
              </Button>
              <Button size="sm" onClick={openNovo}>
                <Plus className="h-4 w-4 mr-1" /> Nova exposição
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!editavel && (
          <div className="mb-3 text-xs text-muted-foreground">
            PPP {ppp.status} — somente leitura.
          </div>
        )}
        {(exposicoes as Exposicao[]).length === 0 ? (
          <div className="text-sm text-muted-foreground p-6 text-center">
            Nenhuma exposição cadastrada.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agente</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Intensidade / LT</TableHead>
                <TableHead>Conclusão</TableHead>
                <TableHead>LTCAT</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(exposicoes as Exposicao[]).map((e) => {
                const per = (periodos as any[]).find((p) => p.id === e.periodo_id);
                const acima = e.intensidade != null && e.limite_tolerancia != null
                  && e.intensidade > e.limite_tolerancia;
                return (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">
                      <div className="font-medium">{e.agente_nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {e.agente_grupo || "—"} {e.codigo_esocial ? `· ${e.codigo_esocial}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {per ? `${per.data_inicio} → ${per.data_fim || "atual"}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.intensidade != null ? `${e.intensidade} ${e.unidade_medida || ""}` : "—"}
                      {e.limite_tolerancia != null && (
                        <div className="text-xs text-muted-foreground">LT: {e.limite_tolerancia}</div>
                      )}
                      {acima && (
                        <Badge variant="outline" className="mt-1 bg-amber-100 text-amber-700 border-amber-300">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Acima do LT
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {CONCLUSAO_OPTS.find((o) => o.v === e.conclusao_previdenciaria)?.l || "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {e.ltcat_id ? <Badge variant="outline">vinculado</Badge> : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {editavel && (
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" onClick={() => openEditar(e)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDelId(e.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <div className="mt-3 text-xs text-muted-foreground">
          Campos preparados para futura geração do evento S-2240 (código eSocial, técnica, unidade,
          intensidade, EPI/EPC, vínculo com LTCAT). Nenhum XML é gerado nesta fase.
        </div>
      </CardContent>

      <ExposicaoDialog
        open={open} onOpenChange={setOpen}
        form={form} setForm={setForm}
        periodos={periodos as any[]} saving={saving} onSave={salvar} ppp={ppp}
      />

      <ImportLtcatDialog
        open={importOpen} onOpenChange={setImportOpen} ppp={ppp}
        periodos={periodos as any[]} jaExistentes={exposicoes as Exposicao[]}
        onImported={() => {
          qc.invalidateQueries({ queryKey: ["ppp-exposicoes", ppp.id] });
          qc.invalidateQueries({ queryKey: ["ppp-revisoes", ppp.id] });
        }}
      />

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir exposição?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluir} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
function ExposicaoDialog({
  open, onOpenChange, form, setForm, periodos, saving, onSave, ppp,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  form: Exposicao; setForm: (f: Exposicao | ((s: Exposicao) => Exposicao)) => void;
  periodos: any[]; saving: boolean; onSave: () => void; ppp: PppDocumento;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{form.id ? "Editar exposição" : "Nova exposição"}</DialogTitle></DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-3">
            <Label>Período laboral *</Label>
            <Select value={form.periodo_id} onValueChange={(v) => setForm((s) => ({ ...s, periodo_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {periodos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.data_inicio} → {p.data_fim || "atual"} · {p.funcao_nome || "—"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label>Agente nocivo *</Label>
            <Input value={form.agente_nome}
              onChange={(e) => setForm((s) => ({ ...s, agente_nome: e.target.value }))} />
          </div>
          <div>
            <Label>Grupo</Label>
            <Select value={form.agente_grupo || "__none"} onValueChange={(v) =>
              setForm((s) => ({ ...s, agente_grupo: v === "__none" ? null : v }))}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                {GRUPO_OPTS.map((g) => <SelectItem key={g.v} value={g.v}>{g.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Código eSocial (S-2240)</Label>
            <Input value={form.codigo_esocial || ""}
              onChange={(e) => setForm((s) => ({ ...s, codigo_esocial: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <Label>Fonte geradora</Label>
            <Input value={form.fonte_geradora || ""}
              onChange={(e) => setForm((s) => ({ ...s, fonte_geradora: e.target.value }))} />
          </div>

          <div>
            <Label>Intensidade / concentração</Label>
            <Input type="number" step="any" value={form.intensidade ?? ""}
              onChange={(e) => setForm((s) => ({ ...s, intensidade: e.target.value === "" ? null : Number(e.target.value) }))} />
          </div>
          <div>
            <Label>Unidade</Label>
            <Input value={form.unidade_medida || ""}
              onChange={(e) => setForm((s) => ({ ...s, unidade_medida: e.target.value }))} />
          </div>
          <div>
            <Label>Limite de tolerância</Label>
            <Input type="number" step="any" value={form.limite_tolerancia ?? ""}
              onChange={(e) => setForm((s) => ({ ...s, limite_tolerancia: e.target.value === "" ? null : Number(e.target.value) }))} />
          </div>

          <div>
            <Label>Técnica de avaliação</Label>
            <Input value={form.tecnica_avaliacao || ""} placeholder="qualitativa / quantitativa"
              onChange={(e) => setForm((s) => ({ ...s, tecnica_avaliacao: e.target.value }))} />
          </div>
          <div>
            <Label>Data da medição</Label>
            <Input type="date" value={form.data_medicao || ""}
              onChange={(e) => setForm((s) => ({ ...s, data_medicao: e.target.value || null }))} />
          </div>
          <div>
            <Label>Tipo de exposição</Label>
            <Input value={form.tipo_exposicao || ""}
              placeholder="habitual e permanente / intermitente / eventual"
              onChange={(e) => setForm((s) => ({ ...s, tipo_exposicao: e.target.value }))} />
          </div>

          <div>
            <Label>Frequência</Label>
            <Input value={form.frequencia || ""}
              onChange={(e) => setForm((s) => ({ ...s, frequencia: e.target.value }))} />
          </div>
          <div>
            <Label>Duração</Label>
            <Input value={form.duracao || ""}
              onChange={(e) => setForm((s) => ({ ...s, duracao: e.target.value }))} />
          </div>
          <div>
            <Label>% da jornada</Label>
            <Input type="number" step="any" value={form.percentual_jornada ?? ""}
              onChange={(e) => setForm((s) => ({ ...s, percentual_jornada: e.target.value === "" ? null : Number(e.target.value) }))} />
          </div>

          <div className="md:col-span-2">
            <Label>EPI — descrição</Label>
            <Input value={form.epi_descricao || ""}
              onChange={(e) => setForm((s) => ({ ...s, epi_descricao: e.target.value }))} />
          </div>
          <div>
            <Label>EPI — CA</Label>
            <Input value={form.epi_ca || ""}
              onChange={(e) => setForm((s) => ({ ...s, epi_ca: e.target.value }))} />
          </div>

          <div>
            <Label>EPI eficácia</Label>
            <Select value={form.epi_eficacia || "__none"} onValueChange={(v) =>
              setForm((s) => ({ ...s, epi_eficacia: v === "__none" ? null : v }))}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                <SelectItem value="sim">Sim</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>EPC — descrição</Label>
            <Input value={form.epc_descricao || ""}
              onChange={(e) => setForm((s) => ({ ...s, epc_descricao: e.target.value }))} />
          </div>

          <div>
            <Label>EPC eficácia</Label>
            <Input value={form.epc_eficacia || ""}
              onChange={(e) => setForm((s) => ({ ...s, epc_eficacia: e.target.value }))} />
          </div>

          <div className="md:col-span-2">
            <Label>Conclusão previdenciária</Label>
            <Select value={form.conclusao_previdenciaria || "__none"} onValueChange={(v) =>
              setForm((s) => ({ ...s, conclusao_previdenciaria: v === "__none" ? null : v }))}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                {CONCLUSAO_OPTS.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-3">
            <Label>Fundamento legal (obrigatório para conclusão especial)</Label>
            <Input value={form.fundamento_legal || ""}
              placeholder="Ex.: Decreto 3.048/99, Anexo IV, item 2.0.1"
              onChange={(e) => setForm((s) => ({ ...s, fundamento_legal: e.target.value }))} />
          </div>

          <div className="md:col-span-3">
            <Label>Justificativa</Label>
            <Textarea rows={2} value={form.justificativa || ""}
              onChange={(e) => setForm((s) => ({ ...s, justificativa: e.target.value }))} />
          </div>

          <div className="md:col-span-3">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.observacoes || ""}
              onChange={(e) => setForm((s) => ({ ...s, observacoes: e.target.value }))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Salvando…" : "Salvar exposição"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
function ImportLtcatDialog({
  open, onOpenChange, ppp, periodos, jaExistentes, onImported,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  ppp: PppDocumento; periodos: any[]; jaExistentes: any[];
  onImported: () => void;
}) {
  const { user } = useAuth();
  const [periodoId, setPeriodoId] = useState<string>("");
  const [ltcatId, setLtcatId] = useState<string>("");
  const [selecionadas, setSelecionadas] = useState<Record<string, boolean>>({});
  const [importing, setImporting] = useState(false);

  const { data: ltcats = [] } = useQuery({
    queryKey: ["ppp-import-ltcats", ppp.empresa_id, periodos.map((p) => p.ltcat_id).join(",")],
    queryFn: async () => {
      const vinc = periodos.map((p) => p.ltcat_id).filter(Boolean);
      const { data: vig } = await (supabase.from as any)("ltcat_documentos")
        .select("id, versao, status, data_emissao")
        .eq("empresa_id", ppp.empresa_id)
        .in("status", ["vigente"]).order("data_emissao", { ascending: false });
      let extras: any[] = [];
      if (vinc.length) {
        const ids = (vig || []).map((x: any) => x.id);
        const faltam = vinc.filter((id) => !ids.includes(id));
        if (faltam.length) {
          const { data: ex } = await (supabase.from as any)("ltcat_documentos")
            .select("id, versao, status, data_emissao")
            .eq("empresa_id", ppp.empresa_id).in("id", faltam);
          extras = ex || [];
        }
      }
      return [...(vig || []), ...extras];
    },
    enabled: open,
  });

  const { data: avaliacoes = [] } = useQuery({
    queryKey: ["ppp-import-avals", ltcatId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ltcat_avaliacoes")
        .select("id, ltcat_id, agente_id, tecnica, intensidade, unidade_medida, limite_tolerancia, data_medicao, enquadramento, epi_descricao, epi_eficacia, epi_ca, epc_descricao, observacoes")
        .eq("ltcat_id", ltcatId).eq("empresa_id", ppp.empresa_id);
      const aids = Array.from(new Set((data || []).map((a: any) => a.agente_id))).filter(Boolean);
      let agentes: any[] = [];
      if (aids.length) {
        const { data: ags } = await (supabase.from as any)("ltcat_agentes")
          .select("id, nome, grupo, codigo_esocial, fonte_geradora, tipo_exposicao, frequencia, duracao")
          .in("id", aids);
        agentes = ags || [];
      }
      return (data || []).map((a: any) => ({ ...a, agente: agentes.find((g) => g.id === a.agente_id) }));
    },
    enabled: !!ltcatId,
  });

  const { data: conclusoes = [] } = useQuery({
    queryKey: ["ppp-import-concls", ltcatId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ltcat_conclusoes")
        .select("*").eq("ltcat_id", ltcatId).eq("empresa_id", ppp.empresa_id);
      return data || [];
    },
    enabled: !!ltcatId,
  });

  function jaImportada(a: any): boolean {
    return (jaExistentes as any[]).some((e) =>
      e.periodo_id === periodoId &&
      e.ltcat_id === ltcatId &&
      e.origem_ltcat_aval_id === a.id);
  }

  async function importar() {
    if (!periodoId) { toast.error("Selecione o período laboral de destino."); return; }
    if (!ltcatId) { toast.error("Selecione o LTCAT."); return; }
    const ids = Object.keys(selecionadas).filter((k) => selecionadas[k]);
    if (!ids.length) { toast.error("Selecione ao menos uma avaliação."); return; }

    setImporting(true);
    let ok = 0, dup = 0, err = 0;
    try {
      for (const aid of ids) {
        const a = (avaliacoes as any[]).find((x) => x.id === aid);
        if (!a) continue;
        const conc = (conclusoes as any[]).find((c: any) =>
          c.agente_id === a.agente_id || c.grupo_homogeneo_id === a.grupo_homogeneo_id);
        const acima = a.intensidade != null && a.limite_tolerancia != null
          && Number(a.intensidade) > Number(a.limite_tolerancia);

        const payload: any = {
          ppp_id: ppp.id, periodo_id: periodoId, empresa_id: ppp.empresa_id,
          agente_id: a.agente_id,
          agente_nome: a.agente?.nome || "Agente",
          agente_grupo: a.agente?.grupo || null,
          codigo_esocial: a.agente?.codigo_esocial || null,
          fonte_geradora: a.agente?.fonte_geradora || null,
          intensidade: a.intensidade ?? null,
          unidade_medida: a.unidade_medida || null,
          limite_tolerancia: a.limite_tolerancia ?? null,
          acima_limite: acima,
          tecnica_avaliacao: a.tecnica || null,
          data_medicao: a.data_medicao || null,
          tipo_exposicao: a.agente?.tipo_exposicao || null,
          frequencia: a.agente?.frequencia || null,
          duracao: a.agente?.duracao || null,
          epi_descricao: a.epi_descricao || null,
          epi_ca: a.epi_ca || null,
          epi_eficacia: a.epi_eficacia || null,
          epc_descricao: a.epc_descricao || null,
          ltcat_id: ltcatId,
          origem_ltcat_aval_id: a.id,
          conclusao_ltcat_id: conc?.id || null,
          conclusao_previdenciaria: null,
          observacoes: a.observacoes || null,
        };

        const { error } = await (supabase.from as any)("ppp_exposicoes").insert(payload);
        if (error) {
          if (String(error.message || "").includes("ppp_exposicoes_dedup_idx")) dup++;
          else err++;
        } else ok++;
      }

      if (ok) {
        await (supabase.from as any)("ppp_revisoes").insert({
          ppp_id: ppp.id, empresa_id: ppp.empresa_id,
          acao: "exposicoes_importadas_ltcat",
          descricao: `${ok} exposições importadas do LTCAT (${dup} duplicadas, ${err} erros).`,
          created_by: user?.id || null,
        });
      }

      toast.success(`Importadas ${ok}. Duplicadas ignoradas: ${dup}. Erros: ${err}.`);
      onImported();
      onOpenChange(false);
      setSelecionadas({});
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Importar exposições do LTCAT</DialogTitle></DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Período laboral de destino *</Label>
            <Select value={periodoId} onValueChange={setPeriodoId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {periodos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.data_inicio} → {p.data_fim || "atual"} · {p.funcao_nome || "—"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>LTCAT *</Label>
            <Select value={ltcatId} onValueChange={(v) => { setLtcatId(v); setSelecionadas({}); }}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {(ltcats as any[]).map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    v{l.versao} ({l.status}) {l.data_emissao || ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {ltcatId && (
          <div className="mt-4">
            <div className="text-sm font-medium mb-2">Avaliações disponíveis</div>
            {(avaliacoes as any[]).length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhuma avaliação encontrada neste LTCAT.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Agente</TableHead>
                    <TableHead>Técnica</TableHead>
                    <TableHead>Intensidade / LT</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(avaliacoes as any[]).map((a) => {
                    const dup = jaImportada(a);
                    return (
                      <TableRow key={a.id} className={dup ? "opacity-50" : ""}>
                        <TableCell>
                          <Checkbox
                            disabled={dup}
                            checked={!!selecionadas[a.id]}
                            onCheckedChange={(c) => setSelecionadas((s) => ({ ...s, [a.id]: !!c }))}
                          />
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{a.agente?.nome || "—"}</div>
                          <div className="text-xs text-muted-foreground">{a.agente?.codigo_esocial || ""}</div>
                        </TableCell>
                        <TableCell className="text-xs">{a.tecnica || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {a.intensidade != null ? `${a.intensidade} ${a.unidade_medida || ""}` : "—"}
                          {a.limite_tolerancia != null && <div className="text-muted-foreground">LT: {a.limite_tolerancia}</div>}
                        </TableCell>
                        <TableCell className="text-xs">{a.data_medicao || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {dup ? <Badge variant="outline">Já importada</Badge> : <Badge variant="outline">Disponível</Badge>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>Cancelar</Button>
          <Button onClick={importar} disabled={importing || !ltcatId || !periodoId}>
            {importing ? "Importando…" : "Importar selecionadas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
