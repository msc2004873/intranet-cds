'use client';

import { useState, useEffect } from 'react';
import Header from './Header';

const parsearMiles = (str) => {
  if (typeof str === 'number') return Math.round(str);
  return parseInt(String(str).replace(/\s/g, '')) || 0;
};

const fmt = (n) => '₡' + Math.round(n).toLocaleString('es-CR');

export default function FormularioRevisionGlory({ fecha, cajera, cobros, periodo, onVolver, onGuardar }) {
  const [denominaciones, setDenominaciones] = useState({
    20000: 0, 10000: 0, 5000: 0, 2000: 0, 1000: 0,
    500: 0, 100: 0, 50: 0, 25: 0, 10: 0, 5: 0,
  });
  const [datafonoGlory, setDatafonoGlory] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [usuarioActual, setUsuarioActual] = useState(null);

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setUsuarioActual(user);
    } catch (err) {
      console.error('Error cargando usuario:', err);
    }
  }, []);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDenomChange = (denom, value) => {
    setDenominaciones({ ...denominaciones, [denom]: parsearMiles(value) });
  };

  // Cobros por método
  const cobrosArray = Array.isArray(cobros) ? cobros : [];
  const cobrosEfectivo = cobrosArray.filter(c => c.metodo === 'Efectivo');
  const cobrosBac = cobrosArray.filter(c => c.metodo === 'Tarjeta BAC');
  const cobrosSinpe = cobrosArray.filter(c => c.metodo === 'SINPE');
  const cobrosTransf = cobrosArray.filter(c => c.metodo === 'Transferencia');

  // Totales cajera por método
  const totalCajera = cobrosArray.reduce((s, c) => s + (c.monto || 0), 0);
  const totalCajeraEfectivo = cobrosEfectivo.reduce((s, c) => s + (c.monto || 0), 0);
  const totalCajeraBac = cobrosBac.reduce((s, c) => s + (c.monto || 0), 0);
  const totalCajeraSinpe = cobrosSinpe.reduce((s, c) => s + (c.monto || 0), 0);
  const totalCajeraTransf = cobrosTransf.reduce((s, c) => s + (c.monto || 0), 0);

  // Totales revisora
  const totalEfectivo = Object.entries(denominaciones).reduce((s, [d, c]) => s + parseInt(d) * c, 0);
  const totalDatafono = datafonoGlory;
  // SINPE y Transferencias se toman directo de los cobros (solo lectura)
  const totalSinpe = totalCajeraSinpe;
  const totalTransf = totalCajeraTransf;
  const totalRevisado = totalEfectivo + totalDatafono + totalSinpe + totalTransf;
  const diferencia = totalCajera - totalRevisado;

  async function guardarRevision() {
    if (!usuarioActual?.nombre) {
      showToast('No se encontró el usuario actual', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/revisionGlory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha,
          cajera,
          revisora: usuarioActual.nombre,
          hora_revision: new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }),
          caja: 'Caja Glory',
          denominaciones,
          datafono_glory: totalDatafono,
          efectivo_revisado: totalEfectivo,
          sinpe_revisado: totalSinpe,
          transferencias_revisadas: totalTransf,
          total_revisado: totalRevisado,
          total_cajera: totalCajera,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al guardar revisión');
      }

      showToast('✅ Revisión guardada correctamente', 'success');
      setTimeout(() => onGuardar(), 1000);
    } catch (err) {
      console.error('Error guardando revisión:', err);
      showToast(`❌ ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  const GOLD = '#C8A84B';
  const GOLD_DARK = '#A88A38';
  const GOLD_LIGHT = '#FBF6E9';
  const GOLD_BORDER = '#E8D99A';

  const SeccionHeader = ({ num, titulo, total }) => (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between', background: '#F0EDE6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '26px', height: '26px', background: GOLD, color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600', flexShrink: 0 }}>{num}</div>
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>{titulo}</div>
      </div>
      {total !== undefined && (
        <div style={{ fontSize: '12px', fontWeight: '600', color: GOLD, fontFamily: "'DM Mono', monospace" }}>{fmt(total)}</div>
      )}
    </div>
  );

  const FilaCajeraRegistro = ({ label, montoCajera, montoRevisora }) => (
    <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#9C9590' }}>
      <span>Cajera registró: <strong style={{ color: '#6B6560' }}>{fmt(montoCajera)}</strong></span>
      {montoRevisora > 0 && (
        <span style={{ fontWeight: '700', color: montoRevisora === montoCajera ? '#27AE60' : '#E74C3C' }}>
          {montoRevisora === montoCajera ? '✓ Coincide' : `Δ ${fmt(Math.abs(montoRevisora - montoCajera))}`}
        </span>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Header title="Revisión — Glory" subtitle={`${fecha} • ${cajera}`} showLogout={false} homeLink="#" />

      <div style={{ flex: 1, maxWidth: '720px', margin: '0 auto', padding: '24px 16px', width: '100%' }}>

        {/* Info de Revisión */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', background: '#F0EDE6' }}>
            <div style={{ width: '26px', height: '26px', background: GOLD, color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>ℹ</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Información de revisión</div>
          </div>
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Cajera</label>
              <div style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px', background: '#F0EDE6', color: '#1A1714', fontWeight: '600' }}>{cajera}</div>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Revisa</label>
              <div style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px', background: '#F0EDE6', color: '#1A1714', fontWeight: '600' }}>{usuarioActual?.nombre || '—'}</div>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Fecha</label>
              <div style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px', background: '#F0EDE6', color: '#6B6560', fontFamily: "'DM Mono', monospace" }}>{fecha}</div>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Caja</label>
              <div style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px', background: '#F0EDE6', color: '#6B6560' }}>Caja Glory</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Total cobrado (cajera)</label>
              <div style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${GOLD_BORDER}`, borderRadius: '8px', fontSize: '16px', background: GOLD_LIGHT, color: GOLD, fontFamily: "'DM Mono', monospace", fontWeight: '700' }}>
                {fmt(totalCajera)}
                <span style={{ fontSize: '11px', color: '#9C9590', fontWeight: '400', marginLeft: '8px' }}>
                  ({cobrosArray.length} cobro{cobrosArray.length !== 1 ? 's' : ''})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 1. Denominaciones */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
          <SeccionHeader num="1" titulo="Conteo de denominaciones" total={totalEfectivo} />
          <div style={{ padding: '20px' }}>
            {[20000, 10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5].map((denom, idx) => {
              const cant = denominaciones[denom];
              const subtotal = denom * cant;
              const label = denom >= 1000 ? `₡${(denom / 1000).toFixed(0)}k` : `₡${denom}`;
              return (
                <div key={denom} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 110px', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid #E2DDD4' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', color: '#6B6560', fontWeight: '500' }}>{label}</div>
                  <input
                    ref={(el) => (window[`inputGloryDenom${idx}`] = el)}
                    type="text"
                    value={cant === 0 ? '' : cant.toLocaleString('es-CR')}
                    onChange={(e) => handleDenomChange(denom, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); window[`inputGloryDenom${idx + 1}`]?.focus(); }
                      if (e.key === 'ArrowUp') { e.preventDefault(); window[`inputGloryDenom${idx - 1}`]?.focus(); }
                    }}
                    placeholder="0"
                    inputMode="numeric"
                    style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '15px', fontWeight: '500', textAlign: 'center', fontFamily: "'DM Mono', monospace" }}
                  />
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', color: GOLD, fontWeight: '600', textAlign: 'right' }}>{fmt(subtotal)}</div>
                </div>
              );
            })}
            <div style={{ marginTop: '14px', padding: '14px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#E8F3EC' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Total efectivo</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '600', color: GOLD }}>{fmt(totalEfectivo)}</span>
            </div>
            <FilaCajeraRegistro montoCajera={totalCajeraEfectivo} montoRevisora={totalEfectivo} />
          </div>
        </div>

        {/* 2. Datafono Glory */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
          <SeccionHeader num="2" titulo="Datafono Glory" total={totalDatafono} />
          <div style={{ padding: '20px' }}>
            <div style={{ border: '1.5px solid #E2DDD4', borderRadius: '8px', padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#6B6560', marginBottom: '8px' }}>Datafono Glory (BAC)</div>
              <input
                type="text"
                value={datafonoGlory === 0 ? '' : datafonoGlory.toLocaleString('es-CR')}
                onChange={(e) => setDatafonoGlory(parsearMiles(e.target.value))}
                placeholder="0"
                inputMode="numeric"
                style={{ width: '100%', border: 'none', padding: '0', fontSize: '20px', fontWeight: '600', fontFamily: "'DM Mono', monospace", outline: 'none' }}
              />
              <div style={{ fontSize: '12px', color: '#9C9590', marginTop: '2px' }}>colones (incluye comisión 13%)</div>
            </div>
            <FilaCajeraRegistro montoCajera={totalCajeraBac} montoRevisora={datafonoGlory} />
          </div>
        </div>

        {/* 3. SINPE — solo lectura */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
          <SeccionHeader num="3" titulo="SINPE Móvil" total={totalSinpe} />
          <div style={{ padding: '16px' }}>
            {cobrosSinpe.length > 0 ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  {cobrosSinpe.map((s, i) => (
                    <div key={i} style={{ border: '1.5px solid #E2DDD4', borderRadius: '10px', padding: '12px', background: '#FAFAF8' }}>
                      <div style={{ fontSize: '11px', color: '#9C9590', marginBottom: '4px' }}>
                        {s.nombre_mascota || s.nombre_dueno || `Cobro ${i + 1}`}
                      </div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '15px', fontWeight: '700', color: '#1A1714' }}>
                        {fmt(s.monto || 0)}
                      </div>
                      {s.hora_cobro && (
                        <div style={{ fontSize: '11px', color: '#9C9590', marginTop: '2px' }}>
                          {new Date(s.hora_cobro).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ padding: '14px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', background: '#E8F3EC' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Total SINPE</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '600', color: GOLD }}>{fmt(totalSinpe)}</span>
                </div>
              </>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#9C9590', fontSize: '12px' }}>
                No se registraron SINPE — ₡0
              </div>
            )}
          </div>
        </div>

        {/* 4. Transferencias — solo lectura */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
          <SeccionHeader num="4" titulo="Transferencias" total={totalTransf} />
          <div style={{ padding: '16px' }}>
            {cobrosTransf.length > 0 ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                  {cobrosTransf.map((t, i) => (
                    <div key={i} style={{ border: '1.5px solid #E2DDD4', borderRadius: '10px', padding: '12px', background: '#FAFAF8' }}>
                      <div style={{ fontSize: '11px', color: '#9C9590', marginBottom: '4px' }}>
                        {t.nombre_mascota || t.nombre_dueno || `Cobro ${i + 1}`}
                      </div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '15px', fontWeight: '700', color: '#1A1714' }}>
                        {fmt(t.monto || 0)}
                      </div>
                      {t.hora_cobro && (
                        <div style={{ fontSize: '11px', color: '#9C9590', marginTop: '2px' }}>
                          {new Date(t.hora_cobro).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ padding: '14px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', background: '#E8F3EC' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Total transferencias</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '600', color: GOLD }}>{fmt(totalTransf)}</span>
                </div>
              </>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#9C9590', fontSize: '12px' }}>
                No se registraron transferencias — ₡0
              </div>
            )}
          </div>
        </div>

        {/* Resumen */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', background: '#F0EDE6' }}>
            <div style={{ width: '26px', height: '26px', background: GOLD, color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '600' }}>✓</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Resumen de revisión</div>
          </div>
          <div style={{ padding: '20px' }}>
            {/* Cabecera columnas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px solid #E2DDD4' }}>
              <div style={{ fontSize: '10px', fontWeight: '600', color: '#9C9590', textTransform: 'uppercase' }}>Método</div>
              <div style={{ fontSize: '10px', fontWeight: '600', color: '#9C9590', textTransform: 'uppercase', textAlign: 'right' }}>Cajera</div>
              <div style={{ fontSize: '10px', fontWeight: '600', color: '#9C9590', textTransform: 'uppercase', textAlign: 'right' }}>Revisora</div>
            </div>
            {[
              { label: 'Efectivo', cajera: totalCajeraEfectivo, revisora: totalEfectivo },
              { label: 'Datafono Glory', cajera: totalCajeraBac, revisora: totalDatafono },
              { label: 'SINPE', cajera: totalCajeraSinpe, revisora: totalSinpe },
              { label: 'Transferencias', cajera: totalCajeraTransf, revisora: totalTransf },
            ].map(({ label, cajera: c, revisora: r }) => (
              <div key={label} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', padding: '6px 0', borderBottom: '1px solid #F0EDE6', alignItems: 'center' }}>
                <div style={{ fontSize: '12px', color: '#6B6560' }}>{label}</div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#9C9590', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>{fmt(c)}</div>
                <div style={{ fontSize: '12px', fontWeight: '600', textAlign: 'right', fontFamily: "'DM Mono', monospace", color: r > 0 ? (r === c ? '#27AE60' : '#E74C3C') : '#1A1714' }}>{fmt(r)}</div>
              </div>
            ))}
            <div style={{ borderTop: '2px solid #E2DDD4', paddingTop: '12px', marginTop: '4px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: GOLD }}>TOTAL</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#6B6560', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>{fmt(totalCajera)}</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: GOLD, textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>{fmt(totalRevisado)}</div>
            </div>
            <div style={{
              marginTop: '12px', padding: '14px 16px', borderRadius: '8px',
              background: diferencia === 0 ? '#E8F3EC' : '#FDE8E8',
              border: `1px solid ${diferencia === 0 ? '#27AE60' : '#E74C3C'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: diferencia === 0 ? '#27AE60' : '#E74C3C', textTransform: 'uppercase' }}>
                {diferencia === 0 ? '✅ Coincide perfectamente' : '⚠️ Diferencia'}
              </span>
              {diferencia !== 0 && (
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '16px', fontWeight: '700', color: '#E74C3C' }}>
                  {diferencia > 0 ? '+' : ''}{fmt(diferencia)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Botones */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px', marginBottom: '24px' }}>
          <button
            onClick={onVolver}
            disabled={loading}
            style={{ padding: '16px', background: '#F0EDE6', color: '#6B6560', border: '1.5px solid #E2DDD4', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: loading ? 'default' : 'pointer', transition: 'background 0.2s' }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = '#E2DDD4')}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.background = '#F0EDE6')}
          >
            ✕ Volver
          </button>
          <button
            onClick={guardarRevision}
            disabled={loading}
            style={{ padding: '16px', background: loading ? '#ccc' : GOLD, color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: loading ? 'default' : 'pointer', transition: 'background 0.2s' }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = GOLD_DARK)}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.background = GOLD)}
          >
            {loading ? '⏳ Guardando...' : '✓ Guardar revisión'}
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', bottom: '20px', right: '20px',
            background: toast.type === 'success' ? '#E8F3EC' : toast.type === 'error' ? '#FDEDEC' : '#F0EDE6',
            border: `1.5px solid ${toast.type === 'success' ? '#27AE60' : toast.type === 'error' ? '#E74C3C' : '#E2DDD4'}`,
            borderRadius: '8px', padding: '14px 16px',
            color: toast.type === 'success' ? '#27AE60' : toast.type === 'error' ? '#C0392B' : '#6B6560',
            fontSize: '13px', fontWeight: '600', maxWidth: '300px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 9999,
          }}>
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
}
