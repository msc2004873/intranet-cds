'use client';

import { useState, useEffect } from 'react';
import Header from './Header';

export default function FormularioRevision({ cierre, onVolver, onGuardar }) {
  const [denominaciones, setDenominaciones] = useState({
    20000: 0,
    10000: 0,
    5000: 0,
    2000: 0,
    1000: 0,
    500: 0,
    100: 0,
    50: 0,
    25: 0,
    10: 0,
    5: 0,
  });

  const [tarjetas, setTarjetas] = useState({
    bac: 0,
    bn: 0,
  });

  const [dolares, setDolares] = useState(0);
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

      setSinpeRevisado(sinpes.map(s => ({ ...s, monto_revisado: 0, aprobado: false })));
      setTransfRevisadas(transfs.map(t => ({ ...t, monto_revisado: 0, aprobado: false })));
      setSalidEvaluadas(salidas.map(s => ({ ...s, aprobado: false })));
    } catch (err) {
      console.error('Error cargando detalles:', err);
    }
  }

  async function guardarRevision() {
    setLoading(true);
    try {
      const res = await fetch('/api/revisionCaja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cierre_id: cierre.id,
          denominaciones,
          tarjetas,
          dolares,
          sinpeRevisado,
          transfRevisadas,
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
    return sum + (parseInt(denom) * cant);
  }, 0);

  const fmt = n => '₡' + Math.round(n).toLocaleString('es-CR');
  const fmtMini = n => '₡' + (n % 1 ? n.toFixed(2) : n).toString();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Header title="Revisión de Cierre" subtitle={`${cierre?.cajera} — ${new Date(cierre?.fecha_hora).toLocaleDateString('es-CR')}`} showLogout={false} />

      <div style={{ flex: 1, maxWidth: '720px', margin: '0 auto', padding: '24px 16px', width: '100%', overflowY: 'auto' }}>

        {/* Denominaciones */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
          <div style={{ background: '#F0EDE6', padding: '12px 16px', fontSize: '13px', fontWeight: '700', color: '#1A1714' }}>
            Denominaciones
          </div>

          <div style={{ padding: '16px' }}>
            {[20000, 10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5].map(denom => {
              const subtotal = parseInt(denom) * denominaciones[denom];
              const label = denom >= 1000 ? `₡${(denom / 1000).toFixed(0)}k` : `₡${denom}`;

              return (
                <div key={denom} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #E2DDD4' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#6B6560' }}>
                    {label}
                  </label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <input
                      type="number"
                      min="0"
                      value={denominaciones[denom]}
                      onChange={(e) => setDenominaciones({ ...denominaciones, [denom]: parseInt(e.target.value) || 0 })}
                      style={{
                        width: '80px',
                        padding: '6px 8px',
                        border: '1px solid #E2DDD4',
                        borderRadius: '6px',
                        fontSize: '12px',
                        textAlign: 'center',
                      }}
                    />
                    <div style={{ width: '60px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#C8A84B', fontFamily: "'DM Mono', monospace" }}>
                      {fmtMini(subtotal)}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', marginTop: '8px', fontWeight: '700', color: '#2a78a5' }}>
              <span>TOTAL EN CAJA</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '16px' }}>{fmt(totalEnCaja)}</span>
            </div>
          </div>
        </div>

        {/* Dólares */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
          <div style={{ background: '#F0EDE6', padding: '12px 16px', fontSize: '13px', fontWeight: '700', color: '#1A1714' }}>
            Dólares
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={dolares}
                onChange={(e) => setDolares(parseFloat(e.target.value) || 0)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  border: '1px solid #E2DDD4',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontFamily: "'DM Mono', monospace",
                }}
                placeholder="0.00"
              />
              <div style={{ width: '70px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#C8A84B', fontFamily: "'DM Mono', monospace", display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                US${dolares.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Tarjetas */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
          <div style={{ background: '#F0EDE6', padding: '12px 16px', fontSize: '13px', fontWeight: '700', color: '#1A1714' }}>
            Transacciones por Tarjeta
          </div>
          <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', display: 'block', marginBottom: '6px' }}>BAC</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={tarjetas.bac}
                onChange={(e) => setTarjetas({ ...tarjetas, bac: parseFloat(e.target.value) || 0 })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #E2DDD4',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontFamily: "'DM Mono', monospace",
                }}
                placeholder="0.00"
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', display: 'block', marginBottom: '6px' }}>BN</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={tarjetas.bn}
                onChange={(e) => setTarjetas({ ...tarjetas, bn: parseFloat(e.target.value) || 0 })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #E2DDD4',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontFamily: "'DM Mono', monospace",
                }}
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        {/* SINPE */}
        {sinpeRevisado.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
            <div style={{ background: '#F0EDE6', padding: '12px 16px', fontSize: '13px', fontWeight: '700', color: '#1A1714' }}>
              SINPE
            </div>
            <div style={{ padding: '16px' }}>
              {sinpeRevisado.map((sinpe, i) => (
                <div key={i} style={{ marginBottom: i < sinpeRevisado.length - 1 ? '16px' : '0', paddingBottom: '16px', borderBottom: i < sinpeRevisado.length - 1 ? '1px solid #E2DDD4' : 'none' }}>
                  {sinpe.archivo_url && (
                    <img src={sinpe.archivo_url} alt="SINPE" style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }} />
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', marginBottom: '4px' }}>Ref: {sinpe.referencia}</div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={sinpe.monto_revisado}
                        onChange={(e) => {
                          const updated = [...sinpeRevisado];
                          updated[i].monto_revisado = parseFloat(e.target.value) || 0;
                          setSinpeRevisado(updated);
                        }}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: '1px solid #E2DDD4',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontFamily: "'DM Mono', monospace",
                        }}
                        placeholder="0.00"
                      />
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#C8A84B', fontFamily: "'DM Mono', monospace" }}>
                      {fmtMini(sinpe.monto_revisado)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transferencias */}
        {transfRevisadas.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
            <div style={{ background: '#F0EDE6', padding: '12px 16px', fontSize: '13px', fontWeight: '700', color: '#1A1714' }}>
              Transferencias
            </div>
            <div style={{ padding: '16px' }}>
              {transfRevisadas.map((transf, i) => (
                <div key={i} style={{ marginBottom: i < transfRevisadas.length - 1 ? '16px' : '0', paddingBottom: '16px', borderBottom: i < transfRevisadas.length - 1 ? '1px solid #E2DDD4' : 'none' }}>
                  {transf.archivo_url && (
                    <img src={transf.archivo_url} alt="Transferencia" style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }} />
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', marginBottom: '4px' }}>Descripción: {transf.descripcion}</div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={transf.monto_revisado}
                        onChange={(e) => {
                          const updated = [...transfRevisadas];
                          updated[i].monto_revisado = parseFloat(e.target.value) || 0;
                          setTransfRevisadas(updated);
                        }}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          border: '1px solid #E2DDD4',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontFamily: "'DM Mono', monospace",
                        }}
                        placeholder="0.00"
                      />
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#C8A84B', fontFamily: "'DM Mono', monospace" }}>
                      {fmtMini(transf.monto_revisado)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Salidas de Caja */}
        {salidEvaluadas.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', overflow: 'hidden', marginBottom: '24px' }}>
            <div style={{ background: '#F0EDE6', padding: '12px 16px', fontSize: '13px', fontWeight: '700', color: '#1A1714' }}>
              Salidas de Caja
            </div>
            <div style={{ padding: '16px' }}>
              {salidEvaluadas.map((salida, i) => (
                <div key={i} style={{ marginBottom: i < salidEvaluadas.length - 1 ? '16px' : '0', paddingBottom: '16px', borderBottom: i < salidEvaluadas.length - 1 ? '1px solid #E2DDD4' : 'none' }}>
                  {salida.archivo_url && (
                    <img src={salida.archivo_url} alt="Salida" style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }} />
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560' }}>{salida.descripcion}</div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#1A1714', marginTop: '2px' }}>{fmtMini(salida.monto)}</div>
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
                    {salida.aprobado ? '✅ Aprobada' : 'Aprobar'}
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
