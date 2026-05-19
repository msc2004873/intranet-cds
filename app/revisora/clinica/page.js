'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import CalendarioPeriodos from '../../components/CalendarioPeriodos';

const generarPeriodos = () => {
  const hoy = new Date();
  const ano = hoy.getFullYear();
  const mes = hoy.getMonth() + 1;
  const ultimoDiaMes = new Date(ano, mes, 0).getDate();

  const periodos = [
    { num: 1, inicio: 1, fin: 5 },
    { num: 2, inicio: 6, fin: 10 },
    { num: 3, inicio: 11, fin: 15 },
    { num: 4, inicio: 16, fin: 20 },
    { num: 5, inicio: 21, fin: 25 },
    { num: 6, inicio: 26, fin: ultimoDiaMes },
  ];

  return periodos.map(p => {
    const inicio = new Date(ano, mes - 1, p.inicio);
    const fin = new Date(ano, mes - 1, p.fin);
    return {
      num: p.num,
      inicio,
      fin,
    };
  });
};

export default function RevisionClinicaPage() {
  const [periodos, setPeriodos] = useState([]);
  const [periodo, setPeriodo] = useState(null);
  const [caja, setCaja] = useState('Caja 1 (clínica)');
  const [cajas] = useState(['Caja 1 (clínica)', 'Caja 2']);
  const [cierres, setCierres] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const p = generarPeriodos();
    setPeriodos(p);
    setPeriodo(p[0]);
  }, []);

  useEffect(() => {
    if (periodo) {
      cargarCierres();
    }
  }, [periodo, caja]);

  async function cargarCierres() {
    if (!periodo) return;

    setLoading(true);
    try {
      const inicio = periodo.inicio.toISOString().split('T')[0];
      const fin = periodo.fin.toISOString().split('T')[0];

      const res = await fetch(`/api/cierreCaja?fecha=${inicio}&hasta=${fin}&caja=${encodeURIComponent(caja)}`);
      const data = await res.json();
      setCierres(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando cierres:', err);
    } finally {
      setLoading(false);
    }
  }

  const fmt = n => '₡' + Math.round(n).toLocaleString('es-CR');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Header title="Revisión — Cajas Clínica" subtitle="Revisa los cierres del período" showLogout={false} />

      <div style={{ flex: 1, maxWidth: '720px', margin: '0 auto', padding: '24px 16px', width: '100%' }}>

        {/* Calendario */}
        <CalendarioPeriodos onSelectPeriodo={setPeriodo} />

        {/* Período actual */}
        {periodo && (
          <div style={{ background: '#E8F3EC', border: '1px solid #2a78a5', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '6px' }}>
              Período seleccionado
            </div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#2a78a5' }}>
              P{periodo.num}: {periodo.inicio.toLocaleDateString('es-CR')} — {periodo.fin.toLocaleDateString('es-CR')}
            </div>
          </div>
        )}

        {/* Selector de caja */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
            Caja a revisar
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {cajas.map(c => (
              <button
                key={c}
                onClick={() => setCaja(c)}
                style={{
                  padding: '10px',
                  background: caja === c ? '#2a78a5' : '#F0EDE6',
                  color: caja === c ? 'white' : '#6B6560',
                  border: '1.5px solid ' + (caja === c ? '#2a78a5' : '#E2DDD4'),
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Cierres */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9C9590' }}>⏳ Cargando...</div>
        ) : cierres.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9C9590' }}>No hay cierres para este período</div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', overflow: 'hidden' }}>
            {cierres.map((cierre, i) => {
              const totalEnCaja = cierre.c_20000 * 20000 + cierre.c_10000 * 10000 + cierre.c_5000 * 5000 + cierre.c_2000 * 2000 + cierre.c_1000 * 1000 + cierre.c_500 * 500 + cierre.c_100 * 100 + cierre.c_50 * 50 + cierre.c_25 * 25 + cierre.c_10 * 10 + cierre.c_5 * 5;

              return (
                <div key={cierre.id} style={{ padding: '16px 20px', borderBottom: i < cierres.length - 1 ? '1px solid #E2DDD4' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1714' }}>{cierre.cajera}</div>
                      <div style={{ fontSize: '11px', color: '#9C9590' }}>
                        {new Date(cierre.fecha_hora).toLocaleDateString('es-CR')} — {new Date(cierre.fecha_hora).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
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
        )}

        {/* Botón volver */}
        <Link href="/revisora" style={{ textDecoration: 'none' }}>
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
