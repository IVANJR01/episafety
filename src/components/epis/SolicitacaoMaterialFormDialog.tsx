import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import NetworkErrorBoundary from "@/components/NetworkErrorBoundary";
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
  compressImage, prepararImagemItem, buildItemImagePath, uploadItemImage,
  getSignedImageUrl, removeItemImage, descartarPreview, imagemDeTransferencia,
} from "@/lib/solicitacaoMateriaisImagens";
import { enviarEmailSolicitacao } from "@/lib/solicitacaoMateriaisEmail";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  solicitacaoId: string | null;
  /**
   * `fechar` diz se a janela deve sair de cena. "Enviar solicitação" encerra o
   * trabalho e fecha; "Salvar rascunho" e um ponto de gravacao no meio do
   * caminho — a lista atualiza atras, mas o formulario continua aberto.
   */
  onSaved: (fechar: boolean) => void;
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
  /** Ja comprimida na escolha — evita decodificar a foto de novo ao salvar. */
  imagem_blob?: Blob | null;
  imagem_ext?: string;
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
  /*
   * O que ja foi gravado nesta abertura da janela.
   *
   * Sem isto, salvar rascunho duas vezes com a janela aberta criaria DUAS
   * solicitacoes: a segunda gravacao nao teria como saber que a primeira ja
   * existe — o id dela so chegaria ao componente por `solicitacaoId`, que e a
   * propriedade de quem abriu a janela e nao muda sozinha.
   *
   * O numero vem junto porque quem o gera e o banco, na criacao. Pedi-lo de
   * novo devolve o PROXIMO da sequencia, nao o desta solicitacao.
   */
  const [idSalvo, setIdSalvo] = useState<string | null>(null);
  const [numeroSalvo, setNumeroSalvo] = useState<string | null>(null);

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
  const userEmail = user?.email || "";

  /** Ja abre aberto quando algum dos campos opcionais tem conteudo — esconder
   *  o que foi preenchido faria a pessoa achar que se perdeu. */
  const temDetalhes = !!(
    head.local_obra?.trim() || head.setor?.trim()
    || head.justificativa?.trim() || head.observacoes?.trim()
  );

  // Grava o rascunho a cada mudanca, so em solicitacao nova.
  useEffect(() => {
    // `idSalvo`: depois de "Salvar rascunho" a copia boa esta no banco.
    // Continuar gravando aqui faria a proxima "Nova Solicitacao" reaparecer
    // preenchida com o que ja virou solicitacao — parecendo duplicada.
    if (!open || solicitacaoId || idSalvo || !empresaId) return;
    try {
      const semArquivos = itens.map(({ imagem_file: _f, imagem_preview_url: _p, imagem_blob: _b, ...resto }) => resto);
      localStorage.setItem(chaveRascunho, JSON.stringify({ head, itens: semArquivos }));
    } catch { /* cota cheia ou modo restrito: rascunho e conveniencia, nao pode quebrar o formulario */ }
  }, [head, itens, open, solicitacaoId, idSalvo, empresaId, chaveRascunho]);

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
    // Janela nova, gravacao nova: sem isto, abrir "Nova Solicitacao" logo depois
    // de salvar um rascunho escreveria por cima da solicitacao anterior.
    setIdSalvo(null);
    setNumeroSalvo(null);
    if (!solicitacaoId) {
      const base = { ...emptyHead(), solicitante_nome: userEmail.split("@")[0] || "" };
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
  }, [open, solicitacaoId, userEmail, chaveRascunho]);

  /**
   * Busca a URL assinada das fotos ja salvas.
   *
   * A dependencia precisa dizer "quais fotos ainda faltam resolver", nao apenas
   * quais existem. Com so os caminhos, reabrir a MESMA solicitacao dava a mesma
   * string de dependencia: o efeito nao rodava de novo, e como o recarregamento
   * dos itens zera o preview, as fotos ficavam para sempre no aviso "Imagem
   * anexada". Na primeira abertura apareciam; da segunda em diante, nunca mais.
   */
  const fotosPendentes = itens
    .map((i) => `${i.imagem_path || ""}${i.imagem_preview_url ? "#ok" : ""}`)
    .join("|");

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
        // Essa URL assinada foi buscada para a foto que estava salva quando o
        // efeito disparou. Se nesse meio-tempo (é rede de verdade, demora) a
        // pessoa trocou a foto do item — já tem imagem_file ou preview novos —
        // aplicar aqui sobrescreveria a escolha nova pela antiga.
        if (it.imagem_file || it.imagem_preview_url) return it;
        return { ...it, imagem_preview_url: resolved[found] };
      }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotosPendentes]);

  function updateItem(idx: number, patch: Partial<ItemForm>) {
    setItens((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }
  function pickEpi(idx: number, epiId: string) {
    const epi = epis.find((e) => e.id === epiId);
    if (!epi) return;
    updateItem(idx, { epi_id: epi.id, nome_item: epi.nome, ca: epi.ca || "" });
  }
  /*
   * O item novo entra no fim da lista — e a tela vai atras dele.
   *
   * Sem isso, "Adicionar item" numa solicitacao que ja tem dois itens punha o
   * cartao novo abaixo da dobra: medido, ele nascia a 1533 px numa janela de
   * 1100. Da onde a pessoa estava olhando nada mudava, e a impressao era de
   * que o item nao tinha sido criado, ou de que a tela tinha voltado para o
   * primeiro.
   */
  const [itemParaMostrar, setItemParaMostrar] = useState<number | null>(null);
  function addItem() {
    setItens((p) => {
      setItemParaMostrar(p.length);
      return [...p, emptyItem()];
    });
  }
  useEffect(() => {
    if (itemParaMostrar === null) return;
    // Depois do desenho do cartao novo, senao nao ha o que rolar ate.
    const id = requestAnimationFrame(() => {
      const cartao = document.querySelector<HTMLElement>(`[data-item-indice="${itemParaMostrar}"]`);
      cartao?.scrollIntoView({ behavior: "smooth", block: "center" });
      // O cursor ja no nome: e o unico campo obrigatorio do item, e e onde a
      // pessoa ia clicar em seguida de qualquer jeito.
      cartao?.querySelector<HTMLInputElement>('[data-campo="nome-item"]')?.focus({ preventScroll: true });
      setItemParaMostrar(null);
    });
    return () => cancelAnimationFrame(id);
  }, [itemParaMostrar]);

  function removeItem(idx: number) {
    const it = itens[idx];
    descartarPreview(it?.imagem_preview_url);
    if (it?.imagem_path) removeItemImage(it.imagem_path).catch(() => {});
    setItens((p) => p.filter((_, i) => i !== idx));
  }

  async function handlePickImage(idx: number, file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/") && !ACCEPTED_IMG_TYPES.includes(file.type)) { toast.error("Formato inválido. Use uma imagem da câmera ou galeria."); return; }
    if (file.size > MAX_IMG_BYTES) { toast.error("Imagem acima de 20 MB."); return; }
    // A miniatura anterior deixa de existir aqui: sem devolver o endereco de
    // blob, o binario dela fica preso na memoria ate a aba fechar.
    descartarPreview(itens[idx]?.imagem_preview_url);
    updateItem(idx, {
      imagem_file: file,
      imagem_nome: file.name,
      imagem_tipo: file.type,
      imagem_tamanho: file.size,
      imagem_remove: false,
      imagem_preview_url: null,
    });
    try {
      // Uma decodificacao so: sai dali a miniatura da tela e o arquivo que vai
      // subir. O original nao e decodificado outra vez na hora de salvar.
      const { blob, type, ext, thumb } = await prepararImagemItem(file);
      updateItem(idx, {
        imagem_preview_url: thumb, imagem_blob: blob, imagem_ext: ext,
        imagem_tipo: type, imagem_tamanho: blob.size,
      });
    } catch {
      updateItem(idx, { imagem_preview_url: URL.createObjectURL(file) });
    }
  }

  function handleClearImage(idx: number) {
    const current = itens[idx];
    descartarPreview(current?.imagem_preview_url);
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
      // Vale o id de quem abriu a janela; na falta dele, o da gravacao
      // anterior feita aqui mesmo (salvar rascunho sem fechar).
      let solicId = solicitacaoId || idSalvo;

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
        }).select("id, numero_solicitacao").single();
        if (createErr) throw createErr;
        solicId = created.id;
        setIdSalvo(created.id);
        setNumeroSalvo((created as { numero_solicitacao?: string }).numero_solicitacao || null);
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
        // Upload de novo arquivo (substituindo eventual antigo).
        //
        // A falha do upload NAO pode derrubar a solicitacao. Era o que
        // acontecia: o erro subia, o catch de fora abortava tudo e a pessoa
        // perdia titulo, itens, quantidades — por causa de uma foto, que e
        // opcional. Foi assim que o "Bucket not found" apagou o trabalho todo.
        let falhaFoto: string | null = null;
        if (i.imagem_file) {
          try {
            // Reaproveita o que ja foi comprimido na escolha da foto; so
            // comprime aqui se por algum motivo nao houver (fallback).
            const { blob, type, ext } = i.imagem_blob
              ? { blob: i.imagem_blob, type: i.imagem_tipo || "image/jpeg", ext: i.imagem_ext || "jpg" }
              : await compressImage(i.imagem_file);
            const path = buildItemImagePath(empresaId, solicId!, i._key, ext);
            await uploadItemImage(path, blob, type);
            if (i.imagem_path && i.imagem_path !== path) {
              removeItemImage(i.imagem_path).catch(() => {});
            }
            newPath = path;
            newNome = i.imagem_nome || i.imagem_file.name;
            newTipo = type;
            newTam = blob.size;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            falhaFoto = /bucket not found/i.test(msg)
              ? "o espaço de armazenamento de imagens ainda não foi criado no Supabase"
              : msg;
            console.error("[solicitacao] falha ao enviar a foto do item:", e);
          }
        }
        return { i, newPath, newNome, newTipo, newTam, falhaFoto };
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

      // A solicitação foi gravada; se alguma foto não subiu, avisa sem fingir
      // que deu tudo certo — o item fica sem imagem e pode ser reenviado depois.
      const fotosComFalha = finalItems.filter((x) => x.falhaFoto);
      if (fotosComFalha.length) {
        toast.warning(
          `Solicitação salva, mas ${fotosComFalha.length === 1 ? "a foto de 1 item não foi enviada" : `as fotos de ${fotosComFalha.length} itens não foram enviadas`}`,
          { description: `Motivo: ${fotosComFalha[0].falhaFoto}. O resto foi gravado normalmente.`, duration: 10000 },
        );
      } else {
        toast.success(nextStatus === "enviada" ? "Solicitação enviada ✓" : "Solicitação salva");
      }

      // Enviar email automaticamente quando a solicitação for enviada.
      // Roda de forma assíncrona (não bloqueia o fechamento do formulário), mas
      // o resultado real do envio é sempre avisado — nunca só assumido.
      if (nextStatus === "enviada") {
        (async () => {
          const { data: empData } = await supabase
            .from("empresa_config")
            .select("nome")
            .eq("id", empresaId)
            .maybeSingle();

          /*
           * O numero desta solicitacao, lido de onde ele realmente esta.
           *
           * Antes: em solicitacao ja existente lia `head.numero_solicitacao`,
           * campo que nao existe em `head` — o e-mail para compras saia com o
           * numero "—". Em solicitacao nova pedia OUTRO numero ao banco, que
           * devolve o proximo da sequencia: o e-mail anunciava um numero que
           * nao era o da solicitacao gravada.
           */
          let numero = numeroSalvo;
          if (!numero) {
            const { data: linha } = await supabase
              .from("solicitacoes_materiais").select("numero_solicitacao").eq("id", solicId!).maybeSingle();
            numero = (linha as { numero_solicitacao?: string } | null)?.numero_solicitacao || null;
          }

          const resultado = await enviarEmailSolicitacao(
            solicId!,
            numero || "—",
            head.titulo,
            empresaId,
            (empData as any)?.nome,
            head.setor,
            head.solicitante_nome,
            head.prioridade,
            head.data_necessidade
          );

          if (resultado.enviado && resultado.aviso) {
            // Saiu, mas não para todo mundo: dizer "sucesso" aqui faria
            // acreditar que as outras pessoas foram avisadas.
            toast.warning(`Email enviado só para ${resultado.emailDestino}`, {
              description: resultado.aviso, duration: 12000,
            });
          } else if (resultado.enviado) {
            toast.success(`Email enviado para o setor de compras (${resultado.emailDestino})`);
          } else if (resultado.modoDebug) {
            toast.warning("Email NÃO foi enviado de verdade", {
              description: `A função de envio está em modo debug (sem chave de API configurada). Configure RESEND_API_KEY no Supabase. Destinatário: ${resultado.emailDestino}`,
              duration: 10000,
            });
          } else {
            toast.error("Falha ao enviar email para compras", { description: resultado.erro || "Falha desconhecida" });
          }
        })().catch((e) => console.error("[solicitacao] Erro ao enviar email:", e));
      }

      // Gravado no banco: o rascunho local cumpriu o papel e sai de cena.
      try { localStorage.removeItem(chaveRascunho); } catch { /* nada a fazer */ }
      setRascunhoRecuperado(false);
      setStatus(nextStatus);
      /*
       * "Salvar rascunho" nao fecha a janela.
       *
       * Fechava — e rascunho e justamente o botao de quem NAO terminou: a
       * pessoa gravava para nao perder o que ja tinha digitado e era posta
       * para fora, tendo de achar a solicitacao na lista e reabrir para
       * continuar de onde parou. Quem termina usa "Enviar solicitacao", e esse
       * continua fechando.
       */
      onSaved(nextStatus === "enviada");
    } catch (e: any) {
      toast.error("Erro ao salvar", { description: e.message });
    } finally {
      setSaving(false);
    }
  }

  const readOnly = !["rascunho", "enviada"].includes(status);

  /*
   * A lista de itens vista de dentro da escuta de colagem, logo abaixo. Sem
   * isto a escuta precisaria ser refeita a cada item adicionado ou removido, e
   * uma escuta refeita no meio de um Ctrl+V perde a colagem.
   */
  const itensRef = useRef(itens);
  useEffect(() => { itensRef.current = itens; }, [itens]);

  /*
   * Colar (Ctrl+V) a imagem em qualquer lugar do formulario.
   *
   * O caminho de sempre era: salvar o print num arquivo, clicar em Galeria,
   * achar o arquivo na pasta. Com o print ja na area de transferencia, isso e
   * trabalho a toa — quem pediu o material geralmente acabou de copiar a foto
   * do fornecedor ou um print do catalogo.
   *
   * A escuta fica no documento, e nao so na caixa da foto, porque o Ctrl+V da
   * pessoa acontece onde o cursor estiver: dentro do nome do item, num campo
   * de quantidade, ou sem foco nenhum. Como `imagemDeTransferencia` devolve
   * null quando a colagem e texto, colar texto num campo continua funcionando
   * normalmente — este trecho so age quando ha imagem de verdade.
   */
  const [itemAtivo, setItemAtivo] = useState(0);
  useEffect(() => {
    if (!open || readOnly) return;
    const aoColar = (evento: ClipboardEvent) => {
      const imagem = imagemDeTransferencia(evento.clipboardData);
      if (!imagem) return; // colagem de texto: nao e assunto nosso
      evento.preventDefault();
      // Com um item so nao ha duvida de destino. Com varios, vale o ultimo em
      // que a pessoa mexeu — que e onde ela esta olhando.
      const destino = Math.min(itemAtivo, itensRef.current.length - 1);
      void handlePickImage(Math.max(0, destino), imagem);
      toast.success(`Imagem colada no item ${Math.max(0, destino) + 1}`);
    };
    document.addEventListener("paste", aoColar);
    return () => document.removeEventListener("paste", aoColar);
  }, [open, readOnly, itemAtivo]);


  /**
   * Cutuca o navegador a redesenhar quando a janela volta ao foco.
   *
   * Abrir Camera/Galeria sobe o seletor do sistema por cima e tira a janela de
   * cena; o navegador descarta o desenho guardado e, ao voltar, precisa refazer
   * tudo. Com varias fotos esse retorno falhava e o dialogo ficava branco —
   * medido: o conteudo continua todo no lugar e nenhum erro e disparado, ou
   * seja, o que faltou foi o redesenho, nao o conteudo.
   *
   * Mexer numa propriedade visual e desfazer no quadro seguinte invalida a
   * pintura e obriga o desenho a ser refeito. E imperceptivel.
   */
  const conteudoRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const redesenhar = () => {
      const el = conteudoRef.current;
      if (!el) return;
      el.style.opacity = "0.999";
      requestAnimationFrame(() => { if (conteudoRef.current) conteudoRef.current.style.opacity = ""; });
    };
    window.addEventListener("focus", redesenhar);
    document.addEventListener("visibilitychange", redesenhar);
    return () => {
      window.removeEventListener("focus", redesenhar);
      document.removeEventListener("visibilitychange", redesenhar);
    };
  }, [open]);

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
      <DialogContent ref={conteudoRef} className={[
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
        // A base traz `overflow-y-auto` (e `sm:overflow-y-auto`). Com o corpo
        // tambem rolando (flex-1 overflow-y-auto), ficavam DUAS areas de
        // rolagem aninhadas: o rodape era empurrado para o meio e sobrava um
        // vazio enorme embaixo dele. Quem rola e so o corpo.
        "overflow-hidden sm:overflow-hidden",
        // Centralizacao SEM transform.
        //
        // O padrao centraliza com left/top 50% + translate(-50%,-50%). Isso
        // promove o dialogo inteiro a uma camada composta, e o conteudo dela e
        // rasterizado de uma vez. Este formulario e alto (9 itens passam de
        // 4000px) e cada foto adicionada aumenta o custo dessa camada; quando a
        // rasterizacao nao cabe, o navegador pinta a camada em branco. Era
        // exatamente o sintoma: tudo DENTRO do elemento com transform sumia —
        // cabecalho, itens, rodape e ate o botao de fechar — enquanto o fundo
        // escurecido e o menu lateral, que estao fora dele, continuavam
        // normais, e nenhum erro de JavaScript era disparado.
        //
        // `inset-0 m-auto` com largura e altura definidas centraliza igual, sem
        // camada transformada.
        "sm:inset-0 sm:m-auto sm:translate-x-0 sm:translate-y-0",
      ].join(" ")}>
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle>{solicitacaoId ? "Editar Solicitação" : "Nova Solicitação de Materiais"}</DialogTitle>
        </DialogHeader>

        {/* Se algo aqui dentro quebrar, o dialogo mostrava so um retangulo branco:
            o erro derrubava o conteudo e nao sobrava nem mensagem nem como sair.
            A barreira mantem o cabecalho, explica e deixa fechar ou recarregar. */}
        <NetworkErrorBoundary
          fallback={
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mx-auto max-w-lg space-y-3 text-center">
                <h3 className="text-base font-semibold">Não foi possível exibir o formulário</h3>
                <p className="text-sm text-muted-foreground">
                  Ocorreu um erro nesta solicitação. O que você digitou fica guardado como rascunho
                  nesta empresa — feche e abra de novo para continuar.
                </p>
                <div className="flex justify-center gap-2 pt-1">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
                  <Button onClick={() => window.location.reload()}>Recarregar a página</Button>
                </div>
              </div>
            </div>
          }
        >
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
                        setHead({ ...emptyHead(), solicitante_nome: userEmail.split("@")[0] || "" });
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
                {/* Local, setor, justificativa e observacoes sao opcionais e
                    raramente preenchidos, mas ocupavam metade da altura do
                    cabecalho — as duas caixas de texto ainda por cima paravam em
                    2/3 da largura, deixando uma coluna vazia ao lado. Ficam
                    recolhidos ate serem pedidos. O resumo diz o que ja tem
                    conteudo, para nada ficar escondido sem aviso. */}
                <details className="sm:col-span-3 rounded-lg border bg-muted/30 px-3 py-2" open={temDetalhes}>
                  <summary className="cursor-pointer select-none text-xs font-medium text-slate-700">
                    Detalhes {temDetalhes ? "— preenchidos" : "(opcional)"}
                  </summary>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Local (texto livre)</Label>
                      <Input value={head.local_obra} onChange={(e) => setHead({ ...head, local_obra: e.target.value })} disabled={readOnly} placeholder="Ex: Obra Rua X - Bloco B" />
                    </div>
                    <div>
                      <Label>Setor</Label>
                      <Input value={head.setor} onChange={(e) => setHead({ ...head, setor: e.target.value })} disabled={readOnly} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Justificativa</Label>
                      <Textarea rows={2} value={head.justificativa} onChange={(e) => setHead({ ...head, justificativa: e.target.value })} disabled={readOnly} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Observações</Label>
                      <Textarea rows={2} value={head.observacoes} onChange={(e) => setHead({ ...head, observacoes: e.target.value })} disabled={readOnly} />
                    </div>
                  </div>
                </details>
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
              /*
               * `content-visibility: auto` faz o navegador NAO desenhar o item
               * enquanto ele esta fora da area visivel.
               *
               * A tela apagava ao clicar em Camera/Galeria com tres fotos ou
               * mais. Medido: o DOM continua inteiro, nenhum filho some e
               * nenhum erro e disparado — ou seja, nao e o React removendo
               * nada, e o navegador que nao consegue redesenhar. Quando o
               * seletor de arquivos do Windows sobe, a janela sai de cena e o
               * desenho guardado e descartado; ao voltar, tudo precisa ser
               * refeito de uma vez, e com varias fotos grandes esse redesenho
               * nao cabe.
               *
               * Desenhando so o que esta na tela, o custo do retorno passa a
               * ser o de um ou dois itens, nao o da solicitacao inteira.
               * `contain-intrinsic-size` reserva a altura aproximada para a
               * barra de rolagem nao pular.
               */
              /* `onFocusCapture` e `onPointerDown` marcam em qual item a
                 pessoa esta mexendo: e para la que vai a imagem colada quando
                 a solicitacao tem mais de um item. */
              <Card
                key={idx}
                data-item-indice={idx}
                onFocusCapture={() => setItemAtivo(idx)}
                onPointerDown={() => setItemAtivo(idx)}
                className="[content-visibility:auto] [contain-intrinsic-size:auto_420px]"
              >
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
                      <Input data-campo="nome-item" value={it.nome_item} onChange={(e) => updateItem(idx, { nome_item: e.target.value })} disabled={readOnly} />
                    </div>
                    <div>
                      <Label className="text-xs">Referência</Label>
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
        </NetworkErrorBoundary>

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
  const hasImage = !!((item.imagem_preview_url || item.imagem_path) && !item.imagem_remove);
  const inputId = `img-file-${item._key}`;
  const cameraId = `img-cam-${item._key}`;

  /**
   * So mantem a foto na tela enquanto ela esta por perto da area visivel.
   *
   * Cada foto exibida e uma imagem que o navegador precisa manter decodificada
   * e redesenhar. Com tres fotos ou mais, ao abrir Camera/Galeria a janela sai
   * de cena, o desenho guardado e descartado e o retorno exige refazer tudo de
   * uma vez — foi ai que a tela apagou. Medido no proprio formulario: o DOM
   * continua inteiro e nenhum erro e disparado, ou seja, o que falta e
   * capacidade de redesenho, nao codigo.
   *
   * Fora da area visivel entra uma caixa do mesmo tamanho: a rolagem nao muda
   * de comportamento e a foto volta assim que chega perto.
   */
  const caixaRef = useRef<HTMLDivElement | null>(null);
  const [porPerto, setPorPerto] = useState(true);
  const [arrastando, setArrastando] = useState(false);
  useEffect(() => {
    const alvo = caixaRef.current;
    if (!alvo || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entradas) => setPorPerto(entradas.some((e) => e.isIntersecting)),
      { rootMargin: "300px 0px" },
    );
    obs.observe(alvo);
    return () => obs.disconnect();
  }, []);


  /*
   * Arrastar a imagem de outra janela e soltar aqui.
   *
   * `dropEffect = "copy"` troca o cursor para o de copia enquanto a imagem
   * esta sobre a caixa — sem isso o navegador mostra o de "proibido" e a
   * pessoa solta em outro lugar achando que nao da. `preventDefault` no
   * arrastar e obrigatorio: sem ele o navegador ABRE o arquivo solto numa aba
   * nova e o formulario preenchido some.
   */
  const aoArrastar = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setArrastando(true);
  };
  const aoSoltar = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    setArrastando(false);
    const imagem = imagemDeTransferencia(e.dataTransfer);
    if (!imagem) { toast.error("Arraste um arquivo de imagem."); return; }
    onPick(idx, imagem);
  };

  return (
    <div
      ref={caixaRef}
      onDragOver={aoArrastar}
      onDragEnter={aoArrastar}
      onDragLeave={() => setArrastando(false)}
      onDrop={aoSoltar}
      className={`rounded-md border bg-muted/30 p-3 space-y-2 transition-colors ${
        arrastando ? "border-primary border-2 bg-primary/5" : ""
      }`}
      data-solmat-image-block="true"
    >
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
          {item.imagem_preview_url && porPerto ? (
            <img
              src={item.imagem_preview_url}
              alt={item.imagem_nome || "Imagem do material"}
              /* Foto de item fora da tela nao precisa estar decodificada na
                 memoria, e decodificar fora do fluxo principal evita travar o
                 formulario no momento em que a foto entra. */
              loading="lazy"
              decoding="async"
              className="h-32 w-full object-contain"
            />
          ) : (
            <div className="flex h-32 w-full items-center justify-center text-sm text-muted-foreground">
              {item.imagem_preview_url ? "" : "Imagem anexada"}
            </div>
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
        <div className="rounded-md border border-dashed bg-background px-2 py-4 text-center text-muted-foreground">
          <ImageIcon className="mx-auto h-6 w-6" />
          {/* A caixa vazia dizia so "Sem foto" — nao contava que da para colar
              nem arrastar, e essas duas sao justamente as formas rapidas. */}
          <div className="mt-1 text-xs font-medium">Sem foto</div>
          {!readOnly && (
            /* So a partir de tela de computador: no celular nao ha Ctrl+V nem
               arrastar, e a dica viraria instrucao para algo impossivel. La os
               tres botoes abaixo ja cobrem. */
            <div className="mt-1 hidden text-[11px] leading-tight sm:block">
              Cole com <kbd className="rounded border bg-muted px-1 font-sans">Ctrl</kbd>+
              <kbd className="rounded border bg-muted px-1 font-sans">V</kbd> ou arraste a imagem aqui
            </div>
          )}
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
