/**
 * Catálogo e Inteligência Normativa de Exames Ocupacionais (NR-07 e Tabela 28 do eSocial).
 * Suporte completo a Exames Clínicos e Complementares com indicação do profissional
 * habilitado (Médicos do Trabalho com CRM, Fonoaudiólogos com CRFa, Laboratórios, etc.).
 */

export interface ExameCatalogoItem {
  codigo: string;
  nome: string;
  tipo: "clinico" | "complementar";
  profissionalSugerido: "medico" | "fonoaudiologo" | "oftalmologista" | "laboratorio" | "psicologo" | "outro";
  profissionalLabel: string;
  conselhoSugerido: "CRM" | "CRFa" | "CRF" | "CRP" | "Outro";
  baseNormativa: string;
  admissional: boolean;
  periodico: boolean;
  retornoTrabalho: boolean;
  mudancaRisco: boolean;
  demissional: boolean;
  periodicidadePadrao: "Anual" | "Semestral" | "Bienal" | "6 meses após admissão e depois Anual" | "A critério médico";
  periodicidadeMeses: number;
  observacaoPadrao?: string;
}

export const CATALOGO_EXAMES_NR07: ExameCatalogoItem[] = [
  {
    codigo: "0295",
    nome: "Avaliação Clínica Ocupacional (Anamnese e Exame Físico)",
    tipo: "clinico",
    profissionalSugerido: "medico",
    profissionalLabel: "Médico do Trabalho / Examinador",
    conselhoSugerido: "CRM",
    baseNormativa: "NR-07 Item 7.5.6",
    admissional: true,
    periodico: true,
    retornoTrabalho: true,
    mudancaRisco: true,
    demissional: true,
    periodicidadePadrao: "Anual",
    periodicidadeMeses: 12,
    observacaoPadrao: "Exame clínico geral abrangendo anamnese ocupacional e exame físico e mental.",
  },
  {
    codigo: "0935",
    nome: "Audiometria Tonal e Vocal",
    tipo: "complementar",
    profissionalSugerido: "fonoaudiologo",
    profissionalLabel: "Fonoaudiólogo(a) Habilitado(a)",
    conselhoSugerido: "CRFa",
    baseNormativa: "NR-07 Anexo II (Ruído Contínuo/Intermitente)",
    admissional: true,
    periodico: true,
    retornoTrabalho: true,
    mudancaRisco: true,
    demissional: true,
    periodicidadePadrao: "6 meses após admissão e depois Anual",
    periodicidadeMeses: 12,
    observacaoPadrao: "Realizada em cabine audiométrica com repouso auditivo mínimo de 14 horas.",
  },
  {
    codigo: "0084",
    nome: "Acuidade Visual",
    tipo: "complementar",
    profissionalSugerido: "oftalmologista",
    profissionalLabel: "Oftalmologista / Médico Examinador",
    conselhoSugerido: "CRM",
    baseNormativa: "Critério Médico Ocupacional (Trabalho em altura, máquinas e direção)",
    admissional: true,
    periodico: true,
    retornoTrabalho: false,
    mudancaRisco: true,
    demissional: true,
    periodicidadePadrao: "Anual",
    periodicidadeMeses: 12,
    observacaoPadrao: "Teste de Snellen / Jaeger com e sem correção óptica.",
  },
  {
    codigo: "0181",
    nome: "Espirometria Ocupacional",
    tipo: "complementar",
    profissionalSugerido: "medico",
    profissionalLabel: "Pneumologista / Médico Habilitado",
    conselhoSugerido: "CRM",
    baseNormativa: "NR-07 Anexo I (Poeiras e Aerodispersóides)",
    admissional: true,
    periodico: true,
    retornoTrabalho: false,
    mudancaRisco: true,
    demissional: true,
    periodicidadePadrao: "Bienal",
    periodicidadeMeses: 24,
    observacaoPadrao: "Avaliação da capacidade vital forçada (CVF) e VEF1.",
  },
  {
    codigo: "0519",
    nome: "Radiografia de Tórax (RX Padrão OIT)",
    tipo: "complementar",
    profissionalSugerido: "medico",
    profissionalLabel: "Médico Radiologista / Leitor OIT",
    conselhoSugerido: "CRM",
    baseNormativa: "NR-07 Anexo I (Poeiras Minerais / Fumos)",
    admissional: true,
    periodico: true,
    retornoTrabalho: false,
    mudancaRisco: true,
    demissional: true,
    periodicidadePadrao: "Bienal",
    periodicidadeMeses: 24,
    observacaoPadrao: "Telerradiografia de tórax com leitura segundo os critérios da OIT.",
  },
  {
    codigo: "0211",
    nome: "Eletrocardiograma (ECG)",
    tipo: "complementar",
    profissionalSugerido: "medico",
    profissionalLabel: "Cardiologista / Médico Examinador",
    conselhoSugerido: "CRM",
    baseNormativa: "NR-35 (Altura) / NR-33 (Espaço Confinado) / NR-10",
    admissional: true,
    periodico: true,
    retornoTrabalho: false,
    mudancaRisco: true,
    demissional: true,
    periodicidadePadrao: "Anual",
    periodicidadeMeses: 12,
    observacaoPadrao: "Traçado eletrocardiográfico em repouso com laudo cardiológico.",
  },
  {
    codigo: "0213",
    nome: "Eletroencefalograma (EEG)",
    tipo: "complementar",
    profissionalSugerido: "medico",
    profissionalLabel: "Neurologista / Médico Examinador",
    conselhoSugerido: "CRM",
    baseNormativa: "NR-35 (Altura) / NR-33 (Espaço Confinado)",
    admissional: true,
    periodico: true,
    retornoTrabalho: false,
    mudancaRisco: true,
    demissional: true,
    periodicidadePadrao: "Anual",
    periodicidadeMeses: 12,
    observacaoPadrao: "Avaliação bioelétrica cerebral com manobras de ativação.",
  },
  {
    codigo: "0284",
    nome: "Glicemia de Jejum",
    tipo: "complementar",
    profissionalSugerido: "laboratorio",
    profissionalLabel: "Laboratório de Análises Clínicas",
    conselhoSugerido: "CRF",
    baseNormativa: "Critério Clínico (NR-35 / NR-33)",
    admissional: true,
    periodico: true,
    retornoTrabalho: false,
    mudancaRisco: true,
    demissional: true,
    periodicidadePadrao: "Anual",
    periodicidadeMeses: 12,
    observacaoPadrao: "Dosagem sérica de glicose após jejum de 8 a 12 horas.",
  },
  {
    codigo: "0281",
    nome: "Hemograma Completo com Plaquetas",
    tipo: "complementar",
    profissionalSugerido: "laboratorio",
    profissionalLabel: "Laboratório de Análises Clínicas",
    conselhoSugerido: "CRF",
    baseNormativa: "NR-07 Quadro 1 (Solventes, Tintas, Combustíveis)",
    admissional: true,
    periodico: true,
    retornoTrabalho: false,
    mudancaRisco: true,
    demissional: true,
    periodicidadePadrao: "Semestral",
    periodicidadeMeses: 6,
    observacaoPadrao: "Série vermelha, branca e plaquetária.",
  },
  {
    codigo: "0599",
    nome: "Avaliação Psicossocial",
    tipo: "complementar",
    profissionalSugerido: "psicologo",
    profissionalLabel: "Psicólogo(a) / Médico do Trabalho",
    conselhoSugerido: "CRP",
    baseNormativa: "NR-33 (Espaço Confinado) e NR-35 (Trabalho em Altura)",
    admissional: true,
    periodico: true,
    retornoTrabalho: false,
    mudancaRisco: true,
    demissional: true,
    periodicidadePadrao: "Anual",
    periodicidadeMeses: 12,
    observacaoPadrao: "Entrevista e aplicação de instrumentos psicológicos validados pelo CFP.",
  },
  {
    codigo: "0999",
    nome: "Exame Toxicológico de Larga Janela",
    tipo: "complementar",
    profissionalSugerido: "laboratorio",
    profissionalLabel: "Laboratório Credenciado",
    conselhoSugerido: "Outro",
    baseNormativa: "Lei 13.103/2015 e Portarias MTP (Motoristas Profissionais)",
    admissional: true,
    periodico: true,
    retornoTrabalho: false,
    mudancaRisco: false,
    demissional: true,
    periodicidadePadrao: "Bienal",
    periodicidadeMeses: 30,
    observacaoPadrao: "Detecção de substâncias psicoativas em queratina.",
  },
];

/**
 * Sugere exames ocupacionais complementares e clínicos com base no
 * agente nocivo e nos quadros e anexos obrigatórios da NR-07.
 */
export function sugerirExamesCompletosNr07(grupo: string, risco: string, fonte: string): ExameCatalogoItem[] {
  const texto = `${grupo || ""} ${risco || ""} ${fonte || ""}`.toLowerCase();
  const exames: ExameCatalogoItem[] = [];

  // Exame Clínico Geral (obrigatório para todos os trabalhadores)
  const exameClinico = CATALOGO_EXAMES_NR07.find((e) => e.codigo === "0295");
  if (exameClinico) {
    exames.push(exameClinico);
  }

  // Ruído -> Audiometria (Fonoaudiólogo / Médico)
  if (texto.includes("ruído") || texto.includes("ruido") || texto.includes("som") || texto.includes("pressão sonora") || texto.includes("decib")) {
    const audio = CATALOGO_EXAMES_NR07.find((e) => e.codigo === "0935");
    if (audio) exames.push(audio);
  }

  // Poeiras / Fumos / Vapores -> Espirometria + RX Tórax OIT
  if (texto.includes("poeira") || texto.includes("sílica") || texto.includes("silica") || texto.includes("fumos") || texto.includes("respirat") || texto.includes("asbest")) {
    const espiro = CATALOGO_EXAMES_NR07.find((e) => e.codigo === "0181");
    const rx = CATALOGO_EXAMES_NR07.find((e) => e.codigo === "0519");
    if (espiro) exames.push(espiro);
    if (rx) exames.push(rx);
  }

  // Químico / Solventes / Combustíveis / Tintas -> Hemograma
  if (texto.includes("químic") || texto.includes("quimic") || texto.includes("solvente") || texto.includes("tinta") || texto.includes("vapor") || texto.includes("combust") || texto.includes("hidrocarb")) {
    const hemo = CATALOGO_EXAMES_NR07.find((e) => e.codigo === "0281");
    if (hemo && !exames.some((e) => e.codigo === "0281")) exames.push(hemo);
  }

  // Altura (NR-35) / Confinado (NR-33) / Eletricidade (NR-10) -> ECG, EEG, Glicemia, Psicossocial, Acuidade
  if (texto.includes("altura") || texto.includes("nr-35") || texto.includes("confinado") || texto.includes("nr-33") || texto.includes("eletric") || texto.includes("nr-10") || texto.includes("queda")) {
    const ecg = CATALOGO_EXAMES_NR07.find((e) => e.codigo === "0211");
    const eeg = CATALOGO_EXAMES_NR07.find((e) => e.codigo === "0213");
    const glicemia = CATALOGO_EXAMES_NR07.find((e) => e.codigo === "0284");
    const psico = CATALOGO_EXAMES_NR07.find((e) => e.codigo === "0599");
    const acuidade = CATALOGO_EXAMES_NR07.find((e) => e.codigo === "0084");

    if (ecg && !exames.some((e) => e.codigo === ecg.codigo)) exames.push(ecg);
    if (eeg && !exames.some((e) => e.codigo === eeg.codigo)) exames.push(eeg);
    if (glicemia && !exames.some((e) => e.codigo === glicemia.codigo)) exames.push(glicemia);
    if (psico && !exames.some((e) => e.codigo === psico.codigo)) exames.push(psico);
    if (acuidade && !exames.some((e) => e.codigo === acuidade.codigo)) exames.push(acuidade);
  }

  // Direção / Motorista / Empilhadeira -> Acuidade Visual
  if (texto.includes("motorista") || texto.includes("empilhadeira") || texto.includes("veículo") || texto.includes("veiculo") || texto.includes("trânsito")) {
    const acuidade = CATALOGO_EXAMES_NR07.find((e) => e.codigo === "0084");
    if (acuidade && !exames.some((e) => e.codigo === acuidade.codigo)) exames.push(acuidade);
  }

  return exames;
}
