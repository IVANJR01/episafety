-- Lista de entregas sem baixar as imagens.
--
-- A tela de Entregas baixava todas as assinaturas e selfies para mostrar só
-- "Assinado / Pendente": 4,7 MB para 109 entregas na maior empresa, e
-- crescendo a cada entrega. Estas duas funções são "campos calculados" da
-- API (PostgREST): a tela pede `assinatura_colaborador:assinatura_resumo` e
-- recebe, no mesmo nome de sempre, a marca "__IMAGEM_NO_SERVIDOR__" no lugar
-- da imagem — a mesma marca que a cópia offline já usava
-- (src/lib/cacheOfflineLeve.ts). Biometria/reconhecimento facial e textos
-- curtos (link de arquivo) passam como estão.
--
-- A imagem de verdade é buscada só quando precisa: ao gerar a ficha.
-- `set search_path to ''`: nada aqui depende de esquema de extensão.

create or replace function public.assinatura_resumo(e public.entregas)
returns text language sql stable set search_path to '' as $$
  select case
    when e.assinatura_colaborador like 'data:%' and length(e.assinatura_colaborador) > 512
      then '__IMAGEM_NO_SERVIDOR__'
    else e.assinatura_colaborador
  end
$$;

create or replace function public.foto_resumo(e public.entregas)
returns text language sql stable set search_path to '' as $$
  select case
    when e.foto_reconhecimento like 'data:%' and length(e.foto_reconhecimento) > 512
      then '__IMAGEM_NO_SERVIDOR__'
    else e.foto_reconhecimento
  end
$$;

grant execute on function public.assinatura_resumo(public.entregas) to authenticated;
grant execute on function public.foto_resumo(public.entregas) to authenticated;

notify pgrst, 'reload schema';
