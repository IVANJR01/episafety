/**
 * A lista de entregas sem as imagens; as imagens só quando precisa.
 *
 * Para mostrar "Assinado / Pendente" a tela de Entregas baixava todas as
 * assinaturas e selfies: 4,7 MB para 109 entregas na maior empresa, e
 * crescendo a cada entrega. Agora a lista pede, no lugar da imagem, a marca
 * "imagem no servidor" — a mesma que a cópia offline já usava, então o
 * resto da tela já sabia lidar com ela. Quem precisa da imagem de verdade
 * (a Ficha de EPI e o código de verificação, que é calculado sobre ela)
 * busca só as entregas daquele trabalhador, na hora.
 *
 * As funções assinatura_resumo e foto_resumo estão no banco
 * (supabase/migrations/20261123180000_entregas_resumo_de_imagem.sql).
 */
import { imagemSoNoServidor } from "./cacheOfflineLeve";

/**
 * Todas as colunas de `entregas`, com as duas de imagem trocadas pelo
 * resumo e devolvidas COM O MESMO NOME. Coluna nova na tabela precisa
 * entrar aqui — senão a tela não a recebe.
 */
export const COLUNAS_DA_LISTA_DE_ENTREGAS = [
  "id", "funcionario_id", "epi_id", "quantidade", "data", "tipo", "observacao", "status",
  "created_by", "created_at", "empresa_id", "nome_assinatura", "unidade_origem_id", "codigo_verificacao",
  "assinatura_colaborador:assinatura_resumo",
  "foto_reconhecimento:foto_resumo",
].join(",");

interface ComImagens {
  id: string;
  assinatura_colaborador?: string | null;
  foto_reconhecimento?: string | null;
}

/** Quais destas linhas têm imagem que ficou no servidor. */
export function idsSemImagem(linhas: ComImagens[]): string[] {
  return linhas
    .filter((l) => imagemSoNoServidor(l.assinatura_colaborador) || imagemSoNoServidor(l.foto_reconhecimento))
    .map((l) => l.id);
}

/**
 * Põe as imagens de verdade nas linhas. Linha que não veio na busca (sem
 * internet, por exemplo) continua com a marca — e a ficha já imprime
 * "ASSINADO — imagem no servidor" nesse caso, em vez de uma caixa vazia.
 */
export function juntarImagens<T extends ComImagens>(linhas: T[], imagens: ComImagens[]): T[] {
  const porId = new Map(imagens.map((i) => [i.id, i]));
  return linhas.map((l) => {
    const i = porId.get(l.id);
    if (!i) return l;
    return {
      ...l,
      // O que veio do servidor é o valor de verdade das duas colunas.
      assinatura_colaborador: i.assinatura_colaborador ?? null,
      foto_reconhecimento: i.foto_reconhecimento ?? null,
    };
  });
}

/**
 * Busca as imagens que faltam e devolve as linhas completas. `buscar`
 * recebe ids (em lotes, para a URL não estourar) e devolve as linhas com
 * as duas colunas de imagem.
 */
export async function completarImagens<T extends ComImagens>(
  linhas: T[],
  buscar: (ids: string[]) => Promise<ComImagens[]>,
  lote = 50,
): Promise<T[]> {
  const faltam = idsSemImagem(linhas);
  if (faltam.length === 0) return linhas;
  const achadas: ComImagens[] = [];
  for (let i = 0; i < faltam.length; i += lote) {
    try {
      achadas.push(...(await buscar(faltam.slice(i, i + lote))));
    } catch { /* sem internet: segue com a marca */ }
  }
  return juntarImagens(linhas, achadas);
}
