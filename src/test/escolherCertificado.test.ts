import { describe, expect, it } from "vitest";
import {
  escolherFolha,
  nomeDistinto,
  titularDe,
  type CertificadoLike,
} from "../../supabase/functions/assinar-pdf/escolherCertificado";

function cert(subjectCn: string, issuerCn: string, notAfter: string): CertificadoLike {
  return {
    subject: { attributes: [{ shortName: "CN", value: subjectCn }] },
    issuer: { attributes: [{ shortName: "CN", value: issuerCn }] },
    validity: { notAfter: new Date(notAfter) },
  };
}

describe("escolherFolha", () => {
  it("acha o titular no meio da cadeia da ICP-Brasil", () => {
    // A ordem imita um .pfx de verdade, em que a folha não vem primeiro.
    const raiz = cert("Autoridade Certificadora Raiz Brasileira v5", "Autoridade Certificadora Raiz Brasileira v5", "2029-03-02");
    const intermediaria = cert("AC SOLUTI Multipla v5", "Autoridade Certificadora Raiz Brasileira v5", "2029-03-02");
    const titular = cert("LEAN TECNOLOGIA E ENGENHARIA LTDA:18962840000109", "AC SOLUTI Multipla v5", "2026-09-22");

    const folha = escolherFolha([raiz, intermediaria, titular]);

    expect(titularDe(folha)).toBe("LEAN TECNOLOGIA E ENGENHARIA LTDA:18962840000109");
    // O ponto todo: pegar o primeiro da lista traria 2029, a validade da AC,
    // e o aviso de renovação nunca dispararia.
    expect(folha?.validity.notAfter.getUTCFullYear()).toBe(2026);
  });

  it("devolve o próprio certificado quando o .pfx é auto-assinado", () => {
    const sozinho = cert("3M CURSOS E TREINAMENTOS:51489453000164", "3M CURSOS E TREINAMENTOS:51489453000164", "2029-09-07");
    expect(titularDe(escolherFolha([sozinho]))).toBe("3M CURSOS E TREINAMENTOS:51489453000164");
  });

  it("devolve null quando não há certificado nenhum", () => {
    expect(escolherFolha([])).toBeNull();
  });

  it("prefere não responder a responder errado numa cadeia circular", () => {
    // Devolver um dos dois mostraria uma validade que não é a do titular, e
    // um "está tudo em dia" falso é pior do que ficar sem aviso.
    const a = cert("A", "B", "2027-01-01");
    const b = cert("B", "A", "2028-01-01");
    expect(escolherFolha([a, b])).toBeNull();
  });

  it("acha o auto-assinado pela regra, não por sorte de ordenação", () => {
    // Um auto-assinado é emissor de si mesmo. Sem ignorar o próprio
    // certificado na comparação, ele seria descartado como se fosse uma AC.
    const sozinho = cert("3M:51489453000164", "3M:51489453000164", "2029-09-07");
    expect(escolherFolha([sozinho])).toBe(sozinho);
  });
});

describe("titularDe", () => {
  it("prefere o CN, mesmo com outros atributos no DN", () => {
    const c: CertificadoLike = {
      subject: {
        attributes: [
          { shortName: "C", value: "BR" },
          { shortName: "O", value: "ICP-Brasil" },
          { shortName: "CN", value: "EMPRESA X:11222333000181" },
        ],
      },
      issuer: { attributes: [] },
      validity: { notAfter: new Date("2027-01-01") },
    };
    expect(titularDe(c)).toBe("EMPRESA X:11222333000181");
  });

  it("cai no DN inteiro quando não existe CN", () => {
    const c: CertificadoLike = {
      subject: { attributes: [{ shortName: "O", value: "SEM NOME COMUM" }] },
      issuer: { attributes: [] },
      validity: { notAfter: new Date("2027-01-01") },
    };
    expect(titularDe(c)).toBe("O=SEM NOME COMUM");
  });

  it("não estoura com certificado ausente", () => {
    expect(titularDe(null)).toBe("");
  });
});

describe("nomeDistinto", () => {
  it("monta o DN na ordem dos atributos", () => {
    expect(nomeDistinto({ attributes: [{ shortName: "C", value: "BR" }, { shortName: "CN", value: "X" }] }))
      .toBe("C=BR,CN=X");
  });

  it("devolve vazio para DN sem atributos", () => {
    expect(nomeDistinto({ attributes: [] })).toBe("");
    expect(nomeDistinto(null)).toBe("");
  });
});
