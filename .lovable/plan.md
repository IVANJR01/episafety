
# Módulo PPP — Perfil Profissiográfico Previdenciário

Documento técnico **interno preparatório**, alinhado à IN PRES/INSS 128/2022.
Não envia ao eSocial. Não usa ICP-Brasil. Não concede aposentadoria especial.
PDF segue o padrão técnico interno dos demais módulos (hash SHA-256, QR Code interno, Drive BYOK, assinatura visual com MFA AAL2).

---

## 1. Estrutura do PPP

PPP é emitido **por funcionário** e cobre **um ou mais períodos laborais** dentro da empresa. Cada período concentra função, setor, GHE/GES, agentes nocivos, EPI/EPC, RT e conclusão previdenciária.

Cabeçalho (consolidado):
- empresa (matriz + lotação tributária);
- funcionário (nome, CPF, NIS/PIS, data nascimento, sexo);
- período total coberto (mínima admissão → máxima saída);
- CBO consolidado;
- conclusão previdenciária consolidada;
- observações.

Corpo:
- períodos laborais ordenados;
- exposições por período;
- responsáveis ambientais;
- responsáveis médicos;
- exames referenciados;
- assinatura visual + QR Code.

Disclaimer obrigatório no PDF: *"Documento técnico interno. Não constitui concessão de benefício previdenciário e não substitui assinatura ICP-Brasil."*

---

## 2. Tabelas `ppp_*`

```text
ppp_documentos
  id, empresa_id, funcionario_id, versao, versao_pai_id,
  status, motivo_emissao, data_emissao,
  cbo_consolidado, descricao_atividade_consolidada,
  conclusao_consolidada, observacoes,
  publicado_em, publicado_por,
  conteudo_atualizado_em, created_at, updated_at

ppp_periodos
  id, ppp_id, empresa_id, ordem,
  data_inicio, data_fim, motivo_encerramento,
  funcao_id, funcao_nome, cbo,
  setor_id, setor_nome,
  ghe_id, ghe_codigo, ghe_descricao,
  ltcat_id (origem snapshot), pgr_id (origem snapshot),
  descricao_atividade, observacoes

ppp_exposicoes
  id, ppp_id, periodo_id, empresa_id,
  agente_nome, agente_tipo, codigo_esocial (preparatório, opcional),
  intensidade, unidade_medida, limite_tolerancia, acima_limite,
  tecnica, enquadramento,
  tempo_exposicao_horas, percentual_jornada,
  epi_descricao, epi_ca, epi_eficacia, epc_descricao,
  origem_ltcat_aval_id, fundamento_legal, observacoes

ppp_responsaveis_ambientais
  id, ppp_id, empresa_id, periodo_id (nullable = aplica a todos),
  nome, registro_profissional, formacao,
  origem_ltcat_rt_id

ppp_responsaveis_medicos
  id, ppp_id, empresa_id, nome, crm,
  periodo_inicio, periodo_fim, origem_aso_medico_id

ppp_exames_referenciados
  id, ppp_id, empresa_id, aso_id,
  data, tipo, resultado_resumo

ppp_revisoes            (append-only)
  id, ppp_id, empresa_id,
  versao_anterior, versao_nova,
  motivo, status_anterior, status_novo,
  user_email, created_at

ppp_pdf_versoes
  id, ppp_id, empresa_id,
  tipo (rascunho|final), sha256,
  drive_id, drive_link,
  gerado_em, gerado_por

ppp_assinaturas
  id, ppp_id, empresa_id,
  nome, papel,
  drive_id, imagem_link,
  auth_aal, assinado_em
```

Enums: `ppp_status` (`rascunho|em_revisao|vigente|substituido|arquivado`), `ppp_motivo_emissao` (`inicial|atualizacao|correcao|demissao`).

---

## 3. Vínculos

- `funcionarios` (CPF, PIS/NIS) — identificação do trabalhador.
- `empresa_config` (matriz + unidade) — lotação tributária e empregadora.
- `aso_funcoes` — função e CBO de referência.
- `ghe_ges` ou `ltcat_grupos_homogeneos` — GHE/GES do período.
- `aso_setores` ou setor da função — setor do período.

Todos os vínculos respeitam `empresa_id` do funcionário.

---

## 4. Reaproveitamento do LTCAT

- LTCAT **vigente no período** é a fonte oficial de agentes nocivos e responsável técnico ambiental.
- RPC `ppp_importar_do_ltcat(_ppp_id, _periodo_id, _ltcat_id)` popula `ppp_exposicoes` e `ppp_responsaveis_ambientais` como **snapshot** (congela valores no momento da importação).
- Cada exposição guarda `origem_ltcat_aval_id` para rastreabilidade.
- Conclusão previdenciária do período herda a conclusão do LTCAT por GHE × função.

---

## 5. Reaproveitamento do PGR

- PGR do período fornece descrição do risco, controles existentes e hierarquia de controles.
- Snapshot em `ppp_periodos.pgr_id` apenas como referência.
- Descrição complementa, não substitui, dados do LTCAT.

---

## 6. Reaproveitamento de ASO/PCMSO/exames

- Lista resumida dos ASOs do funcionário (admissional, periódicos, mudança de função, retorno ao trabalho, demissional) em `ppp_exames_referenciados`.
- Médicos responsáveis dos ASOs alimentam `ppp_responsaveis_medicos` (sem duplicar — agrupa por CRM e intervalo).
- Apenas referência: tipo, data e resumo do resultado. PDF do ASO continua no módulo ASO.

---

## 7. Histórico laboral

Períodos montados automaticamente a partir de:
- admissão e demissão do funcionário;
- mudanças de função em `aso_funcoes` / `funcionarios`;
- mudanças de setor;
- mudanças de GHE em `ghe_funcoes` / `ltcat_funcoes`.

RPC `ppp_importar_historico_funcionario(_ppp_id)` cria os períodos. Em rascunho o usuário pode dividir, juntar, editar ou inserir períodos manualmente. Validação: períodos sem sobreposição e sem furos não justificados.

---

## 8. Períodos de exposição

Dentro de cada `ppp_periodo`, cada `ppp_exposicao` representa um agente nocivo ao qual o trabalhador esteve exposto naquele período. Campos previdenciários: `tecnica`, `enquadramento` (habitual e permanente / intermitente / eventual / neutralizado por EPI), `tempo_exposicao_horas`, `percentual_jornada`.

---

## 9. Agentes nocivos

- Nome, tipo (físico / químico / biológico / ergonômico / acidente), intensidade, unidade, limite de tolerância, `acima_limite` calculado.
- `codigo_esocial` opcional (campo preparatório para futura integração com a tabela 24 do eSocial — sem validação rígida nesta fase).
- Fundamento legal por exposição (texto livre, sugerido pelo LTCAT quando importado).

---

## 10. EPI / EPC

Cada exposição registra:
- EPI: descrição, CA, eficácia (`sim|nao|parcial`);
- EPC: descrição.

Quando a eficácia do EPI for `sim` e existir exposição acima do LT, o sistema sinaliza alerta visual e exige justificativa adicional.

---

## 11. Responsável técnico

- **Ambiental** (`ppp_responsaveis_ambientais`): engenheiro/técnico de segurança que assina os registros ambientais; pode ser por período.
- **Médico** (`ppp_responsaveis_medicos`): médico do trabalho responsável pelos exames; agrupado por intervalo.

Ao importar do LTCAT, RTs do LTCAT são copiados como ambientais. Médicos vêm dos ASOs referenciados.

---

## 12. Conclusão previdenciária

- Por período: `nao_especial | especial_15 | especial_20 | especial_25 | inconclusivo`, herdada do LTCAT mas editável.
- Consolidada no cabeçalho: regra simples — se algum período é especial, o PPP marca exposição especial nos respectivos intervalos; caso contrário, não especial.
- Disclaimer permanente no PDF e na UI: documento não concede benefício.

---

## 13. PDF técnico interno

Mesmo motor dos módulos atuais (jsPDF client-side):
- capa com identificação;
- dados do funcionário;
- períodos laborais;
- exposições por período (tabela);
- EPI / EPC;
- responsáveis ambientais e médicos;
- exames referenciados (resumo);
- conclusão previdenciária consolidada;
- assinatura visual;
- QR Code interno;
- rodapé com hash SHA-256, versão e disclaimer.

Tipos: `rascunho` (com marca d'água, sem MFA) e `final` (limpo, exige MFA AAL2).

---

## 14. Assinatura visual + hash SHA-256

- Hash SHA-256 do binário do PDF calculado via Web Crypto antes do upload ao Drive.
- Gravado em `ppp_pdf_versoes.sha256`. Banco **não armazena binário**.
- Assinatura visual em `ppp_assinaturas` com `auth_aal = 'aal2'`, nome, papel, imagem no Drive.
- Aviso permanente: não substitui ICP-Brasil.

---

## 15. QR Code de validação interna

- QR aponta para `/ppp/validar/:id` — rota **autenticada**, respeita RLS.
- Página exibe: empresa, funcionário (sem CPF completo — mascarado), versão, status, hash do PDF, RTs e flag "PDF desatualizado" quando `pdf.gerado_em < doc.conteudo_atualizado_em`.

---

## 16. Versionamento

- Fluxo: `rascunho` → `em_revisao` → `vigente` → `substituido` / `arquivado`.
- `ppp_revisoes` append-only (trigger bloqueia `UPDATE`/`DELETE`).
- Imutabilidade: trigger `ppp_block_when_imutavel` impede mutação em filhas quando o documento está em `vigente|substituido|arquivado`.
- Abrir revisão clona snapshot e gera nova versão em rascunho. Publicar nova versão marca a anterior como `substituido`.

---

## 17. Permissões (`ppp:*`)

- `ppp:view`, `ppp:create`, `ppp:edit`, `ppp:delete`;
- `ppp:publicar`, `ppp:assinar`, `ppp:gerar_pdf_final`.

Registradas em `src/lib/permissions.ts`. Visibilidade adicional: usuário comum só vê PPPs de funcionários dentro do seu escopo (`usuario_empresas` + contrato).

---

## 18. RLS e isolamento por empresa

- Todas as tabelas `ppp_*` com `empresa_id` obrigatório e RLS habilitada.
- `GRANT SELECT, INSERT, UPDATE, DELETE` apenas a `authenticated`; `GRANT ALL` a `service_role`; **sem `anon`**.
- Policies usam `usuario_pertence_empresa(auth.uid(), empresa_id)` (já existente no projeto).
- RPCs `ppp_*` com `SECURITY DEFINER`, `REVOKE EXECUTE ... FROM PUBLIC, anon`.
- Funcionário pertence a uma única empresa — cross-tenant bloqueado por RLS no join.

---

## 19. Audit log

`audit_log` registra:
- criação, edição e mudança de status do `ppp_documentos`;
- importação do LTCAT / histórico;
- geração de PDF final;
- assinatura visual;
- abertura de revisão e publicação.

Apenas metadados e hash — **sem binário**.

---

## 20. Plano de entrega em partes

### Parte 1 — Migrations + RLS + permissões
- Tabelas `ppp_*`, enums, GRANTs, RLS, policies, triggers (`set_updated_at`, `ppp_revisao_append_only`, `ppp_block_when_imutavel`, `ppp_documento_audit`, `ppp_touch_conteudo`), permissões `ppp:*`.

### Parte 2 — CRUD do PPP + vínculo com funcionário
- Listagem `/ppp` com filtros (funcionário, status, vigência).
- Criação `/ppp/novo` (escolher funcionário → cria rascunho v1).
- Detalhe `/ppp/:id` com abas Resumo + Revisões.
- Abertura de revisão e publicação simples (validações completas vêm na Parte 5).
- Audit log e isolamento Empresa A × B funcionando.

### Parte 3 — Histórico laboral + períodos
- RPC `ppp_importar_historico_funcionario`.
- Aba Períodos com CRUD manual, divisão, junção, validação de sobreposição e furos.

### Parte 4 — Agentes/exposições reaproveitando LTCAT
- RPC `ppp_importar_do_ltcat`.
- Aba Exposições, EPI/EPC, badges "acima do LT" e "EPI sim com exposição acima do LT".
- Dedupe por `(periodo_id, agente_nome, tecnica, origem_ltcat_aval_id)`.
- Abas Responsáveis Ambientais, Responsáveis Médicos, Exames Referenciados.

### Parte 5 — PDF + assinatura visual + QR Code
- PDF rascunho/final com SHA-256, Drive BYOK em `PPP/{cpf}/v{versao}/`.
- Assinatura visual com MFA AAL2.
- QR Code interno e página `/ppp/validar/:id`.
- Validações completas em `ppp_publicar`: ≥1 período, ≥1 exposição OU justificativa de ausência, ≥1 RT ambiental, ≥1 RT médico OU justificativa, PDF final atualizado, ≥1 assinatura, MFA AAL2.

### Parte 6 — Dashboard + checklist + CSV
- Dashboard `/ppp/dashboard` por empresa/matriz (PPPs por status, funcionários cobertos, exposições críticas, PDFs desatualizados, próximos vencimentos).
- Aba Checklist no detalhe (espelho das validações).
- Exportações CSV: PPPs, períodos, exposições.
- Relatório técnico final do módulo.

---

## Fora do escopo (explícito)

- Geração do XML S-2240.
- Envio real ao eSocial (SOAP, homologação, recibo, rejeições).
- Assinatura ICP-Brasil / certificado A1/A3.
- Decisão ou concessão de aposentadoria especial.
- Integração com Receita / INSS / DataPrev.
- Geração de PDF server-side.

---

**Aguardando aprovação explícita deste plano antes de iniciar a Parte 1.**
