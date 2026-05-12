-- Drop existing table if exists
DROP TABLE IF EXISTS cobros_glory CASCADE;

-- Create new cobros_glory table with updated schema
CREATE TABLE cobros_glory (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_mascota text NOT NULL,
  nombre_dueno text NOT NULL,
  telefono_dueno text,
  hora_ingreso timestamptz NOT NULL DEFAULT now(),
  metodo_pago text,
  monto numeric,
  cobrado boolean DEFAULT false,
  hora_cobro timestamptz,
  cajera text,
  fecha date NOT NULL DEFAULT current_date,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE cobros_glory ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for authenticated users
CREATE POLICY "Allow authenticated users"
  ON cobros_glory
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
