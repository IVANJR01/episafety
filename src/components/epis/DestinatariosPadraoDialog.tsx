import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { separarEmails } from "@/lib/solicitacaoMateriaisEmail";

/**
 * A lista padrão de quem recebe as solicitações de materiais.
 *
 * Morava no Cadastro Mestre, junto com CNPJ e endereço — longe de quem faz
 * o pedido e sem relação com ele. Aqui fica ao lado da solicitação, que é
 * onde se pensa "para quem isto vai". O valor continua o mesmo campo
 * (empresa_config.email_compras): nada se perde e o que já estava
 * configurado segue valendo.
 *
 * É só o PADRÃO. Cada solicitação traz o seu "Enviar para" já preenchido
 * com esta lista, e quem pede pode tirar ou pôr gente naquele pedido.
 */
export default function DestinatariosPadraoDialog({
  open, onOpenChange, empresaId,
}: { open: boolean; onOpenChange: (v: boolean) => void; empresaId: string | null }) {
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const lista = separarEmails(texto);

  useEffect(() => {
    if (!open || !empresaId) return;
    let vivo = true;
    setCarregando(true);
    (async () => {
      const { data } = await (supabase.from as any)("empresa_config")
        .select("email_compras").eq("id", empresaId).maybeSingle();
      if (vivo) {
        setTexto(((data as { email_compras?: string } | null)?.email_compras || "").trim());
        setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [open, empresaId]);

  async function salvar() {
    if (!empresaId) return;
    if (lista.invalidos.length > 0) {
      toast.error("Corrija os endereços antes de salvar", {
        description: `Sem formato de e-mail: ${lista.invalidos.join(", ")}`,
      });
      return;
    }
    setSalvando(true);
    const { error } = await (supabase.from as any)("empresa_config")
      .update({ email_compras: lista.validos.join(", ") || null })
      .eq("id", empresaId);
    setSalvando(false);
    if (error) {
      toast.error("Não foi possível salvar a lista", { description: error.message });
      return;
    }
    toast.success(lista.validos.length > 0
      ? `Lista padrão salva: ${lista.validos.length} ${lista.validos.length === 1 ? "destinatário" : "destinatários"}`
      : "Lista padrão apagada");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Destinatários padrão</DialogTitle>
          <DialogDescription>
            Toda solicitação nova já vem com esta lista no campo "Enviar para". Em cada pedido
            dá para tirar ou acrescentar alguém sem mudar a lista padrão.
          </DialogDescription>
        </DialogHeader>
        {carregando ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="destinatarios-padrao">E-mails</Label>
            <Textarea
              id="destinatarios-padrao"
              rows={4}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={"compras@empresa.com, seguranca@empresa.com\ngerencia@empresa.com"}
            />
            <p className="text-xs text-muted-foreground">
              Separe por vírgula ou um por linha.
              {lista.validos.length > 0 && ` ${lista.validos.length} ${lista.validos.length === 1 ? "destinatário" : "destinatários"}.`}
              {lista.invalidos.length > 0 && (
                <span className="text-destructive"> Sem formato de e-mail: {lista.invalidos.join(", ")}</span>
              )}
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || carregando}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
