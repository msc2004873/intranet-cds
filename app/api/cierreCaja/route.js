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

    // Obtener fecha actual en Costa Rica para verificar si ya existe cierre
    const now = new Date();
    const crFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Costa_Rica',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const crDate = crFormatter.format(now);
    const [m, d, y] = crDate.split('/');
    const fechaHoy = `${y}-${m}-${d}`;

    // Verificar si ya existe un cierre para esta caja en este día (rango de 24h en CR)
    const inicioHoy = `${fechaHoy}T00:00:00Z`;
    const finHoy = `${fechaHoy}T23:59:59Z`;

    const { data: existingCierre } = await supabase
      .from('cierre_caja')
      .select('id')
      .eq('caja', data.caja)
      .gte('fecha_hora', inicioHoy)
      .lte('fecha_hora', finHoy)
      .limit(1);

    if (existingCierre && existingCierre.length > 0) {
      return Response.json(
        { error: `La ${data.caja} ya fue cerrada hoy. Solo se permite un cierre por día.` },
        { status: 400 }
      );
    }

    // Verificar si ya existe un cierre de Glory para hoy (solo si glory_json está poblado)
    if (data.gloryList && data.gloryList.length > 0) {
      const { data: existingGlory } = await supabase
        .from('cierre_caja')
        .select('id')
        .gte('fecha_hora', `${fechaHoy}T00:00:00Z`)
        .lte('fecha_hora', `${fechaHoy}T23:59:59Z`)
        .not('glory_json', 'is', null)
        .limit(1);

      if (existingGlory && existingGlory.length > 0) {
        return Response.json(
          { error: 'El cierre de Glory ya fue realizado hoy. Solo se permite un cierre por día.' },
          { status: 400 }
        );
      }
    }

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
    const crFormatter2 = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Costa_Rica',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const crDateTime = crFormatter2.format(now);
    const [crDateWithTime, crTime] = crDateTime.split(', ');
    const [m2, d2, y2] = crDateWithTime.split('/');
    const [h, min, s] = crTime.split(':');

    const tempDate = new Date(Date.UTC(parseInt(y2), parseInt(m2) - 1, parseInt(d2), parseInt(h), parseInt(min), parseInt(s)));
    const fechaHoraUTC = new Date(tempDate.getTime() + (6 * 60 * 60 * 1000)).toISOString();

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
