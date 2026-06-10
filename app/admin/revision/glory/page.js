'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../../../components/Header';
import CalendarioPeriodos from '../../../components/CalendarioPeriodos';
import FormularioRevisionGlory from '../../../components/FormularioRevisionGlory';

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
  const [diaEnRevision, setDiaEnRevision] = useState(null);
  const [cajerasRevisadas, setCajerasRevisadas] = useState(new Set());
  const [cobrosPorDia, setCobrosPorDia] = useState({});
  const [comparativoActivo, setComparativoActivo] = useState(null);

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

      // Cargar cajas revisadas
      try {
        const revisRes = await fetch('/api/revision-caja-glory-ids');
        if (revisRes.ok) {
          const revisadas = await revisRes.json();
          const cajasRevisadas = new Set(revisadas.map(r => `${r.fecha}-${r.cajera}`));
          setCajerasRevisadas(cajasRevisadas);
        }
      } catch (err) {
        console.error('Error loading reviewed cajas:', err);
      }

      // Agrupar por día y cajera
      const agrupado = {};
      (Array.isArray(data) ? data : []).forEach(cobro => {
        // cobro.fecha es DATE, ya está en CR — no pasar por new Date() para evitar shift de timezone
        const fechaObj = new Date(`${cobro.fecha}T00:00:00`);
        const fecha = fechaObj.toLocaleDateString('es-CR');
        if (!agrupado[fecha]) agrupado[fecha] = {};
        if (!agrupado[fecha][cobro.cajera]) agrupado[fecha][cobro.cajera] = [];
        agrupado[fecha][cobro.cajera].push(cobro);
      });
      setCobrosPorDia(agrupado);
    } catch (err) {
      console.error('Error cargando cobros:', err);
    } finally {
      setLoading(false);
    }
  }

  if (diaEnRevision) {
    return (
      <FormularioRevisionGlory
        fecha={diaEnRevision.fecha}
        cajera={diaEnRevision.cajera}
        cobros={diaEnRevision.cobros}
        periodo={periodo}
        onVolver={() => setDiaEnRevision(null)}
        onGuardar={() => {
          setDiaEnRevision(null);
          cargarCobros();
        }}
      />
    );
  }

  const fmt = n => '₡' + Math.round(n).toLocaleString('es-CR');

  // Cargar revisión cuando se abre el comparativo
  const [revisionActual, setRevisionActual] = useState(null);
  const [loadingRev, setLoadingRev] = useState(false);

  const abrirComparativo = async (fecha, cajera) => {
    setLoadingRev(true);
    try {
      const res = await fetch(`/api/revisionGlory?fecha=${fecha}&cajera=${cajera}`);
      if (res.ok) {
        const data = await res.json();
        setRevisionActual(data);
      }
    } catch (err) {
      console.error('Error cargando revisión:', err);
    } finally {
      setLoadingRev(false);
    }
  };

  if (comparativoActivo && revisionActual) {
    const totalCajera = revisionActual.total_cajera || 0;
    const totalRevisora = revisionActual.total_revisado || 0;
    const diferencia = Math.abs(totalCajera - totalRevisora);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
        <Header title="Comparativo — Glory" subtitle={`${comparativoActivo} • ${revisionActual.cajera}`} showLogout={false} homeLink="#" />

        <div style={{ flex: 1, maxWidth: '720px', margin: '0 auto', padding: '24px 16px', width: '100%' }}>
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#1A1714', marginBottom: '20px' }}>
              📊 Comparativo por Día
            </div>

            {/* Comparación de totales */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div style={{ background: '#FBF6E9', border: '1px solid #C8A84B', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Lo que cobró la cajera
                </div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#C8A84B', fontFamily: "'DM Mono', monospace" }}>
                  {fmt(totalCajera)}
                </div>
              </div>

              <div style={{ background: '#E8F3EC', border: '1px solid #27AE60', borderRadius: '8px', padding: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Lo que contó la revisora
                </div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#27AE60', fontFamily: "'DM Mono', monospace" }}>
                  {fmt(totalRevisora)}
                </div>
              </div>
            </div>

            {/* Estado */}
            <div style={{
              background: diferencia === 0 ? '#E8F3EC' : '#FDE8E8',
              border: `1px solid ${diferencia === 0 ? '#27AE60' : '#E74C3C'}`,
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '8px' }}>
                Estado
              </div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: diferencia === 0 ? '#27AE60' : '#E74C3C' }}>
                {diferencia === 0 ? '✅ Coinciden perfectamente' : `⚠️ Diferencia: ${fmt(diferencia)}`}
              </div>
            </div>

            {/* Detalles de la revisión */}
            <div style={{ background: '#f9f9f9', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '12px' }}>
                Detalles
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div>
                  <div style={{ color: '#9C9590', marginBottom: '4px' }}>Revisora</div>
                  <div style={{ fontWeight: '600', color: '#1A1714' }}>{revisionActual.revisora}</div>
                </div>
                <div>
                  <div style={{ color: '#9C9590', marginBottom: '4px' }}>Hora de cierre</div>
                  <div style={{ fontWeight: '600', color: '#1A1714' }}>{revisionActual.hora_revision || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ color: '#9C9590', marginBottom: '4px' }}>Efectivo revisado</div>
                  <div style={{ fontWeight: '600', color: '#1A1714' }}>{fmt(revisionActual.efectivo_revisado || 0)}</div>
                </div>
                <div>
                  <div style={{ color: '#9C9590', marginBottom: '4px' }}>Datafono (BAC)</div>
                  <div style={{ fontWeight: '600', color: '#1A1714' }}>{fmt(revisionActual.bac_revisado || 0)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Botón volver */}
          <button
            onClick={() => {
              setComparativoActivo(null);
              setRevisionActual(null);
            }}
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
            ← Volver
          </button>
        </div>
      </div>
    );
  }

  // Agrupar días por estado (pendientes/revisados)
  const diasOrdenados = Object.keys(cobrosPorDia).sort((a, b) => new Date(a) - new Date(b));
  const diasPendientes = [];
  const diasRevisados = [];

  diasOrdenados.forEach(fecha => {
    const cajerasEnDia = Object.keys(cobrosPorDia[fecha]);
    const allRevisadas = cajerasEnDia.every(cajera => cajerasRevisadas.has(`${fecha}-${cajera}`));

    if (allRevisadas) {
      diasRevisados.push(fecha);
    } else {
      diasPendientes.push(fecha);
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Header title="Revisión — Caja Glory" subtitle="Revisa los cobros del período" showLogout={false} homeLink="/admin/revision" />

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

        {/* Cierres */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9C9590' }}>⏳ Cargando...</div>
        ) : (
          <>
            {/* Pendientes */}
            {diasPendientes.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1714', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ⏳ Pendientes ({diasPendientes.length})
                </div>
                <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', overflow: 'hidden' }}>
                  {diasPendientes.map((fecha, idx) => {
                    const cajerasEnDia = Object.keys(cobrosPorDia[fecha]);
                    const totalDia = cajerasEnDia.reduce((sum, cajera) => {
                      return sum + cobrosPorDia[fecha][cajera].reduce((s, c) => s + (c.monto || 0), 0);
                    }, 0);

                    return (
                      <div key={fecha} style={{ padding: '16px 20px', borderBottom: idx < diasPendientes.length - 1 ? '1px solid #E2DDD4' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '16px', fontWeight: '700', color: '#1A1714', marginBottom: '4px' }}>
                              {fecha}
                            </div>
                            <div style={{ fontSize: '12px', color: '#9C9590' }}>
                              {cajerasEnDia.join(', ')}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', marginRight: '16px' }}>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#C8A84B' }}>
                              {fmt(totalDia)}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const cajera = cajerasEnDia[0];
                              setDiaEnRevision({
                                fecha,
                                cajera,
                                cobros: cobrosPorDia[fecha][cajera] || [],
                              });
                            }}
                            style={{
                              padding: '8px 16px',
                              background: '#C8A84B',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              whiteSpace: 'nowrap'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#A88A38'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#C8A84B'}
                          >
                            Revisar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Revisados */}
            {diasRevisados.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1714', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ✅ Revisados ({diasRevisados.length})
                </div>
                <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', overflow: 'hidden' }}>
                  {diasRevisados.map((fecha, idx) => {
                    const cajerasEnDia = Object.keys(cobrosPorDia[fecha]);
                    const totalDia = cajerasEnDia.reduce((sum, cajera) => {
                      return sum + cobrosPorDia[fecha][cajera].reduce((s, c) => s + (c.monto || 0), 0);
                    }, 0);

                    return (
                      <div
                        key={fecha}
                        style={{
                          padding: '16px 20px',
                          borderBottom: idx < diasRevisados.length - 1 ? '1px solid #E2DDD4' : 'none',
                          opacity: 0.7,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => {
                          const cajera = cajerasEnDia[0];
                          setComparativoActivo(fecha);
                          abrirComparativo(fecha, cajera);
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f9f9f9'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '16px', fontWeight: '700', color: '#1A1714', marginBottom: '4px' }}>
                              {fecha}
                            </div>
                            <div style={{ fontSize: '12px', color: '#9C9590' }}>
                              {cajerasEnDia.join(', ')}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1714' }}>
                              {fmt(totalDia)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {diasOrdenados.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#9C9590' }}>No hay cobros para este período</div>
            )}
          </>
        )}

        {/* Botón volver */}
        <Link href="/admin/revision" style={{ textDecoration: 'none' }}>
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
            ← Volver
          </button>
        </Link>
      </div>
    </div>
  );
}
