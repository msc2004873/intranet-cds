'use client';

// Facturas de proveedor — Corral del Sol.
// Las mete solas el robot `cds-agentes/facturas.js` leyendo facturacion@corraldelsol.com.
//
// 🎨 DISEÑO: Mario lo pidió compacto (2026-09-12): *"está muy chunky… más bien que sea una
// sola línea, máximo 2, al inicio la condición, fecha, proveedor y monto; al estriparla se
// ven más datos"*. **Respetar ese orden y no volver a inflar la fila.** Todo lo demás
// (productos, quién recibió, clave, botones) vive adentro del desplegable.
//
// Diseño y decisiones: ~/projectsm1/corral-del-sol/FACTURAS.md

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import { Check, Hilo, CajaTexto } from '../../components/FacturasCiclo';

// Regla 2 del CLAUDE.md: colones con espacio y redondeados; dólares con coma y 2 decimales.
const fmt = (n, moneda = 'CRC') => moneda === 'USD'
  ? 'US$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : '₡' + Math.round(Number(n) || 0).toLocaleString('es-CR');

// Corta: 11/9/26 en vez de 11/9/2026. En una fila de una línea, cada carácter cuenta.
const fechaCorta = (s) => s
  ? new Date(s).toLocaleDateString('es-CR', { timeZone: 'America/Costa_Rica', day: 'numeric', month: 'numeric', year: '2-digit' })
  : '—';
const fechaLarga = (s) => s ? new Date(s).toLocaleDateString('es-CR', { timeZone: 'America/Costa_Rica' }) : '—';

const hoyCR = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

function diasPara(vence) {
  if (!vence) return null;
  const [a, m, d] = vence.split('-').map(Number);
  const [ha, hm, hd] = hoyCR().split('-').map(Number);
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(ha, hm - 1, hd)) / 86400000);
}

// La condición va de primero, como pidió Mario. Etiqueta corta para que quepa en la línea.
//
// 🎨 LOS CUATRO COLORES ESTÁN ESCOGIDOS, NO INVENTADOS. Mario los pidió "definidísimos,
// para 0 confusión". Los tonos son #2a78d6 · #B5651D · #5B35B5 · #52514e, y pasan el
// validador de la guía de dataviz **comparando TODOS los pares** (no solo los vecinos):
// peor par ΔE 10,8 con daltonismo deutan y 16,3 en visión normal.
// El texto va en un tono un poco más oscuro sobre su pastilla clara, y cada uno se leyó
// contra su propio fondo: 5,2 · 5,9 · 6,7 · 6,7 (el mínimo es 4,5).
//
// 🚨 LO QUE NO SE DEBE HACER: verde para contado. Verde y ámbar juntos dan ΔE 4,8 con
// daltonismo protan — **contado y crédito, que son justo los dos que más se comparan, se
// vuelven el mismo color** para quien no distingue rojo-verde. Por eso contado es AZUL.
// Si alguien "mejora" esto poniendo verde, rompe justo lo que Mario pidió.
const CONDICION = {
  '01': { corta: 'CONTADO', color: '#1f63ad', fondo: '#E4EFFB' },
  '02': { corta: 'CRÉDITO', color: '#8a4d12', fondo: '#FBF0E4' },
};
const NOTA_CREDITO = { corta: 'NOTA DE CRÉDITO', color: '#5B35B5', fondo: '#EDE9F6' };
const OTRA_CONDICION = { corta: 'OTRO', color: '#52514e', fondo: '#EEECE8' };

// 🚨 BUG QUE ESTO ARREGLA: antes la nota de crédito pintaba la pastilla con el color de SU
// condición de venta, así que la misma nota salía a veces azul y a veces ámbar. Una nota de
// crédito es una cosa aparte: **siempre morada**, sin importar qué diga su condición.
const condicionDe = (f) => f.tipo_documento === 'nota_credito'
  ? NOTA_CREDITO
  : (CONDICION[f.condicion_venta] || OTRA_CONDICION);

const ESTADOS = {
  // `mostrar: false` = no se pinta en la fila. `recibida` es el estado de nacimiento:
  // ponerle "Recién llegada" a todo era ruido. Mario: "no me cuadra nada ese badge".
  recibida:            { nom: '',                    color: '#2a78a5', mostrar: false },
  mercaderia_recibida: { nom: 'Mercadería recibida', color: '#8B6914', mostrar: true },
  con_problema:        { nom: 'Con problema',        color: '#C0392B', mostrar: true },
  en_inventario:       { nom: 'En QVet',             color: '#5B35B5', mostrar: true },
  por_pagar:           { nom: 'Por pagar',           color: '#B5651D', mostrar: true },
  pagada:              { nom: 'Pagada',              color: '#1a7a4a', mostrar: true },
  anulada:             { nom: 'Anulada',             color: '#6B6560', mostrar: true },
};

// Nombres en cristiano para las categorías que salen del código CABYS de Hacienda.
const CATEGORIAS = {
  mercaderia: 'Mercadería',
  combustible: 'Combustible',
  insumos_operacion: 'Insumos de operación',
  mantenimiento: 'Mantenimiento',
  alimentacion: 'Comida del personal',
  transporte: 'Transporte y encomiendas',
  servicios_publicos: 'Luz, teléfono e internet',
  financiero: 'Leasing y banco',
  servicios_profesionales: 'Servicios profesionales',
  capacitacion: 'Capacitación',
  sin_clasificar: 'Sin clasificar',
};

// 🚨 SEIS PESTAÑAS, NI UNA MÁS — Mario (2026-09-12): *"son demasiados filtros… necesito nada
// más gráfico de gastos, de otra persona, por revisar, facturas con errores, centro de pagos
// y pagadas"*. Se fueron «Todas», «Mercadería», «Gastos y servicios» y «En trámite de pago»
// (el buscador ya busca en todas). Las notas de crédito son un SUB-filtro de Centro de pagos.
// Y pagar se hace ACÁ: la página aparte `/admin/facturas/pagos` se borró (*"lo quiero todo en
// el mismo lugar"*). 🚫 No volver a agregar pestañas; lo nuevo va adentro de una de estas.
//
// «Por revisar» = lo que Recepción ya recibió y espera los dos checks de Administración.
// «Facturas con errores» = lo que se atascó con un proveedor (hay que llamarlo).
// «Centro de pagos» = todo lo que se debe, lo que vence primero arriba.
const FILTROS = [
  { id: 'administracion', etiqueta: '📥 Por revisar' },
  { id: 'errores',    etiqueta: '🔴 Facturas con errores' },
  { id: 'pagos',      etiqueta: '💸 Centro de pagos' },
  { id: 'pagada',     etiqueta: 'Pagadas' },
  { id: 'grafico',    etiqueta: 'Gráfico de gastos' },
  { id: 'ajenas',     etiqueta: 'De otra persona' },
];

// Arranca en la bandeja de Administración: es el trabajo que le toca a quien entra acá.
const FILTRO_INICIAL = 'administracion';

// Vence en 5 días o menos → sube arriba del todo. Lo pidió Mario.
const DIAS_URGENTE = 5;

const card = { background: '#FFFFFF', border: '1.5px solid #E2DDD4', borderRadius: '14px' };

// Sin tildes ni mayúsculas: buscar "nutricion" tiene que encontrar "Nutrición".
const normal = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export default function FacturasPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState('');
  const [usuario, setUsuario] = useState('');
  const [facturas, setFacturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState(FILTRO_INICIAL);
  // 🚨 EL BUSCADOR BUSCA EN TODAS LAS FACTURAS, no dentro del filtro activo.
  // Nace de un susto real (2026-09-13): Mario buscó la 9097 de Thinko, no la vio en la
  // bandeja que tenía abierta y creyó que el sistema la había perdido. Estaba guardada.
  // Un buscador que solo mira la pestaña abierta miente por omisión.
  const [busca, setBusca] = useState('');
  const [abierta, setAbierta] = useState(null);
  // Sub-filtro de Centro de pagos: las facturas que se deben, o las notas de crédito.
  const [sub, setSub] = useState('facturas');
  const [pagando, setPagando] = useState(null);   // id de la que se está pagando
  const [refPago, setRefPago] = useState('');
  const [fechaPago, setFechaPago] = useState(hoyCR());
  const [error, setError] = useState('');
  const [sinTabla, setSinTabla] = useState(false);
  // 🚨 El resumen de arriba se calcula SIEMPRE sobre todo lo pendiente, no sobre la lista
  // filtrada. Antes salía en 0 y Mario lo cachó: contaba solo `estado = por_pagar`, y
  // ninguna factura llega a ese estado hasta que alguien la mueve a mano por el ciclo.
  // Lo que se debe es TODO lo que no está pagado ni anulado, vaya en el paso que vaya.
  const [resumen, setResumen] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) { router.push('/login'); return; }
    const user = JSON.parse(userData);
    setUserRole(user.rol || '');
    setUsuario(user.nombre || user.iniciales || 'sin nombre');
    if (user.rol !== 'admin') router.push('/');
  }, [router]);

  useEffect(() => { if (userRole === 'admin') cargar(); }, [userRole, filtro, sub, busca]);
  useEffect(() => { if (userRole === 'admin') cargarResumen(); }, [userRole]);

  async function cargarResumen() {
    try {
      const res = await fetch('/api/facturas?tramite=1&vista=todas');
      const data = await res.json();
      if (data.error || !Array.isArray(data)) return;
      const facts = data.filter(f => f.tipo_documento === 'factura' && Number(f.saldo ?? f.total_comprobante ?? 0) > 0);
      const crc = f => f.moneda === 'CRC';
      const saldo = f => Number(f.saldo ?? f.total_comprobante ?? 0);
      const urgentes = facts.filter(f => { const d = diasPara(f.fecha_vencimiento); return d !== null && d <= 7; });
      setResumen({
        cuenta: facts.length,
        monto: facts.filter(crc).reduce((s, f) => s + saldo(f), 0),
        urgentes: urgentes.length,
        montoUrgentes: urgentes.filter(crc).reduce((s, f) => s + saldo(f), 0),
        vencidas: facts.filter(f => { const d = diasPara(f.fecha_vencimiento); return d !== null && d < 0; }).length,
        problemas: facts.filter(f => f.estado === 'con_problema').length,
      });
    } catch { /* el resumen es de adorno: si falla, la lista igual sirve */ }
  }

  async function cargar() {
    try {
      setCargando(true); setError(''); setSinTabla(false);
      const q = filtro === 'administracion' || filtro === 'errores' ? `bandeja=${filtro}`
        // Centro de pagos = TODO lo que se debe, vaya en el paso que vaya (antes «En trámite»).
        : filtro === 'pagos' ? (sub === 'notas' ? 'bandeja=notas' : 'tramite=1&vista=todas')
        : filtro === 'pagada' ? 'estado=pagada'
        : filtro === 'grafico' ? 'vista=todas'
        : 'vista=ajenas';
      // Con el buscador escrito se ignora el filtro y se traen TODAS.
      const res = await fetch(`/api/facturas?${busca.trim() ? 'vista=todas' : q}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFacturas(Array.isArray(data) ? data : []);
    } catch (e) {
      const m = String(e.message || '');
      if (/facturas_proveedor|does not exist|schema cache|relation/i.test(m)) setSinTabla(true);
      else setError(m);
      setFacturas([]);
    } finally { setCargando(false); }
  }

  async function mover(id, estado, extra = {}) {
    try {
      const res = await fetch(`/api/facturas?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, quien: usuario, ...extra }),
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      await cargar();
      await cargarResumen();
    } catch (e) { alert('No se pudo: ' + e.message); }
  }

  // El ciclo nuevo: acá NO se manda un estado. Se manda la acción (marcar QVet, marcar
  // producto, resolver, comentar) y el servidor decide en qué paso queda la factura.
  // Cuando los dos checks de Administración están puestos, la factura pasa SOLA a pagos.
  async function accionar(id, accion, extra = {}) {
    try {
      const res = await fetch(`/api/facturas?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, quien: usuario, ...extra }),
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return false; }
      await cargar();
      await cargarResumen();
      return true;
    } catch (e) { alert('No se pudo: ' + e.message); return false; }
  }

  if (!userRole) return <div style={{ padding: 40, textAlign: 'center' }}>Cargando...</div>;
  if (userRole !== 'admin') return null;




  // ---- orden: lo que vence primero va primero (lo pidió Mario) ----
  // Sin vencimiento (contado) va al final: no hay nada que vigilar ahí.
  const porVencimiento = (a, b) => {
    if (!a.fecha_vencimiento && !b.fecha_vencimiento) return String(b.fecha_emision).localeCompare(String(a.fecha_emision));
    if (!a.fecha_vencimiento) return 1;
    if (!b.fecha_vencimiento) return -1;
    return a.fecha_vencimiento.localeCompare(b.fecha_vencimiento);
  };
  // 🚨 Una NOTA DE CRÉDITO no se paga: resta de lo que se debe. Meterla en "urgentes" con
  // un "venció hace 25 días" es mentira y hace correr a alguien por nada.
  const pendiente = f => f.estado !== 'pagada' && f.estado !== 'anulada' && f.tipo_documento === 'factura';
  // El buscador mira proveedor, número de factura y nombre de producto.
  const q = normal(busca.trim());
  // En Centro de pagos → Facturas, las notas no van: no se pagan, restan (tienen su sub-filtro).
  const base = !q && filtro === 'pagos' && sub === 'facturas'
    ? facturas.filter(f => f.tipo_documento === 'factura')
    : facturas;
  const visibles = !q ? base : facturas.filter(f =>
    normal(f.proveedor_nombre).includes(q) ||
    String(f.consecutivo || '').includes(busca.trim()) ||
    (f.facturas_lineas || []).some(l => normal(l.detalle).includes(q)));
  const ordenadas = visibles.slice().sort(porVencimiento);
  const urgentes = ordenadas.filter(f => {
    const d = diasPara(f.fecha_vencimiento);
    return pendiente(f) && d !== null && d <= DIAS_URGENTE;
  });
  const resto = ordenadas.filter(f => !urgentes.includes(f));
  const sumaUrgentes = urgentes.filter(f => f.moneda === 'CRC').reduce((s, f) => s + Number(f.saldo ?? f.total_comprobante ?? 0), 0);

  const fila = (f) => {

            const cond = condicionDe(f);
            const est = ESTADOS[f.estado] || ESTADOS.recibida;
            const dias = diasPara(f.fecha_vencimiento);
            const vencida = dias !== null && dias < 0 && f.estado !== 'pagada';
            const pronto = dias !== null && dias >= 0 && dias <= 7 && f.estado !== 'pagada';
            const lineas = (f.facturas_lineas || []).slice().sort((a, b) => (a.numero_linea || 0) - (b.numero_linea || 0));
            const abierto = abierta === f.id;

            return (
              <div key={f.id} style={{ ...card, borderColor: vencida ? '#E8B4AE' : '#E2DDD4', overflow: 'hidden' }}>

                {/* ---------- UNA SOLA LÍNEA ----------
                    🚨 Mario lo pidió DOS VECES (12/9 y 13/9): *"siguen siendo muy chunky"*.
                    Van solo: condición · fecha · proveedor · ··últimos 5 de la factura ·
                    estado (si dice algo) · vencimiento · monto.
                    Lo que se quitó de acá y vive en el desplegable: la categoría, el conteo
                    de productos y la nota de crédito. **No devolverlos a la fila.** */}
                <div onClick={() => setAbierta(abierto ? null : f.id)}
                  style={{ padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9 }}>

                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.4px', padding: '2px 6px',
                    borderRadius: 4, background: cond.fondo, color: cond.color, whiteSpace: 'nowrap', flexShrink: 0,
                  }}>{cond.corta}</span>

                  <span style={{ fontSize: 12, color: '#8A837C', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {fechaCorta(f.fecha_emision)}
                  </span>

                  <span style={{
                    flex: 1, fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
                  }} title={f.proveedor_nombre}>{f.proveedor_nombre}</span>

                  {/* Los últimos 5 dígitos: es el número que la gente canta al buscar una factura. */}
                  <span style={{
                    fontSize: 11.5, color: '#B5AFA8', fontFamily: "'DM Mono', monospace",
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }} title={`Factura ${f.consecutivo}`}>··{String(f.consecutivo || '').slice(-5)}</span>

                  {est.mostrar && (
                    <span style={{ fontSize: 11, color: est.color, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {est.nom}
                    </span>
                  )}

                  {f.fecha_vencimiento && f.tipo_documento === 'factura' && (
                    <span style={{
                      fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0,
                      color: vencida ? '#C0392B' : (pronto ? '#B5651D' : '#B5AFA8'),
                      fontWeight: vencida || pronto ? 700 : 400,
                    }}>
                      {vencida ? `−${Math.abs(dias)}d` : dias === 0 ? 'hoy' : `${dias}d`}
                    </span>
                  )}

                  <span style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {/* Si una nota de crédito le rebajó, manda el SALDO. El original tachado
                        se fue al desplegable: en una línea sola no cabe y es el dato menos urgente. */}
                    {fmt(f.nota_credito_aplicada > 0 ? f.saldo : f.total_comprobante, f.moneda)}
                  </span>
                </div>

                {/* ---------- DESPLEGABLE: todo lo demás ---------- */}
                {abierto && (
                  <div style={{ borderTop: '1px solid #EFEBE4', background: '#FCFBF9', padding: '11px 14px' }}>

                    {/* El contexto que antes iba en una segunda línea de la fila. Acá adentro
                        no estorba y la fila queda de una sola línea, como pidió Mario. */}
                    <div style={{ fontSize: 11.5, color: '#8A837C', marginBottom: 9 }}>
                      {CATEGORIAS[f.categoria] || 'Sin clasificar'}
                      {f.categoria_mixta && <span style={{ color: '#B5651D' }}> (mixta)</span>}
                      {' · '}{lineas.length} producto{lineas.length === 1 ? '' : 's'}
                      {f.nota_credito_aplicada > 0 && (
                        <span style={{ color: '#5B35B5' }}>
                          {' · '}nota de crédito −{fmt(f.nota_credito_aplicada, f.moneda)} sobre {fmt(f.total_comprobante, f.moneda)}
                        </span>
                      )}
                    </div>

                    {(f.problema_detalle || f.corrige_razon || !f.es_de_corral_del_sol) && (
                      <div style={{ fontSize: 12.5, marginBottom: 10, lineHeight: 1.6 }}>
                        {!f.es_de_corral_del_sol && (
                          <div style={{ color: '#B5651D' }}>Facturada a <strong>{f.receptor_nombre}</strong> — cédula {f.receptor_cedula}</div>
                        )}
                        {f.corrige_razon && <div style={{ color: '#5B35B5' }}>Corrige: «{f.corrige_razon}»</div>}
                        {/* Una nota cuya factura no está en la base no le resta a nadie:
                            hay que poder verlo, si no se pierde plata en silencio. */}
                        {f.tipo_documento === 'nota_credito' && f.corrige_encontrada === false && (
                          <div style={{ color: '#C0392B' }}>
                            ⚠ La factura que corrige no está en el sistema — esta nota no le está restando a nada.
                          </div>
                        )}
                        {f.problema_detalle && <div style={{ color: '#C0392B' }}>Problema: {f.problema_detalle}</div>}
                      </div>
                    )}

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 480 }}>
                        <thead>
                          <tr style={{ textAlign: 'left', color: '#8A837C', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            <th style={{ padding: '4px 8px 8px 0' }}>Producto</th>
                            <th style={{ padding: '4px 8px 8px', textAlign: 'right' }}>Cant.</th>
                            <th style={{ padding: '4px 8px 8px', textAlign: 'right' }}>Precio</th>
                            <th style={{ padding: '4px 0 8px 8px', textAlign: 'right' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineas.map(l => {
                            const falta = l.cantidad_recibida != null && Number(l.cantidad_recibida) < Number(l.cantidad);
                            return (
                              <tr key={l.id} style={{ borderTop: '1px solid #EFEBE4', background: l.tiene_error ? '#FDF4F3' : undefined }}>
                                <td style={{ padding: '6px 8px 6px 0' }}>
                                  {l.tiene_error && <span style={{ marginRight: 5 }}>⚠</span>}
                                  {l.detalle}
                                  {falta && <span style={{ color: '#C0392B', fontWeight: 600, marginLeft: 6 }}>llegaron {Number(l.cantidad_recibida)}</span>}
                                  {/* Lo que Recepción escribió de ESTE producto. Es lo que se le reclama al proveedor. */}
                                  {l.tiene_error && l.observacion && (
                                    <div style={{ color: '#C0392B', fontSize: 11.5, marginTop: 2 }}>«{l.observacion}»</div>
                                  )}
                                </td>
                                <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                  {Number(l.cantidad).toLocaleString('es-CR')} {l.unidad_medida || ''}
                                </td>
                                <td style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(l.precio_unitario, f.moneda)}</td>
                                <td style={{ padding: '6px 0 6px 8px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>{fmt(l.monto_total_linea, f.moneda)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ fontSize: 11, color: '#9A948E', marginTop: 10, lineHeight: 1.6 }}>
                      Emitida el {fechaLarga(f.fecha_emision)} · {f.condicion_venta_nombre}
                      {f.plazo_credito ? ` a ${f.plazo_credito} días` : ''}
                      {f.fecha_vencimiento && ` · vence ${f.fecha_vencimiento}`}
                      {f.vencimiento_calculado && f.fecha_vencimiento && (
                        <span title="La factura no trae fecha de vencimiento: se calcula sumándole el plazo a la fecha de emisión."> (calculada)</span>
                      )}
                      <br />
                      Factura {f.consecutivo} · clave {f.clave}
                      {f.recibida_por && <><br />Recibida por {f.recibida_por} el {fechaLarga(f.fecha_recepcion)}</>}
                      {f.pagada_por && <><br />Pagada por {f.pagada_por} el {fechaLarga(f.fecha_pago)}</>}
                    </div>

                    {/* ---------- LOS CHECKS DEL CICLO ---------- */}
                    {/* Administración no "mueve estados": marca sus dos checks. Cuando los dos están,
                        la factura pasa sola a pagos. Ese es el botón que antes se olvidaba. */}
                    {f.es_mercaderia ? (
                      // Lado a lado, no uno encima de otro: lo pidió Mario el 2026-09-13
                      // (*"prefiero lado a lado, pueden tomar menos espacio"*). Con `wrap`
                      // se apilan solos en un teléfono, que es donde sí hace falta.
                      <div style={{ marginTop: 12, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                        <Check
                          hecho={!!f.fecha_recepcion}
                          titulo="Recibida por Recepción"
                          pie={f.fecha_recepcion ? `${f.recibida_por} · ${fechaCorta(f.fecha_recepcion)}` : 'sin recibir'}
                          bloqueado
                        />
                        <Check
                          hecho={!!f.fecha_qvet}
                          titulo="Subida en QVet"
                          pie={f.fecha_qvet ? `${f.en_qvet_por} · ${fechaCorta(f.fecha_qvet)}` : 'marcar al subirla'}
                          bloqueado={!f.fecha_recepcion || f.estado === 'con_problema'}
                          onToggle={() => accionar(f.id, 'qvet', { valor: !f.fecha_qvet })}
                        />
                        <Check
                          hecho={!!f.etiquetas_impresas}
                          titulo="Marcado"
                          pie={f.fecha_marcado ? `${f.marcado_por} · ${fechaCorta(f.fecha_marcado)}` : 'marcar al etiquetar'}
                          bloqueado={!f.fecha_recepcion || f.estado === 'con_problema'}
                          onToggle={() => accionar(f.id, 'marcado', { valor: !f.etiquetas_impresas })}
                        />
                        {f.estado === 'por_pagar' && (
                          <div style={{ fontSize: 12, color: '#B5651D', fontWeight: 600, paddingLeft: 2 }}>
                            ✔ Los tres checks están puestos — la factura ya está en Centro de pagos.
                          </div>
                        )}
                      </div>
                    ) : (
                      // Un gasto (luz, leasing, gasolina) no se recibe ni entra a QVet: solo se paga.
                      f.estado !== 'pagada' && f.estado !== 'por_pagar' && (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ fontSize: 12, color: '#8A837C', marginBottom: 7 }}>
                            Esto es un gasto, no mercadería: no pasa por recepción ni por QVet.
                          </div>
                          <Boton onClick={() => accionar(f.id, 'a_pago')} color="#B5651D">Aprobar para pago</Boton>
                        </div>
                      )
                    )}

                    {/* ---------- resolver un error con el proveedor ---------- */}
                    {f.estado === 'con_problema' && (
                      <div style={{ marginTop: 14, padding: '12px 14px', background: '#FDF4F3', border: '1.5px solid #E8B4AE', borderRadius: 10 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#C0392B' }}>Cerrar el problema con el proveedor</div>
                        <div style={{ fontSize: 11.5, color: '#8A837C', marginTop: 2, marginBottom: 8 }}>
                          Escribí cómo se resolvió. Administración lo va a leer antes de pagar.
                        </div>
                        <CajaTexto
                          placeholder="Mandaron el producto que faltaba el 15/9…"
                          boton="Se resolvió"
                          color="#1a7a4a"
                          onEnviar={(txt) => accionar(f.id, 'resolver', { comentario: txt })}
                        />
                      </div>
                    )}

                    {/* ---------- corregir mercadería / gasto ----------
                        El CABYS se equivoca con los códigos ambiguos (una placa de aluminio
                        para mascota y un tornillo comparten prefijo). Acá se corrige, y la
                        decisión queda guardada POR PROVEEDOR para las próximas facturas. */}
                    {f.tipo_documento === 'factura' && (
                      <div style={{ marginTop: 12, fontSize: 11.5, color: '#8A837C', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span>
                          Está clasificada como <strong style={{ color: f.es_mercaderia ? '#2a78a5' : '#B5651D' }}>
                            {f.es_mercaderia ? 'mercadería' : 'gasto'}</strong>
                          {f.clasificacion_manual && ' (corregida a mano)'}
                        </span>
                        <button
                          onClick={() => {
                            const aMerc = !f.es_mercaderia;
                            if (!confirm(`¿Marcar esta factura como ${aMerc ? 'MERCADERÍA' : 'GASTO'}?\n\nTambién se va a aplicar a las próximas facturas de ${f.proveedor_nombre}.`)) return;
                            accionar(f.id, 'clasificar', { es_mercaderia: aMerc });
                          }}
                          style={{
                            padding: '4px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
                            border: '1.5px solid #E2DDD4', background: '#FFFFFF', color: '#6B6560',
                          }}>
                          No — es {f.es_mercaderia ? 'un gasto' : 'mercadería'}
                        </button>
                      </div>
                    )}

                    {/* ---------- el hilo: quién dijo qué, en orden ---------- */}
                    <Hilo eventos={f.facturas_eventos} />
                    <CajaTexto
                      placeholder="Escribir un comentario…"
                      boton="Comentar"
                      color="#2a78a5"
                      onEnviar={(txt) => accionar(f.id, 'comentario', { comentario: txt })}
                    />

                    {/* ---------- pagar ----------
                        Vivía en /admin/facturas/pagos; Mario lo quiso en el mismo lugar. Solo sale
                        cuando la factura ya pasó todos sus checks (estado por_pagar). */}
                    {f.estado === 'por_pagar' && (pagando === f.id ? (
                      <div style={{ marginTop: 14, padding: '12px 14px', background: '#F2F9F5', border: '1.5px solid #BFE0CD', borderRadius: 10 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>
                          Pagar {fmt(f.saldo ?? f.total_comprobante, f.moneda)} a {f.proveedor_nombre}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            value={refPago}
                            onChange={(e) => setRefPago(e.target.value)}
                            placeholder="Referencia o comprobante (opcional)"
                            style={{ flex: 1, minWidth: 190, padding: '7px 10px', border: '1.5px solid #E2DDD4', borderRadius: 9, fontSize: 12.5 }} />
                          <input
                            type="date"
                            value={fechaPago}
                            onChange={(e) => setFechaPago(e.target.value)}
                            style={{ padding: '7px 10px', border: '1.5px solid #E2DDD4', borderRadius: 9, fontSize: 12.5 }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          <Boton color="#1a7a4a" onClick={async () => {
                            const ok = await accionar(f.id, 'pagar', { referencia_pago: refPago.trim() || null, fecha_pago: fechaPago });
                            if (ok) { setPagando(null); setRefPago(''); }
                          }}>Confirmar pago</Boton>
                          <button onClick={() => { setPagando(null); setRefPago(''); }}
                            style={{ background: '#FFFFFF', color: '#6B6560', border: '1.5px solid #E2DDD4', borderRadius: 9, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: 12 }}>
                        <Boton onClick={() => { setPagando(f.id); setFechaPago(hoyCR()); }} color="#1a7a4a">Marcar como pagada</Boton>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
            };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F7F5F0' }}>
      <Header title="Facturas" subtitle="Facturas de proveedores" showLogout={true} showModuleSelector={true} />

      <div style={{ flex: 1, padding: '22px 16px', maxWidth: '1080px', width: '100%', margin: '0 auto', color: '#1A1714' }}>

        {/* Resumen — compacto, en una tira */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <Tira titulo="Se debe en total" valor={resumen ? fmt(resumen.monto) : '…'}
            pie={resumen ? `${resumen.cuenta} factura${resumen.cuenta === 1 ? '' : 's'} sin pagar` : 'cargando'} />
          <Tira titulo="Vencen en 7 días" valor={resumen ? resumen.urgentes : '…'}
            pie={resumen ? (resumen.urgentes ? fmt(resumen.montoUrgentes) : 'nada urgente') : 'cargando'}
            color={resumen?.urgentes ? '#B5651D' : null} />
          <Tira titulo="Ya vencidas" valor={resumen ? resumen.vencidas : '…'}
            pie={resumen?.vencidas ? 'pasadas de fecha' : 'ninguna'}
            color={resumen?.vencidas ? '#C0392B' : null} />
          <Tira titulo="Con problema" valor={resumen ? resumen.problemas : '…'}
            pie={resumen?.problemas ? 'no se pueden pagar' : 'todo bien'}
            color={resumen?.problemas ? '#C0392B' : null} />
        </div>

        {/* Buscador — mira TODAS las facturas, no solo el filtro abierto */}
        <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 11 }}>
          <input
            type="text"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setAbierta(null); }}
            placeholder="Buscar en todas: proveedor, número de factura o producto…"
            style={{
              flex: 1, padding: '9px 13px', border: '1.5px solid ' + (busca ? '#2a78a5' : '#E2DDD4'),
              borderRadius: 10, fontSize: 13.5, background: '#FFFFFF',
            }} />
          {busca && (
            <button onClick={() => setBusca('')}
              style={{
                padding: '8px 13px', borderRadius: 9, border: '1.5px solid #E2DDD4',
                background: '#FFFFFF', color: '#6B6560', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              }}>Limpiar</button>
          )}
        </div>
        {busca && (
          <div style={{ fontSize: 12, color: '#2a78a5', marginBottom: 10 }}>
            Buscando en todas las facturas — el filtro de abajo no aplica mientras busque.
          </div>
        )}

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, opacity: busca ? 0.45 : 1 }}>
          {FILTROS.map(f => (
            <button key={f.id} onClick={() => { setFiltro(f.id); setAbierta(null); }}
              style={{
                padding: '6px 12px', borderRadius: 18, cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
                border: '1.5px solid ' + (filtro === f.id ? '#2a78a5' : '#E2DDD4'),
                background: filtro === f.id ? '#2a78a5' : '#FFFFFF',
                color: filtro === f.id ? '#FFFFFF' : '#6B6560',
              }}>{f.etiqueta}</button>
          ))}
        </div>

        {/* Sub-filtro de Centro de pagos. Chiquito y solo ahí, para no volver a llenar la barra. */}
        {filtro === 'pagos' && !busca && (
          <div style={{ display: 'flex', gap: 6, marginTop: -6, marginBottom: 14 }}>
            {[['facturas', 'Facturas'], ['notas', 'Notas de crédito']].map(([id, etiqueta]) => (
              <button key={id} onClick={() => { setSub(id); setAbierta(null); }}
                style={{
                  padding: '3px 10px', borderRadius: 14, cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
                  border: '1.5px solid ' + (sub === id ? '#2a78a5' : '#E2DDD4'),
                  background: sub === id ? '#E4EFFB' : '#FFFFFF',
                  color: sub === id ? '#1f63ad' : '#6B6560',
                }}>{etiqueta}</button>
            ))}
          </div>
        )}

        {sinTabla && (
          <div style={{ ...card, textAlign: 'center', padding: '42px 24px' }}>

            <div style={{ fontWeight: 700 }}>El módulo de facturas todavía no está encendido</div>
            <div style={{ fontSize: 13, color: '#6B6560', marginTop: 6 }}>
              Falta crear la tabla donde se guardan las facturas.
            </div>
          </div>
        )}

        {error && (
          <div style={{ ...card, borderColor: '#C0392B', background: '#FBEAE8', padding: '14px 18px', marginBottom: 14 }}>
            <strong style={{ color: '#C0392B' }}>No se pudieron cargar las facturas.</strong>
            <div style={{ fontSize: 13, color: '#6B6560', marginTop: 4 }}>{error}</div>
          </div>
        )}

        {cargando && <div style={{ padding: 34, textAlign: 'center', color: '#6B6560' }}>Cargando facturas…</div>}

        {!cargando && !visibles.length && !error && !sinTabla && (
          <div style={{ ...card, textAlign: 'center', padding: '42px 20px', color: '#6B6560' }}>

            <div style={{ fontWeight: 600, color: '#1A1714' }}>No hay facturas acá</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Entran solas cuando llegan a facturacion@corraldelsol.com.</div>
          </div>
        )}

        {/* Lista compacta — urgentes arriba */}
        {filtro !== 'grafico' && (
          <>
            {urgentes.length > 0 && (
              <>
                <Titulo texto={`⚠️ Vencen en ${DIAS_URGENTE} días o menos`} color="#C0392B"
                  pie={`${urgentes.length} factura${urgentes.length === 1 ? '' : 's'} · ${fmt(sumaUrgentes)}`} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
                  {urgentes.map(fila)}
                </div>
              </>
            )}
            {resto.length > 0 && (
              <>
                {urgentes.length > 0 && <Titulo texto="El resto" color="#6B6560" pie={`${resto.length}`} />}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {resto.map(fila)}
                </div>
              </>
            )}
          </>
        )}

        {filtro === 'grafico' && !cargando && <GraficoGastos facturas={facturas} />}

        <div style={{ marginTop: 22, fontSize: 11.5, color: '#9A948E', textAlign: 'center', lineHeight: 1.7 }}>
          Las facturas entran solas desde facturacion@corraldelsol.com. El robot solo lee el correo.<br />
          Mercadería y gastos se separan con el código CABYS que trae cada factura — nadie lo escribe a mano.
        </div>
      </div>
    </div>
  );
}

// Un encabezado de grupo, para partir la lista sin meter otra tarjeta.
function Titulo({ texto, color, pie }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 2px 8px' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{texto}</span>
      {pie && <span style={{ fontSize: 11.5, color: '#9A948E' }}>{pie}</span>}
    </div>
  );
}

// ---------------------------------------------------------------- gráfico de gastos
//
// Forma: barras HORIZONTALES de un solo color, ordenadas de mayor a menor.
// Es lo correcto para comparar montos entre categorías de nombre largo.
// 🚫 NO ponerle un color distinto a cada barra: el color por ranking es un error clásico
// (el nombre de la categoría ya dice cuál es cada una, y 9 colores no se distinguen bien).
// El reparto mercadería/gasto sí usa dos colores porque son dos cosas distintas de verdad;
// ese par está validado (ΔE 18.6 con daltonismo protan, 23.6 en visión normal).
const AZUL = '#2a78a5';   // mercadería
const AMBAR = '#B5651D';  // gasto

// Colores del pie. Orden fijo del tema categórico validado (ΔE 9.1 protan / 19.6 normal).
// 🚫 No agregar un 7º color: el pie aguanta 6 pedazos, de ahí en adelante nadie los distingue.
// Por eso el 6º es siempre "Otros". Y como el contraste de algunos contra el blanco queda
// bajo, la leyenda con el monto y la tabla de abajo son OBLIGATORIAS, no adorno.
const PIE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'];
const MAX_PEDAZOS = 6;

const nombreMesCR = () => new Date().toLocaleDateString('es-CR', {
  timeZone: 'America/Costa_Rica', month: 'long', year: 'numeric',
});
const mesActualCR = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit',
}).format(new Date()).slice(0, 7);

function GraficoGastos({ facturas }) {
  // Solo el mes en curso (lo pidió Mario), solo colones, solo de Corral del Sol.
  // Las notas de crédito NO son un pedazo del pie: restan del gasto que corrigen.
  const mes = mesActualCR();
  const delMes = facturas.filter(f =>
    f.es_de_corral_del_sol && f.moneda === 'CRC' &&
    String(f.fecha_emision || '').slice(0, 7) === mes);

  const facturasMes = delMes.filter(f => f.tipo_documento === 'factura');
  const neto = f => Number(f.saldo ?? f.total_comprobante ?? 0);

  const totalMerc = facturasMes.filter(f => f.es_mercaderia).reduce((s, f) => s + neto(f), 0);
  const gastos = facturasMes.filter(f => !f.es_mercaderia);
  const totalGasto = gastos.reduce((s, f) => s + neto(f), 0);
  const total = totalMerc + totalGasto;

  const porCat = {};
  for (const f of gastos) {
    const k = f.categoria || 'sin_clasificar';
    if (!porCat[k]) porCat[k] = { monto: 0, n: 0 };
    porCat[k].monto += neto(f);
    porCat[k].n++;
  }
  const todas = Object.entries(porCat).map(([cat, v]) => ({ cat, ...v })).sort((a, b) => b.monto - a.monto);

  // Los 5 más grandes se ven; el resto se junta en "Otros". Un pie con 9 pedazos no se lee.
  const visibles = todas.slice(0, MAX_PEDAZOS - 1);
  const cola = todas.slice(MAX_PEDAZOS - 1);
  const pedazos = cola.length
    ? [...visibles, { cat: '__otros', monto: cola.reduce((s, x) => s + x.monto, 0), n: cola.reduce((s, x) => s + x.n, 0) }]
    : visibles;

  if (!totalGasto) {
    return (
      <div style={{ ...card, padding: 40, textAlign: 'center', color: '#6B6560' }}>
        No hay gastos registrados en {nombreMesCR()}.
      </div>
    );
  }

  // Dona en SVG: cada pedazo es un arco dibujado con stroke-dasharray sobre el mismo círculo.
  const R = 62, GROSOR = 26, CIRC = 2 * Math.PI * R;
  let acumulado = 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      <div style={{ ...card, padding: '18px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Gastos de {nombreMesCR()}</div>
        <div style={{ fontSize: 11.5, color: '#8A837C', marginBottom: 4 }}>
          Lo que NO es mercadería. {gastos.length} factura{gastos.length === 1 ? '' : 's'}.
        </div>

        <div style={{ display: 'flex', gap: 26, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>

          <div style={{ position: 'relative', width: 168, height: 168, flexShrink: 0 }}>
            <svg width="168" height="168" viewBox="0 0 168 168" role="img"
              aria-label={`Gastos de ${nombreMesCR()} por tipo`}>
              <circle cx="84" cy="84" r={R} fill="none" stroke="#F0EDE6" strokeWidth={GROSOR} />
              {pedazos.map((p, i) => {
                const frac = p.monto / totalGasto;
                const largo = frac * CIRC;
                // 2px de hueco entre pedazos: separa sin inventar espacio.
                const dash = `${Math.max(largo - 2, 0.5)} ${CIRC - Math.max(largo - 2, 0.5)}`;
                const offset = -acumulado * CIRC;
                acumulado += frac;
                return (
                  <circle key={p.cat} cx="84" cy="84" r={R} fill="none"
                    stroke={PIE[i % PIE.length]} strokeWidth={GROSOR}
                    strokeDasharray={dash} strokeDashoffset={offset}
                    transform="rotate(-90 84 84)">
                    <title>{`${p.cat === '__otros' ? 'Otros' : (CATEGORIAS[p.cat] || p.cat)}: ${fmt(p.monto)} (${Math.round(frac * 100)}%)`}</title>
                  </circle>
                );
              })}
            </svg>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.1 }}>{fmt(totalGasto)}</div>
              <div style={{ fontSize: 10.5, color: '#8A837C' }}>en gastos</div>
            </div>
          </div>

          {/* La leyenda lleva el monto: el dato nunca depende de pasar el mouse. */}
          <div style={{ flex: 1, minWidth: 210, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {pedazos.map((p, i) => (
              <div key={p.cat} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: PIE[i % PIE.length], flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.cat === '__otros' ? `Otros (${cola.length} tipos)` : (CATEGORIAS[p.cat] || p.cat)}
                </span>
                <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(p.monto)}</span>
                <span style={{ color: '#8A837C', width: 34, textAlign: 'right', flexShrink: 0 }}>
                  {Math.round(p.monto / totalGasto * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contexto: cuánto pesa el gasto contra la mercadería, en el mismo mes */}
      <div style={{ ...card, padding: '16px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Contra la mercadería del mes</div>
        <div style={{ display: 'flex', height: 22, borderRadius: 5, overflow: 'hidden', gap: 2 }}>
          <div style={{ width: `${(totalMerc / total) * 100}%`, background: AZUL }} title={`Mercadería: ${fmt(totalMerc)}`} />
          <div style={{ width: `${(totalGasto / total) * 100}%`, background: AMBAR }} title={`Gastos: ${fmt(totalGasto)}`} />
        </div>
        <div style={{ display: 'flex', gap: 22, marginTop: 11, flexWrap: 'wrap' }}>
          <Leyenda color={AZUL} nombre="Mercadería" monto={fmt(totalMerc)} pct={Math.round(totalMerc / total * 100)} />
          <Leyenda color={AMBAR} nombre="Gastos y servicios" monto={fmt(totalGasto)} pct={Math.round(totalGasto / total * 100)} />
        </div>
      </div>

      {/* Todos los tipos en números — incluidos los que se fueron a "Otros" */}
      <div style={{ ...card, padding: '16px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Todos los gastos del mes</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 380 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#8A837C', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '4px 8px 8px 0' }}>Tipo de gasto</th>
                <th style={{ padding: '4px 8px 8px', textAlign: 'right' }}>Facturas</th>
                <th style={{ padding: '4px 8px 8px', textAlign: 'right' }}>Monto</th>
                <th style={{ padding: '4px 0 8px 8px', textAlign: 'right' }}>%</th>
              </tr>
            </thead>
            <tbody>
              {todas.map(r => (
                <tr key={r.cat} style={{ borderTop: '1px solid #EFEBE4' }}>
                  <td style={{ padding: '6px 8px 6px 0' }}>{CATEGORIAS[r.cat] || r.cat}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{r.n}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{fmt(r.monto)}</td>
                  <td style={{ padding: '6px 0 6px 8px', textAlign: 'right', color: '#6B6560' }}>{Math.round(r.monto / totalGasto * 100)}%</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #E2DDD4' }}>
                <td style={{ padding: '8px 8px 0 0', fontWeight: 700 }}>Total</td>
                <td style={{ padding: '8px 8px 0', textAlign: 'right' }}>{gastos.length}</td>
                <td style={{ padding: '8px 8px 0', textAlign: 'right', fontWeight: 700 }}>{fmt(totalGasto)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Leyenda({ color, nombre, monto, pct }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 11, height: 11, borderRadius: 3, background: color, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 12, color: '#1A1714' }}>{nombre}</div>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{monto} <span style={{ color: '#8A837C', fontWeight: 400 }}>· {pct}%</span></div>
      </div>
    </div>
  );
}

function Tira({ titulo, valor, pie, color }) {
  return (
    <div style={{ ...card, padding: '10px 16px', flex: '1 1 180px' }}>
      <div style={{ fontSize: 10.5, color: '#8A837C', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{titulo}</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2, color: color || '#1A1714' }}>{valor}</div>
      <div style={{ fontSize: 11.5, color: '#8A837C' }}>{pie}</div>
    </div>
  );
}

function Boton({ onClick, color, children }) {
  return (
    <button onClick={onClick}
      style={{
        background: color, color: '#FFFFFF', border: 'none', borderRadius: 9,
        padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
      }}>
      {children}
    </button>
  );
}
