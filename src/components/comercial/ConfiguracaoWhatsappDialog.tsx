import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { listarTemplatesAprovados, salvarConfigWhatsapp, type ConfigLinha } from "@/lib/whatsappDados";
import { juntarNumeros, partirNumeros } from "@/lib/janelaWhatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

/**
 * Configuração da linha de WhatsApp da empresa.
 *
 * Saiu de dentro da tela de atendimento quando ganhou a parte do aviso de
 * vencimento: são duas coisas diferentes — como a IA atende e o que o sistema
 * dispara sozinho — e a tela de conversa não precisa carregar as duas.
 *
 * Os campos salvam ao sair do foco, sem botão de salvar. É formulário de
 * ajuste, não de cadastro: quem mexe aqui muda uma coisa e fecha.
 */

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  config: ConfigLinha | null;
  podeTrocarLinha: boolean;
}

export default function ConfiguracaoWhatsappDialog({ aberto, aoFechar, config, podeTrocarLinha }: Props) {
  const qc = useQueryClient();
  const { empresaId } = useAuth();

  const salvar = useMutation({
    mutationFn: async (mudancas: Partial<ConfigLinha>) => {
      if (!config?.id) throw new Error("Linha ainda não cadastrada");
      await salvarConfigWhatsapp(config.id, mudancas);
    },
    onSuccess: () => {
      toast.success("Configuração salva");
      qc.invalidateQueries({ queryKey: ["whatsapp_config", empresaId] });
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível salvar"),
  });

  // Só busca os templates quando o aviso está ligado: quem não usa não precisa
  // esperar uma consulta à Meta para abrir a configuração.
  const { data: templates = [] } = useQuery({
    queryKey: ["whatsapp_templates", empresaId],
    enabled: aberto && Boolean(config?.alertas_ativos) && Boolean(config?.waba_id),
    queryFn: listarTemplatesAprovados,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuração da linha</DialogTitle>
          <DialogDescription>
            Os identificadores vêm da Meta e não se inventam aqui. As instruções são o que a IA usa para
            responder no lugar da sua equipe.
          </DialogDescription>
        </DialogHeader>

        {config && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="pr-3">
                <Label className="text-sm">Automação ligada</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Desligada, as mensagens continuam chegando e ninguém responde automaticamente.
                </p>
              </div>
              <Switch
                checked={config.automacao_ativa}
                onCheckedChange={(v) => salvar.mutate({ automacao_ativa: v })}
                disabled={salvar.isPending}
              />
            </div>

            <div>
              <Label htmlFor="numero">Número exibido</Label>
              <Input
                id="numero"
                defaultValue={config.numero_exibicao ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (config.numero_exibicao ?? "")) {
                    salvar.mutate({ numero_exibicao: e.target.value });
                  }
                }}
                placeholder="+55 85 99999-9999"
              />
            </div>

            <div>
              <Label htmlFor="waba">Conta do WhatsApp Business (WABA ID)</Label>
              <Input
                id="waba"
                defaultValue={config.waba_id ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (config.waba_id ?? "")) {
                    salvar.mutate({ waba_id: e.target.value || null });
                  }
                }}
                placeholder="102290129340398"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Sem ele não dá para listar os templates aprovados. Aparece no painel da Meta, em
                WhatsApp → Configuração da API.
              </p>
            </div>

            <div>
              <Label htmlFor="saudacao">Saudação (primeira mensagem de quem nunca falou)</Label>
              <Textarea
                id="saudacao"
                defaultValue={config.saudacao ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (config.saudacao ?? "")) {
                    salvar.mutate({ saudacao: e.target.value || null });
                  }
                }}
                placeholder="Olá! Aqui é da Safety Soluções, segurança do trabalho. Como posso ajudar?"
                className="min-h-[70px]"
              />
            </div>

            <div>
              <Label htmlFor="prompt">Instruções para a IA</Label>
              <Textarea
                id="prompt"
                defaultValue={config.prompt_extra ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (config.prompt_extra ?? "")) {
                    salvar.mutate({ prompt_extra: e.target.value || null });
                  }
                }}
                placeholder="Serviços que vendemos, região atendida, prazo de orçamento, o que nunca prometer."
                className="min-h-[140px]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                É o que separa um atendente genérico do atendente da sua operação. Vale escrever com
                calma: serviços, região, prazo, e o que a IA não pode prometer.
              </p>
            </div>

            {/* ---------- aviso de vencimento ---------- */}
            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="pr-3">
                  <Label className="text-sm">Avisar vencimentos por WhatsApp</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    O resumo diário do Arquivo Digital, que já sai por e-mail, vai também por WhatsApp.
                    A Meta cobra por conversa iniciada pela empresa.
                  </p>
                </div>
                <Switch
                  checked={config.alertas_ativos}
                  onCheckedChange={(v) => salvar.mutate({ alertas_ativos: v })}
                  disabled={salvar.isPending}
                />
              </div>

              {config.alertas_ativos && (
                <>
                  <div>
                    <Label htmlFor="numeros">Quem recebe</Label>
                    <Input
                      id="numeros"
                      defaultValue={juntarNumeros(config.numeros_alerta)}
                      onBlur={(e) => {
                        const numeros = partirNumeros(e.target.value);
                        if (juntarNumeros(numeros) !== juntarNumeros(config.numeros_alerta)) {
                          salvar.mutate({ numeros_alerta: numeros });
                        }
                      }}
                      placeholder="85 99999-0000, 85 98888-1111"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Separados por vírgula. Sem DDI, entra o 55 automaticamente.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="template-alerta">Template do aviso</Label>
                    <Select
                      value={config.template_alerta ?? ""}
                      onValueChange={(v) => salvar.mutate({ template_alerta: v })}
                    >
                      <SelectTrigger id="template-alerta">
                        <SelectValue placeholder={config.waba_id ? "Escolha um template aprovado" : "Preencha o WABA ID acima"} />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.nome} value={t.nome}>
                            {t.nome} ({t.idioma})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Quem recebe o resumo quase nunca escreveu nas últimas 24h, e fora dessa janela a
                      Meta só aceita template. Os campos numerados são preenchidos nesta ordem:{" "}
                      <code>{"{{1}}"}</code> empresa, <code>{"{{2}}"}</code> vencidos,{" "}
                      <code>{"{{3}}"}</code> vencendo, <code>{"{{4}}"}</code> total,{" "}
                      <code>{"{{5}}"}</code> data.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="text-xs text-muted-foreground border-t pt-3">
              Identificador da linha na Meta: <code>{config.phone_number_id}</code>
              {!podeTrocarLinha && " · trocar a linha é coisa de administrador do sistema."}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
