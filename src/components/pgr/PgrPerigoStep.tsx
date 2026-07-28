import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Edit2, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { GRUPO_LABEL } from "@/lib/pgrMatriz";
import { ContextoSst, PgrContextoResumo, PgrContextoSelector } from "./PgrContextoSelector";
import { useRegistrarEtapa } from "./PgrEtapaContext";
import { mensagemErro } from "@/lib/erroSupabase";
import { useNucleoMestreSst } from "@/hooks/useNucleoMestreSst";

interface Props {
  pgrId: string;
  empresaId: string;
  canEdit: boolean;
}

const GRUPOS = ["fisico", "quimico", "biologico", "ergonomico", "acidente", "psicossocial", "outro"];

const vazio = {
  perigo_descricao: "",
  grupo: "fisico",
  fonte_circunstancia: "",
  possiveis_lesoes: "",
  trabalhadores_expostos: "",
  medidas_existentes: "",
  origem: "inspecao",
  data_levantamento: new Date().toISOString().slice(0, 10),
  responsavel_nome: "",
  tratamento: "avaliacao_aprofundada",
};

/**
 * Etapa "Perigos e riscos": identifica o perigo já amarrado ao ponto exato da
 * hierarquia em que ele ocorre.
 *
 * Grava em pgr_levantamento_preliminar — não direto no inventário. O inventário
 * é a lista de riscos JÁ avaliados; o levantamento é a lista do que foi
 * observado, com origem e responsável. Separar os dois é o que permite mostrar,
 * numa fiscalização, que um perigo foi considerado e descartado com motivo.
 */
export default function PgrPerigoStep({ pgrId, empresaId, canEdit }: Props) {
  const qc = useQueryClient();
  const { ambientes, setores, funcoes, gesList } = useNucleoMestreSst();

  const [formAberto, setFormAberto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [ctx, setCtx] = useState<ContextoSst>({});
  const [f, setF] = useState<any>(vazio);
  const [excluirId, setExcluirId] = useState<string | null>(null);

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["pgr-perigos-step", pgrId],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("pgr_levantamento_preliminar")
        .select("*").eq("pgr_id", pgrId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // A lista espelha exatamente os campos marcados com asterisco na tela — um
  // obrigatório que não aparece aqui viraria asterisco mentiroso.
  const faltando = useMemo(() => {
    const falta: string[] = [];
    if (!ctx.ambiente_id) falta.push("ambiente");
    if (!ctx.setor_id) falta.push("setor");
    if (!ctx.ges_id) falta.push("GES");
    if (!ctx.funcao_id) falta.push("função");
    if (!ctx.atividade_id) falta.push("atividade");
    if (!f.perigo_descricao.trim()) falta.push("perigo");
    if (!f.fonte_circunstancia.trim()) falta.push("fonte ou circunstância");
    if (!f.possiveis_lesoes.trim()) falta.push("possíveis lesões");
    if (!String(f.trabalhadores_expostos).trim()) falta.push("trabalhadores expostos");
    if (!f.medidas_existentes.trim()) falta.push("medidas de prevenção existentes");
    return falta;
  }, [f, ctx]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (faltando.length > 0) {
        throw new Error(`Falta preencher: ${faltando.join(", ")}.`);
      }
      const payload = {
        pgr_id: pgrId,
        empresa_id: empresaId,
        ambiente_id: ctx.ambiente_id || null,
        processo_id: ctx.processo_id || null,
        setor_id: ctx.setor_id || null,
        ges_id: ctx.ges_id || null,
        funcao_id: ctx.funcao_id || null,
        atividade_id: ctx.atividade_id || null,
        perigo_descricao: f.perigo_descricao.trim(),
        grupo: f.grupo,
        fonte_circunstancia: f.fonte_circunstancia.trim(),
        origem: f.origem,
        data_levantamento: f.data_levantamento,
        responsavel_nome: f.responsavel_nome.trim() || null,
        tratamento: f.tratamento,
        // Lesões, expostos e controles não têm coluna própria no levantamento —
        // ele é o registro do achado. Vão em justificativa de forma rotulada,
        // e são recopiados campo a campo quando o item vira inventário.
        justificativa: [
          `Possíveis lesões: ${f.possiveis_lesoes.trim()}`,
          `Trabalhadores expostos: ${String(f.trabalhadores_expostos).trim()}`,
          f.medidas_existentes.trim() && `Medidas existentes: ${f.medidas_existentes.trim()}`,
        ].filter(Boolean).join("\n"),
      };
      const q = editId
        ? (supabase.from as any)("pgr_levantamento_preliminar").update(payload).eq("id", editId)
        : (supabase.from as any)("pgr_levantamento_preliminar").insert(payload);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editId ? "Perigo atualizado" : "Perigo cadastrado");
      qc.invalidateQueries({ queryKey: ["pgr-perigos-step", pgrId] });
      qc.invalidateQueries({ queryKey: ["pgr-levantamento", pgrId] });
      qc.invalidateQueries({ queryKey: ["pgr-wiz-progresso", pgrId] });
      fechar();
    },
    onError: (e: any) => toast.error(mensagemErro(e, "Não foi possível salvar o perigo")),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)("pgr_levantamento_preliminar")
        .delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro excluído");
      qc.invalidateQueries({ queryKey: ["pgr-perigos-step", pgrId] });
      setExcluirId(null);
    },
    onError: (e: any) => toast.error(mensagemErro(e, "Não foi possível excluir o registro")),
  });

  const rascunho = useMutation({
    mutationFn: async () => {
      if (!f.perigo_descricao.trim()) throw new Error("Informe ao menos o perigo para guardar o rascunho.");
      const { error } = await (supabase.from as any)("pgr_levantamento_preliminar").insert({
        pgr_id: pgrId, empresa_id: empresaId,
        ambiente_id: ctx.ambiente_id || null, processo_id: ctx.processo_id || null,
        setor_id: ctx.setor_id || null, ges_id: ctx.ges_id || null,
        funcao_id: ctx.funcao_id || null, atividade_id: ctx.atividade_id || null,
        perigo_descricao: f.perigo_descricao.trim(),
        grupo: f.grupo,
        fonte_circunstancia: f.fonte_circunstancia.trim() || null,
        origem: f.origem,
        data_levantamento: f.data_levantamento,
        responsavel_nome: f.responsavel_nome.trim() || null,
        // Rascunho não é encaminhamento: fica pendente de avaliação até alguém
        // completar os campos obrigatórios.
        tratamento: "avaliacao_aprofundada",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rascunho salvo");
      qc.invalidateQueries({ queryKey: ["pgr-perigos-step", pgrId] });
      fechar();
    },
    onError: (e: any) => toast.error(mensagemErro(e, "Não foi possível salvar o rascunho")),
  });

  // Enquanto o formulário está aberto, o rodapé do assistente comanda o
  // salvamento. Na listagem não há o que salvar, então nada é registrado.
  useRegistrarEtapa(
    formAberto && canEdit
      ? {
          salvar: async () => {
            try { await salvar.mutateAsync(); return true; } catch { return false; }
          },
          salvarRascunho: async () => { await rascunho.mutateAsync().catch(() => {}); },
          ocupado: salvar.isPending || rascunho.isPending,
        }
      : null,
  );

  const fechar = () => { setFormAberto(false); setEditId(null); setF(vazio); setCtx({}); };

  const abrirNovo = () => {
    setEditId(null);
    setF(vazio);
    // Mantém o contexto: quem cadastra 3 perigos do mesmo pedreiro não deve
    // reselecionar ambiente, setor, GES e função a cada um.
    setFormAberto(true);
  };

  const abrirEdicao = (i: any) => {
    setEditId(i.id);
    setCtx({
      ambiente_id: i.ambiente_id, processo_id: i.processo_id, setor_id: i.setor_id,
      ges_id: i.ges_id, funcao_id: i.funcao_id, atividade_id: i.atividade_id,
    });
    const extrai = (rotulo: string) =>
      (String(i.justificativa || "").split("\n").find((l) => l.startsWith(rotulo)) || "")
        .replace(rotulo, "").trim();
    setF({
      perigo_descricao: i.perigo_descricao || "",
      grupo: i.grupo || "fisico",
      fonte_circunstancia: i.fonte_circunstancia || "",
      possiveis_lesoes: extrai("Possíveis lesões:"),
      trabalhadores_expostos: extrai("Trabalhadores expostos:"),
      medidas_existentes: extrai("Medidas existentes:"),
      origem: i.origem || "inspecao",
      data_levantamento: i.data_levantamento || new Date().toISOString().slice(0, 10),
      responsavel_nome: i.responsavel_nome || "",
      tratamento: i.tratamento || "avaliacao_aprofundada",
    });
    setFormAberto(true);
  };

  const nomeDe = (lista: any[], id?: string | null) =>
    (id && lista.find((x: any) => x.id === id)?.nome) || "—";

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando perigos…
      </div>
    );
  }

  if (!formAberto) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Cada perigo fica ligado ao ponto exato da estrutura em que foi observado.
          </p>
          {canEdit && (
            <Button onClick={abrirNovo} size="lg" className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" /> Cadastrar perigo
            </Button>
          )}
        </div>

        {itens.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhum perigo cadastrado ainda. Comece pelas atividades de maior risco.
          </CardContent></Card>
        ) : (
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Perigo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Onde</TableHead>
                  <TableHead>Fonte ou circunstância</TableHead>
                  {canEdit && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium max-w-[240px]">{i.perigo_descricao}</TableCell>
                    <TableCell className="text-xs">{GRUPO_LABEL[i.grupo] || i.grupo || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[220px]">
                      {[
                        nomeDe(ambientes, i.ambiente_id),
                        nomeDe(setores, i.setor_id),
                        nomeDe(gesList, i.ges_id),
                        nomeDe(funcoes, i.funcao_id),
                      ].filter((x) => x !== "—").join(" › ") || "—"}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px]">{i.fonte_circunstancia || "—"}</TableCell>
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
          </CardContent></Card>
        )}

        <AlertDialog open={!!excluirId} onOpenChange={(o) => !o && setExcluirId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir este perigo?</AlertDialogTitle>
              <AlertDialogDescription>
                O registro é a evidência de que o perigo foi considerado no levantamento.
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => excluir.mutate(excluirId!)}
                className="bg-red-600 hover:bg-red-700">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold min-w-0">
            {editId ? "Editar perigo e risco" : "Cadastrar perigo e risco"}
          </h3>
          <Button variant="ghost" size="sm" onClick={fechar} className="shrink-0 -mt-1">
            <X className="h-4 w-4 mr-1" /> Fechar
          </Button>
        </div>

        <PgrContextoSelector
          valor={ctx} onChange={setCtx} disabled={!canEdit}
          obrigatorios={["ambiente_id", "setor_id", "ges_id", "funcao_id", "atividade_id"]}
          ocultar={["processo_id"]}
        />

        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Categoria do perigo</Label>
              <Select value={f.grupo} onValueChange={(v) => setF({ ...f, grupo: v })} disabled={!canEdit}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GRUPOS.map((g) => (
                    <SelectItem key={g} value={g}>{GRUPO_LABEL[g] || g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Data do levantamento</Label>
              <Input type="date" className="h-11" value={f.data_levantamento}
                onChange={(e) => setF({ ...f, data_levantamento: e.target.value })} disabled={!canEdit} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Perigo / fator de risco <span className="text-red-500">*</span>
            </Label>
            <Textarea rows={2} value={f.perigo_descricao} disabled={!canEdit}
              onChange={(e) => setF({ ...f, perigo_descricao: e.target.value })}
              placeholder="Descreva o perigo ou fator de risco identificado" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Fonte ou circunstância <span className="text-red-500">*</span>
            </Label>
            <Textarea rows={2} value={f.fonte_circunstancia} disabled={!canEdit}
              onChange={(e) => setF({ ...f, fonte_circunstancia: e.target.value })}
              placeholder="Descreva a fonte ou circunstância que gera o perigo" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Possíveis lesões ou agravos <span className="text-red-500">*</span>
            </Label>
            <Textarea rows={2} value={f.possiveis_lesoes} disabled={!canEdit}
              onChange={(e) => setF({ ...f, possiveis_lesoes: e.target.value })}
              placeholder="Descreva as possíveis lesões ou agravos à saúde" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Trabalhadores expostos <span className="text-red-500">*</span>
            </Label>
            <Textarea rows={2} value={f.trabalhadores_expostos} disabled={!canEdit}
              onChange={(e) => setF({ ...f, trabalhadores_expostos: e.target.value })}
              placeholder="Informe os trabalhadores expostos a este perigo" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Medidas de prevenção existentes <span className="text-red-500">*</span>
            </Label>
            <Textarea rows={2} value={f.medidas_existentes} disabled={!canEdit}
              onChange={(e) => setF({ ...f, medidas_existentes: e.target.value })}
              placeholder="Descreva as medidas de prevenção já existentes" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Responsável pelo levantamento</Label>
              <Input className="h-11" value={f.responsavel_nome} disabled={!canEdit}
                onChange={(e) => setF({ ...f, responsavel_nome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Encaminhamento</Label>
              <Select value={f.tratamento} onValueChange={(v) => setF({ ...f, tratamento: v })}
                disabled={!canEdit}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tratado_diretamente">Tratado diretamente</SelectItem>
                  <SelectItem value="avaliacao_aprofundada">Exige avaliação aprofundada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* O que falta aparece aqui; gravar e avançar ficam no rodapé do
            assistente, para não haver dois pares de botões na mesma tela. */}
        {faltando.length > 0 && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="p-3 text-sm text-amber-900">
              Ainda falta preencher: <b>{faltando.join(", ")}</b>.
            </CardContent>
          </Card>
        )}
      </div>

      <aside className="xl:sticky xl:top-24">
        <PgrContextoResumo valor={ctx} />
      </aside>
    </div>
  );
}
