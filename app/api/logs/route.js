import supabase from '../../../lib/supabase-server.js';

export async function GET(request) {
  try {
    const logs = [];

    // 1. Movimientos registrados
    const { data: movimientos } = await supabase
      .from('movimientos')
      .select('id, tipo, monto, moneda, referencia, cajera, caja, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (movimientos) {
      movimientos.forEach(m => {
        logs.push({
          id: m.id,
          tipo: 'Registrar Movimiento',
          detalle: `${m.tipo} - ₡${m.monto}`,
          usuario: m.cajera,
          caja: m.caja,
          fecha: new Date(m.created_at).toISOString().split('T')[0],
          hora: new Date(m.created_at).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }),
          timestamp: new Date(m.created_at).getTime(),
          data: m,
        });
      });
    }

    // 2. Cobros Glory
    const { data: cobros } = await supabase
      .from('cobros_glory')
      .select('id, monto, metodo_pago, cajera, caja, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (cobros) {
      cobros.forEach(c => {
        logs.push({
          id: c.id,
          tipo: 'Cobro Glory',
          detalle: `${c.metodo_pago || 'N/A'} - ₡${c.monto}`,
          usuario: c.cajera,
          caja: c.caja,
          fecha: new Date(c.created_at).toISOString().split('T')[0],
          hora: new Date(c.created_at).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }),
          timestamp: new Date(c.created_at).getTime(),
          data: c,
        });
      });
    }

    // 3. Cierres de Caja
    const { data: cierres } = await supabase
      .from('cierre_caja')
      .select('id, cajera, caja, fecha_hora')
      .order('fecha_hora', { ascending: false })
      .limit(50);

    if (cierres) {
      cierres.forEach(cierre => {
        const fechaObj = new Date(cierre.fecha_hora);
        logs.push({
          id: cierre.id,
          tipo: 'Cierre de Caja',
          detalle: 'Cierre completado',
          usuario: cierre.cajera,
          caja: cierre.caja,
          fecha: fechaObj.toISOString().split('T')[0],
          hora: fechaObj.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }),
          timestamp: fechaObj.getTime(),
          data: cierre,
        });
      });
    }

    // 4. Conteos de Caja
    const { data: conteos } = await supabase
      .from('conteo_caja')
      .select('id, cajera, caja, fecha, hora, total_colones')
      .order('created_at', { ascending: false })
      .limit(50);

    if (conteos) {
      conteos.forEach(conteo => {
        const fechaObj = new Date(`${conteo.fecha}T${conteo.hora || '00:00:00'}`);
        logs.push({
          id: conteo.id,
          tipo: 'Conteo de Caja',
          detalle: `Total: ₡${conteo.total_colones || 0}`,
          usuario: conteo.cajera,
          caja: conteo.caja,
          fecha: conteo.fecha,
          hora: new Date(conteo.hora).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }),
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
