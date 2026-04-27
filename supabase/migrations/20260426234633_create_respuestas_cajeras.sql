-- Create respuestas_cajeras table for cierre de caja
CREATE TABLE respuestas_cajeras (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  fecha_hora TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cajera TEXT NOT NULL,
  caja TEXT NOT NULL,
  tc NUMERIC DEFAULT 475,

  -- Denominaciones en caja
  c_20000 INT DEFAULT 0,
  c_10000 INT DEFAULT 0,
  c_5000 INT DEFAULT 0,
  c_2000 INT DEFAULT 0,
  c_1000 INT DEFAULT 0,
  c_500 INT DEFAULT 0,
  c_100 INT DEFAULT 0,
  c_50 INT DEFAULT 0,
  c_25 INT DEFAULT 0,
  c_10 INT DEFAULT 0,
  c_5 INT DEFAULT 0,

  -- Denominaciones que quedan
  q_20000 INT DEFAULT 0,
  q_10000 INT DEFAULT 0,
  q_5000 INT DEFAULT 0,
  q_2000 INT DEFAULT 0,
  q_1000 INT DEFAULT 0,
  q_500 INT DEFAULT 0,
  q_100 INT DEFAULT 0,
  q_50 INT DEFAULT 0,
  q_25 INT DEFAULT 0,
  q_10 INT DEFAULT 0,
  q_5 INT DEFAULT 0,

  -- Otros pagos
  dolares_total NUMERIC DEFAULT 0,
  tarjeta_bac NUMERIC DEFAULT 0,
  tarjeta_bn NUMERIC DEFAULT 0,

  -- JSONs complejos
  sinpe_json JSONB,
  depositos_json JSONB,
  salidas_json JSONB,
  glory_json JSONB,

  -- URLs
  qvet_pdf_url TEXT,
  fotos_sinpe_urls JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE respuestas_cajeras ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can read respuestas_cajeras"
  ON respuestas_cajeras
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert respuestas_cajeras"
  ON respuestas_cajeras
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
