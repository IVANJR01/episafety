import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { enviarTemplate, listarTemplatesAprovados } from "@/lib/whatsappDados";
import {
  camposDoTemplate,
  previaDoTemplate,
  rodapeDoTemplate,
  rotuloDoCampo,
  templateCompleto,
  SEM_VALORES,
  type TemplateWhatsapp,
  type ValoresTemplate,
} from "@/lib/templatesWhatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Send } from "lucide-react";
import { toast } from "sonner";

/**
 * Escolher, preencher e enviar um template aprovado.
 *
 * É a única forma de falar com quem não escreve há mais de 24 horas — a Meta
 * não aceita texto livre fora dessa janela. O que a tela precisa deixar claro,
 * e por isso existe a prévia: template é texto aprovado palavra por palavra, e
 * o que dá para mudar são só os campos entre chaves.
 *
 * A lista vem da Meta a cada abertura (com cache curto), nunca de uma cópia no
 * banco: template é pausado e reprovado lá, e oferecer um que não vale mais
 * seria descobrir o problema no envio — sem segunda chance, porque a conversa
 * está fechada.
 */

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  contatoId: string | null;
  nomeDoContato: string;
}

export default function EnviarTemplateDialog({ aberto, aoFechar, contatoId, nomeDoContato }: Props) {
  const qc = useQueryClient();
  const { empresaId } = useAuth();
  const [escolhido, setEscolhido] = useState<string>("");
  const [valores, setValores] = useState<ValoresTemplate>(SEM_VALORES);

  const { data: templates = [], isLoading, error } = useQuery({
    // Com a empresa na chave, trocar de empresa não mostra os templates da
    // anterior — eles são de outra conta na Meta.
    queryKey: ["whatsapp_templates", empresaId],
    enabled: aberto,
    queryFn: listarTemplatesAprovados,
    // Cinco minutos: tempo de abrir e fechar a janela várias vezes sem bater na
    // Meta a cada vez, e curto o bastante para um template novo aparecer.
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const template = useMemo<TemplateWhatsapp | null>(
    () => templates.find((t) => `${t.nome}|${t.idioma}` === escolhido) ?? null,
    [templates, escolhido],
  );

  // Trocou de template, os valores do anterior não servem: os marcadores são
  // outros, e sobrariam campos preenchidos com o texto errado.
  useEffect(() => {
    setValores(SEM_VALORES);
  }, [escolhido]);

  useEffect(() => {
    if (!aberto) {
      setEscolhido("");
      setValores(SEM_VALORES);
    }
  }, [aberto]);

  const campos = template ? camposDoTemplate(template) : { cabecalho: [], corpo: [] };
  const completo = template ? templateCompleto(template, valores) : false;

  const enviar = useMutation({
    mutationFn: async () => {
      if (!contatoId || !template) throw new Error("Escolha um template");
      await enviarTemplate(contatoId, template, valores);
    },
    onSuccess: () => {
      toast.success("Template enviado");
      qc.invalidateQueries({ queryKey: ["whatsapp_mensagens", contatoId] });
      qc.invalidateQueries({ queryKey: ["whatsapp_contatos"] });
      aoFechar();
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao enviar o template"),
  });

  function mudarValor(onde: "cabecalho" | "corpo", marcador: string, valor: string) {
    setValores((atual) => ({ ...atual, [onde]: { ...atual[onde], [marcador]: valor } }));
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar template</DialogTitle>
          <DialogDescription>
            Para {nomeDoContato}. O texto foi aprovado pela Meta e não pode ser alterado — só os campos
            entre chaves.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Consultando os templates aprovados…</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum template aprovado nesta conta. Eles se criam no painel da Meta, em{" "}
            <em>WhatsApp → Modelos de mensagem</em>, e passam por aprovação antes de aparecerem aqui.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="template">Template</Label>
              <Select value={escolhido} onValueChange={setEscolhido}>
                <SelectTrigger id="template">
                  <SelectValue placeholder="Escolha um template aprovado" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={`${t.nome}|${t.idioma}`} value={`${t.nome}|${t.idioma}`}>
                      {t.nome} ({t.idioma})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {template && (
              <>
                {campos.cabecalho.map((marcador) => (
                  <div key={`cab-${marcador}`}>
                    <Label htmlFor={`cab-${marcador}`}>
                      Cabeçalho — {rotuloDoCampo(marcador)}
                    </Label>
                    <Input
                      id={`cab-${marcador}`}
                      value={valores.cabecalho[marcador] ?? ""}
                      onChange={(e) => mudarValor("cabecalho", marcador, e.target.value)}
                    />
                  </div>
                ))}

                {campos.corpo.map((marcador) => (
                  <div key={`corpo-${marcador}`}>
                    <Label htmlFor={`corpo-${marcador}`}>{rotuloDoCampo(marcador)}</Label>
                    <Input
                      id={`corpo-${marcador}`}
                      value={valores.corpo[marcador] ?? ""}
                      onChange={(e) => mudarValor("corpo", marcador, e.target.value)}
                    />
                  </div>
                ))}

                {/* A prévia é o ponto da tela: ninguém envia com segurança um
                    texto que só existe dentro do painel da Meta. */}
                <div>
                  <Label>Como o cliente vai receber</Label>
                  <div className="mt-1 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm whitespace-pre-wrap break-words">
                    {previaDoTemplate(template, valores)}
                    {rodapeDoTemplate(template) && (
                      <div className="text-[11px] opacity-80 mt-1">{rodapeDoTemplate(template)}</div>
                    )}
                  </div>
                </div>

                {campos.cabecalho.length + campos.corpo.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Este template não tem campos para preencher: vai exatamente assim.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button onClick={() => enviar.mutate()} disabled={!template || !completo || enviar.isPending}>
            <Send className="w-4 h-4 mr-2" />
            {enviar.isPending ? "Enviando…" : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
