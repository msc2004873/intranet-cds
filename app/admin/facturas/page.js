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
const CONDICION = {
  '01': { corta: 'CONTADO', color: '#1a7a4a', fondo: '#E8F3EC' },
  '02': { corta: 'CRÉDITO', color: '#B5651D', fondo: '#FBF0E4' },
};
const condicionDe = (f) => CONDICION[f.condicion_venta] || { corta: 'OTRO', color: '#5B35B5', fondo: '#EDE9F6' };

const ESTADOS = {
  recibida:            { nom: 'Recién llegada',      color: '#2a78a5' },
  mercaderia_recibida: { nom: 'Mercadería recibida', color: '#8B6914' },
  con_problema:        { nom: 'Con problema',        color: '#C0392B' },
  en_inventario:       { nom: 'En QVet',             color: '#5B35B5' },
  por_pagar:           { nom: 'Por pagar',           color: '#B5651D' },
  pagada:              { nom: 'Pagada',              color: '#1a7a4a' },
  anulada:             { nom: 'Anulada',             color: '#6B6560' },
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

const FILTROS = [
  { id: 'tramite',    etiqueta: '⏳ En trámite de pago' },
  { id: 'todas',      etiqueta: 'Todas' },
  { id: 'mercaderia', etiqueta: '📦 Mercadería' },
  { id: 'gastos',     etiqueta: '💸 Gastos y servicios' },
  { id: 'con_problema', etiqueta: 'Con problema' },
  { id: 'pagada',     etiqueta: 'Pagadas' },
  { id: 'ajenas',     etiqueta: '⚠️ De otra persona' },
  { id: 'grafico',    etiqueta: '📊 Gráfico de gastos' },
];

// Arranca en "en trámite de pago": es lo que alguien necesita ver al entrar.
const FILTRO_INICIAL = 'tramite';

// Vence en 5 días o menos → sube arriba del todo. Lo pidió Mario.
const DIAS_URGENTE = 5;

const card = { background: '#FFFFFF', border: '1.5px solid #E2DDD4', borderRadius: '14px' };

export default function FacturasPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState('');
  const [usuario, setUsuario] = useState('');
  const [facturas, setFacturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState(FILTRO_INICIAL);
  const [abierta, setAbierta] = useState(null);
  const [error, setError] = useState('');
  const [sinTabla, setSinTabla] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) { router.push('/login'); return; }
    const user = JSON.parse(userData);
    setUserRole(user.rol || '');
    setUsuario(user.nombre || user.iniciales || 'sin nombre');
    if (user.rol !== 'admin') router.push('/');
  }, [router]);

  useEffect(() => { if (userRole === 'admin') cargar(); }, [userRole, filtro]);

  async function cargar() {
    try {
      setCargando(true); setError(''); setSinTabla(false);
      const estados = ['por_pagar', 'con_problema', 'pagada'];
      const q = filtro === 'tramite' ? 'tramite=1&vista=todas'
        : filtro === 'grafico' ? 'vista=todas'
        : estados.includes(filtro) ? `estado=${filtro}`
        : `vista=${filtro}`;
      const res = await fetch(`/api/facturas?${q}`);
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
    } catch (e) { alert('No se pudo: ' + e.message); }
  }

  if (!userRole) return <div style={{ padding: 40, textAlign: 'center' }}>Cargando...</div>;
  if (userRole !== 'admin') return null;

  const porPagar = facturas.filter(f => f.estado === 'por_pagar');
  const venceEsta = porPagar.filter(f => { const d = diasPara(f.fecha_vencimiento); return d !== null && d <= 7; });
  const problemas = facturas.filter(f => f.estado === 'con_problema');
  const sumaPorPagar = porPagar.filter(f => f.moneda === 'CRC').reduce((s, f) => s + Number(f.total_comprobante || 0), 0);


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
  const ordenadas = facturas.slice().sort(porVencimiento);
  const urgentes = ordenadas.filter(f => {
    const d = diasPara(f.fecha_vencimiento);
    return pendiente(f) && d !== null && d <= DIAS_URGENTE;
  });
  const resto = ordenadas.filter(f => !urgentes.includes(f));
  const sumaUrgentes = urgentes.filter(f => f.moneda === 'CRC').reduce((s, f) => s + Number(f.total_comprobante || 0), 0);

  const fila = (f) => {

            const cond = condicionDe(f);
            const est = ESTADOS[f.estado] || ESTADOS.recibida;
            const dias = diasPara(f.fecha_vencimiento);
            const vencida = dias !== null && dias < 0 && f.estado !== 'pagada';
            const pronto = dias !== null && dias >= 0 && dias <= 7 && f.estado !== 'pagada';
            const lineas = (f.facturas_lineas || []).slice().sort((a, b) => (a.numero_linea || 0) - (b.numero_linea || 0));
            const esNota = f.tipo_documento === 'nota_credito';
            const abierto = abierta === f.id;

            return (
              <div key={f.id} style={{ ...card, borderColor: vencida ? '#E8B4AE' : '#E2DDD4', overflow: 'hidden' }}>

                {/* ---------- LÍNEA 1: condición · fecha · proveedor · monto ---------- */}
                <div onClick={() => setAbierta(abierto ? null : f.id)}
                  style={{ padding: '9px 14px', cursor: 'pointer' }}>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontSize: 9.5, fontWeight: 800, letterSpacing: '0.5px', padding: '3px 7px',
                      borderRadius: 5, background: cond.fondo, color: cond.color, whiteSpace: 'nowrap', flexShrink: 0,
                    }}>{esNota ? 'N. CRÉDITO' : cond.corta}</span>

                    <span style={{ fontSize: 12.5, color: '#6B6560', whiteSpace: 'nowrap', flexShrink: 0, minWidth: 54 }}>
                      {fechaCorta(f.fecha_emision)}
                    </span>

                    <span style={{
                      flex: 1, fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap',
                      overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
                    }} title={f.proveedor_nombre}>
                      {f.es_mercaderia ? '📦 ' : '💸 '}{f.proveedor_nombre}
                    </span>

                    <span style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {fmt(f.total_comprobante, f.moneda)}
                    </span>

                    <span style={{ fontSize: 10, color: '#B5AFA8', flexShrink: 0, width: 10 }}>{abierto ? '▲' : '▼'}</span>
                  </div>

                  {/* ---------- LÍNEA 2: el contexto, chiquito ---------- */}
                  <div style={{
                    fontSize: 11.5, color: '#8A837C', marginTop: 3, paddingLeft: 2,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    <span style={{ color: est.color, fontWeight: 600 }}>{est.nom}</span>
                    {' · '}{CATEGORIAS[f.categoria] || 'Sin clasificar'}
                    {f.categoria_mixta && <span style={{ color: '#B5651D' }}> (mixta)</span>}
                    {' · '}{lineas.length} prod.
                    {f.fecha_vencimiento && (
                      <span style={{ color: vencida ? '#C0392B' : (pronto ? '#B5651D' : '#8A837C'), fontWeight: vencida || pronto ? 600 : 400 }}>
                        {' · '}
                        {vencida ? `venció hace ${Math.abs(dias)}d`
                          : dias === 0 ? 'vence hoy'
                          : `vence en ${dias}d`}
                      </span>
                    )}
                    {!f.es_de_corral_del_sol && <span style={{ color: '#B5651D', fontWeight: 600 }}> · ⚠️ no es de Corral del Sol</span>}
                  </div>
                </div>

                {/* ---------- DESPLEGABLE: todo lo demás ---------- */}
                {abierto && (
                  <div style={{ borderTop: '1px solid #EFEBE4', background: '#FCFBF9', padding: '12px 16px' }}>

                    {(f.problema_detalle || f.corrige_razon || !f.es_de_corral_del_sol) && (
                      <div style={{ fontSize: 12.5, marginBottom: 10, lineHeight: 1.6 }}>
                        {!f.es_de_corral_del_sol && (
                          <div style={{ color: '#B5651D' }}>Facturada a <strong>{f.receptor_nombre}</strong> — cédula {f.receptor_cedula}</div>
                        )}
                        {f.corrige_razon && <div style={{ color: '#5B35B5' }}>Corrige: «{f.corrige_razon}»</div>}
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
                              <tr key={l.id} style={{ borderTop: '1px solid #EFEBE4' }}>
                                <td style={{ padding: '6px 8px 6px 0' }}>
                                  {l.detalle}
                                  {falta && <span style={{ color: '#C0392B', fontWeight: 600, marginLeft: 6 }}>llegaron {Number(l.cantidad_recibida)}</span>}
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

                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 12 }}>
                      {f.estado === 'recibida' && f.es_mercaderia && (
                        <>
                          <Boton onClick={() => mover(f.id, 'mercaderia_recibida')} color="#1a7a4a">📦 Llegó completa</Boton>
                          <Boton onClick={() => {
                            const d = prompt('¿Qué pasó con este pedido?');
                            if (d) mover(f.id, 'con_problema', { detalle: d });
                          }} color="#C0392B">🔴 Llegó con problema</Boton>
                        </>
                      )}
                      {/* Un gasto (luz, leasing, gasolina) no pasa por recibir mercadería: va directo a pago. */}
                      {f.estado === 'recibida' && !f.es_mercaderia && (
                        <Boton onClick={() => mover(f.id, 'por_pagar')} color="#B5651D">💵 Pasar a pago</Boton>
                      )}
                      {f.estado === 'mercaderia_recibida' && (
                        <Boton onClick={() => mover(f.id, 'en_inventario')} color="#5B35B5">📥 Ya está en QVet</Boton>
                      )}
                      {f.estado === 'con_problema' && (
                        <Boton onClick={() => mover(f.id, 'mercaderia_recibida', { detalle: 'Problema resuelto con el proveedor' })} color="#1a7a4a">
                          ✅ Se resolvió con el proveedor
                        </Boton>
                      )}
                      {f.estado === 'en_inventario' && (
                        <Boton onClick={() => mover(f.id, 'por_pagar')} color="#B5651D">💵 Pasar a pago</Boton>
                      )}
                      {f.estado === 'por_pagar' && (
                        <Boton onClick={() => {
                          const ref = prompt('Número de comprobante o referencia del pago (opcional):');
                          if (ref !== null) mover(f.id, 'pagada', { referencia_pago: ref || null });
                        }} color="#1a7a4a">✅ Marcar como pagada</Boton>
                      )}
                    </div>
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
          <Tira titulo="Por pagar" valor={fmt(sumaPorPagar)} pie={`${porPagar.length} factura${porPagar.length === 1 ? '' : 's'}`} />
          <Tira titulo="Vencen en 7 días" valor={venceEsta.length} pie={venceEsta.length ? 'revisar pronto' : 'nada urgente'}
            color={venceEsta.length ? '#B5651D' : null} />
          <Tira titulo="Con problema" valor={problemas.length} pie={problemas.length ? 'no se pueden pagar' : 'todo bien'}
            color={problemas.length ? '#C0392B' : null} />
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
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

        {sinTabla && (
          <div style={{ ...card, textAlign: 'center', padding: '42px 24px' }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>🛠️</div>
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

        {!cargando && !facturas.length && !error && !sinTabla && (
          <div style={{ ...card, textAlign: 'center', padding: '42px 20px', color: '#6B6560' }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>📭</div>
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

function GraficoGastos({ facturas }) {
  // Solo facturas (las notas de crédito restan y confundirían el gráfico) y solo colones:
  // mezclar monedas en una misma barra sería mentir.
  const base = facturas.filter(f => f.tipo_documento === 'factura' && f.moneda === 'CRC' && f.es_de_corral_del_sol);
  const totalMerc = base.filter(f => f.es_mercaderia).reduce((s, f) => s + Number(f.total_comprobante || 0), 0);
  const gastos = base.filter(f => !f.es_mercaderia);
  const totalGasto = gastos.reduce((s, f) => s + Number(f.total_comprobante || 0), 0);
  const total = totalMerc + totalGasto;

  const porCat = {};
  for (const f of gastos) {
    const k = f.categoria || 'sin_clasificar';
    if (!porCat[k]) porCat[k] = { monto: 0, n: 0 };
    porCat[k].monto += Number(f.total_comprobante || 0);
    porCat[k].n++;
  }
  const filas = Object.entries(porCat).map(([k, v]) => ({ cat: k, ...v })).sort((a, b) => b.monto - a.monto);
  const mayor = filas.length ? filas[0].monto : 1;

  if (!total) {
    return <div style={{ ...card, padding: 40, textAlign: 'center', color: '#6B6560' }}>Todavía no hay facturas para graficar.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Reparto mercadería vs gasto — una sola barra, que es parte de un todo */}
      <div style={{ ...card, padding: '16px 18px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 2 }}>En qué se va la plata</div>
        <div style={{ fontSize: 11.5, color: '#8A837C', marginBottom: 12 }}>
          {base.length} facturas en colones · {fmt(total)} en total
        </div>

        <div style={{ display: 'flex', height: 26, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
          <div style={{ width: `${(totalMerc / total) * 100}%`, background: AZUL }} title={`Mercadería: ${fmt(totalMerc)}`} />
          <div style={{ width: `${(totalGasto / total) * 100}%`, background: AMBAR }} title={`Gastos: ${fmt(totalGasto)}`} />
        </div>

        <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
          <Leyenda color={AZUL} nombre="📦 Mercadería" monto={fmt(totalMerc)} pct={Math.round(totalMerc / total * 100)} />
          <Leyenda color={AMBAR} nombre="💸 Gastos y servicios" monto={fmt(totalGasto)} pct={Math.round(totalGasto / total * 100)} />
        </div>
      </div>

      {/* Los gastos, desglosados */}
      <div style={{ ...card, padding: '16px 18px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>Los gastos, por tipo</div>
        <div style={{ fontSize: 11.5, color: '#8A837C', marginBottom: 14 }}>
          Lo que NO es mercadería. La categoría sale del código CABYS de la factura.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {filas.map(r => (
            <div key={r.cat} title={`${r.n} factura${r.n === 1 ? '' : 's'} · ${Math.round(r.monto / totalGasto * 100)}% de los gastos`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3, gap: 10 }}>
                <span style={{ color: '#1A1714', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {CATEGORIAS[r.cat] || r.cat}
                </span>
                <span style={{ color: '#6B6560', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {fmt(r.monto)} <span style={{ color: '#B5AFA8' }}>· {r.n}</span>
                </span>
              </div>
              {/* barra fina, punta redondeada, anclada a la izquierda */}
              <div style={{ background: '#F0EDE6', borderRadius: 4, height: 9 }}>
                <div style={{
                  width: `${Math.max((r.monto / mayor) * 100, 1.5)}%`,
                  height: '100%', background: AMBAR, borderRadius: 4,
                }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #EFEBE4', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#6B6560' }}>Total de gastos</span>
          <strong>{fmt(totalGasto)}</strong>
        </div>
      </div>

      {/* Tabla: el mismo dato en números, para quien no lee barras */}
      <div style={{ ...card, padding: '16px 18px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>Los mismos números</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 380 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#8A837C', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '4px 8px 8px 0' }}>Tipo de gasto</th>
                <th style={{ padding: '4px 8px 8px', textAlign: 'right' }}>Facturas</th>
                <th style={{ padding: '4px 8px 8px', textAlign: 'right' }}>Monto</th>
                <th style={{ padding: '4px 0 8px 8px', textAlign: 'right' }}>% de gastos</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(r => (
                <tr key={r.cat} style={{ borderTop: '1px solid #EFEBE4' }}>
                  <td style={{ padding: '6px 8px 6px 0' }}>{CATEGORIAS[r.cat] || r.cat}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{r.n}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{fmt(r.monto)}</td>
                  <td style={{ padding: '6px 0 6px 8px', textAlign: 'right', color: '#6B6560' }}>{Math.round(r.monto / totalGasto * 100)}%</td>
                </tr>
              ))}
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
