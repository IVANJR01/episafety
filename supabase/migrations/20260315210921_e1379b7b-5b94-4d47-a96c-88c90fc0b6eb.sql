-- Create storage bucket for backups
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for backups bucket
CREATE POLICY "Authenticated users can upload backups"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'backups');

CREATE POLICY "Users can read own empresa backups"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'backups'
  AND (
    is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = get_user_empresa_id(auth.uid())::text
  )
);

CREATE POLICY "Users can delete own empresa backups"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'backups'
  AND (
    is_super_admin(auth.uid())
    OR (storage.foldername(name))[1] = get_user_empresa_id(auth.uid())::text
  )
);