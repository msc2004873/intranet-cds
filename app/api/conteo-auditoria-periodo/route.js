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
      .from('conteo_auditoria_periodo')
      .select('*')
      .eq('periodo_inicio', inicio)
      .eq('periodo_fin', fin);

    if (error) throw error;
    return Response.json(data || []);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { periodo_inicio, periodo_fin, caja, denominaciones, total_efectivo, contado_por } = await req.json();

    if (!periodo_inicio || !periodo_fin || !caja) {
      return Response.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('conteo_auditoria_periodo')
      .upsert(
        { periodo_inicio, periodo_fin, caja, denominaciones, total_efectivo, contado_por, updated_at: new Date().toISOString() },
        { onConflict: 'periodo_inicio,periodo_fin,caja' }
      )
      .select()
      .single();

    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
