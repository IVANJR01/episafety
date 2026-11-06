import { describe, it, expect } from "vitest";
import { conferirImportacao, textoDaConferencia } from "./conferenciaDaImportacao";

/**
 * O caso real: a importação da G91 disse "PGR importado com sucesso! 25
 * GES cadastrados", e a Estrutura ocupacional mostrou "0 GES · Sem GES"
 * nos 22 setores. A mensagem contava o que a leitura do documento achou,
 * não o que entrou no banco.
 *
 * Mensagem de importação que afirma sucesso sem conferir é pior que
 * mensagem nenhuma: o técnico só descobre o problema três telas depois, e
 * aí não confia mais em nenhuma importação.
 */

const GES = "ges-1";
const SETOR_A = "setor-a";
const SETOR_B = "setor-b";

describe("conferir o que entrou", () => {
  it("conta riscos, setores ligados e setores órfãos", () => {
    const r = conferirImportacao({
      itens: [
        { ghe_id: GES, setor_id: SETOR_A },
        { ghe_id: GES, setor_id: SETOR_A },
      ],
      vinculosDeSetor: [{ setor_id: SETOR_A }],
      setores: [{ id: SETOR_A }, { id: SETOR_B }],
      acoes: 3,
    });
    expect(r.riscos).toBe(2);
    expect(r.setoresLigados).toBe(1);
    expect(r.setoresSemGes).toBe(1);
    expect(r.acoes).toBe(3);
  });

  it("aponta risco sem GES e risco sem setor", () => {
    const r = conferirImportacao({
      itens: [
        { ghe_id: GES, setor_id: SETOR_A },
        { ghe_id: null, setor_id: SETOR_A },
        { ghe_id: GES, setor_id: null },
      ],
      vinculosDeSetor: [{ setor_id: SETOR_A }],
      setores: [{ id: SETOR_A }],
      acoes: 0,
    });
    expect(r.riscosSemGes).toBe(1);
    expect(r.riscosSemSetor).toBe(1);
  });

  it("o estado em que a G91 ficou: tudo criado, nada ligado", () => {
    const setores = Array.from({ length: 22 }, (_, i) => ({ id: `s${i}` }));
    const r = conferirImportacao({
      itens: Array.from({ length: 66 }, () => ({ ghe_id: GES, setor_id: null })),
      vinculosDeSetor: [],
      setores,
      acoes: 0,
    });
    expect(r.setoresSemGes).toBe(22);
    expect(r.setoresLigados).toBe(0);
    expect(r.riscosSemSetor).toBe(66);
  });
});

describe("o que a tela diz no fim", () => {
  it("sem pendência, confirma que conferiu", () => {
    const texto = textoDaConferencia({
      riscos: 66, riscosSemGes: 0, riscosSemSetor: 0,
      setoresLigados: 22, setoresSemGes: 0, acoes: 12,
    });
    expect(texto.completo).toBe(true);
    expect(texto.titulo).toMatch(/conferido/i);
    expect(texto.linhas.join(" ")).toMatch(/66 riscos/);
    expect(texto.linhas.join(" ")).toMatch(/22 setores/);
  });

  it("com setor órfão, NÃO diz sucesso", () => {
    /*
     * Esta é a regra que mais importa aqui. Dizer "sucesso" com 22
     * setores sem GES foi o que fez o técnico perder a confiança.
     */
    const texto = textoDaConferencia({
      riscos: 66, riscosSemGes: 0, riscosSemSetor: 66,
      setoresLigados: 0, setoresSemGes: 22, acoes: 0,
    });
    expect(texto.completo).toBe(false);
    expect(texto.titulo).not.toMatch(/sucesso/i);
    expect(texto.titulo).toMatch(/pend[êe]ncia/i);
    expect(texto.linhas.join(" ")).toMatch(/22 setores ficaram sem GES/);
  });

  it("inventário vazio é falha, não sucesso com zero", () => {
    /*
     * Foi o que aconteceria com a planilha de resíduos: o arquivo é lido,
     * nenhum risco é reconhecido, e a tela não pode comemorar.
     */
    const texto = textoDaConferencia({
      riscos: 0, riscosSemGes: 0, riscosSemSetor: 0,
      setoresLigados: 0, setoresSemGes: 22, acoes: 0,
    });
    expect(texto.completo).toBe(false);
    expect(texto.titulo).toMatch(/nenhum risco/i);
    expect(texto.linhas.join(" "), "não orientou o que conferir")
      .toMatch(/invent[áa]rio de riscos/i);
  });

  it("fala no singular quando é um só", () => {
    const texto = textoDaConferencia({
      riscos: 1, riscosSemGes: 0, riscosSemSetor: 0,
      setoresLigados: 1, setoresSemGes: 1, acoes: 1,
    });
    const tudo = texto.linhas.join(" ");
    expect(tudo).toMatch(/1 risco no invent/);
    expect(tudo).toMatch(/1 setor com GES/);
    expect(tudo).toMatch(/1 setor ficou sem GES/);
  });

  it("não cita plano de ação quando não houve nenhuma", () => {
    const texto = textoDaConferencia({
      riscos: 10, riscosSemGes: 0, riscosSemSetor: 0,
      setoresLigados: 2, setoresSemGes: 0, acoes: 0,
    });
    expect(texto.linhas.join(" ")).not.toMatch(/plano de ação/i);
  });
});
