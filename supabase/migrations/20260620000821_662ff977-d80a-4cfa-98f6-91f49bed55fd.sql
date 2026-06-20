
-- Substituir SELECT permissivo (sem role) por SELECT restrito a authenticated.
-- Acesso público via CDN URL continua funcionando porque os buckets são marcados como `public`.

DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
CREATE POLICY "Logos auth read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "Anyone can view empresa assets" ON storage.objects;
CREATE POLICY "Empresa assets auth read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'empresa-assets');

DROP POLICY IF EXISTS "Public read conformidades" ON storage.objects;
CREATE POLICY "Conformidades auth read 2" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'conformidades');

DROP POLICY IF EXISTS "Public read fotos-reconhecimento" ON storage.objects;
CREATE POLICY "Fotos reconhecimento auth read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'fotos-reconhecimento');

DROP POLICY IF EXISTS "Public read inspecoes" ON storage.objects;
CREATE POLICY "Inspecoes auth read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'inspecoes');

-- videos-treinamento já estava restrito a authenticated, mas reforçamos
DROP POLICY IF EXISTS "Authenticated users can read videos" ON storage.objects;
CREATE POLICY "Videos treinamento auth read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'videos-treinamento');

-- conformidades já tinha SELECT autenticado; remove duplicado público acima já tratado.
