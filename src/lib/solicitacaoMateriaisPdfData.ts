import { supabase } from "@/integrations/supabase/client";
import { loadImageAsDataUrl } from "@/lib/solicitacaoMateriaisImagens";
import type { SolicitacaoPdfInput } from "@/lib/solicitacaoMateriaisPdf";

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho", enviada: "Enviada", aprovada: "Aprovada",
  recusada: "Recusada", comprada: "Comprada", recebida: "Recebida",
  recebida_parcial: "Recebida parcial", cancelada: "Cancelada",
};

async function loadLogoDataUrl(url?: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = URL.createObjectURL(blob);
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || 300;
    canvas.height = img.naturalHeight || 300;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("[logo] falha ao carregar logo para PDF", e);
    return null;
  }
}

/**
 * Monta o input completo do PDF de uma solicitação a partir do banco,
 * independente de já ter os dados carregados em memória. Usado tanto pelo
 * envio automático de email quanto pelo reenvio manual, para o anexo sempre
 * refletir o estado atual da solicitação.
 */
export async function carregarDadosPdfSolicitacao(
  solicitacaoId: string,
  empresaId: string
): Promise<SolicitacaoPdfInput | null> {
  const [{ data: solic }, { data: itens }, { data: emp }] = await Promise.all([
    supabase.from("solicitacoes_materiais").select("*").eq("id", solicitacaoId).maybeSingle(),
    supabase.from("solicitacoes_materiais_itens").select("*").eq("solicitacao_id", solicitacaoId).order("ordem"),
    (supabase.from as any)("empresa_config").select("nome, cnpj, endereco, telefone, logo_url").eq("id", empresaId).maybeSingle(),
  ]);
  if (!solic) return null;
  const s = solic as any;

  const unidadeId = s.unidade_id;
  const contratoId = s.contrato_id;
  const obraId = s.obra_id;
  const [uniRes, contRes, obraRes, logoDataUrl] = await Promise.all([
    unidadeId ? (supabase.from as any)("empresa_config").select("nome").eq("id", unidadeId).maybeSingle() : Promise.resolve({ data: null }),
    contratoId ? (supabase.from as any)("contratos").select("nome").eq("id", contratoId).maybeSingle() : Promise.resolve({ data: null }),
    obraId ? (supabase.from as any)("obras").select("nome").eq("id", obraId).maybeSingle() : Promise.resolve({ data: null }),
    loadLogoDataUrl((emp as any)?.logo_url),
  ]);

  return {
    empresa_logo_dataurl: logoDataUrl,
    empresa_nome: (emp as any)?.nome || null,
    empresa_cnpj: (emp as any)?.cnpj || null,
    empresa_endereco: (emp as any)?.endereco || null,
    empresa_telefone: (emp as any)?.telefone || null,
    unidade_nome: (uniRes.data as any)?.nome || null,
    contrato_nome: (contRes.data as any)?.nome || null,
    obra_nome: (obraRes.data as any)?.nome || null,
    numero: s.numero_solicitacao,
    titulo: s.titulo,
    data_solicitacao: s.data_solicitacao,
    data_necessidade: s.data_necessidade,
    solicitante: s.solicitante_nome,
    setor: s.setor,
    local_obra: s.local_obra,
    prioridade: s.prioridade,
    status: STATUS_LABEL[s.status] || s.status,
    status_key: s.status,
    justificativa: s.justificativa,
    observacoes: s.observacoes,
    aprovador: s.aprovado_por_nome,
    aprovado_em: s.aprovado_em,
    comprada_em: s.comprada_em,
    recebida_em: s.recebida_em,
    nota_fiscal: s.nota_fiscal,
    itens: await Promise.all((itens || []).map(async (i: any) => ({
      tipo_item: i.tipo_item,
      nome_item: i.nome_item,
      descricao: i.descricao,
      ca: i.ca,
      unidade_medida: i.unidade_medida,
      quantidade_solicitada: Number(i.quantidade_solicitada || 0),
      quantidade_aprovada: i.quantidade_aprovada != null ? Number(i.quantidade_aprovada) : null,
      justificativa_item: i.justificativa_item,
      observacoes: i.observacoes,
      imagem_dataurl: i.imagem_path ? await loadImageAsDataUrl(i.imagem_path) : null,
    }))),
  };
}
