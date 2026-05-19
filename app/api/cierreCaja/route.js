import supabase from '../../../lib/supabase-server.js';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const fecha = searchParams.get('fecha');
    const hasta = searchParams.get('hasta');
    const caja = searchParams.get('caja');

    if (!fecha) {
      return Response.json(
        { error: 'Parámetro fecha es requerido' },
        { status: 400 }
      );
    }

    const fechaInicio = `${fecha}T00:00:00`;
    const fechaFin = hasta ? `${hasta}T23:59:59` : `${fecha}T23:59:59`;

    let query = supabase
      .from('cierre_caja')
      .select('*')
      .gte('fecha_hora', fechaInicio)
      .lte('fecha_hora', fechaFin);

    if (caja) {
      query = query.eq('caja', caja);
    }

    const { data, error } = await query.order('fecha_hora', { ascending: false });

    if (error) throw error;

    return Response.json(data || []);
  } catch (err) {
    console.error('Error obteniendo cierres:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();

    if (!data.cajera || !data.caja) {
      return Response.json(
        { error: 'Faltan campos obligatorios: cajera y caja' },
        { status: 400 }
      );
    }

    const insertData = {
      cajera: data.cajera,
      caja: data.caja,
      fecha_hora: new Date().toISOString(),
      tc: parseFloat(data.tc) || 475,
      dolares_total: parseFloat(data.dolares) || 0,
      tarjeta_bac: parseFloat(data.tarjetaBac) || 0,
      tarjeta_bn: parseFloat(data.tarjetaBn) || 0,
      c_20000: parseInt(data.denom20000) || 0,
      c_10000: parseInt(data.denom10000) || 0,
      c_5000: parseInt(data.denom5000) || 0,
      c_2000: parseInt(data.denom2000) || 0,
      c_1000: parseInt(data.denom1000) || 0,
      c_500: parseInt(data.denom500) || 0,
      c_100: parseInt(data.denom100) || 0,
      c_50: parseInt(data.denom50) || 0,
      c_25: parseInt(data.denom25) || 0,
      c_10: parseInt(data.denom10) || 0,
      c_5: parseInt(data.denom5) || 0,
      sinpe_json: data.sinpeList || null,
      depositos_json: data.depositoList || null,
      salidas_json: data.salidaList || null,
      glory_json: data.gloryList || null
    };

    const { data: result, error } = await supabase
      .from('cierre_caja')
      .insert([insertData])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return Response.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return Response.json(result[0], { status: 201 });
  } catch (err) {
    console.error('Server error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
