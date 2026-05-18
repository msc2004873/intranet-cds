'use client';

import { useState, useEffect, use } from 'react';
import Header from '../../components/Header';

const DENOMS = [20000, 10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5];
const fmt = n => '₡' + Math.round(n).toLocaleString('es-CR');

const parsePeriodId = (periodId) => {
  const [inicio, fin] = periodId.split('_');
  return {
    inicio: new Date(inicio),
    fin: new Date(fin)
  };
};

const getDiasDelPeriodo = (inicio, fin) => {
  const dias = [];
  const actual = new Date(inicio);
  while (actual <= fin) {
    dias.push(new Date(actual));
    actual.setDate(actual.getDate() + 1);
  }
  return dias;
};

const formatFecha = (date) => {
  return date.toLocaleDateString('es-CR', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();
};

export default function RevisoraDetallePage({ params }) {
  const { periodId } = use(params);
  const { inicio, fin } = parsePeriodId(periodId);
  const dias = getDiasDelPeriodo(inicio, fin);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Header title="Revisión de Caja" subtitle={`${formatFecha(inicio)} — ${formatFecha(fin)}`} showLogout={false} />

      <div style={{ flex: 1, maxWidth: '1000px', margin: '0 auto', padding: '24px 16px', width: '100%' }}>
        {/* Encabezado */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '20px', marginBottom: '32px' }}>
          <div style={{ fontSize: '14px', color: '#6B6560', fontWeight: '600' }}>
            Revisado por: <span style={{ color: '#1A1714', fontWeight: '700' }}>{user?.nombre}</span>
          </div>
        </div>

        {/* CAJA 1 */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#1A1714', marginBottom: '20px', paddingBottom: '12px', borderBottom: '2px solid #E2DDD4' }}>
            🏥 CAJA 1 (CLÍNICA)
          </div>

          {dias.map((dia, idx) => (
            <CajaDiaSection key={idx} dia={dia} />
          ))}
        </div>

        {/* CAJA 2 */}
        <div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#1A1714', marginBottom: '20px', paddingBottom: '12px', borderBottom: '2px solid #E2DDD4' }}>
            💳 CAJA 2
          </div>

          {dias.map((dia, idx) => (
            <CajaDiaSection key={idx} dia={dia} />
          ))}
        </div>

        {/* Botón guardar */}
        <div style={{ marginTop: '32px' }}>
          <button style={{ width: '100%', padding: '14px', background: '#2a78a5', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
            💾 Guardar Revisión
          </button>
        </div>
      </div>
    </div>
  );
}

function CajaDiaSection({ dia }) {
  const [efectivo, setEfectivo] = useState({});
  const [bac, setBac] = useState('');
  const [bn, setBn] = useState('');

  const handleEfectivoChange = (denom, value) => {
    setEfectivo(prev => ({
      ...prev,
      [denom]: value === '' ? '' : parseInt(value) || 0
    }));
  };

  const calcularTotal = () => {
    let total = 0;
    DENOMS.forEach(d => {
      if (efectivo[d] !== '' && efectivo[d] !== undefined) {
        total += efectivo[d] * d;
      }
    });
    return total;
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '20px', marginBottom: '16px', overflow: 'hidden' }}>
      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid #E2DDD4' }}>
        📅 {formatFecha(dia)}
      </div>

      {/* EFECTIVO */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: '#2a78a5', marginBottom: '12px', textTransform: 'uppercase' }}>💵 Efectivo</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px' }}>
          {DENOMS.map(d => (
            <div key={d} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#6B6560', fontWeight: '600', minWidth: '55px' }}>{fmt(d)}:</span>
              <input
                type="number"
                value={efectivo[d] === '' ? '' : (efectivo[d] || 0)}
                onChange={(e) => handleEfectivoChange(d, e.target.value)}
                placeholder=" "
                style={{ width: '45px', padding: '6px 6px', border: '1px solid #E2DDD4', borderRadius: '4px', fontSize: '11px', textAlign: 'center' }}
              />
              {efectivo[d] !== '' && efectivo[d] !== undefined && (
                <span style={{ fontSize: '10px', color: '#2a78a5', fontWeight: '600', minWidth: '70px' }}>{fmt((efectivo[d] || 0) * d)}</span>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', display: 'block', marginBottom: '4px' }}>Dólares</label>
            <input type="number" placeholder=" " style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E2DDD4', borderRadius: '4px', fontSize: '11px' }} />
          </div>
          <div style={{ flex: 1, background: '#E8F3EC', padding: '10px', borderRadius: '4px', display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: '#6B6560', fontWeight: '600' }}>TOTAL</div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#2a78a5', fontFamily: "'DM Mono', monospace" }}>{fmt(calcularTotal())}</div>
          </div>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid #E2DDD4', margin: '16px 0' }} />

      {/* DATAFONOS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Datafono BAC (₡)</label>
          <input type="number" placeholder=" " value={bac} onChange={(e) => setBac(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E2DDD4', borderRadius: '4px', fontSize: '12px' }} />
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Datafono BN (₡)</label>
          <input type="number" placeholder=" " value={bn} onChange={(e) => setBn(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E2DDD4', borderRadius: '4px', fontSize: '12px' }} />
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid #E2DDD4', margin: '16px 0' }} />

      {/* TRANSACCIONES */}
      {[
        { label: '📱 SINPE', key: 'sinpe' },
        { label: '🏦 Transferencias', key: 'trans' },
        { label: '📤 Salidas de Caja', key: 'salida' }
      ].map(({ label, key }) => (
        <div key={key} style={{ marginBottom: '12px', padding: '12px', background: '#F7F5F0', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#2a78a5', marginBottom: '8px', textTransform: 'uppercase' }}>{label}</div>
          <div style={{ fontSize: '10px', color: '#9C9590', marginBottom: '8px' }}>[📷 Preview]</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <input type="text" placeholder="Monto" style={{ padding: '6px 10px', border: '1px solid #E2DDD4', borderRadius: '4px', fontSize: '11px' }} />
            <input type="text" placeholder="Ref./Desc." style={{ padding: '6px 10px', border: '1px solid #E2DDD4', borderRadius: '4px', fontSize: '11px' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '600' }}>
              <input type="checkbox" style={{ cursor: 'pointer' }} />
              ✓ OK
            </label>
            <button style={{ padding: '4px 8px', background: '#E8F3EC', color: '#2a78a5', border: 'none', borderRadius: '4px', fontSize: '10px', fontWeight: '600', cursor: 'pointer' }}>
              💬 Comentario
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
