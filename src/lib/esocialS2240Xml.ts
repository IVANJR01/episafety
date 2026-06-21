// ============================================================================
// eSocial S-2240 — Geração + Validação local (STUB)
// ----------------------------------------------------------------------------
// NÃO transmite ao Ambiente Nacional, NÃO assina ICP-Brasil,
// NÃO gera recibo/protocolo reais. Apenas validação técnica interna.
// XML salvo em Google Drive BYOK; banco guarda só metadados/hash.
// ============================================================================
import { supabase } from "@/integrations/supabase/client";
import { uploadToDrive } from "@/lib/googleDriveStorage";

export const ESOCIAL_S2240_AVISO =
  "XML gerado apenas para validação técnica. Não enviado ao Ambiente Nacional.";
export const ESOCIAL_S2240_VERSAO_LAYOUT = "S-1.3";

// ---------- Drive download (XML completo nunca é gravado no banco) ----------
async function getDriveAccessToken(folder: string): Promise<string> {
  await supabase.auth.refreshSession();
  const { data, error } = await supabase.functions.invoke("gdrive-token", { body: { folder } });
  if (error) throw new Error(error.message || "Falha ao obter token Drive");
  if (!data?.accessToken) throw new Error("Token Drive ausente");
  return data.accessToken as string;
}
export async function downloadXmlFromDrive(fileId: string, pppId: string): Promise<string> {
  const token = await getDriveAccessToken(`eSocial/S2240/${pppId}`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Drive ${res.status}: não foi possível baixar o XML`);
  return await res.text();
}


export type OcorrenciaTipo = "erro" | "alerta";
export interface Ocorrencia {
  tipo: OcorrenciaTipo;
  codigo: string;
  campo?: string;
  mensagem: string;
}

// ---------- helpers ----------
const esc = (v: any) =>
  v === null || v === undefined
    ? ""
    : String(v)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const onlyDigits = (v: string | null | undefined) => (v || "").replace(/\D+/g, "");
const isDateISO = (v: any) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function isValidCpf(cpf: string | null | undefined): boolean {
  const d = onlyDigits(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(d[i]) * (10 - i);
  let r = (s * 10) % 11; if (r === 10) r = 0;
  if (r !== parseInt(d[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(d[i]) * (11 - i);
  r = (s * 10) % 11; if (r === 10) r = 0;
  return r === parseInt(d[10]);
}
export function isValidCnpj(cnpj: string | null | undefined): boolean {
  const d = onlyDigits(cnpj);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number) => {
    const w = len === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    let s = 0; for (let i=0;i<len;i++) s += parseInt(d[i])*w[i];
    const r = s % 11; return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === parseInt(d[12]) && calc(13) === parseInt(d[13]);
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================================
// Tipos de entrada do builder
// ============================================================================
export interface S2240BuildInput {
  ppp: any;
  periodo: any;
  funcionario: { nome: string; cpf: string | null; matricula: string | null };
  empresa: { id: string; nome: string | null; cnpj: string | null };
  responsavelAmbiental: { nome: string; registro_profissional?: string | null } | null;
  ltcat: { id: string; versao?: string | null } | null;
  exposicoes: Array<{
    id: string;
    agente_nome: string;
    intensidade: number | null;
    unidade_medida: string | null;
    limite_tolerancia: number | null;
    tecnica: string | null;
    tempo_exposicao_horas: number | null;
    epi_descricao: string | null;
    epi_ca: string | null;
    epi_eficacia: string | null;
    epc_descricao: string | null;
    codigo_esocial: string | null;
    map_codigo_t24: string | null;
    map_status: "mapeado" | "pendente" | "divergente";
    t24_apos_especial: boolean;
    t24_tipo_aval: string | null;
    t24_unidade: string | null;
  }>;
}

// ============================================================================
// Coleta a partir de evento + PPP/periodo (server-side via supabase queries)
// ============================================================================
async function coletarInput(eventoId: string): Promise<S2240BuildInput> {
  const { data: evento } = await (supabase.from as any)("esocial_eventos_s2240")
    .select("*").eq("id", eventoId).maybeSingle();
  if (!evento) throw new Error("Evento S-2240 não encontrado ou fora do escopo");

  const { data: ppp } = await (supabase.from as any)("ppp_documentos")
    .select("*").eq("id", evento.ppp_documento_id).maybeSingle();
  if (!ppp) throw new Error("PPP de origem não encontrado");
  if (ppp.empresa_id !== evento.empresa_id) throw new Error("PPP fora do tenant do evento");

  const { data: periodo } = await (supabase.from as any)("ppp_periodos")
    .select("*").eq("id", evento.ppp_periodo_id).maybeSingle();
  if (!periodo) throw new Error("Período PPP não encontrado");
  if (periodo.ppp_id !== ppp.id) throw new Error("Período não pertence ao PPP");

  const { data: funcionario } = await (supabase.from as any)("funcionarios")
    .select("nome, cpf, matricula, empresa_id").eq("id", ppp.funcionario_id).maybeSingle();
  if (!funcionario) throw new Error("Funcionário do PPP não encontrado");
  if (funcionario.empresa_id !== evento.empresa_id)
    throw new Error("Funcionário não pertence à empresa do evento");

  const { data: empresa } = await (supabase.from as any)("empresa_config")
    .select("id, nome, cnpj").eq("id", evento.empresa_id).maybeSingle();

  const { data: respAmb } = await (supabase.from as any)("ppp_responsaveis_ambientais")
    .select("nome, registro_profissional, periodo_id").eq("ppp_id", ppp.id)
    .order("created_at", { ascending: true });
  const responsavel =
    (respAmb || []).find((r: any) => r.periodo_id === periodo.id) ||
    (respAmb || [])[0] || null;

  const ltcat = periodo.ltcat_id
    ? await (supabase.from as any)("ltcat_documentos")
        .select("id, versao").eq("id", periodo.ltcat_id).maybeSingle()
        .then((r: any) => r.data)
    : null;

  const { data: exps = [] } = await (supabase.from as any)("ppp_exposicoes")
    .select("*").eq("periodo_id", periodo.id);

  const { data: maps = [] } = await (supabase.from as any)("esocial_s2240_mapeamentos")
    .select("agente_nome, codigo_t24, status, aposentadoria_especial, tipo_avaliacao_esperado, unidade_medida_padrao")
    .eq("empresa_id", evento.empresa_id);

  const norm = (s: string) => (s || "").trim().toLowerCase();
  const mapByName = new Map<string, any>();
  for (const m of maps) mapByName.set(norm(m.agente_nome), m);

  const exposicoes = (exps as any[]).map((e: any) => {
    const m = mapByName.get(norm(e.agente_nome));
    return {
      id: e.id,
      agente_nome: e.agente_nome,
      intensidade: e.intensidade,
      unidade_medida: e.unidade_medida,
      limite_tolerancia: e.limite_tolerancia,
      tecnica: e.tecnica,
      tempo_exposicao_horas: e.tempo_exposicao_horas,
      epi_descricao: e.epi_descricao,
      epi_ca: e.epi_ca,
      epi_eficacia: e.epi_eficacia,
      epc_descricao: e.epc_descricao,
      codigo_esocial: e.codigo_esocial,
      map_codigo_t24: m?.codigo_t24 || e.codigo_esocial || null,
      map_status: (m?.status as any) || (e.codigo_esocial ? "mapeado" : "pendente"),
      t24_apos_especial: !!m?.aposentadoria_especial,
      t24_tipo_aval: m?.tipo_avaliacao_esperado || null,
      t24_unidade: m?.unidade_medida_padrao || null,
    };
  });

  return {
    ppp, periodo, funcionario,
    empresa: { id: empresa?.id || evento.empresa_id, nome: empresa?.nome || null, cnpj: empresa?.cnpj || null },
    responsavelAmbiental: responsavel ? { nome: responsavel.nome, registro_profissional: responsavel.registro_profissional } : null,
    ltcat: ltcat ? { id: ltcat.id, versao: ltcat.versao } : null,
    exposicoes,
  };
}

// ============================================================================
// Validação local
// ============================================================================
export function validarS2240(input: S2240BuildInput): Ocorrencia[] {
  const out: Ocorrencia[] = [];
  const E = (codigo: string, campo: string, mensagem: string) =>
    out.push({ tipo: "erro", codigo, campo, mensagem });
  const W = (codigo: string, campo: string, mensagem: string) =>
    out.push({ tipo: "alerta", codigo, campo, mensagem });

  const { ppp, periodo, funcionario, empresa, exposicoes, responsavelAmbiental } = input;
  if (!ppp) E("PPP-000", "ppp", "PPP de origem ausente");
  if (!periodo) E("PER-000", "periodo", "Período PPP ausente");
  if (!funcionario?.cpf || !isValidCpf(funcionario.cpf)) E("DOC-CPF", "cpfTrab", "CPF do trabalhador inválido");
  if (!funcionario?.matricula) W("VINC-MAT", "matricula", "Matrícula não informada");
  if (!empresa?.cnpj || !isValidCnpj(empresa.cnpj)) E("DOC-CNPJ", "nrInsc", "CNPJ do empregador inválido");
  if (!periodo?.cbo) E("CBO-OBR", "cbo", "CBO obrigatório no período laboral");
  if (!periodo?.data_inicio || !isDateISO(periodo.data_inicio)) E("PER-INI", "dtIniCondicao", "Data de início do período inválida");
  if (periodo?.data_fim && !isDateISO(periodo.data_fim)) E("PER-FIM", "dtFimCondicao", "Data de fim inválida");

  if (!exposicoes.length) {
    W("AG-VAZ", "agentesNocivos", "Nenhuma exposição vinculada ao período — XML será emitido sem agentes (revise).");
  }

  for (const ex of exposicoes) {
    if (!ex.map_codigo_t24) E("MAP-T24", "codAgNoc", `Agente '${ex.agente_nome}' sem código Tabela 24 mapeado`);
    if (ex.map_status === "divergente") E("MAP-DIV", "codAgNoc", `Agente '${ex.agente_nome}' com mapeamento divergente`);
    if (!ex.tecnica) W("TEC-AVA", "tecMedicao", `Agente '${ex.agente_nome}' sem técnica de avaliação`);
    const requerIntensidade = !!ex.t24_unidade || (ex.t24_tipo_aval === "quantitativa");
    if (requerIntensidade && (ex.intensidade === null || ex.intensidade === undefined))
      W("INT-OBR", "intConc", `Agente '${ex.agente_nome}' sem intensidade/concentração`);
    if (ex.epi_descricao && ex.epi_eficacia === null)
      W("EPI-EFI", "epcEpiEfic", `EPI informado para '${ex.agente_nome}' sem indicação de eficácia`);
  }

  if (!responsavelAmbiental?.nome) W("RT-AMB", "respReg", "Responsável técnico ambiental não informado no PPP");

  return out;
}

// ============================================================================
// Builder do XML técnico/stub
// ============================================================================
export function buildS2240Xml(input: S2240BuildInput): { xml: string; idEvento: string; warnings: string[] } {
  const { ppp, periodo, funcionario, empresa, exposicoes, responsavelAmbiental, ltcat } = input;
  const cnpj14 = onlyDigits(empresa.cnpj || "").padStart(14, "0").slice(0, 14);
  const cpf11 = onlyDigits(funcionario.cpf || "").padStart(11, "0").slice(0, 11);
  const tpAmbN = 2; // 2 = homologação por padrão (stub)

  const now = new Date();
  const ts =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 100000)).padStart(5, "0");
  const idEvento = `ID${tpAmbN}${cnpj14}${ts}${seq}`;

  const warnings: string[] = [];
  for (const ex of exposicoes) {
    if (!ex.map_codigo_t24) warnings.push(`Tabela 24 pendente: ${ex.agente_nome}`);
    if (ex.map_status === "divergente") warnings.push(`Mapeamento divergente: ${ex.agente_nome}`);
  }

  const agentesXml = exposicoes.map((ex) => {
    const apos = ex.t24_apos_especial ? "S" : "N";
    const epi = ex.epi_descricao
      ? `<epi>
          <docAval>${esc(ex.epi_ca || "0")}</docAval>
          <epcEpiEfic>${esc(ex.epi_eficacia === "eficaz" ? "S" : "N")}</epcEpiEfic>
          <dscEpi>${esc(ex.epi_descricao)}</dscEpi>
        </epi>` : "";
    return `<agNoc>
        <codAgNoc>${esc(ex.map_codigo_t24 || "MAP-PENDENTE")}</codAgNoc>
        <dscAgNoc>${esc(ex.agente_nome)}</dscAgNoc>
        ${ex.intensidade != null ? `<intConc>${esc(ex.intensidade)}</intConc>` : ""}
        ${ex.limite_tolerancia != null ? `<limTol>${esc(ex.limite_tolerancia)}</limTol>` : ""}
        ${ex.unidade_medida ? `<unMed>${esc(ex.unidade_medida)}</unMed>` : ""}
        ${ex.tecnica ? `<tecMedicao>${esc(ex.tecnica)}</tecMedicao>` : ""}
        <utilizEPC>${ex.epc_descricao ? "1" : "0"}</utilizEPC>
        <utilizEPI>${ex.epi_descricao ? "1" : "0"}</utilizEPI>
        <aposentEsp>${apos}</aposentEsp>
        ${epi}
      </agNoc>`;
  }).join("\n      ");

  const rtAmb = responsavelAmbiental
    ? `<respReg>
        <cpfResp>00000000000</cpfResp>
        <ideOC>9</ideOC>
        <dscOC>${esc(responsavelAmbiental.registro_profissional || "—")}</dscOC>
        <nrOC>${esc(responsavelAmbiental.registro_profissional || "0")}</nrOC>
        <nmResp>${esc(responsavelAmbiental.nome)}</nmResp>
      </respReg>` : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  eSocial S-2240 (Condições Ambientais do Trabalho — Agentes Nocivos)
  STUB / VALIDAÇÃO TÉCNICA INTERNA. ${ESOCIAL_S2240_AVISO}
  PPP origem: ${esc(ppp.id)} | Período: ${esc(periodo.id)} | LTCAT: ${esc(ltcat?.id || "—")}
-->
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtExpRisco/v_S_01_03_00">
  <evtExpRisco Id="${esc(idEvento)}">
    <ideEvento>
      <indRetif>1</indRetif>
      <tpAmb>${tpAmbN}</tpAmb>
      <procEmi>1</procEmi>
      <verProc>${esc(ESOCIAL_S2240_VERSAO_LAYOUT)}-stub</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${esc(cnpj14.slice(0, 8))}</nrInsc>
    </ideEmpregador>
    <ideVinculo>
      <cpfTrab>${esc(cpf11)}</cpfTrab>
      <matricula>${esc(funcionario.matricula || "")}</matricula>
    </ideVinculo>
    <infoExpRisco>
      <dtIniCondicao>${esc(periodo.data_inicio)}</dtIniCondicao>
      ${periodo.data_fim ? `<dtFimCondicao>${esc(periodo.data_fim)}</dtFimCondicao>` : ""}
      <infoAmb>
        <localAmb>1</localAmb>
        <dscSetor>${esc(periodo.setor_nome || "—")}</dscSetor>
      </infoAmb>
      <infoAtiv>
        <dscAtivDes>${esc(periodo.descricao_atividade || ppp.descricao_atividade_consolidada || "—")}</dscAtivDes>
      </infoAtiv>
      ${agentesXml || "<!-- nenhum agente vinculado ao período -->"}
      ${rtAmb}
      ${ltcat ? `<obsCompl>LTCAT vinculado ${esc(ltcat.id)} ver. ${esc(ltcat.versao || "—")}</obsCompl>` : ""}
    </infoExpRisco>
  </evtExpRisco>
  <!-- ${ESOCIAL_S2240_AVISO} -->
</eSocial>`;

  return { xml, idEvento, warnings };
}

// ============================================================================
// Criar evento por período (idempotente: reaproveita pendente, se houver)
// ============================================================================
export async function obterOuCriarEventoS2240PorPeriodo(pppId: string, periodoId: string): Promise<string> {
  const { data: existente } = await (supabase.from as any)("esocial_eventos_s2240")
    .select("id, status").eq("ppp_documento_id", pppId).eq("ppp_periodo_id", periodoId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existente?.id) return existente.id;

  const { data: ppp } = await (supabase.from as any)("ppp_documentos")
    .select("id, empresa_id, funcionario_id").eq("id", pppId).maybeSingle();
  if (!ppp) throw new Error("PPP não encontrado");
  const { data: periodo } = await (supabase.from as any)("ppp_periodos")
    .select("id, data_inicio, data_fim, cbo, funcao_nome, ltcat_id, pgr_id")
    .eq("id", periodoId).maybeSingle();
  if (!periodo) throw new Error("Período PPP não encontrado");
  const { data: f } = await (supabase.from as any)("funcionarios")
    .select("cpf, matricula").eq("id", ppp.funcionario_id).maybeSingle();

  const { data: criado, error } = await (supabase.from as any)("esocial_eventos_s2240")
    .insert({
      empresa_id: ppp.empresa_id,
      ppp_documento_id: ppp.id,
      ppp_periodo_id: periodo.id,
      ltcat_documento_id: periodo.ltcat_id || null,
      pgr_documento_id: periodo.pgr_id || null,
      funcionario_id: ppp.funcionario_id,
      cpf_trabalhador: onlyDigits(f?.cpf || "").padStart(11, "0").slice(0, 11),
      matricula: f?.matricula || null,
      cbo: periodo.cbo || null,
      funcao: periodo.funcao_nome || null,
      tipo_evento: "inicial" as any,
      data_inicio_condicao: periodo.data_inicio,
      data_fim_condicao: periodo.data_fim,
      status: "pendente" as any,
    })
    .select("id").maybeSingle();
  if (error) throw new Error(error.message);
  return criado.id;
}

// ============================================================================
// Validar (sem gerar XML)
// ============================================================================
export async function validarEventoS2240(eventoId: string): Promise<{ erros: number; alertas: number; ocorrencias: Ocorrencia[] }> {
  const input = await coletarInput(eventoId);
  const oco = validarS2240(input);
  const erros = oco.filter((o) => o.tipo === "erro").length;
  const alertas = oco.filter((o) => o.tipo === "alerta").length;
  await (supabase.rpc as any)("s2240_registrar_ocorrencia", {
    _evento_id: eventoId,
    _tipo: "validacao_local",
    _resultado: erros > 0 ? "erro" : alertas > 0 ? "aviso" : "ok",
    _mensagens: oco as any,
    _xml_sha256: null,
    _erro_resumido: erros > 0 ? `${erros} erro(s)` : null,
  });
  await (supabase.rpc as any)("s2240_registrar_audit", {
    _action: "validar_local",
    _evento_id: eventoId,
    _ppp_id: input.ppp.id,
    _funcionario_id: input.ppp.funcionario_id,
    _hash: null,
    _status: erros > 0 ? "rejeitado_local" : "pendente",
    _metadados: { resumo: `${erros} erros / ${alertas} alertas`, agentes_total: input.exposicoes.length, pendencias_t24: input.exposicoes.filter((e) => !e.map_codigo_t24).length, erros, alertas, periodo_id: input.periodo.id },
  });
  return { erros, alertas, ocorrencias: oco };
}

// ============================================================================
// Gerar XML técnico, fazer upload Drive BYOK e gravar metadados
// ============================================================================
export async function gerarXmlS2240(eventoId: string): Promise<{
  hash: string; idEvento: string; driveId: string; driveLink: string; warnings: string[];
}> {
  const input = await coletarInput(eventoId);
  const oco = validarS2240(input);
  const erros = oco.filter((o) => o.tipo === "erro");
  if (erros.length) {
    await (supabase.rpc as any)("s2240_registrar_ocorrencia", {
      _evento_id: eventoId, _tipo: "validacao_local", _resultado: "erro",
      _mensagens: oco as any, _xml_sha256: null,
      _erro_resumido: `Bloqueado: ${erros.length} erro(s)`,
    });
    throw new Error("Validação local falhou:\n• " + erros.map((e) => e.mensagem).join("\n• "));
  }

  const { xml, idEvento, warnings } = buildS2240Xml(input);
  const hash = await sha256Hex(xml);
  const bytes = new TextEncoder().encode(xml).length;

  // Upload para Drive BYOK (privado — não tornar público)
  const folder = `eSocial/S2240/${input.ppp.id}`;
  const fileName = `S2240_${input.periodo.id.slice(0, 8)}_${hash.slice(0, 10)}.xml`;
  const blob = new Blob([xml], { type: "application/xml" });
  const up = await uploadToDrive(blob, folder, fileName, { makePublic: false });

  const { error } = await (supabase.rpc as any)("s2240_registrar_xml_meta", {
    _evento_id: eventoId,
    _xml_sha256: hash,
    _tamanho_bytes: bytes,
    _drive_id: up.fileId,
    _drive_link: up.webViewLink,
    _status: "validado_stub",
  });
  if (error) throw new Error(error.message);

  await (supabase.rpc as any)("s2240_registrar_ocorrencia", {
    _evento_id: eventoId, _tipo: "geracao_xml_stub",
    _resultado: warnings.length ? "aviso" : "ok",
    _mensagens: warnings.map((m) => ({ tipo: "alerta", codigo: "MAP", mensagem: m })),
    _xml_sha256: hash, _erro_resumido: null,
  });
  await (supabase.rpc as any)("s2240_registrar_audit", {
    _action: "gerar_xml_stub",
    _evento_id: eventoId,
    _ppp_id: input.ppp.id,
    _funcionario_id: input.ppp.funcionario_id,
    _hash: hash,
    _status: "validado_stub",
    _metadados: {
      resumo: `XML stub gerado (${bytes} bytes)`,
      agentes_total: input.exposicoes.length,
      pendencias_t24: input.exposicoes.filter((e) => !e.map_codigo_t24).length,
      drive_id: up.fileId,
      drive_link: up.webViewLink,
      versao_layout: ESOCIAL_S2240_VERSAO_LAYOUT,
      id_evento_esocial: idEvento,
      periodo_id: input.periodo.id,
    },
  });

  return { hash, idEvento, driveId: up.fileId, driveLink: up.webViewLink, warnings };
}
