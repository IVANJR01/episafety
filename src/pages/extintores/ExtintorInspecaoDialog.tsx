import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";

interface ExtintorInspecaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extintor: any;
  onSuccess: () => void;
}

interface ItemChecklist {
  id: string;
  label: string;
  descricao: string;
  permiteNa?: boolean;
}

const ITENS_CHECKLIST: ItemChecklist[] = [
  { id: "acesso_desobstruido", label: "Acesso desobstruído", descricao: "Sem caixas, materiais ou barreiras impedindo o acesso rápido." },
  { id: "sinalizacao_parede", label: "Sinalização de parede (NBR 13434)", descricao: "Placa fotoluminescente visível e acima do extintor." },
  { id: "demarcacao_piso", label: "Demarcação de piso", descricao: "Piso pintado em vermelho com borda amarela (1m x 1m)." },
  { id: "altura_fixacao_ok", label: "Altura de fixação adequada", descricao: "Suporte fixado a no máximo 1,60 m do piso acabado." },
  { id: "lacre_intacto", label: "Lacre plástico intacto", descricao: "Lacre não violado ou rompido." },
  { id: "pino_seguranca_ok", label: "Pino de segurança presente", descricao: "Pino/trava metálica posicionada impedindo acionamento acidental." },
  { id: "manometro_faixa_verde", label: "Manômetro na faixa verde", descricao: "Pressão de trabalho correta (não se aplica para CO2).", permiteNa: true },
  { id: "mangueira_difusor_ok", label: "Mangueira e difusor íntegros", descricao: "Sem ressecamento, rachaduras, dobras ou entupimento." },
  { id: "corpo_sem_danos", label: "Cilindro sem danos físicos", descricao: "Sem amassados graves, corrosão, ferrugem ou vazamentos." },
  { id: "rotulo_legivel", label: "Rótulo e instruções legíveis", descricao: "Instruções de operação e classes de fogo claras." },
  { id: "selo_inmetro_presente", label: "Selo Inmetro presente e válido", descricao: "Selo holográfico íntegro com ano de validade legível." },
];

export function ExtintorInspecaoDialog({ open, onOpenChange, extintor, onSuccess }: ExtintorInspecaoDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dataHora, setDataHora] = useState(new Date().toISOString().slice(0, 10));
  const [inspetorNome, setInspetorNome] = useState(user?.user_metadata?.nome || user?.email || "Técnico de Segurança");
  const [respostas, setRespostas] = useState<Record<string, "SIM" | "NAO" | "NA">>(() => {
    const init: Record<string, "SIM" | "NAO" | "NA"> = {};
    ITENS_CHECKLIST.forEach((it) => {
      if (it.id === "manometro_faixa_verde" && extintor?.agente === "CO2") {
        init[it.id] = "NA";
      } else {
        init[it.id] = "SIM";
      }
    });
    return init;
  });

  const [gerarNaoConformidade, setGerarNaoConformidade] = useState(true);
  const [observacoes, setObservacoes] = useState("");

  if (!extintor) return null;

  // Verifica se há alguma reprovação
  const reprovados = Object.entries(respostas).filter(([k, v]) => v === "NAO");
  const isConforme = reprovados.length === 0;

  const handleMudarResposta = (id: string, valor: "SIM" | "NAO" | "NA") => {
    setRespostas((prev) => ({ ...prev, [id]: valor }));
  };

  const handleSalvar = async () => {
    setLoading(true);
    try {
      // 1. Converte respostas para booleans da tabela extintor_inspecoes
      const checklistPayload: any = {
        extintor_id: extintor.id,
        empresa_id: extintor.empresa_id,
        data_inspecao: dataHora,
        inspetor_nome: inspetorNome,
        acesso_desobstruido: respostas.acesso_desobstruido === "NA" ? null : respostas.acesso_desobstruido === "SIM",
        sinalizacao_parede: respostas.sinalizacao_parede === "NA" ? null : respostas.sinalizacao_parede === "SIM",
        demarcacao_piso: respostas.demarcacao_piso === "NA" ? null : respostas.demarcacao_piso === "SIM",
        altura_fixacao_ok: respostas.altura_fixacao_ok === "NA" ? null : respostas.altura_fixacao_ok === "SIM",
        lacre_intacto: respostas.lacre_intacto === "NA" ? null : respostas.lacre_intacto === "SIM",
        pino_seguranca_ok: respostas.pino_seguranca_ok === "NA" ? null : respostas.pino_seguranca_ok === "SIM",
        manometro_faixa_verde: respostas.manometro_faixa_verde === "NA" ? null : respostas.manometro_faixa_verde === "SIM",
        mangueira_difusor_ok: respostas.mangueira_difusor_ok === "NA" ? null : respostas.mangueira_difusor_ok === "SIM",
        corpo_sem_danos: respostas.corpo_sem_danos === "NA" ? null : respostas.corpo_sem_danos === "SIM",
        rotulo_legivel: respostas.rotulo_legivel === "NA" ? null : respostas.rotulo_legivel === "SIM",
        selo_inmetro_presente: respostas.selo_inmetro_presente === "NA" ? null : respostas.selo_inmetro_presente === "SIM",
        observacoes: observacoes.trim() || null,
      };

      // 2. Se houver reprovação e usuário optou por gerar Não Conformidade
      let conformidadeIdCriada: string | null = null;
      if (!isConforme && gerarNaoConformidade) {
        const itensNomes = reprovados.map(([id]) => ITENS_CHECKLIST.find((i) => i.id === id)?.label || id).join(", ");
        const { data: ncData, error: ncErr } = await (supabase.from as any)("conformidades")
          .insert({
            empresa_id: extintor.empresa_id,
            tipo: "NAO_CONFORMIDADE",
            origem: "INSPECAO_EXTINTORES",
            descricao: `Irregularidade em extintor TAG ${extintor.numero} (${extintor.agente} ${extintor.capacidade} ${extintor.unidade_capacidade}) no setor ${extintor.local_setor || "Geral"}: ${itensNomes}.`,
            local_setor: extintor.local_setor,
            gravidade: "MEDIA",
            status: "ABERTA",
            acao_imediata: "Providenciar desobstrução, reparo ou substituição do extintor conforme NBR 12962.",
          })
          .select("id")
          .single();

        if (!ncErr && ncData) {
          conformidadeIdCriada = ncData.id;
          checklistPayload.conformidade_id = conformidadeIdCriada;
        }
      }

      // 3. Insere a inspeção mensal
      const { error: insErr } = await (supabase.from as any)("extintor_inspecoes").insert(checklistPayload);
      if (insErr) throw insErr;

      // 4. Atualiza data_ultima_inspecao no extintor
      await (supabase.from as any)("extintores")
        .update({ data_ultima_inspecao: dataHora })
        .eq("id", extintor.id);

      toast({
        title: isConforme ? "Inspeção Registrada: CONFORME" : "Inspeção Registrada: NÃO CONFORME",
        description: isConforme
          ? `Extintor ${extintor.numero} inspecionado e aprovado com sucesso.`
          : `Apontamentos registrados.${conformidadeIdCriada ? " Não Conformidade gerada no sistema." : ""}`,
        variant: isConforme ? "default" : "destructive",
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Erro ao registrar inspeção",
        description: err.message || "Falha ao gravar inspeção no banco.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isConforme ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            )}
            <DialogTitle>
              Inspeção Mensal — Extintor {extintor.numero}
            </DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            {extintor.agente?.replace(/_/g, " ")} · {extintor.capacidade} {extintor.unidade_capacidade} · Setor: {extintor.local_setor || "Geral"}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-muted/40 p-3 rounded-lg text-sm">
            <div>
              <Label className="text-xs">Data da Inspeção</Label>
              <Input type="date" value={dataHora} onChange={(e) => setDataHora(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Nome do Inspetor</Label>
              <Input value={inspetorNome} onChange={(e) => setInspetorNome(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Checklist de Itens Normativos (ABNT NBR 12962)
            </h4>

            {ITENS_CHECKLIST.map((item, idx) => {
              const valor = respostas[item.id] || "SIM";
              const isCo2 = extintor.agente === "CO2" && item.id === "manometro_faixa_verde";

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border text-sm transition-colors ${
                    valor === "NAO"
                      ? "border-red-300 bg-red-50/60 dark:bg-red-950/20"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <span className="font-medium text-foreground">
                        {idx + 1}. {item.label}
                      </span>
                      <p className="text-xs text-muted-foreground">{item.descricao}</p>
                    </div>

                    <RadioGroup
                      value={valor}
                      onValueChange={(v) => handleMudarResposta(item.id, v as any)}
                      className="flex items-center gap-3 shrink-0"
                    >
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="SIM" id={`${item.id}-sim`} />
                        <Label htmlFor={`${item.id}-sim`} className="text-xs cursor-pointer text-emerald-700 font-medium">
                          Sim
                        </Label>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="NAO" id={`${item.id}-nao`} />
                        <Label htmlFor={`${item.id}-nao`} className="text-xs cursor-pointer text-red-600 font-medium">
                          Não
                        </Label>
                      </div>

                      {(item.permiteNa || isCo2) && (
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem value="NA" id={`${item.id}-na`} />
                          <Label htmlFor={`${item.id}-na`} className="text-xs cursor-pointer text-muted-foreground">
                            N/A
                          </Label>
                        </div>
                      )}
                    </RadioGroup>
                  </div>
                </div>
              );
            })}
          </div>

          {!isConforme && (
            <div className="p-3 rounded-lg border border-amber-300 bg-amber-50/80 dark:bg-amber-950/30 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-sm">
                <ShieldAlert className="h-5 w-5" />
                <span>Extintor Reprovado na Inspeção ({reprovados.length} item(ns) não conforme(s))</span>
              </div>
              <div className="flex items-center space-x-2 pt-1">
                <Checkbox
                  id="chk-gerar-nc"
                  checked={gerarNaoConformidade}
                  onCheckedChange={(c) => setGerarNaoConformidade(Boolean(c))}
                />
                <Label htmlFor="chk-gerar-nc" className="text-xs font-medium cursor-pointer">
                  Gerar ocorrência automática de Não Conformidade no módulo de Gestão de Riscos
                </Label>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="insp-obs" className="text-xs">Observações do Inspetor</Label>
            <Textarea
              id="insp-obs"
              placeholder="Descreva detalhes observados durante a vistoria..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={loading}
            className={isConforme ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
          >
            {loading ? "Registrando..." : isConforme ? "Concluir Inspeção (Aprovado)" : "Registrar com Apontamentos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
