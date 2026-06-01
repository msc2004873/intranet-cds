import supabase from '../../../../lib/supabase-server.js';

async function obtenerTipoCambioAPI() {
  try {
    const res = await fetch('https://api.hacienda.go.cr/indicadores/tc/dolar');
    const data = await res.json();
    if (data.venta && data.venta.valor) {
      return Math.round(data.venta.valor);
    }
  } catch (err) {
    console.error('Error obteniendo TC de API Hacienda:', err);
  }
  return 475;
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
    const tipoCambio = await obtenerTipoCambioAPI();

    // Generar fechas para el período actual
    const ultimoDiaDelMes = new Date(anoNum, mesNum, 0).getDate();
    const inicio = (periodoNum - 1) * 5 + 1;
    const fin = periodoNum === 6 ? ultimoDiaDelMes : periodoNum * 5;
    const fechaInicio = new Date(anoNum, mesNum - 1, inicio).toISOString().split('T')[0];
    const fechaFin = new Date(anoNum, mesNum - 1, fin).toISOString().split('T')[0];

    // Guardar en BD el TC actual del período (solo si es primer día)
    if (esPrimerDia) {
      try {
        const tcReal = tipoCambio + 10;
        const tcAjustado = tipoCambio;

        await supabase
          .from('periodos_tipo_cambio')
          .upsert({
            ano: anoNum,
            mes: mesNum,
            periodo_num: periodoNum,
            tipo_cambio: tcReal,
            tipo_cambio_ajustado: tcAjustado,
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin,
          }, { onConflict: 'ano,mes,periodo_num' });
      } catch (err) {
        console.log('Error guardando TC en BD:', err.message);
      }
    }

    // Obtener el TC del período actual de BD
    const { data: periodoData } = await supabase
      .from('periodos_tipo_cambio')
      .select('tipo_cambio_ajustado')
      .eq('ano', anoNum)
      .eq('mes', mesNum)
      .eq('periodo_num', periodoNum)
      .single();

    const tcActual = periodoData?.tipo_cambio_ajustado || tipoCambio;

    return Response.json({
      periodo: periodoNum,
      tipoCambio: tcActual,
      esPrimerDia,
      ano: anoNum,
      mes,
    });
  } catch (err) {
    console.error('Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
