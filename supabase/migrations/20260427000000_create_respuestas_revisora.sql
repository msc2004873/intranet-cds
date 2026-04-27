-- Create respuestas_revisora table for review data
CREATE TABLE respuestas_revisora (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  revisora TEXT NOT NULL,
  caja_revisada TEXT NOT NULL,
  fecha_cierre_revisado TIMESTAMP WITH TIME ZONE,
  efectivo_contado NUMERIC DEFAULT 0,
  tarjeta_verificada NUMERIC DEFAULT 0,
  sinpe_verificado NUMERIC DEFAULT 0,
  estado TEXT DEFAULT 'pendiente',
  observaciones TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE respuestas_revisora ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can read respuestas_revisora"
  ON respuestas_revisora
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert respuestas_revisora"
  ON respuestas_revisora
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
