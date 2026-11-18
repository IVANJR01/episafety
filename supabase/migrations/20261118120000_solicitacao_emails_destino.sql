-- Para quem cada solicitação de materiais é enviada.
--
-- Os destinatários viviam só no Cadastro Mestre da empresa
-- (empresa_config.email_compras), e toda solicitação ia para a mesma lista.
-- Só que quem recebe é decisão de cada pedido: um pedido de EPI vai para
-- compras e segurança, um de ferramenta vai para compras e manutenção, um
-- urgente vai também para o gerente.
--
-- A lista da empresa continua existindo e passa a ser o PADRÃO: é com ela
-- que o campo "Enviar para" já vem preenchido. Aqui fica o que foi
-- escolhido para esta solicitação — e é o que o reenvio usa depois, para
-- o segundo e-mail não ir para gente diferente do primeiro.
--
-- Nulo: solicitação anterior a esta coluna, ou ninguém mexeu. Vale o
-- padrão da empresa, como sempre valeu.
alter table public.solicitacoes_materiais
  add column if not exists emails_destino text;

comment on column public.solicitacoes_materiais.emails_destino is
  'Destinatários do e-mail desta solicitação, separados por vírgula. Nulo = usa empresa_config.email_compras.';
