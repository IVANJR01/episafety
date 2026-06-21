import { useEffect, useMemo, useState } from "react";
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
import { Plus, Pencil, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { isPppEditavel, PppDocumento } from "@/lib/pppTypes";

interface Periodo {
  id: string;
  ppp_id: string;
  empresa_id: string;
  ordem: number;
  data_inicio: string;
  data_fim: string | null;
  motivo_encerramento: string | null;
  funcao_id: string | null;
  funcao_nome: string | null;
  cbo: string | null;
  setor_id: string | null;
  setor_nome: string | null;
  ghe_id: string | null;
  ghe_codigo: string | null;
  ghe_descricao: string | null;
  ltcat_id: string | null;
  pgr_id: string | null;
  descricao_atividade: string | null;
  observacoes: string | null;
}

interface Props {
  ppp: PppDocumento;
  funcionario: any | null;
}

const empty = (pppId: string, empresaId: string): Periodo => ({
  id: "",
  ppp_id: pppId,
  empresa_id: empresaId,
  ordem: 0,
  data_inicio: "",
  data_fim: null,
  motivo_encerramento: null,
  funcao_id: null,
  funcao_nome: null,
  cbo: null,
  setor_id: null,
  setor_nome: null,
  ghe_id: null,
  ghe_codigo: null,
  ghe_descricao: null,
  ltcat_id: null,
  pgr_id: null,
  descricao_atividade: null,
  observacoes: null,
});

export default function PppHistoricoTab({ ppp, funcionario }: Props) {
  const { user } = useAuth();
  const perms = usePermissions("ppp");
  const qc = useQueryClient();
  const editavel = isPppEditavel(ppp.status) && perms.canEdit;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Periodo>(empty(ppp.id, ppp.empresa_id));
  const [saving, setSaving] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);

  const { data: periodos = [], refetch } = useQuery({
    queryKey: ["ppp-periodos", ppp.id],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("ppp_periodos")
        .select("*").eq("ppp_id", ppp.id).order("data_inicio", { ascending: true });
      if (error) throw error;
      return (data || []) as Periodo[];
    },
  });

  const { data: ghes = [] } = useQuery({
    queryKey: ["ppp-ghes", ppp.empresa_id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ghe_ges")
        .select("id, codigo, nome, setor").eq("empresa_id", ppp.empresa_id).order("codigo");
      return data || [];
    },
  });

  const { data: funcoes = [] } = useQuery({
    queryKey: ["ppp-funcoes", ppp.empresa_id, form.ghe_id],
    queryFn: async () => {
      let q = (supabase.from as any)("ghe_funcoes")
        .select("id, nome_funcao, cbo, descricao_atividade, ghe_id")
        .eq("empresa_id", ppp.empresa_id);
      if (form.ghe_id) q = q.eq("ghe_id", form.ghe_id);
      const { data } = await q.order("nome_funcao");
      return data || [];
    },
  });

  const { data: ltcats = [] } = useQuery({
    queryKey: ["ppp-ltcats", ppp.empresa_id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("ltcat_documentos")
        .select("id, versao, status, data_emissao").eq("empresa_id", ppp.empresa_id)
        .order("data_emissao", { ascending: false });
      return data || [];
    },
  });

  const { data: pgrs = [] } = useQuery({
    queryKey: ["ppp-pgrs", ppp.empresa_id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_documentos")
        .select("id, versao, status, data_emissao").eq("empresa_id", ppp.empresa_id)
        .order("data_emissao", { ascending: false });
      return data || [];
    },
  });

  const periodoAtual = useMemo(
    () => (periodos as Periodo[]).find((p) => !p.data_fim) || null,
    [periodos],
  );

  function openNovo() {
    const nextOrdem = (periodos as Periodo[]).reduce((m, p) => Math.max(m, p.ordem), 0) + 1;
    setForm({ ...empty(ppp.id, ppp.empresa_id), ordem: nextOrdem });
    setOpen(true);
  }

  function openEditar(p: Periodo) {
    setForm({ ...p });
    setOpen(true);
  }

  function importarFuncionario() {
    if (!funcionario) {
      toast.error("Funcionário não carregado.");
      return;
    }
    if (periodoAtual) {
      toast.error("Já existe um período em aberto. Encerre-o antes de importar.");
      return;
    }
    const ghe = (ghes as any[]).find((g) => g.id === funcionario.ghe_id) || null;
    const nextOrdem = (periodos as Periodo[]).reduce((m, p) => Math.max(m, p.ordem), 0) + 1;
    setForm({
      ...empty(ppp.id, ppp.empresa_id),
      ordem: nextOrdem,
      data_inicio: funcionario.data_admissao || "",
      data_fim: null,
      funcao_nome: funcionario.cargo || null,
      setor_nome: funcionario.setor || null,
      ghe_id: ghe?.id || null,
      ghe_codigo: ghe?.codigo || null,
      ghe_descricao: ghe?.nome || null,
      observacoes: "Importado do cadastro do funcionário (revisar antes de salvar).",
    });
    setOpen(true);
  }

  async function salvar() {
    // validações
    if (!form.data_inicio) {
      toast.error("Data de início é obrigatória.");
      return;
    }
    if (!form.funcao_nome && !form.funcao_id) {
      toast.error("Função é obrigatória.");
      return;
    }
    if (form.data_fim && form.data_fim < form.data_inicio) {
      toast.error("Data de fim não pode ser anterior à data de início.");
      return;
    }
    if (!form.setor_nome && !form.ghe_id) {
      toast.warning("Recomendado informar setor ou GHE/GES.");
    }
    if (form.funcao_nome && !form.cbo) {
      toast.warning("Recomendado informar o CBO da função.");
    }
    if (!form.descricao_atividade) {
      toast.warning("Recomendado descrever a atividade.");
    }

    setSaving(true);
    try {
      const payload: any = {
        ppp_id: ppp.id,
        empresa_id: ppp.empresa_id,
        ordem: form.ordem || 1,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim || null,
        motivo_encerramento: form.motivo_encerramento || null,
        funcao_id: form.funcao_id || null,
        funcao_nome: form.funcao_nome || null,
        cbo: form.cbo || null,
        setor_id: form.setor_id || null,
        setor_nome: form.setor_nome || null,
        ghe_id: form.ghe_id || null,
        ghe_codigo: form.ghe_codigo || null,
        ghe_descricao: form.ghe_descricao || null,
        ltcat_id: form.ltcat_id || null,
        pgr_id: form.pgr_id || null,
        descricao_atividade: form.descricao_atividade || null,
        observacoes: form.observacoes || null,
      };
      let error: any = null;
      if (form.id) {
        ({ error } = await (supabase.from as any)("ppp_periodos").update(payload).eq("id", form.id));
      } else {
        ({ error } = await (supabase.from as any)("ppp_periodos").insert(payload));
      }
      if (error) throw error;

      await (supabase.from as any)("ppp_revisoes").insert({
        ppp_id: ppp.id,
        empresa_id: ppp.empresa_id,
        acao: form.id ? "periodo_atualizado" : "periodo_criado",
        descricao: `Período ${form.data_inicio} → ${form.data_fim || "atual"} (${form.funcao_nome || "—"})`,
        created_by: user?.id || null,
      });

      toast.success("Período salvo.");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["ppp-periodos", ppp.id] });
      qc.invalidateQueries({ queryKey: ["ppp-revisoes", ppp.id] });
      refetch();
    } catch (e: any) {
      const msg = e?.message || "Erro ao salvar período.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function excluir() {
    if (!delId) return;
    try {
      const { error } = await (supabase.from as any)("ppp_periodos").delete().eq("id", delId);
      if (error) throw error;
      await (supabase.from as any)("ppp_revisoes").insert({
        ppp_id: ppp.id,
        empresa_id: ppp.empresa_id,
        acao: "periodo_excluido",
        descricao: `Período removido (id ${delId.substring(0, 8)})`,
        created_by: user?.id || null,
      });
      toast.success("Período excluído.");
      setDelId(null);
      qc.invalidateQueries({ queryKey: ["ppp-periodos", ppp.id] });
      qc.invalidateQueries({ queryKey: ["ppp-revisoes", ppp.id] });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao excluir.");
    }
  }

  function aplicarFuncao(funcId: string) {
    const f = (funcoes as any[]).find((x) => x.id === funcId);
    if (!f) {
      setForm((s) => ({ ...s, funcao_id: null }));
      return;
    }
    setForm((s) => ({
      ...s,
      funcao_id: f.id,
      funcao_nome: f.nome_funcao,
      cbo: f.cbo || s.cbo,
      descricao_atividade: s.descricao_atividade || f.descricao_atividade || null,
    }));
  }

  function aplicarGhe(gheId: string) {
    const g = (ghes as any[]).find((x) => x.id === gheId);
    if (!g) {
      setForm((s) => ({ ...s, ghe_id: null, ghe_codigo: null, ghe_descricao: null }));
      return;
    }
    setForm((s) => ({
      ...s,
      ghe_id: g.id,
      ghe_codigo: g.codigo,
      ghe_descricao: g.nome,
      setor_nome: s.setor_nome || g.setor || null,
      funcao_id: null, // limpa para recarregar funções do GHE
    }));
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Histórico laboral</CardTitle>
        <div className="flex gap-2">
          {editavel && (
            <>
              <Button size="sm" variant="outline" onClick={importarFuncionario}>
                <Wand2 className="h-4 w-4 mr-1" /> Importar do funcionário
              </Button>
              <Button size="sm" onClick={openNovo}>
                <Plus className="h-4 w-4 mr-1" /> Novo período
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!editavel && (
          <div className="mb-3 text-xs text-muted-foreground">
            PPP {ppp.status} — somente leitura. Abra uma revisão para editar.
          </div>
        )}
        {(periodos as Periodo[]).length === 0 ? (
          <div className="text-sm text-muted-foreground p-6 text-center">
            Nenhum período cadastrado.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Função / CBO</TableHead>
                <TableHead>Setor / GHE</TableHead>
                <TableHead>Vínculos</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(periodos as Periodo[]).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">
                    {new Date(p.data_inicio + "T00:00:00").toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.data_fim
                      ? new Date(p.data_fim + "T00:00:00").toLocaleDateString("pt-BR")
                      : <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300">Atual</Badge>}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{p.funcao_nome || "—"}</div>
                    <div className="text-xs text-muted-foreground">{p.cbo || ""}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{p.setor_nome || "—"}</div>
                    <div className="text-xs text-muted-foreground">{p.ghe_codigo || ""}</div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {p.ltcat_id && <Badge variant="outline" className="mr-1">LTCAT</Badge>}
                    {p.pgr_id && <Badge variant="outline">PGR</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {editavel && (
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => openEditar(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDelId(p.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="mt-3 text-xs text-muted-foreground">
          Exposições detalhadas a agentes nocivos serão vinculadas a cada período na Parte 4.
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar período" : "Novo período laboral"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Data de início *</Label>
              <Input type="date" value={form.data_inicio}
                onChange={(e) => setForm((s) => ({ ...s, data_inicio: e.target.value }))} />
            </div>
            <div>
              <Label>Data de fim</Label>
              <Input type="date" value={form.data_fim || ""}
                onChange={(e) => setForm((s) => ({ ...s, data_fim: e.target.value || null }))} />
              <div className="text-xs text-muted-foreground mt-1">
                Deixe em branco para período atual (apenas um por PPP).
              </div>
            </div>

            <div>
              <Label>GHE/GES</Label>
              <Select value={form.ghe_id || "__none"} onValueChange={(v) => aplicarGhe(v === "__none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Nenhum —</SelectItem>
                  {(ghes as any[]).map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.codigo} — {g.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Função *</Label>
              <Select value={form.funcao_id || "__manual"} onValueChange={(v) => aplicarFuncao(v === "__manual" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__manual">Digitar manualmente</SelectItem>
                  {(funcoes as any[]).map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome_funcao} {f.cbo ? `(${f.cbo})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!form.funcao_id && (
                <Input className="mt-2" placeholder="Nome da função"
                  value={form.funcao_nome || ""}
                  onChange={(e) => setForm((s) => ({ ...s, funcao_nome: e.target.value }))} />
              )}
            </div>

            <div>
              <Label>CBO</Label>
              <Input value={form.cbo || ""}
                onChange={(e) => setForm((s) => ({ ...s, cbo: e.target.value }))} />
            </div>

            <div>
              <Label>Setor</Label>
              <Input value={form.setor_nome || ""}
                onChange={(e) => setForm((s) => ({ ...s, setor_nome: e.target.value }))} />
            </div>

            <div>
              <Label>LTCAT vinculado</Label>
              <Select value={form.ltcat_id || "__none"} onValueChange={(v) =>
                setForm((s) => ({ ...s, ltcat_id: v === "__none" ? null : v }))}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Nenhum —</SelectItem>
                  {(ltcats as any[]).map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      v{l.versao} ({l.status}) {l.data_emissao || ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>PGR vinculado</Label>
              <Select value={form.pgr_id || "__none"} onValueChange={(v) =>
                setForm((s) => ({ ...s, pgr_id: v === "__none" ? null : v }))}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Nenhum —</SelectItem>
                  {(pgrs as any[]).map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      v{l.versao} ({l.status}) {l.data_emissao || ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label>Descrição das atividades</Label>
              <Textarea rows={3} value={form.descricao_atividade || ""}
                onChange={(e) => setForm((s) => ({ ...s, descricao_atividade: e.target.value }))} />
            </div>

            <div>
              <Label>Motivo do encerramento</Label>
              <Input value={form.motivo_encerramento || ""} placeholder="Ex.: transferência, mudança de função"
                onChange={(e) => setForm((s) => ({ ...s, motivo_encerramento: e.target.value }))} />
            </div>

            <div>
              <Label>Ordem</Label>
              <Input type="number" min={1} value={form.ordem}
                onChange={(e) => setForm((s) => ({ ...s, ordem: parseInt(e.target.value) || 1 }))} />
            </div>

            <div className="md:col-span-2">
              <Label>Observações</Label>
              <Textarea rows={2} value={form.observacoes || ""}
                onChange={(e) => setForm((s) => ({ ...s, observacoes: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>{saving ? "Salvando…" : "Salvar período"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir período?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Exposições vinculadas a este período (Parte 4) também serão removidas.
            </AlertDialogDescription>
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
