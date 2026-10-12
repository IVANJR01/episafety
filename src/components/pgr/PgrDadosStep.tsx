import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PGR_TIPO_LABEL, PgrDocumento, PgrTipo } from "@/lib/pgrTypes";
import { useRegistrarEtapa } from "./PgrEtapaContext";
import { Building2, Calendar, Copy, UserCheck } from "lucide-react";

interface Props {
  pgr: PgrDocumento;
  canEdit: boolean;
  escopo?: boolean; // Mantido para compatibilidade de tipagem
}

const Campo = ({ label, children, dica }: { label: string; children: any; dica?: string }) => (
  <div className="space-y-1.5">
    <Label className="text-sm font-medium">{label}</Label>
    {children}
    {dica && <p className="text-xs text-muted-foreground">{dica}</p>}
  </div>
);

export default function PgrDadosStep({ pgr, canEdit }: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({});

  const { data: rtExistente } = useQuery({
    queryKey: ["pgr-rt-step", pgr.id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("pgr_responsaveis")
        .select("*")
        .eq("pgr_id", pgr.id)
        .eq("papel", "responsavel_tecnico")
        .order("ordem")
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    setF((prev: any) => ({
      ...pgr,
      ...prev,
      resp_tec_nome: prev.resp_tec_nome ?? pgr.resp_tec_nome ?? rtExistente?.nome ?? "",
      resp_tec_profissao: prev.resp_tec_profissao ?? rtExistente?.profissao ?? "",
      resp_tec_registro: prev.resp_tec_registro ?? rtExistente?.registro_profissional ?? pgr.resp_tec_registro ?? "",
      resp_tec_uf: prev.resp_tec_uf ?? rtExistente?.uf_registro ?? "",
      resp_tec_art: prev.resp_tec_art ?? rtExistente?.numero_art ?? "",
    }));
  }, [pgr, rtExistente]);

  const { data: unidades = [] } = useQuery({
    queryKey: ["pgr-step-unidades", pgr.empresa_id],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("empresa_config")
        .select("id,nome,nome_fantasia,cnpj,cnae_principal,grau_risco,empresa_pai_id")
        .or(`id.eq.${pgr.empresa_id},empresa_pai_id.eq.${pgr.empresa_id}`)
        .order("empresa_pai_id", { nullsFirst: true });
      return (data || []) as any[];
    },
  });

  const set = (k: string) => (e: any) =>
    setF({ ...f, [k]: e?.target ? e.target.value : e });

  const salvar = async () => {
    setBusy(true);
    try {
      // Define vigência e referências automaticamente a partir das duas datas essenciais da NR-01
      const emissao = f.data_emissao || null;
      const revisao = f.proxima_revisao || null;
      const regFormatado = [f.resp_tec_registro?.trim(), f.resp_tec_uf?.trim()].filter(Boolean).join("/") || null;

      const campos = {
        unidade_id: f.unidade_id === "__matriz__" ? null : f.unidade_id || null,
        tipo_pgr: f.tipo_pgr || "estabelecimento",
        cnpj_snapshot: f.cnpj_snapshot || null,
        cno: f.cno || null,
        cnae_principal: f.cnae_principal || null,
        grau_risco: f.grau_risco ? Number(f.grau_risco) : null,
        qtd_trabalhadores:
          f.qtd_trabalhadores !== "" && f.qtd_trabalhadores != null
            ? Number(f.qtd_trabalhadores)
            : null,
        jornada_turnos: f.jornada_turnos || null,
        contratante_nome: f.contratante_nome || null,
        contratante_cnpj: f.contratante_cnpj || null,
        contrato_numero: f.contrato_numero || null,
        local_prestacao: f.local_prestacao || null,

        // Responsável técnico em pgr_documentos
        resp_tec_nome: f.resp_tec_nome?.trim() || null,
        resp_tec_registro: regFormatado,

        // Datas essenciais solicitadas pela NR-01
        data_emissao: emissao,
        data_levantamento: emissao,
        data_vigencia_inicio: emissao,
        periodo_ref_inicio: emissao,
        proxima_revisao: revisao,
        data_vigencia_fim: revisao,
        periodo_ref_fim: revisao,
      };

      const { error } = await (supabase.from as any)("pgr_documentos")
        .update(campos)
        .eq("id", pgr.id);
      if (error) throw error;

      // Sincroniza tabela pgr_responsaveis (usada na Seção 3 e Seção 7 do PDF)
      if (f.resp_tec_nome?.trim()) {
        const payloadRt = {
          pgr_id: pgr.id,
          empresa_id: pgr.empresa_id,
          papel: "responsavel_tecnico",
          nome: f.resp_tec_nome.trim(),
          profissao: f.resp_tec_profissao?.trim() || null,
          registro_profissional: f.resp_tec_registro?.trim() || null,
          uf_registro: f.resp_tec_uf?.trim()?.toUpperCase() || null,
          numero_art: f.resp_tec_art?.trim() || null,
          ordem: 1,
        };
        if (rtExistente?.id) {
          await (supabase.from as any)("pgr_responsaveis").update(payloadRt).eq("id", rtExistente.id);
        } else {
          await (supabase.from as any)("pgr_responsaveis").insert(payloadRt);
        }
      }

      toast.success("Dados salvos");
      qc.invalidateQueries({ queryKey: ["pgr-detalhe", pgr.id] });
      qc.invalidateQueries({ queryKey: ["pgr-rt-step", pgr.id] });
      qc.invalidateQueries({ queryKey: ["pgr-responsaveis-step", pgr.id] });
      qc.invalidateQueries({ queryKey: ["pgr-pdf-context", pgr.id] });
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  };

  useRegistrarEtapa(
    canEdit
      ? {
          salvar: async () => {
            await salvar();
            return true;
          },
          salvarRascunho: salvar,
          ocupado: busy,
        }
      : null
  );

  /** Copia a identificação da unidade escolhida */
  const puxarDaUnidade = () => {
    const alvo = unidades.find((u) => u.id === (f.unidade_id || pgr.empresa_id));
    if (!alvo) return toast.error("Selecione uma unidade primeiro.");
    setF({
      ...f,
      cnpj_snapshot: alvo.cnpj || f.cnpj_snapshot,
      cnae_principal: alvo.cnae_principal || f.cnae_principal,
      grau_risco: alvo.grau_risco ?? f.grau_risco,
    });
    toast.success("Dados copiados do cadastro.");
  };

  return (
    <div className="space-y-8 w-full max-w-5xl">
      {/* ------------------------------------------------------------- */}
      {/* SEÇÃO 1: IDENTIFICAÇÃO DO ESTABELECIMENTO (NR-01 1.5.7.2)     */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b pb-2">
          <div className="space-y-0.5">
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              Identificação do Estabelecimento
            </h3>
            <p className="text-xs text-muted-foreground">
              Dados do estabelecimento coberto pelo programa (NR-01, item 1.5.7.2).
            </p>
          </div>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={puxarDaUnidade} className="text-xs">
              <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar do cadastro da empresa
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Unidade abrangida" dica="Matriz ou filial que este PGR cobre.">
            <Select
              value={f.unidade_id || "__matriz__"}
              onValueChange={(v) => setF({ ...f, unidade_id: v })}
              disabled={!canEdit}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__matriz__">Matriz (empresa principal)</SelectItem>
                {unidades
                  .filter((u) => u.empresa_pai_id)
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome_fantasia || u.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Campo>

          <Campo label="Tipo de PGR" dica="Estabelecimento, obra ou contrato de prestação.">
            <Select
              value={f.tipo_pgr || "estabelecimento"}
              onValueChange={(v) => setF({ ...f, tipo_pgr: v })}
              disabled={!canEdit}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PGR_TIPO_LABEL) as PgrTipo[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {PGR_TIPO_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Campo label="CNPJ">
            <Input
              className="h-11 font-mono text-sm"
              value={f.cnpj_snapshot || ""}
              onChange={set("cnpj_snapshot")}
              disabled={!canEdit}
            />
          </Campo>

          <Campo label="CNAE principal">
            <Input
              className="h-11 font-mono text-sm"
              value={f.cnae_principal || ""}
              onChange={set("cnae_principal")}
              placeholder="0000-0/00"
              disabled={!canEdit}
            />
          </Campo>

          <Campo label="Grau de risco (NR-04)">
            <Select
              value={f.grau_risco ? String(f.grau_risco) : ""}
              onValueChange={(v) => setF({ ...f, grau_risco: v })}
              disabled={!canEdit}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((g) => (
                  <SelectItem key={g} value={String(g)}>
                    Grau {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>

          <Campo label="Nº de trabalhadores">
            <Input
              type="number"
              min={0}
              className="h-11"
              value={f.qtd_trabalhadores ?? ""}
              onChange={set("qtd_trabalhadores")}
              disabled={!canEdit}
            />
          </Campo>

          <Campo label="Jornada / turnos" dica="Ex.: 44h semanais, turno único">
            <Input
              className="h-11"
              value={f.jornada_turnos || ""}
              onChange={set("jornada_turnos")}
              placeholder="Ex.: 08h às 17h"
              disabled={!canEdit}
            />
          </Campo>

          {f.tipo_pgr === "obra" && (
            <Campo label="CNO" dica="Cadastro Nacional de Obras">
              <Input
                className="h-11"
                value={f.cno || ""}
                onChange={set("cno")}
                disabled={!canEdit}
              />
            </Campo>
          )}
        </div>

        {f.tipo_pgr === "frente_contrato" && (
          <div className="border rounded-xl p-4 bg-muted/20 space-y-3">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">
              Dados do Contratante (Frente / Contrato)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo label="Nome do contratante">
                <Input
                  className="h-11"
                  value={f.contratante_nome || ""}
                  onChange={set("contratante_nome")}
                  disabled={!canEdit}
                />
              </Campo>
              <Campo label="CNPJ do contratante">
                <Input
                  className="h-11"
                  value={f.contratante_cnpj || ""}
                  onChange={set("contratante_cnpj")}
                  disabled={!canEdit}
                />
              </Campo>
              <Campo label="Nº do contrato">
                <Input
                  className="h-11"
                  value={f.contratante_cnpj || ""}
                  onChange={set("contratante_cnpj")}
                  disabled={!canEdit}
                />
              </Campo>
              <Campo label="Local de prestação">
                <Input
                  className="h-11"
                  value={f.local_prestacao || ""}
                  onChange={set("local_prestacao")}
                  disabled={!canEdit}
                />
              </Campo>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SEÇÃO 2: VIGÊNCIA E PRAZO DE REVISÃO (NR-01)                  */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-4 border-t pt-6">
        <div className="space-y-0.5 border-b pb-2">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Vigência e Prazo de Revisão
          </h3>
          <p className="text-xs text-muted-foreground">
            A NR-01 exige o documento datado e estabelece revisão da avaliação em até 2 anos (item 1.5.4.4.6).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo
            label="Data de emissão / elaboração"
            dica="Data em que o documento é assinado e entra em vigor."
          >
            <Input
              type="date"
              className="h-11"
              value={f.data_emissao || ""}
              onChange={set("data_emissao")}
              disabled={!canEdit}
            />
          </Campo>

          <Campo
            label="Data da próxima revisão"
            dica="Item 1.5.4.4.6 da NR-01: a avaliação deve ser revista no máximo a cada 2 anos."
          >
            <Input
              type="date"
              className="h-11"
              value={f.proxima_revisao || ""}
              onChange={set("proxima_revisao")}
              disabled={!canEdit}
            />
          </Campo>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SEÇÃO 3: RESPONSÁVEL TÉCNICO PELA ELABORAÇÃO (NR-01 1.5.7.2)   */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-4 border-t pt-6">
        <div className="space-y-0.5 border-b pb-2">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary" />
            Responsável Técnico pela Elaboração
          </h3>
          <p className="text-xs text-muted-foreground">
            Profissional legalmente habilitado responsável pelas avaliações técnicas e assinatura do documento (NR-01, item 1.5.7.2).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo
            label="Nome do Responsável Técnico"
            dica="Nome completo do Engenheiro ou Técnico de Segurança."
          >
            <Input
              className="h-11"
              value={f.resp_tec_nome || ""}
              onChange={set("resp_tec_nome")}
              placeholder="Ex.: Engenheiro Silva..."
              disabled={!canEdit}
            />
          </Campo>

          <Campo
            label="Formação / Especialidade"
            dica="Aparece na Seção 3 do PDF (ex.: Engenheiro de Segurança do Trabalho)."
          >
            <Input
              className="h-11"
              value={f.resp_tec_profissao || ""}
              onChange={set("resp_tec_profissao")}
              placeholder="Ex.: Engenheiro de Segurança do Trabalho"
              disabled={!canEdit}
            />
          </Campo>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Campo
            label="Registro Profissional"
            dica="Número do registro (ex.: CREA 12345, MTE 00123)."
          >
            <Input
              className="h-11"
              value={f.resp_tec_registro || ""}
              onChange={set("resp_tec_registro")}
              placeholder="Ex.: CREA 12345"
              disabled={!canEdit}
            />
          </Campo>

          <Campo
            label="UF do Registro"
            dica="Estado do conselho profissional (ex.: CE, SP)."
          >
            <Input
              className="h-11 uppercase"
              maxLength={2}
              value={f.resp_tec_uf || ""}
              onChange={set("resp_tec_uf")}
              placeholder="CE"
              disabled={!canEdit}
            />
          </Campo>

          <Campo
            label="Nº da ART / RRT (opcional)"
            dica="Anotação de Responsabilidade Técnica (se aplicável)."
          >
            <Input
              className="h-11"
              value={f.resp_tec_art || ""}
              onChange={set("resp_tec_art")}
              placeholder="Ex.: 2026/12345"
              disabled={!canEdit}
            />
          </Campo>
        </div>
      </div>
    </div>
  );
}
