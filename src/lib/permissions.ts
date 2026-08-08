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

/** Special per-module actions (shown as extra checkboxes) */
export const ACOES_ESPECIAIS: Record<string, { key: string; label: string }[]> = {
  epis: [{ key: "gestao_estoque", label: "Gestão de Estoque (todas unidades)" }],
  portal_rh: [
    { key: "visualizar", label: "Acessar Portal RH" },
    { key: "aso:visualizar", label: "Consultar ASOs liberados" },
    { key: "aso:baixar", label: "Baixar ASOs liberados" },
    { key: "funcionarios:visualizar", label: "Visualizar funcionários vinculados" },
  ],
  cat: [
    { key: "enviar_esocial", label: "Preparar envio eSocial (CAT)" },
    { key: "esocial", label: "Módulo eSocial S-2210 (gerar/validar/configurar)" },
    { key: "cancelar", label: "Cancelar CAT" },
  ],
  esocial: [
    { key: "s2240:visualizar", label: "S-2240 — Visualizar eventos e mapeamentos" },
    { key: "s2240:preparar", label: "S-2240 — Preparar evento / editar mapeamento" },
    { key: "s2240:validar", label: "S-2240 — Validar localmente (stub)" },
    { key: "s2240:retificar", label: "S-2240 — Abrir retificação" },
    { key: "s2240:excluir", label: "S-2240 — Excluir localmente" },
  ],
  pgr: [
    { key: "visualizar", label: "Visualizar PGR" },
    { key: "editar", label: "Editar PGR / Inventário / Ações" },
    { key: "revisar", label: "Abrir revisão e publicar PGR" },
    { key: "assinar", label: "Assinar PGR (assinatura visual + MFA)" },
    { key: "exportar", label: "Exportar PDF técnico do PGR" },
  ],
  ltcat: [
    { key: "visualizar", label: "Visualizar LTCAT" },
    { key: "editar", label: "Editar LTCAT / Avaliações / Conclusões" },
    { key: "revisar", label: "Abrir revisão e publicar LTCAT" },
    { key: "assinar", label: "Assinar LTCAT (assinatura visual + MFA)" },
    { key: "exportar", label: "Exportar PDF técnico do LTCAT" },
  ],
  ppp: [
    { key: "visualizar", label: "Visualizar PPP" },
    { key: "editar", label: "Editar PPP / Períodos / Exposições" },
    { key: "revisar", label: "Abrir revisão e publicar PPP" },
    { key: "assinar", label: "Assinar PPP (assinatura visual + MFA)" },
    { key: "exportar", label: "Exportar PDF técnico do PPP" },
  ],
};


export type Acao = typeof ACOES[number]["key"];

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
  { key: "treinamentos", label: "Gestão e Controle", path: "/treinamentos" },
  { key: "cat", label: "CAT — Comunicação de Acidente", path: "/cat" },
  { key: "pgr", label: "PGR — Gerenciamento de Riscos", path: "/pgr" },
  { key: "ltcat", label: "LTCAT — Laudo Técnico Previdenciário", path: "/ltcat" },
  { key: "ppp", label: "PPP — Perfil Profissiográfico Previdenciário", path: "/ppp" },
  { key: "esocial", label: "eSocial — S-2240 (stub interno)", path: "/esocial/s2240/mapeamentos" },

  { key: "exames", label: "Exames", path: "/exames" },
  { key: "aso", label: "Gestão e Emissão de ASO", path: "/aso" },
  { key: "rh", label: "Portal RH — ASO (legado)", path: "/rh/asos" },
  { key: "portal_rh", label: "Portal RH", path: "/rh/asos" },
  { key: "video_treinamentos", label: "Treinamentos em Vídeo", path: "/video-treinamentos" },
  { key: "comercial", label: "Comercial — Orçamentos e Cotações", path: "/comercial/orcamentos" },
  { key: "arquivo_digital", label: "Arquivo Digital — Vencimentos", path: "/arquivo-digital/vencimentos" },
] as const;

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
    if (modulosPermitidos.some((p) => p.startsWith(prefix))) return true;
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
