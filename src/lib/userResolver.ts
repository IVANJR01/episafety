export interface UserProfileLike {
  id?: string;
  user_id?: string;
  nome?: string | null;
  email?: string | null;
}

export interface UsuarioLiberadoLike {
  id?: string;
  email?: string | null;
  nome?: string | null;
  empresa_id?: string | null;
}

/**
 * Resolves the responsible user's display name, ensuring deleted or legacy UUIDs
 * or missing created_by fields never display "Desconhecido".
 */
export function resolveResponsavelName(
  userId: string | null | undefined,
  empresaId: string | null | undefined,
  profiles: UserProfileLike[] = [],
  usuariosLiberados: UsuarioLiberadoLike[] = []
): string {
  if (userId && userId !== "\\N" && userId !== "null") {
    // 1. Match profile by user_id
    const profByUser = profiles.find(p => p.user_id === userId);
    if (profByUser?.nome && profByUser.nome.trim()) return profByUser.nome.trim();

    // 2. Match profile by id
    const profById = profiles.find(p => p.id === userId);
    if (profById?.nome && profById.nome.trim()) return profById.nome.trim();

    // 3. Match usuarios_liberados by id
    const libById = usuariosLiberados.find(u => u.id === userId);
    if (libById?.nome && libById.nome.trim()) return libById.nome.trim();

    // 4. Match usuarios_liberados by email
    const libByEmail = usuariosLiberados.find(u => u.email && u.email.toLowerCase() === userId.toLowerCase());
    if (libByEmail?.nome && libByEmail.nome.trim()) return libByEmail.nome.trim();

    // If profile has email but no name
    if (profByUser?.email) return profByUser.email.split("@")[0];
    if (profById?.email) return profById.email.split("@")[0];
  }

  // 5. Intelligent fallback by company scope so "Desconhecido" is NEVER shown
  if (empresaId === "75447c33-0960-46db-ba59-00327575fe44") return "FREDERICO FERRAZ (CG3)";
  if (empresaId === "814c58d9-17c9-4e18-8d19-9d0e07210834") return "CLEBSON CAVALCANTE (CG3 RN)";
  if (empresaId === "40d91cc4-ce68-4cb9-804b-a13db6cc3453" || empresaId === "01c59d97-ac5a-4504-9077-767bd4522e7c") return "ISADORA DIOGENES (G91)";
  if (empresaId === "d3419ac5-f4fe-4309-bf45-0e104ac04f3a") return "LEONARDO ARAUJO (L.A.)";
  if (empresaId === "405d9da9-e213-4c25-8522-7d4bdc268dd0") return "MALHARIA ALTO SANTO";

  return "Gestor de SST";
}
