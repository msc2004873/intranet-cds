'use client';

import { useEffect, useState } from 'react';
import Header from './components/Header';

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

export default function Home() {
  const [tc, setTc] = useState(null);
  const [logs, setLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [periodo, setPeriodo] = useState(null);
  const [esPrimerDia, setEsPrimerDia] = useState(false);
  const [tcActual, setTcActual] = useState(null);
  const [showTCModal, setShowTCModal] = useState(false);
  const [periodsTC, setPeriodsTC] = useState([]);
  const [mesModalOffset, setMesModalOffset] = useState(0);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('cajera');

  useEffect(() => {
    // Asegurar que existan datos de prueba
    fetch('/api/periodos/ensure-test-data');

    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setUserName(user.nombre || '');
      setUserRole(user.rol || 'cajera');
    }

    fetchLogs();
    fetchPeriodoActual();
  }, []);

  async function fetchPeriodoActual() {
    try {
      const res = await fetch('/api/periodos/get-actual');
      const data = await res.json();
      setPeriodo(data.periodo);
      setEsPrimerDia(data.esPrimerDia);
      setTcActual(data.tipoCambio);
      setTc(data.tipoCambio);

      // Cargar TC de todos los períodos del mes
      await fetchTCPeriodos(0);
    } catch (err) {
      console.error('Error fetching período:', err);
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


  async function fetchLogs() {
    setLoading(true);
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  }

  const getTipoBadge = (tipo) => {
    const tiposMap = {
      'SINPE': { icon: '/sinpe-icon.svg', color: '#2a78a5', bg: '#E8F3EC' },
      'TRANSFERENCIA': { icon: '/transferencia-icon.svg', color: '#8B6914', bg: '#FBF6E9' },
      'SALIDA': { icon: '/salida-icon.svg', color: '#C0392B', bg: '#FDEDEC' },
      'Cobro Glory': { icon: '/cobro-icon.svg', color: '#2a78a5', bg: '#E8F3EC' }
    };
    const config = tiposMap[tipo] || { icon: '/home-icon.svg', color: '#6B6560', bg: '#F0EDE6' };
    return config;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
      <Header title="Corral del Sol" subtitle="Sistema interno" showLogout={true} />

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
        {/* Notificación roja si es primer día */}
        {esPrimerDia && (
          <div style={{
            background: '#DC2626',
            color: 'white',
            padding: '16px 24px',
            borderRadius: '12px',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(220,38,38,0.3)',
            fontSize: '18px',
            fontWeight: '700',
            letterSpacing: '0.5px',
            animation: 'pulse 2s infinite',
          }}>
            ⚠️ CAMBIAR TIPO DE CAMBIO
          </div>
        )}

        {/* TC del período */}
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

          {/* Período actual */}
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

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '600', color: '#1A1714', letterSpacing: '-0.4px' }}>Hola {userName}, ¿qué quieres hacer hoy?</h2>
          <p style={{ fontSize: '14px', color: '#6B6560', marginTop: '6px' }}>Seleccioná tu área de trabajo</p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '16px',
          maxWidth: '960px',
          width: '100%',
        }}>
          {userRole === 'cajera' && (
            <>
              <a href="/registros" style={buttonStyle} onMouseEnter={buttonHoverEnter} onMouseLeave={buttonHoverLeave}>
                <div style={{ width: '56px', height: '56px', background: '#E8F3EC', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '26px' }}>📝</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#1A1714', letterSpacing: '-0.2px' }}>Registrar movimiento</div>
                <div style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.5 }}>SINPE, transferencias y salidas</div>
                <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '20px', marginTop: '2px', background: '#E8F3EC', color: '#2a78a5' }}>Movimientos</span>
              </a>

              <a href="/cobros-glory" style={buttonStyle} onMouseEnter={buttonHoverEnter} onMouseLeave={buttonHoverLeave}>
                <div style={{ width: '56px', height: '56px', background: '#E8F3EC', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '26px' }}>🐕‍🦺</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#1A1714', letterSpacing: '-0.2px' }}>Cobros Glory</div>
                <div style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.5 }}>Registrá servicios de grooming y pagos realizados</div>
                <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '20px', marginTop: '2px', background: '#E8F3EC', color: '#2a78a5' }}>Glory</span>
              </a>

              <a href="/cajera" style={buttonStyle} onMouseEnter={buttonHoverEnter} onMouseLeave={buttonHoverLeave}>
                <div style={{ width: '56px', height: '56px', background: '#E8F3EC', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '26px' }}>💰</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#1A1714', letterSpacing: '-0.2px' }}>Cierre de Caja</div>
                <div style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.5 }}>Registrá las denominaciones, SINPE, tarjetas y subí el cierre QVet</div>
                <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '20px', marginTop: '2px', background: '#E8F3EC', color: '#2a78a5' }}>Cajera</span>
              </a>

              <a href="/conteo" style={buttonStyle} onMouseEnter={buttonHoverEnter} onMouseLeave={buttonHoverLeave}>
                <div style={{ width: '56px', height: '56px', background: '#FBF6E9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '26px' }}>📊</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#1A1714', letterSpacing: '-0.2px' }}>Conteo de Caja</div>
                <div style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.5 }}>Contá las denominaciones en cualquier momento</div>
                <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '20px', marginTop: '2px', background: '#FBF6E9', color: '#8B6914' }}>Conteo</span>
              </a>
            </>
          )}

          {userRole === 'admin' && (
            <>
              <a href="/revisora" style={buttonStyle} onMouseEnter={buttonHoverEnter} onMouseLeave={buttonHoverLeave}>
                <div style={{ width: '56px', height: '56px', background: '#FBF6E9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '26px' }}>🔍</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#1A1714', letterSpacing: '-0.2px' }}>Revisión de Caja</div>
                <div style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.5 }}>Revisá los cierres enviados y verificá los montos con el conteo físico</div>
                <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '20px', marginTop: '2px', background: '#FBF6E9', color: '#8B6914' }}>Revisión</span>
              </a>

              <a href="/depositos" style={buttonStyle} onMouseEnter={buttonHoverEnter} onMouseLeave={buttonHoverLeave}>
                <div style={{ width: '56px', height: '56px', background: '#FBF6E9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '26px' }}>🏦</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#1A1714', letterSpacing: '-0.2px' }}>Depósitos</div>
                <div style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.5 }}>Registrá y seguí depósitos bancarios</div>
                <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '20px', marginTop: '2px', background: '#FBF6E9', color: '#8B6914' }}>Depósitos</span>
              </a>

              <a href="/admin" style={buttonStyle} onMouseEnter={buttonHoverEnter} onMouseLeave={buttonHoverLeave}>
                <div style={{ width: '56px', height: '56px', background: '#EDE9F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '26px' }}>⚙️</span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#1A1714', letterSpacing: '-0.2px' }}>Administración</div>
                <div style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.5 }}>Agregar y gestionar colaboradores</div>
                <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '20px', marginTop: '2px', background: '#EDE9F6', color: '#5B35B5' }}>Admin</span>
              </a>
            </>
          )}
        </div>

        {/* Tabla de logs */}
        <div style={{ maxWidth: '960px', width: '100%', marginTop: '48px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1A1714' }}>Movimientos</h3>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1.5px solid #E2DDD4',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: "'DM Mono', monospace",
                color: '#1A1714',
              }}
            />
          </div>
          <div style={{
            background: '#FFFFFF',
            border: '1.5px solid #E2DDD4',
            borderRadius: '12px',
            overflow: 'hidden',
          }}>
            {loading ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9C9590' }}>Cargando...</div>
            ) : logs.filter(log => log.fecha === selectedDate).length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9C9590' }}>No hay movimientos para esta fecha</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F0EDE6', borderBottom: '1.5px solid #E2DDD4' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Movimiento</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Usuario</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Caja</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Hora</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.filter(log => log.fecha === selectedDate).sort((a, b) => b.timestamp - a.timestamp).map((log, idx) => {
                    const tipoBadge = getTipoBadge(log.tipo);
                    return (
                    <tr key={log.id} style={{ borderBottom: '1px solid #E2DDD4' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1A1714', fontWeight: '500' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          background: tipoBadge.bg,
                          color: tipoBadge.color,
                          fontWeight: '600',
                          fontSize: '12px',
                          textTransform: 'capitalize'
                        }}>
                          <img src={tipoBadge.icon} alt="" style={{ width: '14px', height: '14px' }} />
                          {log.tipo}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1A1714' }}>{log.usuario}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1A1714' }}>{log.caja}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6B6560', fontFamily: "'DM Mono', monospace" }}>{log.hora}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button
                          onClick={() => setSelectedLog(log)}
                          style={{
                            background: '#2a78a5',
                            color: 'white',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#1f5780'}
                          onMouseLeave={(e) => e.currentTarget.style.background = '#2a78a5'}
                        >
                          🔍 Ver
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal de TC por períodos */}
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

      {/* Modal de detalles */}
      {selectedLog && (
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
        }} onClick={() => setSelectedLog(null)}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '700px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          }} onClick={(e) => e.stopPropagation()}>
            <h4 style={{ fontSize: '18px', fontWeight: '600', color: '#1A1714', marginBottom: '20px' }}>📋 {selectedLog.tipo}</h4>

            <div style={{ display: 'grid', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Usuario</label>
                <div style={{ fontSize: '14px', color: '#1A1714' }}>{selectedLog.usuario}</div>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Caja</label>
                <div style={{ fontSize: '14px', color: '#1A1714' }}>{selectedLog.caja}</div>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Fecha y Hora</label>
                <div style={{ fontSize: '14px', color: '#1A1714' }}>{selectedLog.fecha} a las {selectedLog.hora}</div>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Detalles</label>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: '#F7F5F0', borderRadius: '8px', overflow: 'hidden' }}>
                  <tbody>
                    {selectedLog.data && (() => {
                      const entries = Object.entries(selectedLog.data);
                      const denomFields = entries.filter(([k]) => k.startsWith('c_'));
                      const otherFields = entries.filter(([k]) => !k.startsWith('c_') && !['id', 'created_at', 'updated_at'].includes(k));

                      return (
                        <>
                          {otherFields.map(([key, value]) => (
                            <tr key={key} style={{ borderBottom: '1px solid #E2DDD4' }}>
                              <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: '600', color: '#6B6560', background: '#F0EDE6', width: '35%', textTransform: 'capitalize' }}>{key}</td>
                              <td style={{ padding: '10px 12px', fontSize: '12px', color: '#1A1714', fontFamily: "'DM Mono', monospace", wordBreak: 'break-all' }}>
                                {typeof value === 'string' || typeof value === 'number' ? value : JSON.stringify(value)}
                              </td>
                            </tr>
                          ))}
                          {denomFields.length > 0 && (
                            <>
                              <tr style={{ borderBottom: '1px solid #E2DDD4', background: '#E8F3EC' }}>
                                <td colSpan="2" style={{ padding: '10px 12px', fontSize: '12px', fontWeight: '600', color: '#2a78a5' }}>📊 Denominaciones</td>
                              </tr>
                              {denomFields.map(([key, value]) => {
                                const denom = key.replace('c_', '');
                                return (
                                  <tr key={key} style={{ borderBottom: '1px solid #E2DDD4' }}>
                                    <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: '600', color: '#6B6560', background: '#F0EDE6', width: '35%' }}>₡{parseInt(denom).toLocaleString('es-CR')}</td>
                                    <td style={{ padding: '10px 12px', fontSize: '12px', color: '#1A1714' }}>{value} billetes</td>
                                  </tr>
                                );
                              })}
                            </>
                          )}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              onClick={() => setSelectedLog(null)}
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

      <div style={{
        textAlign: 'center',
        padding: '20px',
        fontSize: '11px',
        color: '#9C9590',
        fontFamily: "'DM Mono', monospace",
      }}>Corral del Sol © {new Date().getFullYear()} — Solo para uso interno</div>
    </div>
  );
}
