/**
 * Descrição de um ambiente a partir do que foi cadastrado na Estrutura.
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
 * Nome + caracterização, como vai para o inventário e para o documento.
 * Sem caracterização, devolve só o nome — nunca inventa texto.
 */
export function descreverAmbiente(a?: AmbienteCaracterizavel | null): string {
  if (!a) return "";
  const nome = limpo(a.nome);
  const cars = caracteristicasAmbiente(a);
  if (!nome) return cars;
  return cars ? `${nome} — ${cars}` : nome;
}
