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

  return saida;
}
