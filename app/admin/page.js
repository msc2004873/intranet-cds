'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';

const buttonStyle = {
  background: '#FFFFFF',
  border: '1.5px solid #E2DDD4',
  borderRadius: '16px',
  padding: '28px 20px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '12px',
  cursor: 'pointer',
  textDecoration: 'none',
  color: 'inherit',
  transition: 'all 0.2s ease',
  textAlign: 'center',
};

const buttonHoverEnter = (e) => {
  e.currentTarget.style.borderColor = '#2a78a5';
  e.currentTarget.style.boxShadow = '0 4px 20px rgba(42,120,165,0.12)';
  e.currentTarget.style.transform = 'translateY(-2px)';
};

const buttonHoverLeave = (e) => {
  e.currentTarget.style.borderColor = '#E2DDD4';
  e.currentTarget.style.boxShadow = 'none';
  e.currentTarget.style.transform = 'translateY(0)';
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Colones: separador de espacio (es-CR) y redondeo a entero en display (ver CLAUDE.md, Regla 2)
const fmtColones = (n) => '₡' + Math.round(n || 0).toLocaleString('es-CR');

const navBtnStyle = {
  background: '#F0EDE6',
  border: '1px solid #E2DDD4',
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  fontSize: '16px',
  fontWeight: '600',
  cursor: 'pointer',
  color: '#6B6560',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export default function AdminPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState('');
  const [tcActual, setTcActual] = useState(null);
  const [periodo, setPeriodo] = useState(null);
  const [showTCModal, setShowTCModal] = useState(false);
  const [periodsTC, setPeriodsTC] = useState([]);
  const [mesModalOffset, setMesModalOffset] = useState(0);
  const [ingresos, setIngresos] = useState(null);
  const [ingresosOffset, setIngresosOffset] = useState(0);
  const [loadingIngresos, setLoadingIngresos] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setUserRole(user.rol || '');
      if (user.rol !== 'admin') {
        router.push('/');
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    if (userRole === 'admin') {
      fetchPeriodoActual();
      fetchIngresos(0);
    }
  }, [userRole]);

  async function fetchPeriodoActual() {
    try {
      const res = await fetch('/api/periodos/get-actual');
      const data = await res.json();
      setPeriodo(data.periodo);
      setTcActual(data.tipoCambio);
      await fetchTCPeriodos(0);
    } catch (err) {
      console.error('Error fetching período:', err);
    }
  }

  async function fetchIngresos(offset = 0) {
    try {
      setLoadingIngresos(true);
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Costa_Rica',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const [mes, , ano] = formatter.format(now).split('/');
      const mesTarget = new Date(parseInt(ano), parseInt(mes) - 1 + offset, 1);
      const anoT = mesTarget.getFullYear();
      const mesT = mesTarget.getMonth() + 1;

      const res = await fetch(`/api/ingresos-periodo?ano=${anoT}&mes=${mesT}`);
      const data = await res.json();
      setIngresos(data.error ? null : data);
    } catch (err) {
      console.error('Error fetching ingresos:', err);
      setIngresos(null);
    } finally {
      setLoadingIngresos(false);
    }
  }

  async function fetchTCPeriodos(offset = 0) {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Costa_Rica',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const [mes, dia, ano] = formatter.format(now).split('/');
      const anoTarget = parseInt(ano);
      const mesActual = parseInt(mes);
      const mesTarget = new Date(anoTarget, mesActual - 1 + offset, 1);
      const anoTargetFinal = mesTarget.getFullYear();
      const mesTargetNum = mesTarget.getMonth() + 1;

      const res = await fetch(`/api/periodos/tc-mes?ano=${anoTargetFinal}&mes=${mesTargetNum}`);
      const data = await res.json();

      if (!data.periodos) {
        setPeriodsTC([]);
        return;
      }

      setPeriodsTC(data.periodos);
    } catch (err) {
      console.error('Error fetching TC períodos:', err);
    }
  }

  if (!userRole) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando...</div>;
  }

  if (userRole !== 'admin') {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header title="Administración" subtitle="Gestión del sistema" showLogout={true} showModuleSelector={true} />

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 16px',
        gap: '32px',
        background: '#F7F5F0',
        color: '#1A1714',
      }}>
        {/* TC y Período */}
        <div style={{
          display: 'flex',
          gap: '16px',
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}>
          <button
            onClick={() => setShowTCModal(true)}
            style={{
              background: '#2a78a5',
              color: 'white',
              padding: '20px 32px',
              borderRadius: '16px',
              textAlign: 'center',
              boxShadow: '0 4px 12px rgba(42,120,165,0.2)',
              minWidth: '200px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#1f5780';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(42,120,165,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#2a78a5';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(42,120,165,0.2)';
            }}
          >
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: '600' }}>Tipo de cambio del período</div>
            <div style={{ fontSize: '36px', fontWeight: '700', fontFamily: "'DM Mono', monospace", letterSpacing: '-1px' }}>₡{tcActual || '—'}</div>
            <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '6px' }}>Período {periodo} • Click para ver todos</div>
          </button>

          <div style={{
            background: '#2a78a5',
            color: 'white',
            padding: '20px 32px',
            borderRadius: '16px',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(42,120,165,0.2)',
            minWidth: '200px',
          }}>
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: '600' }}>Período actual</div>
            <div style={{ fontSize: '28px', fontWeight: '700', fontFamily: "'DM Mono', monospace", letterSpacing: '-0.5px', marginBottom: '6px' }}>
              {new Date().getDate()} de {new Date().toLocaleDateString('es-CR', { month: 'short' })}
            </div>
            <div style={{ fontSize: '10px', opacity: 0.7 }}>Período {periodo}</div>
          </div>
        </div>

        {/* Ingresos cobrados por período */}
        <div style={{
          width: '100%',
          maxWidth: '960px',
          background: '#FFFFFF',
          border: '1.5px solid #E2DDD4',
          borderRadius: '16px',
          padding: '24px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>💰</span>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1A1714', margin: 0, letterSpacing: '-0.3px' }}>Ingresos cobrados</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button onClick={() => { const o = ingresosOffset - 1; setIngresosOffset(o); fetchIngresos(o); }} style={navBtnStyle} aria-label="Mes anterior">←</button>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714', minWidth: '130px', textAlign: 'center', textTransform: 'capitalize' }}>
                {(() => {
                  const d = new Date();
                  const t = new Date(d.getFullYear(), d.getMonth() + ingresosOffset, 1);
                  return `${MESES[t.getMonth()]} ${t.getFullYear()}`;
                })()}
              </span>
              <button onClick={() => { const o = ingresosOffset + 1; setIngresosOffset(o); fetchIngresos(o); }} style={navBtnStyle} aria-label="Mes siguiente">→</button>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6B6560', fontWeight: '600', marginBottom: '6px' }}>Total del mes</div>
            <div style={{ fontSize: '40px', fontWeight: '700', fontFamily: "'DM Mono', monospace", color: '#27AE60', letterSpacing: '-1px' }}>
              {loadingIngresos ? '…' : fmtColones(ingresos?.totalMes)}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
            {(ingresos?.periodos || [1, 2, 3, 4, 5, 6].map((n) => ({ periodo_num: n, dia_inicio: 0, dia_fin: 0, total: 0, cierres: 0 }))).map((p) => {
              const esActual = ingresosOffset === 0 && p.periodo_num === periodo;
              return (
                <div key={p.periodo_num} style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: esActual ? '#E8F3EC' : '#F7F5F0',
                  border: esActual ? '2px solid #27AE60' : '1px solid #E2DDD4',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Período {p.periodo_num}</div>
                  <div style={{ fontSize: '10px', color: '#9C9590', marginBottom: '8px' }}>{p.dia_inicio ? `${p.dia_inicio}–${p.dia_fin}` : '—'}</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', fontFamily: "'DM Mono', monospace", color: p.total > 0 ? '#1A1714' : '#C7C2BA' }}>
                    {loadingIngresos ? '…' : fmtColones(p.total)}
                  </div>
                  <div style={{ fontSize: '10px', color: '#9C9590', marginTop: '4px' }}>{p.cierres} {p.cierres === 1 ? 'cierre' : 'cierres'}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '600', color: '#1A1714', letterSpacing: '-0.4px' }}>¿Qué necesitás administrar?</h2>
          <p style={{ fontSize: '14px', color: '#6B6560', marginTop: '6px' }}>Selecciona la sección que deseas gestionar</p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '16px',
          maxWidth: '960px',
          width: '100%',
        }}>
          <a href="/admin/revision" style={buttonStyle} onMouseEnter={buttonHoverEnter} onMouseLeave={buttonHoverLeave}>
            <div style={{
              width: '56px',
              height: '56px',
              background: '#FBF6E9',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: '26px' }}>🔍</span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#1A1714', letterSpacing: '-0.2px' }}>Revisión de Caja</div>
            <div style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.5 }}>Revisá y validá los cierres de caja</div>
            <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '20px', marginTop: '2px', background: '#FBF6E9', color: '#8B6914' }}>Revisión</span>
          </a>

          <a href="/admin/depositos" style={buttonStyle} onMouseEnter={buttonHoverEnter} onMouseLeave={buttonHoverLeave}>
            <div style={{
              width: '56px',
              height: '56px',
              background: '#FBF6E9',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: '26px' }}>🏦</span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#1A1714', letterSpacing: '-0.2px' }}>Depósitos</div>
            <div style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.5 }}>Registrá y seguí depósitos bancarios</div>
            <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '20px', marginTop: '2px', background: '#FBF6E9', color: '#8B6914' }}>Depósitos</span>
          </a>

          <a href="/admin/colaboradores" style={buttonStyle} onMouseEnter={buttonHoverEnter} onMouseLeave={buttonHoverLeave}>
            <div style={{
              width: '56px',
              height: '56px',
              background: '#EDE9F6',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: '26px' }}>👥</span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#1A1714', letterSpacing: '-0.2px' }}>Colaboradores</div>
            <div style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.5 }}>Gestiona usuarios y permisos del sistema</div>
            <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '20px', marginTop: '2px', background: '#EDE9F6', color: '#5B35B5' }}>Usuarios</span>
          </a>

          <a href="/admin/etiquetas" style={buttonStyle} onMouseEnter={buttonHoverEnter} onMouseLeave={buttonHoverLeave}>
            <div style={{
              width: '56px',
              height: '56px',
              background: '#E8F3EC',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: '26px' }}>🏷️</span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#1A1714', letterSpacing: '-0.2px' }}>Etiquetas</div>
            <div style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.5 }}>Imprimí etiquetas de productos desde Q-VET</div>
            <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '20px', marginTop: '2px', background: '#E8F3EC', color: '#1a7a4a' }}>Etiquetas</span>
          </a>
        </div>
      </div>

      {/* Modal de TC */}
      {showTCModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }} onClick={() => setShowTCModal(false)}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <button
                onClick={() => {
                  setMesModalOffset(mesModalOffset - 1);
                  fetchTCPeriodos(mesModalOffset - 1);
                }}
                style={{
                  background: '#F0EDE6',
                  border: '1px solid #E2DDD4',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  color: '#6B6560',
                }}
              >
                ← Anterior
              </button>
              <h4 style={{ fontSize: '18px', fontWeight: '600', color: '#1A1714', margin: '0' }}>
                💱 Tipos de cambio de {(() => {
                  const hoy = new Date();
                  const mesTarget = new Date(hoy.getFullYear(), hoy.getMonth() + mesModalOffset, 1);
                  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                  return meses[mesTarget.getMonth()];
                })()}
              </h4>
              <button
                onClick={() => {
                  setMesModalOffset(mesModalOffset + 1);
                  fetchTCPeriodos(mesModalOffset + 1);
                }}
                style={{
                  background: '#F0EDE6',
                  border: '1px solid #E2DDD4',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  color: '#6B6560',
                }}
              >
                Siguiente →
              </button>
            </div>

            <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
              {periodsTC.map(p => {
                const esDelPeriodoActual = mesModalOffset === 0 && p.periodo_num === periodo;

                return (
                  <div key={p.periodo_num} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 16px',
                    background: esDelPeriodoActual ? '#E8F3EC' : '#F7F5F0',
                    borderRadius: '8px',
                    border: esDelPeriodoActual ? '2px solid #2a78a5' : 'none',
                  }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1714' }}>
                        Período {p.periodo_num}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6B6560', marginTop: '2px' }}>
                        {p.fecha_inicio} a {p.fecha_fin}
                      </div>
                    </div>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      fontFamily: "'DM Mono', monospace",
                      color: '#2a78a5',
                    }}>
                      {p.esFuturo ? '—' : (p.tipo_cambio_ajustado ? `₡${p.tipo_cambio_ajustado}` : '—')}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setShowTCModal(false)}
              style={{
                width: '100%',
                padding: '12px',
                background: '#2a78a5',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#1f5780'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#2a78a5'}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
