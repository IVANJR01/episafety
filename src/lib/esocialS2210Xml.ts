// ============================================================================
// eSocial S-2210 — Geração + Validação local (STUB)
// ----------------------------------------------------------------------------
// NÃO transmite ao Ambiente Nacional, NÃO assina ICP-Brasil,
// NÃO gera recibo/protocolo reais. Apenas validação técnica interna.
// ============================================================================
import { supabase } from "@/integrations/supabase/client";

export const ESOCIAL_S2210_AVISO =
  "XML não assinado digitalmente. Assinatura ICP-Brasil ainda não implementada.";

export type OcorrenciaTipo = "erro" | "alerta";
export interface Ocorrencia {
  tipo: OcorrenciaTipo;
  codigo: string;
  campo?: string;
  mensagem: string;
}

export interface S2210BuildInput {
  evento: any;
  cat: any;
  funcionario: { nome: string; cpf: string | null; matricula?: string | null };
  empresa: { cnpj: string | null; razao_social?: string | null };
  municipioIbge: { codigo: string; nome: string; uf: string } | null;
  cid: { codigo: string; descricao: string } | null;
  catalogo: {
    parte_atingida?: { codigo: string; codigo_esocial?: string | null; descricao: string } | null;
    agente_causador?: { codigo: string; codigo_esocial?: string | null; descricao: string } | null;
    natureza_lesao?: { codigo: string; codigo_esocial?: string | null; descricao: string } | null;
    situacao_geradora?: { codigo: string; codigo_esocial?: string | null; descricao: string } | null;
  };
}

// ---------- helpers ----------
const esc = (v: any) =>
  v === null || v === undefined
    ? ""
    : String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const onlyDigits = (v: string | null | undefined) => (v || "").replace(/\D+/g, "");

function tpAcid(t: string): number {
  switch (t) {
    case "tipico": return 1;
    case "trajeto": return 2;
    case "doenca_ocupacional": return 3;
    default: return 1;
  }
}

// Mapeia emitente_tipo (sistema) -> iniciatCAT (eSocial Tabela 10)
// 1 empregador, 2 ordem judicial, 3 órgão fiscalizador
export function emitenteToIniciat(emitenteTipo: string | null | undefined): number {
  switch ((emitenteTipo || "").toLowerCase()) {
    case "empregador": return 1;
    case "ordem_judicial": case "autoridade_publica": return 2;
    case "orgao_fiscalizador": case "fiscalizador": return 3;
    case "sindicato": case "medico": case "segurado": case "dependente": return 1; // fallback empregador
    default: return 1;
  }
}

// ---------- validações de formato ----------
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
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === parseInt(d[12]) && calc(13) === parseInt(d[13]);
}

const isDateISO = (v: any) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isHora4 = (v: any) => /^\d{4}$/.test(String(v || ""));
const isIbge7 = (v: any) => /^\d{7}$/.test(String(v || ""));
const isCid = (v: any) => /^[A-Z]\d{2}(\.\d{1,2})?$/.test(String(v || "").toUpperCase());

// ---------- SHA-256 ----------
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- VALIDAÇÃO LOCAL COMPLETA ----------
export function validateS2210Full(input: S2210BuildInput): Ocorrencia[] {
  const out: Ocorrencia[] = [];
  const c = input.cat; const ev = input.evento;
  const E = (codigo: string, campo: string, mensagem: string) =>
    out.push({ tipo: "erro", codigo, campo, mensagem });
  const W = (codigo: string, campo: string, mensagem: string) =>
    out.push({ tipo: "alerta", codigo, campo, mensagem });

  if (!c) { E("CAT-000", "cat", "CAT inexistente"); return out; }
  if (!ev) { E("EVT-000", "evento", "Evento inexistente"); return out; }

  if (c.status === "cancelada") E("CAT-CANC", "cat.status", "CAT cancelada — XML bloqueado");

  // datas
  if (!isDateISO(c.data_acidente)) E("FMT-DT-1", "dtAcid", "Data do acidente inválida (AAAA-MM-DD)");
  if (c.obito && !isDateISO(c.data_obito)) E("FMT-DT-2", "dtObito", "Óbito exige data do óbito válida");
  if (c.houve_afastamento && !isDateISO(c.ultimo_dia_trabalhado))
    E("REG-AFAST", "ultimo_dia_trabalhado", "Afastamento exige último dia trabalhado");
  if (c.data_atendimento && !isDateISO(c.data_atendimento))
    E("FMT-DT-3", "dtAtendimento", "Data de atendimento inválida");

  // hora 4 dígitos HHMM
  const hrAcid = (c.hora_acidente || "").replace(":", "").padStart(4, "0").slice(0, 4);
  if (!isHora4(hrAcid)) E("FMT-HR-1", "hrAcid", "Hora do acidente deve ter 4 dígitos (HHMM)");

  // CPF / CNPJ
  if (!isValidCpf(input.funcionario?.cpf)) E("DOC-CPF", "cpfTrab", "CPF do funcionário inválido (checksum)");
  if (!isValidCnpj(input.empresa?.cnpj)) E("DOC-CNPJ", "nrInsc", "CNPJ do empregador inválido (esocial_config)");

  // município IBGE
  if (!input.municipioIbge?.codigo || !isIbge7(input.municipioIbge.codigo))
    E("LOC-IBGE", "codMunic", "Município IBGE com 7 dígitos é obrigatório");

  // CID-10
  if (!c.cid_codigo) E("CID-OBR", "codCID", "CID-10 obrigatório");
  else if (!isCid(c.cid_codigo)) E("CID-FMT", "codCID", "CID-10 em formato inválido");
  else if (!input.cid) W("CID-BASE", "codCID", "CID-10 não localizado na base local — confirme antes do envio");

  // CBO
  if (!c.cbo || onlyDigits(c.cbo).length < 6) E("CBO-OBR", "cbo", "CBO obrigatório (6 dígitos)");

  // Tipo / local
  if (!c.tipo_acidente) E("REG-TPACI", "tpAcid", "Tipo do acidente obrigatório");
  if (!c.local_acidente) E("REG-LOCAL", "dscLocal", "Local do acidente obrigatório");

  // retificação
  if (ev.ind_retif === "retificacao" && !ev.nr_recibo_origem)
    E("RET-REC", "nrRecibo", "Retificação exige número do recibo da origem");

  // emitente / iniciat
  const iniciat = ev.iniciat_cat ?? c.iniciat_cat ?? emitenteToIniciat(c.emitente_tipo);
  if (![1,2,3].includes(iniciat))
    E("INI-CAT", "iniciatCAT", "Iniciativa CAT inválida (esperado 1, 2 ou 3)");

  // hrs trab antes acidente — não pode ficar oculto
  if (ev.hrs_trab_antes_acid === null || ev.hrs_trab_antes_acid === undefined)
    W("HRS-TRAB", "hrsTrabAntesAcid", "hrsTrabAntesAcid não informado — preencha em Dados eSocial S-2210");

  // catálogos / tabelas oficiais
  if (!c.parte_atingida_id) E("CAT-PART", "parte_atingida", "Parte atingida obrigatória");
  else if (!input.catalogo.parte_atingida?.codigo_esocial)
    W("MAP-T13", "codParteAting", "Mapeamento Tabela 13 (parte atingida) pendente — codigo_esocial vazio");

  if (!c.agente_causador_id) E("CAT-AGEN", "agente_causador", "Agente causador obrigatório");
  else if (!input.catalogo.agente_causador?.codigo_esocial)
    W("MAP-T14", "codAgntCausador", "Mapeamento Tabela 14 (agente causador) pendente");

  if (!c.natureza_lesao_id) E("CAT-NAT", "natureza_lesao", "Natureza da lesão obrigatória");
  else if (!input.catalogo.natureza_lesao?.codigo_esocial)
    W("MAP-T15", "dscLesao", "Mapeamento Tabela 15 (natureza da lesão) pendente");

  if (c.situacao_geradora_id && !input.catalogo.situacao_geradora?.codigo_esocial)
    W("MAP-SIT", "codSitGeradora", "Mapeamento situação geradora pendente");

  return out;
}

// ---------- builder ----------
export function buildS2210Xml(input: S2210BuildInput): { xml: string; idEvento: string; warnings: string[] } {
  const { evento, cat, funcionario, empresa, municipioIbge, cid, catalogo } = input;
  const cnpj14 = onlyDigits(empresa.cnpj || "").padStart(14, "0").slice(0, 14);
  const cpf11 = onlyDigits(funcionario.cpf || "").padStart(11, "0").slice(0, 11);
  const tpAmbN = evento.tp_amb === "producao" ? 1 : 2;
  const indRetif = evento.ind_retif === "retificacao" ? 2 : 1;

  // ID evento eSocial: ID + tpInsc(1) + nrInsc(14) + AAAAMMDDHHMMSS + seq(5)
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

  const parteCod = catalogo.parte_atingida?.codigo_esocial || catalogo.parte_atingida?.codigo || "000";
  const agenteCod = catalogo.agente_causador?.codigo_esocial || catalogo.agente_causador?.codigo || "00000";
  const naturezaCod = catalogo.natureza_lesao?.codigo_esocial || catalogo.natureza_lesao?.codigo || "000";
  const situacaoCod = catalogo.situacao_geradora?.codigo_esocial || catalogo.situacao_geradora?.codigo || "000";

  const warnings: string[] = [];
  if (!catalogo.parte_atingida?.codigo_esocial) warnings.push("Tabela 13 pendente");
  if (!catalogo.agente_causador?.codigo_esocial) warnings.push("Tabela 14 pendente");
  if (!catalogo.natureza_lesao?.codigo_esocial) warnings.push("Tabela 15 pendente");

  const hrAcid = (cat.hora_acidente || "").replace(":", "").slice(0, 4).padEnd(4, "0");
  const hrsTrab = evento.hrs_trab_antes_acid != null
    ? String(evento.hrs_trab_antes_acid).padStart(4, "0")
    : "";
  const iniciat = evento.iniciat_cat ?? cat.iniciat_cat ?? emitenteToIniciat(cat.emitente_tipo);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  eSocial S-2210 (CAT) — STUB / VALIDAÇÃO TÉCNICA INTERNA
  ${ESOCIAL_S2210_AVISO}
  XML gerado apenas para validação técnica. Não enviado ao Ambiente Nacional.
-->
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtCAT/v_S_01_03_00">
  <evtCAT Id="${esc(idEvento)}">
    <ideEvento>
      <indRetif>${indRetif}</indRetif>
      ${evento.nr_recibo_origem ? `<nrRecibo>${esc(evento.nr_recibo_origem)}</nrRecibo>` : ""}
      <tpAmb>${tpAmbN}</tpAmb>
      <procEmi>1</procEmi>
      <verProc>${esc(evento.versao_layout)}-stub</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${esc(cnpj14.slice(0, 8))}</nrInsc>
    </ideEmpregador>
    <ideVinculo>
      <cpfTrab>${esc(cpf11)}</cpfTrab>
      ${funcionario.matricula ? `<matricula>${esc(funcionario.matricula)}</matricula>` : ""}
    </ideVinculo>
    <cat>
      <dtAcid>${esc(cat.data_acidente)}</dtAcid>
      <tpAcid>${tpAcid(cat.tipo_acidente)}</tpAcid>
      <hrAcid>${esc(hrAcid)}</hrAcid>
      ${hrsTrab ? `<hrsTrabAntesAcid>${esc(hrsTrab)}</hrsTrabAntesAcid>` : `<!-- hrsTrabAntesAcid: não informado -->`}
      <tpCat>${evento.ind_retif === "retificacao" ? 2 : 1}</tpCat>
      <indCatObito>${cat.obito ? "S" : "N"}</indCatObito>
      ${cat.obito && cat.data_obito ? `<dtObito>${esc(cat.data_obito)}</dtObito>` : ""}
      <indComunPolicia>N</indComunPolicia>
      <codSitGeradora>${esc(situacaoCod)}</codSitGeradora>
      <iniciatCAT>${iniciat}</iniciatCAT>
      ${cat.local_acidente ? `<obsCAT>${esc(cat.local_acidente)}</obsCAT>` : ""}
      <localAcidente>
        <tpLocal>1</tpLocal>
        <dscLocal>${esc(cat.local_acidente || "Não informado")}</dscLocal>
        <dscLograd>${esc(cat.endereco_local || "")}</dscLograd>
        <cep>${esc(onlyDigits(cat.cep))}</cep>
        <codMunic>${esc(municipioIbge?.codigo || "0000000")}</codMunic>
        <uf>${esc(municipioIbge?.uf || cat.uf || "")}</uf>
      </localAcidente>
      <parteAtingida>
        <codParteAting>${esc(parteCod)}</codParteAting>
        <lateralidade>${esc(cat.lateralidade || "N")}</lateralidade>
      </parteAtingida>
      <agenteCausador>
        <codAgntCausador>${esc(agenteCod)}</codAgntCausador>
      </agenteCausador>
      ${cat.data_atendimento ? `<atestado>
        <dtAtendimento>${esc(cat.data_atendimento)}</dtAtendimento>
        <hrAtendimento>${esc((cat.hora_atendimento || "").replace(":", "").slice(0, 4).padEnd(4, "0"))}</hrAtendimento>
        <indInternacao>${cat.houve_internacao ? "S" : "N"}</indInternacao>
        <duracTrat>0</duracTrat>
        <indAfast>${cat.houve_afastamento ? "S" : "N"}</indAfast>
        <dscLesao>${esc(naturezaCod)}</dscLesao>
        ${cat.descricao_lesao ? `<dscCompLesao>${esc(cat.descricao_lesao)}</dscCompLesao>` : ""}
        ${cid ? `<codCID>${esc(cid.codigo)}</codCID>` : ""}
        ${cat.medico_nome ? `<emitente>
          <nmEmit>${esc(cat.medico_nome)}</nmEmit>
          <ideOC>${cat.medico_crm ? 1 : 2}</ideOC>
          ${cat.medico_crm ? `<nrOC>${esc(cat.medico_crm)}</nrOC>` : ""}
          ${cat.medico_uf ? `<ufOC>${esc(cat.medico_uf)}</ufOC>` : ""}
        </emitente>` : ""}
      </atestado>` : ""}
      ${cat.observacoes ? `<observacao>${esc(cat.observacoes)}</observacao>` : ""}
    </cat>
  </evtCAT>
  <!-- ${ESOCIAL_S2210_AVISO} -->
</eSocial>`;

  return { xml, idEvento, warnings };
}

// ---------- coleta de dados ----------
async function coletarInput(eventoId: string): Promise<S2210BuildInput> {
  const { data: evento } = await (supabase.from as any)("esocial_eventos_s2210").select("*").eq("id", eventoId).maybeSingle();
  if (!evento) throw new Error("Evento eSocial não encontrado");
  const { data: cat } = await (supabase.from as any)("cat_comunicacoes").select("*").eq("id", evento.cat_id).maybeSingle();
  if (!cat) throw new Error("CAT vinculada não encontrada");
  const { data: funcionario } = await (supabase.from as any)("funcionarios")
    .select("nome, cpf, matricula, empresa_id").eq("id", cat.funcionario_id).maybeSingle();
  if (!funcionario) throw new Error("Funcionário da CAT não encontrado");
  const { data: cfg } = await (supabase.from as any)("esocial_config")
    .select("cnpj_raiz, tp_amb, ver_proc").eq("empresa_id", evento.empresa_id).maybeSingle();
  const { data: emp } = await (supabase.from as any)("empresa_config")
    .select("nome, cnpj").eq("id", evento.empresa_id).maybeSingle();
  const empresa = { cnpj: cfg?.cnpj_raiz || emp?.cnpj || null, razao_social: emp?.nome || null };

  const [{ data: cid }, { data: municipio }, { data: parte }, { data: agente }, { data: natureza }, { data: situacao }] = await Promise.all([
    cat.cid_codigo
      ? (supabase.from as any)("esocial_cid10").select("codigo, descricao").eq("codigo", String(cat.cid_codigo).toUpperCase()).maybeSingle()
      : Promise.resolve({ data: null }),
    cat.municipio && cat.uf
      ? (supabase.from as any)("esocial_municipios_ibge").select("codigo, nome, uf").ilike("nome", String(cat.municipio).trim()).eq("uf", String(cat.uf).toUpperCase()).maybeSingle()
      : Promise.resolve({ data: null }),
    cat.parte_atingida_id ? (supabase.from as any)("cat_partes_atingidas").select("codigo, codigo_esocial, descricao").eq("id", cat.parte_atingida_id).maybeSingle() : Promise.resolve({ data: null }),
    cat.agente_causador_id ? (supabase.from as any)("cat_agentes_causadores").select("codigo, codigo_esocial, descricao").eq("id", cat.agente_causador_id).maybeSingle() : Promise.resolve({ data: null }),
    cat.natureza_lesao_id ? (supabase.from as any)("cat_naturezas_lesao").select("codigo, codigo_esocial, descricao").eq("id", cat.natureza_lesao_id).maybeSingle() : Promise.resolve({ data: null }),
    cat.situacao_geradora_id ? (supabase.from as any)("cat_situacoes_geradoras").select("codigo, codigo_esocial, descricao").eq("id", cat.situacao_geradora_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  return {
    evento, cat, funcionario, empresa, municipioIbge: municipio, cid,
    catalogo: { parte_atingida: parte, agente_causador: agente, natureza_lesao: natureza, situacao_geradora: situacao },
  };
}

// ---------- validar (sem gerar XML) ----------
export async function validarXmlS2210(eventoId: string): Promise<{
  status: string; total_erros: number; total_alertas: number; ocorrencias: Ocorrencia[];
}> {
  const input = await coletarInput(eventoId);
  const ocorrencias = validateS2210Full(input);
  const { data, error } = await (supabase.rpc as any)("esocial_registrar_ocorrencias", {
    _evento_id: eventoId,
    _ocorrencias: ocorrencias,
  });
  if (error) throw new Error(error.message);
  return {
    status: data?.status,
    total_erros: data?.total_erros ?? 0,
    total_alertas: data?.total_alertas ?? 0,
    ocorrencias,
  };
}

// ---------- gerar XML técnico (após validação OK) ----------
// P0 #7 — XML completo NUNCA é gravado no banco. Upload para Google Drive BYOK
// privado; banco recebe apenas hash, drive_file_id, drive_link, tamanho e metadados.
export async function gerarSalvarXmlS2210(eventoId: string): Promise<{
  xml: string; hash: string; warnings: string[]; idEvento: string;
  driveFileId: string; driveLink: string | null;
}> {
  const input = await coletarInput(eventoId);

  // bloqueia se houver erros estruturais
  const ocorrencias = validateS2210Full(input);
  const erros = ocorrencias.filter((o) => o.tipo === "erro");
  if (erros.length) {
    await (supabase.rpc as any)("esocial_registrar_ocorrencias", { _evento_id: eventoId, _ocorrencias: ocorrencias });
    throw new Error("Validação local falhou:\n• " + erros.map((e) => e.mensagem).join("\n• "));
  }

  const { xml, idEvento, warnings } = buildS2210Xml(input);
  const hash = await sha256Hex(xml);
  const tamanho = new TextEncoder().encode(xml).length;

  // Upload para Drive BYOK privado (mesmo padrão do S-2240).
  await supabase.auth.refreshSession();
  const { uploadToDrive } = await import("@/lib/googleDriveStorage");
  const folder = `eSocial/S2210/${input.evento.empresa_id}`;
  const fileName = `S2210_${idEvento}_${hash.slice(0, 8)}.xml`;
  const blob = new Blob([xml], { type: "application/xml" });
  const up = await uploadToDrive(blob, folder, fileName, { makePublic: false });

  const { error: rpcErr } = await (supabase.rpc as any)("esocial_registrar_xml_meta", {
    _evento_id: eventoId,
    _hash: hash,
    _versao_layout: input.evento.versao_layout || "1.3",
    _tamanho_bytes: tamanho,
    _drive_file_id: up.fileId,
    _drive_link: up.webViewLink || null,
  });
  if (rpcErr) throw new Error(rpcErr.message);

  // grava alertas pós-geração
  await (supabase.rpc as any)("esocial_registrar_ocorrencias", { _evento_id: eventoId, _ocorrencias: ocorrencias });

  return { xml, hash, warnings, idEvento, driveFileId: up.fileId, driveLink: up.webViewLink || null };
}

// ---------- retificação ----------
export async function iniciarRetificacaoS2210(eventoId: string): Promise<{ novo_evento_id: string }> {
  const { data, error } = await (supabase.rpc as any)("esocial_iniciar_retificacao", { _evento_id: eventoId });
  if (error) throw new Error(error.message);
  return data;
}

// ---------- download log ----------
export async function registrarDownloadXml(eventoId: string): Promise<void> {
  await (supabase.rpc as any)("esocial_registrar_download", { _evento_id: eventoId });
}

// alias mantido p/ compat
export const validateS2210 = (input: Partial<S2210BuildInput>): string[] =>
  input.cat && input.evento
    ? validateS2210Full(input as S2210BuildInput).filter((o) => o.tipo === "erro").map((o) => o.mensagem)
    : ["CAT/Evento inexistente"];
