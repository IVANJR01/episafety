import { describe, it, expect } from "vitest";
import {
  planejarDevolucao,
  planejarEstorno,
  localizarEntregaDeOrigem,
  lerAuditoriaDaDevolucao,
  acrescentarObservacao,
  type EntregaNoHistorico,
} from "./entregaDevolucao";

/**
 * Estas regras ficavam dentro dos botões da tela Entregas.tsx e só podiam
 * ser conferidas clicando. São elas que decidem quanto EPI volta para o
 * estoque e em que estado a entrega fica depois de um erro desfeito — ou
 * seja, mexem no patrimônio da empresa e na ficha que vai para a
 * fiscalização. Agora dá para conferir sem abrir navegador.
 */

const ENTREGA = {
  id: "1a61bc1e-7ea4-4d78-a8cd-5a0f2b3c4d5e",
  funcionario_id: "func-1",
  epi_id: "epi-1",
  quantidade: 3,
  data: "2026-10-01",
  status: "ativo",
  observacao: null,
  empresa_id: "emp-1",
};

describe("devolver EPI", () => {
  it("devolução ao estoque repõe a quantidade entregue", () => {
    const plano = planejarDevolucao({
      entrega: ENTREGA,
      destino: "estoque",
      hoje: "2026-11-02",
    });
    expect(plano.registro.quantidade).toBe(3);
    expect(plano.registro.tipo).toBe("devolucao");
    expect(plano.registro.status).toBe("devolvido");
    expect(plano.registro.data).toBe("2026-11-02");
    expect(plano.statusDaEntregaOriginal).toBe("devolvido");
  });

  it("descarte NÃO repõe peça nenhuma", () => {
    /*
     * A regra que mais custa quando sai errada: EPI avariado que voltasse com a
     * quantidade cheia inflaria o estoque com peça que não existe mais.
     */
    const plano = planejarDevolucao({
      entrega: ENTREGA,
      destino: "descarte",
      hoje: "2026-11-02",
    });
    expect(plano.registro.quantidade).toBe(0);
    expect(plano.registro.observacao).toContain("[DESCARTE/AVARIA");
  });

  it("a devolução grava de onde veio e em que estado estava", () => {
    /* Sem esta trilha, o estorno não tem como achar a entrega original. */
    const plano = planejarDevolucao({
      entrega: { ...ENTREGA, status: "substituido" },
      destino: "estoque",
      operador: "tecnico@empresa.com",
    });
    expect(plano.registro.observacao).toContain(`Entrega origem: ${ENTREGA.id}`);
    expect(plano.registro.observacao).toContain("Status anterior: substituido");
    expect(plano.registro.observacao).toContain("Processado por: tecnico@empresa.com");
  });

  it("entrega sem status registrado conta como ativa", () => {
    const plano = planejarDevolucao({
      entrega: { ...ENTREGA, status: null },
      destino: "estoque",
    });
    expect(plano.registro.observacao).toContain("Status anterior: ativo");
  });

  it("observação em branco não deixa separador solto", () => {
    const plano = planejarDevolucao({
      entrega: ENTREGA,
      destino: "estoque",
      observacao: "   ",
    });
    expect(plano.registro.observacao.endsWith("•")).toBe(false);
    expect(plano.registro.observacao).not.toContain("• •");
  });

  it("o que o técnico escreveu entra na observação", () => {
    const plano = planejarDevolucao({
      entrega: ENTREGA,
      destino: "estoque",
      observacao: "Colaborador trocou de setor",
    });
    expect(plano.registro.observacao).toContain("Colaborador trocou de setor");
  });

  it("sem empresa na entrega, usa a empresa ativa", () => {
    const plano = planejarDevolucao({
      entrega: { ...ENTREGA, empresa_id: null },
      destino: "estoque",
      empresaId: "emp-ativa",
    });
    expect(plano.registro.empresa_id).toBe("emp-ativa");
  });
});

describe("ler a trilha da devolução", () => {
  const obs =
    `Devolução ref. entrega de 2026-10-01 • Entrega origem: ${ENTREGA.id} • ` +
    "Status anterior: substituido • Processado por: tecnico@empresa.com • Observação livre";

  it("lê id de origem, status anterior e operador", () => {
    const auditoria = lerAuditoriaDaDevolucao(obs);
    expect(auditoria.entregaDeOrigemId).toBe(ENTREGA.id);
    expect(auditoria.statusAnterior).toBe("substituido");
    expect(auditoria.processadoPor).toBe("tecnico@empresa.com");
  });

  it("observação vazia não inventa trilha", () => {
    expect(lerAuditoriaDaDevolucao(null)).toEqual({
      entregaDeOrigemId: null,
      statusAnterior: null,
      processadoPor: null,
    });
  });

  it("o que a devolução grava é o que a leitura devolve", () => {
    /* Ida e volta: se um lado mudar de formato sem o outro, quebra aqui. */
    const plano = planejarDevolucao({
      entrega: { ...ENTREGA, status: "danificado" },
      destino: "estoque",
      operador: "fulano@empresa.com",
    });
    const auditoria = lerAuditoriaDaDevolucao(plano.registro.observacao);
    expect(auditoria.entregaDeOrigemId).toBe(ENTREGA.id);
    expect(auditoria.statusAnterior).toBe("danificado");
    expect(auditoria.processadoPor).toBe("fulano@empresa.com");
  });
});

describe("achar a entrega que a devolução desfez", () => {
  const base = { funcionario_id: "func-1", epi_id: "epi-1", status: "ativo" };
  const historico: EntregaNoHistorico[] = [
    { ...base, id: "e-antiga", tipo: "entrega", created_at: "2026-09-01T10:00:00Z" },
    { ...base, id: "e-nova", tipo: "entrega", created_at: "2026-10-01T10:00:00Z" },
    { ...base, id: "e-futura", tipo: "entrega", created_at: "2026-12-01T10:00:00Z" },
    { ...base, id: "d-outra", tipo: "devolucao", created_at: "2026-10-02T10:00:00Z" },
    {
      funcionario_id: "func-2", epi_id: "epi-1", status: "ativo",
      id: "e-outro-func", tipo: "entrega", created_at: "2026-10-01T11:00:00Z",
    },
  ];

  it("usa o id gravado na trilha quando ele existe", () => {
    const { entregaDeOrigem } = localizarEntregaDeOrigem(
      {
        ...base, id: "dev-1", tipo: "devolucao",
        created_at: "2026-11-02T10:00:00Z",
        observacao: "Entrega origem: 00000000-0000-4000-8000-000000000001",
      },
      [
        ...historico,
        {
          ...base, id: "00000000-0000-4000-8000-000000000001",
          tipo: "entrega", created_at: "2026-01-01T10:00:00Z",
        },
      ],
    );
    expect(entregaDeOrigem?.id).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("devolução antiga, sem trilha, pega a última entrega antes dela", () => {
    const { entregaDeOrigem } = localizarEntregaDeOrigem(
      {
        ...base, id: "dev-1", tipo: "devolucao",
        created_at: "2026-11-02T10:00:00Z", observacao: null,
      },
      historico,
    );
    expect(entregaDeOrigem?.id, "pegou entrega posterior à devolução")
      .toBe("e-nova");
  });

  it("nunca pega entrega de outro colaborador nem de outro EPI", () => {
    const { entregaDeOrigem } = localizarEntregaDeOrigem(
      {
        funcionario_id: "func-9", epi_id: "epi-9", status: "ativo",
        id: "dev-1", tipo: "devolucao",
        created_at: "2026-11-02T10:00:00Z", observacao: null,
      },
      historico,
    );
    expect(entregaDeOrigem, "estornaria a entrega de outra pessoa").toBeNull();
  });

  it("id na trilha que não existe mais cai no palpite", () => {
    const { entregaDeOrigem } = localizarEntregaDeOrigem(
      {
        ...base, id: "dev-1", tipo: "devolucao",
        created_at: "2026-11-02T10:00:00Z",
        observacao: "Entrega origem: 11111111-1111-4111-8111-111111111111",
      },
      historico,
    );
    expect(entregaDeOrigem?.id).toBe("e-nova");
  });
});

describe("desfazer a devolução", () => {
  const devolucao = { id: "dev-1", data: "2026-11-01", quantidade: 3 };
  const auditoria = {
    entregaDeOrigemId: ENTREGA.id,
    statusAnterior: "substituido",
    processadoPor: "tecnico@empresa.com",
  };

  it("devolve a entrega ao estado que ela tinha antes", () => {
    const plano = planejarEstorno({
      devolucao,
      entregaDeOrigem: { observacao: "Entrega inicial" },
      auditoria,
      temContrato: false,
      estoqueAtual: 10,
      dataDoEstorno: "02/11/2026",
    });
    expect(plano.statusRestaurado).toBe("substituido");
  });

  it("sem status anterior na trilha, volta como ativa", () => {
    const plano = planejarEstorno({
      devolucao,
      entregaDeOrigem: { observacao: null },
      auditoria: { ...auditoria, statusAnterior: null },
      temContrato: false,
      estoqueAtual: 10,
    });
    expect(plano.statusRestaurado).toBe("ativo");
  });

  it("tira do estoque o que a devolução tinha reposto", () => {
    const plano = planejarEstorno({
      devolucao,
      entregaDeOrigem: { observacao: null },
      auditoria,
      temContrato: false,
      estoqueAtual: 10,
    });
    expect(plano.novoEstoqueDaUnidade).toBe(7);
  });

  it("estoque nunca fica negativo", () => {
    /* Estoque negativo é número que o técnico não explica na fiscalização. */
    const plano = planejarEstorno({
      devolucao: { ...devolucao, quantidade: 50 },
      entregaDeOrigem: { observacao: null },
      auditoria,
      temContrato: false,
      estoqueAtual: 2,
    });
    expect(plano.novoEstoqueDaUnidade).toBe(0);
  });

  it("EPI de contrato não mexe no estoque da unidade", () => {
    const plano = planejarEstorno({
      devolucao,
      entregaDeOrigem: { observacao: null },
      auditoria,
      temContrato: true,
      estoqueAtual: 10,
    });
    expect(plano.novoEstoqueDaUnidade, "descontou duas vezes o mesmo EPI")
      .toBeNull();
  });

  it("estorno de descarte não mexe no estoque", () => {
    /*
     * Descarte entrou com quantidade zero: nunca somou nada ao estoque,
     * então desfazer não pode subtrair.
     */
    const plano = planejarEstorno({
      devolucao: { ...devolucao, quantidade: 0 },
      entregaDeOrigem: { observacao: null },
      auditoria,
      temContrato: false,
      estoqueAtual: 10,
    });
    expect(plano.novoEstoqueDaUnidade).toBeNull();
  });

  it("a nota de auditoria diz quem devolveu e quem desfez", () => {
    const plano = planejarEstorno({
      devolucao,
      entregaDeOrigem: { observacao: "Entrega inicial" },
      auditoria,
      operador: "chefe@empresa.com",
      temContrato: false,
      estoqueAtual: 10,
      dataDoEstorno: "02/11/2026",
    });
    expect(plano.observacaoDaOrigem).toContain("Entrega inicial");
    expect(plano.observacaoDaOrigem).toContain("em 02/11/2026 por chefe@empresa.com");
    expect(plano.observacaoDaOrigem).toContain("processada por tecnico@empresa.com");
  });

  it("devolução sem operador identificado diz isso, em vez de mentir", () => {
    const plano = planejarEstorno({
      devolucao,
      entregaDeOrigem: { observacao: null },
      auditoria: { ...auditoria, processadoPor: null },
      temContrato: false,
      estoqueAtual: 10,
    });
    expect(plano.observacaoDaOrigem).toContain("sem operador identificado");
  });
});

describe("acrescentar observação", () => {
  it("junta as duas com separador", () => {
    expect(acrescentarObservacao("Primeira", "Segunda")).toBe("Primeira • Segunda");
  });

  it("não deixa separador sobrando quando um lado está vazio", () => {
    expect(acrescentarObservacao(null, "Só a nova")).toBe("Só a nova");
    expect(acrescentarObservacao("   ", "Só a nova")).toBe("Só a nova");
  });
});
