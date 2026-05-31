'use client';

import { useState, useEffect } from 'react';
import Header from './Header';

const formatearMiles = (num) => {
  if (!num) return '';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

const parsearMiles = (str) => {
  return parseInt(str.replace(/\s/g, '')) || 0;
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
      const sinpes = cierre?.sinpe_json ? JSON.parse(cierre.sinpe_json) : [];
      const transfs = cierre?.depositos_json ? JSON.parse(cierre.depositos_json) : [];
      const salidas = cierre?.salidas_json ? JSON.parse(cierre.salidas_json) : [];

      setSinpeRevisado(sinpes.map(s => ({ ...s, monto_revisado: '', aprobado: false })));
      setTransfRevisadas(transfs.map(t => ({ ...t, monto_revisado: '', aprobado: false })));
      setSalidEvaluadas(salidas.map(s => ({ ...s, aprobado: false })));
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
      setTipoCambio(data.tipo_cambio || 475);
    } catch (err) {
      console.error('Error cargando TC:', err);
      setTipoCambio(475);
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
        setTimeout(() => onGuardar(), 500);
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
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Período</label>
              <input type="text" value={`P${periodo?.num || '—'}`} readOnly style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', background: '#F0EDE6', color: '#6B6560' }} />
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
                    type="text"
                    value={denominaciones[denom] === 0 || denominaciones[denom] === undefined ? '' : (denominaciones[denom] || 0).toLocaleString('es-CR')}
                    onChange={(e) => handleDenomChange(denom, e.target.value)}
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
          <div style={{ padding: '20px' }}>
            {sinpeRevisado.length > 0 ? (
              sinpeRevisado.map((sinpe, i) => (
                <div key={i} style={{ marginBottom: i < sinpeRevisado.length - 1 ? '16px' : '0' }}>
                  {sinpe.archivo_url && (
                    <img src={sinpe.archivo_url} alt="SINPE" style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }} />
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#F7F5F0', borderRadius: '6px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#6B6560' }}>Ref: {sinpe.referencia}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', fontWeight: '600', color: '#2a78a5' }}>{fmt(parsearMiles(sinpe.monto_revisado))}</span>
                  </div>
                  <input
                    type="text"
                    value={sinpe.monto_revisado === 0 ? '' : sinpe.monto_revisado.toLocaleString('es-CR')}
                    onChange={(e) => {
                      const updated = [...sinpeRevisado];
                      updated[i].monto_revisado = formatearMiles(parsearMiles(e.target.value));
                      setSinpeRevisado(updated);
                    }}
                    placeholder="0"
                    inputMode="numeric"
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
              ))
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#9C9590', fontSize: '12px' }}>
                No se registraron SINPE — ₡0
              </div>
            )}
            <div style={{ marginTop: '12px', padding: '14px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', background: '#E8F3EC' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Total SINPE</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '600', color: '#2a78a5' }}>{fmt(totalSinpe)}</span>
            </div>
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
          <div style={{ padding: '20px' }}>
            {transfRevisadas.length > 0 ? (
              transfRevisadas.map((transf, i) => (
                <div key={i} style={{ marginBottom: i < transfRevisadas.length - 1 ? '16px' : '0' }}>
                  {transf.archivo_url && (
                    <img src={transf.archivo_url} alt="Transferencia" style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }} />
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#F7F5F0', borderRadius: '6px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#6B6560' }}>{transf.descripcion || 'Transferencia'}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', fontWeight: '600', color: '#2a78a5' }}>{fmt(parsearMiles(transf.monto_revisado))}</span>
                  </div>
                  <input
                    type="text"
                    value={transf.monto_revisado === 0 ? '' : transf.monto_revisado.toLocaleString('es-CR')}
                    onChange={(e) => {
                      const updated = [...transfRevisadas];
                      updated[i].monto_revisado = formatearMiles(parsearMiles(e.target.value));
                      setTransfRevisadas(updated);
                    }}
                    placeholder="0"
                    inputMode="numeric"
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
              ))
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#9C9590', fontSize: '12px' }}>
                No se registraron Transferencias — ₡0
              </div>
            )}
            <div style={{ marginTop: '12px', padding: '14px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', background: '#E8F3EC' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Total transferencias</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '600', color: '#2a78a5' }}>{fmt(totalTransf)}</span>
            </div>
          </div>
        </div>

        {/* 6. Salidas de Caja */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between', background: '#F0EDE6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '26px', height: '26px', background: '#2a78a5', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>6</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Salidas de caja</div>
            </div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#2a78a5', fontFamily: "'DM Mono', monospace" }}>
              {fmt(totalSalidas)}
            </div>
          </div>
          <div style={{ padding: '20px' }}>
            {salidEvaluadas.length > 0 ? (
              salidEvaluadas.map((salida, i) => (
                <div key={i} style={{ marginBottom: i < salidEvaluadas.length - 1 ? '16px' : '0' }}>
                  {salida.archivo_url && (
                    <img src={salida.archivo_url} alt="Salida" style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }} />
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#FDEDEC', borderRadius: '6px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#6B6560' }}>{salida.descripcion || 'Salida'}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', fontWeight: '600', color: '#C0392B' }}>-{fmt(salida.monto)}</span>
                  </div>
                  <button
                    onClick={() => {
                      const updated = [...salidEvaluadas];
                      updated[i].aprobado = !updated[i].aprobado;
                      setSalidEvaluadas(updated);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px',
                      background: salida.aprobado ? '#2a78a5' : '#F0EDE6',
                      color: salida.aprobado ? 'white' : '#6B6560',
                      border: '1.5px solid ' + (salida.aprobado ? '#2a78a5' : '#E2DDD4'),
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {salida.aprobado ? '✅ Aprobada' : '⬜ Aprobar'}
                  </button>
                </div>
              ))
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#9C9590', fontSize: '12px' }}>
                No se registraron Salidas — ₡0
              </div>
            )}
            <div style={{ marginTop: '12px', padding: '14px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', background: '#FDEDEC' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Total salidas</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '600', color: '#C0392B' }}>{fmt(totalSalidas)}</span>
            </div>
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
      </div>
    </div>
  );
}
