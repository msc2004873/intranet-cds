import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get('tipo');
    const fecha = searchParams.get('fecha');

    let query = supabase.from('movimientos').select('*');

    if (tipo) {
      query = query.eq('tipo', tipo);
    }

    if (fecha) {
      query = query.eq('fecha', fecha);
    }

    const { data, error } = await query;

    if (error) throw error;

    return Response.json(data || []);
  } catch (err) {
    console.error('Error movimientos:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
