import supabase from '../../../lib/supabase-server.js';

export async function POST(request) {
  try {
    const data = await request.json();

    const c20k = data.denom20k || data.cierre?.[20000] || 0;
    const c10k = data.denom10k || data.cierre?.[10000] || 0;
    const c5k = data.denom5k || data.cierre?.[5000] || 0;
    const c2k = data.denom2k || data.cierre?.[2000] || 0;
    const c1k = data.denom1k || data.cierre?.[1000] || 0;
    const c500 = data.denom500 || data.cierre?.[500] || 0;
    const c100 = data.denom100 || data.cierre?.[100] || 0;
    const c50 = data.denom50 || data.cierre?.[50] || 0;
    const c25 = data.denom25 || data.cierre?.[25] || 0;
    const c10 = data.denom10 || data.cierre?.[10] || 0;
    const c5 = data.denom5 || data.cierre?.[5] || 0;
    const dolares = data.dolares || 0;

    // Calcular total en colones
    const totalColones = (c20k * 20000) + (c10k * 10000) + (c5k * 5000) + (c2k * 2000) +
                         (c1k * 1000) + (c500 * 500) + (c100 * 100) + (c50 * 50) +
                         (c25 * 25) + (c10 * 10) + (c5 * 5);

    // 1. Guardar en cierre_caja (cierre completo)
    const { data: result, error } = await supabase
      .from('cierre_caja')
      .insert([
        {
          cajera: data.cajera,
          caja: data.caja,
          fecha_hora: new Date(data.fecha || data.fechaCierre || new Date()).toISOString(),
          tc: data.tc || 475,
          c_20000: c20k,
          c_10000: c10k,
          c_5000: c5k,
          c_2000: c2k,
          c_1000: c1k,
          c_500: c500,
          c_100: c100,
          c_50: c50,
          c_25: c25,
          c_10: c10,
          c_5: c5,
          dolares_total: dolares,
          tarjeta_bac: data.tarjetaBac || 0,
          tarjeta_bn: data.tarjetaBn || 0,
          sinpe_json: null,
          depositos_json: null,
          salidas_json: null,
          glory_json: null,
          qvet_pdf_url: null,
          fotos_sinpe_urls: null,
        },
      ])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return Response.json({ success: false, message: `Error: ${error.message}` }, { status: 400 });
    }

    // 2. Guardar snapshot en conteo_caja (conteo rápido)
    const fecha = new Date(data.fecha || data.fechaCierre || new Date());
    const { error: conteoError } = await supabase
      .from('conteo_caja')
      .insert([
        {
          cajera: data.cajera,
          caja: data.caja,
          fecha: fecha.toISOString().split('T')[0],
          hora: fecha.toISOString(),
          c_20000: c20k,
          c_10000: c10k,
          c_5000: c5k,
          c_2000: c2k,
          c_1000: c1k,
          c_500: c500,
          c_100: c100,
          c_50: c50,
          c_25: c25,
          c_10: c10,
          c_5: c5,
          dolares: dolares,
          total_colones: totalColones,
        },
      ]);

    if (conteoError) {
      console.error('Error guardando conteo_caja:', conteoError);
      // No retornar error aquí - el cierre ya se guardó
    }

    return Response.json(
      { success: true, message: '✅ Cierre de caja guardado exitosamente', data: result },
      { status: 200 }
    );
  } catch (err) {
    console.error('Server error:', err);
    return Response.json({ success: false, message: `Error: ${err.message}` }, { status: 500 });
  }
}
