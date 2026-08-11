import { supabase } from "@/integrations/supabase/client";

export const BUCKET_DOCS = "documentos-internos";

/**
 * Situações do documento. As seis primeiras vêm calculadas da view; as
 * duas últimas são derivadas na tela:
 *  - `substituido`  → versão que não é mais a atual (view de histórico).
 *  - `nao_aplicavel` → tipo que a função do colaborador não exige
 *    (internal_document_requirements). Não existe linha de documento
 *    para esse caso, por isso a view não teria como devolver.
 */
export type SituacaoDocumento =
  | "nao_enviado" | "vigente" | "vence_em_breve" | "vencido"
  | "em_renovacao" | "arquivado" | "substituido" | "nao_aplicavel";

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
  em_renovacao: "Em renovação",
  substituido: "Substituído",
  arquivado: "Arquivado",
  nao_aplicavel: "Não aplicável",
};

/** Classes de cor, na mesma convenção que o restante do sistema usa. */
export const COR_SITUACAO: Record<SituacaoDocumento, string> = {
  nao_enviado: "bg-amber-100 text-amber-800 border-amber-300",
  vigente: "bg-green-100 text-green-800 border-green-300",
  vence_em_breve: "bg-orange-100 text-orange-800 border-orange-300",
  vencido: "bg-red-100 text-red-800 border-red-300",
  em_renovacao: "bg-blue-100 text-blue-800 border-blue-300",
  substituido: "bg-slate-100 text-slate-600 border-slate-300",
  arquivado: "bg-slate-100 text-slate-600 border-slate-300",
  nao_aplicavel: "bg-slate-100 text-slate-600 border-slate-300",
};

/**
 * Ícone por situação, em nome de ícone do lucide.
 *
 * Cor sozinha não comunica: quem não distingue vermelho de verde veria
 * duas tarjas iguais, e num controle de vencimento isso é a diferença
 * entre "em dia" e "irregular". Toda tarja sai com cor + texto + ícone.
 */
export const ICONE_SITUACAO: Record<SituacaoDocumento, string> = {
  nao_enviado: "AlertCircle",
  vigente: "CheckCircle2",
  vence_em_breve: "Clock",
  vencido: "XCircle",
  em_renovacao: "RefreshCw",
  substituido: "History",
  arquivado: "Archive",
  nao_aplicavel: "MinusCircle",
};

/** Ordem de urgência — usada para ordenar o dossiê e os painéis. */
export const PESO_SITUACAO: Record<SituacaoDocumento, number> = {
  vencido: 0,
  vence_em_breve: 1,
  nao_enviado: 2,
  em_renovacao: 3,
  vigente: 4,
  substituido: 5,
  arquivado: 6,
  nao_aplicavel: 7,
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
  /**
   * Validade já pronta, quando quem chama já sabe o vencimento exato (ex.:
   * ASO, cujo prazo depende do tipo de exame/risco, não de "N meses após a
   * emissão"). Se informado, vence `validadeMeses`/`calcularValidade`.
   */
  dataValidade?: string | null;
  observacao?: string | null;
  userId?: string | null;
  /** Registro específico (não o do documento) que originou esta versão. */
  origemTabela?: string | null;
  origemId?: string | null;
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
      data_validade: p.dataValidade !== undefined ? p.dataValidade : calcularValidade(p.dataEmissao, p.validadeMeses),
      observacao: p.observacao || null,
      created_by: p.userId || null,
      origem_tabela: p.origemTabela || null,
      origem_id: p.origemId || null,
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
 * Abre um documento numa aba nova, sobrevivendo ao bloqueio de pop-up.
 *
 * O celular não abria nada ao tocar em "Ver". A causa não é permissão nem
 * URL inválida: é o navegador. Ele só deixa abrir aba nova enquanto o
 * toque do usuário ainda está sendo processado. Buscar a URL assinada leva
 * uma ida ao servidor, e quando ela volta o toque já acabou — a chamada
 * seguinte vira pop-up não solicitado e é engolida em silêncio. No
 * computador quase nunca aparece; no celular, praticamente sempre.
 *
 * A saída é abrir a aba JÁ no toque, ainda em branco, e só depois apontá-la
 * para o endereço. Se mesmo assim vier bloqueada, navega na própria aba:
 * melhor sair da tela e voltar do que o botão não fazer nada.
 *
 * Uso: `const ir = prepararAbertura(); const url = await ...; ir(url);`
 * Chamar `prepararAbertura()` FORA do toque não adianta — tem que ser a
 * primeira coisa que o clique faz.
 */
export function prepararAbertura(): (url: string | null) => void {
  const janela = typeof window !== "undefined" ? window.open("", "_blank") : null;
  return (url: string | null) => {
    if (!url) { try { janela?.close(); } catch { /* já fechada */ } return; }
    if (janela && !janela.closed) {
      try { janela.opener = null; } catch { /* navegador não permite */ }
      janela.location.href = url;
      return;
    }
    // Bloqueada apesar de tudo: abre na própria aba.
    window.location.href = url;
  };
}

/**
 * Registra que alguém abriu um documento — a outra metade da auditoria
 * (a versão já registra quem enviou; isto registra quem depois olhou).
 *
 * Best-effort de propósito: quem chama já tem a URL assinada e o
 * `window.open` em mãos quando isso roda — uma falha aqui não pode
 * atrapalhar quem só queria ver o PDF.
 */
export async function registrarAcesso(p: {
  documentoId: string;
  versaoId?: string | null;
  empresaId: string;
  colaboradorId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
}): Promise<void> {
  try {
    await (supabase.from as any)("document_access_log").insert({
      documento_id: p.documentoId,
      versao_id: p.versaoId || null,
      empresa_id: p.empresaId,
      colaborador_id: p.colaboradorId || null,
      usuario_id: p.userId || null,
      usuario_email: p.userEmail || null,
    });
  } catch {
    // Silencioso de propósito — ver comentário acima.
  }
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

/**
 * Histórico completo, da versão mais nova para a mais antiga.
 *
 * Lê da view, que já marca cada versão como `atual` ou `substituida` —
 * derivado da numeração, nunca gravado, porque versão nenhuma é apagada
 * nem reescrita (o bucket não tem política de UPDATE/DELETE).
 */
export async function historicoVersoes(documentoId: string) {
  const { data } = await (supabase.from as any)("internal_document_versions_historico")
    .select("*")
    .eq("documento_id", documentoId)
    .order("versao", { ascending: false });
  return (data || []) as any[];
}

/**
 * Registra uma MUTAÇÃO no documento (enviou/renovou/arquivou/...).
 *
 * Best-effort, como o registro de leitura: falhar aqui não pode desfazer
 * a ação que o usuário já concluiu.
 */
export async function registrarEvento(p: {
  empresaId: string;
  documentoId?: string | null;
  versaoId?: string | null;
  colaboradorId?: string | null;
  acao: "enviou" | "renovou" | "iniciou_renovacao" | "cancelou_renovacao" | "arquivou" | "desarquivou" | "importou";
  detalhe?: string | null;
  userId?: string | null;
  userEmail?: string | null;
}): Promise<void> {
  try {
    await (supabase.from as any)("document_audit_events").insert({
      empresa_id: p.empresaId,
      documento_id: p.documentoId || null,
      versao_id: p.versaoId || null,
      colaborador_id: p.colaboradorId || null,
      acao: p.acao,
      detalhe: p.detalhe || null,
      usuario_id: p.userId || null,
      usuario_email: p.userEmail || null,
    });
  } catch {
    // Silencioso de propósito — ver comentário acima.
  }
}

/**
 * Arquiva o documento: tira de circulação sem destruir.
 *
 * Exclusão física nunca acontece — some com a prova justamente do
 * período que uma fiscalização pediria. O motivo é obrigatório: sem ele,
 * seis meses depois ninguém sabe por que aquele ASO saiu do dossiê.
 */
export async function arquivarDocumento(p: {
  documentoId: string;
  empresaId: string;
  colaboradorId?: string | null;
  motivo: string;
  userId?: string | null;
  userEmail?: string | null;
}): Promise<void> {
  const motivo = p.motivo.trim();
  if (!motivo) throw new Error("Informe o motivo do arquivamento.");

  const { error } = await (supabase.from as any)("internal_documents")
    .update({
      arquivado_em: new Date().toISOString(),
      arquivado_por: p.userId || null,
      arquivado_motivo: motivo,
      updated_by: p.userId || null,
    })
    .eq("id", p.documentoId);
  if (error) throw error;

  await registrarEvento({
    empresaId: p.empresaId, documentoId: p.documentoId, colaboradorId: p.colaboradorId,
    acao: "arquivou", detalhe: motivo, userId: p.userId, userEmail: p.userEmail,
  });
}

export async function desarquivarDocumento(p: {
  documentoId: string;
  empresaId: string;
  colaboradorId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
}): Promise<void> {
  const { error } = await (supabase.from as any)("internal_documents")
    .update({ arquivado_em: null, arquivado_por: null, arquivado_motivo: null, updated_by: p.userId || null })
    .eq("id", p.documentoId);
  if (error) throw error;

  await registrarEvento({
    empresaId: p.empresaId, documentoId: p.documentoId, colaboradorId: p.colaboradorId,
    acao: "desarquivou", userId: p.userId, userEmail: p.userEmail,
  });
}

/**
 * Marca/desmarca "em renovação" — o documento foi cobrado e alguém está
 * atrás do arquivo novo. Some sozinho quando a versão nova é publicada
 * (trigger no banco), então não fica preso se a pessoa desistir no meio.
 */
export async function definirEmRenovacao(p: {
  documentoId: string;
  empresaId: string;
  colaboradorId?: string | null;
  emRenovacao: boolean;
  userId?: string | null;
  userEmail?: string | null;
}): Promise<void> {
  const { error } = await (supabase.from as any)("internal_documents")
    .update({ em_renovacao: p.emRenovacao, updated_by: p.userId || null })
    .eq("id", p.documentoId);
  if (error) throw error;

  await registrarEvento({
    empresaId: p.empresaId, documentoId: p.documentoId, colaboradorId: p.colaboradorId,
    acao: p.emRenovacao ? "iniciou_renovacao" : "cancelou_renovacao",
    userId: p.userId, userEmail: p.userEmail,
  });
}
