import { CLASSE_LABEL, PgrClasse, classificarRisco, necessitaAcao } from "@/lib/pgrMatriz";

/**
 * Regras de pendência do PGR, em um lugar só.
 *
 * O painel de alertas, o checklist de emissão e o apêndice do PDF precisam
 * responder à MESMA pergunta ("o que está errado neste PGR?"). Quando cada tela
 * implementa a própria contagem, elas divergem — o checklist libera a emissão de
 * um documento que o painel acusa como pendente. Aqui a resposta é uma só.
 *
 * `bloqueia: true` = impede emitir. `false` = alerta que o técnico decide.
 */

export type SeveridadePendencia = "bloqueio" | "alerta";

export interface Pendencia {
  id: string;
  categoria: string;
  titulo: string;
  /** O item concreto (nome do risco, descrição da ação). */
  referencia: string | null;
  severidade: SeveridadePendencia;
  /** Etapa do assistente onde se resolve. */
  etapa: string;
}

export interface EntradaPendencias {
  inventario: any[];
  acoes: any[];
  responsaveis: any[];
  levantamento?: any[];
  /** Linhas de pgr_acao_eficacia — a verificação NÃO fica na própria ação. */
  eficacias?: any[];
  respTecNome?: string | null;
  /** Dias de antecedência para avisar de prazo. */
  diasAviso?: number;
}

const hoje = () => new Date().toISOString().slice(0, 10);

const emDias = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

const rotulo = (v: any, alt = "sem descrição") =>
  (typeof v === "string" && v.trim()) || alt;

export function calcularPendencias(e: EntradaPendencias): Pendencia[] {
  const p: Pendencia[] = [];
  const hj = hoje();
  const limite = emDias(e.diasAviso ?? 30);
  const acoes = e.acoes || [];
  const inventario = e.inventario || [];

  const add = (
    id: string, categoria: string, titulo: string,
    referencia: string | null, severidade: SeveridadePendencia, etapa: string,
  ) => p.push({ id, categoria, titulo, referencia, severidade, etapa });

  // ── RISCOS ────────────────────────────────────────────────────────────────
  const acoesPorItem = new Set(
    acoes.map((a) => a.inventario_item_id).filter(Boolean),
  );

  inventario.forEach((i) => {
    const nome = rotulo(i.perigo_descricao);
    const classe = i.classificacao || classificarRisco(i.severidade, i.probabilidade);

    if (!classe) {
      add(`sem-aval-${i.id}`, "Risco", "Risco sem avaliação de severidade e probabilidade",
        nome, "bloqueio", "inventario");
      return;
    }
    // Moderado para cima exige plano — é o mesmo corte de necessita_acao no banco.
    // O rótulo vem de CLASSE_LABEL: interpolar a chave do enum imprimia
    // "intoleravel", sem acento, dentro de um texto voltado ao usuário.
    if (necessitaAcao(classe) && !acoesPorItem.has(i.id)) {
      add(`sem-plano-${i.id}`, "Risco",
        `Risco ${CLASSE_LABEL[classe as PgrClasse] || classe} sem plano de ação`,
        nome, "bloqueio", "acoes");
    }
    if (!rotulo(i.fonte_geradora, "") && !rotulo(i.circunstancia, "") && !rotulo(i.perigo_descricao, "")) {
      add(`sem-fonte-${i.id}`, "Risco", "Risco sem fonte de exposição descrita",
        nome, "alerta", "perigos");
    }
    if (!rotulo(i.lesoes, "")) {
      add(`sem-lesao-${i.id}`, "Risco", "Risco sem possível lesão ou agravo descrito",
        nome, "alerta", "perigos");
    }
    if (!i.trabalhadores_expostos && !i.ghe_id && !i.setor_id) {
      add(`sem-expostos-${i.id}`, "Risco", "Risco sem identificação dos expostos (vincule a um setor ou GES)",
        nome, "alerta", "perigos");
    }
    // Risco residual é do ITEM (severidade_residual/probabilidade_residual), não
    // da ação: é o que sobra depois de todas as medidas, não de uma delas.
    if (necessitaAcao(classe) && i.severidade_residual == null) {
      add(`sem-residual-${i.id}`, "Risco", "Risco relevante sem avaliação do risco residual",
        nome, "alerta", "inventario");
    }
  });

  // ── AÇÕES ─────────────────────────────────────────────────────────────────
  acoes.forEach((a) => {
    const nome = rotulo(a.descricao);
    const encerrada = a.status === "concluida" || a.status === "cancelada";

    if (!a.responsavel_nome && !a.responsavel_id) {
      add(`acao-sem-resp-${a.id}`, "Ação", "Ação sem responsável", nome, "bloqueio", "acoes");
    }
    if (!a.prazo) {
      add(`acao-sem-prazo-${a.id}`, "Ação", "Ação sem prazo", nome, "bloqueio", "acoes");
    } else if (!encerrada) {
      if (a.prazo < hj) {
        add(`acao-vencida-${a.id}`, "Ação", `Ação vencida em ${a.prazo.split("-").reverse().join("/")}`,
          nome, "bloqueio", "acoes");
      } else if (a.prazo <= limite) {
        add(`acao-vencendo-${a.id}`, "Ação",
          `Ação vence em ${a.prazo.split("-").reverse().join("/")}`, nome, "alerta", "acoes");
      }
    }

    if (a.status === "concluida") {
      if (!a.evidencia_url) {
        add(`acao-sem-evid-${a.id}`, "Ação", "Ação concluída sem evidência de execução",
          nome, "bloqueio", "acoes");
      }
      // Concluir a ação não encerra o risco: sem verificação de eficácia não se
      // sabe se a medida funcionou. A verificação vive em pgr_acao_eficacia.
      const verificada = (e.eficacias || []).some(
        (v) => v.acao_id === a.id && (v.data_verificacao || v.resultado));
      if (!verificada) {
        add(`acao-sem-efic-${a.id}`, "Ação", "Ação concluída sem verificação de eficácia",
          nome, "alerta", "acoes");
      }
    }
  });

  // ── LEVANTAMENTO ──────────────────────────────────────────────────────────
  // A verificação de "Perigo levantado aguardando avaliação" foi desativada, pois a tela 
  // e o fluxo de levantamento em campo não são mais usados pela configuração ativa.

  // ── DOCUMENTO ─────────────────────────────────────────────────────────────
  if ((e.responsaveis || []).length === 0 && !(e.respTecNome || "").trim()) {
    add("sem-responsavel", "Documento", "Nenhum responsável técnico cadastrado",
      null, "bloqueio", "emissao");
  }
  if (inventario.length === 0) {
    add("inventario-vazio", "Documento", "Inventário de riscos vazio",
      null, "bloqueio", "inventario");
  }

  return p;
}

export interface ResumoPendencias {
  total: number;
  bloqueios: number;
  alertas: number;
  porCategoria: Record<string, number>;
  podeEmitir: boolean;
}

export function resumirPendencias(p: Pendencia[]): ResumoPendencias {
  const bloqueios = p.filter((x) => x.severidade === "bloqueio").length;
  const porCategoria: Record<string, number> = {};
  p.forEach((x) => { porCategoria[x.categoria] = (porCategoria[x.categoria] || 0) + 1; });
  return {
    total: p.length,
    bloqueios,
    alertas: p.length - bloqueios,
    porCategoria,
    podeEmitir: bloqueios === 0,
  };
}
