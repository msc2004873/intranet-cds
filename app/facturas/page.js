'use client';

// RECEPCIÓN DE FACTURAS — la primera parada del ciclo (FACTURAS.md §8).
//
// 🎯 PARA QUIÉN ES: quien esté libre cuando llega el camión. Un recepcionista, un asistente,
// quien sea. **NO pide rol admin a propósito** — pedirlo sería copiar el error de antes, que
// tenía los botones de recibir escondidos en /admin.
//
// 🎨 CÓMO SE USA DE VERDAD: con el producto en las manos y una caja abierta al lado. Por eso
// todo arranca en "llegó bien" y solo se toca lo que está MAL. Marcar 14 productos buenos
// para reportar 1 malo es trabajo inventado.
//
// 🚨 EL ERROR ES POR PRODUCTO, no por factura. Cada producto malo lleva su anotación, y eso
// es lo que Gerencia usa para reclamarle al proveedor.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';

const fmt = (n, moneda = 'CRC') => moneda === 'USD'
  ? 'US$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : '₡' + Math.round(Number(n) || 0).toLocaleString('es-CR');

const fechaCorta = (s) => s
  ? new Date(s).toLocaleDateString('es-CR', { timeZone: 'America/Costa_Rica', day: 'numeric', month: 'numeric', year: '2-digit' })
  : '—';

const card = { background: '#FFFFFF', border: '1.5px solid #E2DDD4', borderRadius: '14px' };
const VERDE = '#1a7a4a';
const ROJO = '#C0392B';

export default function RecepcionFacturasPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [facturas, setFacturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [abierta, setAbierta] = useState(null);
  // marcas[idLinea] = { error: bool, llegaron: '', nota: '' } — solo lo que se tocó.
  const [marcas, setMarcas] = useState({});
  const [comentario, setComentario] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState(null);

  const avisar = (msg, tipo = 'info') => { setToast({ msg, tipo }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) { router.push('/login'); return; }
    const user = JSON.parse(userData);
    setUsuario(user.nombre || user.iniciales || '');
  }, [router]);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    try {
      setCargando(true); setError('');
      const res = await fetch('/api/facturas?bandeja=recepcion');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFacturas(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(String(e.message || e));
      setFacturas([]);
    } finally { setCargando(false); }
  }

  function abrir(f) {
    if (abierta === f.id) { setAbierta(null); return; }
    setAbierta(f.id);
    setMarcas({});
    setComentario('');
  }

  const marcaDe = (idLinea) => marcas[idLinea] || { error: false, llegaron: '', nota: '' };

  function tocar(idLinea, cambio) {
    setMarcas(m => ({ ...m, [idLinea]: { ...marcaDe(idLinea), ...cambio } }));
  }

  async function recibir(f) {
    const lineas = (f.facturas_lineas || []).map(l => {
      const m = marcaDe(l.id);
      return {
        id: l.id,
        // Vacío = llegó completo. Solo se escribe cantidad cuando faltó algo.
        cantidad_recibida: m.error && m.llegaron !== '' ? Number(String(m.llegaron).replace(/\s/g, '')) : null,
        tiene_error: !!m.error,
        observacion: m.error ? (m.nota || null) : null,
      };
    });
    const conError = lineas.filter(l => l.tiene_error);
    // Un error sin explicación no le sirve a nadie: Gerencia no sabría qué reclamar.
    const sinNota = conError.find(l => !l.observacion && l.cantidad_recibida == null);
    if (sinNota) { avisar('Escribí qué pasó con el producto marcado', 'error'); return; }

    if (guardando) return;
    setGuardando(true);
    try {
      const res = await fetch(`/api/facturas?id=${f.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'manual',
        body: JSON.stringify({ accion: 'recibir', quien: usuario, lineas, comentario: comentario.trim() || null }),
      });
      // Regla 8 del CLAUDE.md: si la sesión venció, la API responde 401 y NO se guardó.
      if (res.type === 'opaqueredirect' || res.status === 401) {
        avisar('Se venció la sesión. Volvé a entrar: no se guardó.', 'error');
        return;
      }
      const texto = await res.text();
      let data; try { data = JSON.parse(texto); } catch { data = null; }
      if (!data || data.error) { avisar(data?.error || 'No se pudo guardar', 'error'); return; }

      avisar(conError.length
        ? `Recibida con ${conError.length} producto${conError.length === 1 ? '' : 's'} con error — le llega a Gerencia`
        : 'Factura recibida ✅', conError.length ? 'info' : 'ok');
      setAbierta(null);
      await cargar();
    } catch (e) {
      avisar('No se pudo: ' + e.message, 'error');
    } finally { setGuardando(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F7F5F0' }}>
      <Header title="Recepción de facturas" subtitle="Mercadería que llegó" showLogout={true} />

      <div style={{ flex: 1, padding: '22px 16px', maxWidth: '920px', width: '100%', margin: '0 auto', color: '#1A1714' }}>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {facturas.length
              ? `${facturas.length} factura${facturas.length === 1 ? '' : 's'} esperando que alguien reciba`
              : 'Nada pendiente de recibir'}
          </div>
          <div style={{ fontSize: 13, color: '#6B6560', marginTop: 4 }}>
            Buscá la factura del proveedor que acaba de llegar, contá el producto y marcá lo que venga mal.
          </div>
        </div>

        {error && (
          <div style={{ ...card, borderColor: ROJO, background: '#FBEAE8', padding: '14px 18px', marginBottom: 14 }}>
            <strong style={{ color: ROJO }}>No se pudieron cargar las facturas.</strong>
            <div style={{ fontSize: 13, color: '#6B6560', marginTop: 4 }}>{error}</div>
          </div>
        )}

        {cargando && <div style={{ padding: 34, textAlign: 'center', color: '#6B6560' }}>Cargando…</div>}

        {!cargando && !facturas.length && !error && (
          <div style={{ ...card, textAlign: 'center', padding: '42px 20px', color: '#6B6560' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
            <div style={{ fontWeight: 600, color: '#1A1714' }}>Todo lo que llegó ya está recibido</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              Las facturas entran solas cuando el proveedor las manda a facturacion@corraldelsol.com.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {facturas.map(f => {
            const abierto = abierta === f.id;
            const lineas = (f.facturas_lineas || []).slice().sort((a, b) => (a.numero_linea || 0) - (b.numero_linea || 0));
            const errores = lineas.filter(l => marcaDe(l.id).error).length;

            return (
              <div key={f.id} style={{ ...card, overflow: 'hidden', borderColor: abierto ? '#2a78a5' : '#E2DDD4' }}>

                <div onClick={() => abrir(f)} style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {f.proveedor_nombre}
                    </div>
                    <div style={{ fontSize: 12, color: '#8A837C', marginTop: 3 }}>
                      {fechaCorta(f.fecha_emision)} · {lineas.length} producto{lineas.length === 1 ? '' : 's'} · factura {f.consecutivo}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>{fmt(f.total_comprobante, f.moneda)}</div>
                  <span style={{ fontSize: 11, color: '#B5AFA8' }}>{abierto ? '▲' : '▼'}</span>
                </div>

                {abierto && (
                  <div style={{ borderTop: '1px solid #EFEBE4', background: '#FCFBF9', padding: '14px 16px' }}>

                    <div style={{ fontSize: 12.5, color: '#6B6560', marginBottom: 10 }}>
                      Contá cada producto. <strong>Si todo llegó bien no tenés que tocar nada</strong> — solo
                      marcá los que vengan mal o incompletos.
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {lineas.map(l => {
                        const m = marcaDe(l.id);
                        return (
                          <div key={l.id} style={{
                            border: '1.5px solid ' + (m.error ? '#E8B4AE' : '#EFEBE4'),
                            background: m.error ? '#FDF4F3' : '#FFFFFF',
                            borderRadius: 10, padding: '9px 12px',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{l.detalle}</div>
                                <div style={{ fontSize: 11.5, color: '#8A837C', marginTop: 2 }}>
                                  Vienen {Number(l.cantidad).toLocaleString('es-CR')} {l.unidad_medida || ''} · {fmt(l.precio_unitario, f.moneda)} c/u
                                </div>
                              </div>
                              <button
                                onClick={() => tocar(l.id, { error: !m.error })}
                                style={{
                                  padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                  border: '1.5px solid ' + (m.error ? ROJO : '#E2DDD4'),
                                  background: m.error ? ROJO : '#FFFFFF',
                                  color: m.error ? '#FFFFFF' : '#6B6560',
                                }}>
                                {m.error ? '⚠ Con error' : 'Marcar error'}
                              </button>
                            </div>

                            {m.error && (
                              <div style={{ marginTop: 9, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 12, color: '#6B6560' }}>Llegaron</span>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    value={m.llegaron}
                                    onChange={(e) => tocar(l.id, { llegaron: e.target.value.replace(/[^\d.,]/g, '') })}
                                    placeholder={String(Number(l.cantidad))}
                                    style={{
                                      width: 62, padding: '6px 8px', border: '1.5px solid #E2DDD4', borderRadius: 8,
                                      fontSize: 13, fontFamily: "'DM Mono', monospace", textAlign: 'right',
                                    }} />
                                  <span style={{ fontSize: 12, color: '#9C9590' }}>de {Number(l.cantidad).toLocaleString('es-CR')}</span>
                                </div>
                                <input
                                  type="text"
                                  value={m.nota}
                                  onChange={(e) => tocar(l.id, { nota: e.target.value })}
                                  placeholder="¿Qué pasó? (llegó quebrado, vencido, no es lo que pedimos…)"
                                  style={{
                                    flex: 1, minWidth: 220, padding: '7px 10px', border: '1.5px solid #E2DDD4',
                                    borderRadius: 8, fontSize: 13,
                                  }} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <input
                      type="text"
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      placeholder="Comentario para Gerencia (opcional)"
                      style={{
                        width: '100%', marginTop: 12, padding: '9px 12px', border: '1.5px solid #E2DDD4',
                        borderRadius: 8, fontSize: 13,
                      }} />

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => recibir(f)}
                        disabled={guardando}
                        style={{
                          padding: '11px 20px', borderRadius: 10, border: 'none', cursor: guardando ? 'wait' : 'pointer',
                          fontSize: 14, fontWeight: 700, color: '#FFFFFF',
                          background: guardando ? '#95A5A6' : (errores ? ROJO : VERDE),
                        }}>
                        {guardando ? 'Guardando…'
                          : errores ? `Recibir con ${errores} error${errores === 1 ? '' : 'es'}`
                          : 'Todo llegó bien — recibir'}
                      </button>
                      <span style={{ fontSize: 12, color: '#8A837C' }}>
                        Queda firmada a nombre de <strong>{usuario || '—'}</strong>
                      </span>
                    </div>

                    {errores > 0 && (
                      <div style={{ fontSize: 12, color: ROJO, marginTop: 8 }}>
                        Esta factura va a caer en «Facturas con errores» y no se puede pagar hasta que Gerencia lo resuelva con el proveedor.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
