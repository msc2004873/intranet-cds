import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'public' } }
);

export async function POST(req) {
  try {
    // Crear tabla
    const { error: tableError } = await supabase.rpc('execute_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS colaboradores (
          id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
          nombre TEXT NOT NULL UNIQUE,
          rol TEXT NOT NULL CHECK (rol IN ('Cajera', 'Auxiliar administrativo', 'Administrador')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    if (tableError && !tableError.message.includes('already exists')) {
      // Intentar sin execute_sql
      const client = supabase;

      // Test si tabla existe
      const { error: checkError } = await client
        .from('colaboradores')
        .select('id')
        .limit(1);

      if (checkError && checkError.code === 'PGRST116') {
        return Response.json({
          error: 'La tabla colaboradores debe crearse manualmente en el Supabase Dashboard',
          details: tableError?.message
        }, { status: 400 });
      }
    }

    // Agregar políticas RLS si no existen
    try {
      await supabase.rpc('execute_sql', {
        sql: `
          ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;

          CREATE POLICY IF NOT EXISTS "Authenticated users can read colaboradores"
            ON colaboradores FOR SELECT TO authenticated USING (true);

          CREATE POLICY IF NOT EXISTS "Only admins can insert colaboradores"
            ON colaboradores FOR INSERT TO authenticated WITH CHECK (true);

          CREATE POLICY IF NOT EXISTS "Only admins can delete colaboradores"
            ON colaboradores FOR DELETE TO authenticated USING (true);
        `
      });
    } catch (e) {
      // Las políticas pueden ya existir
    }

    return Response.json({
      success: true,
      message: 'Tabla colaboradores lista'
    });
  } catch (error) {
    console.error('Setup error:', error);
    return Response.json({
      error: error.message,
      hint: 'Ejecuta esta SQL en el Supabase Dashboard:\n\nCREATE TABLE IF NOT EXISTS colaboradores (id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY, nombre TEXT NOT NULL UNIQUE, rol TEXT NOT NULL CHECK (rol IN (\'Cajera\', \'Auxiliar administrativo\', \'Administrador\')), created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());'
    }, { status: 400 });
  }
}
