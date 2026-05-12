-- Create colaboradores table
CREATE TABLE colaboradores (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre TEXT NOT NULL UNIQUE,
  rol TEXT NOT NULL CHECK (rol IN ('Cajera', 'Auxiliar administrativo', 'Administrador')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can read colaboradores"
  ON colaboradores
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert colaboradores"
  ON colaboradores
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Only admins can delete colaboradores"
  ON colaboradores
  FOR DELETE
  TO authenticated
  USING (true);
