import supabase from '../../../../lib/supabase-server.js';

export async function GET(request) {
  try {
    const hoy = new Date();
    const anoActual = hoy.getFullYear();
    const mesActual = hoy.getMonth() + 1;

    // Últimos 2 meses: marzo y abril de 2026
    const registros = [];

    // Función para generar registros
    const generarRegistros = (ano, mes) => {
      const ultimoDiaDelMes = new Date(ano, mes, 0).getDate();
      const regs = [];

      for (let periodo = 1; periodo <= 6; periodo++) {
        const inicio = (periodo - 1) * 5 + 1;
        const fin = periodo === 6 ? ultimoDiaDelMes : periodo * 5;

        // Formato YYYY-MM-DD
        const fechaInicio = new Date(ano, mes - 1, inicio).toISOString().split('T')[0];
        const fechaFin = new Date(ano, mes - 1, fin).toISOString().split('T')[0];

        const tcReal = (mes === 3 ? 485 : 490) + periodo;
        const tcAjustado = tcReal - 10;

        regs.push({
          ano,
          mes,
          periodo_num: periodo,
          tipo_cambio: tcReal,
          tipo_cambio_ajustado: tcAjustado,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
        });
      }
      return regs;
    };

    // Marzo 2026
    registros.push(...generarRegistros(2026, 3));

    // Abril 2026
    registros.push(...generarRegistros(2026, 4));

    // Hacer insert de uno en uno
    let insertados = 0;
    let errores = [];
    for (const reg of registros) {
      try {
        const { error } = await supabase
          .from('periodos_tipo_cambio')
          .upsert([reg], { onConflict: 'ano,mes,periodo_num' });

        if (error) {
          errores.push(`${reg.periodo_num}: ${error.message}`);
        } else {
          insertados++;
        }
      } catch (err) {
        errores.push(`${reg.periodo_num}: ${err.message}`);
      }
    }

    // Verificar que se insertaron
    let datosVerificacion = [];
    try {
      const { data } = await supabase
        .from('periodos_tipo_cambio')
        .select('*')
        .eq('ano', 2026)
        .eq('mes', 3);
      datosVerificacion = data || [];
    } catch (err) {
      console.log('Error verificando:', err.message);
    }

    return Response.json({
      success: true,
      registrosInsertados: insertados,
      registrosEnBD: datosVerificacion.length,
      errores: errores.length > 0 ? errores : null,
      datosVerificacion,
      registros
    });
  } catch (err) {
    console.error('Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
