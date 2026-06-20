import { Button, ButtonProps } from "@/components/ui/button";
import { useMfaStatus } from "@/hooks/useMfaStatus";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Props extends ButtonProps {
  children: React.ReactNode;
}

/**
 * Botão que aplica gate visual de MFA para ações sensíveis (concluir, cancelar,
 * preparar envio eSocial). Se MFA for exigido + grace expirado + sem TOTP, redireciona.
 */
export default function MfaActionButton({ children, onClick, ...props }: Props) {
  const status = useMfaStatus();
  const navigate = useNavigate();

  const needsMfa = status.required && status.enforced && !status.hasMfa;

  const handle = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (needsMfa) {
      e.preventDefault();
      toast.error("MFA obrigatório", {
        description: "Configure a verificação em duas etapas antes de executar esta ação.",
      });
      navigate("/setup-mfa");
      return;
    }
    onClick?.(e);
  };

  return (
    <Button {...props} onClick={handle}>
      {needsMfa && <ShieldAlert className="h-4 w-4 mr-1" />}
      {children}
    </Button>
  );
}
