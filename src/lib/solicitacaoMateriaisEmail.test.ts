import { describe, it, expect, vi } from "vitest";

/* O módulo importa o cliente do banco e o gerador de PDF; nenhum é usado aqui. */
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/solicitacaoMateriaisPdfData", () => ({ carregarDadosPdfSolicitacao: vi.fn() }));
vi.mock("@/lib/solicitacaoMateriaisPdf", () => ({ gerarSolicitacaoPdfBase64: vi.fn() }));

import { separarEmails, destinatariosDoEnvio } from "./solicitacaoMateriaisEmail";

const PADRAO = ["compras@empresa.com", "seguranca@empresa.com"];

describe("para quem a solicitação vai", () => {
  it("a lista escolhida na solicitação manda", () => {
    /* Pedido de ferramenta: compras e manutenção, não segurança. */
    expect(destinatariosDoEnvio("compras@empresa.com, manutencao@empresa.com", PADRAO))
      .toEqual(["compras@empresa.com", "manutencao@empresa.com"]);
  });

  it("sem escolha, vale o padrão da empresa", () => {
    expect(destinatariosDoEnvio(null, PADRAO)).toEqual(PADRAO);
    expect(destinatariosDoEnvio("", PADRAO)).toEqual(PADRAO);
    expect(destinatariosDoEnvio("   ", PADRAO)).toEqual(PADRAO);
  });

  it("endereço inválido da solicitação não é enviado", () => {
    expect(destinatariosDoEnvio("gerente@empresa.com, joao", PADRAO)).toEqual(["gerente@empresa.com"]);
  });

  it("só inválido na solicitação cai no padrão, em vez de mandar para ninguém", () => {
    expect(destinatariosDoEnvio("joao, maria", PADRAO)).toEqual(PADRAO);
  });

  it("uma pessoa só na solicitação é só ela — o padrão não entra junto", () => {
    expect(destinatariosDoEnvio("gerente@empresa.com", PADRAO)).toEqual(["gerente@empresa.com"]);
  });
});

describe("ler a lista", () => {
  it("aceita vírgula, ponto e vírgula e uma por linha", () => {
    expect(separarEmails("a@x.com, b@x.com;c@x.com\nd@x.com").validos)
      .toEqual(["a@x.com", "b@x.com", "c@x.com", "d@x.com"]);
  });

  it("repetido sai uma vez, sem diferenciar maiúsculas", () => {
    expect(separarEmails("Compras@x.com, compras@x.com").validos).toEqual(["Compras@x.com"]);
  });

  it("separa os inválidos para a tela avisar", () => {
    expect(separarEmails("a@x.com, sem-arroba").invalidos).toEqual(["sem-arroba"]);
  });
});
