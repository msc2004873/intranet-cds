import supabase from '../../../../lib/supabase-server.js';

export async function GET(request) {
  try {
    const hoy = new Date();
    const ano = hoy.getFullYear();
    const mes = hoy.getMonth() + 1;

    // Intentar obtener TC de BD
    let periodosTc = [];
    try {
      const { data } = await supabase
        .from('periodo_tipos_cambio')
        .select('periodo_num, tipo_cambio')
        .eq('ano', ano)
        .eq('mes', mes)
        .order('periodo_num');

      if (data && data.length > 0) {
        periodosTc = data.reduce((acc, p) => {
          acc[p.periodo_num] = p.tipo_cambio;
          return acc;
        }, {});
      }
    } catch (err) {
      console.log('Tabla TC no existe aún');
    }

    // Generar períodos
    const periodos = [];
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const mesStr = meses[mes - 1];

    for (let i = 1; i <= 6; i++) {
      const inicio = (i - 1) * 5 + 1;
      const fin = i === 6 ? new Date(ano, mes, 0).getDate() : i * 5;

      periodos.push({
        periodo_num: i,
        fecha_inicio: `${inicio} de ${mesStr}`,
        fecha_fin: `${fin} de ${mesStr}`,
        tipo_cambio: periodosTc[i] || 475,
      });
    }

    return Response.json({ periodos });
  } catch (err) {
    console.error('Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
