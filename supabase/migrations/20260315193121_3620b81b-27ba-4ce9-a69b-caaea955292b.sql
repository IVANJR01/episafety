
-- Add column for facial recognition photo URL
ALTER TABLE public.entregas ADD COLUMN foto_reconhecimento text DEFAULT NULL;

-- Create storage bucket for facial recognition photos
INSERT INTO storage.buckets (id, name, public) VALUES ('fotos-reconhecimento', 'fotos-reconhecimento', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: anyone can view photos (public bucket)
CREATE POLICY "Public read fotos-reconhecimento" ON storage.objects
FOR SELECT USING (bucket_id = 'fotos-reconhecimento');

-- RLS: authenticated users can upload
CREATE POLICY "Authenticated upload fotos-reconhecimento" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fotos-reconhecimento');

-- RLS: authenticated users can delete their uploads
CREATE POLICY "Authenticated delete fotos-reconhecimento" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'fotos-reconhecimento');
