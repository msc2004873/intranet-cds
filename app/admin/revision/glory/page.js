'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import CalendarioPeriodos from '../../../components/CalendarioPeriodos';

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

export default function RevisionGloryPage() {
  const [periodo, setPeriodo] = useState(null);
  const [cobros, setCobros] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const p = generarPeriodos();
    setPeriodo(p[0]);
  }, []);

  useEffect(() => {
    if (periodo) {
      cargarCobros();
    }
  }, [periodo]);

  async function cargarCobros() {
    if (!periodo) return;

    setLoading(true);
    try {
      const inicio = periodo.inicio.toISOString().split('T')[0];
      const fin = periodo.fin.toISOString().split('T')[0];

      const res = await fetch(`/api/cobros-glory?cobrado=true&inicio=${inicio}&fin=${fin}`);
      const data = await res.json();
      setCobros(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando cobros:', err);
    } finally {
      setLoading(false);
    }
  }

  const fmt = n => '₡' + Math.round(n).toLocaleString('es-CR');
  const total = cobros.reduce((sum, c) => sum + (c.monto || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Header title="Revisión — Caja Glory" subtitle="Revisa los cobros del período" showLogout={false} />

      <div style={{ flex: 1, maxWidth: '720px', margin: '0 auto', padding: '24px 16px', width: '100%' }}>

        {/* Calendario */}
        <CalendarioPeriodos onSelectPeriodo={setPeriodo} />

        {/* Período actual */}
        {periodo && (
          <div style={{ background: '#FBF6E9', border: '1px solid #C8A84B', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '6px' }}>
              Período seleccionado
            </div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#C8A84B' }}>
              P{periodo.num}: {periodo.inicio.toLocaleDateString('es-CR')} — {periodo.fin.toLocaleDateString('es-CR')}
            </div>
          </div>
        )}

        {/* Resumen */}
        <div style={{ background: '#FBF6E9', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '6px' }}>
            Total del período
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#C8A84B', fontFamily: "'DM Mono', monospace" }}>{fmt(total)}</div>
          <div style={{ fontSize: '11px', color: '#9C9590', marginTop: '6px' }}>{cobros.length} transacciones</div>
        </div>

        {/* Cobros */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9C9590' }}>⏳ Cargando...</div>
        ) : cobros.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9C9590' }}>No hay cobros para este período</div>
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
