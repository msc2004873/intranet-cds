'use client';

import { useState, useEffect } from 'react';
import Header from '../components/Header';

export default function RevisionPage() {
  const [modulo, setModulo] = useState(null);
  const [revisor, setRevisor] = useState('');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setRevisor(user.nombre);
    }
  }, []);

  if (modulo === 'clinica') {
    return <RevisionClinica revisor={revisor} volver={() => setModulo(null)} />;
  }

  if (modulo === 'glory') {
    return <RevisionGlory revisor={revisor} volver={() => setModulo(null)} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Header title="Revisión de Caja" subtitle="Verifica cierres diarios" showLogout={false} />

      {/* Main */}
      <div style={{ flex: 1, maxWidth: '720px', margin: '0 auto', padding: '24px 16px', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '24px' }}>

        {/* Botón Clínica */}
        <button
          onClick={() => setModulo('clinica')}
          style={{
            padding: '48px 24px',
            background: 'linear-gradient(135deg, #E8F3EC 0%, #D4E8E0 100%)',
            border: '2px solid #2a78a5',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.3s',
            textAlign: 'center'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(42, 120, 165, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏥</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#1A1714', marginBottom: '8px' }}>Cajas Clínica</div>
          <div style={{ fontSize: '13px', color: '#6B6560' }}>Revisar cajas del período</div>
        </button>

        {/* Botón Glory */}
        <button
          onClick={() => setModulo('glory')}
          style={{
            padding: '48px 24px',
            background: 'linear-gradient(135deg, #FBF6E9 0%, #F7F0DB 100%)',
            border: '2px solid #C8A84B',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.3s',
            textAlign: 'center'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(200, 168, 75, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✨</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#1A1714', marginBottom: '8px' }}>Caja Glory</div>
          <div style={{ fontSize: '13px', color: '#6B6560' }}>Revisar cobros del período</div>
        </button>
      </div>
    </div>
  );
}

function RevisionClinica({ revisor, volver }) {
  const [periodo, setPeriodo] = useState('');
  const [fecha, setFecha] = useState('');
  const [cajas, setCajas] = useState([]);
  const [cierres, setCierres] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hoy = new Date().toISOString().split('T')[0];
    setFecha(hoy);
    cargarDatos(hoy);
  }, []);

  async function cargarDatos(fechaSeleccionada) {
    setLoading(true);
    try {
      const res = await fetch(`/api/cierreCaja?fecha=${fechaSeleccionada}`);
      const data = await res.json();

      // Agrupar por caja
      const porCaja = {};
      if (Array.isArray(data)) {
        data.forEach(cierre => {
          if (!porCaja[cierre.caja]) {
            porCaja[cierre.caja] = [];
          }
          porCaja[cierre.caja].push(cierre);
        });
      }

      setCajas(Object.keys(porCaja).sort());
      setCierres(porCaja);
    } catch (err) {
      console.error('Error cargando cierres:', err);
    } finally {
      setLoading(false);
    }
  }

  const fmt = n => '₡' + Math.round(n).toLocaleString('es-CR');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Header title="Revisión de Cajas — Clínica" subtitle="Verifica los cierres del período" showLogout={false} />

      <div style={{ flex: 1, maxWidth: '720px', margin: '0 auto', padding: '24px 16px', width: '100%' }}>

        {/* Selector de fecha */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '24px', padding: '20px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Fecha a revisar</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => {
              setFecha(e.target.value);
              cargarDatos(e.target.value);
            }}
            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px' }}
          />
        </div>

        {/* Cierres por caja */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9C9590' }}>⏳ Cargando...</div>
        ) : cajas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9C9590' }}>No hay cierres para esta fecha</div>
        ) : (
          cajas.map(caja => (
            <div key={caja} style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '24px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', background: '#F0EDE6', borderBottom: '1px solid #E2DDD4', fontWeight: '600', color: '#1A1714' }}>
                📦 {caja}
              </div>
              <div style={{ padding: '20px' }}>
                {cierres[caja]?.map(cierre => (
                  <div key={cierre.id} style={{ paddingBottom: '20px', borderBottom: '1px solid #E2DDD4' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1714' }}>{cierre.cajera}</div>
                        <div style={{ fontSize: '11px', color: '#9C9590' }}>{new Date(cierre.fecha_hora).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#2a78a5', fontFamily: "'DM Mono', monospace" }}>{fmt(cierre.c_20000 * 20000 + cierre.c_10000 * 10000 + cierre.c_5000 * 5000 + cierre.c_2000 * 2000 + cierre.c_1000 * 1000 + cierre.c_500 * 500 + cierre.c_100 * 100 + cierre.c_50 * 50 + cierre.c_25 * 25 + cierre.c_10 * 10 + cierre.c_5 * 5)}</div>
                        <div style={{ fontSize: '11px', color: '#9C9590' }}>Total en caja</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#6B6560', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>Tarjetas: {fmt(cierre.tarjeta_bac + cierre.tarjeta_bn)}</div>
                      <div>Dólares: ${cierre.dolares_total}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {/* Botón volver */}
        <button
          onClick={volver}
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

function RevisionGlory({ revisor, volver }) {
  const [periodo, setPeriodo] = useState('');
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [cobros, setCobros] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    cargarCobros(mes);
  }, [mes]);

  async function cargarCobros(mesSeleccionado) {
    setLoading(true);
    try {
      const [año, mesNum] = mesSeleccionado.split('-');
      const inicio = `${año}-${mesNum}-01`;
      const fin = `${año}-${mesNum}-31`;

      const res = await fetch(`/api/cobros-glory?cobrado=true&inicio=${inicio}&fin=${fin}`);
      const data = await res.json();
      setCobros(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando cobros:', err);
    } finally {
      setLoading(false);
    }
  }

  const fmt = n => '₡' + Math.round(n).toLocaleString('es-CR');
  const total = cobros.reduce((sum, c) => sum + (c.monto || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Header title="Revisión de Caja — Glory" subtitle="Cobros del período" showLogout={false} />

      <div style={{ flex: 1, maxWidth: '720px', margin: '0 auto', padding: '24px 16px', width: '100%' }}>

        {/* Selector de mes */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '24px', padding: '20px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Mes a revisar</label>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px' }}
          />
        </div>

        {/* Resumen */}
        <div style={{ background: '#FBF6E9', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '24px', padding: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '8px' }}>Total del período</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#C8A84B', fontFamily: "'DM Mono', monospace" }}>{fmt(total)}</div>
          <div style={{ fontSize: '12px', color: '#9C9590', marginTop: '8px' }}>{cobros.length} transacciones</div>
        </div>

        {/* Listado de cobros */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9C9590' }}>⏳ Cargando...</div>
        ) : cobros.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9C9590' }}>No hay cobros para este período</div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', overflow: 'hidden' }}>
            {cobros.map((cobro, i) => (
              <div key={cobro.id || i} style={{ padding: '16px 20px', borderBottom: i < cobros.length - 1 ? '1px solid #E2DDD4' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1714' }}>{cobro.nombre_mascota}</div>
                    <div style={{ fontSize: '11px', color: '#6B6560' }}>{cobro.nombre_dueno}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#C8A84B', fontFamily: "'DM Mono', monospace" }}>{fmt(cobro.monto)}</div>
                    <div style={{ fontSize: '11px', color: '#6B6560' }}>{cobro.metodo}</div>
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#9C9590' }}>{cobro.cajera} • {new Date(cobro.hora_cobro).toLocaleDateString('es-CR')}</div>
              </div>
            ))}
          </div>
        )}

        {/* Botón volver */}
        <button
          onClick={volver}
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
