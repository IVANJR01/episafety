import { useState, useRef } from "react";
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
import { AlertTriangle, CheckCircle2, ShieldAlert, Camera, Paperclip, X, Image as ImageIcon } from "lucide-react";
import {
  isTableMissingError,
  salvarInspecaoLocal,
} from "@/lib/extintoresStorageFallback";

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

function comprimirImagemParaDataUrl(file: File, maxDim = 1200, qualidade = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", qualidade));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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
  const [fotoEvidencia, setFotoEvidencia] = useState<string | null>(null);
  const [processandoFoto, setProcessandoFoto] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const arquivoInputRef = useRef<HTMLInputElement>(null);

  if (!extintor) return null;

  // Verifica se há alguma reprovação
  const reprovados = Object.entries(respostas).filter(([_, v]) => v === "NAO");
  const isConforme = reprovados.length === 0;

  const handleMudarResposta = (id: string, valor: "SIM" | "NAO" | "NA") => {
    setRespostas((prev) => ({ ...prev, [id]: valor }));
  };

  const handleFotoSelecionada = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessandoFoto(true);
    try {
      const dataUrl = await comprimirImagemParaDataUrl(file);
      setFotoEvidencia(dataUrl);
      toast({
        title: "Foto comprobatória anexada!",
        description: "A evidência fotográfica da irregularidade foi registrada.",
      });
    } catch (err) {
      toast({
        title: "Erro ao processar imagem",
        description: "Tente novamente ou selecione outro arquivo.",
        variant: "destructive",
      });
    } finally {
      setProcessandoFoto(false);
      e.target.value = "";
    }
  };

  const handleSalvar = async () => {
    // Alerta caso haja reprovação sem foto
    if (!isConforme && !fotoEvidencia) {
      const confirmarSemFoto = window.confirm(
        "Atenção: Você marcou 'NÃO' em itens da inspeção, mas ainda não anexou uma foto comprobatória da irregularidade.\n\nDeseja registrar mesmo assim?"
      );
      if (!confirmarSemFoto) return;
    }

    setLoading(true);
    try {
      const resultadoInspecao = isConforme ? "CONFORME" : "NAO_CONFORME";

      // 1. Converte respostas para booleans da tabela extintor_inspecoes
      const checklistPayload: any = {
        extintor_id: extintor.id,
        empresa_id: extintor.empresa_id,
        data_inspecao: dataHora,
        inspetor_nome: inspetorNome,
        resultado: resultadoInspecao,
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
        foto_url: fotoEvidencia || null,
        observacoes: observacoes.trim() || null,
      };

      // 2. Se houver reprovação e usuário optou por gerar Não Conformidade
      let conformidadeIdCriada: string | null = null;
      if (!isConforme && gerarNaoConformidade) {
        const itensNomes = reprovados
          .map(([id]) => ITENS_CHECKLIST.find((i) => i.id === id)?.label || id)
          .join(", ");

        try {
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
            checklistPayload.conformidade_gerada_id = conformidadeIdCriada;
          }
        } catch {
          // ignora falha em conformidades
        }
      }

      // 3. Tenta gravar a inspeção mensal no Supabase com fallback local
      const { error: insErr } = await (supabase.from as any)("extintor_inspecoes").insert(checklistPayload);

      if (insErr) {
        if (isTableMissingError(insErr)) {
          salvarInspecaoLocal(extintor.empresa_id, checklistPayload);
          toast({
            title: isConforme ? "Inspeção Registrada: CONFORME" : "Inspeção Registrada: NÃO CONFORME",
            description: isConforme
              ? `Extintor ${extintor.numero} aprovado com sucesso.`
              : `Apontamentos e foto comprobatória salvos com sucesso.`,
            variant: isConforme ? "default" : "destructive",
          });
          onSuccess();
          onOpenChange(false);
          return;
        }
        throw insErr;
      }

      // 4. Atualiza data_ultima_inspecao no extintor
      try {
        await (supabase.from as any)("extintores")
          .update({ data_ultima_inspecao: dataHora })
          .eq("id", extintor.id);
      } catch {
        // ignora
      }

      toast({
        title: isConforme ? "Inspeção Registrada: CONFORME" : "Inspeção Registrada: NÃO CONFORME",
        description: isConforme
          ? `Extintor ${extintor.numero} inspecionado e aprovado com sucesso.`
          : `Apontamentos registrados.${fotoEvidencia ? " Foto comprobatória anexada." : ""}${conformidadeIdCriada ? " Não Conformidade gerada no sistema." : ""}`,
        variant: isConforme ? "default" : "destructive",
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      if (isTableMissingError(err)) {
        salvarInspecaoLocal(extintor.empresa_id, {
          extintor_id: extintor.id,
          empresa_id: extintor.empresa_id,
          data_inspecao: dataHora,
          inspetor_nome: inspetorNome,
          resultado: isConforme ? "CONFORME" : "NAO_CONFORME",
          foto_url: fotoEvidencia || null,
          observacoes: observacoes.trim() || null,
        });
        toast({
          title: isConforme ? "Inspeção Registrada: CONFORME" : "Inspeção Registrada: NÃO CONFORME",
          description: "Inspeção registrada com sucesso.",
          variant: isConforme ? "default" : "destructive",
        });
        onSuccess();
        onOpenChange(false);
      } else {
        toast({
          title: "Erro ao registrar inspeção",
          description: err.message || "Falha ao gravar inspeção no banco.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const nomesItensReprovados = reprovados
    .map(([id]) => ITENS_CHECKLIST.find((i) => i.id === id)?.label || id)
    .join(", ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isConforme ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-red-600" />
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
          {/* DADOS DA INSPEÇÃO */}
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

          {/* CHECKLIST NORMATIVO */}
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
                      ? "border-red-300 bg-red-50/70 dark:bg-red-950/25"
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
                        <Label htmlFor={`${item.id}-nao`} className="text-xs cursor-pointer text-red-600 font-bold">
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

          {/* ÁREA DE COMPROVAÇÃO COM FOTO QUANDO MARCAR 'NÃO' */}
          {!isConforme && (
            <div className="p-4 rounded-xl border-2 border-red-300 bg-red-50/80 dark:bg-red-950/30 space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-sm">
                  <Camera className="h-5 w-5 text-red-600" />
                  <span>Foto Comprobatória da Irregularidade</span>
                </div>
                {fotoEvidencia && (
                  <span className="text-[11px] bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200 px-2 py-0.5 rounded-full font-medium">
                    Foto anexada ✓
                  </span>
                )}
              </div>

              <p className="text-xs text-red-800 dark:text-red-300">
                O extintor foi reprovado em: <strong>{nomesItensReprovados}</strong>. Tire uma foto ou anexe uma imagem para comprovar a não conformidade para a segurança e auditoria.
              </p>

              {fotoEvidencia ? (
                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-red-200">
                  <div className="relative shrink-0">
                    <img
                      src={fotoEvidencia}
                      alt="Evidência da Irregularidade"
                      className="h-20 w-24 object-cover rounded border border-red-200"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      Evidência registrada
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Imagem pronta para compor o relatório de inspeção.
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs text-red-700 border-red-200 hover:bg-red-50"
                        onClick={() => setFotoEvidencia(null)}
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        Remover Foto
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => cameraInputRef.current?.click()}
                      >
                        <Camera className="w-3.5 h-3.5 mr-1" />
                        Trocar Foto
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFotoSelecionada}
                  />
                  <input
                    ref={arquivoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFotoSelecionada}
                  />

                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 flex items-center justify-center gap-2 border-red-300 hover:bg-red-100 text-red-900 dark:text-red-200 font-semibold"
                    disabled={processandoFoto}
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera className="h-5 w-5 text-red-600" />
                    <span>{processandoFoto ? "Processando..." : "Tirar Foto com a Câmera"}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 flex items-center justify-center gap-2 border-slate-300 hover:bg-slate-100 text-slate-800 dark:text-slate-200 font-semibold"
                    disabled={processandoFoto}
                    onClick={() => arquivoInputRef.current?.click()}
                  >
                    <Paperclip className="h-5 w-5 text-slate-600" />
                    <span>Anexar da Galeria</span>
                  </Button>
                </div>
              )}

              {/* OPÇÃO DE NÃO CONFORMIDADE AUTOMÁTICA */}
              <div className="flex items-center space-x-2 pt-1">
                <Checkbox
                  id="chk-gerar-nc"
                  checked={gerarNaoConformidade}
                  onCheckedChange={(c) => setGerarNaoConformidade(Boolean(c))}
                />
                <Label htmlFor="chk-gerar-nc" className="text-xs font-medium cursor-pointer text-red-900 dark:text-red-200">
                  Gerar ocorrência de Não Conformidade no painel de Riscos com esta foto
                </Label>
              </div>
            </div>
          )}

          {/* OBSERVAÇÕES */}
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
            disabled={loading || processandoFoto}
            className={isConforme ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
          >
            {loading ? "Registrando..." : isConforme ? "Concluir Inspeção (Aprovado)" : "Registrar com Apontamentos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
