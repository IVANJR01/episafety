/**
 * As marcações de prévia de link da página de vendas.
 *
 * O site é uma aplicação de página única: tudo é servido pelo index.html
 * e o navegador monta a tela depois. Só que WhatsApp, LinkedIn e
 * Facebook, quando alguém cola um link, NÃO executam JavaScript — eles
 * leem o HTML cru e vão embora. Por isso o link da página de vendas
 * aparecia com o título genérico do sistema, e o ajuste de título que a
 * própria página faz ao abrir não mudava nada na prévia.
 *
 * Esta função recebe o HTML gerado pelo build e devolve a versão da
 * página de vendas: mesmo pacote JavaScript, outras marcações. O build
 * grava o resultado em dist/planos.html e o vercel.json manda /planos
 * para lá.
 *
 * Fica aqui, e não dentro do vite.config, porque é regra: o link que
 * circula no WhatsApp é a primeira coisa que o cliente vê da empresa.
 */

export const META_DA_PAGINA_DE_VENDAS = {
  rota: "/planos",
  titulo: "Gestão e Ficha de EPIs — SafetySoluções",
  descricao:
    "O sistema recusa EPI com CA vencido e gera a ficha individual em PDF, " +
    "assinada pelo colaborador e pronta para a fiscalização. NR-06 e art. 166 " +
    "da CLT. R$ 2,50 por colaborador/mês.",
  imagem: "/marca/og-planos.png",
  site: "https://safetysolucoes.com",
} as const;

/**
 * O Pixel da Meta, só nesta página.
 *
 * Ele fica na página de vendas e em lugar nenhum mais. O resto do
 * sistema trata nome, CPF, exame médico e ficha de EPI de trabalhador —
 * dado pessoal, e dado de saúde, que a LGPD trata como sensível. Nada
 * disso passa por rastreador de anúncio.
 *
 * Por isso o pixel entra aqui, na função que gera o dist/planos.html, e
 * não no index.html, que é o que serve o sistema inteiro.
 */
export const PIXEL_DA_META = "1734362404017048";

/** Só dígitos: um id torto viraria script quebrado na página. */
function idDePixelValido(id: string): boolean {
  return /^[0-9]{6,20}$/.test(id.trim());
}

/** O trecho do Pixel, exatamente como a Meta publica. */
export function marcacaoDoPixelDaMeta(id: string): string {
  if (!idDePixelValido(id)) return "";
  const pixel = id.trim();

  return `  <!-- Meta Pixel Code -->
  <script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '${pixel}');
  fbq('track', 'PageView');
  </script>
  <noscript><img height="1" width="1" style="display:none"
  src="https://www.facebook.com/tr?id=${pixel}&amp;ev=PageView&amp;noscript=1"
  /></noscript>
  <!-- End Meta Pixel Code -->
`;
}

/**
 * Abre a política de segurança desta página para o Pixel.
 *
 * O index.html traz uma Content-Security-Policy que só permite script do
 * próprio site. Hoje ela está em modo "report-only" — avisa e deixa
 * passar —, mas o comentário no próprio arquivo diz que vai virar
 * obrigatória. No dia em que virar, o Pixel para de carregar sem avisar
 * ninguém, e a conta de anúncio simplesmente deixa de receber visita.
 *
 * Então a liberação entra junto com o Pixel, na mesma página e só nela:
 * o sistema continua com a política fechada.
 */
const HOSTS_DO_PIXEL = {
  script: "https://connect.facebook.net",
  conexao: "https://www.facebook.com https://connect.facebook.net",
};

export function liberarPixelNaPolitica(html: string): string {
  return html.replace(
    /(<meta http-equiv="Content-Security-Policy(?:-Report-Only)?" content=")([^"]*)(")/,
    (_todo, abre, politica: string, fecha) => {
      let nova = politica;
      /* Já liberado: mexer de novo só repetiria o host na diretiva. */
      if (!nova.includes(HOSTS_DO_PIXEL.script)) {
        nova = nova.replace(/script-src ([^;]*)/, `script-src $1 ${HOSTS_DO_PIXEL.script}`);
      }
      if (!nova.includes("https://www.facebook.com")) {
        nova = nova.replace(/connect-src ([^;]*)/, `connect-src $1 ${HOSTS_DO_PIXEL.conexao}`);
      }
      return `${abre}${nova}${fecha}`;
    },
  );
}

/** Escapa o que vai dentro de content="..." para não quebrar o HTML. */
function texto(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Troca título, descrição e imagem do HTML pelos da página de vendas.
 *
 * `versao` entra na URL da imagem: sem isso o WhatsApp continua servindo
 * a prévia que guardou da primeira vez, mesmo depois de a arte mudar.
 */
export function aplicarMetaDaPaginaDeVendas(html: string, versao: string): string {
  const m = META_DA_PAGINA_DE_VENDAS;
  const url = `${m.site}${m.rota}`;
  const titulo = texto(m.titulo);
  const descricao = texto(m.descricao);
  const imagem = texto(`${m.site}${m.imagem}?v=${versao}`);

  const trocas: [RegExp, string][] = [
    [/<title>[\s\S]*?<\/title>/, `<title>${titulo}</title>`],
    [
      /<meta name="description" content="[^"]*"\s*\/?>/g,
      `<meta name="description" content="${descricao}">`,
    ],
    [
      /<meta property="og:title" content="[^"]*"\s*\/?>/g,
      `<meta property="og:title" content="${titulo}">`,
    ],
    [
      /<meta name="twitter:title" content="[^"]*"\s*\/?>/g,
      `<meta name="twitter:title" content="${titulo}">`,
    ],
    [
      /<meta property="og:description" content="[^"]*"\s*\/?>/g,
      `<meta property="og:description" content="${descricao}">`,
    ],
    [
      /<meta name="twitter:description" content="[^"]*"\s*\/?>/g,
      `<meta name="twitter:description" content="${descricao}">`,
    ],
    [
      /<meta property="og:image" content="[^"]*"\s*\/?>/g,
      `<meta property="og:image" content="${imagem}">`,
    ],
    [
      /<meta name="twitter:image" content="[^"]*"\s*\/?>/g,
      `<meta name="twitter:image" content="${imagem}">`,
    ],
    [
      /<meta property="og:url" content="[^"]*"\s*\/?>/g,
      `<meta property="og:url" content="${url}">`,
    ],
  ];

  let saida = html;
  for (const [de, para] of trocas) saida = saida.replace(de, para);

  /* Sem o canônico, buscador e prévia podem tratar / e /planos como a mesma página repetida. */
  if (!saida.includes('rel="canonical"')) {
    saida = saida.replace("</head>", `  <link rel="canonical" href="${url}">\n  </head>`);
  }

  /* Inserido uma vez só: rodar duas vezes contaria a visita em dobro. */
  const pixel = marcacaoDoPixelDaMeta(PIXEL_DA_META);
  if (pixel && !saida.includes("fbevents.js")) {
    saida = liberarPixelNaPolitica(saida);
    saida = saida.replace("</head>", `${pixel}  </head>`);
  }

  return saida;
}
