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

    let resultado = { creados: 0, insertados: 0, mensaje: 'Sin cambios' };

    // 1. SI ES PRIMER DIA DEL MES → Crear los 6 períodos con NULL
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

    // 2. DETERMINAR PERIODO ACTUAL e insertar TC si es primer día del período (solo si NO existe)
    const periodoActual = Math.ceil(diaActual / 5);
    const primerDiaDelPeriodo = (periodoActual - 1) * 5 + 1;

    if (diaActual === primerDiaDelPeriodo) {
      // NUNCA UPDATE - SOLO INSERT una vez
      // Si ya existe, NUNCA tocar
      resultado.mensaje = `Período ${periodoActual} ya tiene TC - no se actualiza`;

      /* DESHABILITADO: No actualizar TC nunca
      const { data: existe } = await supabase
        .from('periodos_tipo_cambio')
        .select('id')
        .eq('ano', anoActual)
        .eq('mes', mesActual)
        .eq('periodo_num', periodoActual)
        .single();

      if (!existe) {
        // solo insert si no existe
        resultado.insertados = 1;
      }
      */
      }
    }

    return Response.json(resultado);
  } catch (err) {
    console.error('Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
