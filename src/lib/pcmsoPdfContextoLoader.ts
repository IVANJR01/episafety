import { supabase } from "@/integrations/supabase/client";
import { carregarLogoDataUrl } from "@/lib/logoParaPdf";
import { carregarEmissor } from "@/lib/emissorDocumentos";

export interface PcmsoCargoItem {
  id: string;
  nome: string;
  setor?: string | null;
  ambientes: string[];
  atividades: string;
  exameClinicoPeriodicidade: string;
  examesComplementares: {
    nome: string;
    codigoEsocial: string;
    periodicidade: string;
    fazerAdmissional?: boolean;
    fazerPeriodico?: boolean;
    fazerDemissional?: boolean;
    fazerRetorno?: boolean;
    fazerMudanca?: boolean;
  }[];
  riscosAcidentes: {
    agente: string;
    fonte: string;
    metodologia: string;
    medidas: string;
    danos: string;
  }[];
  riscosErgonomicos: {
    agente: string;
    fonte: string;
    metodologia: string;
    medidas: string;
    danos: string;
  }[];
  riscosQuimicos: {
    agente: string;
    fonte: string;
    metodologia: string;
    medidas: string;
    danos: string;
  }[];
  riscosFisicos: {
    agente: string;
    fonte: string;
    metodologia: string;
    medidas: string;
    danos: string;
  }[];
  riscosBiologicos: {
    agente: string;
    fonte: string;
    metodologia: string;
    medidas: string;
    danos: string;
  }[];
}

export interface PcmsoAmbienteItem {
  id: string;
  nome: string;
  descricao: string;
}

export interface PcmsoMedicoExaminadorItem {
  nome: string;
  crm: string;
  uf: string;
}

export interface PcmsoAcaoCronogramaItem {
  id: string;
  acao: string;
  responsavel: string | null;
  data_planejada: string | null;
  status: string;
  observacoes: string | null;
}

export interface PcmsoPdfContext {
  pcmso: any;
  empresa: {
    id: string;
    nome: string;
    nome_fantasia?: string | null;
    cnpj?: string | null;
    cnae_principal?: string | null;
    cnae_descricao?: string | null;
    grau_risco?: number | string | null;
    telefone?: string | null;
    email?: string | null;
    endereco_completo?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
    cep?: string | null;
    logo_url?: string | null;
  };
  emissor: any;
  emissorLogoDataUrl?: string | null;
  empresaLogoDataUrl?: string | null;
  medicoCoordenador: {
    nome: string;
    crm: string;
    uf: string;
  };
  medicosExaminadores: PcmsoMedicoExaminadorItem[];
  ambientes: PcmsoAmbienteItem[];
  cargos: PcmsoCargoItem[];
  cronograma: PcmsoAcaoCronogramaItem[];
  relatorioAnaliticoTexto: string;
  estatisticasAsos: {
    total: number;
    aptos: number;
    restricoes: number;
    inaptos: number;
    admissional: number;
    periodico: number;
    demissional: number;
    retorno: number;
    mudanca: number;
  };
}

export async function carregarPcmsoPdfContexto(pcmsoId: string): Promise<PcmsoPdfContext> {
  // 1. Busca documento PCMSO
  const { data: pcmso, error: errPcmso } = await (supabase.from as any)("pcmso_documentos")
    .select("*")
    .eq("id", pcmsoId)
    .single();

  if (errPcmso || !pcmso) {
    throw new Error("Documento PCMSO não encontrado: " + (errPcmso?.message || ""));
  }

  const empresaId = pcmso.empresa_id;

  // 2. Busca dados da empresa e emissor
  const [empRes, emissor] = await Promise.all([
    (supabase.from as any)("empresa_config")
      .select("*")
      .eq("id", empresaId)
      .maybeSingle(),
    carregarEmissor(),
  ]);

  const empData = empRes.data || {};
  const enderecoParts = [
    empData.logradouro ? `${empData.logradouro}, nº ${empData.numero || "S/N"}` : empData.endereco,
    empData.bairro ? `Bairro ${empData.bairro}` : null,
    empData.cidade && empData.uf ? `${empData.cidade} - ${empData.uf}` : (empData.cidade || empData.uf),
    empData.cep ? `CEP: ${empData.cep}` : null,
  ].filter(Boolean);

  const empresaFormatada = {
    id: empresaId,
    nome: empData.nome || "Empresa",
    nome_fantasia: empData.nome_fantasia,
    cnpj: empData.cnpj,
    cnae_principal: empData.cnae_principal,
    cnae_descricao: empData.cnae_secundario || empData.cnae_principal,
    grau_risco: empData.grau_risco || 2,
    telefone: empData.telefone,
    email: empData.email,
    endereco_completo: enderecoParts.join(", ") || empData.endereco || "Endereço não informado",
    logradouro: empData.logradouro,
    numero: empData.numero,
    bairro: empData.bairro,
    cidade: empData.cidade,
    uf: empData.uf,
    cep: empData.cep,
    logo_url: empData.logo_url,
  };

  // 3. Médico Coordenador
  let medicoCoord = {
    nome: pcmso.medico_nome || "Roger Catunda Rocha",
    crm: pcmso.medico_crm || "6353",
    uf: pcmso.medico_uf || "CE",
  };

  if (pcmso.medico_coordenador_id) {
    const { data: medData } = await (supabase.from as any)("aso_medicos")
      .select("nome, crm, uf_crm")
      .eq("id", pcmso.medico_coordenador_id)
      .maybeSingle();

    if (medData) {
      medicoCoord = {
        nome: medData.nome || medicoCoord.nome,
        crm: medData.crm || medicoCoord.crm,
        uf: medData.uf_crm || medicoCoord.uf,
      };
    }
  }

  // 4. Médicos examinadores parceiros
  const { data: medicosList } = await (supabase.from as any)("aso_medicos")
    .select("nome, crm, uf_crm")
    .or(`empresa_id.eq.${empresaId},empresa_id.is.null`)
    .eq("ativo", true)
    .order("nome");

  const medicosExaminadores: PcmsoMedicoExaminadorItem[] = (medicosList && medicosList.length > 0)
    ? medicosList.map((m: any) => ({
        nome: m.nome,
        crm: m.crm,
        uf: m.uf_crm || "CE",
      }))
    : [
        { nome: "Dr. Anthony Saker Filho", crm: "5303", uf: "CE" },
        { nome: "Dra. Ana Carolina Oliveira Cavalcante", crm: "27437", uf: "CE" },
        { nome: "Dr. Carlos Virgílio de Andrade Chaves", crm: "10790", uf: "CE" },
        { nome: "Dr. Francisco Aquino Nascimento", crm: "7465", uf: "CE" },
        { nome: "Dr. Gabriel de Oliveira Cavalcante", crm: "27505", uf: "CE" },
        { nome: "Dr. José Renato Ribeiro de Menezes Neto", crm: "29519", uf: "CE" },
        { nome: "Dr. João Pedro Nobre Tomaz", crm: "27531", uf: "CE" },
        { nome: "Dra. Renata Paula Oliveira Silva", crm: "9407", uf: "CRF-CE" },
        { nome: "Dr. Wladimir de Freitas Pereira", crm: "22805", uf: "CE" },
      ];

  // 5. Ambientes
  const { data: ambientesRaw } = await (supabase.from as any)("sst_ambientes")
    .select("id, nome, descricao")
    .eq("empresa_id", empresaId)
    .order("nome");

  const ambientes: PcmsoAmbienteItem[] = (ambientesRaw && ambientesRaw.length > 0)
    ? ambientesRaw.map((a: any) => ({
        id: a.id,
        nome: a.nome,
        descricao: a.descricao || `Ambiente operacional destinado às atividades de ${a.nome.toLowerCase()}.`,
      }))
    : [
        { id: "1", nome: "ALMOXARIFADO", descricao: "Depósito para armazenagem de insumos e materiais; prateleiras altas, circulação constante, movimentação de cargas." },
        { id: "2", nome: "ATELIER", descricao: "Atelier de moda, com mesas de modelagem, máquinas de costura, iluminação artificial e ventilação natural/forçada." },
        { id: "3", nome: "COMERCIAL", descricao: "Atendimento em loja e/ou escritório; ambiente com fluxo de clientes e uso de sistemas de venda." },
        { id: "4", nome: "CORTE", descricao: "Área ampla de corte de tecidos; ambiente com mesas de corte, movimentação de materiais e ruído de máquinas." },
        { id: "5", nome: "COSTURA", descricao: "Processo de confecção em máquinas de costura industriais; ambiente fechado, com iluminação artificial, ruído moderado e ventilação natural/forçada." },
        { id: "6", nome: "COZINHA", descricao: "Preparo e manipulação de alimentos, higienização de utensílios e equipamentos, utilização de fogões, fornos e panelas em ambiente interno com ventilação e iluminação artificial." },
        { id: "7", nome: "EMBALAGEM / EXPEDIÇÃO", descricao: "Área de embalagem e estocagem; movimentação manual de volumes e caixas; risco de quedas e escorregões." },
        { id: "8", nome: "ESCRITÓRIO", descricao: "Escritório administrativo; ambiente climatizado, iluminação artificial, mesas e computadores." },
        { id: "9", nome: "LIMPEZA", descricao: "Limpeza e higienização de áreas internas, banheiros, copa e setores produtivos; varrição, lavagem e desinfecção de pisos; manuseio de produtos de limpeza." },
        { id: "10", nome: "LOJA", descricao: "Loja de varejo e atacado, ambiente climatizado, com exposição a clientes e movimentação de mercadorias leves." },
        { id: "11", nome: "MARKETING", descricao: "Estúdio fotográfico e escritório de criação; iluminação artificial, computadores e equipamentos audiovisuais." },
        { id: "12", nome: "PCP", descricao: "Planejamento e controle da produção em escritório; ambiente climatizado, iluminação artificial, uso de computadores." },
        { id: "13", nome: "SEPARAÇÃO", descricao: "Área destinada à separação de peças; iluminação artificial, movimentação de pilhas de tecidos." },
      ];

  // 6. Cargos, Atividades e Riscos (Integrado com PGR Base)
  const pgrBaseId = pcmso.pgr_base_id;
  const [funcoesRaw, ghesData, gheFuncoesData, inventarioRaw] = await Promise.all([
    (supabase.from as any)("sst_funcoes")
      .select("id, nome, setor_id, cbo, descricao_atividades")
      .eq("empresa_id", empresaId)
      .order("nome"),
    (supabase.from as any)("ghe_ges")
      .select("id, codigo, nome, setor")
      .eq("empresa_id", empresaId),
    (supabase.from as any)("ghe_funcoes")
      .select("ghe_id, nome_funcao, funcao_id")
      .eq("empresa_id", empresaId),
    pgrBaseId
      ? (supabase.from as any)("pgr_inventario_itens")
          .select("*")
          .eq("pgr_id", pgrBaseId)
      : Promise.resolve({ data: [] }),
  ]);

  const funcoesList = (funcoesRaw.data || []) as any[];
  const invItens = (inventarioRaw.data || []) as any[];

  // Montagem estruturada dos cargos com base no inventário e funções cadastradas
  let cargos: PcmsoCargoItem[] = [];

  if (funcoesList.length > 0) {
    // Agrupa funções repetidas no cadastro para consolidar em uma ficha única por cargo
    const mapaCargos = new Map<string, any[]>();
    for (const fn of funcoesList) {
      const nomeNorm = (fn.nome || "").trim().toUpperCase().replace(/\s+/g, " ");
      if (!nomeNorm) continue;
      const arr = mapaCargos.get(nomeNorm) || [];
      arr.push(fn);
      mapaCargos.set(nomeNorm, arr);
    }

    cargos = Array.from(mapaCargos.entries()).map(([nomeCargo, funcoesDoGrupo]) => {
      const nomeNorm = nomeCargo.toLowerCase();

      // Ambientes consolidados de todas as variações do cargo
      const ambSet = new Set<string>();
      funcoesDoGrupo.forEach((fn) => {
        const matches = ambientes.filter((a) =>
          nomeNorm.includes(a.nome.toLowerCase()) ||
          (fn.descricao_atividades || "").toLowerCase().includes(a.nome.toLowerCase())
        );
        matches.forEach((m) => ambSet.add(m.nome));
      });
      const ambNomes = ambSet.size > 0 ? Array.from(ambSet) : [ambientes[0]?.nome || "GERAL"];

      // Atividades consolidadas (escolhe a mais detalhada cadastrada)
      let atividades = "";
      for (const fn of funcoesDoGrupo) {
        if (fn.descricao_atividades && fn.descricao_atividades.length > atividades.length) {
          atividades = fn.descricao_atividades.trim();
        }
      }

      if (!atividades) {
        if (nomeNorm.includes("costur")) atividades = "Operar máquinas de costura, acabamento de peças, movimentação manual de tecidos.";
        else if (nomeNorm.includes("cozinh")) atividades = "Realizar o corte, cozimento, fritura e preparo dos alimentos; higienizar utensílios e bancadas; operar fogões e fornos.";
        else if (nomeNorm.includes("limpeza") || nomeNorm.includes("serviços gerais") || nomeNorm.includes("faxin")) atividades = "Esfregar e lavar pisos, recolher e descartar resíduos, aplicar produtos químicos de higienização, higienização de sanitários.";
        else if (nomeNorm.includes("corte")) atividades = "Corte manual e em máquinas, organização de peças, transporte interno.";
        else if (nomeNorm.includes("embal")) atividades = "Embalar produtos, organizar volumes, carregar e descarregar mercadorias.";
        else if (nomeNorm.includes("venda") || nomeNorm.includes("loja") || nomeNorm.includes("comercial")) atividades = "Atendimento ao cliente, registro de vendas, controle de caixa, organização de produtos.";
        else atividades = "Execução de atividades rotineiras e operacionais da função, controles administrativos e cumprimento de normas internas.";
      }

      // Exames complementares por cargo
      const examesComp: PcmsoCargoItem["examesComplementares"] = [];
      if (nomeNorm.includes("cozinh")) {
        examesComp.push(
          { nome: "Glicemia", codigoEsocial: "0658", periodicidade: "A cada 12 meses", fazerAdmissional: true, fazerPeriodico: true },
          { nome: "Hemograma Completo", codigoEsocial: "0693", periodicidade: "A cada 12 meses", fazerAdmissional: true, fazerPeriodico: true }
        );
      } else if (nomeNorm.includes("limpeza") || nomeNorm.includes("serviços gerais") || nomeNorm.includes("faxin")) {
        examesComp.push(
          { nome: "Hemograma Completo", codigoEsocial: "0693", periodicidade: "A cada 12 meses", fazerAdmissional: true, fazerPeriodico: true }
        );
      } else if (nomeNorm.includes("corte") || nomeNorm.includes("ruido")) {
        examesComp.push(
          { nome: "Audiometria Tonal e Vocal", codigoEsocial: "0281", periodicidade: "A cada 12 meses (NR-07 Anexo II)", fazerAdmissional: true, fazerPeriodico: true }
        );
      }

      // Mapear riscos do inventário do PGR correspondentes à função
      const riscosDoCargo = invItens.filter((it: any) => {
        const funcsSnapshot = Array.isArray(it.funcoes_snapshot) ? it.funcoes_snapshot.join(" ").toLowerCase() : "";
        const setorItem = (it.setor || "").toLowerCase();
        return funcsSnapshot.includes(nomeNorm) || setorItem.includes(nomeNorm);
      });

      // Deduplicação de riscos por agente
      const deduplicarRiscos = (itens: any[]) => {
        const vistos = new Set<string>();
        return itens.filter((i) => {
          const k = i.agente.toLowerCase().trim();
          if (vistos.has(k)) return false;
          vistos.add(k);
          return true;
        });
      };

      const riscosAcidentesRaw: any[] = [];
      const riscosErgonomicosRaw: any[] = [];
      const riscosQuimicosRaw: any[] = [];
      const riscosFisicosRaw: any[] = [];
      const riscosBiologicosRaw: any[] = [];

      riscosDoCargo.forEach((r: any) => {
        const grupo = (r.grupo || "").toLowerCase();
        const obj = {
          agente: r.tipo_agente || r.perigo_descricao || "Agente identificado",
          fonte: r.fonte_geradora || r.processo || "Processo de trabalho",
          metodologia: "Critério Qualitativo.",
          medidas: r.controles_existentes || "Treinamento e medidas administrativas",
          danos: r.lesoes || "Possíveis danos à saúde e integridade física",
        };
        if (grupo.includes("acid") || grupo.includes("mecan")) riscosAcidentesRaw.push(obj);
        else if (grupo.includes("ergo")) riscosErgonomicosRaw.push(obj);
        else if (grupo.includes("quim")) riscosQuimicosRaw.push(obj);
        else if (grupo.includes("fisi")) riscosFisicosRaw.push(obj);
        else if (grupo.includes("biol")) riscosBiologicosRaw.push(obj);
      });

      // Se não havia no inventário, injeta padrões preventivos conforme o perfil da ocupação
      if (riscosAcidentesRaw.length === 0) {
        if (nomeNorm.includes("costur") || nomeNorm.includes("ajudante")) {
          riscosAcidentesRaw.push({
            agente: "Cortes / Perfurações / Partes móveis",
            fonte: "Máquinas de costura",
            metodologia: "Critério Qualitativo.",
            medidas: "Protetores de máquina, treinamento",
            danos: "Perfurações, cortes, prensagem",
          });
        } else if (nomeNorm.includes("cozinh")) {
          riscosAcidentesRaw.push({
            agente: "Cortes e perfurações",
            fonte: "Manipulação de alimentos e utensílios",
            metodologia: "Critério Qualitativo.",
            medidas: "Treinamento de segurança, uso de luvas de malha de aço e calçados fechados",
            danos: "Queimaduras, ferimentos",
          });
        } else if (nomeNorm.includes("limpeza") || nomeNorm.includes("faxin")) {
          riscosAcidentesRaw.push({
            agente: "Piso molhado / escorregadio",
            fonte: "Água e resíduos durante a limpeza",
            metodologia: "Critério Qualitativo.",
            medidas: "Sinalização de piso molhado, calçado antiderrapante, rotina programada",
            danos: "Escorregões, torções, quedas",
          });
        }
      }

      if (riscosErgonomicosRaw.length === 0) {
        if (nomeNorm.includes("escrit") || nomeNorm.includes("admin") || nomeNorm.includes("comercial") || nomeNorm.includes("gerente") || nomeNorm.includes("pcp")) {
          riscosErgonomicosRaw.push(
            {
              agente: "Sobrecarga / Pressão por prazos",
              fonte: "Pressão por metas, prazos curtos, trabalho mental contínuo",
              metodologia: "Critério Qualitativo.",
              medidas: "Programas de qualidade de vida, pausas, apoio psicológico",
              danos: "Estresse, ansiedade, fadiga mental, burnout",
            },
            {
              agente: "Postura inadequada",
              fonte: "Mobiliário; Computador",
              metodologia: "Critério Qualitativo.",
              medidas: "Ajuste ergonômico de mesas/cadeiras, orientação postural e pausas",
              danos: "Dores lombares, cervicais, fadiga muscular",
            }
          );
        } else {
          riscosErgonomicosRaw.push(
            {
              agente: "Postura inadequada / Movimentos repetitivos",
              fonte: "Posto de trabalho operacional",
              metodologia: "Critério Qualitativo.",
              medidas: "Ajuste ergonômico, pausas regulares e revezamento",
              danos: "Lombalgias, LER/DORT, desconforto postural",
            }
          );
        }
      }

      if (riscosQuimicosRaw.length === 0 && (nomeNorm.includes("limpeza") || nomeNorm.includes("faxin") || nomeNorm.includes("serviços gerais"))) {
        riscosQuimicosRaw.push({
          agente: "Produtos de limpeza",
          fonte: "Manipulação, diluição e uso de produtos saneantes e detergentes",
          metodologia: "Critério Qualitativo.",
          medidas: "Uso de luvas nitrílicas, máscara PFF2, ventilação e produtos menos agressivos",
          danos: "Irritação cutânea, ardência ocular, alergias, intoxicação leve",
        });
      }

      return {
        id: funcoesDoGrupo[0].id,
        nome: nomeCargo,
        setor: funcoesDoGrupo[0].setor_id || "Operacional",
        ambientes: ambNomes,
        atividades,
        exameClinicoPeriodicidade: "O periódico será feito a cada 12 meses.",
        examesComplementares: examesComp,
        riscosAcidentes: deduplicarRiscos(riscosAcidentesRaw),
        riscosErgonomicos: deduplicarRiscos(riscosErgonomicosRaw),
        riscosQuimicos: deduplicarRiscos(riscosQuimicosRaw),
        riscosFisicos: deduplicarRiscos(riscosFisicosRaw),
        riscosBiologicos: deduplicarRiscos(riscosBiologicosRaw),
      };
    });
  } else {
    // Fallback com os cargos do documento modelo fornecido pelo usuário
    cargos = [
      {
        id: "c1",
        nome: "AJUDANTE",
        ambientes: ["COSTURA (Ambiente Principal)"],
        atividades: "Operar máquinas de costura, acabamento de peças, movimentação manual de tecidos.",
        exameClinicoPeriodicidade: "O periódico será feito a cada 12 meses.",
        examesComplementares: [],
        riscosAcidentes: [{ agente: "Cortes / Perfurações / Partes móveis", fonte: "Máquinas de costura", metodologia: "Critério Qualitativo.", medidas: "Protetores de máquina, treinamento", danos: "Perfurações, cortes, prensagem" }],
        riscosErgonomicos: [
          { agente: "Postura inadequada", fonte: "Máquinas de costura, mobiliário", metodologia: "Critério Qualitativo.", medidas: "Ajuste ergonômico de cadeiras/mesas, pausas", danos: "Dores lombares, desvios posturais" },
          { agente: "Movimentos repetitivos", fonte: "Máquinas de costura", metodologia: "Critério Qualitativo.", medidas: "Revezamento de tarefas, pausas regulares", danos: "LER/DORT" },
          { agente: "Pressão por metas/prazos", fonte: "Ritmo e cobrança de produção", metodologia: "Critério Qualitativo.", medidas: "Programas de qualidade de vida, apoio psicológico", danos: "Estresse, ansiedade, burnout" },
        ],
        riscosQuimicos: [], riscosFisicos: [], riscosBiologicos: [],
      },
      {
        id: "c2",
        nome: "AUXILIAR DE COZINHA",
        ambientes: ["COZINHA (Ambiente Principal)"],
        atividades: "Realizar o corte, cozimento, fritura e preparo dos alimentos; higienizar utensílios e bancadas; operar fogões e fornos.",
        exameClinicoPeriodicidade: "O periódico será feito a cada 12 meses.",
        examesComplementares: [
          { nome: "Glicemia", codigoEsocial: "0658", periodicidade: "O periódico será feito a cada 12 meses.", fazerAdmissional: true, fazerPeriodico: true },
          { nome: "Hemograma Completo", codigoEsocial: "0693", periodicidade: "O periódico será feito a cada 12 meses.", fazerAdmissional: true, fazerPeriodico: true },
        ],
        riscosAcidentes: [{ agente: "Cortes e perfurações", fonte: "Manipulação de alimentos e utensílios", metodologia: "Critério Qualitativo.", medidas: "Treinamento de segurança, uso de luvas de malha metálica, calçados fechados", danos: "Queimaduras, ferimentos" }],
        riscosErgonomicos: [{ agente: "Postura em pé prolongada / movimentos repetitivos", fonte: "Bancadas, pias e manipulação manual", metodologia: "Critério Qualitativo.", medidas: "Apoio para pés, pausas regulares, ajuste de altura das bancadas", danos: "Lombalgias, fadiga muscular" }],
        riscosQuimicos: [], riscosFisicos: [], riscosBiologicos: [],
      },
      {
        id: "c3",
        nome: "AUXILIAR DE SERVIÇOS GERAIS",
        ambientes: ["LIMPEZA (Ambiente Principal)", "COSTURA", "ESCRITÓRIO", "COMERCIAL"],
        atividades: "Esfregar e lavar pisos, esvaziar lixeiras, recolher e descartar resíduos, aplicar produtos químicos de higienização, realizar a desinfecção de sanitários.",
        exameClinicoPeriodicidade: "O periódico será feito a cada 12 meses.",
        examesComplementares: [
          { nome: "Hemograma Completo", codigoEsocial: "0693", periodicidade: "O periódico será feito a cada 12 meses.", fazerAdmissional: true, fazerPeriodico: true },
        ],
        riscosAcidentes: [{ agente: "Piso molhado / escorregadio", fonte: "Água e resíduos durante a limpeza", metodologia: "Critério Qualitativo.", medidas: "Sinalização de piso molhado, calçado antiderrapante", danos: "Escorregões, torções, quedas" }],
        riscosErgonomicos: [{ agente: "Esforço físico / posturas forçadas", fonte: "Movimentação de baldes, agachamentos", metodologia: "Critério Qualitativo.", medidas: "Treinamento de levantamento seguro, rodízio de tarefas", danos: "Lombalgias, distensões" }],
        riscosQuimicos: [{ agente: "Produtos de limpeza", fonte: "Manipulação e diluição de produtos saneantes", metodologia: "Critério Qualitativo.", medidas: "Uso de luvas nitrílicas, máscara PFF2, ventilação adequada", danos: "Irritação cutânea, alergias, intoxicação leve" }],
        riscosFisicos: [], riscosBiologicos: [],
      },
      {
        id: "c4",
        nome: "ASSISTENTE ADMINISTRATIVO",
        ambientes: ["ESCRITÓRIO (Ambiente Principal)", "PCP"],
        atividades: "Planejamento, cronogramas, controles administrativos, atendimento e relatórios.",
        exameClinicoPeriodicidade: "O periódico será feito a cada 12 meses.",
        examesComplementares: [],
        riscosAcidentes: [],
        riscosErgonomicos: [
          { agente: "Sobrecarga", fonte: "Pressão por metas e prazos curtos", metodologia: "Critério Qualitativo.", medidas: "Gestão de clima, pausas, apoio psicológico", danos: "Estresse, ansiedade, burnout" },
          { agente: "Postura inadequada", fonte: "Mobiliário; Computador", metodologia: "Critério Qualitativo.", medidas: "Ajuste ergonômico de mesas/cadeiras, pausas para alongamento", danos: "Dores lombares, cervicais" },
        ],
        riscosQuimicos: [], riscosFisicos: [], riscosBiologicos: [],
      },
      {
        id: "c5",
        nome: "CORTADOR",
        ambientes: ["CORTE (Ambiente Principal)"],
        atividades: "Corte manual e em máquinas, organização de peças, transporte interno.",
        exameClinicoPeriodicidade: "O periódico será feito a cada 12 meses.",
        examesComplementares: [],
        riscosAcidentes: [{ agente: "Cortes / Partes móveis", fonte: "Máquinas de corte", metodologia: "Critério Qualitativo.", medidas: "Protetores de máquina, treinamento", danos: "Cortes, amputações" }],
        riscosErgonomicos: [{ agente: "Postura em pé prolongada", fonte: "Máquinas de corte, mesas", metodologia: "Critério Qualitativo.", medidas: "Rodízio de tarefas, pausas", danos: "Lombalgias, fadiga" }],
        riscosQuimicos: [], riscosFisicos: [], riscosBiologicos: [],
      },
    ];
  }

  // 7. Cronograma de Ações
  const { data: acoesCronRaw } = await (supabase.from as any)("pcmso_cronograma_acoes")
    .select("*")
    .eq("pcmso_id", pcmsoId)
    .order("data_planejada", { ascending: true });

  const cronograma: PcmsoAcaoCronogramaItem[] = (acoesCronRaw && acoesCronRaw.length > 0)
    ? acoesCronRaw.map((a: any) => ({
        id: a.id,
        acao: a.acao,
        responsavel: a.responsavel || "Direção da empresa",
        data_planejada: a.data_planejada,
        status: a.status || "Planejado",
        observacoes: a.observacoes,
      }))
    : [
        {
          id: "cr1",
          acao: "Aprovação do Programa",
          responsavel: "Direção da empresa",
          data_planejada: pcmso.data_vigencia_inicio,
          status: "Concluído",
          observacoes: "Verificar condições de exequibilidade do Programa.",
        },
        {
          id: "cr2",
          acao: "Contratar empresa para elaboração e gestão do Programa",
          responsavel: "Direção da empresa",
          data_planejada: pcmso.data_vigencia_inicio,
          status: "Concluído",
          observacoes: "Atendimento às determinações da Norma Regulamentadora NR-07.",
        },
        {
          id: "cr3",
          acao: "Realizar o Atestado de Saúde Ocupacional (ASO) periódico",
          responsavel: "Clínica de Medicina do Trabalho / Direção",
          data_planejada: pcmso.data_vigencia_fim,
          status: "Em andamento",
          observacoes: "Direcionar colaboradores aos exames periódicos em clínica credenciada.",
        },
        {
          id: "cr4",
          acao: "Levantar as informações para elaboração do Relatório Anual",
          responsavel: "Médico Coordenador / Direção",
          data_planejada: pcmso.data_vigencia_fim,
          status: "Planejado",
          observacoes: "Balanço estatístico das avaliações e emissões de ASO.",
        },
      ];

  // 8. Estatísticas dos ASOs da empresa para o Relatório Analítico
  const { data: asosData } = await (supabase.from as any)("asos")
    .select("tipo_exame, status_aptidao, status")
    .eq("empresa_id", empresaId)
    .neq("status", "cancelado");

  const asosList = (asosData || []) as any[];
  const estatisticasAsos = {
    total: asosList.length,
    aptos: asosList.filter((a) => a.status_aptidao === "apto").length,
    restricoes: asosList.filter((a) => a.status_aptidao === "apto_restricao").length,
    inaptos: asosList.filter((a) => a.status_aptidao === "inapto").length,
    admissional: asosList.filter((a) => a.tipo_exame === "admissional").length,
    periodico: asosList.filter((a) => a.tipo_exame === "periodico").length,
    demissional: asosList.filter((a) => a.tipo_exame === "demissional").length,
    retorno: asosList.filter((a) => a.tipo_exame === "retorno").length,
    mudanca: asosList.filter((a) => a.tipo_exame === "mudanca_risco").length,
  };

  // 9. Logos
  const [emissorLogoDataUrl, empresaLogoDataUrl] = await Promise.all([
    emissor?.logo_url ? carregarLogoDataUrl(emissor.logo_url) : Promise.resolve(null),
    empresaFormatada.logo_url ? carregarLogoDataUrl(empresaFormatada.logo_url) : Promise.resolve(null),
  ]);

  return {
    pcmso,
    empresa: empresaFormatada,
    emissor,
    emissorLogoDataUrl,
    empresaLogoDataUrl,
    medicoCoordenador: medicoCoord,
    medicosExaminadores,
    ambientes,
    cargos,
    cronograma,
    relatorioAnaliticoTexto: pcmso.relatorio_analitico || "",
    estatisticasAsos,
  };
}
