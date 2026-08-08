import { supabase } from "@/integrations/supabase/client";

export const BUCKET_DOCS = "documentos-internos";

/** Situações que a view calcula. A cor da tela sai daqui. */
export type SituacaoDocumento =
  | "nao_enviado" | "vigente" | "vence_em_breve" | "vencido" | "arquivado";

export interface DocumentoSituacao {
  id: string;
  empresa_id: string;
  colaborador_id: string | null;
  tipo_documento_id: string;
  tipo_nome: string;
  categoria: string;
  versao_id: string | null;
  versao_numero: number | null;
  caminho_arquivo: string | null;
  nome_original: string | null;
  hash_sha256: string | null;
  data_emissao: string | null;
  data_validade: string | null;
  enviado_em: string | null;
  total_versoes: number;
  situacao: SituacaoDocumento;
  dias_para_vencer: number | null;
}

export const ROTULO_SITUACAO: Record<SituacaoDocumento, string> = {
  nao_enviado: "Não enviado",
  vigente: "Vigente",
  vence_em_breve: "Vence em breve",
  vencido: "Vencido",
  arquivado: "Arquivado",
};

/** Classes de cor, na mesma convenção que o restante do sistema usa. */
export const COR_SITUACAO: Record<SituacaoDocumento, string> = {
  nao_enviado: "bg-amber-100 text-amber-800 border-amber-300",
  vigente: "bg-green-100 text-green-800 border-green-300",
  vence_em_breve: "bg-orange-100 text-orange-800 border-orange-300",
  vencido: "bg-red-100 text-red-800 border-red-300",
  arquivado: "bg-slate-100 text-slate-600 border-slate-300",
};

/**
 * Impressão digital do arquivo, calculada ANTES de subir.
 *
 * Serve para provar depois que o PDF servido é o mesmo que foi enviado —
 * numa fiscalização, "está no sistema" vale menos do que "está no sistema e
 * é comprovadamente o arquivo original". `crypto.subtle` só existe em
 * contexto seguro; fora dele o upload continua, sem o hash, porque perder o
 * documento seria pior do que perder a conferência.
 */
export async function calcularSha256(file: File): Promise<string | null> {
  try {
    if (!globalThis.crypto?.subtle) return null;
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

/**
 * Caminho do arquivo no bucket.
 *
 * Começa pelo `empresa_id` porque é o primeiro nível que a política de
 * storage confere — é o que impede uma empresa de ler o documento de outra.
 * O número da versão entra no nome: assim dois envios nunca disputam o mesmo
 * endereço, e o arquivo anterior continua existindo depois da renovação.
 */
export function caminhoDocumento(p: {
  empresaId: string; colaboradorId?: string | null; documentoId: string;
  versao: number; nomeOriginal: string;
}): string {
  // Sem ponto no nome não há extensão: `split(".").pop()` devolveria o nome
  // inteiro e o arquivo viraria "documento.semextensao".
  const partes = p.nomeOriginal.split(".");
  const bruta = partes.length > 1 ? partes.pop()! : "";
  const ext = bruta.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
  const dono = p.colaboradorId ? `colaboradores/${p.colaboradorId}` : "empresa";
  return `${p.empresaId}/${dono}/${p.documentoId}/v${p.versao}-${Date.now()}.${ext}`;
}

/**
 * Validade a partir da emissão. `null` de meses = documento permanente.
 *
 * `setMonth` transborda: 31/01 + 1 mês vira 31/02, que o JavaScript
 * normaliza para 03/03. Num controle de vencimento isso é erro na direção
 * perigosa — o documento apareceria vigente por três dias a mais do que
 * vale. Quando o dia não existe no mês de destino, cai no último dia dele.
 */
export function calcularValidade(dataEmissao: string, validadeMeses?: number | null): string | null {
  if (!validadeMeses) return null;
  const base = new Date(`${dataEmissao}T12:00:00`);
  if (Number.isNaN(base.getTime())) return null;

  const dia = base.getDate();
  const alvo = new Date(base);
  alvo.setDate(1);
  alvo.setMonth(alvo.getMonth() + validadeMeses);

  const ultimoDiaDoMes = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(dia, ultimoDiaDoMes));

  const mm = String(alvo.getMonth() + 1).padStart(2, "0");
  const dd = String(alvo.getDate()).padStart(2, "0");
  return `${alvo.getFullYear()}-${mm}-${dd}`;
}

export interface EnvioDocumento {
  empresaId: string;
  documentoId: string;
  colaboradorId?: string | null;
  file: File;
  dataEmissao: string;
  validadeMeses?: number | null;
  observacao?: string | null;
  userId?: string | null;
}

/**
 * Publica uma nova versão: sobe o arquivo e grava a linha.
 *
 * Nunca substitui o arquivo anterior — cada renovação é arquivo novo e linha
 * nova. Sobrescrever destruiria a prova da situação passada, que é
 * justamente o que se precisa apresentar sobre o período já decorrido.
 *
 * O número da versão é atribuído pelo banco (trigger), não aqui: dois envios
 * simultâneos escolheriam o mesmo número se o cliente decidisse.
 */
export async function publicarVersao(p: EnvioDocumento) {
  const hash = await calcularSha256(p.file);

  // A versão real vem do trigger; para o caminho basta um número que não
  // colida, e o timestamp no nome já garante isso.
  const { count } = await (supabase.from as any)("internal_document_versions")
    .select("id", { count: "exact", head: true })
    .eq("documento_id", p.documentoId);
  const proxima = (count || 0) + 1;

  const caminho = caminhoDocumento({
    empresaId: p.empresaId,
    colaboradorId: p.colaboradorId,
    documentoId: p.documentoId,
    versao: proxima,
    nomeOriginal: p.file.name,
  });

  const { error: erroUpload } = await supabase.storage
    .from(BUCKET_DOCS)
    .upload(caminho, p.file, { contentType: p.file.type || undefined, upsert: false });
  if (erroUpload) throw erroUpload;

  const { data, error } = await (supabase.from as any)("internal_document_versions")
    .insert({
      empresa_id: p.empresaId,
      documento_id: p.documentoId,
      caminho_arquivo: caminho,
      nome_original: p.file.name,
      mime_type: p.file.type || null,
      tamanho_bytes: p.file.size,
      hash_sha256: hash,
      data_emissao: p.dataEmissao,
      data_validade: calcularValidade(p.dataEmissao, p.validadeMeses),
      observacao: p.observacao || null,
      created_by: p.userId || null,
    })
    .select("*")
    .single();

  if (error) {
    // A linha não entrou: deixar o arquivo órfão no bucket é lixo que
    // ninguém encontra depois. Falha ao limpar não piora o resultado.
    await supabase.storage.from(BUCKET_DOCS).remove([caminho]).catch(() => {});
    throw error;
  }
  return data;
}

/**
 * Endereço temporário para abrir o arquivo.
 *
 * O bucket é privado e continua privado: nunca gerar URL pública para
 * documento de saúde ou pessoal — quem tiver o endereço leria sem login e
 * sem deixar registro.
 */
export async function urlTemporaria(caminho: string, segundos = 300): Promise<string | null> {
  if (!caminho) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET_DOCS)
    .createSignedUrl(caminho, segundos);
  if (error) {
    console.warn("[arquivo-digital] falha ao gerar link temporário", error.message);
    return null;
  }
  return data?.signedUrl || null;
}

/**
 * Garante o documento (o "slot" do tipo para o colaborador) e devolve o id.
 *
 * `origem` amarra o documento ao registro que já existe na tela atual, para
 * a migração não duplicar histórico nem perder o vínculo.
 */
export async function garantirDocumento(p: {
  empresaId: string;
  colaboradorId: string;
  tipoDocumentoId: string;
  unidadeId?: string | null;
  origemTabela?: string | null;
  origemId?: string | null;
  userId?: string | null;
}): Promise<string> {
  const { data: existente } = await (supabase.from as any)("internal_documents")
    .select("id")
    .eq("colaborador_id", p.colaboradorId)
    .eq("tipo_documento_id", p.tipoDocumentoId)
    .is("arquivado_em", null)
    .maybeSingle();
  if (existente?.id) return existente.id as string;

  const { data, error } = await (supabase.from as any)("internal_documents")
    .insert({
      empresa_id: p.empresaId,
      colaborador_id: p.colaboradorId,
      tipo_documento_id: p.tipoDocumentoId,
      unidade_id: p.unidadeId || null,
      origem_tabela: p.origemTabela || null,
      origem_id: p.origemId || null,
      created_by: p.userId || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Histórico completo, da versão mais nova para a mais antiga. */
export async function historicoVersoes(documentoId: string) {
  const { data } = await (supabase.from as any)("internal_document_versions")
    .select("*")
    .eq("documento_id", documentoId)
    .order("versao", { ascending: false });
  return (data || []) as any[];
}
