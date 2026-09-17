import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  definirAutomacaoDoContato,
  enviarMensagem,
  lerConfigWhatsapp,
  listarContatos,
  listarMensagens,
  salvarConfigWhatsapp,
  type ConfigLinha,
  type Contato,
  type Mensagem,
} from "@/lib/whatsappDados";
import { assinarTabela } from "@/lib/realtimeTabelas";
import { horaDaMensagem, janelaAberta, telefoneLegivel, tempoRestanteJanela } from "@/lib/janelaWhatsapp";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Bot, MessageCircle, Search, Send, Settings, User } from "lucide-react";
import { toast } from "sonner";

/**
 * Atendimento por WhatsApp, dentro do sistema.
 *
 * A automação já respondia sozinha (supabase/functions/whatsapp-webhook); o que
 * faltava era o lugar de ver e assumir a conversa. É esta tela.
 *
 * Duas coisas governam o que ela deixa fazer, e ambas vêm da Meta, não de uma
 * escolha de produto:
 *
 * 1. A janela de 24h. Texto livre só até 24h depois da última mensagem do
 *    cliente. A tela avisa antes de a pessoa escrever; quem recusa de verdade é
 *    a Edge Function, com 409.
 * 2. Quem está respondendo. Enquanto `automacao_ativa` do contato estiver
 *    ligada, a IA responde toda mensagem que chega. Mandar uma mensagem à mão
 *    numa conversa assim faria os dois falarem juntos — por isso assumir a
 *    conversa desliga a IA, e o botão diz isso.
 */

function QuemRespondeu({ mensagem }: { mensagem: Mensagem }) {
  if (mensagem.direcao !== "saida") return null;
  const rotulo =
    mensagem.origem === "ia" ? "IA" : mensagem.origem === "sistema" ? "Automático" : "Você";
  return <span className="opacity-70">{rotulo} · </span>;
}

export default function Atendimento() {
  const { empresaId, isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [contatoId, setContatoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [configAberta, setConfigAberta] = useState(false);
  const fimDaLista = useRef<HTMLDivElement>(null);

  // ---- configuração da linha ----
  const { data: config, isLoading: carregandoConfig } = useQuery({
    queryKey: ["whatsapp_config", empresaId],
    enabled: !!empresaId,
    queryFn: lerConfigWhatsapp,
  });

  // ---- conversas ----
  const { data: contatos = [], isLoading: carregandoContatos } = useQuery({
    queryKey: ["whatsapp_contatos", empresaId],
    enabled: !!empresaId,
    queryFn: () => listarContatos(),
  });

  const contato = useMemo(
    () => contatos.find((c) => c.id === contatoId) ?? null,
    [contatos, contatoId],
  );

  const { data: mensagens = [], isLoading: carregandoMensagens } = useQuery({
    queryKey: ["whatsapp_mensagens", contatoId],
    enabled: !!contatoId,
    queryFn: () => listarMensagens(contatoId as string),
  });

  /*
   * Conversa que não se atualiza sozinha não serve para atendimento: a pessoa
   * ficaria apertando "atualizar" enquanto o cliente digita. O canal é o mesmo
   * compartilhado do resto do sistema (um por tabela).
   */
  useEffect(() => {
    const cancelarMensagens = assinarTabela("whatsapp_mensagens", () => {
      qc.invalidateQueries({ queryKey: ["whatsapp_mensagens"] });
      qc.invalidateQueries({ queryKey: ["whatsapp_contatos", empresaId] });
    });
    const cancelarContatos = assinarTabela("whatsapp_contatos", () => {
      qc.invalidateQueries({ queryKey: ["whatsapp_contatos", empresaId] });
    });
    return () => {
      cancelarMensagens();
      cancelarContatos();
    };
  }, [qc, empresaId]);

  // Mensagem nova entra embaixo; a conversa acompanha sem ninguém rolar.
  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length, contatoId]);

  // ---- ações ----
  const enviar = useMutation({
    mutationFn: (texto: string) => enviarMensagem(contatoId as string, texto),
    onSuccess: () => {
      setRascunho("");
      qc.invalidateQueries({ queryKey: ["whatsapp_mensagens", contatoId] });
      qc.invalidateQueries({ queryKey: ["whatsapp_contatos", empresaId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const alternarAutomacaoDoContato = useMutation({
    mutationFn: async (ativa: boolean) => {
      await definirAutomacaoDoContato(contatoId as string, ativa);
      return ativa;
    },
    onSuccess: (ativa) => {
      toast.success(ativa ? "A IA voltou a responder esta conversa" : "Conversa assumida — a IA não responde mais aqui");
      qc.invalidateQueries({ queryKey: ["whatsapp_contatos", empresaId] });
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível mudar quem responde"),
  });

  const salvarConfig = useMutation({
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

  // ---- estado derivado ----
  const listaFiltrada = contatos.filter((c) => {
    if (!busca) return true;
    const alvo = busca.toLowerCase();
    return (c.nome || "").toLowerCase().includes(alvo) || c.wa_id.includes(busca.replace(/\D+/g, ""));
  });

  const aberta = janelaAberta(contato?.ultima_entrada_em);
  const restante = tempoRestanteJanela(contato?.ultima_entrada_em);
  const podeEnviar = Boolean(contatoId) && aberta && !enviar.isPending && rascunho.trim().length > 0;

  // ---- linha não configurada ----
  if (!carregandoConfig && !config) {
    return (
      <div className="p-4 sm:p-6">
        <PageHeader title="Atendimento WhatsApp" subtitle="Conversas da linha do WhatsApp Business" />
        <EmptyState
          icon={MessageCircle}
          title="Nenhuma linha de WhatsApp configurada"
          description={
            "O número da empresa ainda não foi ligado ao sistema. O passo a passo — app na Meta, os três segredos e o cadastro da linha — está no arquivo WHATSAPP_AUTOMACAO.md do projeto."
          }
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Atendimento WhatsApp"
        subtitle={
          config?.numero_exibicao
            ? `Linha ${config.numero_exibicao}${config.automacao_ativa ? "" : " · automação desligada"}`
            : "Conversas da linha do WhatsApp Business"
        }
        actions={
          <Button variant="outline" onClick={() => setConfigAberta(true)}>
            <Settings className="w-4 h-4 mr-2" />
            Configuração
          </Button>
        }
      />

      {config && !config.automacao_ativa && (
        <Card className="mb-4 border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-3 text-sm text-muted-foreground">
            A automação está <strong>desligada</strong> para toda a linha: as mensagens continuam chegando e
            sendo gravadas, mas ninguém responde até alguém responder por aqui.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* ---------- lista de conversas ---------- */}
        <Card className={contatoId ? "hidden lg:block" : ""}>
          <CardContent className="p-3">
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nome ou número"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>

            {carregandoContatos ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Carregando conversas…</p>
            ) : listaFiltrada.length === 0 ? (
              <EmptyState
                bare
                icon={MessageCircle}
                title={busca ? "Nada encontrado" : "Nenhuma conversa ainda"}
                description={busca ? undefined : "Assim que alguém mandar mensagem para a linha, a conversa aparece aqui."}
              />
            ) : (
              <ScrollArea className="h-[calc(100vh-22rem)] lg:h-[calc(100vh-18rem)] pr-2">
                <div className="space-y-1">
                  {listaFiltrada.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setContatoId(c.id)}
                      className={`w-full text-left rounded-md px-3 py-2 transition-colors ${
                        c.id === contatoId ? "bg-accent" : "hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">
                          {c.nome || telefoneLegivel(c.wa_id)}
                        </span>
                        {c.automacao_ativa ? (
                          <Bot className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-label="IA respondendo" />
                        ) : (
                          <User className="w-3.5 h-3.5 shrink-0 text-primary" aria-label="Atendimento humano" />
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground truncate">
                          {telefoneLegivel(c.wa_id)}
                        </span>
                        {c.ultima_mensagem_em && (
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            {horaDaMensagem(c.ultima_mensagem_em)}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* ---------- conversa ---------- */}
        <Card className={contatoId ? "" : "hidden lg:block"}>
          <CardContent className="p-0 flex flex-col h-[calc(100vh-16rem)]">
            {!contato ? (
              <div className="flex-1 flex items-center justify-center">
                <EmptyState
                  bare
                  icon={MessageCircle}
                  title="Escolha uma conversa"
                  description="As mensagens aparecem aqui, e chegam sozinhas enquanto a tela estiver aberta."
                />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 border-b p-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    onClick={() => setContatoId(null)}
                    aria-label="Voltar para a lista"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">
                      {contato.nome || telefoneLegivel(contato.wa_id)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {telefoneLegivel(contato.wa_id)}
                      {contato.cliente_comercial_id && " · cliente cadastrado"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={contato.automacao_ativa ? "secondary" : "default"}>
                      {contato.automacao_ativa ? "IA respondendo" : "Você responde"}
                    </Badge>
                    {/* Assumir a conversa desliga a IA. Sem isso os dois
                        responderiam a mesma mensagem, um por cima do outro. */}
                    <Switch
                      checked={!contato.automacao_ativa}
                      onCheckedChange={(assumir) => alternarAutomacaoDoContato.mutate(!assumir)}
                      disabled={alternarAutomacaoDoContato.isPending}
                      aria-label="Assumir a conversa"
                    />
                  </div>
                </div>

                <ScrollArea className="flex-1 p-4">
                  {carregandoMensagens ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Carregando mensagens…</p>
                  ) : (
                    <div className="space-y-2">
                      {mensagens.map((m) => (
                        <div
                          key={m.id}
                          className={`flex ${m.direcao === "entrada" ? "justify-start" : "justify-end"}`}
                        >
                          <div
                            className={`max-w-[85%] sm:max-w-[70%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                              m.direcao === "entrada"
                                ? "bg-muted text-foreground"
                                : m.status === "falhou"
                                  ? "bg-destructive/10 text-foreground border border-destructive/40"
                                  : "bg-primary text-primary-foreground"
                            }`}
                          >
                            {m.texto}
                            <div className="text-[11px] mt-1 opacity-80">
                              <QuemRespondeu mensagem={m} />
                              {horaDaMensagem(m.created_at)}
                              {m.status === "falhou" && ` · não enviada${m.erro ? `: ${m.erro}` : ""}`}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={fimDaLista} />
                    </div>
                  )}
                </ScrollArea>

                <div className="border-t p-3">
                  {!aberta ? (
                    /* Não é limite do sistema: é regra da Meta, e o texto diz
                       qual é a saída, senão vira "o WhatsApp não funciona". */
                    <div className="text-sm text-muted-foreground">
                      Passaram mais de 24 horas desde a última mensagem deste contato. A Meta só aceita
                      texto livre dentro dessa janela — para reabrir a conversa é preciso um{" "}
                      <strong>template aprovado</strong>. Enquanto não houver um cadastrado, quem precisa
                      falar primeiro é o cliente.
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <Textarea
                          value={rascunho}
                          onChange={(e) => setRascunho(e.target.value)}
                          onKeyDown={(e) => {
                            // Enter envia, Shift+Enter quebra linha — é o que a
                            // mão de quem atende já espera do WhatsApp.
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              if (podeEnviar) enviar.mutate(rascunho.trim());
                            }
                          }}
                          placeholder="Escreva a resposta…"
                          className="min-h-[60px] max-h-40 resize-none"
                        />
                        <Button
                          onClick={() => enviar.mutate(rascunho.trim())}
                          disabled={!podeEnviar}
                          aria-label="Enviar"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                        <span>
                          {contato.automacao_ativa
                            ? "A IA ainda responde esta conversa — assuma no botão acima antes de escrever."
                            : "Você está respondendo esta conversa."}
                        </span>
                        {restante && <span className="shrink-0 ml-2">Janela fecha em {restante}</span>}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---------- configuração ---------- */}
      <Dialog open={configAberta} onOpenChange={setConfigAberta}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configuração da linha</DialogTitle>
            <DialogDescription>
              O identificador da linha vem da Meta e não se inventa aqui. As instruções são o que a IA
              usa para responder no lugar da sua equipe.
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
                  onCheckedChange={(v) => salvarConfig.mutate({ automacao_ativa: v })}
                  disabled={salvarConfig.isPending}
                />
              </div>

              <div>
                <Label htmlFor="numero">Número exibido</Label>
                <Input
                  id="numero"
                  defaultValue={config.numero_exibicao ?? ""}
                  onBlur={(e) => {
                    if (e.target.value !== (config.numero_exibicao ?? "")) {
                      salvarConfig.mutate({ numero_exibicao: e.target.value });
                    }
                  }}
                  placeholder="+55 85 99999-9999"
                />
              </div>

              <div>
                <Label htmlFor="saudacao">Saudação (primeira mensagem de quem nunca falou)</Label>
                <Textarea
                  id="saudacao"
                  defaultValue={config.saudacao ?? ""}
                  onBlur={(e) => {
                    if (e.target.value !== (config.saudacao ?? "")) {
                      salvarConfig.mutate({ saudacao: e.target.value || null });
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
                      salvarConfig.mutate({ prompt_extra: e.target.value || null });
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

              <div className="text-xs text-muted-foreground border-t pt-3">
                Identificador da linha na Meta: <code>{config.phone_number_id}</code>
                {!isSuperAdmin && " · trocar a linha é coisa de administrador do sistema."}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigAberta(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
