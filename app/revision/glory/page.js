'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';

const fmt = n => '₡' + Math.round(n).toLocaleString('es-CR');

export default function RevisionGloryPage() {
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [cobros, setCobros] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    cargarCobros(mes);
  }, [mes]);

  async function cargarCobros(mesSeleccionado) {
    setLoading(true);
    try {
      const [año, mesNum] = mesSeleccionado.split('-');
      const inicio = `${año}-${mesNum}-01`;
      const fin = `${año}-${mesNum}-31`;

      const res = await fetch(`/api/cobros-glory?cobrado=true&inicio=${inicio}&fin=${fin}`);
      const data = await res.json();
      setCobros(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando cobros:', err);
    } finally {
      setLoading(false);
    }
  }

  const total = cobros.reduce((sum, c) => sum + (c.monto || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Header title="Revisión de Caja — Glory" subtitle="Cobros del período" showLogout={false} />

      <div style={{ flex: 1, maxWidth: '720px', margin: '0 auto', padding: '24px 16px', width: '100%' }}>

        {/* Selector de mes */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '24px', padding: '20px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Mes a revisar</label>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px' }}
          />
        </div>

        {/* Resumen */}
        <div style={{ background: '#FBF6E9', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '24px', padding: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '8px' }}>Total del período</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#C8A84B', fontFamily: "'DM Mono', monospace" }}>{fmt(total)}</div>
          <div style={{ fontSize: '12px', color: '#9C9590', marginTop: '8px' }}>{cobros.length} transacciones</div>
        </div>

        {/* Listado de cobros */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9C9590' }}>⏳ Cargando...</div>
        ) : cobros.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9C9590' }}>No hay cobros para este período</div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', overflow: 'hidden' }}>
            {cobros.map((cobro, i) => (
              <div key={cobro.id || i} style={{ padding: '16px 20px', borderBottom: i < cobros.length - 1 ? '1px solid #E2DDD4' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1714' }}>{cobro.nombre_mascota}</div>
                    <div style={{ fontSize: '11px', color: '#6B6560' }}>{cobro.nombre_dueno}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#C8A84B', fontFamily: "'DM Mono', monospace" }}>{fmt(cobro.monto)}</div>
                    <div style={{ fontSize: '11px', color: '#6B6560' }}>{cobro.metodo}</div>
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#9C9590' }}>
                  {cobro.cajera} • {new Date(cobro.hora_cobro).toLocaleDateString('es-CR')}
                  {cobro.unificado && <span style={{ marginLeft: '8px', background: '#FBF6E9', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>Unificado</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Botón volver */}
        <Link href="/revision" style={{ textDecoration: 'none' }}>
          <button
            style={{
              width: '100%',
              padding: '12px',
              background: '#F0EDE6',
              color: '#6B6560',
              border: '1.5px solid #E2DDD4',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              marginTop: '24px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#E2DDD4'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#F0EDE6'}
          >
            ← Volver al dashboard
          </button>
        </Link>
      </div>
    </div>
  );
}
