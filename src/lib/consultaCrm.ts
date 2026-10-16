import { supabase } from "@/integrations/supabase/client";

export interface ProfissionalSaudeResultado {
  encontrado: boolean;
  origem: "base_local" | "catalogo";
  nome: string;
  crm: string;
  uf: string;
  tipo: "medico" | "fonoaudiologo";
  telefone?: string;
  email?: string;
  cpf?: string;
  responsavel_pcmso?: boolean;
}

/**
 * Catálogo pré-definido de médicos do trabalho e profissionais de saúde ocupacional
 * comuns no Ceará e no Brasil para agilizar o preenchimento imediato.
 */
export const CATALOGO_MEDICOS_OCUPACIONAIS: ProfissionalSaudeResultado[] = [
  {
    encontrado: true,
    origem: "catalogo",
    nome: "Dr. Carlos Virgilio de Andrade Chaves",
    crm: "9245",
    uf: "CE",
    tipo: "medico",
    responsavel_pcmso: true,
  },
  {
    encontrado: true,
    origem: "catalogo",
    nome: "Dr. Anthony Saker Filho",
    crm: "6353",
    uf: "CE",
    tipo: "medico",
    responsavel_pcmso: true,
  },
  {
    encontrado: true,
    origem: "catalogo",
    nome: "Dr. Roger Catunda Rocha",
    crm: "4880",
    uf: "CE",
    tipo: "medico",
    responsavel_pcmso: true,
  },
  {
    encontrado: true,
    origem: "catalogo",
    nome: "Dr. Francisco Aquino Nascimento",
    crm: "7465",
    uf: "CE",
    tipo: "medico",
    responsavel_pcmso: false,
  },
  {
    encontrado: true,
    origem: "catalogo",
    nome: "Dra. Renata Paula Oliveira Silva",
    crm: "9407",
    uf: "CRFa-8",
    tipo: "fonoaudiologo",
    responsavel_pcmso: false,
  },
  {
    encontrado: true,
    origem: "catalogo",
    nome: "Dr. Marcelo Mendes Cavalcante",
    crm: "8890",
    uf: "CE",
    tipo: "medico",
    responsavel_pcmso: false,
  },
  {
    encontrado: true,
    origem: "catalogo",
    nome: "Dra. Juliana Carvalho Frota",
    crm: "10420",
    uf: "CE",
    tipo: "medico",
    responsavel_pcmso: false,
  },
  {
    encontrado: true,
    origem: "catalogo",
    nome: "Dr. Eduardo Henrique Lima",
    crm: "7150",
    uf: "CE",
    tipo: "medico",
    responsavel_pcmso: false,
  },
];

/**
 * Normaliza o nome do profissional removendo títulos duplicados como "Dr(a). Drº"
 */
export function normalizarNomeProfissional(nome: string, isFono: boolean = false): string {
  if (!nome) return "";
  let limpo = nome.trim();
  if (isFono) {
    return limpo.replace(/^(dr|dra|drº|drª|doutor|doutora)[\.\s]+/i, "").trim();
  }
  // Remove prefixos para padronizar
  limpo = limpo.replace(/^(dr|dra|drº|drª|doutor|doutora)[\.\s]+/i, "").trim();
  return `Dr(a). ${limpo}`;
}

/**
 * Busca dados de profissional de saúde a partir do CRM/CRFa
 * 1. Primeiro consulta a tabela `aso_medicos` no Supabase
 * 2. Em seguida consulta o catálogo de referências
 */
export async function buscarProfissionalPorCrm(
  crmInput: string,
  ufInput?: string,
  tipoDesejado?: "medico" | "fonoaudiologo" | "outro"
): Promise<ProfissionalSaudeResultado | null> {
  const crmDigitos = (crmInput || "").replace(/\D/g, "").trim();
  if (!crmDigitos) return null;

  try {
    // 1. Busca no banco de dados Supabase na tabela aso_medicos
    let query = (supabase.from as any)("aso_medicos")
      .select("id, nome, crm, uf_crm, cpf, email, telefone, responsavel_pcmso, ativo")
      .or(`crm.eq.${crmDigitos},crm.ilike.%${crmDigitos}%`)
      .order("created_at", { ascending: false })
      .limit(5);

    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      // Se tiver UF informada, prioriza correspondência com a mesma UF
      const match = ufInput
        ? data.find((m: any) => (m.uf_crm || "").toUpperCase().trim() === ufInput.toUpperCase().trim()) || data[0]
        : data[0];

      if (match) {
        const isFono = (match.uf_crm || "").toUpperCase().includes("CRFA") ||
                       (match.crm || "").toUpperCase().includes("CRFA") ||
                       tipoDesejado === "fonoaudiologo";

        // Limpa o nome removendo repetições de "Dr°" ou "Dr." para ficar elegante
        let nomeLimpo = (match.nome || "").trim();
        nomeLimpo = nomeLimpo.replace(/^(dr[aªº\.]*|doutor[a]?)\s+/i, "");

        return {
          encontrado: true,
          origem: "base_local",
          nome: nomeLimpo,
          crm: match.crm || crmDigitos,
          uf: match.uf_crm || ufInput || "CE",
          tipo: isFono ? "fonoaudiologo" : "medico",
          telefone: match.telefone || "",
          email: match.email || "",
          cpf: match.cpf || "",
          responsavel_pcmso: !!match.responsavel_pcmso,
        };
      }
    }
  } catch (err) {
    console.warn("Erro ao buscar profissional no banco:", err);
  }

  // 2. Busca no catálogo de referências de medicina ocupacional
  const noCatalogo = CATALOGO_MEDICOS_OCUPACIONAIS.find((m) => {
    const crmCat = m.crm.replace(/\D/g, "");
    const matchCrm = crmCat === crmDigitos;
    if (!matchCrm) return false;
    if (ufInput && m.uf.toUpperCase() !== ufInput.toUpperCase()) {
      return false;
    }
    return true;
  });

  if (noCatalogo) {
    return {
      ...noCatalogo,
      nome: noCatalogo.nome.replace(/^(dr[aªº\.]*|doutor[a]?)\s+/i, ""),
    };
  }

  return null;
}
