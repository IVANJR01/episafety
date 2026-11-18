/**
 * Acompanha a folha entre um quadro e outro da câmera.
 *
 * O detector olha cada quadro sozinho. Na mão de quem segura o celular, o
 * contorno verde pulava alguns pixels a cada quadro, piscava quando um
 * quadro saía tremido e aparecia por um instante quando um papel qualquer
 * passava pela frente. Aqui ficam três regras simples:
 *
 *  - só mostra a folha depois de vê-la em 2 quadros seguidos no mesmo lugar;
 *  - enquanto ela fica no lugar, os cantos andam metade do caminho até a
 *    nova posição (o contorno desliza em vez de tremer);
 *  - um ou dois quadros sem achar não apagam o contorno — só o terceiro.
 */
export interface Ponto { x: number; y: number }

export interface EstadoDaFolha {
  cantos: Ponto[] | null;
  /** Quadros seguidos em que a folha apareceu no mesmo lugar. */
  vistos: number;
  /** Quadros seguidos sem folha. */
  falhas: number;
}

export const SEM_FOLHA: EstadoDaFolha = { cantos: null, vistos: 0, falhas: 0 };

/** Fração do lado maior do quadro que um canto pode andar e ainda ser "a mesma folha". */
export const MESMO_LUGAR = 0.05;
export const QUADROS_PARA_MOSTRAR = 2;
export const FALHAS_TOLERADAS = 2;

function mesmoLugar(a: Ponto[], b: Ponto[], limite: number): boolean {
  return a.every((p, i) => Math.hypot(p.x - b[i].x, p.y - b[i].y) <= limite);
}

export function acompanharFolha(
  estado: EstadoDaFolha,
  achados: Ponto[] | null,
  ladoMaior: number,
): { estado: EstadoDaFolha; mostrar: Ponto[] | null } {
  let novo: EstadoDaFolha;
  if (!achados) {
    const falhas = estado.falhas + 1;
    novo = falhas > FALHAS_TOLERADAS ? SEM_FOLHA : { ...estado, falhas };
  } else if (estado.cantos && mesmoLugar(estado.cantos, achados, MESMO_LUGAR * ladoMaior)) {
    novo = {
      cantos: estado.cantos.map((p, i) => ({ x: (p.x + achados[i].x) / 2, y: (p.y + achados[i].y) / 2 })),
      vistos: estado.vistos + 1,
      falhas: 0,
    };
  } else {
    novo = { cantos: achados, vistos: 1, falhas: 0 };
  }
  return { estado: novo, mostrar: novo.vistos >= QUADROS_PARA_MOSTRAR ? novo.cantos : null };
}
