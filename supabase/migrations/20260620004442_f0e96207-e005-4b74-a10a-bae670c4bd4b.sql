
-- Remove permissive legacy policies on sensitive buckets (no tenant scoping)
DROP POLICY IF EXISTS "Auth insert inspecoes" ON storage.objects;
DROP POLICY IF EXISTS "Auth update inspecoes" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete inspecoes" ON storage.objects;
DROP POLICY IF EXISTS "Inspecoes auth read" ON storage.objects;

DROP POLICY IF EXISTS "Auth users upload conformidades" ON storage.objects;
DROP POLICY IF EXISTS "Auth users update conformidades" ON storage.objects;
DROP POLICY IF EXISTS "Auth users delete conformidades" ON storage.objects;
DROP POLICY IF EXISTS "Auth users read conformidades" ON storage.objects;
DROP POLICY IF EXISTS "Conformidades auth read 2" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated upload fotos-reconhecimento" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete fotos-reconhecimento" ON storage.objects;
DROP POLICY IF EXISTS "Fotos reconhecimento auth read" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own videos" ON storage.objects;
DROP POLICY IF EXISTS "Videos treinamento auth read" ON storage.objects;
