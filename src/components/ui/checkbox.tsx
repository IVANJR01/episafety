import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/*
 * Caixa de marcação — quadrada, e isso não é detalhe de gosto.
 *
 * O componente vinha com `rounded-sm`, que neste projeto NÃO é 2px: o tema
 * define `--radius: 0.75rem` e a escala do Tailwind calcula
 * `sm = calc(var(--radius) - 4px)` = 8px. Num quadrado de 16px, 8px de raio
 * em cada canto fecha o círculo. O resultado é que toda caixa de marcação do
 * sistema aparecia redonda, igual a botão de rádio — e botão de rádio quer
 * dizer "escolha uma", enquanto caixa quer dizer "marque quantas quiser".
 * Na tela de permissões, com quatro delas por linha, a matriz inteira lia
 * como se as opções fossem excludentes.
 *
 * Por isso o raio aqui é fixo em 4px, e não tirado do tema: é a proporção que
 * deixa o canto suave sem virar círculo, em qualquer valor de --radius.
 *
 * A borda descolorida quando desmarcada também é proposital. Antes toda caixa
 * vazia saía com a borda na cor da marca; numa lista de trinta módulos, isso
 * são cento e vinte círculos laranja pedindo atenção sem informar nada. Agora
 * a cor aparece quando a permissão está marcada, que é o que interessa ler.
 */
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-[4px] border border-input bg-background ring-offset-background transition-colors",
      "hover:border-primary/60",
      "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      "data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
      {props.checked === "indeterminate"
        ? <span className="block h-[2px] w-[8px] rounded-full bg-current" />
        /* 12px dentro de 16px: o ícone de 16px encostava nas quatro bordas. */
        : <Check className="h-3 w-3" strokeWidth={3} />}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
