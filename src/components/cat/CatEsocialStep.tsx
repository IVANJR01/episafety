import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMfaStatus } from "@/hooks/useMfaStatus";
import { hasPermission } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MfaActionButton from "@/components/cat/MfaActionButton";
import { toast } from "sonner";
import {
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Info,
  Loader2,
  Save,
  FileLock2,
} from "lucide-react";

interface CatSnapshot {
  status: string;
  data_acidente: string;
  hora_acidente: string | null;
  tipo_acidente: string;
  local_acidente: string | null;
  municipio: string | null;
  uf: string | null;
  cid_codigo: string | null;
  parte_atingida_id: string | null;
  agente_causador_id: string | null;
  natureza_lesao_id: string | null;
  houve_afastamento: boolean;
  ultimo_dia_trabalhado: string | null;
  obito: boolean;
  data_obito: string | null;
  funcionario_id: string;
  cbo: string | null;
}

interface Props {
  catId: string | null; // null = ainda não salva
  empresaId: string | null;
  cat: CatSnapshot | null;
}

const AVISO =
  "Não enviado ao Ambiente Nacional. Assinatura ICP-Brasil ainda não implementada. XML será gerado apenas para validação técnica.";

export default function CatEsocialStep({ catId, empresaId, cat }: Props) {
  const { modulosPermitidos, isSuperAdmin, isPrincipal } = useAuth();
  const mfa = useMfaStatus();

  const canEdit =
    isSuperAdmin || isPrincipal || hasPermission(modulosPermitidos, "cat", "esocial");

  const [indRetif, setIndRetif] = useState<"original" | "retificacao">("original");
  const [nrReciboOrigem, setNrReciboOrigem] = useState("");
  const [saving, setSaving] = useState(false);

  // esocial_config da empresa (apenas leitura aqui — gerência fica em outra tela)
  const { data: cfg } = useQuery({
    queryKey: ["esocial-config", empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      const { data } = await (supabase.from as any)("esocial_config")
        .select("tp_amb, ver_proc, ativo, cnpj_raiz")
        .eq("empresa_id", empresaId)
        .maybeSingle();
      return data;
    },
    enabled: !!empresaId,
  });

  // Evento existente para esta CAT
  const { data: evento, refetch: refetchEvt } = useQuery({
    queryKey: ["esocial-evt", catId],
    queryFn: async () => {
      if (!catId) return null;
      const { data } = await (supabase.from as any)("esocial_eventos_s2210")
        .select("*")
        .eq("cat_id", catId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!catId,
  });

  // CID-10 sugerido
  const { data: cid } = useQuery({
    queryKey: ["esocial-cid10", cat?.cid_codigo],
    queryFn: async () => {
      if (!cat?.cid_codigo) return null;
      const { data } = await (supabase.from as any)("esocial_cid10")
        .select("codigo, descricao")
        .eq("codigo", cat.cid_codigo.toUpperCase())
        .maybeSingle();
      return data;
    },
    enabled: !!cat?.cid_codigo,
  });

  // Município IBGE sugerido
  const { data: municipio } = useQuery({
    queryKey: ["esocial-mun", cat?.municipio, cat?.uf],
    queryFn: async () => {
      if (!cat?.municipio || !cat?.uf) return null;
      const { data } = await (supabase.from as any)("esocial_municipios_ibge")
        .select("codigo, nome, uf")
        .ilike("nome", cat.municipio.trim())
        .eq("uf", cat.uf.toUpperCase())
        .maybeSingle();
      return data;
    },
    enabled: !!cat?.municipio && !!cat?.uf,
  });

  useEffect(() => {
    if (evento) {
      setIndRetif(evento.ind_retif);
      setNrReciboOrigem(evento.nr_recibo_origem || "");
    }
  }, [evento]);

  // Validação de campos obrigatórios para "pronto_envio"
  const validacao = useMemo(() => {
    const faltas: string[] = [];
    if (!cat) {
      faltas.push("CAT precisa ser salva primeiro");
      return { faltas, ok: false };
    }
    if (!cat.data_acidente) faltas.push("Data do acidente");
    if (!cat.tipo_acidente) faltas.push("Tipo do acidente");
    if (!cat.local_acidente) faltas.push("Local do acidente");
    if (!cat.municipio || !cat.uf) faltas.push("Município/UF do acidente");
    if (!municipio) faltas.push("Município IBGE (não encontrado na base — cadastre)");
    if (!cat.cid_codigo) faltas.push("CID-10");
    if (cat.cid_codigo && !cid) faltas.push(`CID-10 ${cat.cid_codigo} não encontrado na base`);
    if (!cat.parte_atingida_id) faltas.push("Parte atingida");
    if (!cat.agente_causador_id) faltas.push("Agente causador");
    if (!cat.natureza_lesao_id) faltas.push("Natureza da lesão");
    if (!cat.cbo) faltas.push("CBO do funcionário");
    if (cat.houve_afastamento && !cat.ultimo_dia_trabalhado)
      faltas.push("Último dia trabalhado (afastamento)");
    if (cat.obito && !cat.data_obito) faltas.push("Data do óbito");
    if (indRetif === "retificacao" && !nrReciboOrigem.trim())
      faltas.push("Número do recibo anterior (retificação)");
    if (cat.status === "cancelada") faltas.push("CAT cancelada — bloqueada para eSocial");
    if (!cfg?.ativo) faltas.push("Configuração eSocial da empresa inativa");
    return { faltas, ok: faltas.length === 0 };
  }, [cat, cid, municipio, indRetif, nrReciboOrigem, cfg]);

  const podeMarcarPronto = validacao.ok && cat?.status !== "rascunho";

  const upsert = async (statusAlvo: "pendente" | "pronto_envio") => {
    if (!catId || !empresaId || !cat) {
      toast.error("Salve a CAT antes de configurar eSocial.");
      return;
    }
    if (!canEdit) {
      toast.error("Sem permissão cat:esocial");
      return;
    }
    if (statusAlvo === "pronto_envio" && !podeMarcarPronto) {
      toast.error("Existem pendências — não é possível marcar como pronto.");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        cat_id: catId,
        empresa_id: empresaId,
        ind_retif: indRetif,
        nr_recibo_origem: indRetif === "retificacao" ? nrReciboOrigem.trim() : null,
        tp_amb: cfg?.tp_amb || "homologacao",
        versao_layout: "1.3",
        status: statusAlvo,
        aviso_nao_enviado: AVISO,
      };
      if (evento?.id) {
        const { error } = await (supabase.from as any)("esocial_eventos_s2210")
          .update(payload)
          .eq("id", evento.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from as any)("esocial_eventos_s2210").insert(payload);
        if (error) throw error;
      }
      toast.success(
        statusAlvo === "pronto_envio"
          ? "Evento eSocial marcado como pronto p/ envio (stub)"
          : "Dados eSocial salvos (pendente)"
      );
      await refetchEvt();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar dados eSocial");
    } finally {
      setSaving(false);
    }
  };

  if (!catId) {
    return (
      <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground space-y-2 text-center">
        <FileLock2 className="h-8 w-8 mx-auto opacity-40" />
        <p>
          Salve a CAT primeiro (mesmo como rascunho) para preparar os dados do{" "}
          <strong>eSocial S-2210</strong>. Os dados já preenchidos serão reaproveitados
          automaticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Aviso fixo */}
      <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-300 p-3 text-sm text-amber-900 dark:text-amber-200 flex gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold mb-0.5">Modo simulação técnica</div>
          {AVISO}
        </div>
      </div>

      {!canEdit && (
        <div className="rounded-md bg-muted p-3 text-sm flex gap-2">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          Você não possui a permissão <code className="font-mono">cat:esocial</code>. Visualização
          apenas.
        </div>
      )}

      {/* Status atual */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Status do evento</span>
            <Badge variant="outline" className="font-mono">
              {evento?.status || "não-criado"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Ambiente</Label>
            <div className="font-mono">
              {cfg?.tp_amb === "producao" ? "Produção (restrita)" : "Homologação"}
            </div>
          </div>
          <div>
            <Label className="text-xs">Versão layout</Label>
            <div className="font-mono">{evento?.versao_layout || "1.3"}</div>
          </div>
          <div>
            <Label className="text-xs">Última atualização</Label>
            <div className="font-mono text-xs">
              {evento?.updated_at
                ? new Date(evento.updated_at).toLocaleString("pt-BR")
                : "—"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Retificação */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Indicativo do evento</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Tipo</Label>
            <Select
              value={indRetif}
              onValueChange={(v) => setIndRetif(v as any)}
              disabled={!canEdit}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="original">Original (1)</SelectItem>
                <SelectItem value="retificacao">Retificação (2)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {indRetif === "retificacao" && (
            <div>
              <Label>Nº do recibo anterior *</Label>
              <Input
                value={nrReciboOrigem}
                onChange={(e) => setNrReciboOrigem(e.target.value)}
                placeholder="Ex.: 1.2.0000000000000000001"
                disabled={!canEdit}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dados reaproveitados */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            Dados reaproveitados da CAT
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <Field label="dtAcid" value={cat?.data_acidente} />
          <Field label="hrAcid" value={cat?.hora_acidente || "—"} />
          <Field label="tpAcid" value={cat?.tipo_acidente} />
          <Field label="localAcid" value={cat?.local_acidente || "—"} />
          <Field
            label="codMunic (IBGE)"
            value={
              municipio
                ? `${municipio.codigo} — ${municipio.nome}/${municipio.uf}`
                : `${cat?.municipio || "?"} / ${cat?.uf || "?"} (não mapeado)`
            }
            warn={!municipio}
          />
          <Field
            label="CID-10"
            value={
              cid
                ? `${cid.codigo} — ${cid.descricao}`
                : cat?.cid_codigo
                  ? `${cat.cid_codigo} (não encontrado)`
                  : "—"
            }
            warn={!!cat?.cid_codigo && !cid}
          />
          <Field label="parteAtingida" value={cat?.parte_atingida_id ? "selecionada" : "—"} />
          <Field label="agenteCausador" value={cat?.agente_causador_id ? "selecionado" : "—"} />
          <Field label="naturezaLesao" value={cat?.natureza_lesao_id ? "selecionada" : "—"} />
          <Field label="CBO" value={cat?.cbo || "—"} />
          <Field
            label="houveAfast"
            value={cat?.houve_afastamento ? `S (último dia: ${cat.ultimo_dia_trabalhado || "?"})` : "N"}
          />
          <Field
            label="indCatObito"
            value={cat?.obito ? `S — ${cat.data_obito || "?"}` : "N"}
          />
        </CardContent>
      </Card>

      {/* Pendências */}
      {validacao.faltas.length > 0 ? (
        <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 p-3 text-sm text-red-800 dark:text-red-300">
          <div className="font-medium flex items-center gap-1 mb-1">
            <AlertTriangle className="h-4 w-4" />
            {validacao.faltas.length} pendência(s) impedem marcar como pronto:
          </div>
          <ul className="list-disc ml-5 space-y-0.5">
            {validacao.faltas.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 p-3 text-sm text-green-800 dark:text-green-300 flex gap-2">
          <CheckCircle2 className="h-4 w-4 mt-0.5" />
          Todos os campos obrigatórios do S-2210 estão preenchidos.
        </div>
      )}

      {cat?.status === "rascunho" && (
        <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 p-3 text-sm text-blue-800 dark:text-blue-300 flex gap-2">
          <Info className="h-4 w-4 mt-0.5" />
          CAT em rascunho — você pode salvar os dados como <strong>pendente</strong>, mas só pode
          marcar como <strong>pronto p/ envio</strong> após concluir a CAT na tela de detalhe.
        </div>
      )}

      {/* Ações */}
      <div className="flex flex-wrap gap-2 justify-end pt-2 border-t">
        <Button
          variant="outline"
          onClick={() => upsert("pendente")}
          disabled={!canEdit || saving}
        >
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Salvar como pendente
        </Button>
        <MfaActionButton
          onClick={() => upsert("pronto_envio")}
          disabled={!canEdit || saving || !podeMarcarPronto}
        >
          <CheckCircle2 className="h-4 w-4 mr-1" />
          Marcar como pronto p/ envio
        </MfaActionButton>
      </div>

      <p className="text-xs text-muted-foreground text-center pt-1">
        Nenhum XML é gerado nesta etapa. A geração técnica (stub) ocorrerá na Parte 3.
      </p>
    </div>
  );
}

function Field({ label, value, warn }: { label: string; value: any; warn?: boolean }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className={`font-mono text-xs break-words ${warn ? "text-amber-700 dark:text-amber-400" : ""}`}>
        {value ?? "—"}
      </div>
    </div>
  );
}
