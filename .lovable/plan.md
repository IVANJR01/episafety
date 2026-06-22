
# Plano: Supabase Storage privado para destravar a homologação

Objetivo: destravar U3 (PGR/CAT/LTCAT/PPP + S-2210/S-2240 stubs) usando **Supabase Storage privado**, sem depender do OAuth do Google Drive. Drive BYOK permanece como provider selecionável, mas não é mais o caminho padrão da homologação.

Escopo intocado (reafirmando): sem envio real ao eSocial, sem certificado digital, sem SOAP, sem XMLDSig, sem ICP-Brasil.

---

## 1. Buckets a criar

Um bucket único, **privado**, com paths por tenant:

- `sst-documentos` (private, sem listagem pública, sem `public=true`)

Estrutura de paths (conforme solicitado):

```text
{empresa_id}/pdf/{modulo}/{documento_id}/v{versao}/arquivo.pdf
{empresa_id}/xml/{evento}/{evento_id}/arquivo.xml
```

Exemplos:
- `<empresa_id>/pdf/pgr/<pgr_id>/v1/PGR.pdf`
- `<empresa_id>/pdf/cat/<cat_id>/v1/CAT.pdf`
- `<empresa_id>/pdf/ltcat/<ltcat_id>/v1/LTCAT.pdf`
- `<empresa_id>/pdf/ppp/<ppp_id>/v1/PPP.pdf`
- `<empresa_id>/xml/s2210/<evento_id>/S2210.xml`
- `<empresa_id>/xml/s2240/<evento_id>/S2240.xml`

RLS em `storage.objects` para o bucket `sst-documentos`:
- SELECT/INSERT/UPDATE/DELETE permitidos apenas se `(storage.foldername(name))[1]::uuid` está nas empresas do usuário autenticado (via `usuario_empresas` ou função `user_has_empresa(auth.uid(), empresa_id)`).
- `anon`: sem acesso.
- Download sempre via **signed URL** com TTL 60–300s, gerada por edge function que revalida tenant.

---

## 2. Colunas novas nas tabelas

Adicionar, de forma **aditiva e nullable** (sem quebrar registros antigos do Drive), nas tabelas que hoje gravam `drive_file_id`/`drive_link`:

Tabelas afetadas:
- `pgr_pdf_versoes`, `pgr_documentos`
- `ltcat_pdf_versoes`, `ltcat_documentos`
- `ppp_pdf_versoes`, `ppp_documentos`
- `cat_anexos` (PDF da CAT)
- `esocial_eventos_s2210`, `esocial_eventos_s2240` (XML stubs)

Colunas novas por tabela (todas nullable):
- `storage_provider text` — `'google_drive_byok'` | `'supabase_storage'`
- `storage_bucket text`
- `storage_path text`
- `storage_size_bytes bigint`
- `pdf_hash` / `xml_hash` `text` — SHA-256 (onde ainda não existir; várias já têm `hash`)
- `versao int` (onde ainda não existir)
- `gerado_em timestamptz default now()`
- `gerado_por uuid` (auth.uid())

Sem CHECK de provider — validar em código. Sem alterar colunas Drive existentes.

---

## 3. Arquivos a alterar

Novo helper compartilhado (frontend):
- `src/lib/secureStorage.ts` — `uploadDocumentoSeguro({ provider, bucket, path, blob, empresa_id })` e `getSignedUrlSeguro({ bucket, path, ttl })`. Internamente:
  - `provider='supabase_storage'` → `supabase.storage.from('sst-documentos').upload(path, blob, { upsert: true })`
  - `provider='google_drive_byok'` → caminho atual (mantido)
  - Calcula SHA-256, valida que `path` começa com `empresa_id/`.

Nova edge function:
- `supabase/functions/signed-url-doc/index.ts` — recebe `{ bucket, path }`, valida JWT, valida que `empresa_id` do path pertence ao usuário, retorna signed URL com TTL 60–300s. (Reuso conceitual da `signed-url` existente, mas focada em `sst-documentos` e com checagem de tenant.)

Geradores a atualizar (trocar a etapa de upload Drive por `uploadDocumentoSeguro` com provider lido de `empresa_config.storage_provider`, default `supabase_storage`):
- `src/lib/pgrPdf.ts`
- `src/lib/catPdf.ts`
- `src/lib/ltcatPdf.ts`
- `src/lib/pppPdf.ts`
- `src/lib/esocialS2210Xml.ts`
- `src/lib/esocialS2240Xml.ts`

Config:
- `empresa_config`: nova coluna `storage_provider text default 'supabase_storage'`.
- `src/pages/admin/AdminCloud.tsx`: seletor `Supabase Storage` / `Google Drive BYOK` (homologação fica em Supabase).

Consumo (download/visualização):
- Componentes que hoje resolvem link Drive para PDFs/XMLs passam a chamar `getSignedUrlSeguro` quando `storage_provider='supabase_storage'`. Drive continua usando `gdrive-proxy`.

---

## 4. Migração dos registros existentes

Não há reupload automático. Estratégia segura:

- Registros antigos mantêm `drive_file_id` e continuam sendo abertos pelo caminho Drive (quando o OAuth estiver OK).
- Novos PDFs/XMLs gerados a partir desta mudança vão para Supabase Storage e preenchem as novas colunas.
- Backfill opcional (fora do escopo desta entrega): job manual posterior para baixar do Drive e reenviar ao bucket, preenchendo as novas colunas. Não bloqueia homologação.

---

## 5. Audit log

`audit_log` permanece registrando apenas metadados: `entidade`, `entidade_id`, `acao`, `storage_provider`, `bucket`, `path`, `hash`, `tamanho`, `versao`, `gerado_por`. **Nunca** o binário, nunca o XML/PDF inline. Revisão dos pontos que hoje logam geração de documento para garantir esse contrato.

---

## 6. Critérios de aceite mapeados

- PGR PDF gerado com U3 → bucket `sst-documentos`, path `{empresa_id}/pdf/pgr/{id}/v1/PGR.pdf`, `pdf_hash` preenchido, signed URL abre o PDF.
- Empresa B não consegue baixar PDF da Empresa A (RLS + validação na edge function).
- S-2210/S-2240 stubs salvos no bucket privado com hash e path.
- `anon` sem acesso ao bucket.
- Build limpo, sem mexer em fluxos Drive existentes.

---

## 7. Riscos residuais

- **Custo/quota de Storage**: PDFs e XMLs passam a consumir Supabase Storage. Mitigação: bucket único, paths versionados, possível política de retenção depois.
- **Dupla fonte de verdade temporária**: documentos antigos ficam no Drive, novos no Supabase. UI precisa ler `storage_provider` por registro — já tratado no helper de download.
- **Path injection**: mitigado validando `empresa_id` no início do path tanto no helper quanto na edge function.
- **TTL curto** pode expirar durante download de PDFs grandes em rede ruim. Mitigação: 300s por padrão para PDFs.
- **Backfill pendente**: documentos antigos seguem dependentes do OAuth Drive até reupload. Aceitável: homologação não exige histórico migrado.
- **RLS de storage**: precisa ser testada com 2 empresas reais antes de marcar U3 como concluída.

---

## 8. Fora deste plano (reafirmado)

- Sem envio real eSocial, sem certificado digital, sem SOAP, sem XMLDSig, sem ICP-Brasil, sem S-3000.
- Sem alterar o fluxo Drive BYOK existente além de torná-lo opcional.
- Sem U4.

Confirma este recorte para eu seguir com a migração SQL + helper + ajuste dos 6 geradores?
