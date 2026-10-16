/**
 * Mês previsto de uma ação do cronograma.
 *
 * O cronograma do PCMSO planeja o ano: "campanha de vacinação em maio",
 * "treinamento de ergonomia em agosto". O campo pedia dia, mês e ano, e
 * dia nenhum é verdade nessa altura — quem preenche escolhe um dia
 * qualquer, e o documento sai afirmando uma data que ninguém combinou.
 *
 * O banco continua guardando uma data (`data_planejada` é do tipo date),
 * e o dia gravado é sempre o primeiro do mês. O que muda é o que se pede
 * e o que se mostra: mês e ano.
 */

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-05" -> "2026-05-01". Vazio continua vazio. */
export function mesParaData(mes?: string | null): string | null {
  const m = (mes || "").trim();
  if (!/^\d{4}-\d{2}$/.test(m)) return null;
  return `${m}-01`;
}

/** "2026-05-01" -> "2026-05", para o campo de mês do formulário. */
export function dataParaMes(data?: string | null): string {
  const d = (data || "").trim();
  if (!/^\d{4}-\d{2}/.test(d)) return "";
  return d.slice(0, 7);
}

/** "2026-05-01" -> "05/2026". Sem data, devolve vazio. */
export function mesCurto(data?: string | null): string {
  const m = dataParaMes(data);
  if (!m) return "";
  const [ano, mes] = m.split("-");
  return `${mes}/${ano}`;
}

/** "2026-05-01" -> "Maio/2026", para o documento. */
export function mesExtenso(data?: string | null): string {
  const m = dataParaMes(data);
  if (!m) return "";
  const [ano, mes] = m.split("-");
  const nome = MESES[Number(mes) - 1];
  if (!nome) return "";
  return `${nome[0].toUpperCase()}${nome.slice(1)}/${ano}`;
}
