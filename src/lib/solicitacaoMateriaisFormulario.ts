/**
 * Regras pequenas do formulário de solicitação de materiais.
 *
 * O formulário tinha 13 campos no cabeçalho e no item, todos abertos ao
 * mesmo tempo. Boa parte é opcional e raramente preenchida, e dois deles
 * — solicitante e data da solicitação — o próprio sistema já sabe.
 * Aqui fica o que decide o que aparece, o que fica recolhido e o que vem
 * preenchido. Sem React, sem banco.
 */

/**
 * Quem está pedindo, como sai impresso na solicitação.
 *
 * Vinha o pedaço do e-mail antes do @ — "ivanjr.tstconsultoria" —, e era
 * isso que ia para o PDF e para o e-mail do fornecedor. O nome do perfil,
 * quando existe, é o que a pessoa escolheu para aparecer.
 */
export function nomeDoSolicitante(nomeDoPerfil: string | null | undefined, email: string | null | undefined): string {
  const nome = (nomeDoPerfil || "").trim();
  if (nome) return nome;
  return (email || "").split("@")[0]?.trim() || "";
}

/**
 * Pode trocar o solicitante pelo nome do perfil?
 *
 * Só quando o campo ainda tem o valor automático (vazio ou o pedaço do
 * e-mail). O que a pessoa digitou — pedindo em nome de outro — ou o que
 * veio de um rascunho recuperado não é sobrescrito.
 */
export function solicitanteAindaAutomatico(atual: string | null | undefined, email: string | null | undefined): boolean {
  const valor = (atual || "").trim();
  return valor === "" || valor === (email || "").split("@")[0];
}

export interface CamposOpcionais {
  solicitante_nome?: string | null;
  local_obra?: string | null;
  setor?: string | null;
  justificativa?: string | null;
  observacoes?: string | null;
}

/**
 * O que já está preenchido na seção recolhida "Mais informações".
 *
 * O título da seção diz isso em voz alta: esconder um campo preenchido
 * sem avisar faz a pessoa achar que perdeu o que digitou.
 */
export function preenchidosNosDetalhes(head: CamposOpcionais): string[] {
  const nomes: [keyof CamposOpcionais, string][] = [
    ["local_obra", "local"],
    ["setor", "setor"],
    ["justificativa", "justificativa"],
    ["observacoes", "observações"],
  ];
  return nomes.filter(([campo]) => (head[campo] || "").toString().trim() !== "").map(([, nome]) => nome);
}

/** Item com justificativa ou observação: a área de notas já abre aberta. */
export function itemTemNotas(item: { justificativa_item?: string | null; observacoes?: string | null }): boolean {
  return !!((item.justificativa_item || "").trim() || (item.observacoes || "").trim());
}

/** "17/11/2026", a partir do "2026-11-17" que o campo de data guarda. */
export function dataBrasileira(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
