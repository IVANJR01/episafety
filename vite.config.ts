import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "child_process";
import { writeFileSync, mkdirSync, readFileSync, readdirSync, statSync } from "fs";

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

/*
 * Lista dos arquivos do aplicativo que precisam existir no aparelho para ele
 * abrir sem internet.
 *
 * É montada lendo o resultado do build, não escrita à mão: os nomes em
 * /assets levam hash e mudam a cada publicação, então qualquer lista fixa
 * nasceria errada.
 */
const LIMITE_ARQUIVO_BYTES = 600 * 1024;
const FORA_DO_PACOTE = new Set([
  "/version.json",      // é justamente o arquivo que diz se o cache está velho
  "/sw.js",             // o próprio service worker
  "/service-worker.js", // interruptor do service worker antigo
  "/robots.txt",
  "/pwa-base-logo.png", // arte de origem, 700 KB, não usada em tela
]);
/*
 * Passa do limite de tamanho, mas entra assim mesmo: é o logo do topo, que
 * aparece em toda tela. Sem ele o sistema abre sem internet com o cabeçalho
 * vazio — funciona, mas parece quebrado.
 *
 * (O arquivo tem 860 KB para ser exibido a 48 px. Reduzi-lo é ganho para
 * todo mundo, com ou sem internet, mas mexer na arte é outra conversa.)
 */
const SEMPRE_NO_PACOTE = new Set([
  "/marca/8df588ff-740d-4376-9653-dc6f07556c80.png",
]);
const EXTENSOES_GUARDAVEIS = new Set([
  ".html", ".js", ".css", ".json", ".png", ".jpg", ".jpeg", ".svg", ".webp",
  ".ico", ".woff", ".woff2",
]);

function listarArquivosDoPacote(raiz: string): string[] {
  const achados: string[] = [];

  const percorrer = (dir: string, prefixo: string) => {
    for (const nome of readdirSync(dir)) {
      const caminho = path.join(dir, nome);
      const url = `${prefixo}/${nome}`;
      const info = statSync(caminho);
      if (info.isDirectory()) {
        percorrer(caminho, url);
        continue;
      }
      if (FORA_DO_PACOTE.has(url)) continue;
      const ext = path.extname(nome).toLowerCase();
      if (!EXTENSOES_GUARDAVEIS.has(ext)) continue;
      // O pacote do aplicativo (/assets) entra inteiro, custe o que custar —
      // sem ele não há aplicativo. O resto é imagem solta, e imagem grande no
      // cache offline atrapalha mais do que ajuda.
      if (!url.startsWith("/assets/") && !SEMPRE_NO_PACOTE.has(url)
        && info.size > LIMITE_ARQUIVO_BYTES) continue;
      achados.push(url);
    }
  };

  percorrer(raiz, "");
  return achados.sort();
}

/**
 * Escreve dist/sw.js a partir de src/sw/servicoOffline.js, injetando a lista de
 * arquivos e o id da versão. O service worker fica sendo um arquivo comum do
 * projeto — dá para ler e testar — e só o que ele não tem como saber sozinho
 * vem do build.
 */
function pluginServiceWorker(id: string) {
  return {
    name: "episafety-service-worker",
    closeBundle() {
      try {
        const corpo = readFileSync(path.resolve(__dirname, "src/sw/servicoOffline.js"), "utf-8");
        const arquivos = listarArquivosDoPacote(path.resolve(__dirname, "dist"));
        const cabecalho =
          `// Gerado pelo build a partir de src/sw/servicoOffline.js. Não editar aqui.\n` +
          `self.__VERSAO_BUILD__ = ${JSON.stringify(id)};\n` +
          `self.__ARQUIVOS_PRECACHE__ = ${JSON.stringify(arquivos)};\n\n`;
        writeFileSync(path.resolve(__dirname, "dist/sw.js"), cabecalho + corpo, "utf-8");
        console.log(`[episafety] service worker gerado com ${arquivos.length} arquivos offline`);
      } catch (erro) {
        // Sem cópia offline o aplicativo ainda funciona com internet; falhar o
        // build inteiro por causa disto seria pior.
        console.warn("[episafety] não foi possível gerar o service worker:", erro);
      }
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
  plugins: [react(), pluginVersao(BUILD_ID), pluginServiceWorker(BUILD_ID)],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
