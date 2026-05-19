import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const cobrado = searchParams.get('cobrado');
    const fecha = searchParams.get('fecha');
    const inicio = searchParams.get('inicio');
    const fin = searchParams.get('fin');

    let query = supabase.from('cobros_glory').select('*');

    if (cobrado === 'true') {
      query = query.eq('cobrado', true);
    } else if (cobrado === 'false') {
      query = query.eq('cobrado', false);
    }

    if (fecha) {
      query = query.eq('fecha', fecha);
    }

    if (inicio && fin) {
      query = query.gte('fecha', inicio).lte('fecha', fin);
    }

    // Filtrar solo registros con monto (omitir registros individuales de cobros unificados)
    query = query.not('monto', 'is', null);

    const { data, error } = await query;

    if (error) throw error;

    return Response.json(data || []);
  } catch (err) {
    console.error('Error cobros-glory:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
