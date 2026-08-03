import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PGR_TIPO_LABEL, PgrDocumento, PgrTipo } from "@/lib/pgrTypes";
import { useRegistrarEtapa } from "./PgrEtapaContext";

interface Props {
  pgr: PgrDocumento;
  canEdit: boolean;
  /** true = etapa "Empresa e unidade"; false = etapa "Dados do PGR". */
  escopo?: boolean;
}

const Campo = ({ label, children, dica }: { label: string; children: any; dica?: string }) => (
  <div className="space-y-1.5">
    <Label className="text-sm font-medium">{label}</Label>
    {children}
    {dica && <p className="text-xs text-muted-foreground">{dica}</p>}
  </div>
);

export default function PgrDadosStep({ pgr, canEdit, escopo = false }: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({});

  useEffect(() => { setF({ ...pgr }); }, [pgr]);

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
      const campos = escopo
        ? {
            unidade_id: f.unidade_id === "__matriz__" ? null : f.unidade_id || null,
            tipo_pgr: f.tipo_pgr || "estabelecimento",
            cnpj_snapshot: f.cnpj_snapshot || null,
            cno: f.cno || null,
            cnae_principal: f.cnae_principal || null,
            grau_risco: f.grau_risco ? Number(f.grau_risco) : null,
            qtd_trabalhadores: f.qtd_trabalhadores !== "" && f.qtd_trabalhadores != null
              ? Number(f.qtd_trabalhadores) : null,
            jornada_turnos: f.jornada_turnos || null,
            contratante_nome: f.contratante_nome || null,
            contratante_cnpj: f.contratante_cnpj || null,
            contrato_numero: f.contrato_numero || null,
            local_prestacao: f.local_prestacao || null,
          }
        : {
            data_emissao: f.data_emissao || null,
            data_vigencia_inicio: f.data_vigencia_inicio || null,
            data_vigencia_fim: f.data_vigencia_fim || null,
            periodo_ref_inicio: f.periodo_ref_inicio || null,
            periodo_ref_fim: f.periodo_ref_fim || null,
            data_levantamento: f.data_levantamento || null,
            proxima_revisao: f.proxima_revisao || null,
            sgsst_certificado: !!f.sgsst_certificado,
            sgsst_norma: f.sgsst_norma || null,
            sgsst_certificadora: f.sgsst_certificadora || null,
            sgsst_validade: f.sgsst_validade || null,
            escopo: f.escopo || null,
            metodologia_avaliacao: f.metodologia_avaliacao || null,
            observacoes: f.observacoes || null,
          };
      const { error } = await (supabase.from as any)("pgr_documentos")
        .update(campos).eq("id", pgr.id);
      if (error) throw error;
      toast.success("Dados salvos");
      qc.invalidateQueries({ queryKey: ["pgr-detalhe", pgr.id] });
    } catch (e: any) {
      toast.error(e.message || "Falha ao salvar");
    } finally { setBusy(false); }
  };

  // O rodapé do assistente comanda a gravação. Os dois blocos da etapa 1 se
  // registram com chaves distintas, então "Salvar e continuar" grava ambos.
  useRegistrarEtapa(canEdit ? {
    salvar: async () => { await salvar(); return true; },
    salvarRascunho: salvar,
    ocupado: busy,
  } : null);

  /** Copia a identificação da unidade escolhida, evitando redigitar. */
  const puxarDaUnidade = () => {
    const alvo = unidades.find((u) => u.id === (f.unidade_id || pgr.empresa_id));
    if (!alvo) return toast.error("Selecione uma unidade primeiro.");
    setF({
      ...f,
      cnpj_snapshot: alvo.cnpj || f.cnpj_snapshot,
      cnae_principal: alvo.cnae_principal || f.cnae_principal,
      grau_risco: alvo.grau_risco ?? f.grau_risco,
    });
    toast.success("Dados copiados do cadastro. Confira e salve.");
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {escopo ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo label="Unidade abrangida"
              dica="Matriz ou filial que este PGR cobre.">
              <Select value={f.unidade_id || "__matriz__"}
                onValueChange={(v) => setF({ ...f, unidade_id: v })} disabled={!canEdit}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__matriz__">Matriz (empresa principal)</SelectItem>
                  {unidades.filter((u) => u.empresa_pai_id).map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome_fantasia || u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Tipo de PGR"
              dica="Obra usa CNO; frente/contrato exige dados do contratante.">
              <Select value={f.tipo_pgr || "estabelecimento"}
                onValueChange={(v) => setF({ ...f, tipo_pgr: v })} disabled={!canEdit}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PGR_TIPO_LABEL) as PgrTipo[]).map((t) => (
                    <SelectItem key={t} value={t}>{PGR_TIPO_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          </div>

          {canEdit && (
            <Button variant="outline" size="sm" onClick={puxarDaUnidade}>
              Copiar CNPJ, CNAE e grau de risco do cadastro
            </Button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo label="CNPJ"><Input className="h-11" value={f.cnpj_snapshot || ""}
              onChange={set("cnpj_snapshot")} disabled={!canEdit} /></Campo>
            <Campo label="CNO" dica="Obrigatório quando o PGR é de obra.">
              <Input className="h-11" value={f.cno || ""} onChange={set("cno")} disabled={!canEdit} />
            </Campo>
            <Campo label="CNAE principal"><Input className="h-11" value={f.cnae_principal || ""}
              onChange={set("cnae_principal")} placeholder="0000-0/00" disabled={!canEdit} /></Campo>
            <Campo label="Grau de risco (NR-04)">
              <Select value={f.grau_risco ? String(f.grau_risco) : ""}
                onValueChange={(v) => setF({ ...f, grau_risco: v })} disabled={!canEdit}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((g) => <SelectItem key={g} value={String(g)}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Nº de trabalhadores"><Input type="number" min={0} className="h-11"
              value={f.qtd_trabalhadores ?? ""} onChange={set("qtd_trabalhadores")} disabled={!canEdit} /></Campo>
            <Campo label="Jornada / turnos"><Input className="h-11" value={f.jornada_turnos || ""}
              onChange={set("jornada_turnos")} placeholder="Ex.: 08h-17h, turno único" disabled={!canEdit} /></Campo>
          </div>

          {f.tipo_pgr === "frente_contrato" && (
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-semibold">Contratante</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Campo label="Nome do contratante"><Input className="h-11"
                  value={f.contratante_nome || ""} onChange={set("contratante_nome")} disabled={!canEdit} /></Campo>
                <Campo label="CNPJ do contratante"><Input className="h-11"
                  value={f.contratante_cnpj || ""} onChange={set("contratante_cnpj")} disabled={!canEdit} /></Campo>
                <Campo label="Nº do contrato"><Input className="h-11"
                  value={f.contrato_numero || ""} onChange={set("contrato_numero")} disabled={!canEdit} /></Campo>
                <Campo label="Local de prestação"><Input className="h-11"
                  value={f.local_prestacao || ""} onChange={set("local_prestacao")} disabled={!canEdit} /></Campo>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Campo label="Data de emissão"><Input type="date" className="h-11"
              value={f.data_emissao || ""} onChange={set("data_emissao")} disabled={!canEdit} /></Campo>
            <Campo label="Data do levantamento"><Input type="date" className="h-11"
              value={f.data_levantamento || ""} onChange={set("data_levantamento")} disabled={!canEdit} /></Campo>
            <Campo label="Próxima revisão"
              dica={f.sgsst_certificado ? "Até 3 anos (certificada)" : "Máximo 2 anos"}>
              <Input type="date" className="h-11" value={f.proxima_revisao || ""}
                onChange={set("proxima_revisao")} disabled={!canEdit} />
            </Campo>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Campo label="Período de referência — início"><Input type="date" className="h-11"
              value={f.periodo_ref_inicio || ""} onChange={set("periodo_ref_inicio")} disabled={!canEdit} /></Campo>
            <Campo label="Período de referência — fim"><Input type="date" className="h-11"
              value={f.periodo_ref_fim || ""} onChange={set("periodo_ref_fim")} disabled={!canEdit} /></Campo>
          </div>

          <Campo label="Escopo do PGR"
            dica="O que este programa abrange: unidades, atividades e trabalhadores.">
            <Textarea rows={3} value={f.escopo || ""} onChange={set("escopo")} disabled={!canEdit} />
          </Campo>

          <Campo label="Metodologia de avaliação"
            dica="Deixe em branco para usar a matriz padrão do sistema.">
            <Textarea rows={2} value={f.metodologia_avaliacao || ""}
              onChange={set("metodologia_avaliacao")} disabled={!canEdit} />
          </Campo>

          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-start gap-2">
              <Checkbox id="sgsst" checked={!!f.sgsst_certificado} disabled={!canEdit}
                onCheckedChange={(c) => setF({ ...f, sgsst_certificado: !!c })} />
              <div>
                <Label htmlFor="sgsst" className="text-sm font-medium">
                  Organização certificada em sistema de gestão de SST
                </Label>
                <p className="text-xs text-muted-foreground">
                  Permite revisar a avaliação a cada 3 anos, em vez de 2.
                </p>
              </div>
            </div>
            {f.sgsst_certificado && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Campo label="Norma"><Input className="h-11" value={f.sgsst_norma || ""}
                  onChange={set("sgsst_norma")} placeholder="ISO 45001" disabled={!canEdit} /></Campo>
                <Campo label="Certificadora"><Input className="h-11" value={f.sgsst_certificadora || ""}
                  onChange={set("sgsst_certificadora")} disabled={!canEdit} /></Campo>
                <Campo label="Válida até"><Input type="date" className="h-11"
                  value={f.sgsst_validade || ""} onChange={set("sgsst_validade")} disabled={!canEdit} /></Campo>
              </div>
            )}
          </div>

          <Campo label="Observações">
            <Textarea rows={2} value={f.observacoes || ""} onChange={set("observacoes")} disabled={!canEdit} />
          </Campo>
        </>
      )}

      {/* Sem botão de salvar aqui. O rodapé do assistente já grava — é para isso
          que serve o useRegistrarEtapa acima. Como esta etapa monta o
          componente duas vezes, o botão aparecia duas vezes: uma no meio do
          formulário e outra no fim, somando quatro formas de salvar a mesma
          tela junto com o "Salvar" do cabeçalho. */}
    </div>
  );
}
