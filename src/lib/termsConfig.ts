// Configuração central dos Termos de Uso e canais de suporte.
// Edite APENAS este arquivo quando atualizar a versão, empresa ou canais.

export const TERMS_VERSION = "1.0";
export const TERMS_UPDATED_AT = "04 de julho de 2026";

// TODO: Substituir pelos dados oficiais quando disponíveis (jurídico).
export const COMPANY_LEGAL = {
  razaoSocial: "RAZAO_SOCIAL_TBD",
  cnpj: "CNPJ_TBD",
  endereco: "ENDERECO_TBD",
  email: "contato@safetysolucoes.com",
};

// Canais de suporte visíveis para os clientes.
export const SUPPORT_CHANNELS = {
  whatsapp: "5588996349359", // formato E.164 sem "+" para wa.me
  whatsappDisplay: "+55 (88) 99634-9359",
  email: "SUPORTE_EMAIL_TBD@safetysolucoes.com",
};

export const supportWhatsappUrl = (msg = "Olá, preciso de ajuda com o SafetySoluções.") =>
  `https://wa.me/${SUPPORT_CHANNELS.whatsapp}?text=${encodeURIComponent(msg)}`;

export const supportMailtoUrl = (subject = "Suporte SafetySoluções") =>
  `mailto:${SUPPORT_CHANNELS.email}?subject=${encodeURIComponent(subject)}`;
