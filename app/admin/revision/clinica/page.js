'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import CalendarioPeriodos from '../../../components/CalendarioPeriodos';
import FormularioRevision from '../../../components/FormularioRevision';

export default function RevisionClinicaPage() {
  const [periodo, setPeriodo] = useState(null);
  const [caja, setCaja] = useState('Caja 1 (clínica)');
  const [cajas] = useState(['Caja 1 (clínica)', 'Caja 2']);
  const [cierres, setCierres] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cierreEnRevision, setCierreEnRevision] = useState(null);

  useEffect(() => {
    const hoy = new Date();
    const diaHoy = hoy.getDate();
    const ano = hoy.getFullYear();
    const mes = hoy.getMonth();

    // Determinar qué período contiene hoy
    const PERIODOS = [
      { num: 1, inicio: 1, fin: 5 },
      { num: 2, inicio: 6, fin: 10 },
      { num: 3, inicio: 11, fin: 15 },
      { num: 4, inicio: 16, fin: 20 },
      { num: 5, inicio: 21, fin: 25 },
      { num: 6, inicio: 26, fin: 31 },
    ];
    const periodoActual = PERIODOS.find(p => diaHoy >= p.inicio && diaHoy <= p.fin);

    setPeriodo({
      num: periodoActual.num,
      inicio: new Date(ano, mes, periodoActual.inicio),
      fin: new Date(ano, mes, periodoActual.fin),
    });
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

  // Detectar el período actual (el que contiene hoy)
  const hoy = new Date();
  const diaHoy = hoy.getDate();
  const mesHoy = hoy.getMonth();
  const anoHoy = hoy.getFullYear();

  // Calcular cuál es el período que contiene hoy
  const PERIODOS_CALC = [
    { num: 1, inicio: 1, fin: 5 },
    { num: 2, inicio: 6, fin: 10 },
    { num: 3, inicio: 11, fin: 15 },
    { num: 4, inicio: 16, fin: 20 },
    { num: 5, inicio: 21, fin: 25 },
    { num: 6, inicio: 26, fin: 31 },
  ];
  const periodoActualNum = PERIODOS_CALC.find(p => diaHoy >= p.inicio && diaHoy <= p.fin)?.num;

  // esActual es true solo si el período seleccionado es el período actual (hoy) Y estamos en el mes actual
  const esActual = periodo &&
    periodo.num === periodoActualNum &&
    periodo.inicio.getMonth() === mesHoy &&
    periodo.inicio.getFullYear() === anoHoy;

  const cierresPendientes = cierres.filter(c => !c.revision_completada);
  const cierresRevisados = cierres.filter(c => c.revision_completada);

  if (cierreEnRevision) {
    return (
      <FormularioRevision
        cierre={cierreEnRevision}
        onVolver={() => setCierreEnRevision(null)}
        onGuardar={() => {
          setCierreEnRevision(null);
          cargarCierres();
        }}
      />
    );
  }

  const fmt = n => '₡' + Math.round(n).toLocaleString('es-CR');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Header title="Revisión — Cajas Clínica" subtitle="Revisa los cierres del período" showLogout={false} homeLink="/admin/revision" />

      <div style={{ flex: 1, maxWidth: '720px', margin: '0 auto', padding: '24px 16px', width: '100%' }}>
        <CalendarioPeriodos onSelectPeriodo={setPeriodo} />

        {/* Período y caja */}
        {periodo && (
          <>
            <div style={{
              background: esActual ? '#E8F3EC' : '#FDE8E8',
              border: `1px solid ${esActual ? '#27AE60' : '#E74C3C'}`,
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '6px' }}>
                Período seleccionado
              </div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: esActual ? '#27AE60' : '#E74C3C' }}>
                P{periodo.num}: {periodo.inicio.toLocaleDateString('es-CR')} — {periodo.fin.toLocaleDateString('es-CR')}
              </div>
            </div>

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
          </>
        )}

        {/* Cierres */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9C9590' }}>⏳ Cargando...</div>
        ) : (
          <>
            {/* Pendientes */}
            {cierresPendientes.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1714', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ⏳ Pendientes ({cierresPendientes.length})
                </div>
                <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', overflow: 'hidden' }}>
                  {cierresPendientes.map((cierre, i) => {
                    const totalEnCaja = cierre.c_20000 * 20000 + cierre.c_10000 * 10000 + cierre.c_5000 * 5000 + cierre.c_2000 * 2000 + cierre.c_1000 * 1000 + cierre.c_500 * 500 + cierre.c_100 * 100 + cierre.c_50 * 50 + cierre.c_25 * 25 + cierre.c_10 * 10 + cierre.c_5 * 5;

                    return (
                      <div key={cierre.id} style={{ padding: '16px 20px', borderBottom: i < cierresPendientes.length - 1 ? '1px solid #E2DDD4' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1714' }}>{cierre.cajera}</div>
                            <div style={{ fontSize: '11px', color: '#9C9590' }}>
                              {new Date(cierre.fecha_hora).toLocaleDateString('es-CR')} — {new Date(cierre.fecha_hora).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <button
                            onClick={() => setCierreEnRevision(cierre)}
                            style={{
                              padding: '8px 16px',
                              background: '#2a78a5',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            Revisar
                          </button>
                        </div>
                        <div style={{ fontSize: '11px', color: '#6B6560', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div>💵 En caja: {fmt(totalEnCaja)}</div>
                          <div>🏧 Tarjetas: {fmt(cierre.tarjeta_bac + cierre.tarjeta_bn)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Revisados */}
            {cierresRevisados.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1714', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ✅ Revisados ({cierresRevisados.length})
                </div>
                <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', overflow: 'hidden' }}>
                  {cierresRevisados.map((cierre, i) => {
                    const totalEnCaja = cierre.c_20000 * 20000 + cierre.c_10000 * 10000 + cierre.c_5000 * 5000 + cierre.c_2000 * 2000 + cierre.c_1000 * 1000 + cierre.c_500 * 500 + cierre.c_100 * 100 + cierre.c_50 * 50 + cierre.c_25 * 25 + cierre.c_10 * 10 + cierre.c_5 * 5;

                    return (
                      <div key={cierre.id} style={{ padding: '16px 20px', borderBottom: i < cierresRevisados.length - 1 ? '1px solid #E2DDD4' : 'none', opacity: 0.6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
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
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {cierres.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#9C9590' }}>No hay cierres para este período</div>
            )}
          </>
        )}

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
