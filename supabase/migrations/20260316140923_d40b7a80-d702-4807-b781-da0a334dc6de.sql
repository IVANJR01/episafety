
-- Add unique constraint on email for usuarios_liberados (needed for upsert)
ALTER TABLE public.usuarios_liberados ADD CONSTRAINT usuarios_liberados_email_unique UNIQUE (email);
