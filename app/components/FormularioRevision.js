'use client';

import { useState, useEffect } from 'react';
import Header from './Header';

export default function FormularioRevision({ cierre, onVolver, onGuardar }) {
  const [denominaciones, setDenominaciones] = useState({
    20000: cierre?.c_20000 || 0,
    10000: cierre?.c_10000 || 0,
    5000: cierre?.c_5000 || 0,
    2000: cierre?.c_2000 || 0,
    1000: cierre?.c_1000 || 0,
    500: cierre?.c_500 || 0,
    100: cierre?.c_100 || 0,
    50: cierre?.c_50 || 0,
    25: cierre?.c_25 || 0,
    10: cierre?.c_10 || 0,
    5: cierre?.c_5 || 0,
  });

  const [tarjetas, setTarjetas] = useState({
    bac: cierre?.tarjeta_bac || 0,
    bn: cierre?.tarjeta_bn || 0,
  });

  const [dolares, setDolares] = useState(cierre?.dolares_total || 0);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Header title="Revisión de Cierre" subtitle={`${cierre?.cajera} — ${new Date(cierre?.fecha_hora).toLocaleDateString('es-CR')}`} showLogout={false} />

      <div style={{ flex: 1, maxWidth: '720px', margin: '0 auto', padding: '24px 16px', width: '100%', overflowY: 'auto' }}>

        {/* Denominaciones */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#1A1714', marginBottom: '16px' }}>Denominaciones en Caja</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
            {[20000, 10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5].map(denom => (
              <div key={denom}>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', display: 'block', marginBottom: '4px' }}>
                  {denom >= 1000 ? `₡${(denom / 1000).toFixed(0)}k` : `₡${denom}`}
                </label>
                <input
                  type="number"
                  min="0"
                  value={denominaciones[denom]}
                  onChange={(e) => setDenominaciones({ ...denominaciones, [denom]: parseInt(e.target.value) || 0 })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #E2DDD4',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
              </div>
            ))}
          </div>
          <div style={{ padding: '12px', background: '#F0EDE6', borderRadius: '6px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#6B6560', marginBottom: '4px' }}>Total en caja</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#2a78a5', fontFamily: "'DM Mono', monospace" }}>{fmt(totalEnCaja)}</div>
          </div>
        </div>

        {/* Dólares */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
          <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
            Dólares
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={dolares}
            onChange={(e) => setDolares(parseFloat(e.target.value) || 0)}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #E2DDD4',
              borderRadius: '6px',
              fontSize: '13px',
              fontFamily: "'DM Mono', monospace",
            }}
            placeholder="0.00"
          />
        </div>

        {/* Tarjetas */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#1A1714', marginBottom: '12px' }}>Transacciones por Tarjeta</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', display: 'block', marginBottom: '4px' }}>BAC</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={tarjetas.bac}
                onChange={(e) => setTarjetas({ ...tarjetas, bac: parseFloat(e.target.value) || 0 })}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #E2DDD4',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontFamily: "'DM Mono', monospace",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', display: 'block', marginBottom: '4px' }}>BN</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={tarjetas.bn}
                onChange={(e) => setTarjetas({ ...tarjetas, bn: parseFloat(e.target.value) || 0 })}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #E2DDD4',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontFamily: "'DM Mono', monospace",
                }}
              />
            </div>
          </div>
        </div>

        {/* SINPE */}
        {sinpeRevisado.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#1A1714', marginBottom: '12px' }}>SINPE</h3>
            {sinpeRevisado.map((sinpe, i) => (
              <div key={i} style={{ marginBottom: i < sinpeRevisado.length - 1 ? '16px' : '0', paddingBottom: '16px', borderBottom: i < sinpeRevisado.length - 1 ? '1px solid #E2DDD4' : 'none' }}>
                {sinpe.archivo_url && (
                  <img src={sinpe.archivo_url} alt="SINPE" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }} />
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#6B6560' }}>Referencia</label>
                    <div style={{ fontSize: '12px', color: '#1A1714', fontFamily: "'DM Mono', monospace" }}>{sinpe.referencia || '—'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#6B6560' }}>Monto (comprobante)</label>
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
                        padding: '6px',
                        border: '1px solid #E2DDD4',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontFamily: "'DM Mono', monospace",
                      }}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Transferencias */}
        {transfRevisadas.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#1A1714', marginBottom: '12px' }}>Transferencias</h3>
            {transfRevisadas.map((transf, i) => (
              <div key={i} style={{ marginBottom: i < transfRevisadas.length - 1 ? '16px' : '0', paddingBottom: '16px', borderBottom: i < transfRevisadas.length - 1 ? '1px solid #E2DDD4' : 'none' }}>
                {transf.archivo_url && (
                  <img src={transf.archivo_url} alt="Transferencia" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }} />
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#6B6560' }}>Descripción</label>
                    <div style={{ fontSize: '12px', color: '#1A1714' }}>{transf.descripcion || '—'}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#6B6560' }}>Monto (comprobante)</label>
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
                        padding: '6px',
                        border: '1px solid #E2DDD4',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontFamily: "'DM Mono', monospace",
                      }}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Salidas de Caja */}
        {salidEvaluadas.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#1A1714', marginBottom: '12px' }}>Salidas de Caja</h3>
            {salidEvaluadas.map((salida, i) => (
              <div key={i} style={{ marginBottom: i < salidEvaluadas.length - 1 ? '16px' : '0', paddingBottom: '16px', borderBottom: i < salidEvaluadas.length - 1 ? '1px solid #E2DDD4' : 'none', padding: '12px', background: salida.aprobado ? '#E8F3EC' : '#FBF6E9', borderRadius: '8px' }}>
                {salida.archivo_url && (
                  <img src={salida.archivo_url} alt="Salida" style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px' }} />
                )}
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#1A1714' }}>
                    {fmt(salida.monto)} — {salida.descripcion}
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
        )}

        {/* Botones */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '24px' }}>
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
            Cancelar
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
            {loading ? '⏳ Guardando...' : 'Guardar Revisión'}
          </button>
        </div>
      </div>
    </div>
  );
}
