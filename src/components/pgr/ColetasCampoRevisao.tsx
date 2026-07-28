import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Check, Loader2, MapPin, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { GRUPO_LABEL } from "@/lib/pgrMatriz";
import { STATUS_COLETA_COR, STATUS_COLETA_LABEL, StatusColetaCampo } from "@/types/sst";
import { useNucleoMestreSst } from "@/hooks/useNucleoMestreSst";
import { mensagemErro } from "@/lib/erroSupabase";

interface Props {
  pgrId: string;
  empresaId: string;
  canEdit: boolean;
}

/**
 * Fila de revisão das coletas de campo.
 *
 * Validar uma coleta cria o item correspondente no levantamento preliminar do
 * PGR e marca a coleta como 'validado', com o vínculo registrado. Descartar
 * exige motivo — é a evidência de que o perigo observado foi analisado e
 * conscientemente não entrou no documento.
 */
export default function ColetasCampoRevisao({ pgrId, empresaId, canEdit }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { ambientes, setores, funcoes, gesList } = useNucleoMestreSst();
  const [descartando, setDescartando] = useState<any | null>(null);
  const [motivo, setMotivo] = useState("");

  const { data: coletas = [], isLoading } = useQuery({
    queryKey: ["coletas-revisao", pgrId],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("sst_coletas_campo")
        .select("*")
        .eq("pgr_id", pgrId)
        .in("status", ["rascunho", "aguardando_revisao"])
        .order("coletado_em", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const validar = useMutation({
    mutationFn: async (c: any) => {
      const { data: item, error: e1 } = await (supabase.from as any)("pgr_levantamento_preliminar")
        .insert({
          pgr_id: pgrId,
          empresa_id: empresaId,
          ambiente_id: c.ambiente_id,
          processo_id: c.processo_id,
          setor_id: c.setor_id,
          ges_id: c.ges_id,
          funcao_id: c.funcao_id,
          atividade_id: c.atividade_id,
          perigo_descricao: c.perigo_observado,
          grupo: c.categoria,
          fonte_circunstancia: c.fonte_circunstancia,
          // A coleta de campo É a origem: quem revisa não pode reescrever isso
          // como "inspeção de escritório".
          origem: "inspecao",
          origem_detalhe: `Coleta em campo por ${c.coletado_por_nome || "usuário"} em ${
            new Date(c.coletado_em).toLocaleString("pt-BR")}`,
          data_levantamento: String(c.coletado_em).slice(0, 10),
          responsavel_nome: c.coletado_por_nome,
          tratamento: "avaliacao_aprofundada",
          justificativa: [
            c.possiveis_lesoes && `Possíveis lesões: ${c.possiveis_lesoes}`,
            c.qtd_expostos != null && `Trabalhadores expostos: ${c.qtd_expostos}`,
            c.medidas_existentes && `Medidas existentes: ${c.medidas_existentes}`,
            c.situacao_encontrada && `Situação encontrada: ${c.situacao_encontrada}`,
          ].filter(Boolean).join("\n") || null,
        })
        .select("id").single();
      if (e1) throw e1;

      const { error: e2 } = await (supabase.from as any)("sst_coletas_campo").update({
        status: "validado",
        revisado_por: user?.id || null,
        revisado_em: new Date().toISOString(),
      }).eq("id", c.id);
      if (e2) throw e2;
      return item;
    },
    onSuccess: () => {
      toast.success("Coleta validada e incorporada ao levantamento");
      qc.invalidateQueries({ queryKey: ["coletas-revisao", pgrId] });
      qc.invalidateQueries({ queryKey: ["pgr-perigos-step", pgrId] });
      qc.invalidateQueries({ queryKey: ["pgr-wiz-progresso", pgrId] });
    },
    onError: (e: any) => toast.error(mensagemErro(e, "Não foi possível concluir a revisão")),
  });

  const descartar = useMutation({
    mutationFn: async () => {
      if (motivo.trim().length < 5) throw new Error("Explique em uma frase por que está descartando.");
      const { error } = await (supabase.from as any)("sst_coletas_campo").update({
        status: "descartado",
        revisado_por: user?.id || null,
        revisado_em: new Date().toISOString(),
        revisao_observacao: motivo.trim(),
      }).eq("id", descartando.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Coleta descartada com o motivo registrado");
      qc.invalidateQueries({ queryKey: ["coletas-revisao", pgrId] });
      setDescartando(null);
      setMotivo("");
    },
    onError: (e: any) => toast.error(mensagemErro(e, "Não foi possível concluir a revisão")),
  });

  const nomeDe = (lista: any[], id?: string | null) =>
    (id && lista.find((x: any) => x.id === id)?.nome) || null;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando coletas…
      </div>
    );
  }

  if (coletas.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold">Coletas de campo aguardando revisão</h3>
        <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
          {coletas.length}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Registros feitos no celular. Nada entra no PGR sem passar por aqui.
      </p>

      {coletas.map((c) => {
        const onde = [
          nomeDe(ambientes, c.ambiente_id), nomeDe(setores, c.setor_id),
          nomeDe(gesList, c.ges_id), nomeDe(funcoes, c.funcao_id),
        ].filter(Boolean).join(" › ");
        return (
          <Card key={c.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium">{c.perigo_observado}</p>
                  <p className="text-sm text-muted-foreground">
                    {c.fonte_circunstancia || "Sem fonte informada"}
                  </p>
                </div>
                <Badge variant="outline"
                  className={STATUS_COLETA_COR[c.status as StatusColetaCampo]}>
                  {STATUS_COLETA_LABEL[c.status as StatusColetaCampo]}
                </Badge>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                {onde && <p>Contexto: {onde}</p>}
                {c.contexto_livre && <p>Anotado em campo: {c.contexto_livre}</p>}
                {c.possiveis_lesoes && <p>Lesões: {c.possiveis_lesoes}</p>}
                {c.medidas_existentes && <p>Medidas existentes: {c.medidas_existentes}</p>}
                <p className="flex items-center gap-2 flex-wrap">
                  <span>{new Date(c.coletado_em).toLocaleString("pt-BR")}</span>
                  {c.coletado_por_nome && <span>· {c.coletado_por_nome}</span>}
                  {c.categoria && <span>· {GRUPO_LABEL[c.categoria] || c.categoria}</span>}
                  {c.qtd_expostos != null && <span>· {c.qtd_expostos} exposto(s)</span>}
                  {c.latitude != null && (
                    <span className="inline-flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" />
                      {Number(c.latitude).toFixed(4)}, {Number(c.longitude).toFixed(4)}
                    </span>
                  )}
                </p>
              </div>

              {canEdit && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button size="sm" onClick={() => validar.mutate(c)} disabled={validar.isPending}>
                    <Check className="h-4 w-4 mr-1" /> Validar e incluir
                  </Button>
                  <Button size="sm" variant="outline"
                    onClick={() => { setDescartando(c); setMotivo(""); }}>
                    <X className="h-4 w-4 mr-1" /> Descartar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!descartando} onOpenChange={(o) => !o && setDescartando(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Descartar esta coleta?</DialogTitle>
            <DialogDescription>
              O registro permanece com o motivo — é a evidência de que o perigo observado
              foi analisado e não entrou no PGR.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-sm">Motivo do descarte *</Label>
            <Textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: duplicado da coleta anterior; frente de serviço encerrada" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDescartando(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => descartar.mutate()}
              disabled={descartar.isPending}>
              {descartar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Descartar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
