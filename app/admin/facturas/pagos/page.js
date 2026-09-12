'use client';

// PAGOS — la última parada del ciclo (FACTURAS.md §8). La usa Administración.
//
// 🎯 LO QUE ESTA PANTALLA ARREGLA: hoy quien paga lo hace a ciegas. Acá, antes de pagar, ve
// **todo el recorrido de la factura**: quién recibió la mercadería, qué producto vino mal,
// qué escribió Recepción, cómo lo cerró Administración. Ese historial es la razón de la pantalla,
// no un adorno: por eso va ABIERTO y no escondido tras otro click.
//
// 🚨 Lo que llega acá ya pasó los tres checks. Una factura con un producto malo NO aparece:
// el servidor no la deja salir de la bandeja de errores (ver /api/facturas).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../../components/Header';
import { Hilo, CajaTexto } from '../../../components/FacturasCiclo';

const fmt = (n, moneda = 'CRC') => moneda === 'USD'
  ? 'US$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : '₡' + Math.round(Number(n) || 0).toLocaleString('es-CR');

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

const card = { background: '#FFFFFF', border: '1.5px solid #E2DDD4', borderRadius: '14px' };
const ROJO = '#C0392B';
const AMBAR = '#B5651D';
const VERDE = '#1a7a4a';

export default function PagosPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState('');
  const [usuario, setUsuario] = useState('');
  const [facturas, setFacturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [abierta, setAbierta] = useState(null);
  const [pagando, setPagando] = useState(null);   // id de la que se está pagando
  const [refPago, setRefPago] = useState('');
  const [fechaPago, setFechaPago] = useState(hoyCR());
  const [toast, setToast] = useState(null);

  const avisar = (msg, tipo = 'info') => { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) { router.push('/login'); return; }
    const user = JSON.parse(userData);
    setUserRole(user.rol || '');
    setUsuario(user.nombre || user.iniciales || 'sin nombre');
    if (user.rol !== 'admin') router.push('/');
  }, [router]);

  useEffect(() => { if (userRole === 'admin') cargar(); }, [userRole]);

  async function cargar() {
    try {
      setCargando(true); setError('');
      const res = await fetch('/api/facturas?bandeja=pagos');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFacturas(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(String(e.message || e));
      setFacturas([]);
    } finally { setCargando(false); }
  }

  async function accionar(id, accion, extra = {}) {
    try {
      const res = await fetch(`/api/facturas?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, quien: usuario, ...extra }),
      });
      const data = await res.json();
      if (data.error) { avisar(data.error, 'error'); return false; }
      await cargar();
      return true;
    } catch (e) { avisar('No se pudo: ' + e.message, 'error'); return false; }
  }

  async function pagar(f) {
    const ok = await accionar(f.id, 'pagar', {
      referencia_pago: refPago.trim() || null,
      fecha_pago: fechaPago,
    });
    if (ok) {
      avisar(`Pagada a ${f.proveedor_nombre}`, 'ok');
      setPagando(null); setRefPago(''); setAbierta(null);
    }
  }

  if (!userRole) return <div style={{ padding: 40, textAlign: 'center' }}>Cargando...</div>;
  if (userRole !== 'admin') return null;

  // Lo que vence primero, primero. Contado (sin vencimiento) va al final.
  const ordenadas = facturas.slice().sort((a, b) => {
    if (!a.fecha_vencimiento && !b.fecha_vencimiento) return String(a.fecha_emision).localeCompare(String(b.fecha_emision));
    if (!a.fecha_vencimiento) return 1;
    if (!b.fecha_vencimiento) return -1;
    return a.fecha_vencimiento.localeCompare(b.fecha_vencimiento);
  });

  const saldo = f => Number(f.saldo ?? f.total_comprobante ?? 0);
  const crc = f => f.moneda === 'CRC';
  const total = ordenadas.filter(crc).reduce((s, f) => s + saldo(f), 0);
  const vencidas = ordenadas.filter(f => { const d = diasPara(f.fecha_vencimiento); return d !== null && d < 0; });
  const estaSemana = ordenadas.filter(f => { const d = diasPara(f.fecha_vencimiento); return d !== null && d >= 0 && d <= 7; });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F7F5F0' }}>
      <Header title="Pagos" subtitle="Facturas listas para pagar" showLogout={true} showModuleSelector={true} />

      <div style={{ flex: 1, padding: '22px 16px', maxWidth: '980px', width: '100%', margin: '0 auto', color: '#1A1714' }}>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <Tira titulo="Listo para pagar" valor={fmt(total)} pie={`${ordenadas.length} factura${ordenadas.length === 1 ? '' : 's'}`} />
          <Tira titulo="Ya vencidas" valor={vencidas.length} pie={vencidas.length ? 'pagar hoy' : 'ninguna'} color={vencidas.length ? ROJO : null} />
          <Tira titulo="Vencen esta semana" valor={estaSemana.length} pie={estaSemana.length ? fmt(estaSemana.filter(crc).reduce((s, f) => s + saldo(f), 0)) : 'nada urgente'} color={estaSemana.length ? AMBAR : null} />
        </div>

        {error && (
          <div style={{ ...card, borderColor: ROJO, background: '#FBEAE8', padding: '14px 18px', marginBottom: 14 }}>
            <strong style={{ color: ROJO }}>No se pudieron cargar las facturas.</strong>
            <div style={{ fontSize: 13, color: '#6B6560', marginTop: 4 }}>{error}</div>
          </div>
        )}

        {cargando && <div style={{ padding: 34, textAlign: 'center', color: '#6B6560' }}>Cargando…</div>}

        {!cargando && !ordenadas.length && !error && (
          <div style={{ ...card, textAlign: 'center', padding: '42px 20px', color: '#6B6560' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💸</div>
            <div style={{ fontWeight: 600, color: '#1A1714' }}>No hay nada listo para pagar</div>
            <div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.6 }}>
              Una factura llega acá cuando Recepción la recibió y Administración marcó QVet y el marcado.<br />
              Lo que está a medio camino se ve en <a href="/admin/facturas" style={{ color: '#2a78a5' }}>Facturas</a>.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ordenadas.map(f => {
            const dias = diasPara(f.fecha_vencimiento);
            const vencida = dias !== null && dias < 0;
            const pronto = dias !== null && dias >= 0 && dias <= 7;
            const abierto = abierta === f.id;
            const lineas = (f.facturas_lineas || []).slice().sort((a, b) => (a.numero_linea || 0) - (b.numero_linea || 0));
            const conError = lineas.filter(l => l.tiene_error);

            return (
              <div key={f.id} style={{ ...card, overflow: 'hidden', borderColor: vencida ? '#E8B4AE' : (abierto ? '#2a78a5' : '#E2DDD4') }}>

                <div onClick={() => { setAbierta(abierto ? null : f.id); setPagando(null); }}
                  style={{ padding: '11px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 11 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {f.proveedor_nombre}
                    </div>
                    <div style={{ fontSize: 11.5, color: vencida ? ROJO : (pronto ? AMBAR : '#8A837C'), marginTop: 3, fontWeight: vencida || pronto ? 600 : 400 }}>
                      {f.fecha_vencimiento
                        ? (vencida ? `Venció hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`
                          : dias === 0 ? 'Vence hoy'
                          : `Vence en ${dias} día${dias === 1 ? '' : 's'}`)
                        : 'De contado — pagar ya'}
                      <span style={{ color: '#8A837C', fontWeight: 400 }}> · factura {f.consecutivo}</span>
                      {conError.length > 0 && <span style={{ color: AMBAR }}> · tuvo {conError.length} producto{conError.length === 1 ? '' : 's'} con error</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{fmt(saldo(f), f.moneda)}</div>
                    {f.nota_credito_aplicada > 0 && (
                      <div style={{ fontSize: 11, color: '#5B35B5' }}>nota de crédito −{fmt(f.nota_credito_aplicada, f.moneda)}</div>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: '#B5AFA8' }}>{abierto ? '▲' : '▼'}</span>
                </div>

                {abierto && (
                  <div style={{ borderTop: '1px solid #EFEBE4', background: '#FCFBF9', padding: '14px 16px' }}>

                    {/* Quién la caminó. Es el sello de papel, pero completo. */}
                    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12, color: '#6B6560', marginBottom: 12 }}>
                      <Paso titulo="Recibió" quien={f.recibida_por} cuando={f.fecha_recepcion} />
                      <Paso titulo="Subió a QVet" quien={f.en_qvet_por} cuando={f.fecha_qvet} />
                      <Paso titulo="Marcó" quien={f.marcado_por} cuando={f.fecha_marcado} />
                    </div>

                    {conError.length > 0 && (
                      <div style={{ padding: '10px 13px', background: '#FDF4F3', border: '1.5px solid #E8B4AE', borderRadius: 10, marginBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: ROJO, marginBottom: 5 }}>
                          Esta factura tuvo problemas al recibirla
                        </div>
                        {conError.map(l => (
                          <div key={l.id} style={{ fontSize: 12, color: '#6B6560', marginTop: 3 }}>
                            <strong>{l.detalle}</strong>
                            {l.cantidad_recibida != null && Number(l.cantidad_recibida) < Number(l.cantidad) &&
                              ` — llegaron ${Number(l.cantidad_recibida)} de ${Number(l.cantidad)}`}
                            {l.observacion && ` · «${l.observacion}»`}
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ fontSize: 11.5, color: '#8A837C', lineHeight: 1.7 }}>
                      Emitida el {fechaLarga(f.fecha_emision)} · {f.condicion_venta_nombre}
                      {f.plazo_credito ? ` a ${f.plazo_credito} días` : ''}
                      {f.fecha_vencimiento && ` · vence ${f.fecha_vencimiento}`}
                      <br />{lineas.length} producto{lineas.length === 1 ? '' : 's'} · total de la factura {fmt(f.total_comprobante, f.moneda)}
                      <br />Clave {f.clave}
                    </div>

                    {/* El historial va abierto: es la razón de ser de esta pantalla. */}
                    <Hilo eventos={f.facturas_eventos} titulo="Todo lo que pasó con esta factura" />

                    <CajaTexto
                      placeholder="Escribir un comentario…"
                      boton="Comentar"
                      color="#2a78a5"
                      onEnviar={(txt) => accionar(f.id, 'comentario', { comentario: txt })}
                    />

                    {/* ---------- pagar ---------- */}
                    {pagando === f.id ? (
                      <div style={{ marginTop: 14, padding: '13px 15px', background: '#F2F9F5', border: '1.5px solid #BFE0CD', borderRadius: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 9 }}>
                          Pagar {fmt(saldo(f), f.moneda)} a {f.proveedor_nombre}
                        </div>
                        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
                          <input
                            type="text"
                            value={refPago}
                            onChange={(e) => setRefPago(e.target.value)}
                            placeholder="Referencia o comprobante (opcional)"
                            style={{ flex: 1, minWidth: 200, padding: '8px 11px', border: '1.5px solid #E2DDD4', borderRadius: 9, fontSize: 13 }} />
                          <input
                            type="date"
                            value={fechaPago}
                            onChange={(e) => setFechaPago(e.target.value)}
                            style={{ padding: '8px 11px', border: '1.5px solid #E2DDD4', borderRadius: 9, fontSize: 13, fontFamily: "'DM Mono', monospace" }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
                          <button onClick={() => pagar(f)}
                            style={{ background: VERDE, color: '#FFFFFF', border: 'none', borderRadius: 9, padding: '9px 17px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                            Confirmar pago
                          </button>
                          <button onClick={() => { setPagando(null); setRefPago(''); }}
                            style={{ background: '#FFFFFF', color: '#6B6560', border: '1.5px solid #E2DDD4', borderRadius: 9, padding: '9px 15px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            Cancelar
                          </button>
                        </div>
                        <div style={{ fontSize: 11.5, color: '#8A837C', marginTop: 8 }}>
                          Queda firmado a nombre de <strong>{usuario}</strong>.
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: 14 }}>
                        <button onClick={() => { setPagando(f.id); setFechaPago(hoyCR()); }}
                          style={{ background: VERDE, color: '#FFFFFF', border: 'none', borderRadius: 10, padding: '10px 19px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
                          Marcar como pagada
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 22, fontSize: 11.5, color: '#9A948E', textAlign: 'center', lineHeight: 1.7 }}>
          Acá solo aparecen las facturas que ya pasaron recepción y los checks de Administración.<br />
          Lo que está trancado con un proveedor se ve en <a href="/admin/facturas" style={{ color: '#2a78a5' }}>Facturas → Facturas con errores</a>.
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#FFFFFF',
          background: toast.tipo === 'error' ? ROJO : toast.tipo === 'ok' ? '#27AE60' : '#52514e',
          boxShadow: '0 6px 24px rgba(0,0,0,0.18)', zIndex: 50,
        }}>
          {toast.tipo === 'error' ? '❌ ' : toast.tipo === 'ok' ? '✅ ' : 'ℹ️ '}{toast.msg}
        </div>
      )}
    </div>
  );
}

function Paso({ titulo, quien, cuando }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: '#8A837C', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{titulo}</div>
      <div style={{ fontSize: 12.5, color: quien ? '#1A1714' : '#B5AFA8', fontWeight: quien ? 600 : 400 }}>{quien || '—'}</div>
      {cuando && <div style={{ fontSize: 11, color: '#B5AFA8' }}>{fechaLarga(cuando)}</div>}
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
