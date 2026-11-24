import { describe, it, expect } from "vitest";
import { situacaoDoBackup, type Execucao } from "./situacaoDoBackup";

const AGORA = new Date("2026-11-24T12:00:00Z");
const ex = (p: Partial<Execucao>): Execucao => ({
  iniciado_em: "2026-11-24T06:00:00Z", terminado_em: "2026-11-24T06:01:00Z", modo: "completo", status: "ok", ...p,
});

describe("situação do backup", () => {
  it("nunca rodou", () => {
    expect(situacaoDoBackup([], AGORA).nivel).toBe("problema");
  });
  it("rodou hoje e deu certo", () => {
    expect(situacaoDoBackup([ex({})], AGORA).nivel).toBe("ok");
  });
  it("passou de 2 dias sem backup bom: acusa, mesmo com o de arquivos rodando", () => {
    const r = situacaoDoBackup([
      ex({ iniciado_em: "2026-11-21T06:00:00Z", terminado_em: "2026-11-21T06:01:00Z" }),
      ex({ modo: "arquivos", iniciado_em: "2026-11-24T10:30:00Z" }),
    ], AGORA);
    expect(r.nivel).toBe("problema");
    expect(r.texto).toMatch(/atrasado/);
  });
  it("o último falhou mas o anterior está guardado", () => {
    const r = situacaoDoBackup([
      ex({ iniciado_em: "2026-11-23T06:00:00Z", terminado_em: "2026-11-23T06:01:00Z" }),
      ex({ status: "erro" }),
    ], AGORA);
    expect(r.nivel).toBe("atencao");
  });
  it("parcial avisa", () => {
    expect(situacaoDoBackup([ex({ status: "parcial" })], AGORA).nivel).toBe("atencao");
  });
  it("só erros: problema", () => {
    expect(situacaoDoBackup([ex({ status: "erro" })], AGORA).nivel).toBe("problema");
  });
});
