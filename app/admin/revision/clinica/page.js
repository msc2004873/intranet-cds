'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '../../../components/Header';
import CalendarioPeriodos from '../../../components/CalendarioPeriodos';
import FormularioRevision from '../../../components/FormularioRevision';

const calcularTotalEnCaja = (cierre) => {
  if (!cierre) return 0;
  return cierre.c_20000 * 20000 + cierre.c_10000 * 10000 + cierre.c_5000 * 5000 +
         cierre.c_2000 * 2000 + cierre.c_1000 * 1000 + cierre.c_500 * 500 +
         cierre.c_100 * 100 + cierre.c_50 * 50 + cierre.c_25 * 25 +
         cierre.c_10 * 10 + cierre.c_5 * 5;
};

export default function RevisionClinicaPage() {
  const router = useRouter();
  const [periodo, setPeriodo] = useState(null);
  const [caja, setCaja] = useState('Caja 1 (clínica)');
  const [cajas] = useState(['Caja 1 (clínica)', 'Caja 2']);
  const [cierres, setCierres] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cierreEnRevision, setCierreEnRevision] = useState(null);
  const [periodoActualAlMontar, setPeriodoActualAlMontar] = useState(null);
  const [tabActivo, setTabActivo] = useState('cierres');

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

    setPeriodoActualAlMontar(periodoActual.num);
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
    setError(null);
    try {
      const inicio = periodo.inicio.toISOString().split('T')[0];
      const fin = periodo.fin.toISOString().split('T')[0];

      const res = await fetch(`/api/cierreCaja?fecha=${inicio}&hasta=${fin}&caja=${encodeURIComponent(caja)}`);
      if (!res.ok) {
        throw new Error('Error al cargar cierres del API');
      }
      const data = await res.json();
      setCierres(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando cierres:', err);
      setError('No se pudieron cargar los cierres. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  // esActual es true solo si el período seleccionado es el período actual
  const hoy = new Date();
  const mesHoy = hoy.getMonth();
  const anoHoy = hoy.getFullYear();

  const esActual = periodo &&
    periodo.num === periodoActualAlMontar &&
    periodo.inicio.getMonth() === mesHoy &&
    periodo.inicio.getFullYear() === anoHoy;

  const cierresPendientes = cierres.filter(c => !c.revision_completada);
  const cierresRevisados = cierres.filter(c => c.revision_completada);

  if (cierreEnRevision) {
    return (
      <FormularioRevision
        cierre={cierreEnRevision}
        periodo={periodo}
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

        {/* Pestañas */}
        {periodo && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #E2DDD4' }}>
            <button
              onClick={() => setTabActivo('cierres')}
              style={{
                padding: '12px 20px',
                background: 'transparent',
                color: tabActivo === 'cierres' ? '#2a78a5' : '#9C9590',
                border: 'none',
                borderBottom: tabActivo === 'cierres' ? '3px solid #2a78a5' : 'none',
                fontSize: '14px',
                fontWeight: tabActivo === 'cierres' ? '700' : '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              📋 Cierres
            </button>
            <button
              onClick={() => setTabActivo('auditoria')}
              style={{
                padding: '12px 20px',
                background: 'transparent',
                color: tabActivo === 'auditoria' ? '#2a78a5' : '#9C9590',
                border: 'none',
                borderBottom: tabActivo === 'auditoria' ? '3px solid #2a78a5' : 'none',
                fontSize: '14px',
                fontWeight: tabActivo === 'auditoria' ? '700' : '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              📊 Auditoría QVet
            </button>
          </div>
        )}

        {/* Tab: Cierres */}
        {tabActivo === 'cierres' && (
          <>
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
        ) : error ? (
          <div style={{ background: '#FDEDEC', border: '1.5px solid #E74C3C', borderRadius: '12px', padding: '20px', color: '#C0392B', marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600' }}>❌ {error}</div>
          </div>
        ) : (
          <>
            {/* Pendientes */}
            {cierresPendientes.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1714', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ⏳ Pendientes ({cierresPendientes.length})
                </div>
                <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', overflow: 'hidden' }}>
                  {cierresPendientes.map((cierre, i) => (
                    <div key={cierre.id} style={{ padding: '16px 20px', borderBottom: i < cierresPendientes.length - 1 ? '1px solid #E2DDD4' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#1A1714', flex: 1 }}>
                          {cierre.cajera || 'Sin datos'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#9C9590', whiteSpace: 'nowrap' }}>
                          {cierre.fecha_hora ? new Date(cierre.fecha_hora).toLocaleDateString('es-CR') + ' — ' + new Date(cierre.fecha_hora).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }) : 'Fecha inválida'}
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
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#1f5a7d'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#2a78a5'}
                        >
                          Revisar
                        </button>
                      </div>
                    </div>
                  ))}
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
                  {cierresRevisados.map((cierre, i) => (
                    <div key={cierre.id} style={{ padding: '16px 20px', borderBottom: i < cierresRevisados.length - 1 ? '1px solid #E2DDD4' : 'none', opacity: 0.6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#1A1714', flex: 1 }}>
                          {cierre.cajera || 'Sin datos'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#9C9590', whiteSpace: 'nowrap' }}>
                          {cierre.fecha_hora ? new Date(cierre.fecha_hora).toLocaleDateString('es-CR') + ' — ' + new Date(cierre.fecha_hora).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }) : 'Fecha inválida'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cierres.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#9C9590' }}>No hay cierres para este período</div>
            )}
          </>
        )}

        {/* Tab: Auditoría */}
        {tabActivo === 'auditoria' && (
          <>
            <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#1A1714', marginBottom: '16px' }}>
                📤 Subir Excel de QVet
              </div>

              <div style={{
                border: '2px dashed #2a78a5',
                borderRadius: '8px',
                padding: '40px 20px',
                textAlign: 'center',
                backgroundColor: '#E8F3EC',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#2a78a5', marginBottom: '6px' }}>
                  Arrastra el archivo o clickea para seleccionar
                </div>
                <div style={{ fontSize: '12px', color: '#9C9590' }}>
                  Formato: Excel (.xlsx)
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                />
              </div>

              <div style={{ marginTop: '24px', padding: '16px', background: '#FDE8E8', borderRadius: '8px', borderLeft: '3px solid #E74C3C' }}>
                <div style={{ fontSize: '13px', color: '#C0392B', fontWeight: '600' }}>
                  ℹ️ Instrucciones
                </div>
                <div style={{ fontSize: '12px', color: '#9C9590', marginTop: '8px', lineHeight: '1.6' }}>
                  1. Exporta los datos del período desde QVet<br/>
                  2. Sube el archivo Excel<br/>
                  3. Se comparará automáticamente con las revisiones
                </div>
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '24px' }}>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#1A1714', marginBottom: '16px' }}>
                📊 Comparativo del Período {periodo?.num}
              </div>

              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9C9590' }}>
                <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                  ⬆️ Sube un Excel para ver el comparativo
                </div>
                <div style={{ fontSize: '12px', color: '#C8C4BC' }}>
                  Se mostrarán los 3 niveles: Cajera vs Revisora vs QVet
                </div>
              </div>
            </div>
          </>
        )}

        <button
          onClick={() => router.push('/admin/revision')}
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
      </div>
    </div>
  );
}
