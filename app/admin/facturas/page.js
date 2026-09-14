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
const NOTA_CREDITO = { corta: 'N. CRÉDITO', color: '#5B35B5', fondo: '#EDE9F6' };

// 📐 COLUMNAS FIJAS (Mario, 2026-09-12: *"los días y los montos se ven desalineados, es un
// despiche"*). ☐ · condición · fecha · proveedor · N° factura · estado · días · monto.
// El ☐ de la izquierda es para armar un pago (2026-09-13). En teléfono se esconden fecha, N°
// y estado (clase `solo-ancho`).
const COLUMNAS = '18px 78px 62px minmax(0,1fr) 58px 96px 50px 96px';
// Estilo de los encabezados de columna que no filtran (Factura, Estado, Vence, Monto).
const ENCAB = { fontSize: 10.5, fontWeight: 700, color: '#8A837C', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' };
const CSS_FILA = `.fila-fact{grid-template-columns:${COLUMNAS}}
@media (max-width:640px){.fila-fact{grid-template-columns:18px 74px minmax(0,1fr) 40px 88px}.fila-fact .solo-ancho{display:none}}`;

// Número de factura: SIEMPRE los últimos 5 dígitos, del mismo ancho en todas las filas.
// Historia: primero eran 5, Mario pidió el número completo, y al verlo dijo que como unos son
// más largos que otros se ve desordenado: *"quiero que aparezcan cinco dígitos"* (2026-09-12).
// El consecutivo completo sale al pasar el mouse y en el desplegable.
const numFactura = (f) => String(f.consecutivo || '').slice(-5) || '—';

// Mes en hora de Costa Rica («2026-09»). La emisión viene en UTC: una factura de las 7 pm del
// día 31 ya es del mes siguiente en UTC y caería en el mes equivocado.
const mesCR = (s) => s ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit' }).format(new Date(s)) : '';
const nombreMes = (k) => {
  const t = new Date(`${k}-15T12:00:00`).toLocaleDateString('es-CR', { month: 'long', year: 'numeric' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
// «2026-10-01» → «1/10/26» sin pasar por Date (que lo leería en UTC y mostraría el día anterior).
const diaCorto = (s) => { if (!s) return ''; const [a, m, d] = s.split('-'); return `${+d}/${+m}/${a.slice(2)}`; };
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
  // 💸 PAGO COMBINADO (Mario, 2026-09-13): *"al darle a un checkbox a la izquierda cambia la
  // vara y se hace una suma/resta de todo lo que el proveedor tiene y aparece ahí un total"*.
  // `sel` guarda la foto de cada factura escogida (id → fila) para que la selección no se
  // pierda al cambiar de pestaña o buscar. Un pago = un proveedor y una moneda.
  const [sel, setSel] = useState({});
  // Las notas de crédito SUELTAS de ese proveedor (su factura no está en la base). Las que sí
  // calzan con una factura ya vienen restadas en su saldo. `notasFuera` = las que se desmarcaron.
  const [notasProv, setNotasProv] = useState([]);
  const [notasFuera, setNotasFuera] = useState([]);
  const [verHilo, setVerHilo] = useState(null);   // el historial va escondido: *"mucho texto"*
  // Filtros de los encabezados de la tabla (Mario: *"filtrar en los encabezados, crédito,
  // contado, por fecha, por proveedor"*). Se limpian al cambiar de pestaña.
  const [fCond, setFCond] = useState('');
  const [fMes, setFMes] = useState('');
  const [fProv, setFProv] = useState('');
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

  // 🎯 AL MARCAR UNA FACTURA LA LISTA SE QUEDA SOLO CON ESE PROVEEDOR (Mario, 2026-09-13: *"al
  // seleccionar el proveedor que filtre para que se vea solo lo de ese proveedor y poder
  // seleccionar varios fácilmente"*). Se trae TODO lo que se le debe, sin importar la pestaña.
  const cedulaSel = Object.values(sel)[0]?.proveedor_cedula || '';
  useEffect(() => { if (userRole === 'admin') cargar(); }, [userRole, filtro, sub, busca, !!cedulaSel]);
  useEffect(() => { if (userRole === 'admin') cargarResumen(); }, [userRole]);

  // Al escoger la primera factura de un proveedor se traen sus notas de crédito sueltas.
  useEffect(() => {
    setNotasFuera([]);
    if (!cedulaSel) { setNotasProv([]); return; }
    let vivo = true;
    fetch('/api/facturas?bandeja=notas')
      .then(r => r.json())
      .then(d => {
        if (!vivo || !Array.isArray(d)) return;
        setNotasProv(d.filter(n => n.proveedor_cedula === cedulaSel
          && !['pagada', 'anulada'].includes(n.estado) && !n.corrige_encontrada));
      })
      .catch(() => { /* sin notas igual se puede pagar */ });
    return () => { vivo = false; };
  }, [cedulaSel]);

  function alternar(f) {
    setSel(s => {
      const n = { ...s };
      if (n[f.id]) delete n[f.id]; else n[f.id] = f;
      return n;
    });
  }

  async function pagarCombinado({ referencia, fecha, total, notas }) {
    try {
      const res = await fetch('/api/facturas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'pagar_combinado', quien: usuario,
          ids: Object.keys(sel).map(Number), notas,
          referencia_pago: referencia || null, fecha_pago: fecha, total_esperado: total,
        }),
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return false; }
      setSel({}); setAbierta(null);
      await cargar();
      await cargarResumen();
      return true;
    } catch (e) { alert('No se pudo: ' + e.message); return false; }
  }

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
      // Con un pago armándose, todo lo que se debe (después se deja solo ese proveedor).
      const res = await fetch(`/api/facturas?${cedulaSel ? 'tramite=1&vista=todas' : busca.trim() ? 'vista=todas' : q}`);
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
  // 🚨 Una NOTA DE CRÉDITO no se paga: resta de lo que se debe. Nunca va a «Vencidas».
  const pendiente = f => f.estado !== 'pagada' && f.estado !== 'anulada' && f.tipo_documento === 'factura';
  // El buscador mira proveedor, número de factura y nombre de producto.
  const q = normal(busca.trim());
  // En Centro de pagos → Facturas, las notas no van: no se pagan, restan (tienen su sub-filtro).
  const base = !q && filtro === 'pagos' && sub === 'facturas'
    ? facturas.filter(f => f.tipo_documento === 'factura')
    : facturas;
  const buscadas = !q ? base : facturas.filter(f =>
    normal(f.proveedor_nombre).includes(q) ||
    String(f.consecutivo || '').includes(busca.trim()) ||
    (f.facturas_lineas || []).some(l => normal(l.detalle).includes(q)));

  // ---- filtros de los encabezados ----
  const condDe = f => f.tipo_documento === 'nota_credito' ? 'nota' : (f.condicion_venta === '02' ? '02' : f.condicion_venta === '01' ? '01' : 'otro');
  const opcionesMes = [...new Set(buscadas.map(f => mesCR(f.fecha_emision)).filter(Boolean))].sort().reverse();
  const opcionesProv = [...new Set(buscadas.map(f => f.proveedor_nombre))].sort((a, b) => a.localeCompare(b, 'es'));
  const visibles = cedulaSel
    ? facturas.filter(f => f.proveedor_cedula === cedulaSel && f.tipo_documento === 'factura'
        && !['pagada', 'anulada'].includes(f.estado))
    : buscadas.filter(f =>
        (!fCond || condDe(f) === fCond) &&
        (!fMes || mesCR(f.fecha_emision) === fMes) &&
        (!fProv || f.proveedor_nombre === fProv));

  // ---- 📅 AGRUPADO POR MES (Mario: *"la facturación se lleva por mes"*) ----
  // En Centro de pagos el mes es CUÁNDO TOCA PAGAR (el vencimiento; contado = el mes en que
  // llegó), para *"ver el futuro"*: lo de este mes, lo de octubre, lo de noviembre. Lo que ya
  // se venció va arriba en su propio grupo. En las demás pestañas: el mes en que se emitió.
  const porPago = (filtro === 'pagos' && sub === 'facturas' && !q) || !!cedulaSel;
  // 💵 CONTADO VA PRIMERO (Mario, 2026-09-13): *"primero las facturas de contado y después las
  // de crédito como aparecen ahorita, en orden de vencimiento"*. El contado se debe desde el
  // día que llegó, así que va en su propio grupo arriba, la más vieja primero.
  const mesGrupo = f => {
    if (!porPago) return mesCR(f.fecha_emision);
    if (f.tipo_documento === 'factura' && f.condicion_venta === '01') return 'contado';
    if (pendiente(f) && f.fecha_vencimiento && diasPara(f.fecha_vencimiento) < 0) return 'vencidas';
    return f.fecha_vencimiento ? f.fecha_vencimiento.slice(0, 7) : mesCR(f.fecha_emision);
  };
  const grupos = {};
  for (const f of visibles) (grupos[mesGrupo(f)] ||= []).push(f);
  const PRIMEROS = ['contado', 'vencidas'];
  const ordenGrupos = Object.keys(grupos).sort((a, b) => porPago
    ? ((PRIMEROS.indexOf(a) + 1 || 9) - (PRIMEROS.indexOf(b) + 1 || 9)) || a.localeCompare(b)   // contado, vencidas, y lo que viene del más cercano al más lejano
    : b.localeCompare(a));                                                                    // lo emitido: el mes más nuevo arriba
  for (const k of ordenGrupos) {
    grupos[k].sort(k === 'contado'
      ? (a, b) => String(a.fecha_emision).localeCompare(String(b.fecha_emision))
      : porPago ? porVencimiento : (a, b) => String(b.fecha_emision).localeCompare(String(a.fecha_emision)));
  }
  const tituloGrupo = k => k === 'contado' ? 'Contado' : k === 'vencidas' ? 'Vencidas' : nombreMes(k);

  // La selección del pago, con los datos frescos si la factura está en la lista cargada.
  const elegidas = Object.values(sel).map(s => facturas.find(x => x.id === s.id) || s)
    .sort(porVencimiento);
  const provSel = elegidas[0] || null;
  // Total del grupo: lo que se debe de las facturas (con notas ya restadas); si el grupo es
  // solo de notas de crédito, la suma de las notas.
  const totalGrupo = (l) => {
    const crc = l.filter(f => f.moneda === 'CRC');
    const facts = crc.filter(f => f.tipo_documento === 'factura');
    return facts.length
      ? facts.reduce((s, f) => s + Number(f.saldo ?? f.total_comprobante ?? 0), 0)
      : crc.reduce((s, f) => s + Number(f.total_comprobante || 0), 0);
  };
  const hayFiltros = fCond || fMes || fProv;

  const fila = (f) => {

            const cond = condicionDe(f);
            const est = ESTADOS[f.estado] || ESTADOS.recibida;
            const dias = diasPara(f.fecha_vencimiento);
            const vencida = dias !== null && dias < 0 && f.estado !== 'pagada';
            const pronto = dias !== null && dias >= 0 && dias <= 7 && f.estado !== 'pagada';
            const lineas = (f.facturas_lineas || []).slice().sort((a, b) => (a.numero_linea || 0) - (b.numero_linea || 0));
            const abierto = abierta === f.id;
            // ☐ del pago: solo facturas que se deben. Con una ya escogida, solo las del mismo
            // proveedor y moneda (un pago = una transferencia a una persona).
            const pagable = f.tipo_documento === 'factura' && f.es_de_corral_del_sol && !['pagada', 'anulada'].includes(f.estado);
            const marcada = !!sel[f.id];
            const otroProv = provSel && (provSel.proveedor_cedula !== f.proveedor_cedula || provSel.moneda !== f.moneda);
            const puede = pagable && f.estado !== 'con_problema' && !otroProv;
            const porQueNo = f.estado === 'con_problema' ? 'Tiene un producto con error sin resolver'
              : otroProv ? `El pago que está armando es a ${provSel.proveedor_nombre}` : 'Agregar al pago';
            const estNombre = f.tipo_documento === 'nota_credito' && f.estado === 'pagada' ? 'Aplicada' : est.nom;

            return (
              <div key={f.id} style={{
                ...card, overflow: 'hidden',
                borderColor: marcada ? '#2a78a5' : vencida ? '#E8B4AE' : '#E2DDD4',
                background: marcada ? '#F4F9FE' : card.background,
              }}>

                {/* ---------- UNA SOLA LÍNEA, EN COLUMNAS FIJAS ----------
                    Mario pidió la fila de una línea DOS VECES y después que se viera alineada.
                    Cada dato tiene su columna (ver COLUMNAS arriba): los días y los montos
                    quedan uno debajo del otro. **No devolver datos a la fila**: lo demás va
                    en el desplegable. */}
                <div className="fila-fact" onClick={() => setAbierta(abierto ? null : f.id)}
                  style={{ padding: '7px 12px', cursor: 'pointer', display: 'grid', alignItems: 'center', columnGap: 10 }}>

                  <span
                    role={pagable ? 'checkbox' : undefined}
                    aria-checked={pagable ? marcada : undefined}
                    title={pagable ? (marcada ? 'Quitar del pago' : porQueNo) : undefined}
                    onClick={(e) => { e.stopPropagation(); if (marcada || puede) alternar(f); }}
                    style={{
                      width: 16, height: 16, borderRadius: 4, boxSizing: 'border-box',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 800, color: '#FFFFFF',
                      visibility: pagable ? 'visible' : 'hidden',
                      background: marcada ? '#2a78a5' : '#FFFFFF',
                      border: '1.5px solid ' + (marcada ? '#2a78a5' : '#C9C3BA'),
                      opacity: marcada || puede ? 1 : 0.35,
                      cursor: marcada || puede ? 'pointer' : 'not-allowed',
                    }}>{marcada ? '✓' : ''}</span>

                  <span style={{
                    justifySelf: 'start', fontSize: 9, fontWeight: 800, letterSpacing: '0.4px', padding: '2px 6px',
                    borderRadius: 4, background: cond.fondo, color: cond.color, whiteSpace: 'nowrap',
                  }}>{cond.corta}</span>

                  <span className="solo-ancho" style={{ fontSize: 12, color: '#8A837C', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {fechaCorta(f.fecha_emision)}
                  </span>

                  <span style={{
                    fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }} title={f.proveedor_nombre}>{f.proveedor_nombre}</span>

                  <span className="solo-ancho" style={{
                    fontSize: 12, color: '#6B6560', fontFamily: "'DM Mono', monospace",
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }} title={`Consecutivo ${f.consecutivo}`}>{numFactura(f)}</span>

                  {/* Un gasto recién llegado dice «Gasto»: por eso está en Por revisar sin pasar por Recepción. */}
                  <span className="solo-ancho" style={{
                    fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    color: est.mostrar ? est.color : '#9A948E',
                  }}>
                    {est.mostrar ? estNombre : (f.tipo_documento === 'factura' && !f.es_mercaderia ? 'Gasto' : '')}
                  </span>

                  <span style={{
                    fontSize: 11, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
                    color: vencida ? '#C0392B' : (pronto ? '#B5651D' : '#B5AFA8'),
                    fontWeight: vencida || pronto ? 700 : 400,
                  }}>
                    {f.fecha_vencimiento && f.tipo_documento === 'factura'
                      ? (vencida ? `−${Math.abs(dias)}d` : dias === 0 ? 'hoy' : `${dias}d`)
                      : ''}
                  </span>

                  <span style={{ fontWeight: 700, fontSize: 13, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {/* Si una nota de crédito le rebajó, manda el SALDO. */}
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
                        {f.tipo_documento === 'nota_credito' && f.corrige_encontrada === false && f.estado !== 'pagada' && (
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

                    {/* Una sola línea de datos. La clave de 50 dígitos se quitó: nadie la lee. */}
                    <div style={{ fontSize: 11, color: '#9A948E', marginTop: 8 }}>
                      {f.condicion_venta_nombre}{f.plazo_credito ? ` ${f.plazo_credito} días` : ''}
                      {f.fecha_vencimiento && ` · vence ${diaCorto(f.fecha_vencimiento)}`}
                      {` · N° ${f.consecutivo}`}
                      {f.estado === 'pagada' && ` · pagada ${diaCorto(f.fecha_pago)}${f.referencia_pago ? ` ref. ${f.referencia_pago}` : ''}`}
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
                      </div>
                    ) : (
                      // Un gasto (luz, leasing, gasolina) no se recibe ni entra a QVet: solo se aprueba y se paga.
                      f.tipo_documento === 'factura' && f.estado !== 'pagada' && f.estado !== 'por_pagar' && (
                        <div style={{ marginTop: 12 }}>
                          <Boton onClick={() => accionar(f.id, 'a_pago')} color="#B5651D">Aprobar para pago</Boton>
                        </div>
                      )
                    )}

                    {/* ---------- resolver un error con el proveedor ---------- */}
                    {f.estado === 'con_problema' && (
                      <div style={{ marginTop: 14, padding: '12px 14px', background: '#FDF4F3', border: '1.5px solid #E8B4AE', borderRadius: 10 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#C0392B', marginBottom: 6 }}>Cerrar el problema con el proveedor</div>
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
                    {/* Selector de TIPO. Antes era una frase + un botón «No — es un gasto» que Mario
                        no entendió (*"¿qué es ese botón?"*). Mercadería pasa por Recepción y QVet;
                        gasto se aprueba y se paga. El cambio queda guardado por proveedor. */}
                    {f.tipo_documento === 'factura' && (
                      <div style={{ marginTop: 12, display: 'flex', gap: 6, alignItems: 'center', fontSize: 11.5, color: '#8A837C' }}>
                        Tipo:
                        {[[true, 'Mercadería'], [false, 'Gasto']].map(([merc, nombre]) => {
                          const activo = !!f.es_mercaderia === merc;
                          return (
                            <button key={nombre} disabled={activo}
                              onClick={() => {
                                if (!confirm(`¿Cambiar a ${nombre.toUpperCase()}?\nTambién aplica a las próximas facturas de ${f.proveedor_nombre}.`)) return;
                                accionar(f.id, 'clasificar', { es_mercaderia: merc });
                              }}
                              style={{
                                padding: '3px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 600,
                                cursor: activo ? 'default' : 'pointer',
                                border: '1.5px solid ' + (activo ? '#2a78a5' : '#E2DDD4'),
                                background: activo ? '#E4EFFB' : '#FFFFFF',
                                color: activo ? '#1f63ad' : '#6B6560',
                              }}>{nombre}</button>
                          );
                        })}
                      </div>
                    )}

                    {/* ---------- historial y comentarios: escondidos hasta que se pidan ---------- */}
                    <div style={{ marginTop: 12 }}>
                      <button onClick={() => setVerHilo(verHilo === f.id ? null : f.id)}
                        style={{ background: 'none', border: 'none', padding: 0, color: '#2a78a5', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {verHilo === f.id ? '▴' : '▾'} Historial y comentarios ({(f.facturas_eventos || []).length})
                      </button>
                      {verHilo === f.id && (
                        <>
                          <Hilo eventos={f.facturas_eventos} titulo="" />
                          <CajaTexto
                            placeholder="Escribir un comentario…"
                            boton="Comentar"
                            color="#2a78a5"
                            onEnviar={(txt) => accionar(f.id, 'comentario', { comentario: txt })}
                          />
                        </>
                      )}
                    </div>

                    {/* ---------- pagar ----------
                        Ya no hay botón de pagar adentro de cada factura: se paga con el ☐ de la
                        izquierda y la barra de abajo (2026-09-13). Dos formas de pagar lo mismo
                        era una forma de confundirse; una factura sola es un pago de una. */}
                  </div>
                )}
              </div>
            );
            };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F7F5F0' }}>
      <Header title="Facturas" subtitle="Facturas de proveedores" showLogout={true} showModuleSelector={true} />
      <style>{CSS_FILA}</style>

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
            onChange={(e) => { setBusca(e.target.value); setAbierta(null); setSel({}); }}
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
            <button key={f.id} onClick={() => { setFiltro(f.id); setAbierta(null); setFCond(''); setFMes(''); setFProv(''); setSel({}); }}
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

        {!cargando && !buscadas.length && !error && !sinTabla && filtro !== 'grafico' && (
          <div style={{ ...card, textAlign: 'center', padding: '42px 20px', color: '#6B6560' }}>
            <div style={{ fontWeight: 600, color: '#1A1714' }}>No hay facturas acá</div>
          </div>
        )}

        {/* ---------- la tabla: encabezados que filtran + grupos por mes ----------
            Reemplaza el bloque de «Vencen en 5 días» + «El resto»: ahora manda el mes. Lo urgente
            sigue arriba porque dentro de cada mes se ordena por vencimiento y los días van en rojo. */}
        {filtro !== 'grafico' && !cargando && buscadas.length > 0 && (
          <>
            <div className="fila-fact" style={{
              display: 'grid', columnGap: 10, alignItems: 'center',
              padding: '0 12px 5px', borderBottom: '1.5px solid #E2DDD4',
            }}>
              <span />
              <FiltroEncabezado titulo="Condición" valor={fCond} onChange={setFCond}
                opciones={[['01', 'Contado'], ['02', 'Crédito'], ['nota', 'N. crédito']]} />
              <FiltroEncabezado className="solo-ancho" titulo="Fecha" valor={fMes} onChange={setFMes}
                opciones={opcionesMes.map(m => [m, nombreMes(m)])} />
              <FiltroEncabezado titulo="Proveedor" valor={fProv} onChange={setFProv}
                opciones={opcionesProv.map(p => [p, p])} />
              <span className="solo-ancho" style={ENCAB}>Factura</span>
              <span className="solo-ancho" style={ENCAB}>Estado</span>
              <span style={{ ...ENCAB, textAlign: 'right' }}>Vence</span>
              <span style={{ ...ENCAB, textAlign: 'right' }}>Monto</span>
            </div>

            {cedulaSel && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 2px 0', fontSize: 12.5 }}>
                <span style={{ color: '#1f63ad', fontWeight: 600 }}>
                  Solo {Object.values(sel)[0]?.proveedor_nombre} · {visibles.length} sin pagar
                </span>
                <button onClick={() => setSel({})}
                  style={{ background: 'none', border: 'none', padding: 0, color: '#2a78a5', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  ✕ Ver todas
                </button>
              </div>
            )}
            {hayFiltros && !cedulaSel && (
              <button onClick={() => { setFCond(''); setFMes(''); setFProv(''); }}
                style={{ background: 'none', border: 'none', padding: '6px 2px 0', color: '#2a78a5', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                ✕ Quitar filtros
              </button>
            )}
            {!visibles.length && (
              <div style={{ padding: '22px 12px', color: '#6B6560', fontSize: 13 }}>Ninguna factura con esos filtros.</div>
            )}

            {ordenGrupos.map((k, i) => {
              // 🔠 CONTADO y CRÉDITO en grande, bien separados (Mario, 2026-09-13: *"que diga
              // bien grande crédito donde empieza crédito y contado donde es contado, con buena
              // separación"*). Adentro de crédito siguen los meses en chiquito.
              const empiezaCredito = porPago && k !== 'contado' && (i === 0 || ordenGrupos[i - 1] === 'contado');
              const credito = ordenGrupos.filter(x => x !== 'contado').flatMap(x => grupos[x]);
              return (
                <div key={k} style={{ marginBottom: 10 }}>
                  {porPago && k === 'contado' && (
                    <Seccion titulo="Contado" color="#1f63ad" arriba n={grupos[k].length} total={fmt(totalGrupo(grupos[k]))} />
                  )}
                  {empiezaCredito && (
                    <Seccion titulo="Crédito" color="#8a4d12" arriba={i === 0} n={credito.length} total={fmt(totalGrupo(credito))} />
                  )}
                  {!(porPago && k === 'contado') && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '12px 2px 6px' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: k === 'vencidas' ? '#C0392B' : '#1A1714' }}>
                        {tituloGrupo(k)}
                      </span>
                      <span style={{ fontSize: 11.5, color: '#9A948E' }}>
                        {grupos[k].length} · {fmt(totalGrupo(grupos[k]))}
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: porPago && k === 'contado' ? 10 : 0 }}>
                    {grupos[k].map(fila)}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {filtro === 'grafico' && !cargando && <GraficoGastos facturas={facturas} />}

        {provSel && (
          <BarraPago
            elegidas={elegidas}
            notas={notasProv.filter(n => n.moneda === provSel.moneda)}
            fuera={notasFuera}
            onNota={(id) => setNotasFuera(l => l.includes(id) ? l.filter(x => x !== id) : [...l, id])}
            onQuitar={() => setSel({})}
            onConfirmar={pagarCombinado}
          />
        )}

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

// ---------------------------------------------------------------- barra del pago combinado
//
// Aparece abajo, pegada a la pantalla, apenas se marca un ☐. Hace la cuenta que hoy se hace a
// mano antes de transferir: facturas (con sus notas ya restadas) − notas sueltas = total.
// Y arma el concepto como lo escribe la clínica en el banco («fact 8080 8081 nc 330»), que es
// justo lo que después lee el robot de pagos para reconocer la transferencia.
const numBanco = (d) => String(parseInt(String(d.consecutivo || '').slice(-10), 10) || '');

function BarraPago({ elegidas, notas, fuera, onNota, onQuitar, onConfirmar }) {
  const [referencia, setReferencia] = useState('');
  const [fecha, setFecha] = useState(hoyCR());
  const [enviando, setEnviando] = useState(false);
  const [verDetalle, setVerDetalle] = useState(true);

  const moneda = elegidas[0].moneda;
  const saldo = f => Number(f.saldo ?? f.total_comprobante ?? 0);
  const restan = notas.filter(n => !fuera.includes(n.id));
  const total = elegidas.reduce((s, f) => s + saldo(f), 0)
              - restan.reduce((s, n) => s + Number(n.total_comprobante || 0), 0);
  const sinCiclo = elegidas.filter(f => f.estado !== 'por_pagar').length;
  const concepto = 'fact ' + elegidas.map(numBanco).join(' ')
    + (restan.length ? ' nc ' + restan.map(numBanco).join(' ') : '');
  const n = elegidas.length;

  async function confirmar() {
    if (enviando || total < 0) return;
    setEnviando(true);
    try {
      const ok = await onConfirmar({ referencia: referencia.trim(), fecha, total, notas: restan.map(x => x.id) });
      if (ok) setReferencia('');
    } finally { setEnviando(false); }
  }

  const fila = { display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' };
  const mono = { fontFamily: "'DM Mono', monospace", fontSize: 12, whiteSpace: 'nowrap' };

  return (
    <div style={{ position: 'sticky', bottom: 12, zIndex: 20, marginTop: 16 }}>
      <div style={{ ...card, borderColor: '#2a78a5', boxShadow: '0 8px 26px rgba(26,23,20,0.16)', padding: '11px 14px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <div style={{ fontSize: 10.5, color: '#8A837C', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pago a</div>
            <div style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              title={elegidas[0].proveedor_nombre}>{elegidas[0].proveedor_nombre}</div>
          </div>
          <button onClick={() => setVerDetalle(!verDetalle)}
            style={{ background: 'none', border: 'none', padding: 0, color: '#2a78a5', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {n} factura{n === 1 ? '' : 's'}{restan.length ? ` − ${restan.length} nota${restan.length === 1 ? '' : 's'}` : ''} {verDetalle ? '▴' : '▾'}
          </button>
          <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: total < 0 ? '#C0392B' : '#1A1714' }}>
            {total < 0 ? '−' : ''}{fmt(Math.abs(total), moneda)}
          </div>
          <button onClick={onQuitar} title="Quitar la selección"
            style={{ background: 'none', border: '1.5px solid #E2DDD4', borderRadius: 8, padding: '3px 9px', color: '#6B6560', fontSize: 12, cursor: 'pointer' }}>✕</button>
        </div>

        {verDetalle && (
          <div style={{ marginTop: 9, paddingTop: 7, borderTop: '1px solid #EFEBE4', fontSize: 12.5, maxHeight: '34vh', overflowY: 'auto' }}>
            {elegidas.map(f => (
              <div key={f.id} style={fila}>
                <span style={{ ...mono, color: '#6B6560' }}>··{numFactura(f)}</span>
                <span style={{ flex: 1, minWidth: 0, color: '#8A837C', fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {f.condicion_venta === '01' ? 'contado' : f.fecha_vencimiento ? `vence ${diaCorto(f.fecha_vencimiento)}` : ''}
                  {f.estado !== 'por_pagar' && ' · sin terminar el ciclo'}
                </span>
                {f.nota_credito_aplicada > 0 && (
                  <span style={{ color: '#5B35B5', fontSize: 11.5, whiteSpace: 'nowrap' }}>ya con NC −{fmt(f.nota_credito_aplicada, moneda)}</span>
                )}
                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(saldo(f), moneda)}</span>
              </div>
            ))}
            {/* Notas de crédito sueltas del proveedor: restan por defecto, se pueden desmarcar. */}
            {notas.map(nc => {
              const resta = !fuera.includes(nc.id);
              const razon = nc.corrige_razon && nc.corrige_razon !== '-' ? nc.corrige_razon : 'nota de crédito';
              return (
                <label key={nc.id} style={{ ...fila, color: '#5B35B5', cursor: 'pointer', opacity: resta ? 1 : 0.55 }}>
                  <input type="checkbox" checked={resta} onChange={() => onNota(nc.id)} style={{ accentColor: '#5B35B5', margin: 0 }} />
                  <span style={mono}>NC ··{numFactura(nc)}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{razon}</span>
                  <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textDecoration: resta ? 'none' : 'line-through' }}>
                    −{fmt(nc.total_comprobante, moneda)}
                  </span>
                </label>
              );
            })}
            <div style={{ fontSize: 11.5, color: '#8A837C', marginTop: 5 }}>
              Concepto para el banco: <span style={{ ...mono, color: '#1A1714', userSelect: 'all' }}>{concepto}</span>
            </div>
            {sinCiclo > 0 && (
              <div style={{ fontSize: 11.5, color: '#8a4d12', marginTop: 3 }}>
                {sinCiclo === n ? (n === 1 ? 'Esta factura todavía no termina' : 'Ninguna de estas termina') : `${sinCiclo} de estas todavía no terminan`} el ciclo (Recepción / QVet).
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <input type="text" value={referencia} onChange={(e) => setReferencia(e.target.value)}
            placeholder="Referencia del banco (opcional)"
            style={{ flex: '1 1 170px', minWidth: 0, padding: '7px 10px', border: '1.5px solid #E2DDD4', borderRadius: 9, fontSize: 12.5 }} />
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
            style={{ padding: '7px 10px', border: '1.5px solid #E2DDD4', borderRadius: 9, fontSize: 12.5 }} />
          <button onClick={confirmar} disabled={enviando || total < 0}
            style={{
              background: enviando || total < 0 ? '#C9C4BC' : '#1a7a4a', color: '#FFFFFF', border: 'none', borderRadius: 9,
              padding: '7px 14px', fontSize: 12.5, fontWeight: 700, cursor: enviando || total < 0 ? 'default' : 'pointer', whiteSpace: 'nowrap',
            }}>
            {enviando ? 'Pagando…' : `Confirmar pago ${fmt(Math.max(total, 0), moneda)}`}
          </button>
        </div>
        {total < 0 && (
          <div style={{ fontSize: 11.5, color: '#C0392B', marginTop: 5 }}>Las notas suman más que las facturas: desmarque alguna nota.</div>
        )}
      </div>
    </div>
  );
}

// Encabezado grande de sección (CONTADO / CRÉDITO), con el color de su pastilla y una raya gruesa.
function Seccion({ titulo, color, n, total, arriba }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap',
      margin: arriba ? '16px 0 2px' : '38px 0 2px', padding: '0 2px 7px', borderBottom: `3px solid ${color}`,
    }}>
      <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color }}>{titulo}</span>
      <span style={{ fontSize: 13, color: '#6B6560', fontVariantNumeric: 'tabular-nums' }}>
        {n} factura{n === 1 ? '' : 's'} · {total}
      </span>
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

// Un encabezado de columna que además filtra: se ve como título, y al tocarlo abre la lista.
// Cuando tiene un filtro puesto se pinta azul y muestra lo escogido (ej. «CRÉDITO»).
function FiltroEncabezado({ titulo, valor, onChange, opciones, className }) {
  const activo = !!valor;
  return (
    <select className={className} value={valor} onChange={(e) => onChange(e.target.value)}
      title={`Filtrar por ${titulo.toLowerCase()}`}
      style={{
        width: '100%', minWidth: 0, padding: '2px 0', border: 'none', background: 'transparent',
        fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px',
        color: activo ? '#1f63ad' : '#8A837C', cursor: 'pointer', textOverflow: 'ellipsis',
      }}>
      <option value="">{titulo}</option>
      {opciones.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
    </select>
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
