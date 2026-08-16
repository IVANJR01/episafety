import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";

/*
 * Identidade da versão publicada, gerada pelo build.
 *
 * Antes a versão era uma constante escrita à mão em src/lib/version.ts. Ela
 * ficou em "2.4.6" por 290 commits — e toda a lógica de atualização do
 * aplicativo dependia dela mudar. Como não mudava, `purgeOnVersionChange`
 * comparava a versão com ela mesma, concluía "nada novo" e nunca limpava
 * cache nem recarregava. O aplicativo instalado no celular ficava preso no
 * pacote antigo indefinidamente, e um cadastro feito nele não aparecia porque
 * o código era de antes das correções de sincronização.
 *
 * Agora sai do commit e do horário do build: muda sozinha em toda publicação,
 * que é a única forma de não depender de alguém lembrar.
 */
function idDoBuild(): string {
  let commit = "sem-git";
  try {
    commit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString().trim();
  } catch { /* build fora de repositório: o horário sozinho já distingue */ }
  return `${commit}-${Date.now().toString(36)}`;
}

/** Publica o id num arquivo pequeno, que o app consulta para saber se saiu versão nova. */
function pluginVersao(id: string) {
  return {
    name: "episafety-versao",
    closeBundle() {
      try {
        mkdirSync("dist", { recursive: true });
        writeFileSync("dist/version.json", JSON.stringify({ build: id }), "utf-8");
      } catch { /* não impedir o build por causa disto */ }
    },
  };
}

// https://vitejs.dev/config/
const BUILD_ID = idDoBuild();

export default defineConfig(() => ({
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  build: {
    sourcemap: false,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true,
        pure_funcs: ["console.info", "console.debug"],
      },
      mangle: {
        toplevel: true,
      },
      format: {
        comments: false,
      },
    },
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), pluginVersao(BUILD_ID)],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
