'use client';

import { useState, useEffect } from 'react';
import Header from './Header';

const formatearMiles = (num) => {
  if (!num) return '';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const parsearMiles = (str) => {
  if (typeof str === 'number') return Math.round(str);
  return parseInt(str.replace(/\s/g, '')) || 0;
};

const fmtMonto = (monto) => {
  return '₡' + Math.round(monto).toLocaleString('es-CR');
};

export default function FormularioRevisionGlory({ fecha, cajera, cobros, periodo, onVolver, onGuardar }) {
  const [denominaciones, setDenominaciones] = useState({
    20000: '',
    10000: '',
    5000: '',
    2000: '',
    1000: '',
    500: '',
    100: '',
    50: '',
    25: '',
    10: '',
    5: '',
  });

  const [bac, setBac] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [horaRevision, setHoraRevision] = useState(new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }));

  useEffect(() => {
    cargarUsuario();
  }, []);

  function cargarUsuario() {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setUsuarioActual(user);
    } catch (err) {
      console.error('Error cargando usuario:', err);
    }
  }

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Calcular totales
  const totalEfectivo = Object.entries(denominaciones).reduce((sum, [denom, cant]) => {
    return sum + (parseInt(denom) * parsearMiles(cant));
  }, 0);

  const totalBac = parsearMiles(bac);
  const totalCajera = cobros.reduce((sum, c) => sum + (c.monto || 0), 0);
  const totalEnCaja = totalEfectivo + totalBac;

  async function guardarRevision() {
    if (!usuarioActual?.nombre) {
      showToast('No se encontró el usuario actual', 'error');
      return;
    }

    setLoading(true);
    try {
      const denomsNumeros = Object.fromEntries(
        Object.entries(denominaciones).map(([k, v]) => [k, parsearMiles(v)])
      );

      const revisionData = {
        fecha,
        cajera,
        revisora: usuarioActual.nombre,
        hora_revision: horaRevision,
        caja: 'Caja Glory',
        denominaciones: denomsNumeros,
        bac: totalBac,
        efectivo_revisado: totalEfectivo,
        total_revisado: totalEnCaja,
        total_cajera: totalCajera,
      };

      const res = await fetch('/api/revisionGlory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(revisionData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al guardar revisión');
      }

      showToast('✅ Revisión guardada', 'success');
      setTimeout(() => onGuardar(), 1500);
    } catch (err) {
      console.error('Error guardando revisión:', err);
      showToast(`❌ ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Header title="Revisión — Glory" subtitle={`${fecha} • ${cajera}`} showLogout={false} homeLink="#" />

      <div style={{ flex: 1, maxWidth: '720px', margin: '0 auto', padding: '24px 16px', width: '100%' }}>

        {/* Información de la revisión */}
        <div style={{ background: '#FBF6E9', border: '1px solid #C8A84B', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '4px' }}>Fecha</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1714' }}>{fecha}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '4px' }}>Cajera</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1714' }}>{cajera}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '4px' }}>Revisora</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1714' }}>{usuarioActual?.nombre || 'Cargando...'}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '4px' }}>Hora de cierre</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1714' }}>{horaRevision}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '4px' }}>Caja</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1714' }}>Caja Glory</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '4px' }}>Total cobrado</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#C8A84B' }}>{fmtMonto(totalCajera)}</div>
            </div>
          </div>
        </div>

        {/* Sección: Conteo de Denominaciones */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#1A1714', marginBottom: '16px' }}>
            💵 Conteo de Denominaciones
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            {Object.entries(denominaciones).map(([denom, value]) => (
              <div key={denom}>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                  ₡{parseInt(denom).toLocaleString('es-CR')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={value}
                  onChange={(e) => {
                    const num = e.target.value.replace(/[^0-9]/g, '');
                    setDenominaciones({ ...denominaciones, [denom]: num ? parseInt(num).toLocaleString('es-CR') : '' });
                  }}
                  placeholder="0"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #E2DDD4',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontFamily: "'DM Mono', monospace",
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{ background: '#FBF6E9', border: '1px solid #E2DDD4', borderRadius: '8px', padding: '12px', marginTop: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '4px' }}>Total Efectivo</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#C8A84B', fontFamily: "'DM Mono', monospace" }}>{fmtMonto(totalEfectivo)}</div>
          </div>
        </div>

        {/* Sección: Conteo de Datafono */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#1A1714', marginBottom: '16px' }}>
            💳 Conteo de Datafono
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              BAC
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={bac}
              onChange={(e) => {
                const num = e.target.value.replace(/[^0-9]/g, '');
                setBac(num ? parseInt(num).toLocaleString('es-CR') : '');
              }}
              placeholder="0"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #E2DDD4',
                borderRadius: '6px',
                fontSize: '13px',
                fontFamily: "'DM Mono', monospace",
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ background: '#FBF6E9', border: '1px solid #E2DDD4', borderRadius: '8px', padding: '12px', marginTop: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '4px' }}>Total Datafono</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#C8A84B', fontFamily: "'DM Mono', monospace" }}>{fmtMonto(totalBac)}</div>
          </div>
        </div>

        {/* Resumen total */}
        <div style={{ background: '#E8F3EC', border: '1px solid #27AE60', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#1A1714', textTransform: 'uppercase', marginBottom: '8px' }}>
            Total Revisado
          </div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#27AE60', fontFamily: "'DM Mono', monospace", marginBottom: '12px' }}>
            {fmtMonto(totalEnCaja)}
          </div>
          <div style={{ fontSize: '12px', color: '#6B6560', display: 'flex', justifyContent: 'space-between' }}>
            <span>Cobrado: {fmtMonto(totalCajera)}</span>
            <span style={{ fontWeight: '700', color: totalCajera === totalEnCaja ? '#27AE60' : '#E74C3C' }}>
              {totalCajera === totalEnCaja ? '✅ Coincide' : `Diferencia: ${fmtMonto(Math.abs(totalCajera - totalEnCaja))}`}
            </span>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            right: '20px',
            maxWidth: '600px',
            margin: '0 auto',
            padding: '16px',
            background: toast.type === 'error' ? '#FDEDEC' : toast.type === 'success' ? '#E8F3EC' : '#f0f0f0',
            border: `1px solid ${toast.type === 'error' ? '#E74C3C' : toast.type === 'success' ? '#27AE60' : '#E2DDD4'}`,
            borderRadius: '8px',
            color: toast.type === 'error' ? '#C0392B' : toast.type === 'success' ? '#27AE60' : '#666',
            fontSize: '14px',
            fontWeight: '600',
            zIndex: 9999,
            animation: 'fadeIn 0.3s'
          }}>
            {toast.msg}
          </div>
        )}

        {/* Botones */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          <button
            onClick={onVolver}
            disabled={loading}
            style={{
              padding: '12px',
              background: '#F0EDE6',
              color: '#6B6560',
              border: '1.5px solid #E2DDD4',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = '#E2DDD4')}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.background = '#F0EDE6')}
          >
            ← Volver
          </button>
          <button
            onClick={guardarRevision}
            disabled={loading}
            style={{
              padding: '12px',
              background: '#C8A84B',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = '#A88A38')}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.background = '#C8A84B')}
          >
            {loading ? '⏳ Guardando...' : '💾 Guardar Revisión'}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
