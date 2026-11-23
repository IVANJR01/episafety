// Granular permissions system
// Permissions are stored as strings in modulos_permitidos:
// - "module:action" format (e.g., "epis:view", "epis:edit", "epis:delete")
// - Legacy bare key "epis" = full access (view+edit+delete) for backward compat

export const ACOES = [
  { key: "view", label: "Visualizar" },
  { key: "create", label: "Criar / Adicionar" },
  { key: "edit", label: "Editar" },
  { key: "delete", label: "Excluir" },
] as const;

/**
 * Permissões específicas: desligadas por padrão, precisam ser dadas.
 *
 * Só ficam aqui as que o sistema CONFERE de verdade. PGR, LTCAT, PPP e
 * Portal RH tinham cinco caixinhas cada ("Editar PGR", "Assinar PGR"...)
 * que nenhuma tela lia: quem liberava eram as colunas Visualizar/Criar/
 * Editar/Excluir. Marcar "Editar PGR" não deixava editar. Saíram — e quem
 * tinha essas chaves gravadas é convertido por `normalizarPermissoes`.
 */
export const ACOES_ESPECIAIS: Record<string, { key: string; label: string }[]> = {
  epis: [{ key: "gestao_estoque", label: "Gestão de estoque de todas as unidades" }],
  esocial: [
    { key: "s2240:visualizar", label: "S-2240 — ver eventos e mapeamentos" },
    { key: "s2240:preparar", label: "S-2240 — preparar evento / editar mapeamento" },
    { key: "s2240:validar", label: "S-2240 — validar" },
    { key: "s2240:retificar", label: "S-2240 — abrir retificação" },
    { key: "s2240:excluir", label: "S-2240 — excluir" },
  ],
};

/**
 * Converte as chaves antigas das caixinhas que saíram para as colunas.
 *
 * "pgr:visualizar" → Visualizar. "pgr:editar" → Criar e Editar (era o que
 * o administrador quis dar). Revisar/assinar/exportar só davam acesso de
 * leitura na prática, e continuam dando: viram Visualizar. Nada passa a
 * valer mais do que a pessoa marcou.
 */
const CHAVES_ANTIGAS: Record<string, string[]> = {
  visualizar: ["view"], editar: ["create", "edit"], revisar: ["view"], assinar: ["view"], exportar: ["view"],
};
export function normalizarPermissoes(perms: string[]): string[] {
  const out = new Set<string>();
  for (const p of perms) {
    const [mod, ...resto] = p.split(":");
    const acao = resto.join(":");
    if (["pgr", "ltcat", "ppp"].includes(mod) && CHAVES_ANTIGAS[acao]) {
      CHAVES_ANTIGAS[acao].forEach((a) => out.add(`${mod}:${a}`));
    } else if (mod === "portal_rh" && acao && !["view", "create", "edit", "delete"].includes(acao) && !acao.startsWith("sem:")) {
      out.add("portal_rh:view");
    } else {
      out.add(p);
    }
  }
  return [...out];
}

export type Acao = typeof ACOES[number]["key"];

/**
 * Ações finas: liberadas por padrão, bloqueáveis uma a uma.
 *
 * As permissões específicas acima (ACOES_ESPECIAIS) começam desligadas e
 * precisam ser dadas. Estas são o contrário: quem já pode usar o módulo já
 * podia fazer tudo isto, e ninguém pode perder acesso no dia em que a
 * opção aparece. Então elas valem enquanto não houver um bloqueio gravado
 * — a chave "modulo:sem:acao" — e o administrador só desmarca o que quer
 * proibir. Ex.: o almoxarife registra entregas, mas não desfaz devolução.
 *
 * `base` é a ação comum que a pessoa precisa ter antes: sem ela, a ação
 * fina não vale, marcada ou não.
 */
export const ACOES_FINAS: Record<string, { key: string; label: string; base: Acao }[]> = {
  entregas: [
    { key: "gerar_ficha", label: "Gerar a Ficha de EPI", base: "edit" },
    { key: "registrar_devolucao", label: "Registrar devolução", base: "create" },
    { key: "desfazer_devolucao", label: "Desfazer devolução", base: "edit" },
    { key: "link_assinatura", label: "Copiar link de assinatura (WhatsApp)", base: "edit" },
  ],
};

/** A chave gravada quando o administrador bloqueia uma ação fina. */
export const chaveDeBloqueio = (modulo: string, acao: string) => `${modulo}:sem:${acao}`;

/** Pode fazer a ação fina? Precisa da ação base e de não ter o bloqueio. */
export function podeAcaoFina(modulosPermitidos: string[], modulo: string, acao: string): boolean {
  const fina = ACOES_FINAS[modulo]?.find((a) => a.key === acao);
  if (!fina) return false;
  return hasPermission(modulosPermitidos, modulo, fina.base) &&
    !modulosPermitidos.includes(chaveDeBloqueio(modulo, acao));
}

export const MODULOS = [
  { key: "dashboard", label: "Dashboard", path: "/" },
  { key: "epis", label: "Controle de EPI", path: "/epis" },
  { key: "estoque_contrato", label: "Estoque por Unidade", path: "/epis/controle-contrato" },
  { key: "solicitacoes_materiais", label: "Solicitação de Materiais", path: "/epis/solicitacoes-materiais" },
  { key: "entregas", label: "Entregas", path: "/entregas" },
  { key: "relatorios", label: "Relatórios", path: "/relatorios" },
  { key: "cadastro_empresas", label: "Cadastro → Empresas", path: "/cadastro/empresas" },
  { key: "cadastro_funcionarios", label: "Cadastro → Funcionários", path: "/cadastro/funcionarios" },
  { key: "cadastro_usuarios", label: "Cadastro → Usuários Liberados", path: "/cadastro/usuarios" },
  { key: "dds", label: "Lista de Presença", path: "/dds" },
  { key: "inspecoes_se", label: "Inspeções SE", path: "/inspecoes-se" },
  /*
   * Extintores existia no menu mas não aqui: só dava para liberar junto com
   * Inspeções (o menu herda de inspecoes_se). Agora também pode ser dado
   * sozinho — ex.: brigadista que só cuida dos extintores.
   */
  { key: "extintores", label: "Extintores (NR-23)", path: "/extintores" },
  { key: "treinamentos", label: "Gestão e Controle", path: "/treinamentos" },
  { key: "pgr", label: "PGR — Gerenciamento de Riscos", path: "/pgr" },
  { key: "ltcat", label: "LTCAT — Laudo Técnico Previdenciário", path: "/ltcat" },
  { key: "ppp", label: "PPP — Perfil Profissiográfico Previdenciário", path: "/ppp" },
  { key: "esocial", label: "eSocial — S-2240 (stub interno)", path: "/esocial/s2240/mapeamentos" },

  { key: "exames", label: "Exames", path: "/exames" },
  { key: "aso", label: "Gestão e Emissão de ASO", path: "/aso" },
  { key: "rh", label: "Portal RH — ASO (legado)", path: "/rh/asos" },
  { key: "portal_rh", label: "Portal RH", path: "/rh/asos" },
  { key: "video_treinamentos", label: "Treinamentos em Vídeo", path: "/video-treinamentos" },
  { key: "arquivo_digital", label: "Arquivo Digital — Vencimentos", path: "/arquivo-digital/vencimentos" },
] as const;

/**
 * Os módulos agrupados por assunto, na ordem em que a tela de permissões os
 * mostra.
 *
 * São 24 módulos, e a lista corrida virava uma parede: quem precisava liberar
 * "Estoque por Unidade" rolava por CAT, PPP e eSocial no caminho. O
 * agrupamento é só apresentação — nenhuma permissão depende dele.
 *
 * Todo módulo precisa estar em exatamente um grupo. Um módulo esquecido aqui
 * some da tela, e uma permissão que não aparece é uma permissão que ninguém
 * revisa; `permissoes.grupos.test.ts` cobre isso.
 */
export const GRUPOS_MODULOS: { titulo: string; modulos: string[] }[] = [
  { titulo: "Visão geral", modulos: ["dashboard", "relatorios"] },
  { titulo: "EPI", modulos: ["epis", "entregas", "estoque_contrato", "solicitacoes_materiais"] },
  { titulo: "Pessoas e empresas", modulos: ["cadastro_funcionarios", "cadastro_empresas", "cadastro_usuarios"] },
  { titulo: "Programas e laudos de SST", modulos: ["pgr", "ltcat", "ppp", "esocial", "arquivo_digital"] },
  { titulo: "Saúde ocupacional", modulos: ["aso", "exames", "portal_rh", "rh"] },
  { titulo: "Treinamentos e DDS", modulos: ["treinamentos", "video_treinamentos", "dds"] },
  { titulo: "Inspeções", modulos: ["inspecoes_se", "extintores"] },
];

/**
 * Nome de cada módulo NA TELA DE PERMISSÕES. O menu usa os nomes de
 * MODULOS; aqui o nome precisa dizer o que a permissão libera — "Gestão e
 * Controle" sozinho não dizia que era de treinamentos, e "Cadastro →"
 * repetia o nome do grupo em toda linha.
 */
export const NOME_NA_PERMISSAO: Record<string, string> = {
  dashboard: "Painel inicial",
  relatorios: "Relatórios",
  epis: "EPIs — cadastro e estoque",
  entregas: "Entregas de EPI",
  estoque_contrato: "Estoque por unidade",
  solicitacoes_materiais: "Solicitação de materiais",
  cadastro_funcionarios: "Funcionários",
  cadastro_empresas: "Empresas",
  cadastro_usuarios: "Usuários e permissões",
  pgr: "PGR, PCMSO e estrutura de GES",
  ltcat: "LTCAT",
  ppp: "PPP",
  esocial: "eSocial — S-2240",
  arquivo_digital: "Dossiê e vencimento de documentos",
  aso: "ASO — gestão e emissão",
  exames: "Exames",
  portal_rh: "Portal RH (consulta de ASO)",
  rh: "Portal RH — versão antiga",
  treinamentos: "Treinamentos",
  video_treinamentos: "Treinamentos em vídeo",
  dds: "DDS / lista de presença",
  inspecoes_se: "Inspeções e apontamentos (inclui extintores)",
  extintores: "Extintores (NR-23)",
};


/**
 * Check if a user has a specific permission.
 * If modulosPermitidos is empty, user has full access (no restrictions).
 * Legacy bare key (e.g., "epis") grants all actions for that module.
 */
export function hasPermission(
  modulosPermitidos: string[],
  moduleKey: string,
  action: Acao = "view"
): boolean {
  // No restrictions = full access
  if (!modulosPermitidos || modulosPermitidos.length === 0) return false;

  // Legacy bare key = full access to that module
  if (modulosPermitidos.includes(moduleKey)) return true;

  // Check specific action
  if (modulosPermitidos.includes(`${moduleKey}:${action}`)) return true;

  // Legacy compat: old "edit" permission (before create was split) grants "create" too
  if (action === "create" && modulosPermitidos.includes(`${moduleKey}:edit`)) return true;

  // P0 #2 — Permissões multi-nível (ex: "esocial:s2240:visualizar"):
  // qualquer permissão granular do módulo concede pelo menos "view" no módulo,
  // permitindo que o usuário acesse a rota e a UI faça o gating fino.
  if (action === "view") {
    const prefix = `${moduleKey}:`;
    // Bloqueio ("modulo:sem:acao") tira poder, não dá: não conta como acesso.
    if (modulosPermitidos.some((p) => p.startsWith(prefix) && !p.startsWith(`${prefix}sem:`))) return true;
  }

  return false;
}

/**
 * Check if user can access a module at all (has at least view permission)
 */
export function canAccessModule(modulosPermitidos: string[], moduleKey: string): boolean {
  return hasPermission(modulosPermitidos, moduleKey, "view");
}

/**
 * Get all permission keys for a module (all actions selected)
 */
export function allActionsForModule(moduleKey: string): string[] {
  return ACOES.map(a => `${moduleKey}:${a.key}`);
}

/**
 * Get all permissions for all modules (full access)
 */
export function allPermissions(): string[] {
  return MODULOS.flatMap(m => allActionsForModule(m.key));
}
