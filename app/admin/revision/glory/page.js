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
  const [revisionActual, setRevisionActual] = useState(null);
  const [loadingRev, setLoadingRev] = useState(false);
  const [revisionesMes, setRevisionesMes] = useState([]);

  useEffect(() => {
    const hoy = new Date();
    const diaHoy = hoy.getDate();
    const periodos = [
      { num: 1, inicio: 1, fin: 5 },
      { num: 2, inicio: 6, fin: 10 },
      { num: 3, inicio: 11, fin: 15 },
      { num: 4, inicio: 16, fin: 20 },
      { num: 5, inicio: 21, fin: 25 },
      { num: 6, inicio: 26, fin: 31 },
    ];
    const periodoActual = periodos.find(p => diaHoy >= p.inicio && diaHoy <= p.fin);

    const p = generarPeriodos();
    const periodoIndex = periodoActual ? periodoActual.num - 1 : 0;
    setPeriodo(p[periodoIndex]);
  }, []);

  useEffect(() => {
    if (periodo) {
      cargarCobros();
    }
  }, [periodo]);

  const fmt = n => '₡' + Math.round(n).toLocaleString('es-CR');
  const fmtFecha = (isoFecha) => new Date(`${isoFecha}T00:00:00`).toLocaleDateString('es-CR');

  async function cargarResumenMes() {
    const hoy = new Date();
    const mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    try {
      const res = await fetch(`/api/revisionGlory?mes=${mes}`);
      if (res.ok) setRevisionesMes(await res.json());
    } catch (err) {
      console.error('Error cargando resumen mes:', err);
    }
  }

  async function cargarCobros() {
    if (!periodo) return;

    setLoading(true);
    try {
      const inicio = periodo.inicio.toISOString().split('T')[0];
      const fin = periodo.fin.toISOString().split('T')[0];

      const res = await fetch(`/api/cobros-glory?cobrado=true&inicio=${inicio}&fin=${fin}`);
      const data = await res.json();
      setCobros(Array.isArray(data) ? data : []);

      // Cargar cajas revisadas y resumen del mes en paralelo
      try {
        const [revisRes] = await Promise.all([
          fetch('/api/revision-caja-glory-ids'),
          cargarResumenMes(),
        ]);
        if (revisRes.ok) {
          const revisadas = await revisRes.json();
          const cajasRevisadas = new Set(revisadas.map(r => r.fecha));
          setCajerasRevisadas(cajasRevisadas);
        }
      } catch (err) {
        console.error('Error loading reviewed cajas:', err);
      }

      // Agrupar por día y cajera — usar ISO como key para que coincida con revision_glory
      const agrupado = {};
      (Array.isArray(data) ? data : []).forEach(cobro => {
        const fecha = cobro.fecha; // ISO: "2026-06-01"
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

  const abrirComparativo = async (fecha, cajera) => {
    setLoadingRev(true);
    try {
      const res = await fetch(`/api/revisionGlory?fecha=${fecha}`);
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
    const rv = revisionActual;
    const totalCajera = rv.total_cajera || 0;
    const totalRevisora = rv.total_revisado || 0;
    const diferencia = totalCajera - totalRevisora;
    const difAbs = Math.abs(diferencia);

    const filas = [
      { label: 'Efectivo',      cajera: null, revisora: rv.efectivo_revisado || 0 },
      { label: 'Datafono BAC',  cajera: null, revisora: rv.datafono_glory || 0 },
      { label: 'SINPE',         cajera: null, revisora: rv.sinpe_revisado || 0 },
      { label: 'Transferencias',cajera: null, revisora: rv.transferencias_revisadas || 0 },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
        <Header title="Revisión Glory" subtitle={`${fmtFecha(comparativoActivo)} • ${rv.cajera}`} showLogout={false} homeLink="#" />

        <div style={{ flex: 1, maxWidth: '720px', margin: '0 auto', padding: '24px 16px', width: '100%' }}>

          {/* Totales */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: '#FBF6E9', border: '1px solid #C8A84B', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#9C9590', textTransform: 'uppercase', marginBottom: '6px' }}>Cajera cobró</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#C8A84B', fontFamily: "'DM Mono', monospace" }}>{fmt(totalCajera)}</div>
            </div>
            <div style={{ background: '#E8F3EC', border: '1px solid #27AE60', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#9C9590', textTransform: 'uppercase', marginBottom: '6px' }}>Revisora contó</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#27AE60', fontFamily: "'DM Mono', monospace" }}>{fmt(totalRevisora)}</div>
            </div>
          </div>

          {/* Estado */}
          <div style={{ background: difAbs === 0 ? '#E8F3EC' : '#FDE8E8', border: `1px solid ${difAbs === 0 ? '#27AE60' : '#E74C3C'}`, borderRadius: '12px', padding: '14px 18px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: difAbs === 0 ? '#27AE60' : '#E74C3C' }}>
              {difAbs === 0 ? '✅ Coinciden perfectamente' : `⚠️ Diferencia de ${fmt(difAbs)}`}
            </span>
            {difAbs > 0 && (
              <span style={{ fontSize: '12px', color: '#E74C3C', fontWeight: '600' }}>
                {diferencia > 0 ? 'Cajera cobró más' : 'Revisora contó más'}
              </span>
            )}
          </div>

          {/* Desglose por método */}
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', background: '#F0EDE6', borderBottom: '1px solid #E2DDD4' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#9C9590', textTransform: 'uppercase' }}>Método</div>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#9C9590', textTransform: 'uppercase', textAlign: 'right' }}>Cajera</div>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#9C9590', textTransform: 'uppercase', textAlign: 'right' }}>Revisora</div>
              </div>
            </div>
            {filas.map(({ label, revisora: r }) => (
              <div key={label} style={{ padding: '12px 20px', borderBottom: '1px solid #F0EDE6', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
                <div style={{ fontSize: '13px', color: '#6B6560' }}>{label}</div>
                <div style={{ fontSize: '13px', color: '#9C9590', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>—</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1714', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>{fmt(r)}</div>
              </div>
            ))}
          </div>

          {/* Meta */}
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', background: '#F0EDE6', borderBottom: '1px solid #E2DDD4', fontSize: '13px', fontWeight: '600', color: '#1A1714' }}>Datos de revisión</div>
            <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
              <div>
                <div style={{ color: '#9C9590', marginBottom: '3px', fontSize: '11px', textTransform: 'uppercase', fontWeight: '600' }}>Cajeras</div>
                <div style={{ fontWeight: '600', color: '#1A1714' }}>{rv.cajera}</div>
              </div>
              <div>
                <div style={{ color: '#9C9590', marginBottom: '3px', fontSize: '11px', textTransform: 'uppercase', fontWeight: '600' }}>Revisora</div>
                <div style={{ fontWeight: '600', color: '#1A1714' }}>{rv.revisora}</div>
              </div>
              <div>
                <div style={{ color: '#9C9590', marginBottom: '3px', fontSize: '11px', textTransform: 'uppercase', fontWeight: '600' }}>Hora</div>
                <div style={{ fontWeight: '600', color: '#1A1714' }}>{rv.hora_revision || '—'}</div>
              </div>
              <div>
                <div style={{ color: '#9C9590', marginBottom: '3px', fontSize: '11px', textTransform: 'uppercase', fontWeight: '600' }}>Fecha revisión</div>
                <div style={{ fontWeight: '600', color: '#1A1714' }}>{rv.created_at ? new Date(rv.created_at).toLocaleDateString('es-CR') : '—'}</div>
              </div>
            </div>
            {rv.comentario && (
              <div style={{ padding: '0 20px 16px', borderTop: '1px solid #F0EDE6', paddingTop: '12px' }}>
                <div style={{ color: '#9C9590', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase', fontWeight: '600' }}>Comentario</div>
                <div style={{ fontSize: '13px', color: '#1A1714', background: '#FBF6E9', borderRadius: '8px', padding: '10px 12px', border: '1px solid #E8D99A' }}>{rv.comentario}</div>
              </div>
            )}
          </div>

          <button
            onClick={() => { setComparativoActivo(null); setRevisionActual(null); }}
            style={{ width: '100%', padding: '12px', background: '#F0EDE6', color: '#6B6560', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#E2DDD4'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#F0EDE6'}
          >
            ← Volver
          </button>
        </div>
      </div>
    );
  }

  const revisionBloqueada = (() => {
    if (!periodo) return true;
    const hoy = new Date();
    const hoyNorm = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const ano = periodo.inicio.getFullYear();
    const mes = periodo.inicio.getMonth();
    const apertura = periodo.num < 6
      ? new Date(ano, mes, [6, 11, 16, 21, 26][periodo.num - 1])
      : new Date(ano, mes + 1, 1);
    return hoyNorm < apertura;
  })();

  // Agrupar días por estado (pendientes/revisados)
  const diasOrdenados = Object.keys(cobrosPorDia).sort((a, b) => {
    return new Date(a) - new Date(b); // keys son ISO "2026-06-01"
  });
  const diasPendientes = [];
  const diasRevisados = [];

  diasOrdenados.forEach(fecha => {
    const cajerasEnDia = Object.keys(cobrosPorDia[fecha]);
    const allRevisadas = cajerasRevisadas.has(fecha);

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
          <div style={{
            background: revisionBloqueada ? '#FFF3CD' : '#FBF6E9',
            border: `1px solid ${revisionBloqueada ? '#F39C12' : '#C8A84B'}`,
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px'
          }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '6px' }}>
              Período seleccionado
            </div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: revisionBloqueada ? '#F39C12' : '#C8A84B' }}>
              P{periodo.num}: {periodo.inicio.toLocaleDateString('es-CR')} — {periodo.fin.toLocaleDateString('es-CR')}
              {revisionBloqueada && <span style={{ fontSize: '13px', marginLeft: '8px' }}>⏳ En curso</span>}
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
                  {revisionBloqueada && <span style={{ fontSize: '11px', fontWeight: '500', color: '#F39C12' }}>— período en curso</span>}
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
                              {fmtFecha(fecha)}
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
                          {revisionBloqueada ? (
                            <span style={{
                              padding: '8px 16px',
                              background: '#FFF3CD',
                              color: '#F39C12',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              whiteSpace: 'nowrap'
                            }}>
                              ⏳ En curso
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                const todosCobros = cajerasEnDia.flatMap(c => cobrosPorDia[fecha][c] || []);
                                setDiaEnRevision({
                                  fecha,
                                  cajera: cajerasEnDia.join(' / '),
                                  cobros: todosCobros,
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
                          )}
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
                      <div key={fecha} style={{ padding: '16px 20px', borderBottom: idx < diasRevisados.length - 1 ? '1px solid #E2DDD4' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '16px', fontWeight: '700', color: '#1A1714', marginBottom: '4px' }}>
                              {fmtFecha(fecha)}
                            </div>
                            <div style={{ fontSize: '12px', color: '#9C9590' }}>
                              {cajerasEnDia.join(', ')}
                            </div>
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: '#27AE60', marginRight: '12px', fontFamily: "'DM Mono', monospace" }}>
                            {fmt(totalDia)}
                          </div>
                          <button
                            onClick={() => { setComparativoActivo(fecha); abrirComparativo(fecha, cajerasEnDia.join(' / ')); }}
                            style={{ padding: '8px 16px', background: '#E8F3EC', color: '#27AE60', border: '1.5px solid #27AE60', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#d4edda'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#E8F3EC'}
                          >
                            Ver
                          </button>
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

        {/* Resumen del mes */}
        {revisionesMes.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1714', marginBottom: '12px' }}>
              📅 Resumen del mes ({new Date().toLocaleDateString('es-CR', { month: 'long', year: 'numeric' })})
            </div>
            {revisionesMes.map((rev, idx) => {
              const tieneCajeraDetalle = (rev.efectivo_cajera || 0) + (rev.datafono_cajera || 0) + (rev.sinpe_cajera || 0) + (rev.transferencias_cajera || 0) > 0;
              const metodos = [
                { label: 'Efectivo',       cajera: rev.efectivo_cajera || 0,       revisora: rev.efectivo_revisado || 0 },
                { label: 'Datafono BAC',   cajera: rev.datafono_cajera || 0,       revisora: rev.datafono_glory || 0 },
                { label: 'SINPE',          cajera: rev.sinpe_cajera || 0,          revisora: rev.sinpe_revisado || 0 },
                { label: 'Transferencias', cajera: rev.transferencias_cajera || 0, revisora: rev.transferencias_revisadas || 0 },
              ];
              const difTotal = (rev.total_cajera || 0) - (rev.total_revisado || 0);

              return (
                <div key={rev.id || idx} style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '12px', overflow: 'hidden' }}>
                  {/* Header del día */}
                  <div style={{ padding: '12px 16px', background: '#F0EDE6', borderBottom: '1px solid #E2DDD4', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1714' }}>{fmtFecha(rev.fecha)}</div>
                      <div style={{ fontSize: '11px', color: '#6B6560', marginTop: '2px' }}>
                        <span style={{ fontWeight: '600' }}>Cajeras:</span> {rev.cajera} &nbsp;·&nbsp; <span style={{ fontWeight: '600' }}>Revisora:</span> {rev.revisora}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: Math.abs(difTotal) === 0 ? '#27AE60' : '#E74C3C' }}>
                        {Math.abs(difTotal) === 0 ? '✅ Sin diferencia' : `⚠️ Dif: ${fmt(Math.abs(difTotal))}`}
                      </div>
                      {rev.hora_revision && <div style={{ fontSize: '11px', color: '#9C9590', marginTop: '2px' }}>Revisado a las {rev.hora_revision}</div>}
                    </div>
                  </div>

                  {/* Filas por método */}
                  <div style={{ padding: '0 16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px', gap: '8px', padding: '8px 0', borderBottom: '1px solid #F0EDE6' }}>
                      {['Método', 'Cajera', 'Revisora', 'Dif'].map(h => (
                        <div key={h} style={{ fontSize: '10px', fontWeight: '700', color: '#9C9590', textTransform: 'uppercase' }}>{h}</div>
                      ))}
                    </div>
                    {metodos.map(({ label, cajera: c, revisora: r }) => {
                      const d = tieneCajeraDetalle ? c - r : null;
                      return (
                        <div key={label} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px', gap: '8px', padding: '8px 0', borderBottom: '1px solid #F0EDE6', alignItems: 'center' }}>
                          <div style={{ fontSize: '12px', color: '#6B6560' }}>{label}</div>
                          <div style={{ fontSize: '12px', fontFamily: "'DM Mono', monospace", color: tieneCajeraDetalle ? '#1A1714' : '#C0BAB5' }}>
                            {tieneCajeraDetalle ? fmt(c) : '—'}
                          </div>
                          <div style={{ fontSize: '12px', fontFamily: "'DM Mono', monospace", color: '#1A1714' }}>{fmt(r)}</div>
                          <div style={{ fontSize: '12px', fontWeight: '600', fontFamily: "'DM Mono', monospace", color: d === null ? '#C0BAB5' : (Math.abs(d) === 0 ? '#27AE60' : '#E74C3C') }}>
                            {d === null ? '—' : (Math.abs(d) === 0 ? '✅' : fmt(Math.abs(d)))}
                          </div>
                        </div>
                      );
                    })}
                    {/* Total del día */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px', gap: '8px', padding: '8px 0', alignItems: 'center' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#1A1714' }}>Total</div>
                      <div style={{ fontSize: '12px', fontWeight: '700', fontFamily: "'DM Mono', monospace", color: '#C8A84B' }}>{fmt(rev.total_cajera || 0)}</div>
                      <div style={{ fontSize: '12px', fontWeight: '700', fontFamily: "'DM Mono', monospace", color: '#27AE60' }}>{fmt(rev.total_revisado || 0)}</div>
                      <div style={{ fontSize: '12px', fontWeight: '700', fontFamily: "'DM Mono', monospace", color: Math.abs(difTotal) === 0 ? '#27AE60' : '#E74C3C' }}>
                        {Math.abs(difTotal) === 0 ? '✅' : fmt(Math.abs(difTotal))}
                      </div>
                    </div>
                  </div>

                  {/* Comentario */}
                  {rev.comentario && (
                    <div style={{ padding: '10px 16px', borderTop: '1px solid #F0EDE6', background: '#FFFEF5', fontSize: '12px', color: '#6B6560' }}>
                      <span style={{ fontWeight: '600', color: '#9C9590' }}>Comentario: </span>{rev.comentario}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Total del mes */}
            <div style={{ background: '#F0EDE6', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px', gap: '8px', alignItems: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1A1714' }}>Total del mes</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#C8A84B', fontFamily: "'DM Mono', monospace" }}>
                {fmt(revisionesMes.reduce((s, r) => s + (r.total_cajera || 0), 0))}
              </div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#27AE60', fontFamily: "'DM Mono', monospace" }}>
                {fmt(revisionesMes.reduce((s, r) => s + (r.total_revisado || 0), 0))}
              </div>
              <div style={{ fontSize: '13px', fontWeight: '700', fontFamily: "'DM Mono', monospace", color: (() => { const d = revisionesMes.reduce((s, r) => s + (r.total_cajera || 0) - (r.total_revisado || 0), 0); return Math.abs(d) === 0 ? '#27AE60' : '#E74C3C'; })() }}>
                {(() => { const d = revisionesMes.reduce((s, r) => s + (r.total_cajera || 0) - (r.total_revisado || 0), 0); return Math.abs(d) === 0 ? '✅ ₡0' : fmt(Math.abs(d)); })()}
              </div>
            </div>
          </div>
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
