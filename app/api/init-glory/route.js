import { createClient } from '@supabase/supabase-js';

export async function POST() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await supabase.rpc('_invoke_function', {
      function_name: 'exec',
      function_params: {
        sql: `
          CREATE TABLE IF NOT EXISTS cobros_glory (
            id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
            cajera TEXT NOT NULL,
            fecha DATE NOT NULL,
            metodo TEXT NOT NULL,
            monto NUMERIC NOT NULL,
            comprobante TEXT,
            comentarios TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_cobros_glory_fecha ON cobros_glory(fecha);
        `
      }
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, message: 'Tabla creada' });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
