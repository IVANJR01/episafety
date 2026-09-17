/**
 * A janela de 24 horas da Meta, do lado da tela.
 *
 * A Meta só aceita mensagem de texto livre até 24h depois da última mensagem
 * DO CLIENTE. Passou disso, só template aprovado — e a tentativa de texto livre
 * volta como erro, já contada como tentativa.
 *
 * Quem decide de verdade é a Edge Function `whatsapp-enviar`, que confere a
 * janela antes de gastar a chamada e devolve 409 `janela_24h_fechada`. O que
 * está aqui é para a tela poder avisar ANTES de a pessoa escrever um parágrafo
 * inteiro que não vai poder ser enviado.
 */

const VINTE_E_QUATRO_HORAS_MS = 24 * 60 * 60 * 1000;

function msDesde(ultimaEntradaEm: string | null | undefined, agora: Date): number | null {
  if (!ultimaEntradaEm) return null;
  const quando = new Date(ultimaEntradaEm).getTime();
  if (!Number.isFinite(quando)) return null;
  return agora.getTime() - quando;
}

/** Dá para mandar texto livre agora? */
export function janelaAberta(ultimaEntradaEm: string | null | undefined, agora = new Date()): boolean {
  const decorrido = msDesde(ultimaEntradaEm, agora);
  if (decorrido === null) return false;
  return decorrido >= 0 && decorrido < VINTE_E_QUATRO_HORAS_MS;
}

/**
 * Quanto falta para a janela fechar, em texto curto para caber no rodapé do
 * campo de escrita. `null` quando já está fechada — aí o texto é outro.
 */
export function tempoRestanteJanela(
  ultimaEntradaEm: string | null | undefined,
  agora = new Date(),
): string | null {
  const decorrido = msDesde(ultimaEntradaEm, agora);
  if (decorrido === null || decorrido < 0 || decorrido >= VINTE_E_QUATRO_HORAS_MS) return null;

  const restanteMin = Math.floor((VINTE_E_QUATRO_HORAS_MS - decorrido) / 60000);
  const horas = Math.floor(restanteMin / 60);
  const minutos = restanteMin % 60;

  // Abaixo de uma hora o número de minutos é a informação útil; acima, ninguém
  // decide nada com os minutos.
  if (horas === 0) return `${minutos} min`;
  if (minutos === 0) return `${horas}h`;
  return `${horas}h${String(minutos).padStart(2, "0")}`;
}

/** Hora curta para a bolha da mensagem: hoje só a hora, antes disso a data. */
export function horaDaMensagem(iso: string, agora = new Date()): string {
  const quando = new Date(iso);
  if (!Number.isFinite(quando.getTime())) return "";

  const mesmoDia =
    quando.getDate() === agora.getDate() &&
    quando.getMonth() === agora.getMonth() &&
    quando.getFullYear() === agora.getFullYear();

  const hora = quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (mesmoDia) return hora;
  return `${quando.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${hora}`;
}

/**
 * (85) 98888-7777 a partir do wa_id da Meta, que vem só com dígitos.
 *
 * Só formata número brasileiro. Um número de fora tem 11 dígitos também
 * (+1 323 555 1234), e aplicar a máscara de DDD nele inventa um telefone que
 * não existe — melhor mostrar o internacional com o "+" e deixar claro que é
 * de fora.
 */
export function telefoneLegivel(waId: string): string {
  const d = (waId || "").replace(/\D+/g, "");
  if (!d) return waId;
  if (!d.startsWith("55")) return `+${d}`;

  const semDdi = d.slice(2);
  if (semDdi.length === 11) return `(${semDdi.slice(0, 2)}) ${semDdi.slice(2, 7)}-${semDdi.slice(7)}`;
  if (semDdi.length === 10) return `(${semDdi.slice(0, 2)}) ${semDdi.slice(2, 6)}-${semDdi.slice(6)}`;
  return `+${d}`;
}
