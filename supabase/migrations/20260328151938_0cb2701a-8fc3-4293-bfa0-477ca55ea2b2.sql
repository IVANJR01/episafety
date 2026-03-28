-- Allow principal users to delete global cursos_documentos (empresa_id IS NULL)
CREATE POLICY "Principal delete global cursos_documentos"
ON public.cursos_documentos
FOR DELETE
TO authenticated
USING (
  empresa_id IS NULL
  AND is_principal(auth.uid())
);

-- Allow principal users to update global cursos_documentos (empresa_id IS NULL)
CREATE POLICY "Principal update global cursos_documentos"
ON public.cursos_documentos
FOR UPDATE
TO authenticated
USING (
  empresa_id IS NULL
  AND is_principal(auth.uid())
);