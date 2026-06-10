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
      return Response.json({ error: 'Missing inicio and fin' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('depositos_cds')
      .select('*')
      .eq('periodo_inicio', inicio)
      .eq('periodo_fin', fin)
      .maybeSingle();

    if (error) throw error;
    return Response.json(data || null);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { periodo_inicio, periodo_fin, denominaciones_colones, total_colones, denominaciones_usd, total_usd, contado_por } = await req.json();

    if (!periodo_inicio || !periodo_fin) {
      return Response.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('depositos_cds')
      .upsert(
        { periodo_inicio, periodo_fin, denominaciones_colones, total_colones, denominaciones_usd, total_usd, contado_por, updated_at: new Date().toISOString() },
        { onConflict: 'periodo_inicio,periodo_fin' }
      )
      .select()
      .single();

    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
