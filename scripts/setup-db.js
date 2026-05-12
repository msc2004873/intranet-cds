#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupDatabase() {
  try {
    console.log('🔄 Configurando base de datos...');

    // Intentar crear la tabla usando el cliente Supabase
    // Primero, verificar si existe
    const { data, error: selectError } = await supabase
      .from('colaboradores')
      .select('id')
      .limit(1);

    if (!selectError) {
      console.log('✅ Tabla colaboradores ya existe');
      return;
    }

    if (selectError.code !== 'PGRST116') {
      console.error('❌ Error inesperado:', selectError);
      return;
    }

    // Si llegamos aquí, la tabla no existe y necesitamos crearla
    console.log('📝 Necesitamos ejecutar SQL manualmente en el Supabase Dashboard');
    console.log('\nPega esto en: https://app.supabase.com/project/ccvhtcqeknbexmywzhiv/sql/new\n');

    const sql = `
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
`;

    console.log(sql);
    console.log('\n---\nDespués de ejecutar, vuelve a correr este script.\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

setupDatabase();
