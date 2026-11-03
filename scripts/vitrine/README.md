# Vitrine — prints das telas para divulgação

Monta telas internas do sistema com **dados fictícios**, só para tirar
print de divulgação (página de vendas, apresentação, proposta).

Não entra no build do produto. O que ela renderiza são os componentes de
verdade: a tela é a mesma que o cliente usa, trocando apenas de onde vêm
os dados. Por isso o print da página de vendas nunca é um desenho — e
também nunca leva informação de cliente, porque nenhuma consulta sai
daqui: as quatro portas para o servidor estão trocadas por dublês
(`stubSupabase`, `stubAuth`, `stubPermissoes`, `stubHooks`).

## Como usar

```bash
npm run vitrine          # constrói e serve em http://localhost:4179
```

Abra no navegador e tire o print, ou use o Playwright para automatizar.

## Trocar a tela exibida

Edite `main.tsx` e importe outra página de `@/pages`. Se a tela nova usar
outro hook de dados, acrescente o dublê correspondente em
`vite.config.ts`.

## Trocar os dados

`stubDados.ts`. **Só dado inventado**: empresa, pessoa e CA fictícios.
Print de divulgação com nome de colaborador real é problema de LGPD, e a
página é feita para circular.
