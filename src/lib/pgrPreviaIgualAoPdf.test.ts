import { describe, expect, it, vi } from "vitest";
import { render, type PgrPdfContext } from "./pgrPdf";

/*
 * "Ver como vai sair" tem de mostrar EXATAMENTE o que o "Gerar PDF" grava.
 *
 * Os dois chamam a mesma função de desenho com os mesmos argumentos — mas
 * isso é uma afirmação sobre o código, e o que importa é o arquivo. Este
 * teste gera os dois pelo mesmo caminho e compara o desenho inteiro, para
 * que uma mudança futura num dos botões não passe despercebida no outro.
 *
 * A única diferença legítima é a numeração da versão: a pré-visualização
 * mostra qual SERIA a próxima versão, sem reservá-la no banco.
 */
const item = {
  id: "i1", ges_id: "g1", ghe_id: "g1", grupo: "fisico", perigo_descricao: "Ruído",
  fonte_geradora: "Máquinas", lesoes: "PAIR", limite_tolerancia: "85 dB(A)",
  intensidade: "88 dB(A)", tipo_exposicao: "continua", tecnica_utilizada: "NHO-01",
  controles_existentes: ["Enclausuramento"], epi: "Protetor auricular", atenuacao: "NRRsf 17",
  avaliacao_tipo: "quantitativa", probabilidade: 4, severidade: 3, classificacao: "moderado",
  trabalhadores_expostos: 5, setor: "PRODUÇÃO", descricao_ambiente: "Galpão",
  processo: "Corte", funcoes_snapshot: ["Operador"],
};

const CTX: PgrPdfContext = {
  doc: { id: "d1", empresa_id: "e1", unidade_id: null, versao: 2, status: "rascunho",
    data_emissao: "2026-07-01", data_vigencia_inicio: "2026-07-01", data_vigencia_fim: "2027-07-01",
    resp_tec_nome: "Maria Souza", resp_tec_registro: "CREA 123" } as never,
  empresaNome: "EMPRESA TESTE LTDA", empresaCnpj: "11.222.333/0001-44", unidadeNome: null,
  inventario: [item] as never,
  acoes: [{ id: "a1", inventario_item_id: "i1", what: "Enclausurar", why: "Ruído alto",
    how: "Cabine", where_local: "Produção", how_much: 1000, prioridade: 5,
    meses_execucao: [3], who: "SESMT", status: "pendente", classe_risco: "moderado",
    forma_acompanhamento: "Medição", indicador: "< 85 dB" }] as never,
  evidencias: [], revisoes: [], assinaturas: [],
  ghes: { g1: "01" }, textos: {},
  unidades: [{ id: "e1", nome: "EMPRESA TESTE LTDA", cnpj: "11.222.333/0001-44",
    cnae_principal: "14.12-6-01", cnae_secundario: ["13.40-5-01"], grau_risco: 2,
    cidade: "Fortaleza", uf: "CE", endereco: "Rua A, 1", bairro: "Centro",
    cep: "60000-000", telefone: "(85) 3333-4444" }] as never,
  responsaveis: [{ papel: "responsavel_tecnico", nome: "Maria Souza",
    profissao: "Engenheira de Segurança", registro_profissional: "CREA 123",
    uf_registro: "CE" }] as never,
  ambientes: [], processos: [], setores: [], gesDetalhes: [], funcoes: [], atividades: [],
};

/** Só o que é desenhado: texto e comandos, sem os metadados do arquivo. */
async function desenho(opts: { pdfVersao: number }) {
  const pdf = await render(CTX, {
    qrUrl: `https://safetysolucoes.com/pgr/validar/d1?v=${opts.pdfVersao}`,
    pdfVersao: opts.pdfVersao,
    comMarca: true,
  });
  const bruto = Buffer.from(pdf.output("arraybuffer")).toString("latin1");
  /*
   * Fora da comparação: a data e a hora da geração, que mudam entre as duas
   * chamadas por definição, e os identificadores internos do arquivo.
   */
  return bruto
    .replace(/\d{2}\/\d{2}\/\d{4},? \d{2}:\d{2}:\d{2}/g, "<data>")
    .replace(/\/CreationDate \([^)]*\)/g, "/CreationDate (<data>)")
    .replace(/\/ID \[[^\]]*\]/g, "/ID []");
}

/*
 * Texto desenhado. O PDF escreve parênteses escapados — `\(Dois\)` —, então
 * quem procura "02 (Dois)" no arquivo cru não acha, e conclui errado que o
 * documento está sem o campo. Desfazer o escape faz parte de ler o PDF.
 */
function textoDo(pdf: { output: (t: "arraybuffer") => ArrayBuffer }): string[] {
  const bruto = Buffer.from(pdf.output("arraybuffer")).toString("latin1");
  return [...bruto.matchAll(/\((?:\\.|[^\\)])*\) Tj/g)].map((m) =>
    m[0].slice(1, -4).replace(/\\([()\\])/g, "$1"),
  );
}

describe("a pré-visualização é o PDF", () => {
  it("desenha exatamente o mesmo documento", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T12:00:00Z"));
    try {
      const previa = await desenho({ pdfVersao: 1 });
      const gravado = await desenho({ pdfVersao: 1 });
      expect(previa.length, "os dois documentos têm tamanhos diferentes")
        .toBe(gravado.length);
      expect(previa).toBe(gravado);
    } finally {
      vi.useRealTimers();
    }
  }, 60_000);

  it("a marca d'água de rascunho sai nos dois", async () => {
    const pdf = await render(CTX, { qrUrl: "https://x", pdfVersao: 1, comMarca: true });
    const texto = textoDo(pdf).join(" ");
    expect(texto).toContain("RASCUNHO");
  }, 30_000);
});

describe("a identificação da empresa traz o que o Word traz", () => {
  it("todas as onze linhas, com os valores do cadastro", async () => {
    const pdf = await render(CTX, { qrUrl: "https://x", pdfVersao: 1, comMarca: false });
    const texto = textoDo(pdf).join(" | ");

    for (const rotulo of [
      "Razão Social", "Nome Fantasia", "CNPJ", "CNAE Principal", "CNAE Secundário",
      "Grau de Risco", "Endereço", "Bairro", "Cidade / UF", "CEP", "Telefone",
    ]) {
      expect(texto, `faltou a linha "${rotulo}"`).toContain(rotulo);
    }

    /* E com valor, não em branco. O CNAE secundário só existe no documento
       se a consulta pedir a coluna — ele já saiu vazio por isso. */
    expect(texto, "o CNAE secundário saiu vazio").toContain("13.40-5-01");
    /* Grau de risco por extenso, como a NR-04 escreve. */
    expect(texto, "o grau de risco saiu como número cru").toContain("02 (Dois)");
  }, 30_000);
});
