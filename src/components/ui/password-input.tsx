import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Campo de senha com botão de mostrar/ocultar.
 *
 * Digitar senha às cegas no celular é a maior fonte de "minha senha não
 * funciona" — e sem poder conferir o que foi digitado, a única saída é
 * pedir recuperação. O olho resolve.
 *
 * Começa sempre oculto: quem quiser ver, pede. E volta a ocultar sozinho
 * ao desmontar, porque o estado não sobrevive à tela.
 *
 * O botão é `type="button"`: dentro de um formulário, botão sem tipo é
 * submit, e clicar no olho enviaria o login.
 */
const PasswordInput = React.forwardRef<HTMLInputElement, Omit<React.ComponentProps<"input">, "type">>(
  ({ className, ...props }, ref) => {
    const [visivel, setVisivel] = React.useState(false);

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type={visivel ? "text" : "password"}
          // Espaço à direita para o texto não passar por baixo do botão.
          className={cn("pr-10", className)}
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          // Alvo de 40px: o dedo acerta sem mirar.
          className="absolute right-0 top-0 h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          title={visivel ? "Ocultar senha" : "Mostrar senha"}
          // Fora da navegação por Tab: quem usa teclado vai do campo direto
          // para o botão de entrar, sem tropeçar no olho.
          tabIndex={-1}
        >
          {visivel ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
