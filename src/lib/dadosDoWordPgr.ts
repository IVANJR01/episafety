/**
 * Dados que o PGR em Word traz em tabelas de rótulo e valor.
 *
 * O documento do cliente guarda a identificação das unidades e o
 * responsável técnico em tabelas assim — cada célula é um parágrafo, e
 * o texto extraído do .docx vira rótulo numa linha e valor na seguinte:
 *
 *   MATRIZ
 *   Nome da Empresa
 *   G-91 NORDESTE CONFECÇÕES
 *   CNPJ
 *   14.256.653/0001-40
 *   ...
 *   ELABORAÇÃO E HABILIDADE TÉCNICA
 *   NOME
 *   José Ivan Holanda de Melo Júnior
 *   REGISTRO
 *   0021678/CE
 *
 * Isso tudo ia para a IA junto com o documento inteiro, e voltava vazio:
 * a tela mostrava "Responsável Técnico: A definir" num PGR que diz o
 * nome e o registro dele em letras garrafais.
 *
 * Aqui a leitura é direta. Não custa chamada de IA, não erra o que está
 * escrito, e o que não estiver no documento fica vazio em vez de virar
 * palpite.
 *
 * O inventário de riscos NÃO sai daqui: no documento do cliente ele é
 * uma IMAGEM colada, sem texto nenhum. É por isso que o inventário entra
 * pela planilha.
 */

const semAcento = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** O rótulo, reduzido ao que importa para comparar. */
function rotulo(linha: string): string {
  return semAcento(linha).replace(/[^a-z0-9]/g, "");
}

export interface ResponsavelTecnico {
  nome: string;
  especialidade: string;
  registro: string;
}

/**
 * O responsável técnico pela elaboração.
 *
 * Procura a seção, e não o rótulo solto: "NOME" aparece em outras
 * tabelas do documento, e pegar o primeiro poria o nome da empresa no
 * lugar do nome do técnico.
 */
export function responsavelTecnicoDoWord(linhas: string[]): ResponsavelTecnico | null {
  const inicio = (linhas || []).findIndex(
    (l) => semAcento(l).includes("elaboracao e habilidade")
      /* O sumário repete o título com o código de campo do Word. */
      && !l.includes("PAGEREF"),
  );
  if (inicio < 0) return null;

  const valorDe = (chaves: string[]): string => {
    for (let i = inicio + 1; i < Math.min(inicio + 20, linhas.length); i++) {
      if (chaves.includes(rotulo(linhas[i]))) return (linhas[i + 1] || "").trim();
    }
    return "";
  };

  const nome = valorDe(["nome", "nomedoresponsavel", "responsaveltecnico"]);
  if (!nome) return null;

  return {
    nome,
    especialidade: valorDe(["especialidade", "formacao", "funcao"]),
    registro: valorDe(["registro", "registroprofissional", "crea", "nregistro"]),
  };
}

export interface UnidadeDoWord {
  /** "MATRIZ", "FILIAL - CASTANHÃO". */
  rotulo: string;
  nome: string;
  nomeFantasia: string;
  cnpj: string;
  cnaePrincipal: string;
  cnaeSecundario: string;
  /** 1 a 4, da NR-04. Null quando o documento não diz. */
  grauRisco: number | null;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
}

/** Os rótulos da tabela de identificação, e o campo de cada um. */
const CAMPOS: Record<string, keyof UnidadeDoWord> = {
  nomedaempresa: "nome",
  razaosocial: "nome",
  nomefantasia: "nomeFantasia",
  cnpj: "cnpj",
  cnaeprincipal: "cnaePrincipal",
  cnaesecundario: "cnaeSecundario",
  riscodaatividade: "grauRisco",
  graudrisco: "grauRisco",
  graudeerisco: "grauRisco",
  graudeerrisco: "grauRisco",
  graudderisco: "grauRisco",
  graudrisco2: "grauRisco",
  logradouro: "logradouro",
  endereco: "logradouro",
  bairro: "bairro",
  distrito: "bairro",
  cidadeestado: "cidade",
  cidadeuf: "cidade",
  cidade: "cidade",
  cep: "cep",
  telefone: "telefone",
};

/** "02 (Dois) – NR04" vira 2. Sem número reconhecível, null. */
export function grauDeRisco(texto: string): number | null {
  const m = String(texto || "").match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return n >= 1 && n <= 4 ? n : null;
}

/** "Alto Santo – CE" vira { cidade: "Alto Santo", uf: "CE" }. */
export function cidadeEUf(texto: string): { cidade: string; uf: string } {
  const bruto = String(texto || "").trim();
  const m = bruto.match(/^(.*?)[\s]*[–\-\/][\s]*([A-Za-z]{2})$/);
  if (m) return { cidade: m[1].trim(), uf: m[2].toUpperCase() };
  return { cidade: bruto, uf: "" };
}

function unidadeVazia(rotuloDaUnidade: string): UnidadeDoWord {
  return {
    rotulo: rotuloDaUnidade, nome: "", nomeFantasia: "", cnpj: "",
    cnaePrincipal: "", cnaeSecundario: "", grauRisco: null,
    logradouro: "", bairro: "", cidade: "", uf: "", cep: "", telefone: "",
  };
}

/** A linha abre uma unidade? "MATRIZ", "FILIAL - CASTANHÃO". */
function ehInicioDeUnidade(linha: string): boolean {
  const s = semAcento(linha);
  if (s.includes("pageref")) return false;        // sumário
  return s === "matriz" || s.startsWith("filial") || s.startsWith("unidade");
}

/**
 * As unidades da empresa, com a identificação de cada uma.
 *
 * O valor de um rótulo pode ocupar mais de uma linha — o CNAE secundário
 * do cliente tem dois códigos, quebrados em três linhas pelo Word. Por
 * isso o valor vai sendo juntado até aparecer o rótulo seguinte.
 */
export function unidadesDoWord(linhas: string[]): UnidadeDoWord[] {
  const unidades: UnidadeDoWord[] = [];
  let atual: UnidadeDoWord | null = null;
  let campoAberto: keyof UnidadeDoWord | null = null;

  for (const bruta of linhas || []) {
    const linha = (bruta || "").trim();
    if (!linha) continue;

    if (ehInicioDeUnidade(linha)) {
      if (atual && atual.cnpj) unidades.push(atual);
      atual = unidadeVazia(linha.replace(/^\|\s*/, "").trim());
      campoAberto = null;
      continue;
    }
    if (!atual) continue;

    const campo = CAMPOS[rotulo(linha)];
    if (campo) { campoAberto = campo; continue; }

    if (!campoAberto) continue;

    if (campoAberto === "grauRisco") {
      atual.grauRisco = grauDeRisco(linha);
      campoAberto = null;
      continue;
    }
    if (campoAberto === "cidade") {
      const { cidade, uf } = cidadeEUf(linha);
      atual.cidade = cidade;
      atual.uf = uf;
      campoAberto = null;
      continue;
    }

    /*
     * Só o CNAE ocupa mais de uma linha — a empresa tem dois códigos
     * secundários, e o Word os quebra em três linhas. Os demais campos
     * fecham na primeira: sem isso, o telefone da última unidade ia
     * engolindo o documento inteiro, porque depois dele não vem rótulo
     * nenhum, e sim a seção seguinte.
     */
    const aceitaMaisLinhas =
      campoAberto === "cnaeSecundario" || campoAberto === "cnaePrincipal";
    const anterior = atual[campoAberto] as string;
    (atual[campoAberto] as string) = anterior ? `${anterior} ${linha}` : linha;
    if (!aceitaMaisLinhas) campoAberto = null;
  }

  /* Unidade sem CNPJ é título solto, não unidade. */
  if (atual && atual.cnpj) unidades.push(atual);
  return unidades;
}
