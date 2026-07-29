import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Save, Send, Loader2, Camera, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import {
  ACCEPTED_IMG_TYPES, MAX_IMG_BYTES,
  compressImage, buildItemImagePath, uploadItemImage,
  getSignedImageUrl, removeItemImage, makeThumbnailDataUrl,
} from "@/lib/solicitacaoMateriaisImagens";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  solicitacaoId: string | null;
  onSaved: () => void;
}

type ItemForm = {
  _key: string;
  id?: string;
  tipo_item: string;
  epi_id: string | null;
  nome_item: string;
  descricao: string;
  ca: string;
  unidade_medida: string;
  quantidade_solicitada: number;
  justificativa_item: string;
  observacoes: string;
  imagem_path: string | null;
  imagem_nome: string | null;
  imagem_tipo: string | null;
  imagem_tamanho: number | null;
  imagem_preview_url?: string | null;
  imagem_file?: File | null;
  imagem_remove?: boolean;
};

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

const emptyItem = (): ItemForm => ({
  _key: newKey(),
  tipo_item: "EPI",
  epi_id: null,
  nome_item: "",
  descricao: "",
  ca: "",
  unidade_medida: "un",
  quantidade_solicitada: 1,
  justificativa_item: "",
  observacoes: "",
  imagem_path: null,
  imagem_nome: null,
  imagem_tipo: null,
  imagem_tamanho: null,
  imagem_preview_url: null,
});

const emptyHead = () => ({
  titulo: "",
  unidade_id: "" as string,
  obra_id: "" as string,
  local_obra: "",
  setor: "",
  solicitante_nome: "",
  data_solicitacao: new Date().toISOString().slice(0, 10),
  data_necessidade: "",
  prioridade: "normal" as "baixa" | "normal" | "alta" | "urgente",
  justificativa: "",
  observacoes: "",
});

export default function SolicitacaoMaterialFormDialog({ open, onOpenChange, solicitacaoId, onSaved }: Props) {
  const { user, empresaId } = useAuth();
  const [head, setHead] = useState(emptyHead());
  const [itens, setItens] = useState<ItemForm[]>([emptyItem()]);
  const [obras, setObras] = useState<{ id: string; nome: string }[]>([]);
  /** Filiais da empresa — `empresa_config` com empresa_pai_id apontando para ela. */
  const [unidades, setUnidades] = useState<{ id: string; nome: string }[]>([]);
  const [epis, setEpis] = useState<{ id: string; nome: string; ca: string | null }[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("rascunho");
  const [rascunhoRecuperado, setRascunhoRecuperado] = useState(false);

  /**
   * Rascunho automático de solicitação NOVA.
   *
   * O formulário é longo e o único jeito de não perder o que foi digitado era
   * lembrar de clicar em "Salvar rascunho" — que grava no banco e exige título.
   * Sair para outra tela ou recarregar a página descartava tudo em silêncio.
   *
   * Guarda no proprio navegador, por empresa. Nao entra aqui a foto escolhida
   * (File e blob: URL nao sobrevivem a recarga) nem edicao de solicitacao ja
   * existente, que tem a versao do banco como fonte.
   */
  const chaveRascunho = `solicitacao_material_nova_${empresaId || "sem-empresa"}`;

  // Grava o rascunho a cada mudanca, so em solicitacao nova.
  useEffect(() => {
    if (!open || solicitacaoId || !empresaId) return;
    try {
      const semArquivos = itens.map(({ imagem_file: _f, imagem_preview_url: _p, ...resto }) => resto);
      localStorage.setItem(chaveRascunho, JSON.stringify({ head, itens: semArquivos }));
    } catch { /* cota cheia ou modo restrito: rascunho e conveniencia, nao pode quebrar o formulario */ }
  }, [head, itens, open, solicitacaoId, empresaId, chaveRascunho]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      if (!empresaId) return;
      // As filiais ja estao cadastradas em Empresas / Unidades, e
      // solicitacoes_materiais ja tem a coluna unidade_id — o formulario e que
      // nunca as oferecia: so listava `obras`, que esta vazia nesta empresa.
      const [{ data: o }, { data: e }, { data: u }] = await Promise.all([
        (supabase.from as any)("obras").select("id, nome").eq("empresa_id", empresaId).order("nome"),
        supabase.from("epis").select("id, nome, ca").eq("empresa_id", empresaId).order("nome"),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from as any)("empresa_config").select("id, nome")
          .eq("empresa_pai_id", empresaId).order("nome"),
      ]);
      setObras((o as any[]) || []);
      setEpis((e as any[]) || []);
      setUnidades((u as { id: string; nome: string }[]) || []);
    })();
  }, [open, empresaId]);

  useEffect(() => {
    if (!open) return;
    if (!solicitacaoId) {
      const base = { ...emptyHead(), solicitante_nome: user?.email?.split("@")[0] || "" };
      let recuperado = false;
      try {
        const bruto = localStorage.getItem(chaveRascunho);
        if (bruto) {
          const d = JSON.parse(bruto) as { head?: typeof base; itens?: ItemForm[] };
          // Só restaura se houver algo digitado — rascunho vazio é ruído.
          const temConteudo = !!d.head?.titulo?.trim()
            || (d.itens || []).some((i) => (i.nome_item || "").trim());
          if (temConteudo) {
            setHead({ ...base, ...d.head });
            setItens((d.itens || []).length ? d.itens!.map((i) => ({ ...i, _key: newKey() })) : [emptyItem()]);
            recuperado = true;
          }
        }
      } catch { /* rascunho corrompido nao pode impedir de abrir o formulario */ }
      setRascunhoRecuperado(recuperado);
      if (!recuperado) {
        setHead(base);
        setItens([emptyItem()]);
      }
      setStatus("rascunho");
      return;
    }
    setRascunhoRecuperado(false);
    setLoading(true);
    (async () => {
      const { data: s } = await supabase.from("solicitacoes_materiais").select("*").eq("id", solicitacaoId).maybeSingle();
      const { data: is } = await supabase.from("solicitacoes_materiais_itens").select("*").eq("solicitacao_id", solicitacaoId).order("ordem");
      if (s) {
        setStatus((s as any).status);
        setHead({
          titulo: (s as any).titulo || "",
          unidade_id: (s as { unidade_id?: string }).unidade_id || "",
          obra_id: (s as any).obra_id || "",
          local_obra: (s as any).local_obra || "",
          setor: (s as any).setor || "",
          solicitante_nome: (s as any).solicitante_nome || "",
          data_solicitacao: (s as any).data_solicitacao,
          data_necessidade: (s as any).data_necessidade || "",
          prioridade: (s as any).prioridade,
          justificativa: (s as any).justificativa || "",
          observacoes: (s as any).observacoes || "",
        });
      }
      setItens(((is as any[]) || []).map((i) => ({
        _key: newKey(),
        id: i.id,
        tipo_item: i.tipo_item,
        epi_id: i.epi_id,
        nome_item: i.nome_item,
        descricao: i.descricao || "",
        ca: i.ca || "",
        unidade_medida: i.unidade_medida,
        quantidade_solicitada: Number(i.quantidade_solicitada || 0),
        justificativa_item: i.justificativa_item || "",
        observacoes: i.observacoes || "",
        imagem_path: i.imagem_path || null,
        imagem_nome: i.imagem_nome || null,
        imagem_tipo: i.imagem_tipo || null,
        imagem_tamanho: i.imagem_tamanho ?? null,
        imagem_preview_url: null,
      })));
      if (!(is as any[])?.length) setItens([emptyItem()]);
      setLoading(false);
    })();
  }, [open, solicitacaoId, user, chaveRascunho]);

  // Resolve signed URLs for existing item images when loaded
  useEffect(() => {
    (async () => {
      const targets = itens
        .map((it, idx) => ({ idx, path: it.imagem_path }))
        .filter((t) => t.path && !itens[t.idx].imagem_preview_url);
      if (!targets.length) return;
      const resolved = await Promise.all(targets.map((t) => getSignedImageUrl(t.path as string, 600)));
      setItens((prev) => prev.map((it, i) => {
        const found = targets.findIndex((t) => t.idx === i);
        if (found === -1) return it;
        return { ...it, imagem_preview_url: resolved[found] };
      }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens.map((i) => i.imagem_path).join("|")]);

  function updateItem(idx: number, patch: Partial<ItemForm>) {
    setItens((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }
  function pickEpi(idx: number, epiId: string) {
    const epi = epis.find((e) => e.id === epiId);
    if (!epi) return;
    updateItem(idx, { epi_id: epi.id, nome_item: epi.nome, ca: epi.ca || "" });
  }
  function addItem() { setItens((p) => [...p, emptyItem()]); }
  function removeItem(idx: number) {
    const it = itens[idx];
    if (it?.imagem_path) removeItemImage(it.imagem_path).catch(() => {});
    setItens((p) => p.filter((_, i) => i !== idx));
  }

  async function handlePickImage(idx: number, file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/") && !ACCEPTED_IMG_TYPES.includes(file.type)) { toast.error("Formato inválido. Use uma imagem da câmera ou galeria."); return; }
    if (file.size > MAX_IMG_BYTES) { toast.error("Imagem acima de 20 MB."); return; }
    // Preview leve (thumbnail) para não travar mobile; upload usa o arquivo original.
    updateItem(idx, {
      imagem_file: file,
      imagem_nome: file.name,
      imagem_tipo: file.type,
      imagem_tamanho: file.size,
      imagem_remove: false,
      imagem_preview_url: null,
    });
    try {
      const thumb = await makeThumbnailDataUrl(file, 480, 0.7);
      updateItem(idx, { imagem_preview_url: thumb });
    } catch {
      updateItem(idx, { imagem_preview_url: URL.createObjectURL(file) });
    }
  }

  function handleClearImage(idx: number) {
    const current = itens[idx];
    if (current?.imagem_path) removeItemImage(current.imagem_path).catch(() => {});
    updateItem(idx, {
      imagem_path: null,
      imagem_file: null,
      imagem_preview_url: null,
      imagem_nome: null,
      imagem_tipo: null,
      imagem_tamanho: null,
      imagem_remove: true,
    });
  }

  async function save(nextStatus: "rascunho" | "enviada") {
    if (!empresaId) { toast.error("Empresa não selecionada"); return; }
    if (!head.titulo.trim()) { toast.error("Informe o título"); return; }
    if (itens.some((i) => !i.nome_item.trim())) { toast.error("Todos os itens precisam de nome"); return; }
    if (itens.some((i) => !i.quantidade_solicitada || i.quantidade_solicitada <= 0)) { toast.error("Quantidade solicitada deve ser maior que zero"); return; }

    setSaving(true);
    try {
      let solicId = solicitacaoId;

      if (!solicId) {
        const { data: numData, error: numErr } = await supabase.rpc("proximo_numero_solicitacao_material", { _empresa_id: empresaId });
        if (numErr) throw numErr;
        const { data: created, error: createErr } = await supabase.from("solicitacoes_materiais").insert({
          empresa_id: empresaId,
          numero_solicitacao: numData as unknown as string,
          titulo: head.titulo.trim(),
          unidade_id: head.unidade_id || null,
          obra_id: head.obra_id || null,
          local_obra: head.local_obra || null,
          setor: head.setor || null,
          solicitante_id: user?.id || null,
          solicitante_nome: head.solicitante_nome || null,
          data_solicitacao: head.data_solicitacao,
          data_necessidade: head.data_necessidade || null,
          prioridade: head.prioridade,
          justificativa: head.justificativa || null,
          observacoes: head.observacoes || null,
          status: nextStatus,
          created_by: user?.id || null,
        }).select("id").single();
        if (createErr) throw createErr;
        solicId = created.id;
      } else {
        const { error: updErr } = await supabase.from("solicitacoes_materiais").update({
          titulo: head.titulo.trim(),
          unidade_id: head.unidade_id || null,
          obra_id: head.obra_id || null,
          local_obra: head.local_obra || null,
          setor: head.setor || null,
          solicitante_nome: head.solicitante_nome || null,
          data_solicitacao: head.data_solicitacao,
          data_necessidade: head.data_necessidade || null,
          prioridade: head.prioridade,
          justificativa: head.justificativa || null,
          observacoes: head.observacoes || null,
          status: nextStatus,
        }).eq("id", solicId);
        if (updErr) throw updErr;
        // Simplify: delete existing itens and reinsert
        await supabase.from("solicitacoes_materiais_itens").delete().eq("solicitacao_id", solicId);
      }

      const finalItems = await Promise.all(itens.map(async (i) => {
        let newPath: string | null = i.imagem_path;
        let newNome: string | null = i.imagem_nome;
        let newTipo: string | null = i.imagem_tipo;
        let newTam: number | null = i.imagem_tamanho;
        // Remoção explícita
        if (i.imagem_remove && i.imagem_path) {
          await removeItemImage(i.imagem_path);
          newPath = null; newNome = null; newTipo = null; newTam = null;
        }
        // Upload de novo arquivo (substituindo eventual antigo)
        if (i.imagem_file) {
          const { blob, type, ext } = await compressImage(i.imagem_file);
          const path = buildItemImagePath(empresaId, solicId!, i._key, ext);
          await uploadItemImage(path, blob, type);
          if (i.imagem_path && i.imagem_path !== path) {
            removeItemImage(i.imagem_path).catch(() => {});
          }
          newPath = path;
          newNome = i.imagem_nome || i.imagem_file.name;
          newTipo = type;
          newTam = blob.size;
        }
        return { i, newPath, newNome, newTipo, newTam };
      }));

      const toInsert = finalItems.map(({ i, newPath, newNome, newTipo, newTam }, idx) => ({
        solicitacao_id: solicId!,
        empresa_id: empresaId,
        tipo_item: i.tipo_item,
        epi_id: i.epi_id || null,
        nome_item: i.nome_item.trim(),
        descricao: i.descricao || null,
        ca: i.ca || null,
        unidade_medida: i.unidade_medida,
        quantidade_solicitada: i.quantidade_solicitada,
        justificativa_item: i.justificativa_item || null,
        observacoes: i.observacoes || null,
        ordem: idx,
        imagem_path: newPath,
        imagem_nome: newNome,
        imagem_tipo: newTipo,
        imagem_tamanho: newTam,
      }));
      const { error: itErr } = await supabase.from("solicitacoes_materiais_itens").insert(toInsert);
      if (itErr) throw itErr;

      toast.success(nextStatus === "enviada" ? "Solicitação enviada" : "Solicitação salva");
      // Gravado no banco: o rascunho local cumpriu o papel e sai de cena.
      try { localStorage.removeItem(chaveRascunho); } catch { /* nada a fazer */ }
      setRascunhoRecuperado(false);
      onSaved();
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    } finally {
      setSaving(false);
    }
  }

  const readOnly = !["rascunho", "enviada"].includes(status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* A gaveta tinha largura de celular (768px) tambem no desktop: os campos
          ficavam empilhados numa coluna estreita e a solicitacao inteira virava
          rolagem. Em tela grande ela usa a largura que existe. */}
      {/* Era uma gaveta colada na borda direita: num monitor grande sobrava uma
          faixa morta de ~470px so do lado esquerdo, e o conteudo encostava na
          barra de rolagem da direita. Formulario longo de desktop pede janela
          centralizada — margem igual dos dois lados e largura aproveitada.
          Em telas pequenas continua ocupando tudo. */}
      <DialogContent className={[
        // Celular: ocupa a tela toda.
        "p-0 gap-0 flex flex-col w-[calc(100vw-1rem)] h-[calc(100dvh-1rem)]",
        // Desktop: TODAS as sobreposicoes precisam do prefixo `sm:`. O
        // DialogContent base traz sm:max-w-lg, sm:grid, sm:p-6, sm:max-h-[90vh]
        // — e o tailwind-merge nao considera `max-w-[1400px]` sem prefixo como
        // substituto de `sm:max-w-lg`. Foi o que aconteceu: a janela ficou nos
        // 512px do padrao, mais estreita do que a gaveta que ela substituiu.
        "sm:flex sm:flex-col sm:p-0 sm:gap-0",
        "sm:w-[calc(100vw-4rem)] sm:max-w-[1400px]",
        "sm:h-[92vh] sm:max-h-[92vh]",
      ].join(" ")}>
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle>{solicitacaoId ? "Editar Solicitação" : "Nova Solicitação de Materiais"}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Dados gerais */}
            <Card>
              <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 [&>*]:min-w-0">
                {rascunhoRecuperado && (
                  <div className="sm:col-span-3 flex flex-wrap items-center gap-2 rounded border border-sky-300 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                    <span>
                      Recuperamos o que você tinha preenchido antes de sair. A foto do item
                      precisa ser escolhida de novo.
                    </span>
                    <Button
                      type="button" size="sm" variant="ghost" className="h-7 text-xs ml-auto"
                      onClick={() => {
                        try { localStorage.removeItem(chaveRascunho); } catch { /* nada a fazer */ }
                        setHead({ ...emptyHead(), solicitante_nome: user?.email?.split("@")[0] || "" });
                        setItens([emptyItem()]);
                        setRascunhoRecuperado(false);
                      }}
                    >
                      Começar do zero
                    </Button>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <Label>Título *</Label>
                  <Input value={head.titulo} onChange={(e) => setHead({ ...head, titulo: e.target.value })} disabled={readOnly} placeholder="Ex: Reposição EPIs frente de serviço" />
                </div>
                {/* Unidade / filial: vem de Empresas / Unidades. Antes o unico
                    seletor era o de `obras`, tabela vazia nesta empresa — a
                    lista so oferecia "— Nenhuma —" com tres filiais
                    cadastradas ao lado. */}
                <div>
                  <Label>Unidade / Filial</Label>
                  <Select value={head.unidade_id || "__none"}
                    onValueChange={(v) => setHead({ ...head, unidade_id: v === "__none" ? "" : v })}
                    disabled={readOnly}>
                    <SelectTrigger>
                      <SelectValue placeholder={unidades.length ? "Selecione…" : "Nenhuma unidade cadastrada"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— Matriz —</SelectItem>
                      {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Obras so aparece quando ha obra cadastrada: seletor com uma
                    opcao unica "— Nenhuma —" e campo que nunca pode ser usado. */}
                {obras.length > 0 && (
                  <div>
                    <Label>Obra / Local (cadastrado)</Label>
                    <Select value={head.obra_id || "__none"} onValueChange={(v) => setHead({ ...head, obra_id: v === "__none" ? "" : v })} disabled={readOnly}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">— Nenhuma —</SelectItem>
                        {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Local (texto livre)</Label>
                  <Input value={head.local_obra} onChange={(e) => setHead({ ...head, local_obra: e.target.value })} disabled={readOnly} placeholder="Ex: Obra Rua X - Bloco B" />
                </div>
                <div>
                  <Label>Setor</Label>
                  <Input value={head.setor} onChange={(e) => setHead({ ...head, setor: e.target.value })} disabled={readOnly} />
                </div>
                <div>
                  <Label>Solicitante</Label>
                  <Input value={head.solicitante_nome} onChange={(e) => setHead({ ...head, solicitante_nome: e.target.value })} disabled={readOnly} />
                </div>
                <div>
                  <Label>Data da Solicitação</Label>
                  <Input type="date" value={head.data_solicitacao} onChange={(e) => setHead({ ...head, data_solicitacao: e.target.value })} disabled={readOnly} />
                </div>
                <div>
                  <Label>Data de Necessidade</Label>
                  <Input type="date" value={head.data_necessidade} onChange={(e) => setHead({ ...head, data_necessidade: e.target.value })} disabled={readOnly} />
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <Select value={head.prioridade} onValueChange={(v: any) => setHead({ ...head, prioridade: v })} disabled={readOnly}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label>Justificativa</Label>
                  <Textarea rows={2} value={head.justificativa} onChange={(e) => setHead({ ...head, justificativa: e.target.value })} disabled={readOnly} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Observações</Label>
                  <Textarea rows={2} value={head.observacoes} onChange={(e) => setHead({ ...head, observacoes: e.target.value })} disabled={readOnly} />
                </div>
              </CardContent>
            </Card>

            {/* Itens */}
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Itens solicitados ({itens.length})</h3>
              {!readOnly && (
                <Button size="sm" variant="outline" onClick={addItem} className="gap-1"><Plus className="w-4 h-4" /> Adicionar item</Button>
              )}
            </div>

            {itens.map((it, idx) => (
              <Card key={idx}>
                <CardContent className="p-3 space-y-3">
                  {/* Cabecalho do item primeiro: antes a caixa da foto vinha
                      acima de tudo, ocupando a largura inteira, e o "Item #1"
                      aparecia depois dela — a foto e o acessorio, o item e o
                      assunto. */}
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-sm font-semibold">Item {idx + 1}</span>
                    {!readOnly && itens.length > 1 && (
                      <Button size="sm" variant="ghost" className="text-destructive h-8" onClick={() => removeItem(idx)}>
                        <Trash2 className="w-4 h-4 mr-1" /> Remover
                      </Button>
                    )}
                  </div>

                  {/* No desktop a foto vai para uma coluna estreita a direita e
                      os campos ficam com a largura toda. No celular ela volta
                      para cima, que e o fluxo de quem esta em campo com a
                      camera na mao. */}
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="order-last lg:order-first min-w-0 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                    <div className="sm:col-span-2">
                      <Label className="text-xs">Tipo</Label>
                      <Select value={it.tipo_item} onValueChange={(v) => updateItem(idx, { tipo_item: v, epi_id: v === "EPI" ? it.epi_id : null })} disabled={readOnly}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EPI">EPI</SelectItem>
                          <SelectItem value="EPC">EPC</SelectItem>
                          <SelectItem value="Material de Segurança">Material de Segurança</SelectItem>
                          <SelectItem value="Ferramenta">Ferramenta</SelectItem>
                          <SelectItem value="Outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {it.tipo_item === "EPI" && (
                      <div className="sm:col-span-4">
                        <Label className="text-xs">Buscar do cadastro de EPIs</Label>
                        <Select value={it.epi_id || "__manual"} onValueChange={(v) => v === "__manual" ? updateItem(idx, { epi_id: null }) : pickEpi(idx, v)} disabled={readOnly}>
                          <SelectTrigger><SelectValue placeholder="Selecione um EPI..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__manual">— Digitar manualmente —</SelectItem>
                            {epis.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}{e.ca ? ` — CA ${e.ca}` : ""}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="sm:col-span-4">
                      <Label className="text-xs">Nome do item *</Label>
                      <Input value={it.nome_item} onChange={(e) => updateItem(idx, { nome_item: e.target.value })} disabled={readOnly} />
                    </div>
                    <div>
                      <Label className="text-xs">CA</Label>
                      <Input value={it.ca} onChange={(e) => updateItem(idx, { ca: e.target.value })} disabled={readOnly} />
                    </div>
                    <div>
                      <Label className="text-xs">Unidade</Label>
                      <Select value={it.unidade_medida} onValueChange={(v) => updateItem(idx, { unidade_medida: v })} disabled={readOnly}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["un", "par", "caixa", "metro", "kit", "kg", "litro"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Qtd solicitada *</Label>
                      <Input type="number" min={0} step={1} value={it.quantidade_solicitada} onChange={(e) => updateItem(idx, { quantidade_solicitada: Number(e.target.value) })} disabled={readOnly} />
                    </div>
                    <div className="sm:col-span-3">
                      <Label className="text-xs">Justificativa do item</Label>
                      <Input value={it.justificativa_item} onChange={(e) => updateItem(idx, { justificativa_item: e.target.value })} disabled={readOnly} />
                    </div>
                    <div className="sm:col-span-3">
                      <Label className="text-xs">Observações</Label>
                      <Input value={it.observacoes} onChange={(e) => updateItem(idx, { observacoes: e.target.value })} disabled={readOnly} />
                    </div>
                  </div>
                    </div>

                    <div className="order-first lg:order-last min-w-0">
                      <ItemImageField item={it} idx={idx} readOnly={readOnly} onPick={handlePickImage} onClear={handleClearImage} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="border-t p-3 flex flex-col sm:flex-row gap-2 sm:justify-end bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          {!readOnly && (
            <>
              <Button variant="secondary" onClick={() => save("rascunho")} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar rascunho
              </Button>
              <Button onClick={() => save("enviada")} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar solicitação
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ItemImageField({ item, idx, readOnly, onPick, onClear }: {
  item: ItemForm;
  idx: number;
  readOnly: boolean;
  onPick: (idx: number, file: File | null) => void;
  onClear: (idx: number) => void;
}) {
  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.log("[Solicitação Materiais] ItemImageField renderizado", { idx });
  }
  const hasImage = !!((item.imagem_preview_url || item.imagem_path) && !item.imagem_remove);
  const inputId = `img-file-${item._key}`;
  const cameraId = `img-cam-${item._key}`;


  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2" data-solmat-image-block="true">
      <input id={inputId} type="file" accept="image/*" className="sr-only"
        onChange={(e) => { onPick(idx, e.target.files?.[0] || null); e.currentTarget.value = ""; }} />
      <input id={cameraId} type="file" accept="image/*" capture="environment" className="sr-only"
        onChange={(e) => { onPick(idx, e.target.files?.[0] || null); e.currentTarget.value = ""; }} />

      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-semibold">Foto do material <span className="font-normal text-muted-foreground">(opcional)</span></Label>
        {hasImage && !readOnly && (
          <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => onClear(idx)}>
            <X className="w-4 h-4 mr-1" /> Remover foto
          </Button>
        )}
      </div>

      {hasImage ? (
        <div className="relative overflow-hidden rounded-md border bg-background">
          {item.imagem_preview_url ? (
            <img src={item.imagem_preview_url} alt={item.imagem_nome || "Imagem do material"} className="h-32 w-full object-contain" />
          ) : (
            <div className="flex h-32 w-full items-center justify-center text-sm text-muted-foreground">Imagem anexada</div>
          )}
          {hasImage && !readOnly && (
            <button
              type="button"
              aria-label="Remover imagem do material"
              className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground"
              onClick={() => onClear(idx)}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-md border border-dashed bg-background py-4 text-center text-muted-foreground">
          <ImageIcon className="mx-auto h-6 w-6" />
          <div className="mt-1 text-xs">Sem foto</div>
        </div>
      )}

      {!readOnly && (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          <Label
            htmlFor={cameraId}
            className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            <Camera className="w-4 h-4" /> Câmera
          </Label>
          <Label
            htmlFor={inputId}
            className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          >
            <ImageIcon className="w-4 h-4" /> Galeria
          </Label>
        </div>
      )}

      <div className="text-[11px] text-muted-foreground">
        {item.imagem_nome ? `${item.imagem_nome}${item.imagem_tamanho ? ` • ${(item.imagem_tamanho / 1024).toFixed(0)} KB` : ""}` : "Até 20 MB."}
      </div>
    </div>
  );
}
