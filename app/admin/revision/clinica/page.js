'use client';

import React, { useState, useEffect } from 'react';
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
  const [qvetRawData, setQvetRawData] = useState(null);
  const [showQvetDebug, setShowQvetDebug] = useState(false);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [modalDenominaciones, setModalDenominaciones] = useState({});
  const [depositoPeriodo, setDepositoPeriodo] = useState(null);
  const [denomsColones, setDenomsColones] = useState({});
  const [denomsUSD, setDenomsUSD] = useState({});
  const [guardandoDeposito, setGuardandoDeposito] = useState(false);
  const [depositoGuardado, setDepositoGuardado] = useState(false);
  const [expandedCommentId, setExpandedCommentId] = useState(null);
  // Cuando la revisora pide re-subir el Excel, vaciamos auditRows para que vuelva a
  // aparecer el dropzone. Sin esta bandera el auto-load de abajo los recargaría de
  // inmediato y el dropzone desaparecería otra vez.
  const [reSubiendo, setReSubiendo] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user?.nombre) setUsuarioActual(user);
  }, []);

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

    // El último período termina el último día real del mes (no el 31 fijo, que se
    // desborda al mes siguiente en meses de 30/28/29 días). new Date(ano, mes+1, 0) = último día del mes.
    const ultimoDiaMes = new Date(ano, mes + 1, 0).getDate();

    setPeriodoActualAlMontar(periodoActual.num);
    setPeriodo({
      num: periodoActual.num,
      inicio: new Date(ano, mes, periodoActual.inicio),
      fin: new Date(ano, mes, Math.min(periodoActual.fin, ultimoDiaMes)),
    });
  }, []);

  useEffect(() => {
    if (periodo) {
      cargarCierres();
    }
  }, [periodo, caja]);

  // Auto-load audit data when audit tab is opened
  useEffect(() => {
    if (tabActivo === 'auditoria' && auditRows.length === 0 && !loadingAudit && periodo && !reSubiendo) {
      console.error('📋 AUTO-LOADING AUDIT DATA FOR PERIOD:', periodo);
      const cargarAuditoria = async () => {
        try {
          const inicio = periodo.inicio.toISOString().split('T')[0];
          const fin = periodo.fin.toISOString().split('T')[0];
          const res = await fetch(`/api/auditoria-periodo?inicio=${inicio}&fin=${fin}`);
          const data = await res.json();
          if (data && data.length > 0) {
            console.error('✅ AUDIT DATA LOADED:', data.length, 'rows');
            setAuditRows(data);
            // Restore parser debug panel from saved qvet_data in DB
            const savedQvetData = data.find(r => r.revision_caja?.qvet_data)?.revision_caja?.qvet_data;
            if (savedQvetData) {
              setQvetRawData(prev => prev || savedQvetData);
            }
          } else {
            console.error('ℹ️ NO AUDIT DATA FOR THIS PERIOD');
          }
          // Load existing deposito for this period
          const dRes = await fetch(`/api/depositos-cds?inicio=${periodo.inicio.toISOString().split('T')[0]}&fin=${periodo.fin.toISOString().split('T')[0]}`);
          if (dRes.ok) {
            const dData = await dRes.json();
            if (dData) {
              setDepositoPeriodo(dData);
              setDenomsColones(dData.denominaciones_colones || {});
              setDenomsUSD(dData.denominaciones_usd || {});
              setDepositoGuardado(true);
            }
          }
        } catch (err) {
          console.error('❌ Error loading audit data:', err);
        }
      };
      cargarAuditoria();
    }
  }, [tabActivo, periodo, auditRows.length, loadingAudit, reSubiendo]);

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
              background: revisionBloqueada ? '#FFF3CD' : '#E8F3EC',
              border: `1px solid ${revisionBloqueada ? '#F39C12' : '#27AE60'}`,
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '6px' }}>
                Período seleccionado
              </div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: revisionBloqueada ? '#F39C12' : '#27AE60' }}>
                P{periodo.num}: {periodo.inicio.toLocaleDateString('es-CR')} — {periodo.fin.toLocaleDateString('es-CR')}
                {revisionBloqueada && <span style={{ fontSize: '13px', marginLeft: '8px' }}>⏳ En curso</span>}
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
                  {revisionBloqueada && <span style={{ fontSize: '11px', fontWeight: '500', color: '#F39C12' }}>— período en curso</span>}
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
            {revisionBloqueada ? (
              <div style={{ background: '#FFF3CD', border: '1px solid #F39C12', borderRadius: '12px', padding: '32px 24px', textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#F39C12', marginBottom: '8px' }}>Período en curso</div>
                <div style={{ fontSize: '13px', color: '#9C9590' }}>La auditoría estará disponible una vez que termine el período</div>
              </div>
            ) : (
            <>
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

                console.error('🔍 FILE DROPPED:', file.name);
                setLoadingAudit(true);
                setAuditError(null);
                try {
                  console.error('📅 PERIODO:', periodo);
                  const qvetData = await parseQVetExcel(file, periodo);
                  console.error('📊 QVET DATA PARSED:', qvetData.length, 'rows');

                  if (!qvetData || qvetData.length === 0) {
                    throw new Error('Excel vacío o sin datos válidos para este período');
                  }

                  setQvetRawData(qvetData);
                  setShowQvetDebug(true);

                  // Load ALL cierres for the period (not just the selected caja)
                  const inicio = periodo.inicio.toISOString().split('T')[0];
                  const fin = periodo.fin.toISOString().split('T')[0];
                  const todosLosRes = await fetch(`/api/cierreCaja?fecha=${inicio}&hasta=${fin}`);
                  const todosCierres = todosLosRes.ok ? await todosLosRes.json() : [];
                  console.error('📦 ALL CIERRES FOR PERIOD:', todosCierres.length, 'total');

                  const allAuditRows = [];
                  // Convert Supabase UTC timestamp to CR date (subtract 6h from UTC)
                  const toCRDate = (utcStr) => new Date(new Date(utcStr).getTime() - 6 * 60 * 60 * 1000).toISOString().split('T')[0];
                  const dbCierres = todosCierres.filter(c => cierresRevisadosIds.has(c.id)).map(c => ({ caja: c.caja, fecha: toCRDate(c.fecha_hora) }));
                  console.error('🗄️ DB CIERRES REVIEWED (CR dates):', dbCierres);
                  console.error('📑 EXCEL DATA:', qvetData.map(q => ({ caja: q.caja, fecha: q.fecha })));

                  for (const cierre of todosCierres) {
                    if (!cierresRevisadosIds.has(cierre.id)) continue;

                    // Use CR date for comparison (Supabase stores UTC, parser stores CR date)
                    const cierreFecha = toCRDate(cierre.fecha_hora);
                    console.error(`🔎 Buscando en Excel: caja="${cierre.caja}" fechaCR="${cierreFecha}"`);

                    const qvetCierre = qvetData.find(q => {
                      const match = q.caja === cierre.caja && q.fecha === cierreFecha;
                      if (match) console.error(`✅ MATCH FOUND: ${cierre.caja}|${cierreFecha}`);
                      return match;
                    });
                    if (!qvetCierre) {
                      console.error(`⚠️ NO MATCH in Excel: ${cierre.caja}|${cierreFecha} — se incluye con QVet=0`);
                    }
                    // Always include the cierre, even without QVet data, so no day goes invisible
                    const qvetParaComparar = qvetCierre || { efectivo: 0, tarjeta: 0, sinpe: 0, transferencia: 0, salidas: 0, sinMatchQvet: true };

                    const revRes = await fetch(`/api/revision?cierre_id=${cierre.id}`);
                    if (!revRes.ok) continue;
                    const revision = await revRes.json();

                    const rows = generateAuditRows(cierre, revision, qvetParaComparar);
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

                  // ✅ RELOAD from API to get complete structure with relations
                  console.error('🔄 RELOADING AUDIT DATA WITH RELATIONS...');
                  const reloadRes = await fetch(`/api/auditoria-periodo?inicio=${periodo.inicio.toISOString().split('T')[0]}&fin=${periodo.fin.toISOString().split('T')[0]}`);
                  const reloadedData = reloadRes.ok ? await reloadRes.json() : [];

                  setReSubiendo(false);

                  if (reloadedData.length > 0) {
                    setAuditRows(reloadedData);
                    console.error('✅ AUDIT ROWS RELOADED WITH RELATIONS: ' + reloadedData.length + ' rows');
                    console.error('  First row has relations:', reloadedData[0]?.revision_caja ? 'YES' : 'NO');
                  } else {
                    console.error('⚠️ Reload returned 0 rows, using local data');
                    setAuditRows(allAuditRows);
                  }
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

                    setQvetRawData(qvetData);
                    setShowQvetDebug(true);

                    // 2. Generar filas de auditoría para cada cierre revisado
                    const allAuditRows = [];
                    // Convert Supabase UTC timestamp to CR date (subtract 6h from UTC)
                    const toCRDate = (utcStr) => new Date(new Date(utcStr).getTime() - 6 * 60 * 60 * 1000).toISOString().split('T')[0];
                    for (const cierre of cierres) {
                      if (!cierresRevisadosIds.has(cierre.id)) continue;

                      // Use CR date for comparison (Supabase stores UTC, parser stores CR date)
                      const cierreFechaCR = toCRDate(cierre.fecha_hora);
                      const qvetCierre = qvetData.find(q => q.caja === cierre.caja && q.fecha === cierreFechaCR);
                      if (!qvetCierre) {
                        console.error(`⚠️ NO MATCH in Excel: ${cierre.caja}|${cierreFechaCR} — se incluye con QVet=0`);
                      }
                      // Always include, even without QVet match
                      const qvetParaComparar = qvetCierre || { efectivo: 0, tarjeta: 0, sinpe: 0, transferencia: 0, salidas: 0, sinMatchQvet: true };

                      // Buscar revision_caja
                      const revRes = await fetch(`/api/revision?cierre_id=${cierre.id}`);
                      if (!revRes.ok) continue;
                      const revision = await revRes.json();

                      // Generar filas
                      const rows = generateAuditRows(cierre, revision, qvetParaComparar);
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

                    setReSubiendo(false);
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#1A1714' }}>
                    ✅ Auditoría Procesada
                  </div>
                  <button
                    onClick={() => {
                      setReSubiendo(true);
                      setAuditRows([]);
                      setQvetRawData(null);
                      setShowQvetDebug(false);
                      setAuditError(null);
                    }}
                    style={{ padding: '8px 14px', background: '#F0EDE6', color: '#6B6560', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    onMouseEnter={(e) => e.target.style.background = '#E2DDD4'}
                    onMouseLeave={(e) => e.target.style.background = '#F0EDE6'}
                    title="Vuelve a mostrar el recuadro para subir el Excel. Los datos actuales se reemplazan al subir el nuevo archivo."
                  >
                    ↻ Volver a subir Excel
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  {/* Diferencias encontradas */}
                  {(() => {
                    const withDiff = auditRows.filter(row => {
                      const diffRevision = row.monto_revisora - row.monto_cajera;
                      const diffAuditoria = row.monto_qvet - row.monto_revisora;
                      return Math.abs(diffRevision) >= 5 || Math.abs(diffAuditoria) >= 5;
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
                      const hasDiff = Math.abs(diffRevision) >= 5 || Math.abs(diffAuditoria) >= 5;
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
              </div>
            )}

            {/* Debug: QVet raw parsed data */}
            {qvetRawData && (
              <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showQvetDebug ? '16px' : '0' }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1714' }}>
                    🔍 Lo que leyó el parser ({qvetRawData.length} entradas)
                  </div>
                  <button
                    onClick={() => setShowQvetDebug(v => !v)}
                    style={{ background: 'none', border: 'none', color: '#2a78a5', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    {showQvetDebug ? '▲ Ocultar' : '▼ Ver'}
                  </button>
                </div>
                {showQvetDebug && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #E2DDD4', background: '#F0EDE6' }}>
                          <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '700' }}>Caja</th>
                          <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '700' }}>Fecha CR</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700' }}>Efectivo</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700' }}>Tarjeta</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700' }}>SINPE</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700' }}>Transfer.</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '700' }}>Salidas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {qvetRawData.sort((a, b) => a.caja.localeCompare(b.caja) || a.fecha.localeCompare(b.fecha)).map((row, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #F0EDE6' }}>
                            <td style={{ padding: '5px 8px', fontWeight: '600', color: '#1A1714' }}>{row.caja}</td>
                            <td style={{ padding: '5px 8px', color: '#6B6560' }}>{row.fecha}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', color: row.efectivo > 0 ? '#1A1714' : '#C8C4BE' }}>₡{Math.round(row.efectivo).toLocaleString('es-CR')}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', color: row.tarjeta > 0 ? '#1A1714' : '#C8C4BE' }}>₡{Math.round(row.tarjeta).toLocaleString('es-CR')}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', color: row.sinpe > 0 ? '#1A1714' : '#C8C4BE' }}>₡{Math.round(row.sinpe).toLocaleString('es-CR')}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', color: row.transferencia > 0 ? '#1A1714' : '#C8C4BE' }}>₡{Math.round(row.transferencia).toLocaleString('es-CR')}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', color: row.salidas > 0 ? '#E74C3C' : '#C8C4BE' }}>₡{Math.round(row.salidas).toLocaleString('es-CR')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
                                  const hasDiff = maxDiff >= 5;

                                  // Calcular severidad basada en la MAYOR diferencia
                                  let severidad = 'GREEN';
                                  if (maxDiff >= 500) severidad = 'RED';
                                  else if (maxDiff >= 5) severidad = 'YELLOW';

                                  const color = severidad === 'RED' ? '#E74C3C' : severidad === 'YELLOW' ? '#F39C12' : '#27AE60';
                                  const icon = severidad === 'RED' ? '🔴' : severidad === 'YELLOW' ? '🟡' : '✅';

                                  const diffColor = (diff) => {
                                    const abs = Math.abs(diff);
                                    if (abs < 5) return '#27AE60';
                                    if (abs < 500) return '#F39C12';
                                    return '#E74C3C';
                                  };

                                  const tieneComentario = hasDiff && !!row.comentario_auditoria;
                                  const rowKey = row.id || i;
                                  const isExpanded = expandedCommentId === rowKey;
                                  const bgNormal = !hasDiff ? 'transparent' : tieneComentario ? '#E8F3EC' : '#FDE8E8';
                                  const bgHover = !hasDiff ? 'transparent' : tieneComentario ? '#D5EAD5' : '#FDEDEC';

                                  return (
                                    <React.Fragment key={i}>
                                      <tr
                                        onClick={() => {
                                          if (!hasDiff) return;
                                          if (tieneComentario) {
                                            setExpandedCommentId(isExpanded ? null : rowKey);
                                          } else {
                                            setModalAuditRow(row);
                                            setModalComentario('');
                                            setModalDenominaciones({});
                                          }
                                        }}
                                        style={{
                                          borderBottom: isExpanded ? 'none' : '1px solid #E2DDD4',
                                          background: bgNormal,
                                          cursor: hasDiff ? 'pointer' : 'default',
                                          transition: 'background 0.15s'
                                        }}
                                        onMouseEnter={(e) => hasDiff && (e.currentTarget.style.background = bgHover)}
                                        onMouseLeave={(e) => hasDiff && (e.currentTarget.style.background = bgNormal)}
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
                                      {isExpanded && (
                                        <tr style={{ background: '#E8F3EC', borderBottom: '1px solid #E2DDD4' }}>
                                          <td colSpan={7} style={{ padding: '8px 12px' }}>
                                            <div style={{ fontSize: '12px', color: '#1A1714', marginBottom: '6px', lineHeight: '1.5' }}>
                                              <span style={{ fontWeight: '600', color: '#27AE60' }}>Comentario: </span>
                                              {row.comentario_auditoria}
                                            </div>
                                            {row.comentado_por && (
                                              <div style={{ fontSize: '10px', color: '#9C9590', marginBottom: '8px' }}>por {row.comentado_por}</div>
                                            )}
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setModalAuditRow(row);
                                                setModalComentario(row.comentario_auditoria || '');
                                                setModalDenominaciones(row.denominaciones_auditoria || {});
                                                setExpandedCommentId(null);
                                              }}
                                              style={{ padding: '5px 12px', background: '#2a78a5', color: 'white', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                                            >
                                              Editar comentario
                                            </button>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
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

                {/* Resumen combinado Caja 1 + Caja 2 */}
                {(() => {
                  const tiposOrden = ['EFECTIVO', 'TARJETA', 'SINPE', 'TRANSFERENCIA', 'SALIDAS'];
                  const resumen = tiposOrden.map(tipo => {
                    const rowsTipo = auditRows.filter(r => r.tipo_movimiento === tipo);
                    const cajera = rowsTipo.reduce((s, r) => s + (r.monto_cajera || 0), 0);
                    const revisora = rowsTipo.reduce((s, r) => s + (r.monto_revisora || 0), 0);
                    const qvet = rowsTipo.reduce((s, r) => s + (r.monto_qvet || 0), 0);
                    return { tipo, cajera, revisora, qvet };
                  });
                  const totalCajera = resumen.reduce((s, r) => s + r.cajera, 0);
                  const totalRevisora = resumen.reduce((s, r) => s + r.revisora, 0);
                  const totalQvet = resumen.reduce((s, r) => s + r.qvet, 0);
                  const diffColor = (diff) => {
                    const abs = Math.abs(diff);
                    if (abs < 5) return '#27AE60';
                    if (abs < 500) return '#F39C12';
                    return '#E74C3C';
                  };
                  return (
                    <div style={{ background: '#fff', border: '2px solid #2a78a5', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: '#2a78a5', marginBottom: '16px' }}>
                        Resumen Total — Ambas Cajas
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #E2DDD4' }}>
                              <th style={{ padding: '8px', textAlign: 'left', fontWeight: '700', color: '#1A1714' }}>Tipo</th>
                              <th style={{ padding: '4px', textAlign: 'right', fontWeight: '700', color: '#1A1714', fontSize: '11px' }}>Cajera</th>
                              <th style={{ padding: '4px', textAlign: 'center', fontWeight: '600', color: '#9C9590', fontSize: '9px' }}>vs Rev</th>
                              <th style={{ padding: '4px', textAlign: 'right', fontWeight: '700', color: '#1A1714', fontSize: '11px' }}>Revisora</th>
                              <th style={{ padding: '4px', textAlign: 'center', fontWeight: '600', color: '#9C9590', fontSize: '9px' }}>vs QVet</th>
                              <th style={{ padding: '4px', textAlign: 'right', fontWeight: '700', color: '#1A1714', fontSize: '11px' }}>QVet</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resumen.map(({ tipo, cajera, revisora, qvet }) => {
                              const diffRev = revisora - cajera;
                              const diffAud = qvet - revisora;
                              return (
                                <tr key={tipo} style={{ borderBottom: '1px solid #E2DDD4' }}>
                                  <td style={{ padding: '6px 8px', fontWeight: '600', color: '#1A1714' }}>{tipo}</td>
                                  <td style={{ padding: '4px', textAlign: 'right', color: '#1A1714', fontSize: '11px' }}>₡{Math.round(cajera).toLocaleString('es-CR')}</td>
                                  <td style={{ padding: '4px', textAlign: 'center', color: diffColor(diffRev), fontWeight: '600', fontSize: '10px' }}>
                                    {Math.abs(diffRev) < 5 ? '✓' : (diffRev > 0 ? '+' : '') + '₡' + Math.abs(Math.round(diffRev)).toLocaleString('es-CR')}
                                  </td>
                                  <td style={{ padding: '4px', textAlign: 'right', color: '#1A1714', fontSize: '11px' }}>₡{Math.round(revisora).toLocaleString('es-CR')}</td>
                                  <td style={{ padding: '4px', textAlign: 'center', color: diffColor(diffAud), fontWeight: '600', fontSize: '10px' }}>
                                    {Math.abs(diffAud) < 5 ? '✓' : (diffAud > 0 ? '+' : '') + '₡' + Math.abs(Math.round(diffAud)).toLocaleString('es-CR')}
                                  </td>
                                  <td style={{ padding: '4px', textAlign: 'right', color: '#1A1714', fontSize: '11px' }}>₡{Math.round(qvet).toLocaleString('es-CR')}</td>
                                </tr>
                              );
                            })}
                            <tr style={{ borderTop: '2px solid #2a78a5', background: '#E8F3EC' }}>
                              <td style={{ padding: '8px', fontWeight: '700', color: '#1A1714', fontSize: '12px' }}>TOTAL INGRESOS</td>
                              <td style={{ padding: '4px', textAlign: 'right', fontWeight: '700', color: '#1A1714' }}>₡{Math.round(totalCajera).toLocaleString('es-CR')}</td>
                              <td style={{ padding: '4px', textAlign: 'center', color: diffColor(totalRevisora - totalCajera), fontWeight: '700', fontSize: '10px' }}>
                                {Math.abs(totalRevisora - totalCajera) < 5 ? '✓' : (totalRevisora - totalCajera > 0 ? '+' : '') + '₡' + Math.abs(Math.round(totalRevisora - totalCajera)).toLocaleString('es-CR')}
                              </td>
                              <td style={{ padding: '4px', textAlign: 'right', fontWeight: '700', color: '#1A1714' }}>₡{Math.round(totalRevisora).toLocaleString('es-CR')}</td>
                              <td style={{ padding: '4px', textAlign: 'center', color: diffColor(totalQvet - totalRevisora), fontWeight: '700', fontSize: '10px' }}>
                                {Math.abs(totalQvet - totalRevisora) < 5 ? '✓' : (totalQvet - totalRevisora > 0 ? '+' : '') + '₡' + Math.abs(Math.round(totalQvet - totalRevisora)).toLocaleString('es-CR')}
                              </td>
                              <td style={{ padding: '4px', textAlign: 'right', fontWeight: '700', color: '#1A1714' }}>₡{Math.round(totalQvet).toLocaleString('es-CR')}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

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
                                  comentario_auditoria: modalComentario,
                                  comentado_por: usuarioActual?.nombre || null
                                })
                              });

                              if (!res.ok) throw new Error('Error al guardar');

                              // Actualizar en local
                              setAuditRows(auditRows.map(r => r.id === modalAuditRow.id ? { ...r, comentario_auditoria: modalComentario, comentado_por: usuarioActual?.nombre || null } : r));
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

            {/* Conteo de denominaciones del período — Depósito CDS */}
            {auditRows.length > 0 && (() => {
              const DENOMS_CRC = [20000, 10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5];
              const totalRevCRC = auditRows
                .filter(r => r.tipo_movimiento === 'EFECTIVO')
                .reduce((s, r) => s + (r.monto_revisora || 0), 0);
              const totalContadoCRC = DENOMS_CRC.reduce((s, d) => s + ((denomsColones[d] || 0) * d), 0);
              const totalContadoUSD = denomsUSD.total || 0;

              // totalRevCRC ya trae los dólares convertidos (viene de monto_revisora del
              // EFECTIVO), así que de este lado hay que convertirlos también o la
              // diferencia da justo el monto en dólares y parece un faltante.
              // El TC sale de la revisión más reciente del período — el mismo que se usó
              // para calcular monto_revisora — y se muestra en pantalla para que se pueda
              // auditar de dónde salió.
              // Se busca en dos fuentes porque auditRows no siempre trae la relación:
              // cuando las filas se acaban de generar en el navegador vienen planas, sin
              // revision_caja. `cierres` sí está siempre cargado y trae tc.
              const tcMasReciente = (lista, getTc, getFecha) => {
                const conTc = lista
                  .map(x => ({ tc: parseFloat(getTc(x)) || 0, f: getFecha(x) || '' }))
                  .filter(x => x.tc > 0)
                  .sort((a, b) => (a.f < b.f ? 1 : -1));
                return conTc.length ? conTc[0].tc : 0;
              };
              const tcPeriodo =
                tcMasReciente(cierres, c => c.tc, c => c.fecha_hora) ||
                tcMasReciente(auditRows, r => r.revision_caja?.tc, r => r.revision_caja?.cierre_caja?.fecha_hora);
              const totalContadoUSDenCRC = Math.round(totalContadoUSD * tcPeriodo);
              const totalContadoGeneral = totalContadoCRC + totalContadoUSDenCRC;

              const diffCRC = totalContadoGeneral - totalRevCRC;
              const diffColorCRC = Math.abs(diffCRC) < 5 ? '#27AE60' : Math.abs(diffCRC) < 500 ? '#F39C12' : '#E74C3C';

              const fmtCRC = n => '₡' + Math.round(n).toLocaleString('es-CR');
              const fmtUSD = n => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

              return (
                <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '24px', overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', background: '#F0EDE6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1714' }}>Conteo de Denominaciones del Período</div>
                    {depositoGuardado && (
                      <div style={{ fontSize: '11px', color: '#27AE60', fontWeight: '600' }}>✅ Guardado · {depositoPeriodo?.contado_por}</div>
                    )}
                  </div>

                  <div style={{ padding: '20px' }}>
                    {depositoGuardado ? (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                          <div style={{ background: '#F0EDE6', padding: '14px 16px', borderRadius: '8px' }}>
                            <div style={{ fontSize: '10px', color: '#6B6560', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>Total contado</div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '700', color: '#1A1714' }}>{fmtCRC(totalContadoGeneral)}</div>
                            <div style={{ fontSize: '10px', color: '#9C9590', marginTop: '4px', fontFamily: "'DM Mono', monospace" }}>
                              {fmtCRC(totalContadoCRC)} + {fmtUSD(totalContadoUSD)}
                            </div>
                          </div>
                          <div style={{ background: '#F0EDE6', padding: '14px 16px', borderRadius: '8px' }}>
                            <div style={{ fontSize: '10px', color: '#6B6560', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>Revisora registró</div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '700', color: '#1A1714' }}>{fmtCRC(totalRevCRC)}</div>
                          </div>
                          <div style={{ background: Math.abs(diffCRC) < 5 ? '#E8F3EC' : Math.abs(diffCRC) < 500 ? '#FFF3CD' : '#FDE8E8', padding: '14px 16px', borderRadius: '8px' }}>
                            <div style={{ fontSize: '10px', color: '#6B6560', fontWeight: '600', textTransform: 'uppercase', marginBottom: '6px' }}>Diferencia</div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '700', color: diffColorCRC }}>
                              {Math.abs(diffCRC) < 5 ? '✓ Cuadra' : (diffCRC > 0 ? '+' : '') + fmtCRC(Math.abs(diffCRC))}
                            </div>
                          </div>
                        </div>
                        <div style={{ background: '#FBF6E9', padding: '14px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>
                            Total Dólares
                            {tcPeriodo > 0 && <span style={{ textTransform: 'none', fontWeight: '500', color: '#9C9590' }}> · al TC {tcPeriodo}</span>}
                          </span>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '20px', fontWeight: '700', color: '#C8A84B' }}>
                            {fmtUSD(totalContadoUSD)}
                            {tcPeriodo > 0 && <span style={{ color: '#2a78a5' }}> = {fmtCRC(totalContadoUSDenCRC)}</span>}
                          </span>
                        </div>
                      </>
                    ) : (
                    <>
                    {/* Colones */}
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#6B6560', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>Colones — ambas cajas</div>
                    {DENOMS_CRC.map((d, idx) => (
                      <div key={d} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 120px', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid #E2DDD4' }}>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', color: '#6B6560', fontWeight: '500' }}>₡{d.toLocaleString('es-CR')}</div>
                        <input
                          type="text"
                          inputMode="numeric"
                          ref={el => { window[`inputDepCRC${idx}`] = el; }}
                          value={denomsColones[d] === 0 || !denomsColones[d] ? '' : denomsColones[d].toLocaleString('es-CR')}
                          placeholder="0"
                          onChange={(e) => {
                            const val = parseInt(e.target.value.replace(/\s/g, '')) || 0;
                            setDenomsColones(prev => ({ ...prev, [d]: val }));
                            setDepositoGuardado(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); window[`inputDepCRC${idx + 1}`]?.focus(); }
                            if (e.key === 'ArrowUp') { e.preventDefault(); window[`inputDepCRC${idx - 1}`]?.focus(); }
                          }}
                          style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '15px', fontWeight: '500', textAlign: 'center', fontFamily: "'DM Mono', monospace" }}
                        />
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', color: '#2a78a5', fontWeight: '600', textAlign: 'right' }}>
                          {(denomsColones[d] || 0) > 0 ? fmtCRC((denomsColones[d] || 0) * d) : '—'}
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: '12px', padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#E8F3EC', marginBottom: '24px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Subtotal colones</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '700', color: '#2a78a5' }}>{fmtCRC(totalContadoCRC)}</span>
                    </div>

                    {/* USD */}
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#6B6560', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>Dólares — ambas cajas</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 120px', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid #E2DDD4', marginBottom: '12px' }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', color: '#6B6560', fontWeight: '500' }}>Total US$</div>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={denomsUSD.total === 0 || !denomsUSD.total ? '' : denomsUSD.total.toLocaleString('en-US')}
                        placeholder="0"
                        onChange={(e) => {
                          const val = parseFloat(e.target.value.replace(/,/g, '')) || 0;
                          setDenomsUSD({ total: val });
                          setDepositoGuardado(false);
                        }}
                        style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '15px', fontWeight: '500', textAlign: 'center', fontFamily: "'DM Mono', monospace" }}
                      />
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', color: '#C8A84B', fontWeight: '600', textAlign: 'right' }}>
                        {totalContadoUSD > 0 ? fmtUSD(totalContadoUSD) : '—'}
                      </div>
                    </div>
                    <div style={{ padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FBF6E9', marginBottom: '20px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>
                        Subtotal dólares
                        {tcPeriodo > 0 && <span style={{ textTransform: 'none', fontWeight: '500', color: '#9C9590' }}> · al TC {tcPeriodo}</span>}
                      </span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '700', color: '#C8A84B' }}>
                        {fmtUSD(totalContadoUSD)}
                        {tcPeriodo > 0 && <span style={{ color: '#2a78a5' }}> = {fmtCRC(totalContadoUSDenCRC)}</span>}
                      </span>
                    </div>

                    {/* Si no se pudo determinar el TC, los dólares no se suman y la
                        diferencia va a dar justo el monto en dólares. Antes eso pasaba
                        en silencio y parecía un faltante. */}
                    {totalContadoUSD > 0 && tcPeriodo === 0 && (
                      <div style={{ padding: '12px 16px', borderRadius: '8px', background: '#FFF3CD', border: '1px solid #F39C12', marginBottom: '20px', fontSize: '12px', color: '#6B6560' }}>
                        ⚠️ No se pudo determinar el tipo de cambio del período, así que los <strong>{fmtUSD(totalContadoUSD)}</strong> no están sumados al total. La diferencia de abajo va a salir inflada por ese monto.
                      </div>
                    )}

                    {/* Total general — es el que se compara contra la revisora, porque
                        monto_revisora ya trae los dólares convertidos a colones. */}
                    <div style={{ padding: '14px 16px', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', background: '#EDF4F8', border: '1.5px solid #2a78a5', marginBottom: '20px' }}>
                      <div>
                        <div style={{ fontSize: '10px', color: '#6B6560', fontWeight: '600', textTransform: 'uppercase' }}>Total contado</div>
                        <div style={{ fontSize: '9px', color: '#9C9590' }}>colones + dólares</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '700', color: '#2a78a5', marginTop: '2px' }}>{fmtCRC(totalContadoGeneral)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: '#6B6560', fontWeight: '600', textTransform: 'uppercase' }}>Revisora registró</div>
                        <div style={{ fontSize: '9px', color: '#9C9590' }}>todo en colones</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '700', color: '#1A1714', marginTop: '2px' }}>{fmtCRC(totalRevCRC)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: '#6B6560', fontWeight: '600', textTransform: 'uppercase' }}>Diferencia</div>
                        <div style={{ fontSize: '9px', color: '#9C9590' }}>&nbsp;</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '700', color: diffColorCRC, marginTop: '2px' }}>
                          {Math.abs(diffCRC) < 5 ? '✓ Cuadra' : (diffCRC > 0 ? '+' : '') + fmtCRC(Math.abs(diffCRC))}
                        </div>
                      </div>
                    </div>

                    <button
                      disabled={guardandoDeposito}
                      onClick={async () => {
                        setGuardandoDeposito(true);
                        try {
                          const inicio = periodo.inicio.toISOString().split('T')[0];
                          const fin = periodo.fin.toISOString().split('T')[0];
                          const res = await fetch('/api/depositos-cds', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              periodo_inicio: inicio,
                              periodo_fin: fin,
                              denominaciones_colones: denomsColones,
                              total_colones: totalContadoCRC,
                              denominaciones_usd: denomsUSD,
                              total_usd: totalContadoUSD,
                              contado_por: usuarioActual?.nombre || 'Sistema'
                            })
                          });
                          if (!res.ok) throw new Error('Error al guardar');
                          const saved = await res.json();
                          setDepositoPeriodo(saved);
                          setDepositoGuardado(true);
                        } catch (err) {
                          alert('Error: ' + err.message);
                        } finally {
                          setGuardandoDeposito(false);
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: depositoGuardado ? '#27AE60' : '#2a78a5',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: guardandoDeposito ? 'wait' : 'pointer'
                      }}
                    >
                      {guardandoDeposito ? 'Guardando...' : 'Guardar conteo del período'}
                    </button>
                    </>
                    )}
                  </div>
                </div>
              );
            })()}

            {auditRows.length === 0 && !loadingAudit && (
              <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#9C9590' }}>
                ⬆️ Sube un Excel para ver el comparativo
              </div>
            )}
            </>
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

