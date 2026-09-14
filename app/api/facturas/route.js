import supabase from '../../../lib/supabase-server.js';

// Facturas de proveedor. Las mete el robot `cds-agentes/facturas.js` leyendo
// facturacion@corraldelsol.com; acá se consultan y se camina el ciclo.
// El ciclo tal como lo dictó Mario está en ~/projectsm1/corral-del-sol/FACTURAS.md §8.
//
// 🚨 EL `estado` NO LO ESCOGE NADIE. Lo calcula este archivo a partir de los checks:
//    Recepción marca → Administración marca QVet y marcado → cuando los dos están, pasa sola a
//    pagos. Una pantalla NUNCA manda un estado; manda una ACCIÓN y acá se decide.
//    (El PATCH viejo por `estado` sigue aceptándose por compatibilidad, ver más abajo.)

const ESTADOS = [
  'recibida', 'mercaderia_recibida', 'con_problema',
  'en_inventario', 'por_pagar', 'pagada', 'anulada',
];

// Los campos que la lista necesita. El `xml_crudo` (12 KB por factura) NO se manda al
// navegador: se queda en la base para reprocesar.
const CAMPOS = `id, clave, consecutivo, tipo_documento, proveedor_cedula, proveedor_nombre,
  receptor_cedula, receptor_nombre, es_de_corral_del_sol, fecha_emision,
  fecha_vencimiento, vencimiento_calculado, condicion_venta, condicion_venta_nombre,
  plazo_credito, moneda, tipo_cambio, total_comprobante, total_impuesto, estado,
  recibida_por, fecha_recepcion, problema_detalle,
  en_qvet_por, fecha_qvet, etiquetas_impresas, marcado_por, fecha_marcado,
  soltada_a_pago_por, fecha_soltada_a_pago,
  pagada_por, fecha_pago, referencia_pago,
  corrige_clave, corrige_razon, necesita_revision, motivo_revision, correo_asunto,
  categoria, es_mercaderia, categoria_mixta, clasificacion_manual,
  facturas_lineas(id, numero_linea, detalle, cantidad, unidad_medida,
                  precio_unitario, monto_total_linea, cantidad_recibida, tiene_error,
                  observacion, cabys, categoria),
  facturas_eventos(id, evento, quien, detalle, created_at)`;

// Las tres bandejas del ciclo + la de errores. Cada persona entra a la suya y no filtra nada.
const BANDEJAS = {
  // Recepción: mercadería que el robot bajó y que nadie ha contado todavía.
  recepcion: (q) => q.eq('estado', 'recibida').eq('es_mercaderia', true).eq('tipo_documento', 'factura'),
  // Administración: todo lo que espera una acción SUYA. Son dos cosas distintas y las dos
  // van acá a propósito:
  //   · mercadería que Recepción ya recibió → faltan sus dos checks;
  //   · gastos todavía sin aprobar (`recibida` + no es mercadería) → un gasto no pasa por
  //     Recepción, así que si no sale acá **no sale en ninguna bandeja**. Fue justo el hueco
  //     por el que la factura 9097 de Thinko pareció no existir (2026-09-13).
  administracion: (q) => q.or('estado.in.(mercaderia_recibida,en_inventario),and(estado.eq.recibida,es_mercaderia.eq.false)')
                          .eq('tipo_documento', 'factura'),
  // Lo que se atascó con un proveedor. Es trabajo de otra naturaleza: va aparte.
  errores:   (q) => q.eq('estado', 'con_problema'),
  // Administración: lo que ya está listo para pagarse.
  pagos:     (q) => q.eq('estado', 'por_pagar'),
  // 🚨 Las notas de crédito NO entran a ninguna bandeja del ciclo: no se reciben (no llega
  // mercadería) y no se pagan (es plata que el proveedor devuelve). Se emparejan solas con
  // la factura que corrigen y le restan. Pero una nota cuya factura NO está en la base no le
  // resta a nada y quedaba INVISIBLE — por eso existe esta bandeja.
  notas:     (q) => q.eq('tipo_documento', 'nota_credito'),
};

// GET — lista de facturas con sus líneas y su bitácora.
//   ?bandeja=recepcion|administracion|errores|pagos   la cola de cada persona
//   ?estado=por_pagar                            filtra por estado
//   ?vista=ajenas|mercaderia|gastos              a quién pertenece / qué tipo de gasto
//   ?id=123                                      una sola, con líneas y bitácora
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

    let query = supabase
      .from('facturas_proveedor')
      .select(CAMPOS)
      .order('fecha_emision', { ascending: false });

    const bandeja = searchParams.get('bandeja');
    if (bandeja && BANDEJAS[bandeja]) {
      query = BANDEJAS[bandeja](query).eq('es_de_corral_del_sol', true);
    } else {
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

    // Para cada NOTA de la lista: ¿la factura que dice corregir está en la base? Si no está,
    // esa nota no le está restando a nadie y hay que poder verlo.
    const clavesQueCorrigen = filas
      .filter(f => f.tipo_documento === 'nota_credito' && f.corrige_clave)
      .map(f => f.corrige_clave);
    if (clavesQueCorrigen.length) {
      const { data: existen } = await supabase
        .from('facturas_proveedor')
        .select('clave, estado, proveedor_nombre')
        .in('clave', clavesQueCorrigen);
      const mapa = new Map((existen || []).map(x => [x.clave, x]));
      for (const f of filas) {
        if (f.tipo_documento !== 'nota_credito') continue;
        const corregida = f.corrige_clave ? mapa.get(f.corrige_clave) : null;
        f.corrige_encontrada = !!corregida;
        f.corrige_estado = corregida?.estado || null;
      }
    }

    return Response.json(filas);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// 🚨 SUPABASE DEVUELVE 504 DE VEZ EN CUANDO. No es hipotético: pasó en la primera prueba del
// ciclo (y `caja.js` ya lo tenía documentado). Un recepcionista con el camión enfrente no
// puede quedarse trancado por eso, así que toda escritura se reintenta sola.
// Solo se reintenta lo que parece transitorio; un error de datos (constraint, columna) sale
// de una vez, porque reintentarlo daría el mismo error tres veces.
const TRANSITORIO = /timeout|gateway|fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|50[234]/i;

async function conReintento(hacer, intentos = 3) {
  let ultimo;
  for (let i = 0; i < intentos; i++) {
    const res = await hacer();
    if (!res?.error) return res;
    ultimo = res;
    if (!TRANSITORIO.test(String(res.error.message || ''))) return res;
    await new Promise(r => setTimeout(r, 400 * (i + 1)));
  }
  return ultimo;
}

// El estado sale de los checks, no al revés. Esta función es la única que lo decide.
// `con_problema` manda sobre todo: mientras un producto esté malo, la factura no avanza.
function estadoSegunChecks({ recibida, hayProblema, qvet, marcado }) {
  if (!recibida) return 'recibida';
  if (hayProblema) return 'con_problema';
  if (qvet && marcado) return 'por_pagar';
  if (qvet || marcado) return 'en_inventario';
  return 'mercaderia_recibida';
}

// Deja constancia en la bitácora. Es lo que después lee Administración antes de pagar.
async function anotar(factura_id, evento, quien, detalle) {
  await conReintento(() => supabase.from('facturas_eventos')
    .insert({ factura_id, evento, quien, detalle: detalle || null }));
}

// PATCH — caminar el ciclo. ?id=123
// body: { accion, quien, ... }   ·  acciones: recibir | qvet | marcado | resolver |
//                                              comentario | a_pago | pagar
export async function PATCH(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get('id'), 10);
    if (!Number.isInteger(id)) {
      return Response.json({ error: 'id inválido' }, { status: 400 });
    }

    const body = await req.json();
    const { accion, quien } = body;
    if (!quien) {
      return Response.json({ error: 'Falta quién hace el cambio' }, { status: 400 });
    }

    const { data: f, error: getErr } = await conReintento(() => supabase
      .from('facturas_proveedor')
      .select('*, facturas_lineas(id, cantidad, cantidad_recibida, tiene_error)')
      .eq('id', id)
      .maybeSingle());
    if (getErr) throw getErr;
    if (!f) return Response.json({ error: 'La factura no existe' }, { status: 404 });

    // ---- compatibilidad: el PATCH viejo mandaba `estado` directo ----
    // Se mantiene para no romper nada que todavía lo use, pero lo nuevo va por `accion`.
    if (!accion) return patchPorEstado(id, f, body);

    const ahora = new Date().toISOString();
    const cambios = { updated_at: ahora };
    let evento = accion;
    let detalle = body.comentario || body.detalle || null;

    // Estado de los checks tal como están AHORA. Cada acción mueve uno y se recalcula.
    const checks = {
      recibida: !!f.fecha_recepcion,
      hayProblema: f.estado === 'con_problema',
      qvet: !!f.fecha_qvet,
      marcado: !!f.etiquetas_impresas,
    };

    switch (accion) {
      // ---------------------------------------------------- RECEPCIÓN
      // Llega el camión. Marca producto por producto qué llegó y qué vino mal.
      case 'recibir': {
        if (['por_pagar', 'pagada', 'anulada'].includes(f.estado)) {
          return Response.json({ error: 'Esta factura ya pasó de recepción.' }, { status: 409 });
        }
        const lineas = Array.isArray(body.lineas) ? body.lineas : [];
        const porId = new Map((f.facturas_lineas || []).map(l => [l.id, l]));

        const malos = [];
        for (const l of lineas) {
          if (!Number.isInteger(l?.id) || !porId.has(l.id)) continue;
          const original = porId.get(l.id);
          const recibida = l.cantidad_recibida == null || l.cantidad_recibida === ''
            ? Number(original.cantidad)
            : Number(l.cantidad_recibida) || 0;
          const marcadoMal = !!l.tiene_error;
          const falta = recibida < Number(original.cantidad);

          const upd = await conReintento(() => supabase.from('facturas_lineas')
            .update({
              cantidad_recibida: recibida,
              tiene_error: marcadoMal || falta,
              observacion: l.observacion || null,
            })
            .eq('id', l.id).eq('factura_id', id));
          if (upd?.error) throw upd.error;

          if (marcadoMal || falta) malos.push({ falta, recibida, cantidad: Number(original.cantidad), nota: l.observacion });
        }

        checks.recibida = true;
        checks.hayProblema = malos.length > 0;
        cambios.recibida_por = quien;
        cambios.fecha_recepcion = ahora;
        // `problema_detalle` queda como el resumen de una línea; el detalle fino vive
        // producto por producto en `facturas_lineas`.
        cambios.problema_detalle = malos.length
          ? `${malos.length} producto${malos.length === 1 ? '' : 's'} con error`
          : null;
        evento = malos.length ? 'problema' : 'recibida';
        detalle = malos.length
          ? `Recibida con ${malos.length} producto${malos.length === 1 ? '' : 's'} con error`
          : 'Llegó completa y en buen estado';
        break;
      }

      // ---------------------------------------------------- GERENCIA · check QVet
      case 'qvet': {
        if (f.estado === 'con_problema') {
          return Response.json({ error: 'Esta factura tiene productos con error sin resolver.' }, { status: 409 });
        }
        if (!checks.recibida) {
          return Response.json({ error: 'Recepción todavía no ha recibido esta mercadería.' }, { status: 409 });
        }
        const valor = body.valor !== false;   // permite desmarcar si se equivocaron
        checks.qvet = valor;
        cambios.en_qvet_por = valor ? quien : null;
        cambios.fecha_qvet = valor ? ahora : null;
        evento = valor ? 'qvet' : 'qvet_deshecho';
        detalle = detalle || (valor ? 'Subida al inventario de QVet' : 'Se desmarcó QVet');
        break;
      }

      // ---------------------------------------------------- GERENCIA · check marcado
      case 'marcado': {
        if (f.estado === 'con_problema') {
          return Response.json({ error: 'Esta factura tiene productos con error sin resolver.' }, { status: 409 });
        }
        if (!checks.recibida) {
          return Response.json({ error: 'Recepción todavía no ha recibido esta mercadería.' }, { status: 409 });
        }
        const valor = body.valor !== false;
        checks.marcado = valor;
        cambios.etiquetas_impresas = valor;
        cambios.marcado_por = valor ? quien : null;
        cambios.fecha_marcado = valor ? ahora : null;
        evento = valor ? 'marcado' : 'marcado_deshecho';
        detalle = detalle || (valor ? 'Producto etiquetado y marcado' : 'Se desmarcó el marcado');
        break;
      }

      // ---------------------------------------------------- GERENCIA · cerrar un error
      // Se resolvió con el proveedor. Exige decir CÓMO se resolvió: eso es lo que después
      // lee Administración para saber por qué paga lo que paga.
      case 'resolver': {
        if (f.estado !== 'con_problema') {
          return Response.json({ error: 'Esta factura no está en la bandeja de errores.' }, { status: 409 });
        }
        if (!detalle) {
          return Response.json({ error: 'Escribí cómo se resolvió con el proveedor.' }, { status: 400 });
        }
        await supabase.from('facturas_lineas').update({ tiene_error: false }).eq('factura_id', id);
        checks.hayProblema = false;
        cambios.problema_detalle = null;
        evento = 'resuelto';
        break;
      }

      // ---------------------------------------------------- un comentario, sin mover nada
      case 'comentario': {
        if (!detalle) return Response.json({ error: 'El comentario está vacío.' }, { status: 400 });
        await anotar(id, 'comentario', quien, detalle);
        return Response.json({ ok: true });
      }

      // ---------------------------------------------------- corregir mercadería / gasto
      // El CABYS se equivoca con los códigos ambiguos (una placa de aluminio y un tornillo
      // comparten prefijo). Acá una persona lo corrige, y la decisión se guarda POR
      // PROVEEDOR para que las facturas que mande después entren ya bien.
      case 'clasificar': {
        const aMercaderia = body.es_mercaderia !== false;
        cambios.es_mercaderia = aMercaderia;
        cambios.clasificacion_manual = true;
        if (aMercaderia && f.categoria !== 'mercaderia') cambios.categoria = 'mercaderia';

        const { data: dCla, error: eCla } = await conReintento(() => supabase
          .from('facturas_proveedor').update(cambios).eq('id', id).select().single());
        if (eCla) throw eCla;

        // La memoria del robot: la próxima factura de este proveedor nace bien clasificada.
        await conReintento(() => supabase.from('proveedores_clasificacion').upsert({
          cedula: f.proveedor_cedula,
          proveedor_nombre: f.proveedor_nombre,
          es_mercaderia: aMercaderia,
          categoria: aMercaderia ? 'mercaderia' : (f.categoria || null),
          quien,
          nota: detalle || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'cedula' }));

        await anotar(id, 'clasificada', quien,
          `Marcada como ${aMercaderia ? 'mercadería' : 'gasto'} — se aplica a las próximas facturas de ${f.proveedor_nombre}`);
        return Response.json(dCla);
      }

      // ---------------------------------------------------- gasto directo a pagos
      // Un leasing o la gasolina no se reciben ni entran a QVet: solo se pagan.
      case 'a_pago': {
        if (f.es_mercaderia) {
          return Response.json({ error: 'Esto es mercadería: tiene que pasar por recepción.' }, { status: 409 });
        }
        cambios.estado = 'por_pagar';
        cambios.soltada_a_pago_por = quien;
        cambios.fecha_soltada_a_pago = ahora;
        const { data: dGasto, error: eGasto } = await conReintento(() => supabase
          .from('facturas_proveedor').update(cambios).eq('id', id).select().single());
        if (eGasto) throw eGasto;
        await anotar(id, 'a_pago', quien, detalle || 'Gasto aprobado para pago');
        return Response.json(dGasto);
      }

      // ---------------------------------------------------- ADMINISTRACIÓN · pagar
      case 'pagar': {
        if (f.estado === 'con_problema') {
          return Response.json({
            error: 'Esta factura tiene un problema sin resolver. No se puede pagar hasta que Administración lo cierre.',
          }, { status: 409 });
        }
        if (f.estado === 'pagada') {
          return Response.json({ error: 'Esta factura ya está pagada.' }, { status: 409 });
        }
        cambios.estado = 'pagada';
        cambios.pagada_por = quien;
        cambios.fecha_pago = body.fecha_pago || ahora.slice(0, 10);
        cambios.referencia_pago = body.referencia_pago || null;
        const { data: dPago, error: ePago } = await conReintento(() => supabase
          .from('facturas_proveedor').update(cambios).eq('id', id).select().single());
        if (ePago) throw ePago;
        await anotar(id, 'pagada', quien, body.referencia_pago ? `Pagada · ref. ${body.referencia_pago}` : 'Pagada');
        if (body.comentario) await anotar(id, 'comentario', quien, body.comentario);
        return Response.json(dPago);
      }

      default:
        return Response.json({ error: 'Acción desconocida: ' + accion }, { status: 400 });
    }

    cambios.estado = estadoSegunChecks(checks);
    // Cuando los dos checks de Administración quedan puestos, la factura pasa SOLA a pagos.
    // Nadie aprieta un botón de "pasar a pago": es justo el botón que se olvida.
    if (cambios.estado === 'por_pagar' && !f.fecha_soltada_a_pago) {
      cambios.soltada_a_pago_por = quien;
      cambios.fecha_soltada_a_pago = ahora;
    }

    const { data, error } = await conReintento(() => supabase
      .from('facturas_proveedor').update(cambios).eq('id', id).select().single());
    if (error) throw error;

    await anotar(id, evento, quien, detalle);
    // Un comentario escrito junto con la acción queda como comentario aparte, para que se
    // vea en el hilo y no solo pegado al evento.
    // ⚠️ Salvo cuando el comentario YA es el detalle del evento (pasa con `resolver`): ahí
    // duplicarlo pone el mismo texto dos veces seguidas en el historial. Se vio en la prueba.
    if (body.comentario && evento !== 'comentario' && body.comentario !== detalle) {
      await anotar(id, 'comentario', quien, body.comentario);
    }

    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST — PAGO COMBINADO. Mario (2026-09-13): *"al darle a un checkbox cambia la vara y se hace
// una suma/resta de todo lo que el proveedor tiene… se pueden seleccionar otras facturas para
// hacer un pago combinado"*. Es lo que ya hace el banco con «fact 8080 8081 nc330».
// body: { accion: 'pagar_combinado', quien, ids: [facturas], notas: [notas sueltas],
//         referencia_pago, fecha_pago, total_esperado }
//
// Reglas (se validan acá, no en la pantalla):
//   · un pago combinado es de UN solo proveedor y una sola moneda (una transferencia);
//   · ninguna factura con problema abierto, pagada o anulada;
//   · las notas que se mandan son las SUELTAS (su factura no está en la base): las que sí
//     calzan con una factura ya vienen restadas en su saldo y se marcan aplicadas solas;
//   · el total que calcula el servidor tiene que ser el mismo que vio la persona. Si alguien
//     movió algo en medio (llegó una nota nueva), se para en vez de pagar otro monto.
// Una nota de crédito usada queda en estado `pagada` = «aplicada»: su plata ya se descontó.
export async function POST(req) {
  try {
    const body = await req.json();
    const { accion, quien } = body;
    if (accion !== 'pagar_combinado') {
      return Response.json({ error: 'Acción desconocida: ' + accion }, { status: 400 });
    }
    if (!quien) return Response.json({ error: 'Falta quién hace el pago' }, { status: 400 });

    const ids = [...new Set((body.ids || []).map(Number))].filter(Number.isInteger);
    const idsNotas = [...new Set((body.notas || []).map(Number))].filter(Number.isInteger);
    if (!ids.length) return Response.json({ error: 'No hay facturas seleccionadas.' }, { status: 400 });

    const { data: docs, error: eDocs } = await conReintento(() => supabase
      .from('facturas_proveedor')
      .select('id, clave, consecutivo, tipo_documento, proveedor_cedula, proveedor_nombre, moneda, total_comprobante, estado, corrige_clave')
      .in('id', [...ids, ...idsNotas]));
    if (eDocs) throw eDocs;

    const facts = (docs || []).filter(d => ids.includes(d.id));
    const sueltas = (docs || []).filter(d => idsNotas.includes(d.id));
    if (facts.length !== ids.length || sueltas.length !== idsNotas.length) {
      return Response.json({ error: 'Alguna de las facturas ya no existe. Recargue la página.' }, { status: 409 });
    }
    const todos = [...facts, ...sueltas];
    if (facts.some(d => d.tipo_documento !== 'factura') || sueltas.some(d => d.tipo_documento !== 'nota_credito')) {
      return Response.json({ error: 'Se mezclaron facturas y notas de crédito.' }, { status: 400 });
    }
    if (new Set(todos.map(d => d.proveedor_cedula)).size > 1) {
      return Response.json({ error: 'Un pago combinado es de un solo proveedor.' }, { status: 400 });
    }
    if (new Set(todos.map(d => d.moneda)).size > 1) {
      return Response.json({ error: 'No se pueden mezclar colones y dólares en un mismo pago.' }, { status: 400 });
    }
    const trancada = todos.find(d => ['con_problema', 'pagada', 'anulada'].includes(d.estado));
    if (trancada) {
      const por = { con_problema: 'tiene un problema sin resolver', pagada: 'ya está pagada o aplicada', anulada: 'está anulada' };
      return Response.json({ error: `La ${trancada.tipo_documento === 'factura' ? 'factura' : 'nota'} ${String(trancada.consecutivo).slice(-5)} ${por[trancada.estado]}.` }, { status: 409 });
    }

    // Las notas que calzan con alguna de estas facturas (misma cuenta que hace el GET).
    const { data: calzan, error: eCal } = await conReintento(() => supabase
      .from('facturas_proveedor')
      .select('id, clave, corrige_clave, total_comprobante, estado')
      .eq('tipo_documento', 'nota_credito')
      .in('corrige_clave', facts.map(f => f.clave)));
    if (eCal) throw eCal;
    if ((calzan || []).some(n => idsNotas.includes(n.id))) {
      return Response.json({ error: 'Una de las notas ya le resta a una factura; no se puede restar dos veces.' }, { status: 400 });
    }
    // Y una nota «suelta» tiene que serlo de verdad: si su factura está en la base (aunque no
    // esté en este pago), ya le resta a esa y no se puede usar otra vez acá.
    const clavesSueltas = sueltas.map(n => n.corrige_clave).filter(Boolean);
    if (clavesSueltas.length) {
      const { data: yaCalzan, error: eYa } = await conReintento(() => supabase
        .from('facturas_proveedor').select('consecutivo')
        .eq('tipo_documento', 'factura').in('clave', clavesSueltas));
      if (eYa) throw eYa;
      if ((yaCalzan || []).length) {
        return Response.json({ error: `Esa nota ya le resta a la factura ${String(yaCalzan[0].consecutivo).slice(-5)}.` }, { status: 400 });
      }
    }

    const restaPorClave = {};
    for (const n of calzan || []) restaPorClave[n.corrige_clave] = (restaPorClave[n.corrige_clave] || 0) + Number(n.total_comprobante || 0);
    const sumaFacturas = facts.reduce((s, f) => s + Math.max(Number(f.total_comprobante || 0) - (restaPorClave[f.clave] || 0), 0), 0);
    const sumaSueltas = sueltas.reduce((s, n) => s + Number(n.total_comprobante || 0), 0);
    const total = sumaFacturas - sumaSueltas;
    if (total < 0) {
      return Response.json({ error: 'Las notas de crédito suman más que las facturas. Quite alguna nota.' }, { status: 400 });
    }
    if (body.total_esperado != null && Math.abs(Number(body.total_esperado) - total) > 0.5) {
      return Response.json({ error: 'El total cambió mientras se preparaba el pago. Recargue la página y revíselo.' }, { status: 409 });
    }

    const ahora = new Date().toISOString();
    const fecha_pago = body.fecha_pago || ahora.slice(0, 10);
    const referencia_pago = body.referencia_pago || null;
    const aplicar = [...(calzan || []).filter(n => n.estado !== 'pagada' && n.estado !== 'anulada').map(n => n.id), ...idsNotas];
    const pago = { estado: 'pagada', pagada_por: quien, fecha_pago, referencia_pago, updated_at: ahora };

    // Un solo UPDATE para todas las facturas: o se marcan todas o ninguna. El filtro de estado
    // repetido acá cierra la puerta a que otra persona la haya pagado un segundo antes.
    const { data: pagadas, error: ePag } = await conReintento(() => supabase
      .from('facturas_proveedor').update(pago)
      .in('id', ids).not('estado', 'in', '(con_problema,pagada,anulada)')
      .select('id'));
    if (ePag) throw ePag;
    if ((pagadas || []).length !== ids.length) {
      // Alguien pagó una en medio. Las notas NO se aplican: el total ya no es el que se vio.
      return Response.json({ error: `Solo se pudieron marcar ${(pagadas || []).length} de ${ids.length}: otra persona movió alguna en ese momento. Recargue y revise antes de seguir.` }, { status: 409 });
    }
    if (aplicar.length) {
      const { error: eApl } = await conReintento(() => supabase
        .from('facturas_proveedor').update(pago).in('id', aplicar).select('id'));
      if (eApl) throw eApl;
    }

    const nums = facts.map(f => String(f.consecutivo).slice(-5)).join(', ');
    const resumen = `Pago combinado de ${facts.length} factura${facts.length === 1 ? '' : 's'}`
      + (aplicar.length ? ` menos ${aplicar.length} nota${aplicar.length === 1 ? '' : 's'} de crédito` : '')
      + ` · total ${Math.round(total).toLocaleString('es-CR')}`
      + (referencia_pago ? ` · ref. ${referencia_pago}` : '');
    for (const f of facts) {
      await anotar(f.id, 'pagada', quien, facts.length > 1 || aplicar.length ? `${resumen} (facturas ${nums})` : (referencia_pago ? `Pagada · ref. ${referencia_pago}` : 'Pagada'));
    }
    for (const nid of aplicar) await anotar(nid, 'nota_aplicada', quien, `${resumen} (facturas ${nums})`);

    return Response.json({ ok: true, pagadas: (pagadas || []).length, notas_aplicadas: aplicar.length, total });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ---- compatibilidad con el PATCH viejo (mandaba `estado` a mano) ----
// No se usa desde las pantallas nuevas. Se conserva porque la pantalla de Administración vieja
// todavía puede estar abierta en el navegador de alguien cuando se despliegue.
async function patchPorEstado(id, actual, body) {
  const { estado, quien, detalle, lineas_recibidas, referencia_pago, fecha_pago } = body;
  if (!ESTADOS.includes(estado)) {
    return Response.json({ error: 'Estado inválido' }, { status: 400 });
  }
  if (actual.estado === 'con_problema' && ['por_pagar', 'pagada'].includes(estado)) {
    return Response.json({
      error: 'Esta factura tiene un problema sin resolver. No se puede pasar a pago hasta que Administración lo cierre.',
    }, { status: 409 });
  }

  const ahora = new Date().toISOString();
  const cambios = { estado, updated_at: ahora };

  if (estado === 'mercaderia_recibida' || estado === 'con_problema') {
    cambios.recibida_por = quien;
    cambios.fecha_recepcion = ahora;
    cambios.problema_detalle = estado === 'con_problema' ? (detalle || null) : null;
  }
  if (estado === 'en_inventario') { cambios.en_qvet_por = quien; cambios.fecha_qvet = ahora; }
  if (estado === 'por_pagar') { cambios.soltada_a_pago_por = quien; cambios.fecha_soltada_a_pago = ahora; }
  if (estado === 'pagada') {
    cambios.pagada_por = quien;
    cambios.fecha_pago = fecha_pago || ahora.slice(0, 10);
    cambios.referencia_pago = referencia_pago || null;
  }

  const { data, error } = await supabase
    .from('facturas_proveedor').update(cambios).eq('id', id).select().single();
  if (error) throw error;

  if (Array.isArray(lineas_recibidas)) {
    for (const l of lineas_recibidas) {
      if (!Number.isInteger(l?.id)) continue;
      await supabase.from('facturas_lineas')
        .update({ cantidad_recibida: Number(l.cantidad_recibida) || 0, observacion: l.observacion || null })
        .eq('id', l.id).eq('factura_id', id);
    }
  }

  await anotar(id, estado, quien, detalle);
  return Response.json(data);
}
