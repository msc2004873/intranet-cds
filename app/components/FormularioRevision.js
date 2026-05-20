'use client';

import { useState, useEffect } from 'react';
import Header from './Header';

const formatearMiles = (num) => {
  if (!num) return '';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const parsearMiles = (str) => {
  return parseInt(str.replace(/,/g, '')) || 0;
};

export default function FormularioRevision({ cierre, onVolver, onGuardar }) {
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

  useEffect(() => {
    cargarDetalles();
  }, [cierre?.id]);

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
        onGuardar();
      }
    } catch (err) {
      console.error('Error guardando revisión:', err);
      alert('Error al guardar la revisión');
    } finally {
      setLoading(false);
    }
  }

  const totalEnCaja = Object.entries(denominaciones).reduce((sum, [denom, cant]) => {
    return sum + (parseInt(denom) * parsearMiles(cant));
  }, 0);

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

        {/* 1. Denominaciones */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
          <div style={{ background: '#F0EDE6', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#2a78a5', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '14px' }}>
              1
            </div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1A1714' }}>
              Cierre de caja — denominaciones
            </div>
          </div>

          <div style={{ padding: '16px' }}>
            {[20000, 10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5].map(denom => {
              const valor = parsearMiles(denominaciones[denom]);
              const subtotal = parseInt(denom) * valor;
              const label = denom >= 1000 ? `₡${(denom / 1000).toFixed(0)}k` : `₡${denom}`;

              return (
                <div key={denom} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #E2DDD4' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#6B6560', minWidth: '60px' }}>
                    {label}
                  </label>
                  <input
                    type="text"
                    value={denominaciones[denom]}
                    onChange={(e) => handleDenomChange(denom, e.target.value)}
                    style={{
                      width: '120px',
                      padding: '8px 12px',
                      border: '1px solid #E2DDD4',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontFamily: "'DM Mono', monospace",
                      textAlign: 'center',
                      background: '#fff',
                    }}
                    placeholder="0"
                  />
                  <div style={{ width: '70px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#C8A84B', fontFamily: "'DM Mono', monospace" }}>
                    {fmt(subtotal)}
                  </div>
                </div>
              );
            })}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', marginTop: '8px', fontWeight: '700', color: '#2a78a5', fontSize: '14px' }}>
              <span>TOTAL EN CAJA</span>
              <span style={{ fontFamily: "'DM Mono', monospace" }}>{fmt(totalEnCaja)}</span>
            </div>
          </div>
        </div>

        {/* 2. Dólares */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
          <div style={{ background: '#F0EDE6', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#2a78a5', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '14px' }}>
              2
            </div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1A1714' }}>
              Dólares
            </div>
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Total dólares ($)
                </label>
                <input
                  type="text"
                  value={dolares}
                  onChange={(e) => handleDolaresChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #E2DDD4',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontFamily: "'DM Mono', monospace",
                  }}
                  placeholder="0"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Equivalente en colones
                  </label>
                  <div style={{ padding: '8px 12px', background: '#E8F3EC', borderRadius: '6px', fontSize: '12px', fontWeight: '600', color: '#2a78a5' }}>
                    ×475
                  </div>
                </div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#2a78a5', fontFamily: "'DM Mono', monospace", marginBottom: '0px' }}>
                  {fmt(parsearMiles(dolares) * 475)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Tarjetas */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
          <div style={{ background: '#F0EDE6', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#2a78a5', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '14px' }}>
              3
            </div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1A1714' }}>
              Tarjetas
            </div>
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', display: 'block', marginBottom: '6px' }}>BAC</label>
                <input
                  type="text"
                  value={tarjetas.bac}
                  onChange={(e) => handleTarjetaChange('bac', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #E2DDD4',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontFamily: "'DM Mono', monospace",
                  }}
                  placeholder="0"
                />
                <div style={{ fontSize: '10px', color: '#9C9590', marginTop: '4px' }}>colones</div>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', display: 'block', marginBottom: '6px' }}>BN</label>
                <input
                  type="text"
                  value={tarjetas.bn}
                  onChange={(e) => handleTarjetaChange('bn', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #E2DDD4',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontFamily: "'DM Mono', monospace",
                  }}
                  placeholder="0"
                />
                <div style={{ fontSize: '10px', color: '#9C9590', marginTop: '4px' }}>colones</div>
              </div>
            </div>
            <div style={{ padding: '12px', background: '#E8F3EC', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Total tarjetas</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#2a78a5', fontFamily: "'DM Mono', monospace" }}>
                {fmt(parsearMiles(tarjetas.bac) + parsearMiles(tarjetas.bn))}
              </div>
            </div>
          </div>
        </div>

        {/* 4. SINPE */}
        {sinpeRevisado.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
            <div style={{ background: '#F0EDE6', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#2a78a5', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '14px' }}>
                4
              </div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1A1714' }}>
                SINPE
              </div>
            </div>
            <div style={{ padding: '16px' }}>
              {sinpeRevisado.map((sinpe, i) => (
                <div key={i} style={{ marginBottom: i < sinpeRevisado.length - 1 ? '16px' : '0', paddingBottom: '16px', borderBottom: i < sinpeRevisado.length - 1 ? '1px solid #E2DDD4' : 'none' }}>
                  {sinpe.archivo_url && (
                    <img src={sinpe.archivo_url} alt="SINPE" style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }} />
                  )}
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', marginBottom: '6px' }}>Ref: {sinpe.referencia}</div>
                  <input
                    type="text"
                    value={sinpe.monto_revisado}
                    onChange={(e) => {
                      const updated = [...sinpeRevisado];
                      updated[i].monto_revisado = formatearMiles(parsearMiles(e.target.value));
                      setSinpeRevisado(updated);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #E2DDD4',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontFamily: "'DM Mono', monospace",
                    }}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Transferencias */}
        {transfRevisadas.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
            <div style={{ background: '#F0EDE6', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#2a78a5', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '14px' }}>
                5
              </div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1A1714' }}>
                Transferencias
              </div>
            </div>
            <div style={{ padding: '16px' }}>
              {transfRevisadas.map((transf, i) => (
                <div key={i} style={{ marginBottom: i < transfRevisadas.length - 1 ? '16px' : '0', paddingBottom: '16px', borderBottom: i < transfRevisadas.length - 1 ? '1px solid #E2DDD4' : 'none' }}>
                  {transf.archivo_url && (
                    <img src={transf.archivo_url} alt="Transferencia" style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }} />
                  )}
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', marginBottom: '6px' }}>Descripción: {transf.descripcion}</div>
                  <input
                    type="text"
                    value={transf.monto_revisado}
                    onChange={(e) => {
                      const updated = [...transfRevisadas];
                      updated[i].monto_revisado = formatearMiles(parsearMiles(e.target.value));
                      setTransfRevisadas(updated);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #E2DDD4',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontFamily: "'DM Mono', monospace",
                    }}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. Salidas de Caja */}
        {salidEvaluadas.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
            <div style={{ background: '#F0EDE6', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#2a78a5', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '14px' }}>
                6
              </div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1A1714' }}>
                Salidas de Caja
              </div>
            </div>
            <div style={{ padding: '16px' }}>
              {salidEvaluadas.map((salida, i) => (
                <div key={i} style={{ marginBottom: i < salidEvaluadas.length - 1 ? '16px' : '0', paddingBottom: '16px', borderBottom: i < salidEvaluadas.length - 1 ? '1px solid #E2DDD4' : 'none' }}>
                  {salida.archivo_url && (
                    <img src={salida.archivo_url} alt="Salida" style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }} />
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560' }}>{salida.descripcion}</div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#1A1714', marginTop: '4px', fontFamily: "'DM Mono', monospace" }}>
                        ₡{formatearMiles(Math.round(salida.monto))}
                      </div>
                    </div>
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
                      border: '1px solid ' + (salida.aprobado ? '#2a78a5' : '#E2DDD4'),
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {salida.aprobado ? '✅ Aprobada' : '⬜ Aprobar'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botones */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '24px', marginBottom: '24px' }}>
          <button
            onClick={onVolver}
            style={{
              padding: '12px',
              background: '#F0EDE6',
              color: '#6B6560',
              border: '1.5px solid #E2DDD4',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            ✕ Limpiar
          </button>
          <button
            onClick={guardarRevision}
            disabled={loading}
            style={{
              padding: '12px',
              background: loading ? '#ccc' : '#2a78a5',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading ? 'default' : 'pointer'
            }}
          >
            {loading ? '⏳ Guardando...' : '✓ Guardar conteo'}
          </button>
        </div>
      </div>
    </div>
  );
}
