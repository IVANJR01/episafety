/**
 * Une dois cadastros repetidos da estrutura num só, sem perder vínculo.
 *
 * O cuidado que isto exige: muita coisa aponta para um setor ou um GES — itens
 * do inventário, ações do plano, coletas de campo, exposições, o histórico de
 * cada trabalhador. Apagar a linha repetida primeiro levaria tudo isso junto,
 * porque boa parte dessas tabelas é `ON DELETE CASCADE`. A ordem aqui é a
 * única que não perde nada:
 *
 *   1. copiar o que vai sair para o backup;
 *   2. completar no cadastro que fica os campos que só o outro tinha;
 *   3. mover TODOS os vínculos;
 *   4. só então apagar.
 *
 * Cada passo pode ser refeito sem estragar nada — se a internet cair no meio,
 * basta unir de novo e a união termina de onde parou.
 */

/** Só estes cinco cadastros se unem por aqui. */
export const TABELAS_UNIVEIS = [
  "sst_ambientes", "sst_setores", "sst_processos", "sst_funcoes", "sst_ges",
] as const;

export type TabelaUnivel = (typeof TABELAS_UNIVEIS)[number];

export interface Referencia {
  tabela: string;
  coluna: string;
}

/*
 * QUEM APONTA PARA CADA CADASTRO.
 *
 * Esta lista é conferida contra as migrations pelo teste
 * `unirCadastroEstrutura.test.ts`: se uma tabela nova passar a apontar para um
 * destes cadastros e não entrar aqui, o teste falha. Sem isso a união deixaria
 * um vínculo para trás — e o vínculo esquecido morre no CASCADE do passo 4,
 * calado.
 */
export const REFERENCIAS: Record<TabelaUnivel, Referencia[]> = {
  sst_ambientes: [
    { tabela: "pgr_cenarios_emergencia", coluna: "ambiente_id" },
    { tabela: "pgr_inventario_itens", coluna: "ambiente_id" },
    { tabela: "pgr_levantamento_preliminar", coluna: "ambiente_id" },
    { tabela: "sst_atividades", coluna: "ambiente_id" },
    { tabela: "sst_coletas_campo", coluna: "ambiente_id" },
    { tabela: "sst_exposicoes", coluna: "ambiente_id" },
    { tabela: "sst_ges_vinculos", coluna: "ambiente_id" },
    { tabela: "sst_processos", coluna: "ambiente_id" },
    { tabela: "sst_setores", coluna: "ambiente_id" },
    { tabela: "sst_trabalhadores_historico", coluna: "ambiente_id" },
  ],
  sst_setores: [
    { tabela: "ghe_setores", coluna: "setor_id" },
    { tabela: "pgr_inventario_itens", coluna: "setor_id" },
    { tabela: "pgr_levantamento_preliminar", coluna: "setor_id" },
    { tabela: "sst_atividades", coluna: "setor_id" },
    { tabela: "sst_coletas_campo", coluna: "setor_id" },
    { tabela: "sst_exposicoes", coluna: "setor_id" },
    { tabela: "sst_funcoes", coluna: "setor_id" },
    { tabela: "sst_ges_vinculos", coluna: "setor_id" },
    { tabela: "sst_processos", coluna: "setor_id" },
    { tabela: "sst_trabalhadores_historico", coluna: "setor_id" },
  ],
  sst_processos: [
    { tabela: "pgr_inventario_itens", coluna: "processo_id" },
    { tabela: "pgr_levantamento_preliminar", coluna: "processo_id" },
    { tabela: "sst_atividades", coluna: "processo_id" },
    { tabela: "sst_coletas_campo", coluna: "processo_id" },
    { tabela: "sst_exposicoes", coluna: "processo_id" },
    { tabela: "sst_funcoes", coluna: "processo_id" },
    { tabela: "sst_ges_vinculos", coluna: "processo_id" },
    { tabela: "sst_setores", coluna: "processo_id" },
    { tabela: "sst_trabalhadores_historico", coluna: "processo_id" },
  ],
  sst_funcoes: [
    { tabela: "ghe_funcoes", coluna: "funcao_id" },
    { tabela: "pgr_inventario_itens", coluna: "funcao_sst_id" },
    { tabela: "pgr_levantamento_preliminar", coluna: "funcao_id" },
    { tabela: "sst_atividade_funcoes", coluna: "funcao_id" },
    { tabela: "sst_atividades", coluna: "funcao_id" },
    { tabela: "sst_coletas_campo", coluna: "funcao_id" },
    { tabela: "sst_exposicoes", coluna: "funcao_id" },
    { tabela: "sst_ges_vinculos", coluna: "funcao_id" },
    { tabela: "sst_trabalhadores_historico", coluna: "funcao_id" },
  ],
  sst_ges: [
    { tabela: "pgr_inventario_itens", coluna: "ges_id" },
    { tabela: "pgr_levantamento_preliminar", coluna: "ges_id" },
    { tabela: "sst_atividades", coluna: "ges_id" },
    { tabela: "sst_coletas_campo", coluna: "ges_id" },
    { tabela: "sst_exposicoes", coluna: "ges_id" },
    { tabela: "sst_ges_vinculos", coluna: "ges_id" },
  ],
};

/*
 * Campos que não se copiam de um cadastro para o outro: são a identidade da
 * linha, não o preenchimento de quem cadastrou.
 */
const NAO_COPIAR = new Set([
  "id", "empresa_id", "created_at", "updated_at", "nome", "codigo",
]);

export interface RelatorioUniao {
  tabela: TabelaUnivel;
  mantido: string;
  removidos: number;
  vinculosMovidos: number;
  /** Vínculo que já existia no cadastro que fica: o repetido foi descartado. */
  vinculosDuplicadosDescartados: number;
  camposPreenchidos: string[];
}

/** O mínimo do cliente do Supabase que esta função usa. */
export interface ClienteBanco {
  from: (tabela: string) => any;
}

/** Violação de unicidade no Postgres. */
const UNICIDADE = "23505";

export interface OpcoesUniao {
  tabela: TabelaUnivel;
  /** O cadastro que fica. */
  manter: string;
  /** Os que somem, com seus vínculos passados para o que fica. */
  remover: string[];
}

export async function unirCadastro(
  db: ClienteBanco,
  { tabela, manter, remover }: OpcoesUniao,
): Promise<RelatorioUniao> {
  if (!TABELAS_UNIVEIS.includes(tabela)) {
    throw new Error(`Cadastro que não se une por aqui: ${tabela}`);
  }
  const sair = (remover || []).filter((id) => id && id !== manter);
  if (!manter) throw new Error("Escolha qual cadastro fica.");
  if (sair.length === 0) throw new Error("Escolha ao menos um cadastro para unir.");

  /* ── 1. O que existe hoje ──────────────────────────────────────────────── */
  const { data: linhas, error: erroLeitura } = await db.from(tabela)
    .select("*").in("id", [manter, ...sair]);
  if (erroLeitura) throw new Error(mensagem(erroLeitura, "ler os cadastros"));

  const principal = (linhas || []).find((l: any) => l.id === manter);
  if (!principal) throw new Error("O cadastro que ficaria não existe mais. Recarregue a tela.");
  const saindo = (linhas || []).filter((l: any) => l.id !== manter);

  /*
   * Unir cadastro de uma empresa com o de outra misturaria dados de clientes
   * diferentes. A RLS separa as empresas, mas quem atende duas vê as duas
   * listas — e o erro só apareceria muito depois, dentro de um documento.
   */
  const deOutraEmpresa = saindo.find((l: any) => l.empresa_id !== principal.empresa_id);
  if (deOutraEmpresa) throw new Error("Os cadastros são de empresas diferentes.");

  /* ── 2. Cópia do que vai sair, ANTES de qualquer alteração ─────────────── */
  if (saindo.length > 0) {
    const { error } = await db.from("sst_cadastros_unificados_backup").upsert(
      saindo.map((l: any) => ({
        id: l.id,
        tabela,
        empresa_id: l.empresa_id,
        unificado_em: manter,
        dados: l,
      })),
      { onConflict: "id" },
    );
    /*
     * Sem a cópia a união seria irreversível — e unir o cadastro errado é um
     * erro que acontece. Se a cópia falhar, não se mexe em mais nada.
     */
    if (error) throw new Error(mensagem(error, "guardar a cópia de segurança"));
  }

  /* ── 3. Campo que só o cadastro removido tinha não some junto com ele ──── */
  const completar: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(principal)) {
    if (NAO_COPIAR.has(campo)) continue;
    if (valor != null && String(valor).trim() !== "") continue;
    const doOutro = saindo
      .map((l: any) => l[campo])
      .find((v: unknown) => v != null && String(v).trim() !== "");
    if (doOutro !== undefined) completar[campo] = doOutro;
  }
  if (Object.keys(completar).length > 0) {
    const { error } = await db.from(tabela).update(completar).eq("id", manter);
    if (error) throw new Error(mensagem(error, "completar o cadastro que fica"));
  }

  /* ── 4. Move TODOS os vínculos ─────────────────────────────────────────── */
  let movidos = 0;
  let descartados = 0;
  for (const ref of REFERENCIAS[tabela]) {
    const { data: filhos, error: erroFilhos } = await db.from(ref.tabela)
      .select("id").in(ref.coluna, sair);
    /*
     * Tabela que ainda não existe neste banco não é erro: o sistema é
     * implantado por partes, e o que não existe não tem vínculo a mover.
     */
    if (erroFilhos) {
      if (tabelaAusente(erroFilhos)) continue;
      throw new Error(mensagem(erroFilhos, `ler os vínculos em ${ref.tabela}`));
    }
    if (!filhos || filhos.length === 0) continue;

    const { error } = await db.from(ref.tabela)
      .update({ [ref.coluna]: manter }).in(ref.coluna, sair);

    if (!error) { movidos += filhos.length; continue; }
    if (error.code !== UNICIDADE) {
      throw new Error(mensagem(error, `mover os vínculos em ${ref.tabela}`));
    }

    /*
     * Colidiu com um vínculo que já existe no cadastro que fica. Esse não é um
     * vínculo perdido: é o MESMO vínculo em duplicata, e o certo é descartá-lo.
     * Linha a linha, para que uma colisão não impeça as outras de andar.
     */
    for (const filho of filhos) {
      const { error: erroLinha } = await db.from(ref.tabela)
        .update({ [ref.coluna]: manter }).eq("id", filho.id);
      if (!erroLinha) { movidos += 1; continue; }
      if (erroLinha.code !== UNICIDADE) {
        throw new Error(mensagem(erroLinha, `mover um vínculo em ${ref.tabela}`));
      }
      const { error: erroDescarte } = await db.from(ref.tabela).delete().eq("id", filho.id);
      if (erroDescarte) {
        throw new Error(mensagem(erroDescarte, `descartar o vínculo repetido em ${ref.tabela}`));
      }
      descartados += 1;
    }
  }

  /* ── 5. Agora sim, sem nada apontando para elas ────────────────────────── */
  const { error: erroApagar } = await db.from(tabela).delete().in("id", sair);
  if (erroApagar) throw new Error(mensagem(erroApagar, "apagar o cadastro repetido"));

  return {
    tabela,
    mantido: manter,
    removidos: saindo.length,
    vinculosMovidos: movidos,
    vinculosDuplicadosDescartados: descartados,
    camposPreenchidos: Object.keys(completar),
  };
}

/** Tabela que ainda não existe neste banco (o PostgREST não a encontra). */
function tabelaAusente(erro: { code?: string; message?: string }): boolean {
  return erro.code === "42P01" || erro.code === "PGRST205"
    || /does not exist|could not find the table/i.test(erro.message || "");
}

/** Mensagem que diz o que falhou, e não só o código do banco. */
function mensagem(erro: { message?: string; code?: string }, oQue: string): string {
  const detalhe = erro.message || erro.code || "erro desconhecido";
  return `Não deu para ${oQue}: ${detalhe}`;
}
