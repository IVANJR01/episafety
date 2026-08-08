# SafetySoluções — EPISafety

Sistema de gestão de EPIs e segurança do trabalho.

- **Produção**: https://safetysolucoes.com
- **Repositório**: https://github.com/IVANJR01/episafety
- **Stack**: React + TypeScript + Vite + Tailwind + shadcn/ui, backend em Supabase (projeto `estmuducawmftvpbeutm`).

## Desenvolvimento local

```sh
# Clonar o repositório
git clone https://github.com/IVANJR01/episafety.git
cd episafety

# Instalar as dependências
npm install

# Subir o servidor de desenvolvimento
npm run dev
```

Outros comandos úteis:

```sh
npm run build       # build de produção
npm run lint        # eslint
npm run test        # vitest (uma vez)
npm run test:watch  # vitest em modo watch
```

## Backend

O banco (Postgres/RLS), Storage, Edge Functions e Auth rodam num projeto
Supabase próprio (`estmuducawmftvpbeutm`) — não no Lovable Cloud. Migrations
ficam em `supabase/migrations/`; Edge Functions em `supabase/functions/`.
