'use client';

import { useState, useEffect } from 'react';
import Header from '../components/Header';

const DENOMS = [20000, 10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5];
const fmt = n => '₡' + Math.round(n).toLocaleString('es-CR');

const formatFechaHora = () => {
  const now = new Date();
  const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
  return now.toLocaleDateString('es-CR', opciones);
};

export default function ConteoPage() {
  const [cajera, setCajera] = useState('');
  const [caja, setCaja] = useState('');
  const [colaboradores, setColaboradores] = useState([]);
  const [denominaciones, setDenominaciones] = useState({});
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [dolares, setDolares] = useState(0);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(false);
  const [fechaHoraFormato, setFechaHoraFormato] = useState('');

  useEffect(() => {
    const now = new Date();
    const init = {};
    DENOMS.forEach(d => {
      init[d] = 0;
    });
    setDenominaciones(init);
    setFecha(now.toLocaleDateString('es-CR'));
    setHora(now.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }));
    setFechaHoraFormato(formatFechaHora());

    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setCajera(user.nombre);
    }

    loadCajeras();
  }, []);

  async function loadCajeras() {
    try {
      const res = await fetch('/api/admin/colaboradores');
      const data = await res.json();
      setColaboradores(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando cajeras:', err);
    }
  }

  const total = Object.entries(denominaciones).reduce((sum, [d, qty]) => sum + (parseInt(d) * qty), 0);

  const handleDenomChange = (denom, value) => {
    // Remover separador de miles (puntos) si lo hay
    const cleanValue = value.toString().replace(/\./g, '');
    const newVal = parseInt(cleanValue) || 0;
    setDenominaciones({ ...denominaciones, [denom]: newVal });
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  async function handleGuardar() {
    if (!cajera || !caja) {
      showToast('❌ Selecciona cajera y caja');
      return;
    }

    setLoading(true);
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');

      const body = {
        cajera,
        caja,
        fecha: `${year}-${month}-${day}`,
        hora: `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`,
        dolares,
        total_colones: total,
        ...Object.fromEntries(DENOMS.map(d => [`c_${d}`, denominaciones[d] || 0]))
      };

      const res = await fetch('/api/conteo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error guardando conteo');
      }

      showToast(`✅ Conteo registrado: ${fmt(total)}`);
      setTimeout(() => {
        const now = new Date();
        const init = {};
        DENOMS.forEach(d => {
          init[d] = 0;
        });
        setDenominaciones(init);
        setDolares(0);
        setFecha(now.toLocaleDateString('es-CR'));
        setHora(now.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }));
      }, 1500);
    } catch (err) {
      showToast('❌ Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Header title="Conteo de Caja" subtitle="Contá las denominaciones en cualquier momento" showLogout={false} />

      {/* Main */}
      <div style={{ flex: 1, maxWidth: '720px', margin: '0 auto', padding: '24px 16px', width: '100%' }}>

        {/* Selectores Cajera y Caja */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', background: '#F0EDE6' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Información</div>
          </div>
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Cajera</label>
              <div style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px', background: '#F0EDE6', color: '#1A1714', fontWeight: '600' }}>{cajera || 'Cargando...'}</div>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Caja</label>
              <select value={caja} onChange={(e) => setCaja(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px' }}>
                <option value="">Seleccionar...</option>
                <option>Caja 1 (clínica)</option>
                <option>Caja 2</option>
              </select>
            </div>
          </div>
        </div>

        {/* Fecha y Hora */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#6B6560' }}>📅 Conteo de caja del <span style={{ color: '#2a78a5' }}>{fechaHoraFormato || 'cargando...'}</span></div>
        </div>

        {/* Denominaciones */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', background: '#F0EDE6' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Denominaciones</div>
          </div>
          <div style={{ padding: '20px' }}>
            {DENOMS.map((d, idx) => (
              <div key={d} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 110px', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid #E2DDD4' }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', color: '#6B6560', fontWeight: '500' }}>{fmt(d)}</div>
                <input
                  type="text"
                  ref={(el) => (window[`inputDenom${idx}`] = el)}
                  value={denominaciones[d] === 0 || denominaciones[d] === undefined ? '' : (denominaciones[d] || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  onChange={(e) => handleDenomChange(d, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      const nextInput = window[`inputDenom${idx + 1}`];
                      if (nextInput) nextInput.focus();
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      const prevInput = window[`inputDenom${idx - 1}`];
                      if (prevInput) prevInput.focus();
                    }
                  }}
                  inputMode="numeric"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1.5px solid #E2DDD4',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: '500',
                    textAlign: 'center',
                    fontFamily: "'DM Mono', monospace"
                  }}
                />
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', color: '#C8A84B', fontWeight: '600', textAlign: 'right' }}>{fmt((denominaciones[d] || 0) * d)}</div>
              </div>
            ))}

            {/* Total */}
            <div style={{ marginTop: '16px', padding: '14px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#E8F3EC' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Total en caja</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '20px', fontWeight: '700', color: '#2a78a5' }}>{fmt(total)}</span>
            </div>

            {/* Dólares */}
            <div style={{ marginTop: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', flex: 1 }}>Dólares</label>
              <input
                type="text"
                value={dolares === 0 ? '' : dolares.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                onChange={(e) => setDolares(parseFloat(e.target.value.replace(/\./g, '')) || 0)}
                inputMode="decimal"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1.5px solid #E2DDD4',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: "'DM Mono', monospace",
                }}
              />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '16px', fontWeight: '700', color: '#2a78a5', minWidth: '80px' }}>US${dolares.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={() => {
              const init = {};
              DENOMS.forEach(d => {
                init[d] = 0;
              });
              setDenominaciones(init);
            }}
            style={{
              flex: 1,
              padding: '12px',
              background: '#F0EDE6',
              color: '#6B6560',
              border: '1.5px solid #E2DDD4',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#E2DDD4';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#F0EDE6';
            }}
          >
            ↺ Limpiar
          </button>

          <button
            type="button"
            onClick={handleGuardar}
            disabled={loading || total === 0}
            style={{
              flex: 1,
              padding: '12px',
              background: total === 0 ? '#9C9590' : '#2a78a5',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: total === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (total > 0) e.currentTarget.style.background = '#1f5780';
            }}
            onMouseLeave={(e) => {
              if (total > 0) e.currentTarget.style.background = '#2a78a5';
            }}
          >
            {loading ? '⏳ Guardando...' : '✓ Guardar conteo'}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#2a78a5',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: '600',
          zIndex: 9999
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
