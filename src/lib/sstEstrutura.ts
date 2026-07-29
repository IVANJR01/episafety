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
}

const limpo = (v?: string | null) => {
  const s = (v ?? "").toString().trim();
  if (!s) return "";
  const up = s.toUpperCase();
  return up === "N.A" || up === "N.A." || up === "N/A" || up === "NA" ? "" : s;
};

/** Só a caracterização, sem o nome. Vazio quando nada foi preenchido. */
export function caracteristicasAmbiente(a?: AmbienteCaracterizavel | null): string {
  if (!a) return "";
  return [
    limpo(a.pe_direito) && `Pé-direito ${limpo(a.pe_direito)}`,
    limpo(a.piso),
    limpo(a.ventilacao) && `Ventilação ${limpo(a.ventilacao)}`,
    limpo(a.iluminacao) && `Iluminação ${limpo(a.iluminacao)}`,
    limpo(a.paredes),
    limpo(a.maquinas_instalacoes),
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
