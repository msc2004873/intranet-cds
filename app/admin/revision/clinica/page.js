'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '../../../components/Header';
import CalendarioPeriodos from '../../../components/CalendarioPeriodos';
import FormularioRevision from '../../../components/FormularioRevision';
import { parseQVetExcel } from '../../../lib/parseQVetExcel';
import { generateAuditRows } from '../../../lib/generateAuditRows';

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
  const [cierresRevisadosIds, setCierresRevisadosIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cierreEnRevision, setCierreEnRevision] = useState(null);
  const [revisionAVer, setRevisionAVer] = useState(null);
  const [periodoActualAlMontar, setPeriodoActualAlMontar] = useState(null);
  const [tabActivo, setTabActivo] = useState('cierres');
  const [auditRows, setAuditRows] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState(null);
  const [modalAuditRow, setModalAuditRow] = useState(null);
  const [modalComentario, setModalComentario] = useState('');

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

      // Esperar un poco para que Supabase procese el nuevo registro
      await new Promise(resolve => setTimeout(resolve, 500));

      // Cargar IDs de cierres revisados
      try {
        const revisadosRes = await fetch('/api/revision-caja-ids');
        if (revisadosRes.ok) {
          const revisados = await revisadosRes.json();
          const idsRevisados = new Set(revisados.map(r => r.cierre_caja_id));
          setCierresRevisadosIds(idsRevisados);
          console.log('Cierres revisados cargados:', Array.from(idsRevisados));
        } else {
          console.error('Error fetching revision IDs:', revisadosRes.status);
        }
      } catch (err) {
        console.error('Error loading reviewed closures:', err);
      }
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

  const revisionVencida = (() => {
    if (!periodo) return false;
    const hoy = new Date();
    const hoyNorm = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const ano = periodo.inicio.getFullYear();
    const mes = periodo.inicio.getMonth();
    const deadline = periodo.num < 6
      ? new Date(ano, mes, [6, 11, 16, 21, 26][periodo.num - 1])
      : new Date(ano, mes + 1, 1);
    return hoyNorm > deadline;
  })();

  const cierresPendientes = cierres.filter(c => !cierresRevisadosIds.has(c.id));
  const cierresRevisados = cierres.filter(c => cierresRevisadosIds.has(c.id));

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
              background: esActual ? '#E8F3EC' : revisionVencida ? '#F0EDE6' : '#FDE8E8',
              border: `1px solid ${esActual ? '#27AE60' : revisionVencida ? '#9C9590' : '#E74C3C'}`,
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '6px' }}>
                Período seleccionado
              </div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: esActual ? '#27AE60' : revisionVencida ? '#9C9590' : '#E74C3C' }}>
                P{periodo.num}: {periodo.inicio.toLocaleDateString('es-CR')} — {periodo.fin.toLocaleDateString('es-CR')}
                {revisionVencida && <span style={{ fontSize: '13px', marginLeft: '8px' }}>🔒 Vencido</span>}
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
                  {revisionVencida ? '🔒' : '⏳'} {revisionVencida ? 'Sin revisar' : 'Pendientes'} ({cierresPendientes.length})
                  {revisionVencida && <span style={{ fontSize: '11px', fontWeight: '500', color: '#9C9590' }}>— período vencido</span>}
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
                        {revisionVencida ? (
                          <span style={{
                            padding: '8px 16px',
                            background: '#F0EDE6',
                            color: '#9C9590',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            whiteSpace: 'nowrap'
                          }}>
                            🔒 Vencido
                          </span>
                        ) : (
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
                        )}
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
                        <button
                          onClick={async () => {
                            const rev = await fetch(`/api/revision?cierre_id=${cierre.id}`).then(r => r.json());
                            setRevisionAVer({ ...rev, cierre });
                          }}
                          style={{
                            padding: '8px 16px',
                            background: '#27AE60',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#1e7e42'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#27AE60'}
                        >
                          👁️ Ver
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal: Ver Resumen de Revisión */}
            {revisionAVer && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                <div style={{ background: '#fff', borderRadius: '12px', maxWidth: '600px', width: '90%', maxHeight: '80vh', overflowY: 'auto', padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#1A1714' }}>Resumen de Revisión</div>
                    <button onClick={() => setRevisionAVer(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9C9590' }}>✕</button>
                  </div>

                  {/* Info del Cierre */}
                  <div style={{ background: '#F0EDE6', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '8px' }}>Cierre</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                      <div><span style={{ fontWeight: '600' }}>Cajera:</span> {revisionAVer.cierre.cajera}</div>
                      <div><span style={{ fontWeight: '600' }}>Caja:</span> {revisionAVer.cierre.caja}</div>
                      <div style={{ gridColumn: '1/-1' }}><span style={{ fontWeight: '600' }}>Fecha:</span> {new Date(revisionAVer.cierre.fecha_hora).toLocaleDateString('es-CR')} {new Date(revisionAVer.cierre.fecha_hora).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>

                  {/* Info de la Revisión */}
                  <div style={{ background: '#E8F3EC', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#27AE60', textTransform: 'uppercase', marginBottom: '8px' }}>Revisión</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                      <div><span style={{ fontWeight: '600' }}>Revisora:</span> {revisionAVer.revisora}</div>
                      <div><span style={{ fontWeight: '600' }}>TC Período:</span> {revisionAVer.tc || 'N/A'}</div>
                      <div style={{ gridColumn: '1/-1' }}><span style={{ fontWeight: '600' }}>Efectivo Revisado:</span> ₡{(revisionAVer.efectivo_revisado || 0).toLocaleString('es-CR')}</div>
                    </div>
                  </div>

                  {/* Comparativo */}
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '12px' }}>Comparativo</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '13px', marginBottom: '16px' }}>
                    <div style={{ background: '#F0EDE6', padding: '12px', borderRadius: '6px' }}>
                      <div style={{ fontWeight: '600', marginBottom: '4px' }}>Cajera</div>
                      <div style={{ color: '#6B6560' }}>Tarjeta: ₡{((revisionAVer.cierre.tarjeta_bac || 0) + (revisionAVer.cierre.tarjeta_bn || 0)).toLocaleString('es-CR')}</div>
                    </div>
                    <div style={{ background: '#E8F3EC', padding: '12px', borderRadius: '6px' }}>
                      <div style={{ fontWeight: '600', marginBottom: '4px', color: '#27AE60' }}>Revisora</div>
                      <div style={{ color: '#6B6560' }}>Tarjeta: ₡{((revisionAVer.tarjeta_bac_revisado || 0) + (revisionAVer.tarjeta_bn_revisado || 0)).toLocaleString('es-CR')}</div>
                    </div>
                    <div style={{ background: '#FDE8E8', padding: '12px', borderRadius: '6px' }}>
                      <div style={{ fontWeight: '600', marginBottom: '4px', color: '#E74C3C' }}>Diferencia</div>
                      <div style={{ color: '#6B6560' }}>
                        Δ ₡{(Math.abs(((revisionAVer.tarjeta_bac_revisado || 0) + (revisionAVer.tarjeta_bn_revisado || 0)) - ((revisionAVer.cierre.tarjeta_bac || 0) + (revisionAVer.cierre.tarjeta_bn || 0)))).toLocaleString('es-CR')}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setRevisionAVer(null)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#2a78a5',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}

            {cierres.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#9C9590' }}>No hay cierres para este período</div>
            )}
          </>
        )}
          </>
        )}

        {/* Tab: Auditoría */}
        {tabActivo === 'auditoria' && (
          <>
            {/* Cargar auditRows al abrir tab */}
            {!auditRows.length && !loadingAudit && !auditError && (
              <div style={{ display: 'none' }}>
                {(() => {
                  // Cargar automáticamente cuando se abre el tab
                  fetch(`/api/auditoria-periodo?inicio=${periodo?.inicio.toISOString().split('T')[0]}&fin=${periodo?.fin.toISOString().split('T')[0]}`)
                    .then(r => r.json())
                    .then(data => {
                      if (data && data.length > 0) {
                        setAuditRows(data);
                      }
                    })
                    .catch(err => console.error('Error loading audit rows:', err));
                  return null;
                })()}
              </div>
            )}

            {/* Upload or Summary */}
            {auditRows.length === 0 ? (
              <div style={{ background: '#fff', border: '2px dashed #2a78a5', borderRadius: '12px', padding: '32px 24px', marginBottom: '24px', textAlign: 'center', cursor: 'pointer' }}
                onClick={() => {
                  const input = document.querySelector('input[accept=".xlsx,.xls"]');
                  if (input) input.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.background = '#E8F3EC';
                  e.currentTarget.style.borderColor = '#27AE60';
                }}
                onDragLeave={(e) => {
                  e.currentTarget.style.background = '#fff';
                  e.currentTarget.style.borderColor = '#2a78a5';
                }}
                onDrop={async (e) => {
                e.preventDefault();
                e.currentTarget.style.background = '#fff';
                e.currentTarget.style.borderColor = '#2a78a5';
                const file = e.dataTransfer.files?.[0];
                if (!file) return;

                console.log('File dropped:', file.name);
                setLoadingAudit(true);
                setAuditError(null);
                try {
                  console.log('Periodo:', periodo);
                  const qvetData = await parseQVetExcel(file, periodo);
                  console.log('QVet data parsed:', qvetData);

                  if (!qvetData || qvetData.length === 0) {
                    throw new Error('Excel vacío o sin datos válidos para este período');
                  }

                  const allAuditRows = [];
                  console.log('Cierres revisados en DB:', cierres.filter(c => cierresRevisadosIds.has(c.id)).map(c => ({ caja: c.caja, fecha: new Date(c.fecha_hora).toISOString().split('T')[0] })));
                  console.log('Datos en Excel:', qvetData.map(q => ({ caja: q.caja, fecha: q.fecha })));

                  for (const cierre of cierres) {
                    if (!cierresRevisadosIds.has(cierre.id)) continue;

                    const cierreFecha = new Date(cierre.fecha_hora).toISOString().split('T')[0];
                    const qvetCierre = qvetData.find(q => {
                      const match = q.caja === cierre.caja && q.fecha === cierreFecha;
                      console.log(`Intentando matchear DB(${cierre.caja}|${cierreFecha}) con Excel(${q.caja}|${q.fecha}): ${match}`);
                      return match;
                    });
                    if (!qvetCierre) {
                      console.log(`No encontrado: caja=${cierre.caja}, fecha=${cierreFecha}`);
                      continue;
                    }

                    const revRes = await fetch(`/api/revision?cierre_id=${cierre.id}`);
                    if (!revRes.ok) continue;
                    const revision = await revRes.json();

                    const rows = generateAuditRows(cierre, revision, qvetCierre);
                    allAuditRows.push(...rows);
                  }

                  if (allAuditRows.length === 0) {
                    throw new Error('No se encontraron cierres revisados para comparar');
                  }

                  const saveRes = await fetch('/api/auditoria', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      revision_caja_id: allAuditRows[0].revision_caja_id,
                      audit_rows: allAuditRows,
                      qvet_data: qvetData,
                      qvet_archivo_url: file.name
                    })
                  });

                  if (!saveRes.ok) throw new Error('Error al guardar auditoría');

                  setAuditRows(allAuditRows);
                  console.log('✅ Auditoría guardada:', allAuditRows.length, 'filas');
                } catch (err) {
                  console.error('Error en drop:', err);
                  setAuditError(err.message || 'Error al procesar archivo');
                } finally {
                  setLoadingAudit(false);
                }
              }}
            >
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#1A1714', marginBottom: '8px' }}>
                📤 Subir Excel de QVet
              </div>
              <div style={{ fontSize: '13px', color: '#9C9590', marginBottom: '16px' }}>
                Arrastra el archivo o haz click para seleccionar
              </div>

              <input
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    console.log('No file selected');
                    return;
                  }

                  console.log('File selected:', file.name);
                  setLoadingAudit(true);
                  setAuditError(null);
                  try {
                    console.log('Periodo:', periodo);
                    // 1. Parse Excel
                    const qvetData = await parseQVetExcel(file, periodo);
                    console.log('QVet data parsed:', qvetData);

                    if (!qvetData || qvetData.length === 0) {
                      throw new Error('Excel vacío o sin datos válidos para este período');
                    }

                    // 2. Generar filas de auditoría para cada cierre revisado
                    const allAuditRows = [];
                    for (const cierre of cierres) {
                      if (!cierresRevisadosIds.has(cierre.id)) continue;

                      // Buscar cierre en QVet data
                      const qvetCierre = qvetData.find(q => q.caja === cierre.caja && q.fecha === new Date(cierre.fecha_hora).toISOString().split('T')[0]);
                      if (!qvetCierre) continue;

                      // Buscar revision_caja
                      const revRes = await fetch(`/api/revision?cierre_id=${cierre.id}`);
                      if (!revRes.ok) continue;
                      const revision = await revRes.json();

                      // Generar filas
                      const rows = generateAuditRows(cierre, revision, qvetCierre);
                      allAuditRows.push(...rows);
                    }

                    if (allAuditRows.length === 0) {
                      throw new Error('No se encontraron cierres revisados para comparar');
                    }

                    // 3. Guardar en DB
                    const saveRes = await fetch('/api/auditoria', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        revision_caja_id: allAuditRows[0].revision_caja_id,
                        audit_rows: allAuditRows,
                        qvet_data: qvetData,
                        qvet_archivo_url: file.name
                      })
                    });

                    if (!saveRes.ok) throw new Error('Error al guardar auditoría');

                    setAuditRows(allAuditRows);
                    e.target.value = '';
                  } catch (err) {
                    setAuditError(err.message);
                    console.error('Error:', err);
                  } finally {
                    setLoadingAudit(false);
                  }
                }}
                style={{
                  display: 'none'
                }}
                id="fileInput"
              />

              <label htmlFor="fileInput" style={{
                border: '2px dashed #2a78a5',
                borderRadius: '8px',
                padding: '40px 20px',
                textAlign: 'center',
                backgroundColor: '#E8F3EC',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'block'
              }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#2a78a5', marginBottom: '6px' }}>
                  {loadingAudit ? '⏳ Procesando...' : 'Arrastra el archivo o clickea para seleccionar'}
                </div>
                <div style={{ fontSize: '12px', color: '#9C9590' }}>
                  Formato: Excel (.xlsx)
                </div>
              </label>

              <div style={{ marginTop: '24px', padding: '16px', background: '#FDE8E8', borderRadius: '8px', borderLeft: '3px solid #E74C3C' }}>
                <div style={{ fontSize: '13px', color: '#C0392B', fontWeight: '600' }}>
                  ℹ️ Instrucciones
                </div>
                <div style={{ fontSize: '12px', color: '#9C9590', marginTop: '8px', lineHeight: '1.6' }}>
                  <strong>En QVet:</strong><br/>
                  Documentos → Listados → COBROS → LISTADO CIERRE DE CAJA<br/>
                  <br/>
                  <strong>Descargar desde:</strong> {periodo?.inicio.toLocaleDateString('es-CR')} hasta {periodo?.fin.toLocaleDateString('es-CR')}<br/>
                  <br/>
                  Luego sube el archivo acá para comparar automáticamente
                </div>
              </div>

              {auditError && (
                <div style={{ marginTop: '16px', padding: '12px', background: '#FDEDEC', border: '1px solid #E74C3C', borderRadius: '8px', color: '#C0392B', fontSize: '12px' }}>
                  ❌ {auditError}
                </div>
              )}
            </div>
            ) : (
              <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#1A1714', marginBottom: '16px' }}>
                  ✅ Auditoría Procesada
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  {/* Diferencias encontradas */}
                  {(() => {
                    const withDiff = auditRows.filter(row => {
                      const diffRevision = row.monto_revisora - row.monto_cajera;
                      const diffAuditoria = row.monto_qvet - row.monto_revisora;
                      return Math.abs(diffRevision) > 0 || Math.abs(diffAuditoria) > 0;
                    });
                    return (
                      <div style={{ background: '#FDE8E8', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #E74C3C' }}>
                        <div style={{ fontSize: '12px', color: '#9C9590', fontWeight: '600' }}>DIFERENCIAS ENCONTRADAS</div>
                        <div style={{ fontSize: '32px', fontWeight: '700', color: '#E74C3C', marginTop: '8px' }}>
                          {withDiff.length}
                        </div>
                        <div style={{ fontSize: '12px', color: '#9C9590', marginTop: '4px' }}>de {auditRows.length} movimientos</div>
                      </div>
                    );
                  })()}

                  {/* Pendientes de comentario */}
                  {(() => {
                    const needsComment = auditRows.filter(row => {
                      const diffRevision = row.monto_revisora - row.monto_cajera;
                      const diffAuditoria = row.monto_qvet - row.monto_revisora;
                      const hasDiff = Math.abs(diffRevision) > 0 || Math.abs(diffAuditoria) > 0;
                      return hasDiff && !row.comentario_auditoria;
                    });
                    return (
                      <div style={{ background: '#FFF3CD', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #F39C12' }}>
                        <div style={{ fontSize: '12px', color: '#9C9590', fontWeight: '600' }}>PENDIENTES DE COMENTARIO</div>
                        <div style={{ fontSize: '32px', fontWeight: '700', color: '#F39C12', marginTop: '8px' }}>
                          {needsComment.length}
                        </div>
                        <div style={{ fontSize: '12px', color: '#9C9590', marginTop: '4px' }}>discrepancias sin explicar</div>
                      </div>
                    );
                  })()}
                </div>

                <button
                  onClick={() => {
                    setAuditRows([]);
                    setAuditError(null);
                  }}
                  style={{
                    padding: '10px 16px',
                    background: '#2a78a5',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  🔄 Subir otro Excel
                </button>
              </div>
            )}

            {/* Comparativo */}
            {auditRows.length > 0 && (
              <>
                {['Caja 1 (clínica)', 'Caja 2'].map(cajaName => {
                  const rowsPorCaja = auditRows.filter(r => r.caja === cajaName);
                  if (rowsPorCaja.length === 0) return null;

                  // Agrupar por día
                  const porDia = {};
                  rowsPorCaja.forEach(row => {
                    const fecha = row.revision_caja?.cierre_caja?.fecha_hora
                      ? new Date(row.revision_caja.cierre_caja.fecha_hora).toLocaleDateString('es-CR')
                      : 'Sin fecha';
                    if (!porDia[fecha]) porDia[fecha] = [];
                    porDia[fecha].push(row);
                  });

                  return (
                    <div key={cajaName} style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#1A1714', marginBottom: '16px' }}>
                        {cajaName}
                      </div>

                      {Object.entries(porDia).map(([fecha, rowsDelDia]) => (
                        <div key={fecha} style={{ marginBottom: '20px' }}>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#6B6560', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #E2DDD4' }}>
                            📅 {fecha}
                          </div>

                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid #E2DDD4' }}>
                                  <th style={{ padding: '8px', textAlign: 'left', fontWeight: '700', color: '#1A1714', fontSize: '12px' }}>Tipo</th>
                                  <th style={{ padding: '4px', textAlign: 'right', fontWeight: '700', color: '#1A1714', fontSize: '11px' }}>Cajera</th>
                                  <th style={{ padding: '4px', textAlign: 'center', fontWeight: '600', color: '#9C9590', fontSize: '9px' }}>vs Rev</th>
                                  <th style={{ padding: '4px', textAlign: 'right', fontWeight: '700', color: '#1A1714', fontSize: '11px' }}>Revisora</th>
                                  <th style={{ padding: '4px', textAlign: 'center', fontWeight: '600', color: '#9C9590', fontSize: '9px' }}>vs QVet</th>
                                  <th style={{ padding: '4px', textAlign: 'right', fontWeight: '700', color: '#1A1714', fontSize: '11px' }}>QVet</th>
                                  <th style={{ padding: '4px', textAlign: 'center', fontWeight: '700', color: '#1A1714' }}>✓</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rowsDelDia.map((row, i) => {
                                  const diffRevision = row.monto_revisora - row.monto_cajera;
                                  const diffAuditoria = row.monto_qvet - row.monto_revisora;
                                  const maxDiff = Math.max(Math.abs(diffRevision), Math.abs(diffAuditoria));
                                  const hasDiff = maxDiff > 0;

                                  // Calcular severidad basada en la MAYOR diferencia
                                  let severidad = 'GREEN';
                                  if (maxDiff >= 500) severidad = 'RED';
                                  else if (maxDiff >= 50) severidad = 'YELLOW';

                                  const color = severidad === 'RED' ? '#E74C3C' : severidad === 'YELLOW' ? '#F39C12' : '#27AE60';
                                  const icon = severidad === 'RED' ? '🔴' : severidad === 'YELLOW' ? '🟡' : '✅';

                                  const diffColor = (diff) => {
                                    const abs = Math.abs(diff);
                                    if (abs === 0) return '#27AE60';
                                    if (abs < 500) return '#F39C12';
                                    return '#E74C3C';
                                  };

                                  return (
                                    <tr
                                      key={i}
                                      onClick={() => hasDiff && setModalAuditRow(row)}
                                      style={{
                                        borderBottom: '1px solid #E2DDD4',
                                        background: hasDiff ? '#FDE8E8' : 'transparent',
                                        cursor: hasDiff ? 'pointer' : 'default',
                                        transition: 'all 0.2s'
                                      }}
                                      onMouseEnter={(e) => hasDiff && (e.currentTarget.style.background = '#FDEDEC')}
                                      onMouseLeave={(e) => hasDiff && (e.currentTarget.style.background = '#FDE8E8')}
                                    >
                                      <td style={{ padding: '6px 8px', color: '#1A1714', fontWeight: '600', fontSize: '12px' }}>{row.tipo_movimiento}</td>
                                      <td style={{ padding: '4px', textAlign: 'right', color: '#1A1714', fontSize: '11px', fontWeight: '500' }}>₡{Math.round(row.monto_cajera).toLocaleString('es-CR')}</td>
                                      <td style={{ padding: '4px', textAlign: 'center', color: diffColor(diffRevision), fontWeight: '600', fontSize: '10px' }}>
                                        {Math.abs(diffRevision) === 0 ? '✓' : (diffRevision > 0 ? '+' : '') + '₡' + Math.abs(Math.round(diffRevision)).toLocaleString('es-CR')}
                                      </td>
                                      <td style={{ padding: '4px', textAlign: 'right', color: '#1A1714', fontSize: '11px', fontWeight: '500' }}>₡{Math.round(row.monto_revisora).toLocaleString('es-CR')}</td>
                                      <td style={{ padding: '4px', textAlign: 'center', color: diffColor(diffAuditoria), fontWeight: '600', fontSize: '10px' }}>
                                        {Math.abs(diffAuditoria) === 0 ? '✓' : (diffAuditoria > 0 ? '+' : '') + '₡' + Math.abs(Math.round(diffAuditoria)).toLocaleString('es-CR')}
                                      </td>
                                      <td style={{ padding: '4px', textAlign: 'right', color: '#1A1714', fontSize: '11px', fontWeight: '500' }}>₡{Math.round(row.monto_qvet).toLocaleString('es-CR')}</td>
                                      <td style={{ padding: '4px', textAlign: 'center', color, fontWeight: '700', fontSize: '14px' }}>{icon}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}

                {/* Modal para comentarios */}
                {modalAuditRow && (
                  <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '20px'
                  }}>
                    <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#1A1714', marginBottom: '16px' }}>
                        {modalAuditRow.tipo_movimiento} — Diferencia de ₡{Math.abs(modalAuditRow.diferencia_auditoria).toLocaleString('es-CR')}
                      </div>

                      <div style={{ background: '#F0EDE6', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '12px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div>
                            <div style={{ color: '#9C9590', fontSize: '10px' }}>Cajera</div>
                            <div style={{ color: '#1A1714', fontWeight: '700' }}>₡{modalAuditRow.monto_cajera.toLocaleString('es-CR')}</div>
                          </div>
                          <div>
                            <div style={{ color: '#9C9590', fontSize: '10px' }}>Revisora</div>
                            <div style={{ color: '#1A1714', fontWeight: '700' }}>₡{modalAuditRow.monto_revisora.toLocaleString('es-CR')}</div>
                          </div>
                          <div>
                            <div style={{ color: '#9C9590', fontSize: '10px' }}>QVet</div>
                            <div style={{ color: '#1A1714', fontWeight: '700' }}>₡{modalAuditRow.monto_qvet.toLocaleString('es-CR')}</div>
                          </div>
                          <div>
                            <div style={{ color: '#9C9590', fontSize: '10px' }}>Severidad</div>
                            <div style={{ color: modalAuditRow.severidad_auditoria === 'RED' ? '#E74C3C' : modalAuditRow.severidad_auditoria === 'YELLOW' ? '#F39C12' : '#27AE60', fontWeight: '700' }}>
                              {modalAuditRow.severidad_auditoria === 'RED' ? '🔴 RED' : modalAuditRow.severidad_auditoria === 'YELLOW' ? '🟡 YELLOW' : '✅ GREEN'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6B6560', marginBottom: '8px' }}>
                          Comentario:
                        </label>
                        <textarea
                          value={modalComentario}
                          onChange={(e) => setModalComentario(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: '1px solid #E2DDD4',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontFamily: 'inherit',
                            minHeight: '80px',
                            boxSizing: 'border-box'
                          }}
                          placeholder="Explica la diferencia encontrada..."
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => {
                            setModalAuditRow(null);
                            setModalComentario('');
                          }}
                          style={{
                            padding: '10px 20px',
                            background: '#F0EDE6',
                            color: '#6B6560',
                            border: '1px solid #E2DDD4',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/auditoria', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  id: modalAuditRow.id,
                                  comentario_auditoria: modalComentario
                                })
                              });

                              if (!res.ok) throw new Error('Error al guardar');

                              // Actualizar en local
                              setAuditRows(auditRows.map(r => r.id === modalAuditRow.id ? { ...r, comentario_auditoria: modalComentario } : r));
                              setModalAuditRow(null);
                              setModalComentario('');
                            } catch (err) {
                              alert('Error: ' + err.message);
                            }
                          }}
                          style={{
                            padding: '10px 20px',
                            background: '#2a78a5',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {auditRows.length === 0 && !loadingAudit && (
              <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#9C9590' }}>
                ⬆️ Sube un Excel para ver el comparativo
              </div>
            )}
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

