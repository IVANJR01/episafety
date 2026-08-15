/**
 * Executa tarefas em paralelo com um teto, sem esperar por lote.
 *
 * O relatório de inspeções baixava as fotos em lotes travados: dois itens por
 * vez, e a rodada seguinte só começava quando a foto mais lenta da rodada
 * atual terminasse. Com 28 não conformidades isso vira 14 esperas em série, e
 * cada uma custa o tempo da PIOR foto do par — não da média.
 *
 * Aqui não há rodada. São N trabalhadores puxando da fila assim que ficam
 * livres: uma foto lenta ocupa um lugar e os outros seguem. O tempo total
 * passa a ser governado pela soma dividida pelo teto, e não pela soma dos
 * piores casos.
 *
 * O teto continua existindo porque o navegador limita conexões por domínio e a
 * API de storage tem limite de requisições — disparar 60 downloads de uma vez
 * troca um problema por outro.
 */
export async function mapearComLimite<T, R>(
  itens: readonly T[],
  limite: number,
  tarefa: (item: T, indice: number) => Promise<R>,
): Promise<R[]> {
  const total = itens.length;
  const resultados = new Array<R>(total);
  if (total === 0) return resultados;

  const teto = Math.max(1, Math.min(Math.floor(limite) || 1, total));
  let proximo = 0;

  const trabalhador = async (): Promise<void> => {
    for (;;) {
      const i = proximo++;
      if (i >= total) return;
      // A tarefa é responsável por tratar o próprio erro. Se ela rejeitar, a
      // rejeição sobe e derruba tudo — que é o comportamento certo para erro
      // de programação, e por isso o chamador trata falha esperada lá dentro.
      resultados[i] = await tarefa(itens[i], i);
    }
  };

  await Promise.all(Array.from({ length: teto }, trabalhador));
  return resultados;
}
