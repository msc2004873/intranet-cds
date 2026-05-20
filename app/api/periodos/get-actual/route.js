import supabase from '../../../../lib/supabase-server.js';

async function obtenerTipoCambioAPI() {
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await res.json();
    if (data.rates && data.rates.CRC) {
      const tcBruto = Math.round(data.rates.CRC);
      return { bruto: tcBruto, ajustado: tcBruto - 10 };
    }
  } catch (err) {
    console.error('Error obteniendo TC de API:', err);
  }
  return { bruto: 485, ajustado: 475 };
}

export async function GET(request) {
  try {
    const hoy = new Date();
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
    const tcData = await obtenerTipoCambioAPI();
    let tipoCambio = tcData.ajustado;

    // Guardar en BD el TC actual (siempre, para que esté actualizado)
    try {
      await supabase
        .from('periodo_tipos_cambio')
        .upsert({
          ano,
          mes,
          periodo_num: periodoNum,
          tipo_cambio: tipoCambio,
          tipo_cambio_bruto: tcData.bruto,
        }, { onConflict: 'ano,mes,periodo_num' });
    } catch (err) {
      console.log('Error guardando TC en BD:', err.message);
    }

    // Si hay períodos anteriores sin TC, completarlos con el mismo TC
    if (periodoNum > 1) {
      try {
        for (let p = 1; p < periodoNum; p++) {
          const { data: existente } = await supabase
            .from('periodo_tipos_cambio')
            .select('id')
            .eq('ano', ano)
            .eq('mes', mes)
            .eq('periodo_num', p)
            .single();

          if (!existente) {
            await supabase
              .from('periodo_tipos_cambio')
              .insert({
                ano,
                mes,
                periodo_num: p,
                tipo_cambio: tipoCambio,
                tipo_cambio_bruto: tcData.bruto,
              });
          }
        }
      } catch (err) {
        console.log('Error completando períodos anteriores:', err.message);
      }
    }

    return Response.json({
      periodo: periodoNum,
      tipoCambio,
      esPrimerDia,
      ano,
      mes,
      tcBruto: tcData.bruto,
    });
  } catch (err) {
    console.error('Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
