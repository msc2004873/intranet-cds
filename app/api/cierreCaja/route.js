import supabase from '../../../lib/supabase-server.js';

// Rango UTC que corresponde a un día calendario de Costa Rica (UTC-6):
// el día DD en CR va de DD 06:00 UTC a DD+1 05:59:59 UTC.
function rangoDiaCR(fecha) {
  const [y, m, d] = fecha.split('-').map(n => parseInt(n));
  const inicio = Date.UTC(y, m - 1, d, 6, 0, 0);
  return {
    inicio: new Date(inicio).toISOString(),
    fin: new Date(inicio + (24 * 60 * 60 * 1000) - 1000).toISOString()
  };
}

// Fecha de hoy en Costa Rica (el server de Vercel corre en UTC, no se puede
// confiar en su hora local).
function fechaHoyCR(now) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Costa_Rica',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
  const [m, d, y] = partes.split('/');
  return `${y}-${m}-${d}`;
}

// Instante actual convertido a UTC desde la hora de pared de Costa Rica.
function ahoraCRenUTC(now) {
  const crDateTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Costa_Rica',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(now);
  const [fechaParte, horaParte] = crDateTime.split(', ');
  const [m, d, y] = fechaParte.split('/');
  const [h, min, s] = horaParte.split(':');
  // hour12:false puede devolver "24" a la medianoche; Date.UTC lo normaliza.
  const wall = Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(h), parseInt(min), parseInt(s));
  return new Date(wall + (6 * 60 * 60 * 1000)).toISOString();
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const fecha = searchParams.get('fecha');
    const hasta = searchParams.get('hasta');
    const caja = searchParams.get('caja');

    // Consulta por id: la usa el formulario de cierre para verificar contra la
    // base que la fila realmente quedó guardada antes de decir "guardado".
    if (id) {
      const { data, error } = await supabase
        .from('cierre_caja')
        .select('*')
        .eq('id', id)
        .limit(1);

      if (error) throw error;
      return Response.json(data || []);
    }

    if (!fecha) {
      return Response.json(
        { error: 'Parámetro fecha es requerido' },
        { status: 400 }
      );
    }

    const { inicio: crDayStart } = rangoDiaCR(fecha);
    const { fin: crDayEnd } = rangoDiaCR(hasta || fecha);

    let query = supabase
      .from('cierre_caja')
      .select('*')
      .gte('fecha_hora', crDayStart)
      .lte('fecha_hora', crDayEnd);

    if (caja) {
      query = query.eq('caja', caja);
    }

    const { data, error } = await query.order('fecha_hora', { ascending: true });

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

    // --- Validaciones (400: culpa del request, no del server) ---
    if (!data.cajera || data.cajera === '') {
      return Response.json({ error: 'Falta cajera' }, { status: 400 });
    }
    if (!data.caja || data.caja === '') {
      return Response.json({ error: 'Falta caja' }, { status: 400 });
    }

    const dolares = parseFloat(data.dolares) || 0;
    const tarjetaBac = parseFloat(data.tarjetaBac) || 0;
    const tarjetaBn = parseFloat(data.tarjetaBn) || 0;

    if (dolares < 0) return Response.json({ error: 'dolares no puede ser negativo' }, { status: 400 });
    if (tarjetaBac < 0) return Response.json({ error: 'tarjeta BAC no puede ser negativa' }, { status: 400 });
    if (tarjetaBn < 0) return Response.json({ error: 'tarjeta BN no puede ser negativa' }, { status: 400 });

    const DENOMS = [20000, 10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5];
    for (const d of DENOMS) {
      if ((parseInt(data[`denom${d}`]) || 0) < 0) {
        return Response.json({ error: `Denominación ${d} no puede ser negativa` }, { status: 400 });
      }
    }

    const now = new Date();
    const fechaHoy = fechaHoyCR(now);
    const { inicio: crDayStart, fin: crDayEnd } = rangoDiaCR(fechaHoy);

    // --- Un solo cierre por caja por día ---
    const { data: existingCierre, error: existingError } = await supabase
      .from('cierre_caja')
      .select('id, cajera, caja, fecha_hora, tc, dolares_total, tarjeta_bac, tarjeta_bn')
      .eq('caja', data.caja)
      .gte('fecha_hora', crDayStart)
      .lte('fecha_hora', crDayEnd)
      .limit(1);

    if (existingError) {
      console.error('Error verificando cierre existente:', existingError);
    }

    if (existingCierre && existingCierre.length > 0) {
      // 409 con la fila que ya está guardada: así, si el navegador reintenta
      // porque se le cayó la respuesta, puede distinguir "ya quedó guardado"
      // de "no se guardó".
      return Response.json(
        {
          error: `La ${data.caja} ya fue cerrada hoy. Solo se permite un cierre por día.`,
          code: 'CIERRE_DUPLICADO',
          cierre: existingCierre[0]
        },
        { status: 409 }
      );
    }

    // --- Un solo cierre de Glory por día ---
    if (data.gloryList && data.gloryList.length > 0) {
      const { data: existingGlory } = await supabase
        .from('cierre_caja')
        .select('id, cajera, caja, fecha_hora')
        .gte('fecha_hora', crDayStart)
        .lte('fecha_hora', crDayEnd)
        .not('glory_json', 'is', null)
        .limit(1);

      if (existingGlory && existingGlory.length > 0) {
        return Response.json(
          {
            error: 'El cierre de Glory ya fue realizado hoy. Solo se permite un cierre por día.',
            code: 'GLORY_DUPLICADO',
            cierre: existingGlory[0]
          },
          { status: 409 }
        );
      }
    }

    const fechaHoraUTC = ahoraCRenUTC(now);

    // denominaciones_sobre = lo que se va al sobre = contado - lo que queda en caja
    const denominacionesSobre = {};
    DENOMS.forEach(d => {
      const conteo = parseInt(data[`denom${d}`]) || 0;
      const queda = parseInt(data[`sobre${d}`]) || 0;
      denominacionesSobre[d.toString()] = conteo - queda;
    });

    const insertData = {
      cajera: data.cajera,
      caja: data.caja,
      fecha_hora: fechaHoraUTC,
      tc: parseFloat(data.tc) || 475,
      dolares_total: dolares,
      tarjeta_bac: tarjetaBac,
      tarjeta_bn: tarjetaBn,
      denominaciones_sobre: denominacionesSobre,
      sinpe_json: data.sinpeList || null,
      depositos_json: data.depositoList || null,
      salidas_json: data.salidaList || null,
      glory_json: data.gloryList || null,
      observaciones: data.comentarios || null
    };

    const { data: result, error: cierreError } = await supabase
      .from('cierre_caja')
      .insert([insertData])
      .select();

    if (cierreError) {
      console.error('Error insertando cierre:', cierreError);
      return Response.json(
        { error: `No se pudo guardar el cierre: ${cierreError.message}` },
        { status: 500 }
      );
    }

    // Sin fila de vuelta no hay nada que confirmar: es un fallo, no un éxito.
    if (!result || !result[0] || !result[0].id) {
      console.error('El insert de cierre_caja no devolvió fila:', result);
      return Response.json(
        { error: 'La base no confirmó el cierre. Volvé a intentarlo.' },
        { status: 500 }
      );
    }

    const cierre = result[0];

    // Conteo de denominaciones (tabla conteo_caja)
    const conteoData = {
      cajera: data.cajera,
      caja: data.caja,
      fecha: fechaHoraUTC.split('T')[0],
      hora: fechaHoraUTC,
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
      dolares: dolares,
      total_colones: 0 // el conteo real lo escribe /api/conteo
    };

    const { error: conteoError } = await supabase
      .from('conteo_caja')
      .insert([conteoData]);

    if (conteoError) {
      // El cierre ya quedó guardado: no se pierde, pero hay que avisar en vez
      // de tragarse el error en silencio.
      console.error('Error insertando conteo del cierre:', conteoError);
    }

    console.log(`Cierre guardado: id=${cierre.id} caja=${cierre.caja} fecha_hora=${cierre.fecha_hora}`);

    return Response.json(
      {
        ok: true,
        cierre,
        conteo_guardado: !conteoError,
        warning: conteoError
          ? 'El cierre quedó guardado, pero no se pudo registrar el conteo de denominaciones. Avisale a administración.'
          : null
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error en POST cierre de caja:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
