-- Create cobros_glory table for Glory transactions
CREATE TABLE cobros_glory (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  cajera TEXT NOT NULL,
  fecha DATE NOT NULL,
  metodo TEXT NOT NULL,
  monto NUMERIC NOT NULL,
  comprobante TEXT,
  comentarios TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries by date
CREATE INDEX idx_cobros_glory_fecha ON cobros_glory(fecha);

-- Enable RLS
ALTER TABLE cobros_glory ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can read cobros_glory"
  ON cobros_glory
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert cobros_glory"
  ON cobros_glory
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
