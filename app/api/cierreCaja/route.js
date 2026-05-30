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

    // Validaciones
    if (!data.cajera || data.cajera === '') throw new Error('Falta cajera');
    if (!data.caja || data.caja === '') throw new Error('Falta caja');

    const dolares = parseFloat(data.dolares) || 0;
    const tarjetaBac = parseFloat(data.tarjetaBac) || 0;
    const tarjetaBn = parseFloat(data.tarjetaBn) || 0;

    if (dolares < 0) throw new Error('dolares no puede ser negativo');
    if (tarjetaBac < 0) throw new Error('tarjeta BAC no puede ser negativa');
    if (tarjetaBn < 0) throw new Error('tarjeta BN no puede ser negativa');

    // Validar denominaciones
    const denoms = [
      'denom20000', 'denom10000', 'denom5000', 'denom2000', 'denom1000',
      'denom500', 'denom100', 'denom50', 'denom25', 'denom10', 'denom5'
    ];
    for (const d of denoms) {
      const val = parseInt(data[d]) || 0;
      if (val < 0) throw new Error(`Denominación ${d} no puede ser negativa`);
    }

    // Obtener fecha_hora actual en Costa Rica
    const now = new Date();
    const crFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Costa_Rica',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = crFormatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    const hour = parts.find(p => p.type === 'hour')?.value;
    const minute = parts.find(p => p.type === 'minute')?.value;
    const second = parts.find(p => p.type === 'second')?.value;
    const crDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
    const fechaHoraUTC = new Date(crDate.getTime() + (6 * 60 * 60 * 1000)).toISOString();

    const insertData = {
      cajera: data.cajera,
      caja: data.caja,
      fecha_hora: fechaHoraUTC,
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
