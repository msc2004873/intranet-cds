'use client';

// RECEPCIÓN DE MERCADERÍA — la primera parada del ciclo (FACTURAS.md §8).
//
// 🎯 PARA QUIÉN ES: quien esté libre cuando llega el camión. Un recepcionista, un asistente,
// quien sea. **NO pide rol admin a propósito.**
//
// 🎨 DISEÑO — REGLAS QUE PUSO MARIO EL 2026-09-13, no volver a inflarlas:
//   · **La fila es UNA línea** y lleva solo 4 datos, en este orden:
//     fecha · proveedor · **los últimos 5 dígitos** del número de factura · monto.
//     El consecutivo completo son 20 dígitos que nadie lee; los últimos 5 son los que la
//     gente canta en voz alta cuando busca una factura.
//   · **Adentro, cada producto también es una línea.** Nada de tarjetas con bordes,
//     párrafos explicativos ni avisos largos: se usa con el producto en las manos.
//   · Textual: *"necesito simplicidad en una línea"*. Si algo se agrega acá, va adentro
//     del producto que se marca mal, no como bloque nuevo.
//
// 🚨 EL ERROR ES POR PRODUCTO, no por factura. Cada producto malo lleva su anotación, y eso
// es lo que Administración usa para reclamarle al proveedor.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';

const fmt = (n, moneda = 'CRC') => moneda === 'USD'
  ? 'US$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : '₡' + Math.round(Number(n) || 0).toLocaleString('es-CR');

const fechaCorta = (s) => s
  ? new Date(s).toLocaleDateString('es-CR', { timeZone: 'America/Costa_Rica', day: 'numeric', month: 'numeric' })
  : '—';

// Los últimos 5 dígitos del consecutivo: lo pidió Mario. El número completo son 20 dígitos.
const corto = (consecutivo) => String(consecutivo || '').slice(-5) || '—';

const ROJO = '#C0392B';
const VERDE = '#1a7a4a';

// Quita tildes y mayúsculas para que buscar "nutricion" encuentre "Nutrición".
const normal = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function RecepcionMercaderiaPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [facturas, setFacturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');
  const [abierta, setAbierta] = useState(null);
  // marcas[idLinea] = { error, llegaron, nota } — solo lo que se tocó.
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
    setAbierta(f.id); setMarcas({}); setComentario('');
  }

  const marcaDe = (id) => marcas[id] || { error: false, llegaron: '', nota: '' };
  const tocar = (id, cambio) => setMarcas(m => ({ ...m, [id]: { ...marcaDe(id), ...cambio } }));

  async function recibir(f) {
    const lineas = (f.facturas_lineas || []).map(l => {
      const m = marcaDe(l.id);
      return {
        id: l.id,
        cantidad_recibida: m.error && m.llegaron !== '' ? Number(String(m.llegaron).replace(/\s/g, '')) : null,
        tiene_error: !!m.error,
        observacion: m.error ? (m.nota || null) : null,
      };
    });
    const conError = lineas.filter(l => l.tiene_error);
    // Un error sin explicación no le sirve a nadie: Administración no sabría qué reclamar.
    if (conError.find(l => !l.observacion && l.cantidad_recibida == null)) {
      avisar('Escribí qué pasó con el producto marcado', 'error'); return;
    }
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
        avisar('Se venció la sesión. Volvé a entrar: no se guardó.', 'error'); return;
      }
      const texto = await res.text();
      let data; try { data = JSON.parse(texto); } catch { data = null; }
      if (!data || data.error) { avisar(data?.error || 'No se pudo guardar', 'error'); return; }

      avisar(conError.length
        ? `Recibida con ${conError.length} error${conError.length === 1 ? '' : 'es'} — le llega a Administración`
        : 'Recibida ✅', conError.length ? 'info' : 'ok');
      setAbierta(null);
      await cargar();
    } catch (e) {
      avisar('No se pudo: ' + e.message, 'error');
    } finally { setGuardando(false); }
  }

  // El buscador mira proveedor, número de factura y nombre de producto: son las tres cosas
  // por las que alguien busca con la caja enfrente.
  const q = normal(busca.trim());
  const lista = !q ? facturas : facturas.filter(f =>
    normal(f.proveedor_nombre).includes(q) ||
    String(f.consecutivo || '').includes(busca.trim()) ||
    (f.facturas_lineas || []).some(l => normal(l.detalle).includes(q)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F7F5F0' }}>
      <Header title="Recepción de mercadería" showLogout={true} />

      <div style={{ flex: 1, padding: '16px 14px', maxWidth: '860px', width: '100%', margin: '0 auto', color: '#1A1714' }}>

        {/* Buscador arriba — pedido de Mario */}
        <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 12 }}>
          <input
            type="text"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setAbierta(null); }}
            placeholder="Buscar proveedor, número de factura o producto…"
            style={{
              flex: 1, padding: '9px 13px', border: '1.5px solid #E2DDD4', borderRadius: 10,
              fontSize: 13.5, background: '#FFFFFF',
            }} />
          <span style={{ fontSize: 12, color: '#8A837C', whiteSpace: 'nowrap' }}>
            {lista.length} pendiente{lista.length === 1 ? '' : 's'}
          </span>
        </div>

        {error && (
          <div style={{ background: '#FBEAE8', border: '1.5px solid #E8B4AE', borderRadius: 10, padding: '11px 14px', marginBottom: 12, fontSize: 13 }}>
            <strong style={{ color: ROJO }}>No se pudieron cargar las facturas.</strong> {error}
          </div>
        )}

        {cargando && <div style={{ padding: 30, textAlign: 'center', color: '#6B6560', fontSize: 13 }}>Cargando…</div>}

        {!cargando && !lista.length && !error && (
          <div style={{ background: '#FFFFFF', border: '1.5px solid #E2DDD4', borderRadius: 12, textAlign: 'center', padding: '34px 18px', color: '#6B6560', fontSize: 13 }}>
            {busca ? 'Nada con esa búsqueda.' : 'Todo lo que llegó ya está recibido.'}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {lista.map(f => {
            const abierto = abierta === f.id;
            const lineas = (f.facturas_lineas || []).slice().sort((a, b) => (a.numero_linea || 0) - (b.numero_linea || 0));
            const errores = lineas.filter(l => marcaDe(l.id).error).length;

            return (
              <div key={f.id} style={{
                background: '#FFFFFF', borderRadius: 10, overflow: 'hidden',
                border: '1.5px solid ' + (abierto ? '#2a78a5' : '#E2DDD4'),
              }}>

                {/* ---------- UNA LÍNEA: fecha · proveedor · ..factura · monto ---------- */}
                <div onClick={() => abrir(f)}
                  style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12.5, color: '#8A837C', whiteSpace: 'nowrap', flexShrink: 0, minWidth: 36 }}>
                    {fechaCorta(f.fecha_emision)}
                  </span>
                  <span style={{
                    flex: 1, fontSize: 13.5, fontWeight: 600, minWidth: 0,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }} title={f.proveedor_nombre}>{f.proveedor_nombre}</span>
                  <span style={{
                    fontSize: 12, color: '#8A837C', fontFamily: "'DM Mono', monospace",
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }} title={`Factura ${f.consecutivo}`}>··{corto(f.consecutivo)}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {fmt(f.total_comprobante, f.moneda)}
                  </span>
                </div>

                {/* ---------- ADENTRO: un producto por línea ---------- */}
                {abierto && (
                  <div style={{ borderTop: '1px solid #EFEBE4', background: '#FCFBF9', padding: '4px 12px 12px' }}>

                    {lineas.map(l => {
                      const m = marcaDe(l.id);
                      return (
                        <div key={l.id} style={{ borderBottom: '1px solid #F1EEE9' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
                            <span style={{
                              flex: 1, fontSize: 13, minWidth: 0,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              color: m.error ? ROJO : '#1A1714',
                            }} title={l.detalle}>{l.detalle}</span>
                            <span style={{ fontSize: 12.5, color: '#8A837C', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {Number(l.cantidad).toLocaleString('es-CR')} {l.unidad_medida || ''}
                            </span>
                            <button
                              onClick={() => tocar(l.id, { error: !m.error })}
                              title={m.error ? 'Quitar la marca' : 'Este producto vino mal'}
                              style={{
                                width: 28, height: 26, borderRadius: 7, cursor: 'pointer', flexShrink: 0,
                                fontSize: 13, lineHeight: 1,
                                border: '1.5px solid ' + (m.error ? ROJO : '#E2DDD4'),
                                background: m.error ? ROJO : '#FFFFFF',
                                color: m.error ? '#FFFFFF' : '#B5AFA8',
                              }}>⚠</button>
                          </div>

                          {m.error && (
                            <div style={{ display: 'flex', gap: 7, alignItems: 'center', padding: '0 0 8px', flexWrap: 'wrap' }}>
                              <input
                                type="text" inputMode="numeric"
                                value={m.llegaron}
                                onChange={(e) => tocar(l.id, { llegaron: e.target.value.replace(/[^\d.,]/g, '') })}
                                placeholder={String(Number(l.cantidad))}
                                title={`Cuántos llegaron de ${Number(l.cantidad)}`}
                                style={{
                                  width: 52, padding: '6px 8px', border: '1.5px solid #E2DDD4', borderRadius: 7,
                                  fontSize: 12.5, fontFamily: "'DM Mono', monospace", textAlign: 'right',
                                }} />
                              <input
                                type="text"
                                value={m.nota}
                                onChange={(e) => tocar(l.id, { nota: e.target.value })}
                                placeholder="¿Qué pasó?"
                                style={{
                                  flex: 1, minWidth: 160, padding: '6px 10px',
                                  border: '1.5px solid #E2DDD4', borderRadius: 7, fontSize: 12.5,
                                }} />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        value={comentario}
                        onChange={(e) => setComentario(e.target.value)}
                        placeholder="Comentario (opcional)"
                        style={{
                          flex: 1, minWidth: 180, padding: '8px 11px',
                          border: '1.5px solid #E2DDD4', borderRadius: 8, fontSize: 12.5,
                        }} />
                      <button
                        onClick={() => recibir(f)}
                        disabled={guardando}
                        style={{
                          padding: '9px 17px', borderRadius: 8, border: 'none',
                          cursor: guardando ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700, color: '#FFFFFF',
                          whiteSpace: 'nowrap',
                          background: guardando ? '#95A5A6' : (errores ? ROJO : VERDE),
                        }}>
                        {guardando ? '…' : errores ? `Recibir con ${errores} error${errores === 1 ? '' : 'es'}` : 'Recibir'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)',
          padding: '11px 18px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, color: '#FFFFFF',
          background: toast.tipo === 'error' ? ROJO : toast.tipo === 'ok' ? '#27AE60' : '#52514e',
          boxShadow: '0 6px 24px rgba(0,0,0,0.18)', zIndex: 50,
        }}>
          {toast.tipo === 'error' ? '❌ ' : toast.tipo === 'ok' ? '✅ ' : 'ℹ️ '}{toast.msg}
        </div>
      )}
    </div>
  );
}
