import supabase from '../../../lib/supabase-server.js';

// Ingresos del mes agrupados en los 6 períodos de 5 días, tomados del LISTADO DE QVET.
//
// Antes se calculaban desde cierre_caja (denominaciones + tarjetas + sinpe + dólares).
// Eso daba números malos cada vez que un cierre se guardaba incompleto: tarjetas en
// cero, dólares sin declarar, o el cierre que no se guardó del todo. QVet es la fuente
// contable real, así que ahora se lee de ahí.
//
// Ingreso = efectivo + tarjeta + sinpe + transferencia.
//   - `salidas` NO se resta (es ingreso bruto, igual que antes).
//   - `otro` NO se suma. Se verificó contra los cierres: el 24/08 en Caja 1 el total de
//     QVet sin `otro` da ₡1 012 418.5 y el cierre da ₡1 012 418 — calzan. Con `otro`
//     se dispara ₡209 331 de más. Sea lo que sea, no es plata que pase por la caja.
//     Igual se devuelve en el desglose por si hay que revisarlo.
//
// El período sin Excel subido devuelve total: null (no 0), para que la pantalla muestre
// "pendiente" en vez de dar a entender que ese período no facturó nada.

function periodoDeDia(dia) {
  if (dia <= 5) return 1;
  if (dia <= 10) return 2;
  if (dia <= 15) return 3;
  if (dia <= 20) return 4;
  if (dia <= 25) return 5;
  return 6;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const ano = parseInt(searchParams.get('ano'));
    const mes = parseInt(searchParams.get('mes'));

    if (!ano || !mes || mes < 1 || mes > 12) {
      return Response.json({ error: 'Parámetros ano y mes son requeridos' }, { status: 400 });
    }

    // qvet_data se guarda repetido en cada revisión del período (el array completo del
    // Excel). Se traen todas y se deduplica por caja+fecha más abajo.
    const { data, error } = await supabase
      .from('revision_caja')
      .select('id, qvet_data')
      .not('qvet_data', 'is', null)
      .order('id', { ascending: true });

    if (error) throw error;

    // Las fechas de QVet ya vienen como fecha CR 'YYYY-MM-DD', sin hora: no hay que
    // convertir nada de UTC.
    const prefijoMes = `${ano}-${String(mes).padStart(2, '0')}`;

    // Deduplicar por caja+fecha. Si el Excel se volvió a subir, la revisión con id más
    // alto es la más reciente y pisa a la anterior (por eso el order de arriba).
    const porCajaFecha = new Map();
    for (const fila of data || []) {
      const filas = typeof fila.qvet_data === 'string'
        ? JSON.parse(fila.qvet_data || '[]')
        : (fila.qvet_data || []);
      if (!Array.isArray(filas)) continue;

      for (const q of filas) {
        if (!q?.fecha || !String(q.fecha).startsWith(prefijoMes)) continue;
        porCajaFecha.set(`${q.caja}|${q.fecha}`, q);
      }
    }

    const ultimoDia = new Date(ano, mes, 0).getDate();
    const periodos = [1, 2, 3, 4, 5, 6].map((p) => {
      const dIni = (p - 1) * 5 + 1;
      const dFin = p === 6 ? ultimoDia : p * 5;
      return {
        periodo_num: p,
        dia_inicio: dIni,
        dia_fin: dFin,
        total: null,        // null = sin Excel de QVet subido
        cierres: 0,         // cantidad de caja-día que trae el Excel de ese período
        tiene_qvet: false,
        desglose: { efectivo: 0, tarjeta: 0, sinpe: 0, transferencia: 0, otro: 0, salidas: 0 },
      };
    });

    for (const q of porCajaFecha.values()) {
      const dia = parseInt(String(q.fecha).slice(8, 10));
      if (!dia) continue;

      const bucket = periodos[periodoDeDia(dia) - 1];
      const efectivo = parseFloat(q.efectivo) || 0;
      const tarjeta = parseFloat(q.tarjeta) || 0;
      const sinpe = parseFloat(q.sinpe) || 0;
      const transferencia = parseFloat(q.transferencia) || 0;

      bucket.tiene_qvet = true;
      bucket.total = (bucket.total || 0) + efectivo + tarjeta + sinpe + transferencia;
      bucket.cierres += 1;
      bucket.desglose.efectivo += efectivo;
      bucket.desglose.tarjeta += tarjeta;
      bucket.desglose.sinpe += sinpe;
      bucket.desglose.transferencia += transferencia;
      bucket.desglose.otro += parseFloat(q.otro) || 0;
      bucket.desglose.salidas += parseFloat(q.salidas) || 0;
    }

    const conDatos = periodos.filter((p) => p.tiene_qvet);
    const totalMes = conDatos.reduce((s, p) => s + p.total, 0);

    return Response.json({
      ano,
      mes,
      totalMes,
      periodos,
      periodos_con_qvet: conDatos.length,
      fuente: 'qvet',
    });
  } catch (err) {
    console.error('Error en ingresos-periodo:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
