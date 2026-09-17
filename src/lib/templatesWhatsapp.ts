/**
 * Templates do WhatsApp: ler o que a Meta aprovou e montar o envio.
 *
 * Um template é um texto com marcadores — `Olá {{1}}, seu {{2}} vence dia
 * {{3}}` — que a Meta aprova uma vez e a empresa reutiliza. Fora da janela de
 * 24h é a única forma de falar com alguém.
 *
 * A Meta aceita duas formas de marcador, e elas não se misturam:
 *   - numerada: `{{1}}`, `{{2}}` — os valores vão na ordem;
 *   - nomeada: `{{nome}}`, `{{data}}` — cada valor viaja com o nome do campo.
 * Mandar a forma errada não manda mensagem nenhuma: a Meta recusa. Por isso o
 * que decide é o próprio texto do template, nunca uma configuração à parte.
 */

export interface ComponenteTemplate {
  /** HEADER, BODY, FOOTER, BUTTONS */
  tipo: string;
  /** Do cabeçalho: TEXT, IMAGE, DOCUMENT, VIDEO */
  formato?: string;
  texto?: string;
}

export interface TemplateWhatsapp {
  nome: string;
  idioma: string;
  categoria: string | null;
  componentes: ComponenteTemplate[];
}

export interface ParametroTemplate {
  valor: string;
  nome?: string;
}

function textoDoComponente(template: TemplateWhatsapp, tipo: string): string | null {
  const componente = template.componentes.find((c) => c.tipo === tipo);
  return componente?.texto?.trim() || null;
}

export function corpoDoTemplate(template: TemplateWhatsapp): string {
  return textoDoComponente(template, "BODY") ?? "";
}

/**
 * O cabeçalho, só quando é de texto.
 *
 * Cabeçalho de imagem, vídeo ou documento também aceita parâmetro, mas o
 * parâmetro é um arquivo — outra conversa, e sem upload não há o que oferecer
 * na tela. Tratar como se fosse texto produziria um envio recusado.
 */
export function cabecalhoDeTexto(template: TemplateWhatsapp): string | null {
  const componente = template.componentes.find((c) => c.tipo === "HEADER");
  if (!componente || (componente.formato && componente.formato !== "TEXT")) return null;
  return componente.texto?.trim() || null;
}

export function rodapeDoTemplate(template: TemplateWhatsapp): string | null {
  return textoDoComponente(template, "FOOTER");
}

/** Os marcadores de um texto, na ordem, sem repetir. */
export function marcadores(texto: string | null | undefined): string[] {
  if (!texto) return [];
  const achados = [...texto.matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g)].map((m) => m[1]);
  return [...new Set(achados)];
}

/** Marcador nomeado é o que não é só dígito. */
export function ehNomeado(marcador: string): boolean {
  return !/^\d+$/.test(marcador);
}

/** Os campos que a pessoa precisa preencher, separados por onde entram. */
export function camposDoTemplate(template: TemplateWhatsapp): {
  cabecalho: string[];
  corpo: string[];
} {
  return {
    cabecalho: marcadores(cabecalhoDeTexto(template)),
    corpo: marcadores(corpoDoTemplate(template)),
  };
}

/**
 * O texto com os valores no lugar dos marcadores.
 *
 * Serve para a prévia na tela e para o que fica gravado no histórico — é o que
 * o cliente vai ler. Marcador sem valor continua aparecendo como marcador, e
 * não some: some é pior, porque a frase fica sem sentido e ninguém entende por
 * quê.
 */
export function preencher(texto: string, valores: Record<string, string>): string {
  return texto.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (inteiro, marcador: string) => {
    const valor = valores[marcador];
    return valor && valor.trim() ? valor : inteiro;
  });
}

/**
 * Os valores digitados, separados por onde entram.
 *
 * São dois mapas, e não um, porque a numeração do cabeçalho é independente da
 * do corpo: no template `Olá, {{1}}` + `O treinamento {{1}} vence`, o primeiro
 * {{1}} é o nome da pessoa e o segundo é o nome do curso. Um mapa só mandaria
 * o mesmo valor nos dois lugares — e a mensagem sai errada para o cliente sem
 * erro nenhum aparecer no caminho.
 */
export interface ValoresTemplate {
  cabecalho: Record<string, string>;
  corpo: Record<string, string>;
}

export const SEM_VALORES: ValoresTemplate = { cabecalho: {}, corpo: {} };

/** Já dá para enviar? Todo marcador precisa de valor — a Meta recusa vazio. */
export function templateCompleto(template: TemplateWhatsapp, valores: ValoresTemplate): boolean {
  const campos = camposDoTemplate(template);
  return (
    campos.cabecalho.every((m) => (valores.cabecalho[m] ?? "").trim().length > 0) &&
    campos.corpo.every((m) => (valores.corpo[m] ?? "").trim().length > 0)
  );
}

/** Monta a lista que a Edge Function espera, já na ordem dos marcadores. */
export function parametrosParaEnvio(
  marcadoresDoTexto: string[],
  valores: Record<string, string>,
): ParametroTemplate[] {
  return marcadoresDoTexto.map((m) => {
    const valor = (valores[m] ?? "").trim();
    return ehNomeado(m) ? { valor, nome: m } : { valor };
  });
}

/** O que a mensagem vai dizer, cabeçalho junto, para a prévia e o histórico. */
export function previaDoTemplate(template: TemplateWhatsapp, valores: ValoresTemplate): string {
  const cabecalho = cabecalhoDeTexto(template);
  const partes = [
    cabecalho ? preencher(cabecalho, valores.cabecalho) : null,
    preencher(corpoDoTemplate(template), valores.corpo),
  ].filter(Boolean);
  return partes.join("\n\n");
}

/** Rótulo do campo: "{{1}}" não diz nada; "Campo 1" e "data" dizem. */
export function rotuloDoCampo(marcador: string): string {
  return ehNomeado(marcador) ? marcador.replace(/_/g, " ") : `Campo ${marcador}`;
}
