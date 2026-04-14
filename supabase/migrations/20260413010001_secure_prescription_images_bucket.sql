-- F-002: Declare prescription-images bucket as private and lock down storage RLS.
-- Mirrors the care-documents pattern: only service_role manages objects, all
-- access is brokered through signed URLs minted by the API layer.

INSERT INTO storage.buckets (id, name, public)
VALUES ('prescription-images', 'prescription-images', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- If a policy with the same name already exists from earlier hand-creation,
-- drop and recreate to guarantee scope.
DROP POLICY IF EXISTS "service role can manage prescription-images" ON storage.objects;

CREATE POLICY "service role can manage prescription-images"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'prescription-images');
