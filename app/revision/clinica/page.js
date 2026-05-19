'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';

const fmt = n => '₡' + Math.round(n).toLocaleString('es-CR');

export default function RevisionClinicaPage() {
  const [fecha, setFecha] = useState('');
  const [cajas, setCajas] = useState([]);
  const [cierres, setCierres] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hoy = new Date().toISOString().split('T')[0];
    setFecha(hoy);
    cargarDatos(hoy);
  }, []);

  async function cargarDatos(fechaSeleccionada) {
    setLoading(true);
    try {
      const res = await fetch(`/api/cierreCaja?fecha=${fechaSeleccionada}`);
      const data = await res.json();

      // Agrupar por caja
      const porCaja = {};
      if (Array.isArray(data)) {
        data.forEach(cierre => {
          if (!porCaja[cierre.caja]) {
            porCaja[cierre.caja] = [];
          }
          porCaja[cierre.caja].push(cierre);
        });
      }

      setCajas(Object.keys(porCaja).sort());
      setCierres(porCaja);
    } catch (err) {
      console.error('Error cargando cierres:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Header title="Revisión de Cajas — Clínica" subtitle="Verifica los cierres del período" showLogout={false} />

      <div style={{ flex: 1, maxWidth: '720px', margin: '0 auto', padding: '24px 16px', width: '100%' }}>

        {/* Selector de fecha */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '24px', padding: '20px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Fecha a revisar</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => {
              setFecha(e.target.value);
              cargarDatos(e.target.value);
            }}
            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px' }}
          />
        </div>

        {/* Cierres por caja */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9C9590' }}>⏳ Cargando...</div>
        ) : cajas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9C9590' }}>No hay cierres para esta fecha</div>
        ) : (
          cajas.map(caja => (
            <div key={caja} style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '24px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', background: '#F0EDE6', borderBottom: '1px solid #E2DDD4', fontWeight: '600', color: '#1A1714' }}>
                📦 {caja}
              </div>
              <div style={{ padding: '20px' }}>
                {cierres[caja]?.map(cierre => {
                  const totalEnCaja = cierre.c_20000 * 20000 + cierre.c_10000 * 10000 + cierre.c_5000 * 5000 + cierre.c_2000 * 2000 + cierre.c_1000 * 1000 + cierre.c_500 * 500 + cierre.c_100 * 100 + cierre.c_50 * 50 + cierre.c_25 * 25 + cierre.c_10 * 10 + cierre.c_5 * 5;
                  return (
                    <div key={cierre.id} style={{ paddingBottom: '20px', borderBottom: '1px solid #E2DDD4' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1714' }}>{cierre.cajera}</div>
                          <div style={{ fontSize: '11px', color: '#9C9590' }}>{new Date(cierre.fecha_hora).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#2a78a5', fontFamily: "'DM Mono', monospace" }}>{fmt(totalEnCaja)}</div>
                          <div style={{ fontSize: '11px', color: '#9C9590' }}>Total en caja</div>
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', color: '#6B6560', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>🏧 Tarjetas: {fmt(cierre.tarjeta_bac + cierre.tarjeta_bn)}</div>
                        <div>💵 Dólares: ${cierre.dolares_total?.toFixed(2)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
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
