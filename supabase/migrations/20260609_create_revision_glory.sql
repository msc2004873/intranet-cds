-- Create revision_glory table
CREATE TABLE IF NOT EXISTS revision_glory (
  id BIGSERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  cajera TEXT NOT NULL,
  revisora TEXT NOT NULL,
  hora_revision TEXT,
  caja TEXT,
  denominaciones_json JSONB,
  bac_revisado BIGINT DEFAULT 0,
  efectivo_revisado BIGINT DEFAULT 0,
  total_revisado BIGINT DEFAULT 0,
  total_cajera BIGINT DEFAULT 0,
  estado TEXT DEFAULT 'revisado',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_revision_glory_fecha_cajera ON revision_glory(fecha, cajera);
CREATE INDEX idx_revision_glory_created_at ON revision_glory(created_at);

-- Enable RLS
ALTER TABLE revision_glory ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can read revision_glory"
  ON revision_glory
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert revision_glory"
  ON revision_glory
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update revision_glory"
  ON revision_glory
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
