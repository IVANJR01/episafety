import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/**
 * Vitrine: monta telas internas do sistema com dados fictícios, só para
 * tirar print de divulgação.
 *
 * Não entra no build do produto — roda por fora, com `npm run vitrine`.
 * O que ela renderiza são os componentes DE VERDADE: a tela é a mesma que
 * o cliente usa, trocando apenas de onde vêm os dados. Assim o print da
 * página de vendas nunca é um desenho, e também nunca leva informação de
 * cliente, porque nenhuma consulta sai daqui.
 */
const vit = __dirname;
const raiz = path.resolve(__dirname, "../..");

export default defineConfig({
  root: vit,
  plugins: [react()],
  resolve: {
    alias: [
      /* As quatro portas por onde a tela falaria com o servidor. */
      { find: "@/integrations/supabase/client", replacement: `${vit}/stubSupabase.ts` },
      { find: "@/contexts/AuthContext", replacement: `${vit}/stubAuth.ts` },
      { find: "@/hooks/usePermissions", replacement: `${vit}/stubPermissoes.ts` },
      { find: "@/hooks/useSupabaseData", replacement: `${vit}/stubHooks.tsx` },
      { find: "@", replacement: path.resolve(raiz, "src") },
    ],
  },
  build: { outDir: `${vit}/dist`, emptyOutDir: true },
});
