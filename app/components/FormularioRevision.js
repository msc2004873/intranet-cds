'use client';

import { useState, useEffect } from 'react';
import Header from './Header';

const formatearMiles = (num) => {
  if (!num) return '';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const parsearMiles = (str) => {
  if (typeof str === 'number') return Math.round(str);
  return parseInt(str.replace(/\s/g, '')) || 0;
};

const fmtMonto = (monto, moneda = 'colones') => {
  const simbolo = moneda === 'usd' ? '$' : '₡';
  return simbolo + Math.round(monto).toLocaleString('es-CR');
};

export default function FormularioRevision({ cierre, periodo, onVolver, onGuardar }) {
  const [denominaciones, setDenominaciones] = useState({
    20000: '',
    10000: '',
    5000: '',
    2000: '',
    1000: '',
    500: '',
    100: '',
    50: '',
    25: '',
    10: '',
    5: '',
  });

  const [tarjetas, setTarjetas] = useState({
    bac: '',
    bn: '',
  });

  const [dolares, setDolares] = useState('');
  const [sinpeRevisado, setSinpeRevisado] = useState([]);
  const [transfRevisadas, setTransfRevisadas] = useState([]);
  const [salidEvaluadas, setSalidEvaluadas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [tipoCambio, setTipoCambio] = useState(475);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [imagenPopup, setImagenPopup] = useState(null);
  const [resumenComparacion, setResumenComparacion] = useState(null);

  useEffect(() => {
    cargarDetalles();
    cargarTipoCambio();
    cargarUsuario();
  }, [cierre?.id, periodo?.num]);

  function cargarUsuario() {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setUsuarioActual(user);
    } catch (err) {
      console.error('Error cargando usuario:', err);
    }
  }

  async function cargarDetalles() {
    try {
      // Cargar desde JSON guardado en el cierre (puede venir como array o string)
      const sinpesDb = cierre?.sinpe_json
        ? (typeof cierre.sinpe_json === 'string' ? JSON.parse(cierre.sinpe_json) : cierre.sinpe_json)
        : [];
      const transfsDb = cierre?.depositos_json
        ? (typeof cierre.depositos_json === 'string' ? JSON.parse(cierre.depositos_json) : cierre.depositos_json)
        : [];
      const salidasDb = cierre?.salidas_json
        ? (typeof cierre.salidas_json === 'string' ? JSON.parse(cierre.salidas_json) : cierre.salidas_json)
        : [];

      // Luego cargar desde movimientos para capturar lo que llegó después del cierre
      if (cierre?.fecha_hora) {
        // Convertir fecha_hora UTC a fecha CR (UTC-6)
        const fechaObj = new Date(cierre.fecha_hora);
        const crFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Costa_Rica',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        const crDate = crFormatter.format(fechaObj);
        const [m, d, y] = crDate.split('/');
        const fecha = `${y}-${m}-${d}`;
        const cajaParam = cierre.caja ? `&caja=${encodeURIComponent(cierre.caja)}` : '';

        try {
          const [sinpeRes, transfRes, salidaRes] = await Promise.all([
            fetch(`/api/movimientos?tipo=SINPE&fecha=${fecha}${cajaParam}`),
            fetch(`/api/movimientos?tipo=TRANSFERENCIA&fecha=${fecha}${cajaParam}`),
            fetch(`/api/movimientos?tipo=SALIDA&fecha=${fecha}${cajaParam}`)
          ]);

          const sinpesApi = await sinpeRes.json();
          const transfsApi = await transfRes.json();
          const salidasApi = await salidaRes.json();

          if (Array.isArray(sinpesApi) && sinpesApi.length > 0) {
            setSinpeRevisado(sinpesApi.map(s => ({ ...s, monto_revisado: '', aprobado: false, rechazado: false })));
          } else {
            setSinpeRevisado(sinpesDb.map(s => ({ ...s, monto_revisado: '', aprobado: false, rechazado: false })));
          }

          if (Array.isArray(transfsApi) && transfsApi.length > 0) {
            setTransfRevisadas(transfsApi.map(t => ({ ...t, monto_revisado: '', aprobado: false, rechazado: false })));
          } else {
            setTransfRevisadas(transfsDb.map(t => ({ ...t, monto_revisado: '', aprobado: false, rechazado: false })));
          }

          if (Array.isArray(salidasApi) && salidasApi.length > 0) {
            setSalidEvaluadas(salidasApi.map(s => ({ ...s, monto_revisado: '', aprobado: false, rechazado: false })));
          } else {
            setSalidEvaluadas(salidasDb.map(s => ({ ...s, monto_revisado: '', aprobado: false, rechazado: false })));
          }
        } catch (apiErr) {
          console.error('Error cargando desde API, usando JSON guardado:', apiErr);
          setSinpeRevisado(sinpesDb.map(s => ({ ...s, monto_revisado: '', aprobado: false })));
          setTransfRevisadas(transfsDb.map(t => ({ ...t, monto_revisado: '', aprobado: false })));
          setSalidEvaluadas(salidasDb.map(s => ({ ...s, aprobado: false })));
        }
      }
    } catch (err) {
      console.error('Error cargando detalles:', err);
    }
  }

  async function cargarTipoCambio() {
    if (!periodo || !cierre?.fecha_hora) return;

    try {
      const fecha = new Date(cierre.fecha_hora).toISOString().split('T')[0];
      const res = await fetch(`/api/periodos/get-tc?fecha=${fecha}&periodo=${periodo.num}`);
      const data = await res.json();
      setTipoCambio(data.tipo_cambio_ajustado || 455);
    } catch (err) {
      console.error('Error cargando TC:', err);
      setTipoCambio(455);
    }
  }

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  async function guardarRevision() {
    setLoading(true);
    try {
      const denomsNumeros = Object.fromEntries(
        Object.entries(denominaciones).map(([k, v]) => [k, parsearMiles(v)])
      );
      const tarjetasNumeros = {
        bac: parsearMiles(tarjetas.bac),
        bn: parsearMiles(tarjetas.bn),
      };

      const res = await fetch('/api/revisionCaja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cierre_id: cierre.id,
          denominaciones: denomsNumeros,
          tarjetas: tarjetasNumeros,
          dolares: parsearMiles(dolares),
          sinpeRevisado: sinpeRevisado.map(s => ({ ...s, monto_revisado: parsearMiles(s.monto_revisado) })),
          transfRevisadas: transfRevisadas.map(t => ({ ...t, monto_revisado: parsearMiles(t.monto_revisado) })),
          salidEvaluadas,
        }),
      });

      if (res.ok) {
        showToast('✅ Revisión guardada correctamente', 'success');

        // Generar resumen de comparación
        const resumen = {
          sinpe: sinpeRevisado.map(s => ({
            referencia: s.referencia,
            monto_cajera: parsearMiles(s.monto || 0),
            monto_revisado: parsearMiles(s.monto_revisado),
            coincide: parsearMiles(s.monto || 0) === parsearMiles(s.monto_revisado),
            aprobado: s.aprobado,
            rechazado: s.rechazado,
            moneda: s.moneda
          })),
          transferencias: transfRevisadas.map(t => ({
            descripcion: t.descripcion,
            monto_cajera: parsearMiles(t.monto || 0),
            monto_revisado: parsearMiles(t.monto_revisado),
            coincide: parsearMiles(t.monto || 0) === parsearMiles(t.monto_revisado),
            aprobado: t.aprobado,
            rechazado: t.rechazado,
            moneda: t.moneda
          })),
          salidas: salidEvaluadas.map(s => ({
            descripcion: s.descripcion,
            monto_cajera: parsearMiles(s.monto || 0),
            monto_revisado: parsearMiles(s.monto_revisado),
            coincide: parsearMiles(s.monto || 0) === parsearMiles(s.monto_revisado),
            aprobado: s.aprobado,
            rechazado: s.rechazado,
            moneda: s.moneda
          }))
        };

        setResumenComparacion(resumen);
        // No llamar a onGuardar() aquí - dejar que el usuario cierre el resumen primero
      } else {
        showToast('❌ Error al guardar la revisión', 'error');
      }
    } catch (err) {
      console.error('Error guardando revisión:', err);
      showToast('❌ Error de conexión', 'error');
    } finally {
      setLoading(false);
    }
  }

  const totalEnCaja = Object.entries(denominaciones).reduce((sum, [denom, cant]) => {
    return sum + (parseInt(denom) * parsearMiles(cant));
  }, 0);

  const totalTarjetas = parsearMiles(tarjetas.bac) + parsearMiles(tarjetas.bn);
  const totalDolares = parsearMiles(dolares) * tipoCambio;
  const totalSinpe = sinpeRevisado.reduce((sum, s) => sum + parsearMiles(s.monto_revisado), 0);
  const totalTransf = transfRevisadas.reduce((sum, t) => sum + parsearMiles(t.monto_revisado), 0);
  const totalSalidas = salidEvaluadas.reduce((sum, s) => sum + s.monto, 0);
  const granTotal = totalEnCaja + totalTarjetas + totalDolares + totalSinpe + totalTransf + totalSalidas;

  const fmt = n => '₡' + formatearMiles(Math.round(n));

  const handleDenomChange = (denom, value) => {
    setDenominaciones({ ...denominaciones, [denom]: formatearMiles(parsearMiles(value)) });
  };

  const handleTarjetaChange = (banco, value) => {
    setTarjetas({ ...tarjetas, [banco]: formatearMiles(parsearMiles(value)) });
  };

  const handleDolaresChange = (value) => {
    setDolares(formatearMiles(parsearMiles(value)));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Header title="Revisión de Cierre" subtitle={`${cierre?.cajera} — ${new Date(cierre?.fecha_hora).toLocaleDateString('es-CR')}`} showLogout={false} />

      <div style={{ flex: 1, maxWidth: '720px', margin: '0 auto', padding: '24px 16px', width: '100%', overflowY: 'auto' }}>

        {/* Info de Revisión */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', background: '#F0EDE6' }}>
            <div style={{ width: '26px', height: '26px', background: '#2a78a5', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>ℹ</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Información de revisión</div>
          </div>
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Cajera</label>
              <div style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px', background: '#F0EDE6', color: '#1A1714', fontWeight: '600' }}>
                {cierre?.cajera || '—'}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Revisa</label>
              <div style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px', background: '#F0EDE6', color: '#1A1714', fontWeight: '600' }}>
                {usuarioActual?.nombre || '—'}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Fecha</label>
              <input type="text" value={cierre?.fecha_hora ? new Date(cierre.fecha_hora).toLocaleDateString('es-CR') : '—'} readOnly style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', background: '#F0EDE6', color: '#6B6560', fontFamily: "'DM Mono', monospace" }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Caja</label>
              <input type="text" value={cierre?.caja || '—'} readOnly style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', background: '#F0EDE6', color: '#6B6560' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Hora cierre</label>
              <input type="text" value={cierre?.fecha_hora ? new Date(cierre.fecha_hora).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }) : '—'} readOnly style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', background: '#F0EDE6', color: '#6B6560', fontFamily: "'DM Mono', monospace" }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>TC Período</label>
              <input type="number" value={tipoCambio} readOnly style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', background: '#F0EDE6', color: '#6B6560', fontSize: '14px', fontFamily: "'DM Mono', monospace", fontWeight: '600' }} />
            </div>
          </div>
        </div>

        {/* 1. Denominaciones */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', background: '#F0EDE6' }}>
            <div style={{ width: '26px', height: '26px', background: '#2a78a5', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>1</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Cierre de caja — denominaciones</div>
          </div>

          <div style={{ padding: '20px' }}>
            {[20000, 10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5].map((denom, idx) => {
              const valor = parsearMiles(denominaciones[denom]);
              const subtotal = parseInt(denom) * valor;
              const label = denom >= 1000 ? `₡${(denom / 1000).toFixed(0)}k` : `₡${denom}`;

              return (
                <div key={denom} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 110px', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid #E2DDD4' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', color: '#6B6560', fontWeight: '500' }}>
                    {label}
                  </div>
                  <input
                    ref={(el) => (window[`inputDenom${idx}`] = el)}
                    type="text"
                    value={valor === 0 ? '' : valor.toLocaleString('es-CR')}
                    onChange={(e) => handleDenomChange(denom, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        const nextInput = window[`inputDenom${idx + 1}`];
                        if (nextInput) nextInput.focus();
                      }
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const prevInput = window[`inputDenom${idx - 1}`];
                        if (prevInput) prevInput.focus();
                      }
                    }}
                    placeholder="0"
                    inputMode="numeric"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      border: '1.5px solid #E2DDD4',
                      borderRadius: '8px',
                      fontSize: '15px',
                      fontWeight: '500',
                      textAlign: 'center',
                      fontFamily: "'DM Mono', monospace"
                    }}
                  />
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', color: '#2a78a5', fontWeight: '600', textAlign: 'right' }}>
                    {fmt(subtotal)}
                  </div>
                </div>
              );
            })}

            <div style={{ marginTop: '14px', padding: '14px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#E8F3EC' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Total en caja</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '600', color: '#2a78a5' }}>{fmt(totalEnCaja)}</span>
            </div>
          </div>
        </div>

        {/* 2. Dólares */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', background: '#F0EDE6' }}>
            <div style={{ width: '26px', height: '26px', background: '#2a78a5', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>2</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Dólares</div>
          </div>
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: '12px', alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Total dólares ($)</label>
              <input
                type="text"
                value={dolares === 0 ? '' : dolares.toLocaleString('es-CR')}
                onChange={(e) => handleDolaresChange(e.target.value)}
                placeholder="0"
                inputMode="decimal"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1.5px solid #E2DDD4',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: "'DM Mono', monospace",
                }}
              />
            </div>
            <div style={{ padding: '10px 12px', background: '#E8F3EC', borderRadius: '8px', fontFamily: "'DM Mono', monospace", fontSize: '13px', color: '#2a78a5', fontWeight: '600', textAlign: 'center' }}>
              ×{tipoCambio}
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Equivalente en colones</label>
              <div style={{ padding: '10px 12px', background: '#E8F3EC', borderRadius: '8px', fontFamily: "'DM Mono', monospace", fontSize: '13px', color: '#2a78a5', fontWeight: '600' }}>
                {fmt(parsearMiles(dolares) * tipoCambio)}
              </div>
            </div>
          </div>
        </div>

        {/* 3. Tarjetas */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', background: '#F0EDE6' }}>
            <div style={{ width: '26px', height: '26px', background: '#2a78a5', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>3</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Tarjetas</div>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div style={{ border: '1.5px solid #E2DDD4', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#6B6560', marginBottom: '8px' }}>BAC</div>
                <input
                  type="text"
                  value={tarjetas.bac === 0 ? '' : tarjetas.bac.toLocaleString('es-CR')}
                  onChange={(e) => handleTarjetaChange('bac', e.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                  style={{
                    width: '100%',
                    border: 'none',
                    padding: '0',
                    fontSize: '20px',
                    fontWeight: '600',
                    fontFamily: "'DM Mono', monospace",
                    outline: 'none'
                  }}
                />
                <div style={{ fontSize: '12px', color: '#9C9590', marginTop: '2px' }}>colones</div>
              </div>
              <div style={{ border: '1.5px solid #E2DDD4', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#6B6560', marginBottom: '8px' }}>BN</div>
                <input
                  type="text"
                  value={tarjetas.bn === 0 ? '' : tarjetas.bn.toLocaleString('es-CR')}
                  onChange={(e) => handleTarjetaChange('bn', e.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                  style={{
                    width: '100%',
                    border: 'none',
                    padding: '0',
                    fontSize: '20px',
                    fontWeight: '600',
                    fontFamily: "'DM Mono', monospace",
                    outline: 'none'
                  }}
                />
                <div style={{ fontSize: '12px', color: '#9C9590', marginTop: '2px' }}>colones</div>
              </div>
            </div>
            <div style={{ padding: '14px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', background: '#E8F3EC' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Total tarjetas</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '600', color: '#2a78a5' }}>
                {fmt(parsearMiles(tarjetas.bac) + parsearMiles(tarjetas.bn))}
              </span>
            </div>
          </div>
        </div>

        {/* 4. SINPE */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between', background: '#F0EDE6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '26px', height: '26px', background: '#2a78a5', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>4</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>SINPE Móvil</div>
            </div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#2a78a5', fontFamily: "'DM Mono', monospace" }}>
              {fmt(totalSinpe)}
            </div>
          </div>
          <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {sinpeRevisado.length > 0 ? (
              sinpeRevisado.map((sinpe, i) => {
                const borde = sinpe.aprobado ? '#27AE60' : sinpe.rechazado ? '#E74C3C' : '#E2DDD4';
                return (
                  <div key={i} style={{ border: `2px solid ${borde}`, borderRadius: '10px', overflow: 'hidden', background: '#fff', transition: 'border-color 0.2s' }}>
                    {sinpe.archivo_url ? (
                      <div onClick={() => setImagenPopup(sinpe.archivo_url)} style={{ height: '110px', background: `url(${sinpe.archivo_url}) center/cover no-repeat #F7F5F0`, cursor: 'zoom-in' }} />
                    ) : (
                      <div style={{ height: '110px', background: '#F7F5F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#C8C4BC' }}>📄</div>
                    )}
                    <div style={{ padding: '8px 10px' }}>
                      <input
                        type="text"
                        value={sinpe.monto_revisado === 0 ? '' : sinpe.monto_revisado.toLocaleString('es-CR')}
                        onChange={(e) => { const u = [...sinpeRevisado]; u[i] = { ...u[i], monto_revisado: parseFloat(e.target.value.replace(/\s/g, '')) || 0 }; setSinpeRevisado(u); }}
                        placeholder="Escribir monto visto"
                        inputMode="numeric"
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #E2DDD4', borderRadius: '6px', fontFamily: "'DM Mono', monospace", fontSize: '13px', fontWeight: '600', textAlign: 'center', marginBottom: '4px' }}
                      />
                      <div style={{ fontSize: '11px', color: '#9C9590', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {sinpe.referencia || '—'}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#9C9590', fontSize: '12px', gridColumn: '1 / -1' }}>
                No se registraron SINPE — ₡0
              </div>
            )}
          </div>
          <div style={{ padding: '0 16px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Total SINPE</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '600', color: '#2a78a5' }}>{fmt(totalSinpe)}</span>
          </div>
        </div>

        {/* 5. Transferencias */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between', background: '#F0EDE6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '26px', height: '26px', background: '#2a78a5', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>5</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Transferencias</div>
            </div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#2a78a5', fontFamily: "'DM Mono', monospace" }}>
              {fmt(totalTransf)}
            </div>
          </div>
          <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {transfRevisadas.length > 0 ? (
              transfRevisadas.map((transf, i) => {
                const borde = transf.aprobado ? '#27AE60' : transf.rechazado ? '#E74C3C' : '#E2DDD4';
                return (
                  <div key={i} style={{ border: `2px solid ${borde}`, borderRadius: '10px', overflow: 'hidden', background: '#fff', transition: 'border-color 0.2s' }}>
                    {transf.archivo_url ? (
                      <div onClick={() => setImagenPopup(transf.archivo_url)} style={{ height: '110px', background: `url(${transf.archivo_url}) center/cover no-repeat #F7F5F0`, cursor: 'zoom-in' }} />
                    ) : (
                      <div style={{ height: '110px', background: '#F7F5F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#C8C4BC' }}>📄</div>
                    )}
                    <div style={{ padding: '8px 10px' }}>
                      <input
                        type="text"
                        value={transf.monto_revisado === 0 ? '' : transf.monto_revisado.toLocaleString('es-CR')}
                        onChange={(e) => { const u = [...transfRevisadas]; u[i] = { ...u[i], monto_revisado: parseFloat(e.target.value.replace(/\s/g, '')) || 0 }; setTransfRevisadas(u); }}
                        placeholder="Escribir monto visto"
                        inputMode="numeric"
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #E2DDD4', borderRadius: '6px', fontFamily: "'DM Mono', monospace", fontSize: '13px', fontWeight: '600', textAlign: 'center', marginBottom: '4px' }}
                      />
                      <div style={{ fontSize: '11px', color: '#9C9590', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {transf.descripcion || '—'}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#9C9590', fontSize: '12px', gridColumn: '1 / -1' }}>
                No se registraron Transferencias — ₡0
              </div>
            )}
          </div>
          <div style={{ padding: '0 16px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Total transferencias</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '600', color: '#2a78a5' }}>{fmt(totalTransf)}</span>
          </div>
        </div>

        {/* 6. Salidas de Caja */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between', background: '#F0EDE6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '26px', height: '26px', background: '#2a78a5', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>6</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Salidas de caja</div>
            </div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#C0392B', fontFamily: "'DM Mono', monospace" }}>
              {fmt(totalSalidas)}
            </div>
          </div>
          <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {salidEvaluadas.length > 0 ? (
              salidEvaluadas.map((salida, i) => {
                const borde = salida.aprobado ? '#C0392B' : salida.rechazado ? '#E74C3C' : '#E2DDD4';
                return (
                  <div key={i} style={{ border: `2px solid ${borde}`, borderRadius: '10px', overflow: 'hidden', background: '#fff', transition: 'border-color 0.2s' }}>
                    {salida.archivo_url ? (
                      <div onClick={() => setImagenPopup(salida.archivo_url)} style={{ height: '110px', background: `url(${salida.archivo_url}) center/cover no-repeat #F7F5F0`, cursor: 'zoom-in' }} />
                    ) : (
                      <div style={{ height: '110px', background: '#F7F5F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#C8C4BC' }}>📄</div>
                    )}
                    <div style={{ padding: '8px 10px' }}>
                      <input
                        type="text"
                        value={salida.monto_revisado === 0 ? '' : salida.monto_revisado.toLocaleString('es-CR')}
                        onChange={(e) => { const u = [...salidEvaluadas]; u[i] = { ...u[i], monto_revisado: parseFloat(e.target.value.replace(/\s/g, '')) || 0 }; setSalidEvaluadas(u); }}
                        placeholder="Escribir monto visto"
                        inputMode="numeric"
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #E2DDD4', borderRadius: '6px', fontFamily: "'DM Mono', monospace", fontSize: '13px', fontWeight: '600', textAlign: 'center', marginBottom: '4px' }}
                      />
                      <div style={{ fontSize: '11px', color: '#9C9590', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {salida.descripcion || '—'}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#9C9590', fontSize: '12px', gridColumn: '1 / -1' }}>
                No se registraron Salidas — ₡0
              </div>
            )}
          </div>
          <div style={{ padding: '0 16px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Total salidas</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '600', color: '#C0392B' }}>{fmt(totalSalidas)}</span>
          </div>
        </div>

        {/* Resumen */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', background: '#F0EDE6' }}>
            <div style={{ width: '26px', height: '26px', background: '#2a78a5', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '600' }}>✓</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Resumen de revisión</div>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: '#6B6560' }}>En caja</div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#1A1714', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>{fmt(totalEnCaja)}</div>

              <div style={{ fontSize: '12px', color: '#6B6560' }}>Tarjetas</div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#1A1714', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>{fmt(totalTarjetas)}</div>

              <div style={{ fontSize: '12px', color: '#6B6560' }}>Dólares (USD)</div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#1A1714', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>{fmt(totalDolares)}</div>

              <div style={{ fontSize: '12px', color: '#6B6560' }}>SINPE</div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#1A1714', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>{fmt(totalSinpe)}</div>

              <div style={{ fontSize: '12px', color: '#6B6560' }}>Transferencias</div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#1A1714', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>{fmt(totalTransf)}</div>

              <div style={{ fontSize: '12px', color: '#6B6560' }}>Salidas</div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#1A1714', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>{fmt(totalSalidas)}</div>
            </div>
            <div style={{ borderTop: '2px solid #E2DDD4', paddingTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#2a78a5' }}>TOTAL GENERAL</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#2a78a5', textAlign: 'right', fontFamily: "'DM Mono', monospace" }}>{fmt(granTotal)}</div>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px', marginBottom: '24px' }}>
          <button
            onClick={onVolver}
            style={{
              padding: '16px',
              background: '#F0EDE6',
              color: '#6B6560',
              border: '1.5px solid #E2DDD4',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = '#E2DDD4'}
            onMouseLeave={(e) => e.target.style.background = '#F0EDE6'}
          >
            ✕ Volver
          </button>
          <button
            onClick={guardarRevision}
            disabled={loading}
            style={{
              padding: '16px',
              background: loading ? '#ccc' : '#2a78a5',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'default' : 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => !loading && (e.target.style.background = '#1f5780')}
            onMouseLeave={(e) => !loading && (e.target.style.background = '#2a78a5')}
          >
            {loading ? '⏳ Guardando...' : '✓ Guardar revisión'}
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: toast.type === 'success' ? '#E8F3EC' : toast.type === 'error' ? '#FDEDEC' : '#F0EDE6',
            border: `1.5px solid ${toast.type === 'success' ? '#27AE60' : toast.type === 'error' ? '#E74C3C' : '#E2DDD4'}`,
            borderRadius: '8px',
            padding: '14px 16px',
            color: toast.type === 'success' ? '#27AE60' : toast.type === 'error' ? '#C0392B' : '#6B6560',
            fontSize: '13px',
            fontWeight: '600',
            maxWidth: '300px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 9999,
            animation: 'slideIn 0.3s ease-out'
          }}>
            {toast.msg}
          </div>
        )}

        {/* Modal de imagen */}
        {imagenPopup && (
          <div
            onClick={() => setImagenPopup(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9998,
              padding: '20px',
              cursor: 'pointer'
            }}
          >
            <img
              src={imagenPopup}
              alt="Comprobante"
              style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* Modal de comparación de montos */}
        {resumenComparacion && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9997,
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '24px'
            }}>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#1A1714', marginBottom: '20px', textAlign: 'center' }}>
                Comparación de montos
              </div>

              {resumenComparacion.sinpe.length > 0 && (
                <>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#2a78a5', marginBottom: '10px' }}>SINPE</div>
                  {resumenComparacion.sinpe.map((item, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '10px', marginBottom: '10px', background: item.coincide ? '#E8F3EC' : '#FDEDEC', borderRadius: '8px', borderLeft: `3px solid ${item.coincide ? '#27AE60' : '#E74C3C'}` }}>
                      <div style={{ fontSize: '11px', color: '#6B6560' }}>
                        <div style={{ fontWeight: '600', color: '#1A1714' }}>Ref: {item.referencia}</div>
                        <div>Cajera: {fmtMonto(item.monto_cajera, item.moneda)}</div>
                        <div>Revisado: {fmtMonto(item.monto_revisado, item.moneda)}</div>
                      </div>
                      <div style={{ fontSize: '11px', textAlign: 'right', color: '#6B6560', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontWeight: '600', color: item.coincide ? '#27AE60' : '#E74C3C', fontSize: '12px' }}>
                          {item.coincide ? '✓ Coincide' : '✗ Diferencia'}
                        </div>
                        {!item.coincide && (
                          <div style={{ color: '#E74C3C', fontWeight: '600' }}>
                            Δ {fmtMonto(Math.abs(item.monto_revisado - item.monto_cajera), item.moneda)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {resumenComparacion.transferencias.length > 0 && (
                <>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#2a78a5', marginBottom: '10px', marginTop: '15px' }}>TRANSFERENCIAS</div>
                  {resumenComparacion.transferencias.map((item, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '10px', marginBottom: '10px', background: item.coincide ? '#E8F3EC' : '#FDEDEC', borderRadius: '8px', borderLeft: `3px solid ${item.coincide ? '#27AE60' : '#E74C3C'}` }}>
                      <div style={{ fontSize: '11px', color: '#6B6560' }}>
                        <div style={{ fontWeight: '600', color: '#1A1714' }}>Desc: {item.descripcion}</div>
                        <div>Cajera: {fmtMonto(item.monto_cajera, item.moneda)}</div>
                        <div>Revisado: {fmtMonto(item.monto_revisado, item.moneda)}</div>
                      </div>
                      <div style={{ fontSize: '11px', textAlign: 'right', color: '#6B6560', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontWeight: '600', color: item.coincide ? '#27AE60' : '#E74C3C', fontSize: '12px' }}>
                          {item.coincide ? '✓ Coincide' : '✗ Diferencia'}
                        </div>
                        {!item.coincide && (
                          <div style={{ color: '#E74C3C', fontWeight: '600' }}>
                            Δ {fmtMonto(Math.abs(item.monto_revisado - item.monto_cajera), item.moneda)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {resumenComparacion.salidas.length > 0 && (
                <>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#C0392B', marginBottom: '10px', marginTop: '15px' }}>SALIDAS</div>
                  {resumenComparacion.salidas.map((item, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '10px', marginBottom: '10px', background: item.coincide ? '#E8F3EC' : '#FDEDEC', borderRadius: '8px', borderLeft: `3px solid ${item.coincide ? '#27AE60' : '#E74C3C'}` }}>
                      <div style={{ fontSize: '11px', color: '#6B6560' }}>
                        <div style={{ fontWeight: '600', color: '#1A1714' }}>Desc: {item.descripcion}</div>
                        <div>Cajera: {fmtMonto(item.monto_cajera, item.moneda)}</div>
                        <div>Revisado: {fmtMonto(item.monto_revisado, item.moneda)}</div>
                      </div>
                      <div style={{ fontSize: '11px', textAlign: 'right', color: '#6B6560', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontWeight: '600', color: item.coincide ? '#27AE60' : '#E74C3C', fontSize: '12px' }}>
                          {item.coincide ? '✓ Coincide' : '✗ Diferencia'}
                        </div>
                        {!item.coincide && (
                          <div style={{ color: '#E74C3C', fontWeight: '600' }}>
                            Δ {fmtMonto(Math.abs(item.monto_revisado - item.monto_cajera), item.moneda)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}

              <button
                onClick={() => {
                  setResumenComparacion(null);
                  setTimeout(() => onGuardar(), 300);
                }}
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
                  marginTop: '20px'
                }}
                onMouseEnter={(e) => e.target.style.background = '#1f5780'}
                onMouseLeave={(e) => e.target.style.background = '#2a78a5'}
              >
                ✓ Listo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
