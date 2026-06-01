import supabase from '../../../../lib/supabase-server.js';

async function obtenerTipoCambioAPI() {
  try {
    const res = await fetch('https://api.hacienda.go.cr/indicadores/tc/dolar');
    const data = await res.json();
    if (data.compra && data.compra.valor) {
      const compra = Math.round(data.compra.valor);
      return {
        compra: compra,
        compraAjustada: compra - 10,
      };
    }
  } catch (err) {
    console.error('Error obteniendo TC de API Hacienda:', err);
  }
  return { compra: 465, compraAjustada: 455 };
}

export async function GET(request) {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Costa_Rica',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const [mes, dia, ano] = formatter.format(now).split('/');
    const mesActual = parseInt(mes);
    const diaActual = parseInt(dia);
    const anoActual = parseInt(ano);
    const periodoActual = Math.ceil(diaActual / 5);

    // Asegurar que existan los 6 períodos del mes
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

    // Upsert todos los períodos (crear si no existen, actualizar si existen)
    const { error: upsertError } = await supabase
      .from('periodos_tipo_cambio')
      .upsert(registros, { onConflict: 'ano,mes,periodo_num' });

    if (upsertError) {
      console.error('Error upserting períodos:', upsertError);
      return Response.json({ error: upsertError.message }, { status: 400 });
    }

    // Ahora, si es el primer día del período actual, insertar el TC
    if (diaActual === (periodoActual - 1) * 5 + 1) {
      const tcAPI = await obtenerTipoCambioAPI();

      const { error: updateError } = await supabase
        .from('periodos_tipo_cambio')
        .update({
          tipo_cambio: tcAPI.compra,
          tipo_cambio_ajustado: tcAPI.compraAjustada,
        })
        .eq('ano', anoActual)
        .eq('mes', mesActual)
        .eq('periodo_num', periodoActual);

      if (updateError) {
        console.error('Error actualizando TC:', updateError);
      }
    }

    // Obtener resultado final
    const { data: resultados } = await supabase
      .from('periodos_tipo_cambio')
      .select('*')
      .eq('ano', anoActual)
      .eq('mes', mesActual)
      .order('periodo_num');

    const resumenPeriodos = resultados?.map(r => ({
      periodo: r.periodo_num,
      tc: r.tipo_cambio,
      ajustado: r.tipo_cambio_ajustado,
    })) || [];

    return Response.json({
      success: true,
      periodoActual,
      esPrimerDia: diaActual === (periodoActual - 1) * 5 + 1,
      periodos: resumenPeriodos,
    });
  } catch (err) {
    console.error('Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
