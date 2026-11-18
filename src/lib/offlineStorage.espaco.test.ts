import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  setCacheUserScope, setCachedData, getCachedData, addToSyncQueue, getSyncQueue, clearSyncQueue,
} from "./offlineStorage";
import { MARCA_IMAGEM_NO_SERVIDOR } from "./cacheOfflineLeve";

/**
 * O cenário medido no banco em 18/11/2026, na maior empresa: 109 entregas
 * já assinadas, ~43 KB cada por causa da imagem da assinatura. O técnico
 * vai para a obra sem sinal e registra entregas novas, cada uma com a sua
 * assinatura de ~40 KB.
 *
 * O ambiente de teste (jsdom) limita o localStorage a 5 milhões de
 * caracteres — o mesmo tamanho medido no Chromium (5,2 milhões).
 */
const ASSINATURA = "data:image/png;base64," + "A".repeat(40_000);

const entregaAssinada = (i: number) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  funcionario_id: "f1", epi_id: "e1", quantidade: 1, data: "2026-11-09",
  tipo: "entrega", status: "ativo", codigo_verificacao: "0".repeat(40),
  assinatura_colaborador: ASSINATURA,
});

describe("espaço do modo offline", () => {
  beforeEach(() => {
    localStorage.clear();
    setCacheUserScope(null);
    setCacheUserScope("tecnico-1");
    clearSyncQueue();
  });

  it("o limite deste ambiente é o do navegador de verdade", () => {
    /* Sem isto o teste abaixo passaria por ter espaço infinito. */
    expect(() => localStorage.setItem("teste", "x".repeat(5_300_000))).toThrow();
    localStorage.removeItem("teste");
  });

  it("com 109 entregas no aparelho, ainda dá para registrar 30 entregas offline com assinatura", () => {
    setCachedData("entregas", Array.from({ length: 109 }, (_, i) => entregaAssinada(i)));
    expect(getCachedData("entregas"), "a cópia das entregas não coube").toHaveLength(109);

    const guardadas = Array.from({ length: 30 }, (_, i) =>
      addToSyncQueue({
        table: "entregas",
        type: "insert",
        payload: { ...entregaAssinada(1000 + i), assinatura_colaborador: ASSINATURA },
      }),
    );
    expect(guardadas.filter(Boolean).length, "entregas offline recusadas por falta de espaço").toBe(30);
    expect(getSyncQueue()).toHaveLength(30);
  });

  it("a fila guarda a assinatura INTEIRA — só a cópia de consulta é que fica leve", () => {
    /* A fila é o que sobe para o servidor: se ela perdesse a imagem, a
       assinatura colhida offline nunca chegaria ao banco. */
    addToSyncQueue({ table: "entregas", type: "insert", payload: entregaAssinada(1) });
    expect(getSyncQueue()[0].payload.assinatura_colaborador).toBe(ASSINATURA);
  });

  it("a cópia de consulta guarda a marca, e a entrega segue aparecendo assinada", () => {
    setCachedData("entregas", [entregaAssinada(1)]);
    const [linha] = getCachedData<{ assinatura_colaborador: string }>("entregas")!;
    expect(linha.assinatura_colaborador).toBe(MARCA_IMAGEM_NO_SERVIDOR);
  });
});
