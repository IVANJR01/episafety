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

export interface PcmsoRiscoTabelaG91 {
  agente: string;
  fonte: string;
  danos: string;
  meioPropagacao: string;
  formaExposicao: string;
}

export interface PcmsoFichaExameG91 {
  numero: string;
  setor: string;
  funcoes: string[];
  riscosFisicos: PcmsoRiscoTabelaG91[];
  riscosQuimicos: PcmsoRiscoTabelaG91[];
  riscosBiologicos: PcmsoRiscoTabelaG91[];
  riscosErgonomicos: PcmsoRiscoTabelaG91[];
  riscosAcidentes: PcmsoRiscoTabelaG91[];
  exames: {
    codigo: string;
    nome: string;
    adm: string;
    periodico: string;
    rt: string;
    mdf: string;
    dem: string;
  }[];
}

export interface PcmsoQuadroLaboralItem {
  fichaNumero: string;
  setor: string;
  funcoes: string[];
}

export interface PcmsoAtividadeItem {
  setor: string;
  funcao: string;
  descricao: string;
}

export interface PcmsoPdfContext {
  pcmso: any;
  empresa: {
    id: string;
    nome: string;
    nome_fantasia?: string | null;
    cnpj?: string | null;
    cnae_principal?: string | null;
    /** Os CNAE secundários, já em texto. O nome é herdado; o conteúdo é este. */
    cnae_descricao?: string | null;
    cnae_secundario?: string | null;
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
  fichasExame: PcmsoFichaExameG91[];
  quadroLaboral: PcmsoQuadroLaboralItem[];
  atividadesLista: PcmsoAtividadeItem[];
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
    /*
     * Secundários separados do principal. Juntos no mesmo campo, o documento
     * saía "14.12-6-01 - 14.12-6-03;47.55-5-01;47.55-5-02" — e quem lê não tem
     * como saber onde termina um e começa o outro.
     */
    cnae_descricao: empData.cnae_secundario || null,
    cnae_secundario: Array.isArray(empData.cnae_secundario)
      ? empData.cnae_secundario.filter(Boolean).join("; ")
      : (empData.cnae_secundario || null),
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
  const [funcoesRaw, ghesData, gheFuncoesData, inventarioRaw, setoresRaw] = await Promise.all([
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
    /*
     * Os setores, para traduzir o `setor_id` da função em NOME.
     *
     * A função guarda o id; sem esta consulta, o documento imprimia o id como
     * se fosse o nome do setor — saiu assim de verdade: "01 — SETOR:
     * 04F209F2-F0FF-4264-AC84-4E80AA1C57A2".
     */
    (supabase.from as any)("sst_setores")
      .select("id, nome")
      .eq("empresa_id", empresaId),
  ]);

  /** setor_id -> nome do setor. */
  const nomeDoSetor = new Map<string, string>();
  for (const st of (setoresRaw?.data || []) as any[]) {
    if (st?.id && (st.nome || "").trim()) nomeDoSetor.set(st.id, String(st.nome).trim());
  }

  const funcoesList = (funcoesRaw.data || []) as any[];
  const invItens = (inventarioRaw.data || []) as any[];

  // Montagem estruturada dos cargos com base no inventário e funções cadastradas
  let cargos: PcmsoCargoItem[] = [];

  if (funcoesList.length > 0) {
    /*
     * Um cargo por NOME **E SETOR**, não por nome.
     *
     * "Ajudante de Confecção" está cadastrado sete vezes nesta empresa — uma
     * em cada setor: SEPARAÇÃO, ALMOXARIFADO, COMERCIAL, CORTE, COSTURA,
     * EMBALAGEM/EXPEDIÇÃO e PCP. Agrupando só pelo nome, os sete viravam um
     * cargo só, que recolhia os riscos dos SETE setores e caía numa ficha
     * única: a ficha do CORTE saía com seis riscos ergonômicos e quatro de
     * acidentes, enquanto o PGR dá ao CORTE um único risco de acidente.
     *
     * Mesma função em setores diferentes é exposição diferente — é o que o
     * GES do PGR separa, e o PCMSO tem de separar igual.
     */
    const mapaCargos = new Map<string, any[]>();
    for (const fn of funcoesList) {
      const nomeNorm = (fn.nome || "").trim().toUpperCase().replace(/\s+/g, " ");
      if (!nomeNorm) continue;
      const setorDaFuncao = (nomeDoSetor.get(fn.setor_id) || "").trim().toUpperCase();
      const chave = `${nomeNorm}@@${setorDaFuncao}`;
      const arr = mapaCargos.get(chave) || [];
      arr.push(fn);
      mapaCargos.set(chave, arr);
    }

    cargos = Array.from(mapaCargos.entries()).map(([chaveCargo, funcoesDoGrupo]) => {
      const [nomeCargo, setorDoCargo] = chaveCargo.split("@@");
      const nomeNorm = nomeCargo.toLowerCase();
      const setorNorm = (setorDoCargo || "").toLowerCase();

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

      /*
       * Sem descrição cadastrada, a descrição fica VAZIA.
       *
       * Havia aqui um texto por palavra no nome do cargo: quem não cadastrasse
       * a rotina da costureira recebia "Operar máquinas de costura, acabamento
       * de peças, movimentação manual de tecidos" — uma descrição do trabalho
       * de outra pessoa, impressa como se fosse o da empresa dela. E a
       * descrição das atividades é o que fundamenta o enquadramento de risco.
       *
       * Vazio aparece como "Não informado" e mostra o que falta cadastrar.
       */


      // Mapear riscos do inventário do PGR correspondentes à função
      /*
       * Os itens do inventário DESTE cargo.
       *
       * A comparação é exata, nome por nome. Era por "contém" sobre a lista
       * inteira de funções juntas num texto só, e aí "AJUDANTE" casava com
       * "AJUDANTE DE CONFECÇÃO": o cargo herdava riscos de outro cargo e o
       * PCMSO somava exposições que o PGR não dá àquela função.
       *
       * A reserva pelo SETOR também é exata: antes "COSTURA" casava com
       * "COSTURA E ACABAMENTO" e com qualquer setor que a contivesse.
       */
      const igual = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
      const riscosDoCargo = invItens.filter((it: any) => {
        const funcoesDoItem = Array.isArray(it.funcoes_snapshot)
          ? it.funcoes_snapshot.map(igual)
          : [];
        const temAFuncao = funcoesDoItem.includes(nomeNorm);
        /*
         * E o item tem de ser DO MESMO SETOR do cargo. Sem esta parte, o
         * "Ajudante de Confecção do CORTE" levava para a ficha do corte os
         * riscos que o PGR deu ao ajudante da COSTURA, do PCP e dos outros
         * cinco setores onde a mesma função existe.
         *
         * Cargo sem setor cadastrado não tem com que comparar: aí vale só a
         * função, como antes.
         */
        if (!setorNorm) return temAFuncao || igual(it.setor) === nomeNorm;
        return temAFuncao && igual(it.setor) === setorNorm;
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
      /*
       * Texto de célula: sem quebra de linha e sem espaço sobrando. A quebra
       * vinda do cadastro empurrava a linha da tabela para uma altura que o
       * cálculo da página não previa.
       */
      const textoCurto = (v: unknown): string =>
        v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim();

      const riscosErgonomicosRaw: any[] = [];
      const riscosQuimicosRaw: any[] = [];
      const riscosFisicosRaw: any[] = [];
      const riscosBiologicosRaw: any[] = [];

      riscosDoCargo.forEach((r: any) => {
        const grupo = (r.grupo || "").toLowerCase();
        const obj = {
          agente: r.tipo_agente || r.perigo_descricao || "Agente identificado",
          /*
           * Fonte geradora é "máquina de costura", "produto de limpeza" — o que
           * ORIGINA o risco. Faltando o campo, o código caía no texto do
           * processo, e a coluna recebia o parágrafo inteiro da atividade: no
           * PCMSO emitido em 10/2026 havia células de quinze linhas descrevendo
           * a rotina de limpeza como "fonte geradora" do piso molhado.
           *
           * Sem o dado, a coluna diz que falta. Encher com o texto errado é
           * pior: esconde a lacuna e ainda compromete a leitura do documento.
           */
          fonte: textoCurto(r.fonte_geradora) || "Não informado",
          metodologia: "Critério Qualitativo.",
          /* Vem como lista no banco; juntar evita o "a,b,c" grudado. */
          medidas: Array.isArray(r.controles_existentes)
            ? r.controles_existentes.filter(Boolean).join("; ") || "Treinamento e medidas administrativas"
            : (textoCurto(r.controles_existentes) || "Treinamento e medidas administrativas"),
          danos: textoCurto(r.lesoes) || "Possíveis danos à saúde e integridade física",
        };
        if (grupo.includes("acid") || grupo.includes("mecan")) riscosAcidentesRaw.push(obj);
        else if (grupo.includes("ergo")) riscosErgonomicosRaw.push(obj);
        else if (grupo.includes("quim")) riscosQuimicosRaw.push(obj);
        else if (grupo.includes("fisi")) riscosFisicosRaw.push(obj);
        else if (grupo.includes("biol")) riscosBiologicosRaw.push(obj);
      });

      /*
       * O PGR é a fonte. O PCMSO não acrescenta risco nenhum.
       *
       * Havia aqui três blocos que INJETAVAM riscos quando o inventário não
       * trazia nenhum daquele grupo, escolhidos por palavra no nome do cargo:
       * "costureira" ganhava "Cortes / Perfurações — Máquinas de costura",
       * "escritório" ganhava "Sobrecarga / Pressão por prazos", "limpeza"
       * ganhava "Produtos de limpeza". Nenhum deles existia no PGR da empresa.
       *
       * Era por isso que o PCMSO saía com MAIS riscos que o PGR da mesma
       * empresa — e um documento médico que afirma exposição que o inventário
       * não reconhece contradiz o documento que deveria refletir.
       *
       * Grupo sem risco no inventário sai como "Ausência de Fator de Risco",
       * que é o que a tabela já escreve quando a lista vem vazia. Se o risco
       * existe e não está no PGR, o lugar de corrigir é o inventário.
       */

      /*
       * Exame complementar sai do RISCO, não do nome do cargo.
       *
       * Antes era por palavra: "cozinh" ganhava Glicemia e Hemograma,
       * "limpeza" ganhava Hemograma, "corte" ganhava Audiometria. Prescrever
       * exame pelo texto do cargo não é critério médico — e o cargo CORTADOR
       * recebia audiometria mesmo sem ruído nenhum no inventário, enquanto
       * quem tem ruído e não se chama "corte" não recebia.
       *
       * Fica só a regra que a norma amarra ao risco: exposição a RUÍDO exige
       * audiometria (NR-07, Anexo II). Ela sai do inventário do PGR, que é a
       * fonte — mesma regra do resto do documento.
       *
       * Qualquer outro exame é decisão do médico coordenador. Se a consultoria
       * quiser um protocolo fixo por função, o lugar dele é o cadastro, não o
       * código: assim o médico vê, revisa e assina o que prescreveu.
       */
      const examesComp: PcmsoCargoItem["examesComplementares"] = [];
      const temRuido = riscosDoCargo.some((it: any) => {
        const texto = `${it.tipo_agente || ""} ${it.perigo_descricao || ""}`
          .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return texto.includes("ruido");
      });
      if (temRuido) {
        examesComp.push({
          nome: "Audiometria Tonal e Vocal",
          codigoEsocial: "0281",
          /* Anexo II, item 4.1: na admissão, anualmente e na demissão. */
          periodicidade: "Admissional, anual e demissional (NR-07, Anexo II, item 4.1)",
          fazerAdmissional: true,
          fazerPeriodico: true,
          /*
           * A demissional faltava. O Anexo II a exige na alínea "c", e a 4.1.1
           * ainda aceita exame feito até 120 dias antes do fim do contrato.
           */
          fazerDemissional: true,
        });
      }

      return {
        id: funcoesDoGrupo[0].id,
        nome: nomeCargo,
        /*
         * NOME do setor, nunca o id. A função guarda `setor_id`; passar o id
         * adiante fazia o PCMSO imprimir um UUID no cabeçalho da ficha.
         * Sem setor cadastrado fica vazio, e as palavras-chave de
         * `mapearSetorCanonico` decidem — que é o caso em que elas servem.
         */
        setor: setorDoCargo || "",
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
  }

  /*
   * Empresa sem função cadastrada gera um PCMSO SEM fichas.
   *
   * Havia aqui uma lista fixa de cargos e riscos, copiada de um documento
   * modelo: AJUDANTE, COSTUREIRA, CORTADOR, com "Cortes / Partes móveis —
   * Máquinas de corte" e companhia. Qualquer empresa sem cadastro recebia um
   * PCMSO descrevendo uma confecção que não é a dela — assinado por um médico
   * e entregue a uma fiscalização.
   *
   * Documento vazio mostra que falta cadastrar. Documento inventado parece
   * pronto, e é o erro que ninguém percebe a tempo.
   */

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

  // 10. Geração das Fichas de Exame no padrão da G91
  /*
   * Em que ficha cada cargo entra.
   *
   * REGRA: manda o SETOR CADASTRADO. Antes mandava uma lista de palavras-chave
   * e tudo que não casasse caía em "ADMINISTRAÇÃO E GESTÃO" — o PCMSO saía com
   * 6 setores inventados pelo código enquanto o PGR da mesma empresa tinha 13
   * GES cadastrados. Dois documentos contando histórias diferentes da mesma
   * empresa é o que uma fiscalização encontra primeiro.
   *
   * O estrago era concreto: CORTADOR não ia para CORTE porque a palavra
   * procurada era "corte" e o cargo é "cortador" — ia para a Administração,
   * levando junto o risco "Cortes / Perfurações — Máquinas de costura". O
   * setor administrativo aparecia com máquina de costura e amputação.
   *
   * As palavras-chave ficam só para o cargo SEM setor cadastrado: aí não há de
   * onde tirar a resposta, e um palpite declarado é melhor que jogar tudo no
   * administrativo.
   */
  const mapearSetorCanonico = (nome: string, setorOriginal?: string | null): string => {
    const cadastrado = (setorOriginal || "").trim();
    /*
     * Id nunca é nome.
     *
     * O PCMSO v1_4 saiu com "01 — SETOR: 04F209F2-F0FF-4264-AC84-..." porque o
     * campo trazia o `setor_id` e esta função o aceitou como nome. A tradução
     * para nome foi corrigida na origem; esta trava fica porque o documento
     * NÃO PODE imprimir um identificador interno, venha ele de onde vier.
     */
    const PARECE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (cadastrado && !PARECE_ID.test(cadastrado)) return cadastrado.toUpperCase();

    const s = ((setorOriginal || "") + " " + nome).toLowerCase();
    if (s.includes("cozinh") || s.includes("alimento") || s.includes("refei")) return "COZINHA";
    if (s.includes("limpeza") || s.includes("serviços gerais") || s.includes("faxin") || s.includes("higien")) return "LIMPEZA E HIGIENIZAÇÃO";
    if (s.includes("corte") || s.includes("enfesto")) return "CORTE";
    if (s.includes("costur") || s.includes("pilotag") || s.includes("acabamento")) return "COSTURA";
    if (s.includes("embal") || s.includes("expedi") || s.includes("almoxarif") || s.includes("separ")) return "SEPARAÇÃO, ALMOXARIFADO E EXPEDIÇÃO";
    if (s.includes("loja") || s.includes("comercial") || s.includes("venda") || s.includes("atend") || s.includes("caixa") || s.includes("market") || s.includes("foto") || s.includes("design")) return "COMERCIAL E ATENDIMENTO";
    return "ADMINISTRAÇÃO E GESTÃO";
  };

  const gruposFichas = new Map<string, PcmsoCargoItem[]>();
  cargos.forEach((c) => {
    const setorCan = mapearSetorCanonico(c.nome, c.setor);
    const arr = gruposFichas.get(setorCan) || [];
    arr.push(c);
    gruposFichas.set(setorCan, arr);
  });

  /*
   * Ordem das fichas. Os setores que o sistema já conhecia vêm primeiro, na
   * ordem de sempre; os que vêm do cadastro da empresa seguem em ordem
   * alfabética. Assim o documento não reordena sozinho de uma emissão para
   * outra, e nenhum setor cadastrado fica de fora por não estar nesta lista.
   */
  const ordemSetores = [
    "ADMINISTRAÇÃO E GESTÃO",
    "COMERCIAL E ATENDIMENTO",
    "CORTE",
    "COSTURA",
    "SEPARAÇÃO, ALMOXARIFADO E EXPEDIÇÃO",
    "COZINHA",
    "LIMPEZA E HIGIENIZAÇÃO",
  ];

  const setoresOrdenados = Array.from(gruposFichas.keys()).sort((a, b) => {
    const ia = ordemSetores.indexOf(a);
    const ib = ordemSetores.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  const ausenteObj = {
    agente: "Ausência de Fator de Risco",
    fonte: "Não se aplica",
    danos: "Não se aplica",
    meioPropagacao: "Não se aplica",
    formaExposicao: "Não se aplica",
  };

  const fichasExame: PcmsoFichaExameG91[] = setoresOrdenados.map((nomeSetor, idx) => {
    const numFicha = String(idx + 1).padStart(2, "0");
    const cargosDoGrupo = gruposFichas.get(nomeSetor) || [];
    const funcoesNomes = Array.from(new Set(cargosDoGrupo.map((c) => c.nome.toUpperCase())));

    const consolidar = (tipo: "riscosFisicos" | "riscosQuimicos" | "riscosBiologicos" | "riscosErgonomicos" | "riscosAcidentes") => {
      const todos = cargosDoGrupo.flatMap((c) => c[tipo] || []);
      const vistos = new Set<string>();
      const resultado: PcmsoRiscoTabelaG91[] = [];
      todos.forEach((r) => {
        const k = (r.agente || "").toLowerCase().trim();
        if (!vistos.has(k)) {
          vistos.add(k);
          resultado.push({
            agente: r.agente,
            fonte: r.fonte,
            danos: r.danos,
            meioPropagacao: tipo === "riscosQuimicos" || tipo === "riscosBiologicos" ? "Ar / Contato dérmico" : "Não se aplica",
            formaExposicao: "Habitual / Intermitente",
          });
        }
      });
      return resultado.length > 0 ? resultado : [ausenteObj];
    };

    /*
     * Periodicidade do exame clínico — NR-07, item 7.5.8, inciso II.
     *
     * "a) para empregados expostos a riscos ocupacionais identificados e
     * classificados no PGR (...) a cada ano"; "b) para os demais empregados, o
     * exame clínico deve ser realizado a cada dois anos."
     *
     * A ficha dizia "Anual" para todo setor, inclusive os que saem com
     * "Ausência de Fator de Risco" em todos os cinco grupos — contradizendo a
     * seção 08 do próprio documento, que transcreve a regra bienal.
     */
    const temRiscoReal = (["riscosFisicos", "riscosQuimicos", "riscosBiologicos",
      "riscosErgonomicos", "riscosAcidentes"] as const)
      .some((t) => consolidar(t).some((r) => r.agente !== ausenteObj.agente));

    const examesFicha = [
      {
        codigo: "0295",
        nome: "Avaliação Clínica Ocupacional (Anamnese e Exame físico)",
        adm: "Sim",
        periodico: temRiscoReal ? "Anual" : "Bienal",
        rt: "Sim",
        mdf: "*",
        dem: "Sim",
      },
    ];

    /*
     * Exames complementares da ficha: os dos CARGOS que ela reúne, que por sua
     * vez saem do risco inventariado no PGR.
     *
     * Eram escolhidos pelo NOME DO SETOR: "COZINHA" ganhava Glicemia e
     * Hemograma, "LIMPEZA E HIGIENIZAÇÃO" ganhava Hemograma, "CORTE" ganhava
     * Audiometria. Mesmo defeito que já havia sido tirado no nível do cargo —
     * prescrição por texto, não por exposição. E o setor CORTE recebia
     * audiometria mesmo sem uma única medição de ruído no inventário.
     */
    const vistosExames = new Set<string>();
    cargosDoGrupo.forEach((c) => {
      (c.examesComplementares || []).forEach((ex) => {
        if (vistosExames.has(ex.codigoEsocial)) return;
        vistosExames.add(ex.codigoEsocial);
        examesFicha.push({
          codigo: ex.codigoEsocial,
          nome: ex.nome,
          adm: ex.fazerAdmissional ? "Sim" : "—",
          periodico: ex.periodicidade?.toLowerCase().includes("anual") ? "Anual" : "—",
          rt: ex.fazerRetorno ? "Sim" : "—",
          mdf: ex.fazerMudanca ? "Sim" : "—",
          dem: ex.fazerDemissional ? "Sim" : "—",
        });
      });
    });

    return {
      numero: numFicha,
      setor: nomeSetor,
      funcoes: funcoesNomes,
      riscosFisicos: consolidar("riscosFisicos"),
      riscosQuimicos: consolidar("riscosQuimicos"),
      riscosBiologicos: consolidar("riscosBiologicos"),
      riscosErgonomicos: consolidar("riscosErgonomicos"),
      riscosAcidentes: consolidar("riscosAcidentes"),
      exames: examesFicha,
    };
  });

  const quadroLaboral: PcmsoQuadroLaboralItem[] = fichasExame.map((f) => ({
    fichaNumero: f.numero,
    setor: f.setor,
    funcoes: f.funcoes,
  }));

  const atividadesLista: PcmsoAtividadeItem[] = cargos.map((c) => ({
    setor: mapearSetorCanonico(c.nome, c.setor),
    funcao: c.nome.toUpperCase(),
    descricao: c.atividades,
  })).sort((a, b) => a.setor.localeCompare(b.setor) || a.funcao.localeCompare(b.funcao));

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
    fichasExame,
    quadroLaboral,
    atividadesLista,
    cronograma,
    relatorioAnaliticoTexto: pcmso.relatorio_analitico || "",
    estatisticasAsos,
  };
}
