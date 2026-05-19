-- Create movimientos bucket for storing SINPE, transferencia, and salida images/PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('movimientos', 'movimientos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for movimientos bucket
CREATE POLICY "Authenticated users can upload to movimientos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'movimientos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can read from movimientos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'movimientos'
  );

CREATE POLICY "Authenticated users can delete their own files in movimientos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'movimientos'
    AND auth.role() = 'authenticated'
  );
