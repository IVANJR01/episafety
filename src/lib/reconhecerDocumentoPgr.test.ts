import { describe, it, expect } from "vitest";
import { reconhecerDocumento } from "./reconhecerDocumentoPgr";

/**
 * O caso que obrigou a escrever isto aconteceu com documento de verdade:
 * foram enviados para a importação do PGR o Word e a planilha de um PGRS
 * — Plano de Gerenciamento de RESÍDUOS Sólidos. A importação não
 * reclamou: leu o arquivo, não reconheceu risco nenhum e seguiu, deixando
 * o técnico descobrir sozinho que não tinha entrado nada.
 *
 * O trecho abaixo é o começo do documento real que foi enviado.
 */
const TEXTO_PGRS_REAL = `PGRS
PLANO DE GERENCIAMENTO DE RESÍDUOS SÓLIDOS
Elaboração: 08/11/2022
APRESENTAÇÃO
A obrigatoriedade da implantação da Logística Reversa é instituída pela PNRS - Política Nacional de Resíduos Sólidos, Lei nº 12.305/2010, que objetiva fortalecer a Gestão Integrada e Gerenciamento de Resíduos Sólidos no Brasil, devendo a sua operacionalização promover a inclusão social das Associações/cooperativas de catadores como parceiros na coleta/segregação dos produtos pós consumo.
O que é PGRS?
O Plano de Gerenciamento de Resíduos Sólidos (PGRS) é um instrumento da Política Nacional de Resíduos Sólidos (12.305/2010), parte integrante do processo de Licenciamento ambiental.
1 – IDENTIFICAÇÃO DO EMPREENDIMENTO
Razão Social: G91 Nordeste Confecções Ltda
CNPJ: 14.256.653/0001-40`;

/* A planilha que veio junto: caracterização de resíduos, não de riscos. */
const TEXTO_PLANILHA_RESIDUOS = `CARACTERIZAÇÃO DO RESÍDUOS
N° Resíduo Origem Segregação/Identificação Frequência de Geração Acondicionamento Armazenamento Disposição Final
1 Sobras de tecidos e retalhos Após enfesto e corte Classe II - A Diário Sacos plásticos Sala de armazenamento Semanal REUTILIZAÇÃO
2 Canudo de papelão Após enfesto Classe II - A Diário Amarração com cordão ATERRO SANITÁRIO`;

const TEXTO_PGR = `PROGRAMA DE GERENCIAMENTO DE RISCOS - PGR
Conforme NR-01, item 1.5.
INVENTÁRIO DE RISCOS OCUPACIONAIS
GES 01 - COSTURA
Agente físico: ruído contínuo. Severidade 3, Probabilidade 4. Nível de risco: 12.
Agente ergonômico: postura sentada prolongada.
PLANO DE AÇÃO`;

const TEXTO_PCMSO = `PROGRAMA DE CONTROLE MÉDICO DE SAÚDE OCUPACIONAL - PCMSO
Conforme NR-07.
Exame admissional, exame periódico e exame demissional por função.`;

describe("o arquivo de resíduos é reconhecido e recusado", () => {
  it("o Word de PGRS não serve para importar PGR", () => {
    const r = reconhecerDocumento({
      texto: TEXTO_PGRS_REAL,
      nomeArquivo: "PGRS - G91 NORDESTE.docx",
    });
    expect(r.tipo).toBe("residuos");
    expect(r.serveParaPgr, "deixaria importar resíduo como risco").toBe(false);
    expect(r.veredito).toMatch(/res[íi]duos s[óo]lidos/i);
  });

  it("o veredito explica a diferença, não só recusa", () => {
    /*
     * "Arquivo inválido" não ajuda ninguém. O técnico precisa saber POR
     * QUE, porque os nomes são quase iguais e o engano é fácil.
     */
    const r = reconhecerDocumento({ texto: TEXTO_PGRS_REAL });
    expect(r.veredito).toMatch(/riscos ocupacionais/i);
    expect(r.evidencias.length, "não mostrou o que leu no documento")
      .toBeGreaterThan(0);
  });

  it("a planilha de resíduos também é reconhecida", () => {
    const r = reconhecerDocumento({
      texto: TEXTO_PLANILHA_RESIDUOS,
      nomeArquivo: "PGRS.xlsx",
    });
    expect(r.tipo).toBe("residuos");
    expect(r.serveParaPgr).toBe(false);
  });

  it("resíduo com risco extraído ainda é recusado", () => {
    /*
     * Se a leitura por IA achar "risco" numa planilha de resíduos, o
     * texto manda: o documento continua sendo de resíduos.
     */
    const r = reconhecerDocumento({
      texto: TEXTO_PGRS_REAL,
      riscosEncontrados: 5,
    });
    expect(r.tipo).toBe("residuos");
    expect(r.serveParaPgr).toBe(false);
  });
});

describe("o PGR de verdade passa", () => {
  it("reconhece e libera quando há risco extraído", () => {
    const r = reconhecerDocumento({ texto: TEXTO_PGR, riscosEncontrados: 66 });
    expect(r.tipo).toBe("pgr");
    expect(r.serveParaPgr).toBe(true);
    expect(r.veredito).toMatch(/66 riscos/);
  });

  it("texto de PGR sem risco extraído avisa e orienta", () => {
    /*
     * Caso comum: o Word traz o inventário em IMAGEM e os riscos moram na
     * planilha. Não adianta dizer "deu certo" com zero risco.
     */
    const r = reconhecerDocumento({ texto: TEXTO_PGR, riscosEncontrados: 0 });
    expect(r.tipo).toBe("pgr");
    expect(r.serveParaPgr, "deixaria gravar um PGR sem risco nenhum").toBe(false);
    expect(r.veredito).toMatch(/planilha/i);
  });

  it("documento de onde saiu inventário vale como PGR", () => {
    /* A prova é o risco extraído, não a palavra exata no texto. */
    const r = reconhecerDocumento({
      texto: "Levantamento de agentes por grupo de exposição na unidade fabril.",
      riscosEncontrados: 40,
    });
    expect(r.serveParaPgr).toBe(true);
  });
});

describe("outros casos", () => {
  it("PCMSO manda usar a importação do PCMSO", () => {
    const r = reconhecerDocumento({ texto: TEXTO_PCMSO });
    expect(r.tipo).toBe("pcmso");
    expect(r.serveParaPgr).toBe(false);
    expect(r.veredito).toMatch(/PCMSO/);
  });

  it("arquivo sem texto legível é dito como tal", () => {
    for (const vazio of ["", null, undefined, "   "]) {
      const r = reconhecerDocumento({ texto: vazio });
      expect(r.tipo).toBe("desconhecido");
      expect(r.veredito).toMatch(/ler texto/i);
    }
  });

  it("uma palavra solta não é suficiente para chamar de PGR", () => {
    /*
     * "Perigo" aparece em contrato, em manual de máquina e em placa de
     * advertência. Sozinha ela não faz um PGR: sem uma pontuação mínima,
     * qualquer papel com uma palavra em comum entraria como inventário.
     */
    const r = reconhecerDocumento({
      texto: "Manual do equipamento. Atenção: perigo de esmagamento ao operar a prensa sem a proteção instalada.",
    });
    expect(r.tipo, "um único termo bastou para classificar").toBe("desconhecido");
    expect(r.serveParaPgr).toBe(false);
  });

  it("planilha de resíduos curta, só com o título, ainda é reconhecida", () => {
    /*
     * O caso real da planilha enviada: a primeira linha diz tudo, e o
     * resto são colunas. Se o reconhecimento depender de texto corrido
     * longo, a planilha passa batida.
     */
    const r = reconhecerDocumento({
      texto: "CARACTERIZAÇÃO DOS RESÍDUOS\nN° Resíduo Origem Frequência de Geração",
      nomeArquivo: "PGRS.xlsx",
    });
    expect(r.tipo).toBe("residuos");
    expect(r.serveParaPgr).toBe(false);
  });

  it("texto que não é nenhum dos três não vira PGR por descuido", () => {
    const r = reconhecerDocumento({
      texto: "Contrato de locação de equipamentos industriais entre as partes, com vigência de 12 meses e reajuste anual.",
    });
    expect(r.serveParaPgr).toBe(false);
    expect(r.tipo).toBe("desconhecido");
  });
});
