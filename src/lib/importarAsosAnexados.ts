import { validadeTipoPelasDatas, type TipoExameAso } from "@/lib/validadeAso";

/**
 * ASOs que existem só como PDF anexado, e que o módulo não conhece.
 *
 * O Arquivo Digital desta empresa guarda 32 documentos de ASO, com 50
 * versões, e a lista do módulo diz "Nenhum ASO encontrado": os arquivos
 * foram anexados direto no dossiê, sem passar pelo módulo. Por isso eles
 * não geram vencimento, não entram nos relatórios e não alimentam o
 * Relatório Analítico que a NR-07 exige no 7.5.4 "e".
 *
 * O que o anexo dá de graça: o colaborador, a data de emissão e a data de
 * vencimento. O que ele NÃO dá é o tipo de exame — os 50 arquivos desta
 * empresa têm o mesmo nome, `aso-atestado-de-saude-ocupacional-
 * digitalizado.pdf`, e não há de onde deduzir se é admissional, periódico
 * ou demissional.
 *
 * Por isso aqui não se chuta tipo nenhum: quem importa escolhe. Chutar
 * "periódico" criaria admissionais errados em documento legal, e o erro
 * ficaria invisível porque ninguém confere o que o sistema já preencheu.
 */

export interface AnexoDeAso {
  versaoId: string;
  documentoId: string;
  colaboradorId: string;
  colaboradorNome: string;
  nomeArquivo: string | null;
  versao: number;
  dataEmissao: string | null;
  dataVencimento: string | null;
  /** Preenchido pela tabela de origem da versão. */
  origemTabela: string | null;
}

/** Linha do documento, como vem do Arquivo Digital. */
export interface DocumentoComVersoes {
  id: string;
  colaborador_id: string;
  internal_document_versions?: {
    id: string;
    versao: number;
    nome_original: string | null;
    data_emissao: string | null;
    data_validade: string | null;
    origem_tabela: string | null;
  }[] | null;
}

/**
 * Os anexos que ainda não viraram ASO no módulo.
 *
 * Versão com `origem_tabela = 'asos'` já nasceu do módulo, ou já foi
 * importada — importar de novo criaria ASO duplicado para o mesmo papel.
 */
export function anexosPendentes(
  documentos: DocumentoComVersoes[],
  nomePorColaborador: Map<string, string>,
): AnexoDeAso[] {
  const pendentes: AnexoDeAso[] = [];
  for (const d of documentos || []) {
    for (const v of d.internal_document_versions || []) {
      if (v.origem_tabela === "asos") continue;
      pendentes.push({
        versaoId: v.id,
        documentoId: d.id,
        colaboradorId: d.colaborador_id,
        colaboradorNome: nomePorColaborador.get(d.colaborador_id) || "—",
        nomeArquivo: v.nome_original,
        versao: v.versao,
        dataEmissao: v.data_emissao,
        dataVencimento: v.data_validade,
        origemTabela: v.origem_tabela,
      });
    }
  }
  /* Pela pessoa, e dentro dela do exame mais antigo para o mais novo. */
  return pendentes.sort((a, b) => {
    const n = a.colaboradorNome.localeCompare(b.colaboradorNome, "pt-BR");
    if (n !== 0) return n;
    return (a.dataEmissao || "").localeCompare(b.dataEmissao || "");
  });
}

export interface AsoParaGravar {
  empresa_id: string;
  funcionario_id: string;
  numero_aso: string;
  tipo_exame: string;
  data_emissao: string;
  data_vencimento: string | null;
  validade_tipo: string | null;
  status: string;
  observacoes: string;
  created_by?: string | null;
}

/**
 * O registro de ASO que um anexo vira.
 *
 * A emissão é obrigatória no banco; anexo sem ela não pode ser importado,
 * e é a tela que precisa impedir — aqui devolve null em vez de inventar
 * a data de hoje, que marcaria como atual um exame de anos atrás.
 */
export function asoDoAnexo(p: {
  anexo: AnexoDeAso;
  tipoExame: TipoExameAso | "";
  empresaId: string;
  numero: string;
  userId?: string | null;
}): AsoParaGravar | null {
  if (!p.anexo?.dataEmissao || !p.tipoExame || !p.empresaId) return null;

  /*
   * O demissional não vence (NR-07, 7.5.11). Se o anexo trouxe vencimento
   * — e muitos trouxeram, porque o tipo de documento tinha 12 meses fixos
   * —, ele não vai para o registro.
   */
  const ehDemissional = p.tipoExame === "demissional";
  const vencimento = ehDemissional ? null : (p.anexo.dataVencimento || null);

  return {
    empresa_id: p.empresaId,
    funcionario_id: p.anexo.colaboradorId,
    numero_aso: p.numero,
    tipo_exame: p.tipoExame,
    data_emissao: p.anexo.dataEmissao,
    data_vencimento: vencimento,
    validade_tipo: ehDemissional
      ? "nao_vence"
      : validadeTipoPelasDatas(p.anexo.dataEmissao, vencimento),
    status: "emitido",
    /*
     * Fica dito no registro que este ASO não foi emitido pelo sistema: o
     * exame clínico, a aptidão e o médico estão no papel digitalizado, e
     * não nos campos do módulo.
     */
    observacoes:
      "Registro criado a partir do ASO digitalizado anexado no Dossiê do Colaborador. "
      + "Aptidão, exames e médico constam no arquivo original.",
    created_by: p.userId || null,
  };
}
