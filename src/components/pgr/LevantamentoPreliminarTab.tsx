import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Loader2, Plus, Search, Trash2, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { GRUPO_LABEL } from "@/lib/pgrMatriz";
import {
  PGR_ORIGEM_LABEL, PgrLevantamentoPreliminar, PgrOrigemLevantamento, PgrTratamentoPerigo,
} from "@/lib/pgrTypes";

interface Props {
  pgrId: string;
  empresaId: string;
  canEdit: boolean;
}

const TRATAMENTO_LABEL: Record<PgrTratamentoPerigo, string> = {
  tratado_diretamente: "Tratado diretamente",
  avaliacao_aprofundada: "Exige avaliação aprofundada",
  nao_identificado: "Não identificado",
};

const TRATAMENTO_COR: Record<PgrTratamentoPerigo, string> = {
  tratado_diretamente: "bg-emerald-100 text-emerald-800 border-emerald-300",
  avaliacao_aprofundada: "bg-amber-100 text-amber-800 border-amber-300",
  nao_identificado: "bg-slate-100 text-slate-700 border-slate-300",
};

const GRUPOS = ["fisico", "quimico", "biologico", "ergonomico", "acidente", "psicossocial", "outro"];

const vazio = {
  perigo_descricao: "",
  grupo: "fisico",
  fonte_circunstancia: "",
  origem: "inspecao" as PgrOrigemLevantamento,
  origem_detalhe: "",
  data_levantamento: new Date().toISOString().slice(0, 10),
  responsavel_nome: "",
  evidencia_descricao: "",
  evidencia_url: "",
  tratamento: "avaliacao_aprofundada" as PgrTratamentoPerigo,
  justificativa: "",
  perigo_emergente: false,
  mudanca_planejada: "",
  interacao_contratante: false,
};

export default function LevantamentoPreliminarTab({ pgrId, empresaId, canEdit }: Props) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(vazio);
  const [excluirId, setExcluirId] = useState<string | null>(null);

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["pgr-levantamento", pgrId],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("pgr_levantamento_preliminar")
        .select("*").eq("pgr_id", pgrId).order("data_levantamento", { ascending: false });
      if (error) throw error;
      return (data || []) as PgrLevantamentoPreliminar[];
    },
  });

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter((i) =>
      [i.perigo_descricao, i.fonte_circunstancia, i.responsavel_nome]
        .some((c) => (c || "").toLowerCase().includes(q)));
  }, [itens, busca]);

  const stats = useMemo(() => ({
    total: itens.length,
    aprofundar: itens.filter((i) => i.tratamento === "avaliacao_aprofundada" && !i.inventario_item_id).length,
    emergentes: itens.filter((i) => i.perigo_emergente).length,
    interacao: itens.filter((i) => i.interacao_contratante).length,
  }), [itens]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.perigo_descricao.trim()) throw new Error("Informe o perigo identificado.");
      // Espelha o CHECK do banco, para o usuário receber a mensagem em português
      // antes do round-trip em vez de um erro cru de constraint.
      if (form.tratamento === "nao_identificado" && form.justificativa.trim().length < 5) {
        throw new Error("Perigo marcado como não identificado exige justificativa (mín. 5 caracteres).");
      }
      const payload = {
        pgr_id: pgrId,
        empresa_id: empresaId,
        perigo_descricao: form.perigo_descricao.trim(),
        grupo: form.grupo || null,
        fonte_circunstancia: form.fonte_circunstancia.trim() || null,
        origem: form.origem,
        origem_detalhe: form.origem_detalhe.trim() || null,
        data_levantamento: form.data_levantamento,
        responsavel_nome: form.responsavel_nome.trim() || null,
        evidencia_descricao: form.evidencia_descricao.trim() || null,
        evidencia_url: form.evidencia_url.trim() || null,
        tratamento: form.tratamento,
        justificativa: form.justificativa.trim() || null,
        perigo_emergente: form.perigo_emergente,
        mudanca_planejada: form.mudanca_planejada.trim() || null,
        interacao_contratante: form.interacao_contratante,
      };
      const q = editId
        ? (supabase.from as any)("pgr_levantamento_preliminar").update(payload).eq("id", editId)
        : (supabase.from as any)("pgr_levantamento_preliminar").insert(payload);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editId ? "Levantamento atualizado" : "Perigo registrado");
      qc.invalidateQueries({ queryKey: ["pgr-levantamento", pgrId] });
      setAberto(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("pgr_levantamento_preliminar").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro excluído");
      qc.invalidateQueries({ queryKey: ["pgr-levantamento", pgrId] });
      setExcluirId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const abrirNovo = () => { setEditId(null); setForm(vazio); setAberto(true); };
  const abrirEdicao = (i: PgrLevantamentoPreliminar) => {
    setEditId(i.id);
    setForm({
      perigo_descricao: i.perigo_descricao || "",
      grupo: i.grupo || "fisico",
      fonte_circunstancia: i.fonte_circunstancia || "",
      origem: i.origem,
      origem_detalhe: i.origem_detalhe || "",
      data_levantamento: i.data_levantamento,
      responsavel_nome: i.responsavel_nome || "",
      evidencia_descricao: i.evidencia_descricao || "",
      evidencia_url: i.evidencia_url || "",
      tratamento: i.tratamento,
      justificativa: i.justificativa || "",
      perigo_emergente: i.perigo_emergente,
      mudanca_planejada: i.mudanca_planejada || "",
      interacao_contratante: i.interacao_contratante,
    });
    setAberto(true);
  };

  if (isLoading) {
    return (
      <Card><CardContent className="p-8 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando levantamento…
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Registro de <b>onde veio</b> cada perigo identificado (NR-01 1.5.4.3). Perigos
            descartados permanecem aqui com a justificativa — é a evidência de que foram
            considerados.
          </p>
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Total: {stats.total}</Badge>
              <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                Aguardando avaliação: {stats.aprofundar}
              </Badge>
              {stats.emergentes > 0 && (
                <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
                  Emergentes: {stats.emergentes}
                </Badge>
              )}
              {stats.interacao > 0 && (
                <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Interação contratante: {stats.interacao}
                </Badge>
              )}
            </div>
            {/* No celular a busca ocupa a linha inteira: com largura fixa, ela
                mais o botão passavam de 390px e o botão ficava cortado. */}
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar perigo…" className="pl-8 h-9 w-full sm:w-52" />
              </div>
              {canEdit && (
                <Button size="sm" onClick={abrirNovo} className="shrink-0">
                  <Plus className="h-4 w-4 mr-1" /> Registrar perigo
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Perigo</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Encaminhamento</TableHead>
                <TableHead>Situação</TableHead>
                {canEdit && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 8 : 7} className="text-center py-8 text-muted-foreground">
                    {itens.length === 0
                      ? "Nenhum perigo levantado ainda. O inventário deve nascer de um levantamento rastreável."
                      : "Nenhum registro corresponde à busca."}
                  </TableCell>
                </TableRow>
              ) : filtrados.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium max-w-[260px]">
                    {i.perigo_descricao}
                    {i.fonte_circunstancia && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        Fonte: {i.fonte_circunstancia}
                      </span>
                    )}
                    <div className="flex gap-1 mt-1">
                      {i.perigo_emergente && (
                        <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300 text-[10px]">
                          Emergente
                        </Badge>
                      )}
                      {i.interacao_contratante && (
                        <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 text-[10px]">
                          Interação contratante
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{GRUPO_LABEL[i.grupo || ""] || i.grupo || "—"}</TableCell>
                  <TableCell className="text-xs">
                    {PGR_ORIGEM_LABEL[i.origem] || i.origem}
                    {i.origem_detalhe && (
                      <span className="block text-muted-foreground">{i.origem_detalhe}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {i.data_levantamento?.split("-").reverse().join("/")}
                  </TableCell>
                  <TableCell className="text-xs">{i.responsavel_nome || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`${TRATAMENTO_COR[i.tratamento]} text-[11px]`}>
                      {TRATAMENTO_LABEL[i.tratamento]}
                    </Badge>
                    {i.tratamento === "nao_identificado" && i.justificativa && (
                      <span className="block text-[11px] text-muted-foreground mt-1 max-w-[200px]">
                        {i.justificativa}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {i.inventario_item_id
                      ? <span className="text-emerald-700">No inventário</span>
                      : i.tratamento === "avaliacao_aprofundada"
                        ? <span className="text-amber-700">Pendente</span>
                        : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => abrirEdicao(i)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setExcluirId(i.id)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar levantamento" : "Registrar perigo levantado"}</DialogTitle>
            <DialogDescription>
              Toda informação precisa de origem, data e responsável — é isso que torna o
              inventário auditável.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div>
              <Label className="text-xs">Perigo / Fator de risco *</Label>
              <Input value={form.perigo_descricao}
                onChange={(e) => setForm({ ...form, perigo_descricao: e.target.value })}
                placeholder="Ex.: Ruído contínuo na sala de costura" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Grupo</Label>
                <Select value={form.grupo} onValueChange={(v) => setForm({ ...form, grupo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRUPOS.map((g) => (
                      <SelectItem key={g} value={g}>{GRUPO_LABEL[g] || g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Fonte / Circunstância</Label>
                <Input value={form.fonte_circunstancia}
                  onChange={(e) => setForm({ ...form, fonte_circunstancia: e.target.value })}
                  placeholder="Ex.: Máquinas de costura reta" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Origem da informação *</Label>
                <Select value={form.origem} onValueChange={(v) => setForm({ ...form, origem: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PGR_ORIGEM_LABEL) as PgrOrigemLevantamento[]).map((o) => (
                      <SelectItem key={o} value={o}>{PGR_ORIGEM_LABEL[o]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Data do levantamento *</Label>
                <Input type="date" value={form.data_levantamento}
                  onChange={(e) => setForm({ ...form, data_levantamento: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Responsável</Label>
                <Input value={form.responsavel_nome}
                  onChange={(e) => setForm({ ...form, responsavel_nome: e.target.value })} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Detalhe da origem</Label>
              <Input value={form.origem_detalhe}
                onChange={(e) => setForm({ ...form, origem_detalhe: e.target.value })}
                placeholder="Ex.: Ata da CIPA nº 03/2026; Laudo LTCAT 2025" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Evidência (descrição)</Label>
                <Input value={form.evidencia_descricao}
                  onChange={(e) => setForm({ ...form, evidencia_descricao: e.target.value })}
                  placeholder="Foto, ata, relatório…" />
              </div>
              <div>
                <Label className="text-xs">Evidência (link)</Label>
                <Input value={form.evidencia_url}
                  onChange={(e) => setForm({ ...form, evidencia_url: e.target.value })}
                  placeholder="https://…" />
              </div>
            </div>

            <div>
              <Label className="text-xs">Encaminhamento *</Label>
              <Select value={form.tratamento} onValueChange={(v) => setForm({ ...form, tratamento: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tratado_diretamente">Tratado diretamente</SelectItem>
                  <SelectItem value="avaliacao_aprofundada">Exige avaliação aprofundada</SelectItem>
                  <SelectItem value="nao_identificado">Não identificado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">
                Justificativa
                {form.tratamento === "nao_identificado" && <span className="text-red-500"> *</span>}
              </Label>
              <Textarea rows={2} value={form.justificativa}
                onChange={(e) => setForm({ ...form, justificativa: e.target.value })}
                placeholder={form.tratamento === "nao_identificado"
                  ? "Obrigatório: por que este perigo não foi identificado como aplicável?"
                  : "Opcional"} />
            </div>

            <div className="space-y-2 border rounded-md p-3">
              <div className="flex items-start gap-2">
                <Checkbox id="emergente" checked={form.perigo_emergente}
                  onCheckedChange={(c) => setForm({ ...form, perigo_emergente: !!c })} />
                <div>
                  <Label htmlFor="emergente" className="text-xs font-medium">Perigo emergente</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Decorrente de mudança planejada em tecnologia, processo ou organização do trabalho.
                  </p>
                </div>
              </div>
              {form.perigo_emergente && (
                <Input value={form.mudanca_planejada}
                  onChange={(e) => setForm({ ...form, mudanca_planejada: e.target.value })}
                  placeholder="Qual mudança planejada origina este perigo?" />
              )}
              <div className="flex items-start gap-2">
                <Checkbox id="interacao" checked={form.interacao_contratante}
                  onCheckedChange={(c) => setForm({ ...form, interacao_contratante: !!c })} />
                <div>
                  <Label htmlFor="interacao" className="text-xs font-medium">
                    Risco de interação contratante / contratada
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Exige tratativa conjunta entre as organizações envolvidas.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!excluirId} onOpenChange={(o) => !o && setExcluirId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir registro de levantamento?</DialogTitle>
            <DialogDescription>
              O registro do levantamento é a evidência de que o perigo foi considerado.
              Excluir remove essa rastreabilidade.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluirId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => excluir.mutate(excluirId!)}
              disabled={excluir.isPending}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
