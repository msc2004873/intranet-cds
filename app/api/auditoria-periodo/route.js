import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const inicio = searchParams.get('inicio');
    const fin = searchParams.get('fin');

    if (!inicio || !fin) {
      return Response.json(
        { error: 'Missing inicio and fin parameters' },
        { status: 400 }
      );
    }

    // Fetch audit rows for all closures in the period
    const crDayStart = new Date(Date.UTC(
      parseInt(inicio.split('-')[0]),
      parseInt(inicio.split('-')[1]) - 1,
      parseInt(inicio.split('-')[2]),
      6, 0, 0
    )).toISOString();

    const crDayEnd = new Date(Date.UTC(
      parseInt(fin.split('-')[0]),
      parseInt(fin.split('-')[1]) - 1,
      parseInt(fin.split('-')[2]),
      6, 0, 0
    ) + (24 * 60 * 60 * 1000) - 1000).toISOString();

    // Get audit rows with related closure info
    const { data, error } = await supabase
      .from('revision_auditoria')
      .select(`
        *,
        revision_caja!inner (
          id,
          cierre_caja_id,
          cierre_caja!inner (
            id,
            fecha_hora,
            caja
          )
        )
      `)
      .gte('created_at', crDayStart)
      .lte('created_at', crDayEnd)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return Response.json(data || []);
  } catch (error) {
    console.error('Error fetching audit rows by period:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
