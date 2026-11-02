import { describe, it, expect } from "vitest";
import {
  statusDaEntrega,
  impedimentoParaSalvar,
  registroDeEntrega,
  registroOffline,
  linhaDoCache,
  normalizarTipo,
  entregaAtivaParaSubstituir,
  descarteDaSubstituicao,
  type EntregaAtiva,
} from "./entregaRegistro";
import { lerAuditoriaDaDevolucao } from "./entregaDevolucao";

/**
 * Este é o caminho que o técnico usa todo dia. Ficava num handleSave de
 * 263 linhas e não tinha um único teste. O que está guardado aqui é o que
 * decide se o EPI entregue vai aparecer na ficha do colaborador, com que
 * quantidade e vindo de qual unidade.
 */

const FORM = {
  funcionario_id: "func-1",
  data: "2026-11-02",
  tipo: "Entrega",
  observacao: null as string | null,
  unidade_origem_id: "unid-1",
};

const ITEM = { epi: { id: "epi-visivel", nome: "Luva" }, quantidade: 2 };

describe("status de nascimento da entrega", () => {
  it("entrega e substituição nascem ativas", () => {
    expect(statusDaEntrega("entrega")).toBe("ativo");
    expect(statusDaEntrega("substituicao")).toBe("ativo");
  });

  it("perda e dano nascem já marcados", () => {
    /* EPI perdido não pode aparecer como em uso na ficha. */
    expect(statusDaEntrega("perda")).toBe("perdido");
    expect(statusDaEntrega("dano")).toBe("danificado");
  });

  it("tipo desconhecido nasce ativo, não vazio", () => {
    expect(statusDaEntrega("qualquer-coisa")).toBe("ativo");
    expect(statusDaEntrega("")).toBe("ativo");
  });
});

describe("o que impede de salvar", () => {
  it("formulário completo não tem impedimento", () => {
    expect(impedimentoParaSalvar({ form: FORM, itens: [ITEM], empresaId: "emp-1" }))
      .toBeNull();
  });

  it("sem colaborador, não salva", () => {
    const r = impedimentoParaSalvar({
      form: { ...FORM, funcionario_id: "" }, itens: [ITEM], empresaId: "emp-1",
    });
    expect(r?.titulo).toContain("funcionário");
  });

  it("sem nenhum EPI na lista, não salva", () => {
    const r = impedimentoParaSalvar({ form: FORM, itens: [], empresaId: "emp-1" });
    expect(r, "salvaria entrega sem EPI nenhum").not.toBeNull();
  });

  it("sem local de baixa, não salva", () => {
    /*
     * Sem a unidade de origem o EPI sai do estoque de lugar nenhum, e o
     * saldo da unidade para de bater com o que foi entregue.
     */
    const r = impedimentoParaSalvar({
      form: { ...FORM, unidade_origem_id: null }, itens: [ITEM], empresaId: "emp-1",
    });
    expect(r?.titulo).toContain("Local de Baixa");
  });

  it("sem empresa na sessão, não salva", () => {
    const r = impedimentoParaSalvar({ form: FORM, itens: [ITEM], empresaId: null });
    expect(r?.titulo).toContain("sessão");
  });
});

describe("o registro que vai para o banco", () => {
  it("leva o que o formulário tem", () => {
    const r = registroDeEntrega({
      form: FORM, item: ITEM, status: "ativo",
      empresaId: "emp-1", usuarioId: "user-1",
    });
    expect(r).toEqual({
      funcionario_id: "func-1",
      epi_id: "epi-visivel",
      quantidade: 2,
      data: "2026-11-02",
      tipo: "entrega",
      status: "ativo",
      observacao: null,
      empresa_id: "emp-1",
      created_by: "user-1",
      unidade_origem_id: "unid-1",
    });
  });

  it("EPI de contrato grava o id de origem, não o da cópia", () => {
    /*
     * A tela mostra uma cópia do EPI do contrato; o banco guarda o
     * original. Gravar o id da cópia quebra o saldo do contrato.
     */
    const r = registroDeEntrega({
      form: FORM,
      item: { epi: { id: "copia", nome: "Luva", source_epi_id: "original" }, quantidade: 1 },
      status: "ativo", empresaId: "emp-1",
    });
    expect(r.epi_id).toBe("original");
  });

  it("observação vazia vira null, não string vazia", () => {
    const r = registroDeEntrega({
      form: { ...FORM, observacao: "" }, item: ITEM,
      status: "ativo", empresaId: "emp-1",
    });
    expect(r.observacao).toBeNull();
  });
});

describe("quando não há internet", () => {
  it("a fila leva o id de origem do EPI", () => {
    const r = registroOffline({
      form: FORM,
      item: { epi: { id: "copia", nome: "Luva", source_epi_id: "original" }, quantidade: 1 },
      status: "ativo", empresaId: "emp-1", idProvisorio: "tmp-1",
    });
    expect(r.id).toBe("tmp-1");
    expect(r.epi_id).toBe("original");
  });

  it("a linha da TELA leva o id visível do EPI", () => {
    /*
     * Diferença de propósito, e a mais fácil de "arrumar" errado: a tela
     * acha o nome do EPI por este id. Trocando pelo de origem, o card
     * passa a dizer "EPI não localizado" até a sincronização acontecer.
     */
    const linha = linhaDoCache({
      form: FORM,
      item: { epi: { id: "copia", nome: "Luva", source_epi_id: "original" }, quantidade: 1 },
      status: "ativo", idProvisorio: "tmp-1",
    });
    expect(linha.epi_id).toBe("copia");
  });

  it("a linha da tela nasce sem assinatura", () => {
    /* Entrega sem assinatura é justamente o que a tela precisa cobrar. */
    const linha = linhaDoCache({
      form: FORM, item: ITEM, status: "ativo", idProvisorio: "tmp-1",
    });
    expect(linha.assinatura_colaborador).toBeNull();
    expect(linha.foto_reconhecimento).toBeNull();
  });
});

describe("tipo escrito de qualquer jeito", () => {
  it("entende acento, maiúscula e variação", () => {
    expect(normalizarTipo("Substituição")).toBe("substituicao");
    expect(normalizarTipo("SUBSTITUICAO")).toBe("substituicao");
    expect(normalizarTipo("Devolução")).toBe("devolucao");
    expect(normalizarTipo("Perda")).toBe("perda");
    expect(normalizarTipo("Dano")).toBe("dano");
  });

  it("vazio ou desconhecido é entrega", () => {
    expect(normalizarTipo(null)).toBe("entrega");
    expect(normalizarTipo("")).toBe("entrega");
    expect(normalizarTipo("outra coisa")).toBe("entrega");
  });
});

describe("achar a entrega que será substituída", () => {
  const historico: EntregaAtiva[] = [
    { id: "a", funcionario_id: "func-1", epi_id: "epi-1", tipo: "entrega", status: "ativo" },
    { id: "b", funcionario_id: "func-1", epi_id: "epi-1", tipo: "entrega", status: "substituido" },
    { id: "c", funcionario_id: "func-1", epi_id: "epi-1", tipo: "devolucao", status: "ativo" },
    { id: "d", funcionario_id: "func-2", epi_id: "epi-1", tipo: "entrega", status: "ativo" },
    { id: "e", funcionario_id: "func-1", epi_id: "epi-9", tipo: "entrega", status: "ativo" },
  ];

  it("pega a entrega ativa do mesmo colaborador e do mesmo EPI", () => {
    expect(entregaAtivaParaSubstituir(historico, "func-1", "epi-1")?.id).toBe("a");
  });

  it("não pega devolução", () => {
    /*
     * Devolução já está encerrada. Marcá-la como substituída apagaria o
     * registro de que o EPI tinha voltado.
     */
    const semAtiva = historico.filter((e) => e.id !== "a");
    expect(entregaAtivaParaSubstituir(semAtiva, "func-1", "epi-1")).toBeNull();
  });

  it("não pega de outro colaborador nem de outro EPI", () => {
    expect(entregaAtivaParaSubstituir(historico, "func-3", "epi-1")).toBeNull();
    expect(entregaAtivaParaSubstituir(historico, "func-1", "epi-inexistente")).toBeNull();
  });
});

describe("descarte automático por substituição", () => {
  const antiga: EntregaAtiva = {
    id: "11111111-1111-4111-8111-111111111111",
    funcionario_id: "func-1",
    epi_id: "epi-1",
    tipo: "entrega",
    status: "ativo",
    empresa_id: "emp-1",
  };

  it("o EPI antigo NÃO volta ao estoque", () => {
    /* Foi substituído porque acabou, rasgou ou venceu. */
    const plano = descarteDaSubstituicao({ entregaAntiga: antiga, data: "2026-11-02" });
    expect(plano.registro.quantidade).toBe(0);
    expect(plano.registro.observacao).toContain("[DESCARTE/AVARIA");
  });

  it("o antigo fica 'substituido', não 'devolvido'", () => {
    /*
     * O colaborador não devolveu nada, ele trocou. É essa diferença que
     * a ficha mostra para a fiscalização.
     */
    const plano = descarteDaSubstituicao({ entregaAntiga: antiga, data: "2026-11-02" });
    expect(plano.statusDaEntregaAntiga).toBe("substituido");
    expect(plano.registro.status).toBe("devolvido");
  });

  it("grava a mesma trilha que o estorno sabe ler", () => {
    /*
     * O descarte automático e o manual gravam no mesmo formato de
     * propósito: é um leitor só (lerAuditoriaDaDevolucao) para os dois.
     */
    const plano = descarteDaSubstituicao({
      entregaAntiga: antiga, data: "2026-11-02", operador: "tecnico@empresa.com",
    });
    const auditoria = lerAuditoriaDaDevolucao(plano.registro.observacao);
    expect(auditoria.entregaDeOrigemId).toBe(antiga.id);
    expect(auditoria.statusAnterior).toBe("ativo");
    expect(auditoria.processadoPor).toBe("tecnico@empresa.com");
  });

  it("o estado do item antigo entra quando o técnico escreve", () => {
    const plano = descarteDaSubstituicao({
      entregaAntiga: antiga, data: "2026-11-02", descricaoDoEstado: "  Rasgado no punho  ",
    });
    expect(plano.registro.observacao).toContain("Estado: Rasgado no punho");
  });

  it("estado em branco não deixa separador solto", () => {
    const plano = descarteDaSubstituicao({
      entregaAntiga: antiga, data: "2026-11-02", descricaoDoEstado: "   ",
    });
    expect(plano.registro.observacao.endsWith("•")).toBe(false);
    expect(plano.registro.observacao).not.toContain("• •");
  });

  it("sem empresa na entrega antiga, usa a empresa ativa", () => {
    const plano = descarteDaSubstituicao({
      entregaAntiga: { ...antiga, empresa_id: null },
      data: "2026-11-02", empresaId: "emp-ativa",
    });
    expect(plano.registro.empresa_id).toBe("emp-ativa");
  });
});
