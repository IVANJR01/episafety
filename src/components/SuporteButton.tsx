import { useState } from "react";
import { LifeBuoy, MessageCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  SUPPORT_CHANNELS,
  supportWhatsappUrl,
  supportMailtoUrl,
} from "@/lib/termsConfig";

interface SuporteButtonProps {
  variant?: "sidebar" | "icon" | "menu";
  className?: string;
}

export default function SuporteButton({ variant = "icon", className = "" }: SuporteButtonProps) {
  const [open, setOpen] = useState(false);

  const trigger =
    variant === "sidebar" ? (
      <button
        onClick={() => setOpen(true)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors ${className}`}
      >
        <LifeBuoy className="w-4 h-4" />
        <span>Suporte</span>
      </button>
    ) : variant === "menu" ? (
      <button
        onClick={() => setOpen(true)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors ${className}`}
      >
        <LifeBuoy className="w-4 h-4" />
        <span>Suporte</span>
      </button>
    ) : (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Suporte"
        className={className}
      >
        <LifeBuoy className="w-5 h-5" />
      </Button>
    );

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-primary" />
              Suporte SafetySoluções
            </DialogTitle>
            <DialogDescription>
              Precisa de ajuda? Fale com o nosso time pelos canais oficiais.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 pt-2">
            <a
              href={supportWhatsappUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">WhatsApp</div>
                <div className="text-xs text-muted-foreground truncate">
                  {SUPPORT_CHANNELS.whatsappDisplay}
                </div>
              </div>
            </a>

            <a
              href={supportMailtoUrl()}
              className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">E-mail</div>
                <div className="text-xs text-muted-foreground truncate">
                  {SUPPORT_CHANNELS.email}
                </div>
              </div>
            </a>
          </div>

          <p className="text-xs text-muted-foreground text-center pt-2">
            Horário de atendimento: segunda a sexta, 8h às 18h.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
