import supabase from '../../../lib/supabase-server.js';

export async function GET(request) {
  try {
    const logs = [];

    // 1. Movimientos registrados
    const { data: movimientos, error: err1 } = await supabase
      .from('movimientos')
      .select('id, tipo, monto, moneda, referencia, cajera, caja, created_at')
      .order('created_at', { ascending: false });

    if (movimientos && Array.isArray(movimientos)) {
      movimientos.forEach(m => {
        const dateObj = new Date(m.created_at);
        const formatter = new Intl.DateTimeFormat('es-CR', {
          timeZone: 'America/Costa_Rica',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        const formatted = formatter.format(dateObj);
        const [fecha, hora] = formatted.split(', ');
        logs.push({
          id: m.id,
          tipo: m.tipo,
          detalle: `₡${m.monto} ${m.moneda === 'dolares' ? 'USD' : 'CRC'} - Ref: ${m.referencia || 'N/A'}`,
          usuario: m.cajera || 'N/A',
          caja: m.caja || 'N/A',
          fecha: fecha.split('/').reverse().join('-'),
          hora,
          timestamp: dateObj.getTime(),
          data: m,
        });
      });
    }

    // 2. Cobros Glory
    const { data: cobros, error: err2 } = await supabase
      .from('cobros_glory')
      .select('id, monto, metodo_pago, cajera, caja, created_at')
      .order('created_at', { ascending: false });

    if (cobros && Array.isArray(cobros)) {
      cobros.forEach(c => {
        const dateObj = new Date(c.created_at);
        const formatter = new Intl.DateTimeFormat('es-CR', {
          timeZone: 'America/Costa_Rica',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        const formatted = formatter.format(dateObj);
        const [fecha, hora] = formatted.split(', ');
        logs.push({
          id: c.id,
          tipo: 'Cobro Glory',
          detalle: `${c.metodo_pago || 'N/A'} - ₡${c.monto}`,
          usuario: c.cajera || 'N/A',
          caja: c.caja || 'N/A',
          fecha: fecha.split('/').reverse().join('-'),
          hora,
          timestamp: dateObj.getTime(),
          data: c,
        });
      });
    }

    // 3. Cierres de Caja
    const { data: cierres, error: err3 } = await supabase
      .from('cierre_caja')
      .select('id, cajera, caja, fecha_hora')
      .order('fecha_hora', { ascending: false });

    if (cierres && Array.isArray(cierres)) {
      cierres.forEach(cierre => {
        const dateObj = new Date(cierre.fecha_hora);
        const formatter = new Intl.DateTimeFormat('es-CR', {
          timeZone: 'America/Costa_Rica',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        const formatted = formatter.format(dateObj);
        const [fecha, hora] = formatted.split(', ');
        logs.push({
          id: cierre.id,
          tipo: 'Cierre de Caja',
          detalle: 'Cierre completado',
          usuario: cierre.cajera || 'N/A',
          caja: cierre.caja || 'N/A',
          fecha: fecha.split('/').reverse().join('-'),
          hora,
          timestamp: dateObj.getTime(),
          data: cierre,
        });
      });
    }

    // 4. Conteos de Caja
    const { data: conteos, error: err4 } = await supabase
      .from('conteo_caja')
      .select('id, cajera, caja, fecha, hora, total_colones, dolares, c_20000, c_10000, c_5000, c_2000, c_1000, c_500, c_100, c_50, c_25, c_10, c_5')
      .order('created_at', { ascending: false });

    if (conteos && Array.isArray(conteos)) {
      conteos.forEach(conteo => {
        const fechaObj = conteo.hora ? new Date(conteo.hora) : new Date(`${conteo.fecha}T00:00:00`);
        const formatter = new Intl.DateTimeFormat('es-CR', {
          timeZone: 'America/Costa_Rica',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        const formatted = formatter.format(fechaObj);
        const [fecha, hora] = formatted.split(', ');
        logs.push({
          id: conteo.id,
          tipo: 'Conteo de Caja',
          detalle: `Total: ₡${conteo.total_colones || 0}`,
          usuario: conteo.cajera || 'N/A',
          caja: conteo.caja || 'N/A',
          fecha: fecha.split('/').reverse().join('-'),
          hora,
          timestamp: fechaObj.getTime(),
          data: conteo,
        });
      });
    }

    // Ordenar por timestamp descendente (más reciente primero)
    logs.sort((a, b) => b.timestamp - a.timestamp);

    return Response.json({ logs }, { status: 200 });
  } catch (err) {
    console.error('Error fetching logs:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
