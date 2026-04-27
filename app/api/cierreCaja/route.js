import supabase from '../../../lib/supabase-server.js';

export async function POST(request) {
  try {
    const data = await request.json();

    const { data: result, error } = await supabase
      .from('respuestas_cajeras')
      .insert([
        {
          cajera: data.cajera,
          caja: data.caja,
          fecha_hora: new Date(data.fecha || data.fechaCierre || new Date()).toISOString(),
          tc: data.tc || 475,
          c_20000: data.denom20k || data.cierre?.[20000] || 0,
          c_10000: data.denom10k || data.cierre?.[10000] || 0,
          c_5000: data.denom5k || data.cierre?.[5000] || 0,
          c_2000: data.denom2k || data.cierre?.[2000] || 0,
          c_1000: data.denom1k || data.cierre?.[1000] || 0,
          c_500: data.denom500 || data.cierre?.[500] || 0,
          c_100: data.denom100 || data.cierre?.[100] || 0,
          c_50: data.denom50 || data.cierre?.[50] || 0,
          c_25: data.denom25 || data.cierre?.[25] || 0,
          c_10: data.denom10 || data.cierre?.[10] || 0,
          c_5: data.denom5 || data.cierre?.[5] || 0,
          dolares_total: data.dolares || 0,
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

    return Response.json(
      { success: true, message: '✅ Cierre de caja guardado exitosamente', data: result },
      { status: 200 }
    );
  } catch (err) {
    console.error('Server error:', err);
    return Response.json({ success: false, message: `Error: ${err.message}` }, { status: 500 });
  }
}
