- Plano: RLS ciente da empresa ativa (multi‑empresa e Super Admin)

## 1. Situação atual e riscos

Hoje toda a RLS de negócio se apoia em duas funções `SECURITY DEFINER`:

- `get_user_empresa_id(uid)` — lê **apenas** `profiles.empresa_id` (a empresa "matriz" do usuário).
- `is_in_user_company_tree(uid, empresa_id)` — libera se `empresa_id` = matriz do usuário **ou** filial daquela matriz.

E dois "atalhos" de papel:

- `is_super_admin(uid)` — libera **tudo** para Super Admin.
- Políticas específicas por módulo (`asos`, `exames`, `aso_medicos`, `ghe_*`, `pgr_*`, `ltcat_*`, `ppp_*`) usam `is_super_admin OR is_in_user_company_tree`.

Isso gera três problemas concretos:

1. **Usuário multi‑empresa (via `usuario_empresas`)** não é reconhecido pela RLS. Ele só vê no banco a empresa que está em `profiles.empresa_id`; para ver a segunda empresa, hoje dependemos de:
  - trocar `profiles.empresa_id` (o que a UI **não faz** — só altera `active_empresa_id` no `localStorage`),
  - ou de o usuário ser Super Admin (RLS libera tudo).
2. **Super Admin recebe mash‑up** de todas as empresas no banco. A UI corrige isso via `.eq("empresa_id", empresaId)` (a correção que acabamos de aplicar no módulo Exames), mas se alguma query nova esquecer o filtro, vaza.
3. `**active_empresa_id` só existe no `localStorage**`. O banco não sabe qual empresa está ativa. Toda separação depende do frontend — inaceitável para dados sensíveis.

Consequência prática: a segurança "de verdade" está no cliente. Qualquer bug de query, cache antigo ou request direta ao PostgREST expõe dados cruzados.

## 2. Proposta

Levar o conceito de **empresa ativa** e de **conjunto de empresas autorizadas** para o banco, de forma que a RLS decida sem depender do frontend.

### 2.1. Fontes de verdade no banco

Passar a considerar, para cada `uid`:

- `profiles.empresa_id` — empresa "âncora" (compatibilidade).
- `usuario_empresas.empresa_id` — todas as empresas autorizadas.
- `empresa_config.empresa_pai_id` — árvore matriz → filiais.
- **Empresa ativa da sessão** — nova, ver 2.3.

### 2.2. Novas funções `SECURITY DEFINER` (`search_path=public`, `STABLE`)

- `get_user_empresas(uid) → uuid[]`  
União de: `profiles.empresa_id`, todas de `usuario_empresas` do e‑mail do `uid`, e as filiais (`empresa_config` onde `empresa_pai_id` estiver no conjunto acima).
- `is_empresa_authorized(uid, empresa_id) → boolean`  
`empresa_id = ANY(get_user_empresas(uid))` **ou** `is_super_admin(uid)`.
- `get_active_empresa_id(uid) → uuid`  
Lê a empresa ativa da sessão (ver 2.3). Fallback: `profiles.empresa_id`.
- `is_active_empresa(uid, empresa_id) → boolean`  
`empresa_id = get_active_empresa_id(uid)` **e** `is_empresa_authorized(uid, empresa_id)`.

Substitui `is_in_user_company_tree` pelo par acima, dependendo do módulo:

- Módulos **operacionais** (Exames, PGR, LTCAT, PPP, documentos, GES/GHE, funcionários, médicos, locais, catálogo, inventários) → `is_active_empresa`.
- Módulos **globais de administração** (empresas, contratos, faturas, usuarios_liberados) → `is_empresa_authorized`.
- Super Admin continua com bypass em ambos.

### 2.3. Como o banco descobre a "empresa ativa"

Opção escolhida: **tabela de sessão** — mais simples, sem depender de custom claims/JWT hooks.

```text
public.user_active_empresa
├── user_id  uuid  PK  (FK auth.users)
├── empresa_id uuid FK empresa_config
└── updated_at timestamptz
```

- RLS: cada usuário só lê/grava a própria linha; validação `is_empresa_authorized(auth.uid(), empresa_id)` no `WITH CHECK`.
- O frontend chama `upsert` nessa tabela **sempre** que troca a empresa ativa no header (mesmo momento em que hoje grava no `localStorage`).
- `get_active_empresa_id(uid)` faz `SELECT empresa_id FROM user_active_empresa WHERE user_id = uid`.

Alternativa considerada e descartada por complexidade neste momento: custom claim `active_empresa_id` via Auth Hook — exige regenerar sessão em toda troca, aumenta latência e adiciona superfície de erro.

### 2.4. Impacto nas políticas

Padrão novo por módulo operacional (exemplo `asos`):

```text
USING  (is_super_admin(auth.uid())
        OR (is_active_empresa(auth.uid(), empresa_id)
            AND <regras de papel já existentes>))
WITH CHECK (mesma expressão)
```

Tabelas afetadas (revisar policy por policy):

- **Exames:** `asos`, `exames`, `aso_medicos`, `aso_exames_catalogo`, `aso_funcoes`, `aso_setores`, `aso_riscos_funcao`, `aso_numeracao`, `aso_assinaturas`, `aso_verificacao`, `aso_download_logs`, `locais_emissao_aso`, `medicos`.
- **Cadastro/GES:** `ghe_ges`, `ghe_funcoes`, `ghe_riscos`, `ghe_exames`, `funcionarios`.
- **PGR:** `pgr_documentos`, `pgr_inventario_itens`, `pgr_acoes`, `pgr_acao_evidencias`, `pgr_perigos_catalogo`, `pgr_textos`, `pgr_pdf_versoes`, `pgr_revisoes`, `pgr_assinaturas`.
- **LTCAT:** `ltcat_documentos`, `ltcat_agentes`, `ltcat_avaliacoes`, `ltcat_conclusoes`, `ltcat_funcoes`, `ltcat_grupos_homogeneos`, `ltcat_setores_avaliados`, `ltcat_responsaveis_tecnicos`, `ltcat_pdf_versoes`, `ltcat_revisoes`, `ltcat_assinaturas`, `ltcat_anexos`, `ltcat_catalogo_agentes`.
- **PPP:** `ppp_documentos`, `ppp_periodos`, `ppp_exposicoes`, `ppp_exames_referenciados`, `ppp_responsaveis*`, `ppp_riscos_cargo`, `ppp_pdf_versoes`, `ppp_revisoes`, `ppp_assinaturas`.

Catálogos globais (`aso_exames_catalogo`, `ltcat_catalogo_agentes`, `pgr_perigos_catalogo`) mantêm o padrão atual: `empresa_id IS NULL` visível a todos + `is_active_empresa` para itens próprios.

Módulos **fora** do escopo desta migração (não mexer agora): Contratos, EPIs/entregas, Treinamentos, Videos, Portal RH, Backups, Admin. Continuam com `is_in_user_company_tree`.

## 3. Ordem de migração

Feita em 4 migrações pequenas e reversíveis, uma por PR para poder pausar.

1. **M1 — Infra sem quebrar nada.**
  Cria `user_active_empresa` + RLS + as 4 funções novas. `get_active_empresa_id` faz fallback para `profiles.empresa_id`. Frontend passa a fazer `upsert` na tabela ao trocar empresa no header. Nenhuma policy alterada. Nesta etapa, se um usuário nunca clicar em trocar empresa, o comportamento é idêntico ao atual.
2. **M2 — Migração dos usuários existentes.**
  `INSERT ... ON CONFLICT DO NOTHING` em `user_active_empresa` para todos os `profiles` com `empresa_id NOT NULL`, gravando a empresa "âncora" como ativa. Garante que nenhum usuário atual fique órfão.
3. **M3 — Trocar as policies do módulo Exames** para o novo padrão (`is_active_empresa`). Módulo por módulo, com janela de observação de 24–48h antes do próximo módulo.
4. **M4 — Repetir para PGR, LTCAT, PPP e GES/GHE.** Um módulo por migração. Última migração aposenta `is_in_user_company_tree` desses módulos e deprecia a função se não sobrar consumidor.

Cada migração é acompanhada de rollback pronto: reverter policy para a versão v3 anterior.

## 4. Como não quebrar usuários existentes

- M1 é aditiva. Frontend continua funcionando mesmo se não escrever em `user_active_empresa` (fallback → `profiles.empresa_id`).
- M2 preenche a tabela para 100% dos perfis existentes antes de qualquer policy ser trocada.
- M3/M4 têm janela de observação e rollback documentado.
- `is_super_admin` continua sendo bypass total — sem risco de admins ficarem sem acesso.
- Usuários single‑empresa não percebem diferença: `get_active_empresa_id` retorna a mesma coisa que `get_user_empresa_id`.
- Edge functions que usam `service_role` são imunes a RLS — continuam funcionando.

## 5. Plano de teste (Empresa A × Empresa B)

Seed dedicado:

- Empresa A, Empresa B (irmãs, sem parentesco).
- GES A, funcionário A, médico A, ASO A, PGR A, LTCAT A, PPP A.
- GES B, funcionário B, médico B, ASO B, PGR B, LTCAT B, PPP B.
- Usuário `multi@test` com `usuario_empresas` em A e B; `profiles.empresa_id = A`.
- Usuário `only-a@test` em A; `only-b@test` em B.
- Um Super Admin.

Casos por módulo (Exames, PGR, LTCAT, PPP, GES/GHE):

1. `only-a@test` só enxerga dados de A em todas as abas e dropdowns.
2. `only-b@test` só enxerga dados de B.
3. `multi@test` com A ativa → só A. Troca para B no header → só B, sem restos de A. Volta para A → só A.
4. Super Admin com A ativa → só A. Com B ativa → só B. Sem empresa ativa → guarda de UI, nenhuma query operacional.
5. Tentativa direta via SDK: `supabase.from('asos').select('*')` autenticado como `multi@test` com A ativa deve devolver **zero** linhas de B, mesmo sem `.eq("empresa_id", ...)` no cliente.
6. Insert cruzado: `multi@test` com A ativa tentando `INSERT` com `empresa_id = B` → rejeitado pela policy (`WITH CHECK`).
7. Cache: trocar empresa → `purgeQueryCache()` já existente + tabela `user_active_empresa` atualizada antes da próxima query.

Automação mínima:

- Script Playwright autenticando como cada perfil e comparando contagens por empresa antes/depois da troca.
- `supabase--linter` após cada migração para pegar policies quebradas.

## 6. Fora do escopo deste plano

- Não altera módulos EPIs/Contratos/Treinamentos.
- Não muda regra de Super Admin (continua vendo tudo, com filtro por empresa ativa aplicado no banco).
- Não mexe em edge functions.
- Não mexe em `profiles.empresa_id` (mantido como âncora e fallback).

## Detalhes técnicos (referência rápida)

Assinaturas propostas:

```sql
create or replace function public.get_user_empresas(_user_id uuid)
returns uuid[] language sql stable security definer set search_path=public as $$
  select array(
    select distinct e from (
      select empresa_id as e from public.profiles where user_id = _user_id
      union
      select ue.empresa_id from public.usuario_empresas ue
        join auth.users u on lower(u.email) = lower(ue.email)
        where u.id = _user_id
      union
      select ec.id from public.empresa_config ec
        where ec.empresa_pai_id in (
          select empresa_id from public.profiles where user_id = _user_id
          union
          select ue.empresa_id from public.usuario_empresas ue
            join auth.users u on lower(u.email) = lower(ue.email)
            where u.id = _user_id
        )
    ) s where e is not null
  )
$$;

create or replace function public.is_empresa_authorized(_user_id uuid, _empresa_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select is_super_admin(_user_id)
      or _empresa_id = any(get_user_empresas(_user_id))
$$;

create or replace function public.get_active_empresa_id(_user_id uuid)
returns uuid language sql stable security definer set search_path=public as $$
  select coalesce(
    (select empresa_id from public.user_active_empresa where user_id = _user_id),
    (select empresa_id from public.profiles where user_id = _user_id limit 1)
  )
$$;

create or replace function public.is_active_empresa(_user_id uuid, _empresa_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select is_empresa_authorized(_user_id, _empresa_id)
     and _empresa_id = get_active_empresa_id(_user_id)
$$;
```

Pode aprovar **sim**, mas eu aprovaria com **ajustes obrigatórios** antes de executar.

O plano está bom porque leva a empresa ativa para o banco e para a RLS, não deixando a segurança depender só do frontend. Mas tem uma contradição importante:

No plano diz que módulo operacional deve respeitar empresa ativa, porém o exemplo de policy usa:

```sql
is_super_admin(auth.uid()) OR is_active_empresa(...)

```

Isso faria o **Super Admin voltar a ver tudo** se alguma query esquecer filtro. Para módulos operacionais, o correto é **não usar bypass direto de Super Admin**. Use apenas `is_active_empresa(...)`, porque essa função já autoriza Super Admin, mas limitado à empresa ativa.

Mande isso para o Lovable:

```text
Pode aprovar o plano de RLS ciente da empresa ativa, mas execute com estes ajustes obrigatórios.

1. Corrigir regra do Super Admin em módulos operacionais

Nos módulos operacionais, NÃO usar policy assim:

is_super_admin(auth.uid()) OR is_active_empresa(auth.uid(), empresa_id)

Isso volta a permitir mash-up de empresas para Super Admin.

O correto para módulos operacionais é:

is_active_empresa(auth.uid(), empresa_id)

Motivo:
A função `is_active_empresa` já chama `is_empresa_authorized`, e `is_empresa_authorized` já considera Super Admin. Assim o Super Admin continua autorizado, mas limitado à empresa ativa selecionada.

Aplicar essa regra em módulos operacionais:
- Exames
- ASO
- GES/GHE
- Funcionários
- PGR
- LTCAT
- PPP
- Documentos operacionais

Super Admin só deve ver todas as empresas em telas administrativas específicas, não em telas operacionais.

2. Empresa ativa obrigatória para Super Admin

Se Super Admin não tiver empresa ativa selecionada, módulos operacionais não devem listar dados.

Evitar fallback automático para `profiles.empresa_id` no caso de Super Admin, se isso causar listagem sem seleção clara.

Regra:
- Usuário comum single empresa: pode usar fallback `profiles.empresa_id`.
- Usuário multiempresa: deve usar `user_active_empresa`.
- Super Admin: deve selecionar empresa ativa antes de ver dados operacionais.

3. Garantir que `empresaScopeIds` não seja usado como “todas as empresas” em tela operacional

No frontend, telas operacionais devem usar empresa ativa, não lista completa de empresas autorizadas.

No módulo Exames, PGR, LTCAT, PPP e GES/GHE:
- empresa ativa A → mostra apenas A
- empresa ativa B → mostra apenas B
- nunca mostrar A+B juntas

4. `usuario_empresas`

Na função `get_user_empresas`, considerar apenas vínculos ativos/autorizados, se a tabela possuir status/ativo.

Exemplo:
- ativo = true
- status = aprovado/liberado

Não considerar vínculo revogado, bloqueado ou inativo.

5. Evitar JOIN direto em `auth.users`, se houver alternativa

Se o projeto já usa `profiles.email` ou outra tabela pública segura, preferir ela para cruzar com `usuario_empresas`.

Se for indispensável usar `auth.users`, manter em função `SECURITY DEFINER` com:
- `search_path=public`
- sem expor dados sensíveis
- testes de linter

6. Criar primeiro M1 e M2 sem trocar policies

Aprovo a ordem:
- M1: criar `user_active_empresa` + funções novas + frontend grava empresa ativa
- M2: preencher usuários existentes
- M3: migrar somente Exames primeiro
- observar 24–48h
- depois migrar PGR/GES/LTCAT/PPP um por vez

Não migrar todos os módulos de uma vez.

7. Teste obrigatório antes de avançar

Executar teste direto no SDK:

Usuário multiempresa com A ativa:
supabase.from('asos').select('*')

Mesmo sem `.eq("empresa_id")`, não pode retornar nada da empresa B.

Também testar insert cruzado:
Usuário com A ativa tentando inserir `empresa_id = B` deve ser bloqueado pelo `WITH CHECK`.

8. Rollback

Cada migration de policy precisa ter rollback pronto para voltar para policy anterior.

9. Escopo aprovado

Pode executar apenas:
- M1
- M2
- M3 somente no módulo Exames

Não aplicar ainda em PGR, LTCAT, PPP e GES/GHE sem nova aprovação.

Resultado esperado:
Após M3, o banco também passa a proteger o módulo Exames pela empresa ativa. Mesmo se o frontend esquecer filtro, não deve haver vazamento entre empresas.

```

Mensagem curta:

```text
Pode aprovar, mas corrija o ponto do Super Admin: em módulos operacionais não use `is_super_admin OR is_active_empresa`, use só `is_active_empresa`, para o Super Admin também ficar limitado à empresa ativa. Execute primeiro M1, M2 e M3 somente em Exames, com rollback e teste A x B.

```

Com esses ajustes, eu aprovaria. O principal é **não deixar Super Admin como bypass total nas telas operacionais**, senão o risco volta.  


Nada é executado enquanto este plano não for aprovado.