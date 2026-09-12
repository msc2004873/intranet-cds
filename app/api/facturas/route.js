import supabase from '../../../lib/supabase-server.js';

// Facturas de proveedor. Las mete el robot `cds-agentes/facturas.js` leyendo
// facturacion@corraldelsol.com; acá solo se consultan y se mueven de estado.
// El diseño completo está en ~/projectsm1/corral-del-sol/FACTURAS.md

const ESTADOS = [
  'recibida', 'mercaderia_recibida', 'con_problema',
  'en_inventario', 'por_pagar', 'pagada', 'anulada',
];

// GET — lista de facturas con sus líneas.
//   ?estado=por_pagar        filtra por estado
//   ?vista=ajenas            solo las que NO son de Corral del Sol
//   ?id=123                  una sola, con líneas y bitácora
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const { data, error } = await supabase
        .from('facturas_proveedor')
        .select('*, facturas_lineas(*), facturas_eventos(*)')
        .eq('id', parseInt(id, 10))
        .maybeSingle();
      if (error) throw error;
      return Response.json(data || null);
    }

    // El XML crudo NO se manda al navegador: son 12 KB por factura y nadie lo mira.
    // Se queda en la base para reprocesar. Las líneas sí, porque la pantalla las despliega.
    let query = supabase
      .from('facturas_proveedor')
      .select(`id, clave, consecutivo, tipo_documento, proveedor_cedula, proveedor_nombre,
               receptor_cedula, receptor_nombre, es_de_corral_del_sol, fecha_emision,
               fecha_vencimiento, vencimiento_calculado, condicion_venta, condicion_venta_nombre,
               plazo_credito, moneda, tipo_cambio, total_comprobante, total_impuesto, estado,
               recibida_por, fecha_recepcion, problema_detalle, pagada_por, fecha_pago,
               corrige_clave, corrige_razon, necesita_revision, motivo_revision, correo_asunto,
               categoria, es_mercaderia, categoria_mixta,
               facturas_lineas(id, numero_linea, detalle, cantidad, unidad_medida,
                               precio_unitario, monto_total_linea, cantidad_recibida,
                               cabys, categoria)`)
      .order('fecha_emision', { ascending: false });

    const estado = searchParams.get('estado');
    if (estado && ESTADOS.includes(estado)) query = query.eq('estado', estado);

    // "En trámite de pago" = todo lo que todavía se debe, sin importar en qué paso va.
    // Lo pidió Mario: quiere ver junto lo que falta por pagar, no paso por paso.
    if (searchParams.get('tramite') === '1') {
      query = query.in('estado', ['recibida', 'mercaderia_recibida', 'con_problema', 'en_inventario', 'por_pagar']);
    }

    // `vista` separa por a quién pertenece la factura y por si es mercadería o gasto.
    // Lo pidió Mario: la mercadería pasa por recibir producto; el gasto solo se paga.
    const vista = searchParams.get('vista');
    if (vista === 'ajenas') {
      query = query.eq('es_de_corral_del_sol', false);
    } else {
      query = query.eq('es_de_corral_del_sol', true);
      if (vista === 'mercaderia') query = query.eq('es_mercaderia', true);
      else if (vista === 'gastos') query = query.eq('es_mercaderia', false);
    }

    const { data, error } = await query;
    if (error) throw error;
    const filas = data || [];

    // 🚨 LAS NOTAS DE CRÉDITO RESTAN. Antes solo se guardaban y se mostraban, y el total
    // "por pagar" salía inflado. Una nota de crédito es plata que el proveedor devuelve o
    // descuenta: baja lo que se le debe por esa factura.
    // El XML de la nota trae `corrige_clave` = la clave de la factura que corrige, así que
    // se pueden emparejar solas, sin que nadie las ligue a mano.
    const { data: notas } = await supabase
      .from('facturas_proveedor')
      .select('corrige_clave, total_comprobante')
      .eq('tipo_documento', 'nota_credito')
      .not('corrige_clave', 'is', null);

    const restaPorClave = {};
    for (const n of notas || []) {
      if (!n.corrige_clave) continue;
      restaPorClave[n.corrige_clave] = (restaPorClave[n.corrige_clave] || 0) + Number(n.total_comprobante || 0);
    }

    for (const f of filas) {
      const resta = f.tipo_documento === 'factura' ? (restaPorClave[f.clave] || 0) : 0;
      f.nota_credito_aplicada = resta;
      // Lo que de verdad se debe. Nunca negativo: si la nota supera la factura, queda en 0.
      f.saldo = Math.max(Number(f.total_comprobante || 0) - resta, 0);
    }

    return Response.json(filas);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// PATCH — mover una factura de estado. ?id=123
// La regla del negocio va acá, no en la pantalla: una factura CON PROBLEMA no puede pasar
// a pago. Hoy eso depende de que Gerencia se acuerde; acá el servidor no lo permite.
export async function PATCH(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get('id'), 10);
    if (!Number.isInteger(id)) {
      return Response.json({ error: 'id inválido' }, { status: 400 });
    }

    const body = await req.json();
    const { estado, quien, detalle, lineas_recibidas, referencia_pago, fecha_pago } = body;

    if (!ESTADOS.includes(estado)) {
      return Response.json({ error: 'Estado inválido' }, { status: 400 });
    }
    if (!quien) {
      return Response.json({ error: 'Falta quién hace el cambio' }, { status: 400 });
    }

    const { data: actual, error: getErr } = await supabase
      .from('facturas_proveedor')
      .select('id, estado, es_de_corral_del_sol')
      .eq('id', id)
      .maybeSingle();
    if (getErr) throw getErr;
    if (!actual) return Response.json({ error: 'La factura no existe' }, { status: 404 });

    if (actual.estado === 'con_problema' && ['por_pagar', 'pagada'].includes(estado)) {
      return Response.json({
        error: 'Esta factura tiene un problema sin resolver. No se puede pasar a pago hasta que Gerencia lo cierre.',
      }, { status: 409 });
    }

    const ahora = new Date().toISOString();
    const cambios = { estado, updated_at: ahora };

    if (estado === 'mercaderia_recibida' || estado === 'con_problema') {
      cambios.recibida_por = quien;
      cambios.fecha_recepcion = ahora;
      if (estado === 'con_problema') cambios.problema_detalle = detalle || null;
      else cambios.problema_detalle = null;
    }
    if (estado === 'en_inventario') { cambios.en_qvet_por = quien; cambios.fecha_qvet = ahora; }
    if (estado === 'por_pagar') { cambios.soltada_a_pago_por = quien; cambios.fecha_soltada_a_pago = ahora; }
    if (estado === 'pagada') {
      cambios.pagada_por = quien;
      cambios.fecha_pago = fecha_pago || ahora.slice(0, 10);
      cambios.referencia_pago = referencia_pago || null;
    }

    const { data, error } = await supabase
      .from('facturas_proveedor')
      .update(cambios)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    // Lo que Recepción contó, producto por producto. La diferencia contra `cantidad` ES el faltante.
    if (Array.isArray(lineas_recibidas)) {
      for (const l of lineas_recibidas) {
        if (!Number.isInteger(l?.id)) continue;
        await supabase
          .from('facturas_lineas')
          .update({ cantidad_recibida: Number(l.cantidad_recibida) || 0, observacion: l.observacion || null })
          .eq('id', l.id)
          .eq('factura_id', id);
      }
    }

    await supabase.from('facturas_eventos').insert({
      factura_id: id, evento: estado, quien,
      detalle: detalle || null,
    });

    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
