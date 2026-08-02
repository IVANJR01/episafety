import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import MatrizRisco from "./MatrizRisco";
import ItemMedicoesPanel from "./ItemMedicoesPanel";
import ItemControlesPanel from "./ItemControlesPanel";
import {
  GRUPO_LABEL, CLASSE_TEXT, CLASSE_DECISAO, classeLabel, classificarRisco,
} from "@/lib/pgrMatriz";
import { descreverAmbiente, descreverProcesso } from "@/lib/sstEstrutura";

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  pgrId: string;
  empresaId: string;
  itemId?: string | null;
  groupItemIds?: string[];
  /**
   * Valores para pré-preencher um item NOVO, vindos do levantamento da etapa 5.
   *
   * As duas telas pediam as mesmas seis informações — perigo, categoria, fonte,
   * lesões, trabalhadores expostos e medidas existentes —, então quem
   * levantasse o perigo na etapa 5 tinha de digitar tudo de novo na etapa 7.
   * O levantamento é o que foi identificado; o inventário é o que foi avaliado.
   * Um deve virar o outro, não ser redigitado.
   */
  valoresIniciais?: Record<string, string> | null;
  onSaved: () => void;
}

const GRUPOS = ["fisico", "quimico", "biologico", "ergonomico", "acidente", "psicossocial", "outro"];

/** Normaliza leitura: sentinelas legados ("N.A", "N/A") viram vazio. */
const clean = (v: any) => {
  const s = (v ?? "").toString().trim();
  if (!s) return "";
  const up = s.toUpperCase();
  return up === "N.A" || up === "N.A." || up === "N/A" || up === "NA" ? "" : s;
};

/**
 * Campo em branco é gravado como NULL, nunca como "N.A".
 * O sentinela mascarava informação faltante — não distinguia "não aplicável" de
 * "não avaliado" nem de "não informado", e fazia campo vazio parecer preenchido
 * em auditoria. O estado real da avaliação vive em `avaliacao_estado`.
 */
const toSave = (v: any) => clean(v) || null;

export default function InventarioItemDialog({ open, onOpenChange, pgrId, empresaId, itemId, groupItemIds = [], valoresIniciais = null, onSaved }: Props) {
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("estrutura");
  const [form, setForm] = useState<any>({
    ghe_id: "",
    descricao_ambiente: "",
    setor: "",
    processo: "",
    funcoes_text: "",
    grupo: "fisico",
    tipo_agente: "",
    perigo_descricao: "",
    fonte_geradora: "",
    lesoes: "",
    limite_tolerancia: "",
    intensidade: "",
    tempo_exposicao: "",
    tecnica_utilizada: "",
    controles_text: "",
    epi: "",
    atenuacao: "",
    severidade: 3,
    probabilidade: 3,
    justificativa_severidade: "",
    justificativa_probabilidade: "",
    avaliacao_estado: "avaliado",
    severidade_inicial: null,
    probabilidade_inicial: null,
    severidade_residual: null,
    probabilidade_residual: null,
  });

  const { data: ghes = [] } = useQuery({
    queryKey: ["pgr-ghes", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ghe_ges")
        .select("id, codigo, nome, descricao_ambiente, ambiente, setor, processo")
        .eq("empresa_id", empresaId).eq("status", "ativo").order("codigo");
      return data || [];
    },
    enabled: open && !!empresaId,
  });

  // Ids que já existem no Núcleo Mestre — usado para decidir se é seguro
  // preencher ges_id (FK para sst_ges) sem violar a integridade.
  const { data: gesNucleo = [] } = useQuery({
    queryKey: ["pgr-sst-ges-ids", empresaId],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("sst_ges")
        .select("id").eq("empresa_id", empresaId);
      return data || [];
    },
    enabled: open && !!empresaId,
  });
  const gesNucleoIds = new Set<string>((gesNucleo as any[]).map((g) => g.id));

  /**
   * Setores e ambientes do Núcleo Mestre — a estrutura que a etapa 3 cadastra.
   *
   * O diálogo só sabia ler ambiente/setor/processo das colunas da tabela legada
   * `ghe_ges`. Quem cadastrou "setor PCP → ambiente ESCRITORIO" na estrutura via
   * o item sair todo "N.A" e a tela dizer que não havia nada cadastrado — a
   * informação existia, só não era consultada. Pior: `setor` e `processo` eram
   * GRAVADOS sem ter campo nenhum na tela para preenchê-los.
   */
  const { data: estrutura } = useQuery({
    queryKey: ["pgr-estrutura-nucleo", empresaId],
    enabled: open && !!empresaId,
    queryFn: async () => {
      const tabela = (t: string) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from as any)(t).select("*").eq("empresa_id", empresaId);
      const [set, amb, proc, vinc] = await Promise.all([
        tabela("sst_setores"), tabela("sst_ambientes"), tabela("sst_processos"),
        tabela("ghe_setores"),
      ]);
      return {
        // Vínculo real do GES com o setor. O GES criado a partir do Setor não
        // preenche as colunas de texto legadas de ghe_ges — era por isso que
        // "Setor" abria vazio mesmo com o grupo escolhido.
        gheSetores: (vinc.data || []) as { ghe_id: string; setor_id?: string | null }[],
        setores: (set.data || []) as { id: string; nome: string; ambiente_id?: string | null }[],
        // O ambiente inteiro: a descricao e a caracterizacao, nao so o nome.
        ambientes: (amb.data || []) as { id: string; nome: string }[],
        processos: (proc.data || []) as
          { id: string; nome: string; setor_id?: string; descricao_etapas?: string }[],
      };
    },
  });
  const setores = estrutura?.setores || [];
  const ambientes = estrutura?.ambientes || [];
  const processos = estrutura?.processos || [];
  const gheSetores = estrutura?.gheSetores || [];

  /** O setor do GES, pelo vínculo real — não pelo texto legado de ghe_ges. */
  const setorDoGes = (gesId?: string) => {
    const v = gheSetores.find((x) => x.ghe_id === gesId && x.setor_id);
    return v ? setores.find((s) => s.id === v.setor_id) : undefined;
  };

  /**
   * Qual processo esta selecionado no seletor.
   *
   * Antes o valor era descoberto comparando o TEXTO gravado com o de cada
   * processo. Bastava ajustar uma vírgula na descrição para o seletor perder a
   * referência e voltar a "Selecione".
   */

  useEffect(() => {
    if (!open) return;
    setTab("estrutura");
    if (itemId) {
      (async () => {
        const { data } = await (supabase.from as any)("pgr_inventario_itens")
          .select("*, ghe:ghe_id(descricao_ambiente, ambiente, setor, processo)")
          .eq("id", itemId).maybeSingle();
        if (data) {
          setForm({
            ghe_id: data.ghe_id || "",
            descricao_ambiente: clean(data.descricao_ambiente) || clean(data.ghe?.descricao_ambiente) || clean(data.ghe?.ambiente) || "",
            setor: clean(data.setor) || clean(data.ghe?.setor) || "",
            processo: clean(data.processo) || clean(data.ghe?.processo) || "",
            funcoes_text: Array.isArray(data.funcoes_snapshot) ? data.funcoes_snapshot.join("\n") : "",
            grupo: data.grupo || "fisico",
            tipo_agente: clean(data.tipo_agente),
            perigo_descricao: clean(data.perigo_descricao),
            fonte_geradora: clean(data.fonte_geradora),
            lesoes: clean(data.lesoes),
            limite_tolerancia: clean(data.limite_tolerancia),
            intensidade: clean(data.intensidade) || (data.medicao_valor != null ? `${data.medicao_valor}${data.medicao_unidade ? " " + data.medicao_unidade : ""}` : ""),
            tempo_exposicao: clean(data.tempo_exposicao) || clean(data.tipo_exposicao),
            tecnica_utilizada: clean(data.tecnica_utilizada),
            controles_text: Array.isArray(data.controles_existentes) ? data.controles_existentes.join("\n") : "",
            epi: clean(data.epi),
            atenuacao: clean(data.atenuacao),
            severidade: data.severidade ?? 3,
            probabilidade: data.probabilidade ?? 3,
            justificativa_severidade: clean(data.justificativa_severidade),
            justificativa_probabilidade: clean(data.justificativa_probabilidade),
            avaliacao_estado: data.avaliacao_estado || "avaliado",
            severidade_inicial: data.severidade_inicial ?? null,
            probabilidade_inicial: data.probabilidade_inicial ?? null,
            severidade_residual: data.severidade_residual ?? null,
            probabilidade_residual: data.probabilidade_residual ?? null,
          });
          const proc = (estrutura?.processos || [])
            .find((p) => descreverProcesso(p) === clean(data.processo));
          if (proc) setProcessoEscolhido(proc.id);
        }
      })();
    } else {
      // Item novo: limpa e, se veio do levantamento, já entra preenchido.
      setForm((f: any) => ({
        ...f, ghe_id: "", perigo_descricao: "", fonte_geradora: "",
        ...(valoresIniciais || {}),
      }));
    }
    // valoresIniciais fora das dependências de propósito: só vale no momento em
    // que o diálogo abre. Reagir a ele reescreveria o que a pessoa já digitou.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, itemId]);

  /**
   * Escolhido o GES, o resto do "onde" vem junto.
   *
   * Setor, ambiente e processo deixaram de ser perguntados: o GES já pertence a
   * um setor, o setor tem o seu ambiente e o processo é do setor. Perguntar de
   * novo abria a porta para o item apontar para um setor diferente do grupo —
   * duas respostas contraditórias na mesma linha do inventário.
   */
  const contextoDoGes = (() => {
    const s = setorDoGes(form.ghe_id as string);
    const amb = s ? ambientes.find((a: any) => a.id === (s as any).ambiente_id) : undefined;
    const proc = s ? processos.find((p) => p.setor_id === s.id) : undefined;
    return {
      setorNome: s?.nome || "",
      ambienteTexto: descreverAmbiente(amb) || "",
      processoTexto: descreverProcesso(proc) || "",
    };
  })();

  useEffect(() => {
    if (!form.ghe_id || itemId) return;
    const g = ghes.find((x: any) => x.id === form.ghe_id);
    setForm((f: any) => ({
      ...f,
      // Vínculo real primeiro; texto legado de ghe_ges só como último recurso,
      // para os grupos antigos que nunca foram ligados a um setor.
      setor: contextoDoGes.setorNome || f.setor || clean(g?.setor) || "",
      descricao_ambiente: contextoDoGes.ambienteTexto || f.descricao_ambiente
        || clean(g?.descricao_ambiente) || clean(g?.ambiente) || "",
      processo: contextoDoGes.processoTexto || f.processo || clean(g?.processo) || "",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.ghe_id, ghes, itemId, contextoDoGes.setorNome, contextoDoGes.ambienteTexto, contextoDoGes.processoTexto]);

  const total = Number(form.severidade) * Number(form.probabilidade);
  const classe = classificarRisco(Number(form.severidade), Number(form.probabilidade));

  const salvar = async () => {
    if (!form.perigo_descricao || form.perigo_descricao.trim().length < 2) {
      toast.error("Preencha Perigo / Fonte Exposição"); setTab("risco"); return;
    }
    setBusy(true);
    try {
      const funcoesArr = form.funcoes_text
        .split(/\n|,/).map((s: string) => s.trim()).filter(Boolean);
      const controlesArr = form.controles_text
        .split("\n").map((s: string) => s.trim()).filter(Boolean);

      const payload: any = {
        pgr_id: pgrId,
        empresa_id: empresaId,
        ghe_id: form.ghe_id || null,
        descricao_ambiente: toSave(form.descricao_ambiente),
        setor: toSave(form.setor),
        processo: toSave(form.processo),
        funcoes_snapshot: funcoesArr.length ? funcoesArr : null,
        grupo: form.grupo,
        tipo_agente: toSave(form.tipo_agente),
        perigo_descricao: form.perigo_descricao.trim(),
        fonte_geradora: toSave(form.fonte_geradora),
        lesoes: toSave(form.lesoes),
        limite_tolerancia: toSave(form.limite_tolerancia),
        intensidade: toSave(form.intensidade),
        tempo_exposicao: toSave(form.tempo_exposicao),
        tecnica_utilizada: toSave(form.tecnica_utilizada),
        controles_existentes: controlesArr.length ? controlesArr : null,
        epi: toSave(form.epi),
        atenuacao: toSave(form.atenuacao),
        severidade: Number(form.severidade),
        probabilidade: Number(form.probabilidade),
        justificativa_severidade: toSave(form.justificativa_severidade),
        justificativa_probabilidade: toSave(form.justificativa_probabilidade),
        avaliacao_estado: form.avaliacao_estado || "avaliado",
        severidade_inicial: form.severidade_inicial ?? null,
        probabilidade_inicial: form.probabilidade_inicial ?? null,
        severidade_residual: form.severidade_residual ?? null,
        probabilidade_residual: form.probabilidade_residual ?? null,
        // Núcleo Mestre: só grava ges_id se o GES realmente existir em sst_ges.
        // O espelhamento garante id idêntico nas duas tabelas, mas GHEs legados
        // criados antes do espelhamento existem apenas em ghe_ges — gravar o id
        // deles violaria a FK. ghe_id segue preenchido como fallback.
        ges_id: form.ghe_id && gesNucleoIds.has(form.ghe_id) ? form.ghe_id : null,
      };

      if (itemId) {
        const idsToUpdate = groupItemIds && groupItemIds.length > 1 ? groupItemIds : [itemId];
        if (idsToUpdate.length > 1) {
          // Atualiza somente campos compartilhados do grupo de risco.
          // Preserva por-linha: ghe_id, descricao_ambiente, setor, processo, funcoes_snapshot.
          const { ghe_id, descricao_ambiente, setor, processo, funcoes_snapshot, ...shared } = payload;
          const { error } = await (supabase.from as any)("pgr_inventario_itens").update(shared).in("id", idsToUpdate);
          if (error) throw error;
          toast.success(`Grupo atualizado (${idsToUpdate.length} setores)`);
        } else {
          const { error } = await (supabase.from as any)("pgr_inventario_itens").update(payload).eq("id", itemId);
          if (error) throw error;
          toast.success("Item atualizado");
        }
      } else {
        const { error } = await (supabase.from as any)("pgr_inventario_itens").insert(payload);
        if (error) throw error;
        toast.success("Item adicionado");
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar");
    } finally { setBusy(false); }
  };

  const upd = (k: string) => (e: any) => setForm({ ...form, [k]: e?.target ? e.target.value : e });
  /** Campo numérico opcional: vazio precisa virar null, não 0. */
  const updNum = (k: string) => (e: any) => {
    const v = e?.target?.value ?? "";
    setForm({ ...form, [k]: v === "" ? null : Number(v) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden
          w-screen h-[100dvh] max-w-none rounded-none translate-x-0 translate-y-0 left-0 top-0
          sm:w-[90vw] sm:h-auto sm:max-w-[1150px] sm:max-h-[90vh] sm:rounded-lg sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]
          flex flex-col"
      >
        <DialogHeader className="px-4 sm:px-6 pt-4 pb-3 border-b shrink-0">
          <DialogTitle className="text-base sm:text-lg">{itemId ? "Editar item do inventário" : "Novo item do inventário"}</DialogTitle>
          {/* A legenda dizia "Vazios são salvos como N.A." — deixou de ser
              verdade quando campo em branco passou a gravar NULL. O sentinela
              fazia campo vazio parecer preenchido em auditoria. */}
          <DialogDescription className="text-xs sm:text-sm">
            Preencha o essencial e classifique na matriz. O detalhamento é opcional.
          </DialogDescription>
        </DialogHeader>

        {/* Eram 6 abas — e a primeira tinha dois campos. Viraram 3, na ordem em
            que a decisão acontece: o que é e onde ocorre, quanto vale na matriz,
            e o detalhamento que só alguns riscos exigem. */}
        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="px-4 sm:px-6 pt-3 border-b shrink-0 overflow-x-auto">
            <TabsList className="inline-flex sm:grid sm:grid-cols-3 sm:w-full min-w-max sm:min-w-0">
              <TabsTrigger value="estrutura" className="whitespace-nowrap">1. Perigo e local</TabsTrigger>
              <TabsTrigger value="classif" className="whitespace-nowrap">2. Classificação</TabsTrigger>
              <TabsTrigger value="exposicao" className="whitespace-nowrap">3. Detalhes (opcional)</TabsTrigger>
            </TabsList>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 min-h-0">

          {/* Aba 1 — Estrutura */}
          <TabsContent value="estrutura" className="space-y-3">
            {/* GES primeiro: é ele que traz ambiente, setor e processo. Antes a
                "Descrição do ambiente" vinha em cima, dando a entender que era
                para digitar — quando na maioria das vezes ela é herdada. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label className="text-xs">GES</Label>
                <Select value={form.ghe_id || ""} onValueChange={(v) => setForm({ ...form, ghe_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {ghes.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.codigo} — {g.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Setor, ambiente e processo não são mais perguntados: vêm do GES
                  escolhido. Mostrados só para conferência — se estiverem
                  errados, o lugar de corrigir é o cadastro do grupo, não aqui,
                  senão o item passa a apontar para um setor diferente do
                  próprio grupo. */}
              {form.ghe_id && (
                <div className="md:col-span-2 rounded border bg-muted/40 p-2 text-xs space-y-1">
                  <p>
                    <span className="text-muted-foreground">Setor: </span>
                    <b>{contextoDoGes.setorNome || "não vinculado a um setor"}</b>
                  </p>
                  {!contextoDoGes.setorNome && (
                    <p className="text-amber-700">
                      Este grupo não está ligado a nenhum setor. Vincule em Estrutura →
                      Setores → Grupos de exposição, senão o item sai sem setor no PGR.
                    </p>
                  )}
                </div>
              )}

              {/* O que fica GRAVADO no inventario. O seletor acima mostra o nome
                  curto — util para escolher, mas escondia o texto real: quem
                  escolhia o processo via "Planejamento e Controle da Producao —
                  PCP" na tela e nao tinha como saber que o inventario receberia
                  as etapas. Agora aparece, e da para ajustar so neste item. */}
              <div className="md:col-span-2">
                <Label className="text-xs">
                  Descrição do processo{" "}
                  <span className="text-muted-foreground font-normal">(vem do processo escolhido)</span>
                </Label>
                <Textarea rows={2} value={form.processo} onChange={upd("processo")}
                  placeholder="Etapas do processo de trabalho" />
              </div>

              <div className="md:col-span-2">
                <Label className="text-xs">
                  Descrição do ambiente{" "}
                  <span className="text-muted-foreground font-normal">(vem do setor escolhido)</span>
                </Label>
                <Input value={form.descricao_ambiente} onChange={upd("descricao_ambiente")} placeholder="Ex.: Escritório administrativo" />
              </div>
            </div>

            {/* O que era a aba "2. Risco": ficava sozinha com quatro campos
                enquanto esta tinha dois. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Agente</Label>
                <Select value={form.grupo} onValueChange={(v) => setForm({ ...form, grupo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GRUPOS.map(g => <SelectItem key={g} value={g}>{GRUPO_LABEL[g]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Tipo de Agente</Label>
                <Input value={form.tipo_agente} onChange={upd("tipo_agente")} placeholder="Ex.: Ruído, Poeira, Postura inadequada" />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Perigo / Fonte Exposição *</Label>
                <Textarea rows={2} value={form.perigo_descricao} onChange={upd("perigo_descricao")} />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Possíveis Lesões ou Agravos à Saúde</Label>
                <Textarea rows={2} value={form.lesoes} onChange={upd("lesoes")} placeholder="Ex.: LER/DORT, fadiga visual" />
              </div>
            </div>
          </TabsContent>

          {/* Aba 3 — Exposição e Medidas */}
          <TabsContent value="exposicao" className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Limite de Exposição</Label>
                <Input value={form.limite_tolerancia} onChange={upd("limite_tolerancia")} placeholder="Ex.: 85 dB(A) — NR-15" />
              </div>
              <div>
                <Label className="text-xs">Intensidade / Concentração</Label>
                <Input value={form.intensidade} onChange={upd("intensidade")} placeholder="Ex.: 78 dB(A)" />
              </div>
              <div>
                <Label className="text-xs">Tipo / Tempo de Exposição</Label>
                <Input value={form.tempo_exposicao} onChange={upd("tempo_exposicao")} placeholder="Ex.: Habitual e permanente / 8h" />
              </div>
              <div>
                <Label className="text-xs">Técnica Utilizada</Label>
                <Input value={form.tecnica_utilizada} onChange={upd("tecnica_utilizada")} placeholder="Ex.: Qualitativa / Dosimetria" />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Procedimento Administrativo / EPC / Organização do Trabalho <span className="text-muted-foreground">(um por linha)</span></Label>
                <Textarea rows={3} value={form.controles_text} onChange={upd("controles_text")}
                  placeholder={"Pausas programadas\nRodízio de tarefas\nBarreira acústica"} />
              </div>
              <div>
                <Label className="text-xs">EPI</Label>
                <Input value={form.epi} onChange={upd("epi")} placeholder="Ex.: Protetor auricular tipo concha CA 12345" />
              </div>
              <div>
                <Label className="text-xs">Atenuação / Fator de Proteção</Label>
                <Input value={form.atenuacao} onChange={upd("atenuacao")} placeholder="Ex.: NRRsf 17 dB" />
              </div>
            </div>

            {/* Medições e controles eram abas próprias (5 e 6). Só valem para
                parte dos riscos — quem teve medição instrumental, quem tem
                controle a detalhar —, então moram aqui, com o resto do
                opcional, em vez de ocupar lugar fixo na barra. */}
            <div className="pt-2 border-t">
              <h4 className="text-sm font-medium mb-2">Medições</h4>
              <ItemMedicoesPanel pgrId={pgrId} empresaId={empresaId} itemId={itemId || null} canEdit />
            </div>

            <div className="pt-2 border-t">
              <h4 className="text-sm font-medium mb-2">Controles (hierarquia da NR-01)</h4>
              <ItemControlesPanel pgrId={pgrId} empresaId={empresaId} itemId={itemId || null} canEdit />
            </div>
          </TabsContent>

          {/* Aba 4 — Classificação */}
          <TabsContent value="classif" className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-[auto,1fr] gap-4">
              <div>
                <Label className="text-xs mb-1 block">Matriz 5×5 — clique para selecionar</Label>
                <MatrizRisco
                  severidade={form.severidade}
                  probabilidade={form.probabilidade}
                  onSelect={(s, p) => setForm({ ...form, severidade: s, probabilidade: p })}
                />
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Probabilidade</Label>
                    <Input readOnly value={form.probabilidade} className="bg-muted text-center font-semibold" />
                  </div>
                  <div>
                    <Label className="text-xs">Severidade</Label>
                    <Input readOnly value={form.severidade} className="bg-muted text-center font-semibold" />
                  </div>
                  <div>
                    <Label className="text-xs">Total (P × S)</Label>
                    <Input readOnly value={total} className="bg-muted text-center font-bold text-lg" />
                  </div>
                  <div>
                    <Label className="text-xs">Classificação do Risco</Label>
                    <div className="mt-1">
                      <Badge
                        variant="outline"
                        className={`${classe ? CLASSE_TEXT[classe] : "bg-slate-100 text-slate-700 border-slate-300"} text-sm px-3 py-1`}
                      >
                        {classeLabel(classe)}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground border rounded p-2 bg-muted/40">
                  <b>Faixas:</b> 1–3 Trivial · 4–8 Tolerável · 9–12 Moderado · 13–15 Substancial · 16–25 Intolerável
                </div>
                {classe && (
                  <div className="text-xs border rounded p-2 bg-blue-50/60 text-blue-900">
                    <b>Decisão:</b> {CLASSE_DECISAO[classe]}
                  </div>
                )}
              </div>
            </div>

            {/* Justificativa técnica — a NR-01 exige critério documentado, não
                apenas o número escolhido na matriz. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Justificativa da Probabilidade</Label>
                <Textarea
                  rows={2}
                  value={form.justificativa_probabilidade}
                  onChange={upd("justificativa_probabilidade")}
                  placeholder="Por que esta probabilidade? Frequência, histórico, controles existentes..."
                />
              </div>
              <div>
                <Label className="text-xs">Justificativa da Severidade</Label>
                <Textarea
                  rows={2}
                  value={form.justificativa_severidade}
                  onChange={upd("justificativa_severidade")}
                  placeholder="Por que esta severidade? Consequência de maior magnitude considerada..."
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Estado da Avaliação</Label>
              <Select
                value={form.avaliacao_estado}
                onValueChange={(v) => setForm({ ...form, avaliacao_estado: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="avaliado">Avaliado</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="nao_avaliado">Não avaliado</SelectItem>
                  <SelectItem value="nao_aplicavel">Não aplicável</SelectItem>
                  <SelectItem value="sem_exposicao_identificada">Sem exposição identificada</SelectItem>
                  <SelectItem value="informacao_nao_disponivel">Informação não disponível</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Campo em branco fica vazio, não vira “N.A”. Use este estado para dizer
                <i> por que</i> a informação não está preenchida.
              </p>
            </div>

            {/* Risco inicial (antes dos controles) e residual (esperado após as ações).
                Ambos opcionais: ficam nulos até que exista avaliação real. */}
            <fieldset className="border rounded-md p-3">
              <legend className="px-1 text-xs font-semibold text-slate-600">
                Cenários comparativos (opcional)
              </legend>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Sev. inicial</Label>
                  <Input
                    type="number" min={1} max={5}
                    value={form.severidade_inicial ?? ""}
                    onChange={updNum("severidade_inicial")}
                    placeholder="antes"
                  />
                </div>
                <div>
                  <Label className="text-xs">Prob. inicial</Label>
                  <Input
                    type="number" min={1} max={5}
                    value={form.probabilidade_inicial ?? ""}
                    onChange={updNum("probabilidade_inicial")}
                    placeholder="antes"
                  />
                </div>
                <div>
                  <Label className="text-xs">Sev. residual</Label>
                  <Input
                    type="number" min={1} max={5}
                    value={form.severidade_residual ?? ""}
                    onChange={updNum("severidade_residual")}
                    placeholder="após ações"
                  />
                </div>
                <div>
                  <Label className="text-xs">Prob. residual</Label>
                  <Input
                    type="number" min={1} max={5}
                    value={form.probabilidade_residual ?? ""}
                    onChange={updNum("probabilidade_residual")}
                    placeholder="após ações"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                <b>Inicial</b> = cenário antes dos controles. <b>Atual</b> = matriz acima, com os
                controles de hoje. <b>Residual</b> = esperado após concluir o plano de ação.
              </p>
            </fieldset>
          </TabsContent>

          </div>
        </Tabs>

        <DialogFooter className="px-4 sm:px-6 py-3 border-t shrink-0 bg-background flex-col-reverse sm:flex-row gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto min-h-11">Cancelar</Button>
          <Button onClick={salvar} disabled={busy} className="w-full sm:w-auto min-h-11">{itemId ? "Salvar alterações" : "Adicionar item"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
