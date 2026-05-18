'use client';

import { useEffect, useState } from 'react';
import Header from './components/Header';

export default function Home() {
  const [tc, setTc] = useState(null);
  const [logs, setLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [periodo, setPeriodo] = useState(null);
  const [esPrimerDia, setEsPrimerDia] = useState(false);
  const [tcActual, setTcActual] = useState(null);

  useEffect(() => {
    fetchTipoCambio();
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
    } catch (err) {
      console.error('Error fetching período:', err);
    }
  }

  async function fetchTipoCambio() {
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await res.json();
      if (data.rates && data.rates.CRC) {
        const tcInternet = Math.round(data.rates.CRC);
        const tcAjustado = tcInternet - 10;
        setTc(tcAjustado);
      }
    } catch (err) {
      setTc(475);
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
          <div style={{
            background: '#2a78a5',
            color: 'white',
            padding: '20px 32px',
            borderRadius: '16px',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(42,120,165,0.2)',
            minWidth: '200px',
          }}>
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: '600' }}>Tipo de cambio del período</div>
            <div style={{ fontSize: '36px', fontWeight: '700', fontFamily: "'DM Mono', monospace", letterSpacing: '-1px' }}>₡{tcActual || '—'}</div>
            <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '6px' }}>Período {periodo}</div>
          </div>

          {/* Período actual */}
          <div style={{
            background: '#6366F1',
            color: 'white',
            padding: '20px 32px',
            borderRadius: '16px',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(99,102,241,0.2)',
            minWidth: '200px',
          }}>
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: '600' }}>Período actual</div>
            <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Período {periodo}</div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>{new Date().toLocaleDateString('es-CR', { day: 'numeric', month: 'long' })}</div>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '600', color: '#1A1714', letterSpacing: '-0.4px' }}>¿Qué querés hacer hoy?</h2>
          <p style={{ fontSize: '14px', color: '#6B6560', marginTop: '6px' }}>Seleccioná tu área de trabajo</p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '16px',
          maxWidth: '960px',
          width: '100%',
        }}>
          <a href="/registros" style={{
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
          }} onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#2a78a5';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(42,120,165,0.12)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }} onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#E2DDD4';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'translateY(0)';
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: '#E8F3EC',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: '26px' }}>📝</span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#1A1714', letterSpacing: '-0.2px' }}>Registrar movimiento</div>
            <div style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.5 }}>SINPE, transferencias y salidas</div>
            <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '20px', marginTop: '2px', background: '#E8F3EC', color: '#2a78a5' }}>Movimientos</span>
          </a>

          <a href="/cobros-glory" style={{
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
          }} onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#2a78a5';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(42,120,165,0.12)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }} onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#E2DDD4';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'translateY(0)';
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: '#E8F3EC',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: '26px' }}>🐕‍🦺</span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#1A1714', letterSpacing: '-0.2px' }}>Cobros Glory</div>
            <div style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.5 }}>Registrá servicios de grooming y pagos realizados</div>
            <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '20px', marginTop: '2px', background: '#E8F3EC', color: '#2a78a5' }}>Glory</span>
          </a>

          <a href="/cajera" style={{
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
          }} onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#2a78a5';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(42,120,165,0.12)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }} onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#E2DDD4';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'translateY(0)';
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: '#E8F3EC',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: '26px' }}>💰</span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#1A1714', letterSpacing: '-0.2px' }}>Cierre de Caja</div>
            <div style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.5 }}>Registrá las denominaciones, SINPE, tarjetas y subí el cierre QVet</div>
            <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '20px', marginTop: '2px', background: '#E8F3EC', color: '#2a78a5' }}>Cajera</span>
          </a>

          <a href="/conteo" style={{
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
          }} onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#2a78a5';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(42,120,165,0.12)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }} onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#E2DDD4';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'translateY(0)';
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: '#FBF6E9',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: '26px' }}>📊</span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#1A1714', letterSpacing: '-0.2px' }}>Conteo de Caja</div>
            <div style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.5 }}>Contá las denominaciones en cualquier momento</div>
            <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '20px', marginTop: '2px', background: '#FBF6E9', color: '#8B6914' }}>Conteo</span>
          </a>

          <a href="/revisora" style={{
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
          }} onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#2a78a5';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(42,120,165,0.12)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }} onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#E2DDD4';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'translateY(0)';
          }}>
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
            <div style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.5 }}>Revisá los cierres enviados y verificá los montos con el conteo físico</div>
            <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '20px', marginTop: '2px', background: '#FBF6E9', color: '#8B6914' }}>Revisora</span>
          </a>

          <a href="/admin" style={{
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
          }} onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#2a78a5';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(42,120,165,0.12)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }} onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#E2DDD4';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'translateY(0)';
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: '#EDE9F6',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: '26px' }}>⚙️</span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#1A1714', letterSpacing: '-0.2px' }}>Administración</div>
            <div style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.5 }}>Agregar y gestionar colaboradores</div>
            <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '20px', marginTop: '2px', background: '#EDE9F6', color: '#5B35B5' }}>Admin</span>
          </a>
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
                  {logs.filter(log => log.fecha === selectedDate).map((log, idx) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #E2DDD4' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: '#1A1714', fontWeight: '500' }}>{log.tipo}</td>
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
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

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
            maxWidth: '500px',
            width: '90%',
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
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Detalle</label>
                <div style={{ fontSize: '14px', color: '#1A1714', background: '#F7F5F0', padding: '12px', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  <pre style={{ margin: 0, fontFamily: "'DM Mono', monospace", fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {JSON.stringify(selectedLog.data, null, 2)}
                  </pre>
                </div>
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
