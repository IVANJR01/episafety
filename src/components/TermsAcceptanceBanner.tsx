import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TERMS_VERSION } from "@/lib/termsConfig";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText } from "lucide-react";
import { toast } from "sonner";

/**
 * Banner discreto que aparece no primeiro login após atualização dos Termos.
 * NÃO bloqueia o app imediatamente — mostra um aviso; o usuário aceita e segue.
 */
export default function TermsAcceptanceBanner() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user?.id || checked) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("termos_aceites" as any)
          .select("id")
          .eq("user_id", user.id)
          .eq("versao_termos", TERMS_VERSION)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          // Se falhar leitura, não travar — silencioso.
          setChecked(true);
          return;
        }
        if (!data) setOpen(true);
        setChecked(true);
      } catch {
        setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, checked]);

  async function handleAccept() {
    if (!user?.id || !accepted) return;
    setSaving(true);
    try {
      const empresaId = localStorage.getItem("active_empresa_id");
      const { error } = await supabase.from("termos_aceites" as any).insert({
        user_id: user.id,
        empresa_id: empresaId || null,
        versao_termos: TERMS_VERSION,
        user_agent: navigator.userAgent.slice(0, 500),
      });
      if (error) throw error;
      toast.success("Termos aceitos. Obrigado!");
      setOpen(false);
    } catch (e: any) {
      toast.error("Não foi possível registrar o aceite: " + (e?.message ?? "erro"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && setOpen(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Atualizamos nossos Termos de Uso
          </DialogTitle>
          <DialogDescription>
            Publicamos a versão {TERMS_VERSION} dos Termos de Uso e Política de Privacidade.
            Para continuar utilizando o SafetySoluções, por favor leia e aceite.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              to="/termos"
              target="_blank"
              className="text-primary hover:underline font-medium"
            >
              Ler Termos de Uso →
            </Link>
            <Link
              to="/privacidade"
              target="_blank"
              className="text-primary hover:underline font-medium"
            >
              Ler Política de Privacidade →
            </Link>
          </div>

          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={accepted}
              onCheckedChange={(v) => setAccepted(Boolean(v))}
              className="mt-0.5"
            />
            <span>
              Li e aceito os <strong>Termos de Uso</strong> e a{" "}
              <strong>Política de Privacidade</strong> (versão {TERMS_VERSION}).
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Depois
            </Button>
            <Button onClick={handleAccept} disabled={!accepted || saving}>
              {saving ? "Registrando..." : "Aceitar e continuar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
