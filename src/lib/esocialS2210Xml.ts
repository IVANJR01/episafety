// ============================================================================
// eSocial S-2210 — Geração de XML técnico (STUB / VALIDAÇÃO LOCAL)
// ============================================================================
// Este módulo NÃO transmite ao Ambiente Nacional, NÃO assina com ICP-Brasil,
// NÃO gera recibo ou protocolo reais. Apenas monta um XML conforme a
// estrutura do layout S-2210 v1.3 para validação técnica interna.
// ----------------------------------------------------------------------------
import { supabase } from "@/integrations/supabase/client";

export const ESOCIAL_S2210_AVISO =
  "XML não assinado digitalmente. Assinatura ICP-Brasil ainda não implementada.";

export interface S2210BuildInput {
  evento: {
    id: string;
    cat_id: string;
    empresa_id: string;
    versao_layout: string;
    ind_retif: "original" | "retificacao";
    nr_recibo_origem: string | null;
    tp_amb: "producao" | "homologacao";
  };
  cat: any; // cat_comunicacoes row
  funcionario: { nome: string; cpf: string | null; matricula?: string | null };
  empresa: { cnpj: string | null; razao_social?: string | null };
  municipioIbge: { codigo: string; nome: string; uf: string } | null;
  cid: { codigo: string; descricao: string } | null;
  catalogo: {
    parte_atingida?: { codigo: string; descricao: string } | null;
    agente_causador?: { codigo: string; descricao: string } | null;
    natureza_lesao?: { codigo: string; descricao: string } | null;
    situacao_geradora?: { codigo: string; descricao: string } | null;
  };
}

export interface S2210BuildResult {
  xml: string;
  hash: string;
  warnings: string[];
  idEvento: string;
}

// ---------- helpers ----------
function esc(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function onlyDigits(v: string | null | undefined): string {
  return (v || "").replace(/\D+/g, "");
}

function tpAcid(t: string): number {
  // Tabela 5 do eSocial — Tipo de acidente
  switch (t) {
    case "tipico": return 1;
    case "trajeto": return 2;
    case "doenca_ocupacional": return 3;
    default: return 1;
  }
}

function genIdEvento(empresa: S2210BuildInput["empresa"], tpAmb: string): string {
  // Formato simplificado do ID: ID + tpInsc(1) + nrInsc(14) + timestamp(14) + seq(5)
  const cnpj = onlyDigits(empresa.cnpj || "").padStart(14, "0").slice(0, 14);
  const tp = tpAmb === "producao" ? "1" : "2";
  const now = new Date();
  const ts =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 100000)).padStart(5, "0");
  return `ID${tp}${cnpj}${ts}${seq}`;
}

// ---------- SHA-256 via Web Crypto ----------
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------- validação técnica local ----------
export function validateS2210(input: Partial<S2210BuildInput>): string[] {
  const e: string[] = [];
  const c: any = input.cat;
  const ev = input.evento;
  if (!c) return ["CAT inexistente."];
  if (!ev) return ["Evento eSocial inexistente."];

  if (c.status === "cancelada") e.push("CAT cancelada — não é possível gerar XML.");
  if (!c.data_acidente) e.push("Data do acidente obrigatória.");
  if (!c.tipo_acidente) e.push("Tipo do acidente obrigatório.");
  if (!c.local_acidente) e.push("Local do acidente obrigatório.");
  if (!c.cbo) e.push("CBO do funcionário obrigatório.");
  if (!c.cid_codigo) e.push("CID-10 obrigatório.");
  if (!input.cid) e.push("CID-10 não encontrado na base local.");
  if (!input.municipioIbge) e.push("Município IBGE obrigatório (não mapeado).");
  if (!c.parte_atingida_id) e.push("Parte atingida obrigatória.");
  if (!c.agente_causador_id) e.push("Agente causador obrigatório.");
  if (!c.natureza_lesao_id) e.push("Natureza da lesão obrigatória.");
  if (c.houve_afastamento && !c.ultimo_dia_trabalhado)
    e.push("Afastamento exige último dia trabalhado.");
  if (c.obito && !c.data_obito) e.push("Óbito exige data do óbito.");
  if (ev.ind_retif === "retificacao" && !ev.nr_recibo_origem)
    e.push("Retificação exige número do recibo anterior.");
  if (!input.funcionario?.cpf) e.push("CPF do funcionário obrigatório.");
  if (!input.empresa?.cnpj) e.push("CNPJ da empresa obrigatório (esocial_config).");
  return e;
}

// ---------- builder ----------
export function buildS2210Xml(input: S2210BuildInput): { xml: string; idEvento: string; warnings: string[] } {
  const { evento, cat, funcionario, empresa, municipioIbge, cid, catalogo } = input;
  const idEvento = genIdEvento(empresa, evento.tp_amb);
  const warnings: string[] = [];

  if (!catalogo.parte_atingida?.codigo)
    warnings.push("Mapeamento Tabela 13 (parte atingida) pendente — usando ID interno.");
  if (!catalogo.agente_causador?.codigo)
    warnings.push("Mapeamento Tabela 14 (agente causador) pendente — usando ID interno.");
  if (!catalogo.natureza_lesao?.codigo)
    warnings.push("Mapeamento Tabela 15 (natureza da lesão) pendente — usando ID interno.");
  if (!catalogo.situacao_geradora?.codigo)
    warnings.push("Mapeamento situação geradora pendente.");

  const indRetif = evento.ind_retif === "retificacao" ? 2 : 1;
  const tpAmb = evento.tp_amb === "producao" ? 1 : 2;
  const cnpj14 = onlyDigits(empresa.cnpj || "").padStart(14, "0").slice(0, 14);
  const cpf11 = onlyDigits(funcionario.cpf || "").padStart(11, "0").slice(0, 11);

  const parteCod = catalogo.parte_atingida?.codigo || "000";
  const agenteCod = catalogo.agente_causador?.codigo || "00000";
  const naturezaCod = catalogo.natureza_lesao?.codigo || "000";
  const situacaoCod = catalogo.situacao_geradora?.codigo || "000";

  const dtAcid = cat.data_acidente;
  const hrAcid = (cat.hora_acidente || "").replace(":", "").slice(0, 4).padEnd(4, "0");

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
      <tpAmb>${tpAmb}</tpAmb>
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
      <dtAcid>${esc(dtAcid)}</dtAcid>
      <tpAcid>${tpAcid(cat.tipo_acidente)}</tpAcid>
      <hrAcid>${esc(hrAcid)}</hrAcid>
      <hrsTrabAntesAcid>0000</hrsTrabAntesAcid>
      <tpCat>${evento.ind_retif === "retificacao" ? 2 : 1}</tpCat>
      <indCatObito>${cat.obito ? "S" : "N"}</indCatObito>
      ${cat.obito && cat.data_obito ? `<dtObito>${esc(cat.data_obito)}</dtObito>` : ""}
      <indComunPolicia>N</indComunPolicia>
      <codSitGeradora>${esc(situacaoCod)}</codSitGeradora>
      <iniciatCAT>1</iniciatCAT>
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

// ---------- coleta + persistência ----------
export async function gerarSalvarXmlS2210(eventoId: string): Promise<S2210BuildResult> {
  // 1) Evento
  const { data: evento, error: eErr } = await (supabase.from as any)("esocial_eventos_s2210")
    .select("*")
    .eq("id", eventoId)
    .maybeSingle();
  if (eErr || !evento) throw new Error("Evento eSocial não encontrado");

  // 2) CAT
  const { data: cat, error: cErr } = await (supabase.from as any)("cat_comunicacoes")
    .select("*")
    .eq("id", evento.cat_id)
    .maybeSingle();
  if (cErr || !cat) throw new Error("CAT vinculada não encontrada");

  // 3) Funcionário
  const { data: funcionario } = await (supabase.from as any)("funcionarios")
    .select("nome, cpf, matricula, empresa_id")
    .eq("id", cat.funcionario_id)
    .maybeSingle();
  if (!funcionario) throw new Error("Funcionário da CAT não encontrado");

  // 4) Empresa (cnpj_raiz vem de esocial_config; razão da empresa_config)
  const { data: cfg } = await (supabase.from as any)("esocial_config")
    .select("cnpj_raiz, tp_amb, ver_proc")
    .eq("empresa_id", evento.empresa_id)
    .maybeSingle();
  const { data: emp } = await (supabase.from as any)("empresa_config")
    .select("nome, cnpj")
    .eq("id", evento.empresa_id)
    .maybeSingle();
  const empresa = { cnpj: cfg?.cnpj_raiz || emp?.cnpj || null, razao_social: emp?.nome || null };

  // 5) Catálogos
  const [{ data: cid }, { data: municipio }, { data: parte }, { data: agente }, { data: natureza }, { data: situacao }] =
    await Promise.all([
      cat.cid_codigo
        ? (supabase.from as any)("esocial_cid10").select("codigo, descricao").eq("codigo", cat.cid_codigo.toUpperCase()).maybeSingle()
        : Promise.resolve({ data: null }),
      cat.municipio && cat.uf
        ? (supabase.from as any)("esocial_municipios_ibge").select("codigo, nome, uf").ilike("nome", cat.municipio.trim()).eq("uf", cat.uf.toUpperCase()).maybeSingle()
        : Promise.resolve({ data: null }),
      cat.parte_atingida_id
        ? (supabase.from as any)("cat_partes_atingidas").select("codigo, descricao").eq("id", cat.parte_atingida_id).maybeSingle()
        : Promise.resolve({ data: null }),
      cat.agente_causador_id
        ? (supabase.from as any)("cat_agentes_causadores").select("codigo, descricao").eq("id", cat.agente_causador_id).maybeSingle()
        : Promise.resolve({ data: null }),
      cat.natureza_lesao_id
        ? (supabase.from as any)("cat_naturezas_lesao").select("codigo, descricao").eq("id", cat.natureza_lesao_id).maybeSingle()
        : Promise.resolve({ data: null }),
      cat.situacao_geradora_id
        ? (supabase.from as any)("cat_situacoes_geradoras").select("codigo, descricao").eq("id", cat.situacao_geradora_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const input: S2210BuildInput = {
    evento,
    cat,
    funcionario,
    empresa,
    municipioIbge: municipio,
    cid,
    catalogo: {
      parte_atingida: parte,
      agente_causador: agente,
      natureza_lesao: natureza,
      situacao_geradora: situacao,
    },
  };

  const errs = validateS2210(input);
  if (errs.length) {
    throw new Error("Validação local falhou:\n• " + errs.join("\n• "));
  }

  const { xml, idEvento, warnings } = buildS2210Xml(input);
  const hash = await sha256Hex(xml);

  const { data: ok, error: rpcErr } = await (supabase.rpc as any)("esocial_registrar_xml", {
    _evento_id: eventoId,
    _xml: xml,
    _hash: hash,
    _versao_layout: evento.versao_layout || "1.3",
  });
  if (rpcErr) throw new Error(rpcErr.message);

  return { xml, hash, warnings, idEvento };
}
