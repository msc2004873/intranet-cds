'use client';

// Facturas de proveedor — Corral del Sol.
// Las mete solas el robot `cds-agentes/facturas.js` leyendo facturacion@corraldelsol.com.
// Acá se ve el ciclo completo: llega → se recibe la mercadería → entra a QVet → se paga.
// Diseño y decisiones: ~/projectsm1/corral-del-sol/FACTURAS.md

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';

// Regla 2 del CLAUDE.md: colones con espacio y redondeados; dólares con coma y 2 decimales.
const fmt = (n, moneda = 'CRC') => moneda === 'USD'
  ? 'US$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : '₡' + Math.round(Number(n) || 0).toLocaleString('es-CR');

const fecha = (s) => s ? new Date(s).toLocaleDateString('es-CR', { timeZone: 'America/Costa_Rica' }) : '—';

// Día de hoy en Costa Rica, como 'YYYY-MM-DD', para comparar contra el vencimiento.
const hoyCR = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

// Días que faltan para el vencimiento. Negativo = ya se venció.
function diasPara(vence) {
  if (!vence) return null;
  const [a, m, d] = vence.split('-').map(Number);
  const [ha, hm, hd] = hoyCR().split('-').map(Number);
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(ha, hm - 1, hd)) / 86400000);
}

const ESTADOS = {
  recibida:            { nom: 'Recién llegada',      color: '#2a78a5', fondo: '#E8F1F7', icono: '📧' },
  mercaderia_recibida: { nom: 'Mercadería recibida', color: '#8B6914', fondo: '#FBF6E9', icono: '📦' },
  con_problema:        { nom: 'Con problema',        color: '#C0392B', fondo: '#FBEAE8', icono: '🔴' },
  en_inventario:       { nom: 'En QVet',             color: '#5B35B5', fondo: '#EDE9F6', icono: '📥' },
  por_pagar:           { nom: 'Por pagar',           color: '#B5651D', fondo: '#FBF0E4', icono: '💵' },
  pagada:              { nom: 'Pagada',              color: '#1a7a4a', fondo: '#E8F3EC', icono: '✅' },
  anulada:             { nom: 'Anulada',             color: '#6B6560', fondo: '#F0EDE6', icono: '🚫' },
};

const FILTROS = [
  { id: 'todas',               etiqueta: 'Todas' },
  { id: 'recibida',            etiqueta: 'Recién llegadas' },
  { id: 'mercaderia_recibida', etiqueta: 'Mercadería recibida' },
  { id: 'con_problema',        etiqueta: 'Con problema' },
  { id: 'por_pagar',           etiqueta: 'Por pagar' },
  { id: 'pagada',              etiqueta: 'Pagadas' },
  { id: 'ajenas',              etiqueta: '⚠️ No son de Corral del Sol' },
];

const card = {
  background: '#FFFFFF',
  border: '1.5px solid #E2DDD4',
  borderRadius: '16px',
  padding: '18px 20px',
};

export default function FacturasPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState('');
  const [usuario, setUsuario] = useState('');
  const [facturas, setFacturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('todas');
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
      setCargando(true);
      setError('');
      setSinTabla(false);
      const q = filtro === 'ajenas' ? 'vista=ajenas'
        : filtro === 'todas' ? 'vista=propias'
        : `estado=${filtro}`;
      const res = await fetch(`/api/facturas?${q}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFacturas(Array.isArray(data) ? data : []);
    } catch (e) {
      // Mientras la migración no se haya corrido, Postgres contesta que la tabla no existe.
      // Eso no es una falla: es que el módulo todavía no está encendido. No asustar con rojo.
      const m = String(e.message || '');
      if (/facturas_proveedor|does not exist|schema cache|relation/i.test(m)) setSinTabla(true);
      else setError(m);
      setFacturas([]);
    } finally {
      setCargando(false);
    }
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
    } catch (e) {
      alert('No se pudo: ' + e.message);
    }
  }

  if (!userRole) return <div style={{ padding: 40, textAlign: 'center' }}>Cargando...</div>;
  if (userRole !== 'admin') return null;

  // Resumen de arriba — solo cuenta lo que es de Corral del Sol y todavía se debe.
  const porPagar = facturas.filter(f => f.estado === 'por_pagar');
  const venceEsta = porPagar.filter(f => { const d = diasPara(f.fecha_vencimiento); return d !== null && d <= 7; });
  const problemas = facturas.filter(f => f.estado === 'con_problema');
  const sumaPorPagar = porPagar.filter(f => f.moneda === 'CRC').reduce((s, f) => s + Number(f.total_comprobante || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F7F5F0' }}>
      <Header title="Facturas" subtitle="Facturas de proveedores" showLogout={true} showModuleSelector={true} />

      <div style={{ flex: 1, padding: '28px 16px', maxWidth: '1100px', width: '100%', margin: '0 auto', color: '#1A1714' }}>

        {/* Resumen */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          <div style={card}>
            <div style={{ fontSize: 12, color: '#6B6560', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Por pagar</div>
            <div style={{ fontSize: 26, fontWeight: 700, marginTop: 6 }}>{fmt(sumaPorPagar)}</div>
            <div style={{ fontSize: 12, color: '#6B6560', marginTop: 2 }}>{porPagar.length} factura{porPagar.length === 1 ? '' : 's'}</div>
          </div>
          <div style={{ ...card, borderColor: venceEsta.length ? '#B5651D' : '#E2DDD4' }}>
            <div style={{ fontSize: 12, color: '#6B6560', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Vencen en 7 días</div>
            <div style={{ fontSize: 26, fontWeight: 700, marginTop: 6, color: venceEsta.length ? '#B5651D' : '#1A1714' }}>{venceEsta.length}</div>
            <div style={{ fontSize: 12, color: '#6B6560', marginTop: 2 }}>{venceEsta.length ? 'Revisar pronto' : 'Nada urgente'}</div>
          </div>
          <div style={{ ...card, borderColor: problemas.length ? '#C0392B' : '#E2DDD4' }}>
            <div style={{ fontSize: 12, color: '#6B6560', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Con problema</div>
            <div style={{ fontSize: 26, fontWeight: 700, marginTop: 6, color: problemas.length ? '#C0392B' : '#1A1714' }}>{problemas.length}</div>
            <div style={{ fontSize: 12, color: '#6B6560', marginTop: 2 }}>{problemas.length ? 'No se pueden pagar' : 'Todo bien'}</div>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          {FILTROS.map(f => (
            <button key={f.id} onClick={() => { setFiltro(f.id); setAbierta(null); }}
              style={{
                padding: '8px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                border: '1.5px solid ' + (filtro === f.id ? '#2a78a5' : '#E2DDD4'),
                background: filtro === f.id ? '#2a78a5' : '#FFFFFF',
                color: filtro === f.id ? '#FFFFFF' : '#6B6560',
              }}>
              {f.etiqueta}
            </button>
          ))}
        </div>

        {sinTabla && (
          <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>🛠️</div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>El módulo de facturas todavía no está encendido</div>
            <div style={{ fontSize: 13.5, color: '#6B6560', marginTop: 8, lineHeight: 1.6, maxWidth: 460, margin: '8px auto 0' }}>
              La pantalla ya está lista, pero falta crear la tabla donde se guardan las facturas.
              Apenas se cree, acá van a aparecer solas las que lleguen a facturacion@corraldelsol.com.
            </div>
          </div>
        )}

        {error && (
          <div style={{ ...card, borderColor: '#C0392B', background: '#FBEAE8', marginBottom: 16 }}>
            <strong style={{ color: '#C0392B' }}>No se pudieron cargar las facturas.</strong>
            <div style={{ fontSize: 13, color: '#6B6560', marginTop: 6 }}>{error}</div>
          </div>
        )}

        {cargando && <div style={{ padding: 40, textAlign: 'center', color: '#6B6560' }}>Cargando facturas…</div>}

        {!cargando && !facturas.length && !error && !sinTabla && (
          <div style={{ ...card, textAlign: 'center', padding: '48px 20px', color: '#6B6560' }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>📭</div>
            <div style={{ fontWeight: 600, color: '#1A1714' }}>No hay facturas acá</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>
              Las facturas entran solas cuando llegan a facturacion@corraldelsol.com.
            </div>
          </div>
        )}

        {/* Lista */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {facturas.map(f => {
            const e = ESTADOS[f.estado] || ESTADOS.recibida;
            const dias = diasPara(f.fecha_vencimiento);
            const vencida = dias !== null && dias < 0 && f.estado !== 'pagada';
            const pronto = dias !== null && dias >= 0 && dias <= 7 && f.estado !== 'pagada';
            const lineas = (f.facturas_lineas || []).slice().sort((a, b) => (a.numero_linea || 0) - (b.numero_linea || 0));
            const esNota = f.tipo_documento === 'nota_credito';
            const abierto = abierta === f.id;

            return (
              <div key={f.id} style={{ ...card, padding: 0, overflow: 'hidden', borderColor: vencida ? '#C0392B' : '#E2DDD4' }}>

                {/* Fila principal — se hace clic para desplegar los productos */}
                <div onClick={() => setAbierta(abierto ? null : f.id)}
                  style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>

                  <div style={{ fontSize: 22, lineHeight: 1.2 }}>{esNota ? '🧾' : e.icono}</div>

                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.2px' }}>
                      {f.proveedor_nombre}
                      {esNota && <span style={{ fontSize: 11, fontWeight: 700, color: '#5B35B5', marginLeft: 8 }}>NOTA DE CRÉDITO</span>}
                    </div>
                    <div style={{ fontSize: 12.5, color: '#6B6560', marginTop: 3 }}>
                      {fecha(f.fecha_emision)} · {f.condicion_venta_nombre}
                      {f.plazo_credito ? ` a ${f.plazo_credito} días` : ''}
                      {' · '}{lineas.length} producto{lineas.length === 1 ? '' : 's'}
                    </div>

                    {f.fecha_vencimiento && (
                      <div style={{ fontSize: 12.5, marginTop: 4, fontWeight: 600, color: vencida ? '#C0392B' : (pronto ? '#B5651D' : '#6B6560') }}>
                        {vencida ? `⚠️ Venció hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`
                          : dias === 0 ? '⚠️ Vence hoy'
                          : `Vence en ${dias} día${dias === 1 ? '' : 's'} (${f.fecha_vencimiento})`}
                        {f.vencimiento_calculado && (
                          <span title="La factura no trae fecha de vencimiento: se calcula sumándole el plazo a la fecha de emisión."
                            style={{ fontWeight: 400, color: '#9A948E', marginLeft: 6 }}>· calculada</span>
                        )}
                      </div>
                    )}

                    {!f.es_de_corral_del_sol && (
                      <div style={{ fontSize: 12.5, marginTop: 5, color: '#B5651D', fontWeight: 600 }}>
                        ⚠️ Facturada a {f.receptor_nombre} — cédula {f.receptor_cedula}
                      </div>
                    )}
                    {f.corrige_razon && (
                      <div style={{ fontSize: 12.5, marginTop: 4, color: '#5B35B5' }}>Corrige: «{f.corrige_razon}»</div>
                    )}
                    {f.problema_detalle && (
                      <div style={{ fontSize: 12.5, marginTop: 4, color: '#C0392B' }}>Problema: {f.problema_detalle}</div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', minWidth: 130 }}>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{fmt(f.total_comprobante, f.moneda)}</div>
                    <span style={{
                      display: 'inline-block', marginTop: 6, fontSize: 10, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.8px', padding: '3px 10px',
                      borderRadius: 20, background: e.fondo, color: e.color,
                    }}>{e.nom}</span>
                    <div style={{ fontSize: 11, color: '#9A948E', marginTop: 6 }}>
                      {abierto ? '▲ ocultar productos' : '▼ ver productos'}
                    </div>
                  </div>
                </div>

                {/* Productos desplegables */}
                {abierto && (
                  <div style={{ borderTop: '1px solid #E2DDD4', background: '#FCFBF9', padding: '14px 20px' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 520 }}>
                        <thead>
                          <tr style={{ textAlign: 'left', color: '#6B6560', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                            <th style={{ padding: '6px 8px 10px 0' }}>Producto</th>
                            <th style={{ padding: '6px 8px 10px', textAlign: 'right' }}>Cantidad</th>
                            <th style={{ padding: '6px 8px 10px', textAlign: 'right' }}>Precio</th>
                            <th style={{ padding: '6px 0 10px 8px', textAlign: 'right' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineas.map(l => {
                            const falta = l.cantidad_recibida != null && Number(l.cantidad_recibida) < Number(l.cantidad);
                            return (
                              <tr key={l.id} style={{ borderTop: '1px solid #EFEBE4' }}>
                                <td style={{ padding: '8px 8px 8px 0' }}>
                                  {l.detalle}
                                  {falta && (
                                    <span style={{ color: '#C0392B', fontWeight: 600, marginLeft: 8 }}>
                                      llegaron {Number(l.cantidad_recibida)}
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                  {Number(l.cantidad).toLocaleString('es-CR')} {l.unidad_medida || ''}
                                </td>
                                <td style={{ padding: '8px', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(l.precio_unitario, f.moneda)}</td>
                                <td style={{ padding: '8px 0 8px 8px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>{fmt(l.monto_total_linea, f.moneda)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ fontSize: 11.5, color: '#9A948E', marginTop: 12 }}>
                      Factura {f.consecutivo} · clave {f.clave}
                      {f.recibida_por && ` · recibida por ${f.recibida_por} el ${fecha(f.fecha_recepcion)}`}
                      {f.pagada_por && ` · pagada por ${f.pagada_por} el ${fecha(f.fecha_pago)}`}
                    </div>

                    {/* Acciones — solo las que tienen sentido en el estado actual */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                      {f.estado === 'recibida' && (
                        <>
                          <Boton onClick={() => mover(f.id, 'mercaderia_recibida')} color="#1a7a4a">📦 Llegó completa</Boton>
                          <Boton onClick={() => {
                            const d = prompt('¿Qué pasó con este pedido?');
                            if (d) mover(f.id, 'con_problema', { detalle: d });
                          }} color="#C0392B">🔴 Llegó con problema</Boton>
                        </>
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
          })}
        </div>

        <div style={{ marginTop: 28, fontSize: 12, color: '#9A948E', textAlign: 'center' }}>
          Las facturas entran solas desde facturacion@corraldelsol.com. El robot solo lee el correo: no borra ni contesta nada.
        </div>
      </div>
    </div>
  );
}

function Boton({ onClick, color, children }) {
  return (
    <button onClick={onClick}
      style={{
        background: color, color: '#FFFFFF', border: 'none', borderRadius: 10,
        padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
      }}>
      {children}
    </button>
  );
}
