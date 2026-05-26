import supabase from '../../../../lib/supabase-server.js';

export async function GET(request) {
  try {
    const hoy = new Date();
    const anoActual = hoy.getFullYear();
    const mesActual = hoy.getMonth() + 1;
    const diaActual = hoy.getDate();

    let resultado = { creados: 0, actualizados: 0, mensaje: 'Sin cambios' };

    // 1. SI ES PRIMER DIA DEL MES → Crear los 6 períodos
    if (diaActual === 1) {
      const ultimoDiaDelMes = new Date(anoActual, mesActual, 0).getDate();
      const registros = [];

      for (let periodo = 1; periodo <= 6; periodo++) {
        const inicio = (periodo - 1) * 5 + 1;
        const fin = periodo === 6 ? ultimoDiaDelMes : periodo * 5;

        const fechaInicio = new Date(anoActual, mesActual - 1, inicio)
          .toISOString()
          .split('T')[0];
        const fechaFin = new Date(anoActual, mesActual - 1, fin)
          .toISOString()
          .split('T')[0];

        registros.push({
          ano: anoActual,
          mes: mesActual,
          periodo_num: periodo,
          tipo_cambio: null,
          tipo_cambio_ajustado: null,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
        });
      }

      const { error, data } = await supabase
        .from('periodos_tipo_cambio')
        .upsert(registros, { onConflict: 'ano,mes,periodo_num' });

      if (error) {
        console.error('Error creando períodos:', error);
        return Response.json(
          { error: error.message },
          { status: 400 }
        );
      }

      resultado.creados = registros.length;
      resultado.mensaje = `Creados ${registros.length} períodos de ${mesActual}/${anoActual}`;
    }

    // 2. DETERMINAR PERIODO ACTUAL y actualizar TC si es primer día del período
    const periodoActual = Math.ceil(diaActual / 5);
    const primerDiaDelPeriodo = (periodoActual - 1) * 5 + 1;

    if (diaActual === primerDiaDelPeriodo) {
      // Obtener TC del API
      const tcReal = await fetch(
        'https://api.exchangerate-api.com/v4/latest/USD'
      )
        .then((r) => r.json())
        .then((d) => (d.rates?.CRC ? Math.round(d.rates.CRC) : 475))
        .catch(() => 475);

      const tcAjustado = tcReal - 10;

      const { error } = await supabase
        .from('periodos_tipo_cambio')
        .update({
          tipo_cambio: tcReal,
          tipo_cambio_ajustado: tcAjustado,
        })
        .eq('ano', anoActual)
        .eq('mes', mesActual)
        .eq('periodo_num', periodoActual);

      if (error) {
        console.error('Error actualizando TC:', error);
        return Response.json(
          { error: error.message },
          { status: 400 }
        );
      }

      resultado.actualizados = 1;
      resultado.mensaje = `TC guardado: ${tcReal} (ajustado: ${tcAjustado})`;
    }

    return Response.json(resultado);
  } catch (err) {
    console.error('Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
