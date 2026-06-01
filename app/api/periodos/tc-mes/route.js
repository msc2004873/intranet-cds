import supabase from '../../../../lib/supabase-server.js';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const anoParam = url.searchParams.get('ano');
    const mesParam = url.searchParams.get('mes');

    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Costa_Rica',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const [mes_str, dia_str, ano_str] = formatter.format(now).split('/');
    const diaHoy = parseInt(dia_str);
    const mesHoy = parseInt(mes_str);
    const anoHoy = parseInt(ano_str);

    let ano = anoParam ? parseInt(anoParam) : anoHoy;
    let mes = mesParam ? parseInt(mesParam) : mesHoy;

    // Obtener todos los TC disponibles del mes/año especificado
    let todosTc = [];
    try {
      const { data, error } = await supabase
        .from('periodos_tipo_cambio')
        .select('*')
        .eq('ano', ano)
        .eq('mes', mes)
        .order('periodo_num', { ascending: true });

      if (error) {
        console.log('Error en query:', error);
      } else {
        console.log(`Registros obtenidos para ${ano}-${mes}:`, data?.length || 0);
      }
      todosTc = data || [];
    } catch (err) {
      console.log('Error obteniendo TC de BD:', err.message);
    }

    // Generar respuesta con los 6 períodos del mes
    const periodos = [];
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const mesStr = meses[mes - 1];
    const tcMap = {};

    // Mapear TC por periodo_num
    todosTc.forEach(tc => {
      tcMap[tc.periodo_num] = tc;
    });

    // Determinar qué períodos son futuros (usando Costa Rica time)
    const esMesActual = ano === anoHoy && mes === mesHoy;

    // Generar los 6 períodos del mes
    for (let i = 1; i <= 6; i++) {
      const inicio = (i - 1) * 5 + 1;
      const ultimoDiaDelMes = new Date(ano, mes, 0).getDate();
      const fin = i === 6 ? ultimoDiaDelMes : i * 5;

      // Determinar si es futuro
      let esFuturo = false;
      if (esMesActual) {
        esFuturo = diaHoy < inicio;
      } else if (ano > anoHoy || (ano === anoHoy && mes > mesHoy)) {
        esFuturo = true;
      }

      const tc = tcMap[i];
      periodos.push({
        ano,
        mes,
        mes_str: mesStr,
        periodo_num: i,
        fecha_inicio: `${inicio} de ${mesStr}`,
        fecha_fin: `${fin} de ${mesStr}`,
        tipo_cambio: tc ? tc.tipo_cambio : null,
        tipo_cambio_ajustado: tc ? tc.tipo_cambio_ajustado : null,
        esFuturo,
        fecha_registro: tc ? tc.fecha_registro : null,
      });
    }

    return Response.json({ periodos });
  } catch (err) {
    console.error('Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
