import supabase from '../../../../lib/supabase-server.js';

export async function GET(request) {
  try {
    const { data } = await supabase
      .from('periodos_tipo_cambio')
      .select('*')
      .eq('ano', 2026)
      .eq('mes', 3)
      .limit(1);

    return Response.json({
      record: data ? data[0] : null,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
