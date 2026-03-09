
ALTER TABLE public.usuarios_liberados 
ADD COLUMN modulos_permitidos text[] DEFAULT '{}';
