'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';

const generarPeriodos = () => {
  const hoy = new Date();
  const ano = hoy.getFullYear();
  const mes = hoy.getMonth() + 1;
  const ultimoDiaMes = new Date(ano, mes, 0).getDate();

  const periodos = [
    { num: 1, inicio: 1, fin: 5, color: '#FF6B6B' },
    { num: 2, inicio: 6, fin: 10, color: '#4ECDC4' },
    { num: 3, inicio: 11, fin: 15, color: '#45B7D1' },
    { num: 4, inicio: 16, fin: 20, color: '#FFA07A' },
    { num: 5, inicio: 21, fin: 25, color: '#98D8C8' },
    { num: 6, inicio: 26, fin: ultimoDiaMes, color: '#F7DC6F' },
  ];

  return periodos.map(p => {
    const inicio = new Date(ano, mes - 1, p.inicio);
    const fin = new Date(ano, mes - 1, p.fin);
    return {
      id: `${ano}-${String(mes).padStart(2, '0')}-P${p.num}`,
      num: p.num,
      inicio,
      fin,
      color: p.color
    };
  });
};

const obtenerPeriodoDelDia = (dia, periodos) => {
  return periodos.find(p => dia >= p.inicio.getDate() && dia <= p.fin.getDate());
};

const CalendarioPeriodos = ({ periodos, periodo, onSelectPeriodo }) => {
  const hoy = new Date();
  const ano = hoy.getFullYear();
  const mes = hoy.getMonth();
  const ultimoDiaMes = new Date(ano, mes + 1, 0).getDate();

  const nombreMes = new Date(ano, mes).toLocaleDateString('es-CR', { month: 'long', year: 'numeric' });
  const dias = [];

  for (let i = 1; i <= ultimoDiaMes; i++) {
    const fecha = new Date(ano, mes, i);
    const diaSemana = fecha.toLocaleDateString('es-CR', { weekday: 'short' });
    dias.push({ num: i, dia: diaSemana, fecha });
  }

  const diasLunes = dias.filter(d => d.dia === 'lun');
  const diasMartes = dias.filter(d => d.dia === 'mar');
  const diasMiercoles = dias.filter(d => d.dia === 'mié');
  const diasJueves = dias.filter(d => d.dia === 'jue');
  const diasViernes = dias.filter(d => d.dia === 'vie');

  const obtenerColor = (dia) => {
    const periodo = obtenerPeriodoDelDia(dia.num, periodos);
    return periodo ? periodo.color : '#E2DDD4';
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
      <div style={{ fontSize: '13px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '16px' }}>
        📅 {nombreMes.toUpperCase()}
      </div>

      {/* Encabezados */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '8px' }}>
        {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map(d => (
          <div key={d} style={{ fontSize: '11px', fontWeight: '600', color: '#1A1714', textAlign: 'center', paddingBottom: '8px', borderBottom: '2px solid #E2DDD4' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid de días */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
        {[diasLunes, diasMartes, diasMiercoles, diasJueves, diasViernes].map((columna, colIdx) => (
          columna.map((dia, rowIdx) => {
            const color = obtenerColor(dia.num);
            const periodoDelDia = obtenerPeriodoDelDia(dia.num, periodos);

            return (
              <div
                key={`${colIdx}-${rowIdx}`}
                style={{
                  padding: '12px',
                  background: color,
                  borderRadius: '6px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  border: periodo?.num === periodoDelDia?.num ? '2px solid #1A1714' : 'none',
                  transition: 'all 0.2s'
                }}
                onClick={() => periodoDelDia && onSelectPeriodo(periodoDelDia)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#1A1714' }}>{dia.num}</div>
                {periodoDelDia && (
                  <div style={{ fontSize: '9px', color: '#1A1714', marginTop: '2px', fontWeight: '700' }}>P{periodoDelDia.num}</div>
                )}
              </div>
            );
          })
        ))}
      </div>
    </div>
  );
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
        <CalendarioPeriodos periodos={periodos} periodo={periodo} onSelectPeriodo={setPeriodo} />

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
