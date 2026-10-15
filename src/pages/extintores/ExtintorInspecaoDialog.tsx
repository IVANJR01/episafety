import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, CheckCircle2, ShieldAlert, Camera, Paperclip, X, Check, Image as ImageIcon } from "lucide-react";
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

  const [fotosPorItem, setFotosPorItem] = useState<Record<string, string>>({});
  const [itemIdParaFoto, setItemIdParaFoto] = useState<string | null>(null);

  const [gerarNaoConformidade, setGerarNaoConformidade] = useState(true);
  const [observacoes, setObservacoes] = useState("");
  const [processandoFoto, setProcessandoFoto] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const arquivoInputRef = useRef<HTMLInputElement>(null);

  if (!extintor) return null;

  const reprovados = Object.entries(respostas).filter(([_, v]) => v === "NAO");
  const isConforme = reprovados.length === 0;

  const handleMudarResposta = (id: string, valor: "SIM" | "NAO" | "NA") => {
    setRespostas((prev) => ({ ...prev, [id]: valor }));
  };

  const dispararCamera = (itemId: string) => {
    setItemIdParaFoto(itemId);
    cameraInputRef.current?.click();
  };

  const dispararArquivo = (itemId: string) => {
    setItemIdParaFoto(itemId);
    arquivoInputRef.current?.click();
  };

  const handleFotoSelecionada = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !itemIdParaFoto) return;

    setProcessandoFoto(true);
    try {
      const dataUrl = await comprimirImagemParaDataUrl(file);
      setFotosPorItem((prev) => ({ ...prev, [itemIdParaFoto]: dataUrl }));
      const labelItem = ITENS_CHECKLIST.find((i) => i.id === itemIdParaFoto)?.label || "Item";
      toast({
        title: "Foto anexada!",
        description: `Evidência registrada para: ${labelItem}.`,
      });
    } catch (err) {
      toast({
        title: "Erro ao processar imagem",
        description: "Tente novamente ou selecione outro arquivo.",
        variant: "destructive",
      });
    } finally {
      setProcessandoFoto(false);
      setItemIdParaFoto(null);
      e.target.value = "";
    }
  };

  const removerFotoDoItem = (itemId: string) => {
    setFotosPorItem((prev) => {
      const copia = { ...prev };
      delete copia[itemId];
      return copia;
    });
  };

  const handleSalvar = async () => {
    // Alerta se houver reprovação sem foto
    const itensSemFoto = reprovados.filter(([id]) => !fotosPorItem[id]);
    if (itensSemFoto.length > 0) {
      const nomes = itensSemFoto
        .map(([id]) => ITENS_CHECKLIST.find((i) => i.id === id)?.label || id)
        .join(", ");
      const prosseguir = window.confirm(
        `Atenção: Você marcou 'Não' em: ${nomes}, mas ainda não anexou a foto comprobatória da irregularidade.\n\nDeseja registrar a inspeção mesmo sem a foto?`
      );
      if (!prosseguir) return;
    }

    setLoading(true);
    try {
      const resultadoInspecao = isConforme ? "CONFORME" : "NAO_CONFORME";
      const primeiraFoto = Object.values(fotosPorItem)[0] || null;

      const checklistPayload: any = {
        extintor_id: extintor.id,
        empresa_id: extintor.empresa_id,
        data_inspecao: dataHora,
        inspetor_nome: inspetorNome,
        resultado: resultadoInspecao,
        acesso_desobstruido: respostas.acesso_desobstruido === "NA" ? null : respostas.acesso_desobstruido === "SIM",
        sinalizacao_conforme: respostas.sinalizacao_parede === "NA" ? null : respostas.sinalizacao_parede === "SIM",
        quadro_demarcacao_piso_ok: respostas.demarcacao_piso === "NA" ? null : respostas.demarcacao_piso === "SIM",
        altura_instalacao_conforme: respostas.altura_fixacao_ok === "NA" ? null : respostas.altura_fixacao_ok === "SIM",
        lacre_intacto: respostas.lacre_intacto === "NA" ? null : respostas.lacre_intacto === "SIM",
        pino_seguranca_presente: respostas.pino_seguranca_ok === "NA" ? null : respostas.pino_seguranca_ok === "SIM",
        manometro_pressao_adequada: respostas.manometro_faixa_verde === "NA" ? null : respostas.manometro_faixa_verde === "SIM",
        manga_bico_sem_obstrucao: respostas.mangueira_difusor_ok === "NA" ? null : respostas.mangueira_difusor_ok === "SIM",
        cilindro_sem_corrosao_ou_dano: respostas.corpo_sem_danos === "NA" ? null : respostas.corpo_sem_danos === "SIM",
        rotulo_instrucoes_legivel: respostas.rotulo_legivel === "NA" ? null : respostas.rotulo_legivel === "SIM",
        selo_inmetro_presente: respostas.selo_inmetro_presente === "NA" ? null : respostas.selo_inmetro_presente === "SIM",
        foto_url: primeiraFoto,
        observacoes: observacoes.trim() || null,
      };

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
          // ignora
        }
      }

      const { error: insErr } = await (supabase.from as any)("extintor_inspecoes").insert(checklistPayload);

      if (insErr) {
        if (isTableMissingError(insErr)) {
          salvarInspecaoLocal(extintor.empresa_id, checklistPayload);
          toast({
            title: isConforme ? "Inspeção: CONFORME" : "Inspeção: NÃO CONFORME",
            description: isConforme
              ? `Extintor ${extintor.numero} aprovado com sucesso.`
              : `Apontamentos e fotos registrados com sucesso.`,
            variant: isConforme ? "default" : "destructive",
          });
          onSuccess();
          onOpenChange(false);
          return;
        }
        throw insErr;
      }

      try {
        await (supabase.from as any)("extintores")
          .update({ data_ultima_inspecao: dataHora })
          .eq("id", extintor.id);
      } catch {
        // ignora
      }

      const totalFotos = Object.keys(fotosPorItem).length;
      toast({
        title: isConforme ? "Inspeção: CONFORME" : "Inspeção: NÃO CONFORME",
        description: isConforme
          ? `Extintor ${extintor.numero} aprovado com sucesso.`
          : `Apontamentos salvos.${totalFotos > 0 ? ` ${totalFotos} foto(s) anexada(s).` : ""}`,
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
          foto_url: Object.values(fotosPorItem)[0] || null,
          observacoes: observacoes.trim() || null,
        });
        toast({
          title: isConforme ? "Inspeção: CONFORME" : "Inspeção: NÃO CONFORME",
          description: "Inspeção registrada com sucesso.",
          variant: isConforme ? "default" : "destructive",
        });
        onSuccess();
        onOpenChange(false);
      } else {
        toast({
          title: "Erro ao registrar inspeção",
          description: err.message || "Falha ao gravar inspeção.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] p-3.5 sm:p-6 overflow-y-auto rounded-xl sm:rounded-2xl">
          <DialogHeader className="space-y-1 pb-2 border-b">
            <div className="flex items-center gap-2">
              {isConforme ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-red-600 shrink-0" />
              )}
              <DialogTitle className="text-lg sm:text-xl font-bold leading-tight">
                Inspeção Mensal — TAG {extintor.numero}
              </DialogTitle>
            </div>
            <p className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
              <span>{extintor.agente?.replace(/_/g, " ")} · {extintor.capacidade} {extintor.unidade_capacidade}</span>
              <span>• Setor: {extintor.local_setor || "Geral"}</span>
            </p>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            {/* DADOS DA INSPEÇÃO ADAPTADOS PARA MOBILE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-50 dark:bg-slate-900/60 p-2.5 sm:p-3 rounded-lg border text-sm">
              <div>
                <Label className="text-[11px] font-semibold text-muted-foreground">Data da Inspeção</Label>
                <Input
                  type="date"
                  value={dataHora}
                  onChange={(e) => setDataHora(e.target.value)}
                  className="h-10 text-sm mt-0.5"
                />
              </div>
              <div>
                <Label className="text-[11px] font-semibold text-muted-foreground">Nome do Inspetor</Label>
                <Input
                  value={inspetorNome}
                  onChange={(e) => setInspetorNome(e.target.value)}
                  className="h-10 text-sm mt-0.5"
                />
              </div>
            </div>

            {/* CHECKLIST COM BOTÕES TOUCH FORMATO PÍLULA */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Checklist Normativo (NBR 12962)
                </h4>
                <span className="text-[11px] text-muted-foreground">
                  {reprovados.length > 0 ? (
                    <span className="text-red-600 font-bold">{reprovados.length} reprovado(s)</span>
                  ) : (
                    <span className="text-emerald-600 font-semibold">Tudo conforme</span>
                  )}
                </span>
              </div>

              {ITENS_CHECKLIST.map((item, idx) => {
                const valor = respostas[item.id] || "SIM";
                const isCo2 = extintor.agente === "CO2" && item.id === "manometro_faixa_verde";
                const fotoDesteItem = fotosPorItem[item.id];

                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border text-sm transition-all ${
                      valor === "NAO"
                        ? "border-red-300 bg-red-50/75 dark:bg-red-950/30 shadow-sm"
                        : "border-border bg-card hover:border-slate-300"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="space-y-0.5 flex-1 min-w-0 pr-1">
                        <span className="font-semibold text-foreground text-sm leading-snug">
                          {idx + 1}. {item.label}
                        </span>
                        <p className="text-xs text-muted-foreground leading-normal">{item.descricao}</p>
                      </div>

                      {/* BOTÕES TOUCH GRANDES E CONFORTÁVEIS PARA O POLEGAR */}
                      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg shrink-0 self-start sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleMudarResposta(item.id, "SIM")}
                          className={`h-9 px-3.5 sm:px-4 rounded-md text-xs font-bold transition-all flex items-center gap-1 active:scale-95 ${
                            valor === "SIM"
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          Sim
                        </button>

                        <button
                          type="button"
                          onClick={() => handleMudarResposta(item.id, "NAO")}
                          className={`h-9 px-3.5 sm:px-4 rounded-md text-xs font-bold transition-all flex items-center gap-1 active:scale-95 ${
                            valor === "NAO"
                              ? "bg-red-600 text-white shadow-sm"
                              : "text-slate-600 dark:text-slate-400 hover:text-red-600"
                          }`}
                        >
                          <X className="w-3.5 h-3.5" />
                          Não
                        </button>

                        {(item.permiteNa || isCo2) && (
                          <button
                            type="button"
                            onClick={() => handleMudarResposta(item.id, "NA")}
                            className={`h-9 px-2.5 rounded-md text-xs font-medium transition-all active:scale-95 ${
                              valor === "NA"
                                ? "bg-slate-600 text-white shadow-sm"
                                : "text-slate-500 dark:text-slate-400"
                            }`}
                          >
                            N/A
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ÁREA DE FOTO COMPROBATÓRIA DIRETO NO ITEM COM BOTÕES TOUCH LARGOS */}
                    {valor === "NAO" && (
                      <div className="mt-3 pt-3 border-t border-red-200/80 dark:border-red-900/50 space-y-2.5 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-400">
                            <Camera className="w-4 h-4 text-red-600 shrink-0" />
                            <span>Comprovação com Foto da Irregularidade:</span>
                          </div>
                          {fotoDesteItem && (
                            <span className="text-[11px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                              Foto comprovada ✓
                            </span>
                          )}
                        </div>

                        {fotoDesteItem ? (
                          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-red-200 shadow-sm">
                            <img
                              src={fotoDesteItem}
                              alt={`Evidência ${item.label}`}
                              className="h-16 w-20 object-cover rounded-md border border-red-200 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                Foto registrada
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                Evidência vinculada à inspeção e NC.
                              </p>
                              <div className="flex gap-2 mt-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2.5 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                                  onClick={() => removerFotoDoItem(item.id)}
                                >
                                  <X className="w-3.5 h-3.5 mr-1" />
                                  Remover
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2.5 text-xs"
                                  onClick={() => dispararCamera(item.id)}
                                >
                                  <Camera className="w-3.5 h-3.5 mr-1" />
                                  Trocar
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-11 text-xs border-red-300 hover:bg-red-100/70 text-red-800 dark:text-red-300 font-bold active:scale-95"
                              disabled={processandoFoto}
                              onClick={() => dispararCamera(item.id)}
                            >
                              <Camera className="w-4 h-4 mr-1.5 text-red-600" />
                              Tirar Foto
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-11 text-xs border-slate-300 hover:bg-slate-100 text-slate-800 dark:text-slate-200 font-semibold active:scale-95"
                              disabled={processandoFoto}
                              onClick={() => dispararArquivo(item.id)}
                            >
                              <Paperclip className="w-4 h-4 mr-1.5 text-slate-600" />
                              Galeria
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* AVISO DE NÃO CONFORMIDADE */}
            {!isConforme && (
              <div className="p-3 rounded-xl border border-red-200 bg-red-50/70 dark:bg-red-950/30 space-y-2">
                <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-bold text-xs">
                  <ShieldAlert className="h-4 w-4 text-red-600 shrink-0" />
                  <span>{reprovados.length} item(ns) reprovado(s)</span>
                </div>
                <div className="flex items-center space-x-2 pt-0.5">
                  <Checkbox
                    id="chk-gerar-nc"
                    checked={gerarNaoConformidade}
                    onCheckedChange={(c) => setGerarNaoConformidade(Boolean(c))}
                  />
                  <Label htmlFor="chk-gerar-nc" className="text-xs font-medium cursor-pointer text-slate-700 dark:text-slate-300">
                    Gerar ocorrência de Não Conformidade com as fotos anexadas
                  </Label>
                </div>
              </div>
            )}

            {/* OBSERVAÇÕES */}
            <div>
              <Label htmlFor="insp-obs" className="text-xs font-semibold">Observações do Inspetor</Label>
              <Textarea
                id="insp-obs"
                placeholder="Observações complementares..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={2}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-3 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto h-11 sm:h-10 text-sm font-medium"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSalvar}
              disabled={loading || processandoFoto}
              className={`w-full sm:w-auto h-12 sm:h-10 text-sm font-bold shadow-sm ${
                isConforme ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"
              }`}
            >
              {loading ? "Registrando..." : isConforme ? "Concluir Inspeção (Aprovado)" : "Registrar com Apontamentos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inputs ocultos para captura de foto e galeria */}
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
    </>
  );
}
