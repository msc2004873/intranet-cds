import supabase from '../../../../lib/supabase-server.js';

export async function GET(request) {
  try {
    const { data, error } = await supabase
      .from('periodo_tipos_cambio')
      .select('*')
      .order('ano', { ascending: false })
      .order('mes', { ascending: false });

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const count = data ? data.length : 0;

    // Agrupar por mes
    const porMes = {};
    if (data) {
      data.forEach(tc => {
        const key = `${tc.ano}-${String(tc.mes).padStart(2, '0')}`;
        if (!porMes[key]) {
          porMes[key] = [];
        }
        porMes[key].push(tc);
      });
    }

    return Response.json({
      totalRegistros: count,
      porMes,
      data: data || []
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
