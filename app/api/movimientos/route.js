import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Inicio del día CR en UTC (DD 06:00Z). Respaldo cuando una caja no tiene cierre anterior.
function inicioDiaCR(fecha) {
  const [y, m, d] = fecha.split('-').map(n => parseInt(n));
  return new Date(Date.UTC(y, m - 1, d, 6, 0, 0)).toISOString();
}

function fechaCR(instante) {
  const [m, d, y] = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(instante)).split('/');
  return `${y}-${m}-${d}`;
}

// Último cierre de la caja antes de `antesDe` (o el último de todos si no se da).
async function cierreAnterior(caja, antesDe) {
  let q = supabase.from('cierre_caja').select('id, fecha_hora').eq('caja', caja);
  if (antesDe) q = q.lt('fecha_hora', antesDe);
  const { data, error } = await q.order('fecha_hora', { ascending: false }).limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get('tipo');
    const fecha = searchParams.get('fecha');
    const caja = searchParams.get('caja');
    const pendientes = searchParams.get('pendientes');
    const cierreId = searchParams.get('cierre_id');

    let query = supabase.from('movimientos').select('*');

    if (tipo) {
      query = query.eq('tipo', tipo);
    }

    // Un movimiento pertenece al PRIMER cierre de su caja hecho después de
    // registrarlo. Si la cajera registra un SINPE cuando ya cerró, va al cierre
    // siguiente (no se pierde ni se cuenta dos veces). created_at no tiene zona
    // pero es UTC; fecha_hora sí la trae: se comparan como ISO en UTC.
    if (cierreId) {
      // Revisión de un cierre: lo registrado entre el cierre anterior de esa caja y este.
      const { data: cierres, error: errCierre } = await supabase
        .from('cierre_caja').select('id, caja, fecha_hora').eq('id', cierreId).limit(1);
      if (errCierre) throw errCierre;
      const cierre = cierres?.[0];
      if (!cierre) return Response.json({ error: 'Cierre no encontrado' }, { status: 404 });
      const anterior = await cierreAnterior(cierre.caja, cierre.fecha_hora);
      const desde = anterior
        ? new Date(anterior.fecha_hora).toISOString()
        : inicioDiaCR(fechaCR(cierre.fecha_hora));
      query = query
        .eq('caja', cierre.caja)
        .gt('created_at', desde)
        .lte('created_at', new Date(cierre.fecha_hora).toISOString());
    } else if (pendientes && caja) {
      // Formulario de cierre: todo lo de esta caja registrado después de su último cierre.
      const anterior = await cierreAnterior(caja);
      const desde = anterior
        ? new Date(anterior.fecha_hora).toISOString()
        : inicioDiaCR(fecha || fechaCR(Date.now()));
      query = query.gt('created_at', desde);
    } else if (fecha) {
      // Convertir fecha CR (UTC-6) a rango UTC para buscar en created_at
      // Ej: 2026-05-29 en CR = 2026-05-29T06:00:00Z a 2026-05-30T06:00:00Z en UTC
      const fechaObj = new Date(`${fecha}T00:00:00`);
      const fechaInicio = new Date(fechaObj.getTime() + 6 * 60 * 60 * 1000).toISOString();
      const fechaFin = new Date(fechaObj.getTime() + 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', fechaInicio).lt('created_at', fechaFin);
    }

    if (caja) {
      query = query.eq('caja', caja);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return Response.json(data || []);
  } catch (err) {
    console.error('Error movimientos:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();

    const tipo = formData.get('tipo');
    const monto = formData.get('monto');
    const moneda = formData.get('moneda') || 'colones';
    const referencia = formData.get('referencia');
    const cajera = formData.get('cajera');
    const caja = formData.get('caja');
    const archivo = formData.get('archivo');

    // Validaciones
    if (!tipo || tipo === '') throw new Error('Falta tipo');
    if (!cajera || cajera === '') throw new Error('Falta cajera');
    if (!caja || caja === '') throw new Error('Falta caja');
    if (!moneda || !['colones', 'usd'].includes(moneda)) throw new Error('Moneda inválida (debe ser colones o usd)');

    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum < 0) throw new Error('Monto debe ser número positivo');

    let archivoUrl = null;

    // Guardar archivo si existe
    if (archivo) {
      try {
        const buffer = await archivo.arrayBuffer();
        const sanitizedCaja = caja.replace(/[^a-zA-Z0-9-]/g, '_').toLowerCase();
        const fileName = `${tipo.toLowerCase()}_${Date.now()}_${archivo.name}`;
        const filePath = `${sanitizedCaja}/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('movimientos')
          .upload(filePath, buffer, {
            contentType: archivo.type,
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw uploadError;
        }

        const { data: urlData } = supabase.storage
          .from('movimientos')
          .getPublicUrl(filePath);

        archivoUrl = urlData?.publicUrl || null;
        console.log('Archivo guardado:', { filePath, archivoUrl });
      } catch (err) {
        console.error('Error guardando archivo:', err.message);
      }
    }

    const { data, error } = await supabase
      .from('movimientos')
      .insert([
        {
          tipo,
          monto: parseFloat(monto),
          moneda,
          referencia: referencia || null,
          cajera,
          caja,
          archivo_url: archivoUrl
        }
      ])
      .select();

    if (error) throw error;

    return Response.json(data[0], { status: 201 });
  } catch (err) {
    console.error('Error guardando movimiento:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
