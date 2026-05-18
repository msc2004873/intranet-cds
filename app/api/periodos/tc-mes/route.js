import supabase from '../../../../lib/supabase-server.js';

const getPeriodosDelMes = (fecha = new Date()) => {
  const ano = fecha.getFullYear();
  const mes = fecha.getMonth() + 1;
  const ultimoDiaMes = new Date(ano, mes, 0).getDate();

  const periodos = [
    { num: 1, inicio: 1, fin: 5 },
    { num: 2, inicio: 6, fin: 10 },
    { num: 3, inicio: 11, fin: 15 },
    { num: 4, inicio: 16, fin: 20 },
    { num: 5, inicio: 21, fin: 25 },
    { num: 6, inicio: 26, fin: ultimoDiaMes },
  ];

  return periodos.map(p => ({
    num: p.num,
    inicio: new Date(ano, mes - 1, p.inicio),
    fin: new Date(ano, mes - 1, p.fin),
  }));
};

export async function GET(request) {
  try {
    const hoy = new Date();
    const ano = hoy.getFullYear();
    const mes = hoy.getMonth() + 1;

    // Obtener períodos del mes actual
    const periodosDelMes = getPeriodosDelMes(hoy);

    // Buscar TC para cada período
    const { data: periodosTC } = await supabase
      .from('periodos_tipo_cambio')
      .select('periodo_num, tipo_cambio, fecha_inicio, fecha_fin')
      .eq('ano', ano)
      .eq('mes', mes)
      .order('periodo_num', { ascending: true });

    // Unificar datos
    const periodos = periodosDelMes.map(p => {
      const tcData = periodosTC?.find(tc => tc.periodo_num === p.num);
      return {
        periodo_num: p.num,
        fecha_inicio: p.inicio.toISOString().split('T')[0],
        fecha_fin: p.fin.toISOString().split('T')[0],
        tipo_cambio: tcData?.tipo_cambio || null,
      };
    });

    return Response.json({ periodos }, { status: 200 });
  } catch (err) {
    console.error('Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
