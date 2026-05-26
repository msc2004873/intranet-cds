import supabase from '../../../../lib/supabase-server.js';

async function obtenerTipoCambioAPI() {
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await res.json();
    if (data.rates && data.rates.CRC) {
      const tcBruto = Math.round(data.rates.CRC);
      return tcBruto - 10;
    }
  } catch (err) {
    console.error('Error obteniendo TC de API:', err);
  }
  return 475;
}

export async function GET(request) {
  try {
    const hoy = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Costa_Rica' }));
    const ano = hoy.getFullYear();
    const mes = hoy.getMonth() + 1;
    const dia = hoy.getDate();

    let periodoNum = 1;
    let esPrimerDia = false;

    if (dia <= 5) {
      periodoNum = 1;
      esPrimerDia = dia === 1;
    } else if (dia <= 10) {
      periodoNum = 2;
      esPrimerDia = dia === 6;
    } else if (dia <= 15) {
      periodoNum = 3;
      esPrimerDia = dia === 11;
    } else if (dia <= 20) {
      periodoNum = 4;
      esPrimerDia = dia === 16;
    } else if (dia <= 25) {
      periodoNum = 5;
      esPrimerDia = dia === 21;
    } else {
      periodoNum = 6;
      esPrimerDia = dia === 26;
    }

    // Obtener TC de la API
    const tipoCambio = await obtenerTipoCambioAPI();

    // Generar fechas para el período actual
    const ultimoDiaDelMes = new Date(ano, mes, 0).getDate();
    const inicio = (periodoNum - 1) * 5 + 1;
    const fin = periodoNum === 6 ? ultimoDiaDelMes : periodoNum * 5;
    const fechaInicio = new Date(ano, mes - 1, inicio).toISOString().split('T')[0];
    const fechaFin = new Date(ano, mes - 1, fin).toISOString().split('T')[0];

    // Guardar en BD el TC actual del período (solo si es primer día)
    if (esPrimerDia) {
      try {
        const tcReal = tipoCambio + 10;
        const tcAjustado = tipoCambio;

        await supabase
          .from('periodos_tipo_cambio')
          .upsert({
            ano,
            mes,
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
      .eq('ano', ano)
      .eq('mes', mes)
      .eq('periodo_num', periodoNum)
      .single();

    const tcActual = periodoData?.tipo_cambio_ajustado || tipoCambio;

    return Response.json({
      periodo: periodoNum,
      tipoCambio: tcActual,
      esPrimerDia,
      ano,
      mes,
    });
  } catch (err) {
    console.error('Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
