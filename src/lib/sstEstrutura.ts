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
  setorNome?: string | string[] | null,
  funcoes?: { nome?: string | null }[],
): string {
  // Aceita mais de um setor porque o grupo pode reunir funções de setores
  // diferentes — é justamente para isso que o GES existe, e o texto precisa
  // dizer "dos setores X e Y" em vez de esconder um deles.
  const lista = Array.isArray(setorNome)
    ? Array.from(new Set(setorNome.map(limpo).filter(Boolean)))
    : [limpo(setorNome)].filter(Boolean);
  if (lista.length === 0) return "";
  // A preposição entra aqui porque muda com o número: "do setor X" mas
  // "dos setores X e Y".
  const setor = lista.length === 1
    ? `do setor ${lista[0]}`
    : `dos setores ${lista.slice(0, -1).join(", ")} e ${lista[lista.length - 1]}`;
  // Sem repetir nome. O cadastro tem funções duplicadas (mesma função criada
  // mais de uma vez), e o grupo 01 desta base chega a ter "Ajudante de
  // Confecção" duas vezes. Num documento legal, listar a mesma função duas
  // vezes na mesma frase é erro visível.
  const nomes = Array.from(new Set(
    (funcoes || []).map((f) => limpo(f?.nome)).filter(Boolean),
  ));
  if (nomes.length === 0) {
    return `Trabalhadores ${setor}, sujeitos às mesmas condições de exposição.`;
  }
  const nomeadas = nomes.length === 1
    ? nomes[0]
    : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
  return `Trabalhadores ${setor} nas funções ${nomeadas}, sujeitos às mesmas condições de exposição.`;
}

/**
 * Este texto foi escrito pelo sistema ou por uma pessoa?
 *
 * Serve para poder regenerar o critério sem apagar texto humano. O sistema
 * escreve em dois formatos: o de `criterioAgrupamentoSugerido` (grupo com
 * setor e funções) e o que a tela de Setores grava ao criar o grupo
 * automático do setor. Qualquer outra coisa foi alguém que digitou.
 */
export function ehCriterioEscritoPeloSistema(texto?: string | null): boolean {
  const t = limpo(texto);
  if (!t) return false;
  return /^Trabalhadores dos? setor(es)? /i.test(t) || /^Agrupamento por setor:/i.test(t);
}

/**
 * O critério de agrupamento que sai no documento.
 *
 * O campo "Descrição curta da exposição" saiu do cadastro de grupos: a
 * composição do grupo (setor + funções) já está cadastrada, e repetir isso à
 * mão só criava uma cópia que envelhecia. Ao mover uma função de grupo, o
 * texto guardado continuava dizendo a composição antiga — e era esse texto que
 * ia para o PGR.
 *
 * Agora o texto é montado na hora de usar, a partir do cadastro. O que estiver
 * guardado só prevalece se tiver sido escrito por uma pessoa: quem já detalhou
 * a exposição à mão não perde o que escreveu.
 */
export function criterioDoGrupo(args: {
  armazenado?: string | null;
  setorNome?: string | string[] | null;
  funcoes?: { nome?: string | null }[];
}): string {
  const guardado = limpo(args.armazenado);
  if (guardado && !ehCriterioEscritoPeloSistema(guardado)) return guardado;
  return criterioAgrupamentoSugerido(args.setorNome, args.funcoes) || guardado;
}


/**
 * Os setores de um grupo de exposição, tirados de QUEM está no grupo.
 *
 * Um GES é um Grupo de Exposição Similar: quem forma o grupo são as funções.
 * O setor não precisa ser apontado à parte — cada função já pertence a um, e
 * é daí que ele sai. Apontar de novo criava um segundo lugar para a mesma
 * informação, livre para discordar do primeiro.
 *
 * O vínculo antigo (`ghe_setores`) fica como reserva para o grupo que ainda
 * não tem nenhuma função. Nesta base são 10 dos 13 grupos: nasceram junto com
 * o setor e ainda estão vazios. Sem a reserva, todos eles perderiam o setor de
 * uma vez, e o PGR sairia com "não declarado" em cada um.
 */
export function setoresDoGrupo(
  funcoes?: { setorNome?: string | null }[],
  reserva?: string | string[] | null,
): string[] {
  const dasFuncoes = Array.from(new Set(
    (funcoes || []).map((f) => limpo(f?.setorNome)).filter(Boolean),
  ));
  if (dasFuncoes.length > 0) return dasFuncoes;
  const lista = Array.isArray(reserva) ? reserva : [reserva];
  return Array.from(new Set(lista.map(limpo).filter(Boolean)));
}

/**
 * O nome de um grupo de exposição.
 *
 * Os grupos nasciam chamados pelo próprio código — "01", "02", "03" —, e o
 * cartão já mostra esse código num crachá ao lado. O nome repetia o crachá e
 * não dizia nada sobre o grupo: para saber de quem se tratava era preciso ler
 * a lista de funções abaixo.
 *
 * Como o grupo já sabe de que setor é (pelas funções que estão nele), o nome
 * sai daí. Dois grupos do mesmo setor ficam com o mesmo nome e crachás
 * diferentes — "COSTURA" 01 e "COSTURA" 02 —, que é justamente como se fala
 * deles.
 *
 * Nome escrito por uma pessoa continua valendo: é o caso do grupo que
 * atravessa setores e merece nome próprio ("Equipe de manutenção móvel").
 * Nome igual ao código não conta como escrito por gente — era o padrão antigo.
 */
export function nomeDoGrupo(args: {
  armazenado?: string | null;
  codigo?: string | null;
  setores?: string[];
}): string {
  const guardado = limpo(args.armazenado);
  const codigo = limpo(args.codigo);
  const soNumero = /^\d+$/.test(guardado);
  const ehPadraoAntigo = !guardado
    || guardado.toLowerCase() === codigo.toLowerCase()
    || (soNumero && Number(guardado) === Number(codigo));
  if (!ehPadraoAntigo) return guardado;

  const setores = (args.setores || []).map(limpo).filter(Boolean);
  if (setores.length === 0) return guardado || codigo;
  if (setores.length === 1) return setores[0];
  return `${setores.slice(0, -1).join(", ")} e ${setores[setores.length - 1]}`;
}
