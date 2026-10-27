import { createClient } from '@supabase/supabase-js';
import { traerTodas } from '../../../lib/traerTodas.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  try {
    // Por páginas: pasando de 1000 revisiones, las que quedaran afuera harían que sus
    // cierres volvieran a salir como pendientes.
    const data = await traerTodas(() => supabase
      .from('revision_caja')
      .select('cierre_caja_id')
      .order('id', { ascending: true }));

    return Response.json(data || []);
  } catch (error) {
    console.error('Error fetching revision_caja IDs:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
