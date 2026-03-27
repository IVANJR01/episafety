
-- Create storage bucket for training documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-treinamento', 'documentos-treinamento', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the bucket
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documentos-treinamento');

CREATE POLICY "Authenticated users can view documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documentos-treinamento');

CREATE POLICY "Authenticated users can delete own documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documentos-treinamento');
