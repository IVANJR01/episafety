/**
 * O backup está em dia? — a frase e a cor do topo da tela de Backups.
 *
 * O backup antigo parou em abril de 2026 e ninguém soube por sete meses,
 * porque nada na tela dizia "parado". Agora a tela diz, e diz em
 * português: quando foi o último que deu certo e se isso é tarde demais.
 */
export interface Execucao {
  iniciado_em: string;
  terminado_em: string | null;
  modo: string;
  status: string; // rodando | ok | parcial | erro
  erro?: string | null;
}

export type Nivel = "ok" | "atencao" | "problema";

/** Passou disto sem um backup completo que deu certo, a tela acusa. */
export const HORAS_DE_TOLERANCIA = 48;

export function situacaoDoBackup(execucoes: Execucao[], agora = new Date()): { nivel: Nivel; texto: string } {
  const completos = execucoes
    .filter((e) => e.modo === "completo")
    .sort((a, b) => b.iniciado_em.localeCompare(a.iniciado_em));
  const ultimoBom = completos.find((e) => e.status === "ok" || e.status === "parcial");
  if (!ultimoBom) {
    return { nivel: "problema", texto: "Nenhum backup completo deu certo ainda." };
  }
  const horas = (agora.getTime() - Date.parse(ultimoBom.terminado_em || ultimoBom.iniciado_em)) / 3_600_000;
  const quando = new Date(ultimoBom.terminado_em || ultimoBom.iniciado_em)
    .toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  if (horas > HORAS_DE_TOLERANCIA) {
    return { nivel: "problema", texto: `Último backup que deu certo: ${quando}. Está atrasado.` };
  }
  const ultimo = completos[0];
  if (ultimo.status === "erro") {
    return { nivel: "atencao", texto: `O último backup falhou. O anterior, de ${quando}, está guardado.` };
  }
  if (ultimoBom.status === "parcial") {
    return { nivel: "atencao", texto: `Último backup em ${quando}, mas com itens que não foram copiados.` };
  }
  return { nivel: "ok", texto: `Backup em dia. Último: ${quando}.` };
}
