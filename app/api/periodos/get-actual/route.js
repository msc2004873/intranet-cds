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

    let tipoCambio = 475;

    // Si es primer día, obtener de API y guardar
    if (esPrimerDia) {
      tipoCambio = await obtenerTipoCambioAPI();
      
      // Guardar en BD (si tabla existe)
      try {
        await supabase
          .from('periodo_tipos_cambio')
          .upsert({
            ano,
            mes,
            periodo_num: periodoNum,
            tipo_cambio: tipoCambio,
          }, { onConflict: 'ano,mes,periodo_num' });
      } catch (err) {
        console.log('Tabla TC no existe aún, usando valor en memoria');
      }
    } else {
      // Si no es primer día, obtener de BD
      try {
        const { data } = await supabase
          .from('periodo_tipos_cambio')
          .select('tipo_cambio')
          .eq('ano', ano)
          .eq('mes', mes)
          .eq('periodo_num', periodoNum)
          .single();

        if (data?.tipo_cambio) {
          tipoCambio = data.tipo_cambio;
        }
      } catch (err) {
        console.log('TC no encontrado en BD, usando default');
      }
    }

    return Response.json({
      periodo: periodoNum,
      tipoCambio,
      esPrimerDia,
      ano,
      mes,
    });
  } catch (err) {
    console.error('Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
