-- Bucket para las fotos de comprobantes de depósitos bancarios.
-- Mismo patrón que 20260519_create_movimientos_bucket.sql. El upload real lo hace el
-- service role vía API (bypassa estas políticas); se incluyen para lectura pública del <img>.

INSERT INTO storage.buckets (id, name, public)
VALUES ('depositos', 'depositos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload to depositos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'depositos' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can read from depositos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'depositos');

CREATE POLICY "Authenticated users can delete in depositos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'depositos' AND auth.role() = 'authenticated');
