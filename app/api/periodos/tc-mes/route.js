import supabase from '../../../../lib/supabase-server.js';

export async function GET(request) {
  try {
    const hoy = new Date();
    const ano = hoy.getFullYear();
    const mes = hoy.getMonth() + 1;

    // Obtener todos los TC disponibles
    let todosTc = [];
    try {
      const { data } = await supabase
        .from('periodo_tipos_cambio')
        .select('*')
        .eq('ano', ano)
        .order('mes', { ascending: false })
        .order('periodo_num', { ascending: false });

      todosTc = data || [];
    } catch (err) {
      console.log('Error obteniendo TC de BD:', err.message);
    }

    // Agrupar por mes/año
    const porMes = {};
    todosTc.forEach(tc => {
      const key = `${tc.ano}-${tc.mes}`;
      if (!porMes[key]) {
        porMes[key] = [];
      }
      porMes[key].push(tc);
    });

    // Generar respuesta con histórico
    const periodos = [];
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

    // Mostrar mes actual y anteriores con datos
    Object.keys(porMes)
      .sort()
      .reverse()
      .forEach(key => {
        const [a, m] = key.split('-').map(Number);
        const mesData = porMes[key];
        const mesStr = meses[m - 1];

        mesData.forEach(tc => {
          const inicio = (tc.periodo_num - 1) * 5 + 1;
          const ultimoDiaDelMes = new Date(a, m, 0).getDate();
          const fin = tc.periodo_num === 6 ? ultimoDiaDelMes : tc.periodo_num * 5;

          periodos.push({
            ano: a,
            mes: m,
            mes_str: mesStr,
            periodo_num: tc.periodo_num,
            fecha_inicio: `${inicio} de ${mesStr}`,
            fecha_fin: `${fin} de ${mesStr}`,
            tipo_cambio: tc.tipo_cambio,
            tipo_cambio_bruto: tc.tipo_cambio_bruto,
            fecha_registro: tc.fecha_registro,
          });
        });
      });

    // Si no hay datos, generar estructural del mes actual
    if (periodos.length === 0) {
      for (let i = 1; i <= 6; i++) {
        const inicio = (i - 1) * 5 + 1;
        const fin = i === 6 ? new Date(ano, mes, 0).getDate() : i * 5;

        periodos.push({
          ano,
          mes,
          mes_str: meses[mes - 1],
          periodo_num: i,
          fecha_inicio: `${inicio} de ${meses[mes - 1]}`,
          fecha_fin: `${fin} de ${meses[mes - 1]}`,
          tipo_cambio: 475,
          tipo_cambio_bruto: 485,
          fecha_registro: null,
        });
      }
    }

    return Response.json({ periodos });
  } catch (err) {
    console.error('Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
