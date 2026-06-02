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
    const mesNum = parseInt(mes);
    const diaNum = parseInt(dia);
    const anoNum = parseInt(ano);

    let periodoNum = 1;
    let esPrimerDia = false;

    if (diaNum <= 5) {
      periodoNum = 1;
      esPrimerDia = diaNum === 1;
    } else if (diaNum <= 10) {
      periodoNum = 2;
      esPrimerDia = diaNum === 6;
    } else if (diaNum <= 15) {
      periodoNum = 3;
      esPrimerDia = diaNum === 11;
    } else if (diaNum <= 20) {
      periodoNum = 4;
      esPrimerDia = diaNum === 16;
    } else if (diaNum <= 25) {
      periodoNum = 5;
      esPrimerDia = diaNum === 21;
    } else {
      periodoNum = 6;
      esPrimerDia = diaNum === 26;
    }

    // Obtener TC de la API
    const tcAPI = await obtenerTipoCambioAPI();

    // Generar fechas para el período actual
    const ultimoDiaDelMes = new Date(anoNum, mesNum, 0).getDate();
    const inicio = (periodoNum - 1) * 5 + 1;
    const fin = periodoNum === 6 ? ultimoDiaDelMes : periodoNum * 5;
    const fechaInicio = new Date(anoNum, mesNum - 1, inicio).toISOString().split('T')[0];
    const fechaFin = new Date(anoNum, mesNum - 1, fin).toISOString().split('T')[0];

    // Guardar en BD el TC actual del período (solo si es primer día y NO existe)
    if (esPrimerDia) {
      try {
        const { data: existe } = await supabase
          .from('periodos_tipo_cambio')
          .select('id')
          .eq('ano', anoNum)
          .eq('mes', mesNum)
          .eq('periodo_num', periodoNum)
          .single();

        if (!existe) {
          await supabase
            .from('periodos_tipo_cambio')
            .insert({
              ano: anoNum,
              mes: mesNum,
              periodo_num: periodoNum,
              tipo_cambio: tcAPI.compra,
              tipo_cambio_ajustado: tcAPI.compraAjustada,
              fecha_inicio: fechaInicio,
              fecha_fin: fechaFin,
            });
        }
        // NUNCA actualizar si ya existe - TC está BLOQUEADO una vez guardado
      } catch (err) {
        console.log('Error guardando TC en BD:', err.message);
      }
    }

    // Obtener el TC del período actual de BD
    const { data: periodoData } = await supabase
      .from('periodos_tipo_cambio')
      .select('tipo_cambio, tipo_cambio_ajustado')
      .eq('ano', anoNum)
      .eq('mes', mesNum)
      .eq('periodo_num', periodoNum)
      .single();

    const tcActual = periodoData?.tipo_cambio || tcAPI.compra;
    const tcAjustadoActual = periodoData?.tipo_cambio_ajustado || tcAPI.compraAjustada;

    return Response.json({
      periodo: periodoNum,
      tipoCambio: tcActual,
      tipoCambioAjustado: tcAjustadoActual,
      esPrimerDia,
      ano: anoNum,
      mes,
    });
  } catch (err) {
    console.error('Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
