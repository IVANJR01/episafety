/**
 * Como cada peça da Estrutura Ocupacional é descrita nos documentos.
 *
 * A coluna "Descrição do ambiente" do inventário recebia só o NOME ("ESCRITORIO"),
 * enquanto o cadastro tinha a caracterização inteira — pé-direito, piso,
 * ventilação, iluminação, paredes, máquinas. É essa caracterização que a NR-01
 * cobra na descrição do ambiente e que o PDF do PGR imprime na seção
 * "Caracterização dos Ambientes"; o nome sozinho não descreve nada.
 *
 * Fica num módulo próprio porque a mesma regra é usada na tabela de Ambientes,
 * na importação e no item do inventário. Escrever de novo em cada tela é como
 * as versões divergem.
 */

export interface AmbienteCaracterizavel {
  nome?: string | null;
  pe_direito?: string | null;
  piso?: string | null;
  ventilacao?: string | null;
  iluminacao?: string | null;
  paredes?: string | null;
  maquinas_instalacoes?: string | null;
  descricao?: string | null;
}

const limpo = (v?: string | null) => {
  const s = (v ?? "").toString().trim();
  if (!s) return "";
  const up = s.toUpperCase();
  return up === "N.A" || up === "N.A." || up === "N/A" || up === "NA" ? "" : s;
};

/**
 * Só a caracterização, sem o nome. Vazio quando nada foi preenchido.
 *
 * Piso, ventilação, iluminação, paredes e máquinas eram campos separados no
 * cadastro; viraram um único campo de texto livre (`descricao`) para reduzir
 * a quantidade de caixinhas do formulário. Cadastros antigos ainda têm os
 * campos separados preenchidos — por isso os dois formatos entram aqui, sem
 * duplicar o nome.
 */
export function caracteristicasAmbiente(a?: AmbienteCaracterizavel | null): string {
  if (!a) return "";
  return [
    limpo(a.pe_direito) && `Pé-direito ${limpo(a.pe_direito)}`,
    limpo(a.piso),
    limpo(a.ventilacao) && `Ventilação ${limpo(a.ventilacao)}`,
    limpo(a.iluminacao) && `Iluminação ${limpo(a.iluminacao)}`,
    limpo(a.paredes),
    limpo(a.maquinas_instalacoes),
    limpo(a.descricao),
  ].filter(Boolean).join(" · ");
}

/**
 * A descrição que vai para o inventário: a caracterização, sem o nome na
 * frente.
 *
 * Chegou a sair como "ESCRITORIO — Pé-direito 3 m · …", mas o campo se chama
 * "Descrição do ambiente" e a coluna vizinha já identifica onde é. Repetir o
 * nome dentro da descrição só ocupava espaço numa planilha que já é larga.
 *
 * O nome fica como último recurso: ambiente sem nenhuma caracterização
 * preenchida devolve o nome em vez de string vazia — melhor identificar do que
 * não dizer nada. Nunca inventa texto.
 */
export function descreverAmbiente(a?: AmbienteCaracterizavel | null): string {
  if (!a) return "";
  return caracteristicasAmbiente(a) || limpo(a.nome);
}

export interface ProcessoDescritivel {
  nome?: string | null;
  descricao_etapas?: string | null;
}

/**
 * A descrição de um processo para o inventário: as etapas, não o rótulo.
 *
 * O campo Nome do processo é só um identificador curto para a lista — a própria
 * tela avisa isso e sugere o nome a partir da primeira frase das etapas. Levar
 * esse rótulo para a coluna "Processo" do inventário não descreve o processo de
 * trabalho, que é o que a NR-01 pede.
 *
 * Sem etapas preenchidas, cai para o nome — identificar é melhor que ficar em
 * branco.
 */
export function descreverProcesso(p?: ProcessoDescritivel | null): string {
  if (!p) return "";
  return limpo(p.descricao_etapas) || limpo(p.nome);
}

/**
 * Rascunho do critério de agrupamento de um GES.
 *
 * O critério é o que distingue um GES de um setor renomeado, e o PDF do PGR o
 * imprime na seção dos Grupos de Exposição Semelhante — quando falta, o
 * documento sai com "não declarado — pendente de justificativa técnica". Ou
 * seja: deixar em branco não poupa trabalho, só empurra a falha para dentro do
 * documento.
 *
 * Como o sistema já sabe o setor e as funções do grupo, o campo não precisa
 * chegar vazio. O texto descreve a COMPOSIÇÃO do grupo, não uma conclusão
 * técnica: dizer "todos do setor têm a mesma exposição" seria falso justamente
 * no caso em que o usuário está separando dois grupos dentro do mesmo setor.
 * É um rascunho para editar, não uma justificativa pronta.
 */
export function criterioAgrupamentoSugerido(
  setorNome?: string | null,
  funcoes?: { nome?: string | null }[],
): string {
  const setor = limpo(setorNome);
  if (!setor) return "";
  const nomes = (funcoes || []).map((f) => limpo(f?.nome)).filter(Boolean);
  if (nomes.length === 0) {
    return `Trabalhadores do setor ${setor}, sujeitos às mesmas condições de exposição.`;
  }
  const lista = nomes.length === 1
    ? nomes[0]
    : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
  return `Trabalhadores do setor ${setor} nas funções ${lista}, sujeitos às mesmas condições de exposição.`;
}
