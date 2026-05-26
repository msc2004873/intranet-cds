import supabase from '../../../../lib/supabase-server.js';

export async function GET(request) {
  try {
    const { data, error } = await supabase
      .from('periodo_tipos_cambio')
      .select('*')
      .eq('ano', 2026)
      .eq('mes', 3);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      marzo_total: data ? data.length : 0,
      datos: data
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
