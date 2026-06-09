'use client';

import { useState, useEffect } from 'react';
import Header from '../components/Header';

const DENOMS = [20000, 10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5];
const fmt = n => '₡' + Math.round(n).toLocaleString('es-CR');
const fmtDecimal = n => n.toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const getFechaCostaRica = () => {
  const formatter = new Intl.DateTimeFormat('es-CR', {
    timeZone: 'America/Costa_Rica',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  return `${year}-${month}-${day}`;
};

export default function CajeraPage() {
  const [cajera, setCajera] = useState('');
  const [caja, setCaja] = useState('');
  const [fecha, setFecha] = useState('');
  const [tc, setTc] = useState(442);
  const [dolares, setDolares] = useState(0);
  const [tarjetaBac, setTarjetaBac] = useState(0);
  const [tarjetaBn, setTarjetaBn] = useState(0);
  const [colaboradores, setColaboradores] = useState([]);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(false);
  const [comentarios, setComentarios] = useState('');

  const [denominaciones, setDenominaciones] = useState({});
  const [quedaDenominaciones, setQuedaDenominaciones] = useState({});
  const [sinpeList, setSinpeList] = useState([{ id: 1, monto: 0 }]);
  const [depositoList, setDepositoList] = useState([{ id: 1, nombre: '', monto: 0 }]);
  const [salidaList, setSalidaList] = useState([{ id: 1, descripcion: '', monto: 0 }]);
  const [gloryList, setGloryList] = useState([{ id: 1, metodo: '', monto: 0 }]);
  const [cerrarGlory, setCerrarGlory] = useState(false);
  const [cierreExistente, setCierreExistente] = useState(null);
  let sinpeCount = 1, depCount = 1, salidaCount = 1, gloryCount = 1;

  // Inicializar denominaciones
  useEffect(() => {
    const init = {};
    DENOMS.forEach(d => {
      init[d] = 0;
    });
    setDenominaciones(init);
    setQuedaDenominaciones(init);

    // Setear fecha actual
    setFecha(getFechaCostaRica());

    // Pre-llenar cajera desde localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setCajera(user.nombre);
    }

    // Cargar cajeras
    loadCajeras();

    // Cargar tipo de cambio del período
    fetchTipoCambioPeriodo();

    // Cargar todas las transacciones del día
    loadSinpeDelDia();
    loadDepositosDelDia();
    loadSalidasDelDia();
    loadGloryDelDia();
  }, []);

  // Recargar movimientos cuando cambia la caja
  useEffect(() => {
    if (caja) {
      verificarCierreExistente();
      loadSinpeDelDia();
      loadDepositosDelDia();
      loadSalidasDelDia();
    }
  }, [caja]);

  async function verificarCierreExistente() {
    try {
      const hoy = getFechaCostaRica();
      const res = await fetch(`/api/cierreCaja?fecha=${hoy}&caja=${encodeURIComponent(caja)}`);
      const cierres = await res.json();

      if (cierres && cierres.length > 0) {
        const cierre = cierres[0];
        setCierreExistente(cierre);
        // Cargar datos del cierre anterior
        if (cierre.denominaciones_sobre) {
          const denoms = typeof cierre.denominaciones_sobre === 'string'
            ? JSON.parse(cierre.denominaciones_sobre)
            : cierre.denominaciones_sobre;
          setQuedaDenominaciones(denoms);
        }
        setTarjetaBac(cierre.tarjeta_bac || 0);
        setTarjetaBn(cierre.tarjeta_bn || 0);
        setDolares(cierre.dolares_total || 0);
      } else {
        setCierreExistente(null);
      }
    } catch (err) {
      console.error('Error verificando cierre:', err);
      setCierreExistente(null);
    }
  }

  async function fetchTipoCambioPeriodo() {
    try {
      const res = await fetch('/api/periodos/get-actual');
      const data = await res.json();
      setTc(data.tipoCambio || 442);
    } catch (err) {
      console.log('No se pudo cargar TC del período');
      setTc(442);
    }
  }

  async function loadSinpeDelDia() {
    try {
      const hoy = getFechaCostaRica();
      const cajaParam = caja ? `&caja=${encodeURIComponent(caja)}` : '';
      const res = await fetch(`/api/movimientos?tipo=SINPE&fecha=${hoy}${cajaParam}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const items = data.map((m, i) => ({
          id: m.id || i,
          monto: m.monto || 0,
          referencia: m.referencia || 'N/A',
          archivo_url: m.archivo_url || null,
          moneda: m.moneda || 'colones'
        }));
        if (items.length > 0) {
          setSinpeList(items);
        } else {
          setSinpeList([]);
        }
      }
    } catch (err) {
      console.log('Error cargando SINPE:', err);
    }
  }

  async function loadGloryDelDia() {
    try {
      const hoy = getFechaCostaRica();
      const res = await fetch(`/api/cobros-glory?cobrado=true&fecha=${hoy}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const items = data.map((g, i) => ({
          id: g.id || i,
          metodo: g.metodo || '',
          monto: g.monto || 0
        }));
        if (items.length > 0) {
          setGloryList(items);
        }
      }
    } catch (err) {
      console.log('Error cargando Glory:', err);
    }
  }

  async function loadDepositosDelDia() {
    try {
      const hoy = getFechaCostaRica();
      const cajaParam = caja ? `&caja=${encodeURIComponent(caja)}` : '';
      const res = await fetch(`/api/movimientos?tipo=TRANSFERENCIA&fecha=${hoy}${cajaParam}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const items = data.map((m, i) => ({
          id: m.id || i,
          nombre: m.referencia || '',
          descripcion: m.referencia || '',
          monto: m.monto || 0,
          archivo_url: m.archivo_url || null,
          moneda: m.moneda || 'colones'
        }));
        if (items.length > 0) {
          setDepositoList(items);
        } else {
          setDepositoList([]);
        }
      }
    } catch (err) {
      console.log('Error cargando depósitos:', err);
    }
  }

  async function loadSalidasDelDia() {
    try {
      const hoy = getFechaCostaRica();
      const cajaParam = caja ? `&caja=${encodeURIComponent(caja)}` : '';
      const res = await fetch(`/api/movimientos?tipo=SALIDA&fecha=${hoy}${cajaParam}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const items = data.map((m, i) => ({
          id: m.id || i,
          descripcion: m.referencia || '',
          monto: m.monto || 0,
          archivo_url: m.archivo_url || null,
          moneda: m.moneda || 'colones'
        }));
        if (items.length > 0) {
          setSalidaList(items);
        } else {
          setSalidaList([]);
        }
      }
    } catch (err) {
      console.log('Error cargando salidas:', err);
    }
  }

  // Calcular totales
  const totalCierre = Object.entries(denominaciones).reduce((sum, [d, qty]) => sum + (parseInt(d) * qty), 0);
  const totalQueda = Object.entries(quedaDenominaciones).reduce((sum, [d, qty]) => sum + (parseInt(d) * qty), 0);
  const totalSobre = totalCierre - totalQueda;
  const dolaresEnColones = dolares * tc;
  const totalTarjetas = tarjetaBac + tarjetaBn;
  const totalSinpe = sinpeList.reduce((sum, item) => sum + (item.monto || 0), 0);
  const totalDepositos = depositoList.reduce((sum, item) => sum + (item.monto || 0), 0);
  const totalSalidas = salidaList.reduce((sum, item) => sum + (item.monto || 0), 0);
  const totalGlory = gloryList.reduce((sum, item) => sum + (item.monto || 0), 0);

  const handleDenomChange = (denom, value) => {
    // Remover separador de miles (espacios) si lo hay
    const cleanValue = value.toString().replace(/\s/g, '');
    const newVal = parseInt(cleanValue) || 0;
    const newDenoms = { ...denominaciones, [denom]: newVal };
    setDenominaciones(newDenoms);

    // Auto calcular queda (algoritmo)
    distributeQueda(newDenoms);
  };

  const distributeQueda = (denomsData) => {
    const fondo = 50000;

    const queda = {};
    DENOMS.forEach(d => {
      queda[d] = denomsData[d] || 0;
    });

    // Calcular total queda
    let totalQuedaAmount = Object.entries(queda).reduce((sum, [d, qty]) => sum + (parseInt(d) * qty), 0);

    // Si total > fondo, quitar de mayor a menor hasta quedar en fondo
    let toRemove = Math.max(0, totalQuedaAmount - fondo);

    // Quitar de mayor a menor denominación
    for (let i = 0; i < DENOMS.length && toRemove > 0; i++) {
      const d = DENOMS[i];
      const canRemove = Math.min(queda[d], Math.floor(toRemove / d));
      queda[d] -= canRemove;
      toRemove -= canRemove * d;
    }

    setQuedaDenominaciones(queda);
  };

  async function loadCajeras() {
    try {
      const res = await fetch('/api/admin/colaboradores');
      const data = await res.json();
      setColaboradores(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando cajeras:', err);
    }
  }

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  async function handleSubmit(e) {
    e.preventDefault();

    if (!cajera || !caja) {
      showToast('❌ Completá información general');
      return;
    }

    setLoading(true);

    try {
      const body = {
        cajera,
        caja,
        fecha,
        tc,
        dolares,
        tarjetaBac,
        tarjetaBn,
        sinpeList,
        depositoList,
        salidaList,
        // Conteo de denominaciones (para conteo_caja)
        ...Object.fromEntries(DENOMS.map(d => [`denom${d}`, denominaciones[d] || 0])),
        // Denominaciones al sobre (para cierre_caja)
        ...Object.fromEntries(DENOMS.map(d => [`sobre${d}`, quedaDenominaciones[d] || 0]))
      };

      if (cerrarGlory) {
        body.gloryList = gloryList;
      }

      console.log('=== SUBMIT CIERRE CAJA ===');
      console.log('tarjetaBac state:', tarjetaBac, 'type:', typeof tarjetaBac);
      console.log('tarjetaBn state:', tarjetaBn, 'type:', typeof tarjetaBn);
      console.log('Body before JSON.stringify:', body);

      const res = await fetch('/api/cierreCaja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      console.log('Response status:', res.status);

      if (res.ok) {
        showToast('✅ Cierre guardado');
      } else {
        const errorData = await res.json();
        showToast('❌ Error: ' + (errorData.error || 'Error al guardar'));
      }
    } catch (err) {
      showToast('❌ Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Header title="Cierre de Caja" subtitle="Registro de cierre diario" showLogout={false} />

      {/* Main */}
      <div style={{ flex: 1, maxWidth: '720px', margin: '0 auto', padding: '24px 16px', width: '100%' }}>
        {/* SECCIÓN 1: Información general */}
        <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', background: '#F0EDE6' }}>
            <div style={{ width: '26px', height: '26px', background: '#2a78a5', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>1</div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Información general</div>
          </div>
          <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Cajera</label>
              <div style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px', background: '#F0EDE6', color: '#1A1714', fontWeight: '600' }}>{cajera || 'Cargando...'}</div>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Caja</label>
              <select value={caja} onChange={(e) => setCaja(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px' }}>
                <option value="">Seleccionar...</option>
                <option>Caja 1 (clínica)</option>
                <option>Caja 2</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Fecha</label>
              <input type="text" value={fecha} readOnly style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', background: '#F0EDE6', color: '#6B6560' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Tipo de cambio (del día)</label>
              <input type="number" value={tc} readOnly style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', background: '#F0EDE6', color: '#6B6560', fontSize: '14px', fontFamily: "'DM Mono', monospace", fontWeight: '600' }} />
              <div style={{ fontSize: '10px', color: '#9C9590', marginTop: '4px' }}>Cargado automáticamente (internet - 10)</div>
            </div>
          </div>
        </div>

        {cierreExistente && (
          <div style={{ background: '#E8F3EC', border: '2px solid #27AE60', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '20px' }}>✅</div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#27AE60' }}>Cierre ya realizado hoy</div>
                <div style={{ fontSize: '12px', color: '#6B6560', marginTop: '2px' }}>
                  Registrado a las {new Date(cierreExistente.fecha_hora).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          </div>
        )}

        {caja && !cierreExistente ? (
          <form onSubmit={handleSubmit}>
          {/* SECCIÓN 2: Glory */}
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F0EDE6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '26px', height: '26px', background: '#2a78a5', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>2</div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Glory — Groomer</div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '600', color: '#6B6560', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={cerrarGlory}
                  onChange={(e) => setCerrarGlory(e.target.checked)}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
                ¿Registrar cierre?
              </label>
            </div>
            {cerrarGlory && (
              <div style={{ padding: '20px' }}>
                {gloryList.map((item) => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#F7F5F0', borderRadius: '6px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#6B6560' }}>{item.metodo || 'Pago'}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', fontWeight: '600', color: '#2a78a5' }}>{fmt(item.monto)}</span>
                  </div>
                ))}
                <div style={{ marginTop: '12px', padding: '14px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', background: '#E8F3EC' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Total Glory</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '600', color: '#2a78a5' }}>{fmt(totalGlory)}</span>
                </div>
                {(() => {
                  const totalEfectivo = gloryList.filter(item => item.metodo?.toLowerCase().includes('efectivo')).reduce((sum, item) => sum + (item.monto || 0), 0);
                  const totalTarjeta = gloryList.filter(item => ['bac', 'bn', 'credomatic', 'davivienda'].some(m => item.metodo?.toLowerCase().includes(m))).reduce((sum, item) => sum + (item.monto || 0), 0);
                  return (
                    <>
                      <div style={{ marginTop: '8px', padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', background: '#F0EDE6' }}>
                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Total Efectivo</span>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '14px', fontWeight: '600', color: '#2a78a5' }}>{fmt(totalEfectivo)}</span>
                      </div>
                      <div style={{ marginTop: '6px', padding: '12px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', background: '#F0EDE6' }}>
                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Total Tarjeta</span>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '14px', fontWeight: '600', color: '#2a78a5' }}>{fmt(totalTarjeta)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
            {!cerrarGlory && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#9C9590', fontSize: '13px', fontStyle: 'italic' }}>
                Cierre de Glory deshabilitado para esta sesión
              </div>
            )}
          </div>

          {/* SECCIÓN 3: Cierre de caja */}
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', background: '#F0EDE6' }}>
              <div style={{ width: '26px', height: '26px', background: '#2a78a5', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>3</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Cierre de caja — denominaciones</div>
            </div>
            <div style={{ padding: '20px' }}>
              {DENOMS.map((d, idx) => (
                <div key={d} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 110px', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid #E2DDD4' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', color: '#6B6560', fontWeight: '500' }}>{fmt(d)}</div>
                  <input
                    type="text"
                    ref={(el) => (window[`inputCajeraDenom${idx}`] = el)}
                    value={denominaciones[d] === 0 || denominaciones[d] === undefined ? '' : (denominaciones[d] || 0).toLocaleString('es-CR')}
                    onChange={(e) => handleDenomChange(d, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        const nextInput = window[`inputCajeraDenom${idx + 1}`];
                        if (nextInput) nextInput.focus();
                      }
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const prevInput = window[`inputCajeraDenom${idx - 1}`];
                        if (prevInput) prevInput.focus();
                      }
                    }}
                    placeholder="0"
                    inputMode="decimal"
                    style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '15px', fontWeight: '500', textAlign: 'center', fontFamily: "'DM Mono', monospace" }}
                  />
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', color: '#2a78a5', fontWeight: '600', textAlign: 'right' }}>{fmt((denominaciones[d] || 0) * d)}</div>
                </div>
              ))}
              <div style={{ marginTop: '14px', padding: '14px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#E8F3EC' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Total en caja</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '600', color: '#2a78a5' }}>{fmt(totalCierre)}</span>
              </div>
            </div>
          </div>

          {/* SECCIÓN 4: Denominaciones al sobre */}
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', background: '#F0EDE6' }}>
              <div style={{ width: '26px', height: '26px', background: '#2a78a5', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>4</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Denominaciones al sobre</div>
            </div>
            <div style={{ padding: '20px' }}>
              {(() => {
                const montoAlSobre = totalCierre - 50000;
                if (montoAlSobre <= 0) return <div style={{ fontSize: '12px', color: '#9C9590', padding: '10px 0' }}>Nada al sobre (fondo completo)</div>;

                const denominacionesSobre = {};
                let pendiente = montoAlSobre;

                for (let i = 0; i < DENOMS.length && pendiente > 0; i++) {
                  const d = DENOMS[i];
                  const disponibles = denominaciones[d] || 0;
                  const aExtraer = Math.min(disponibles, Math.floor(pendiente / d));
                  if (aExtraer > 0) {
                    denominacionesSobre[d] = aExtraer;
                    pendiente -= aExtraer * d;
                  }
                }

                return DENOMS.map(d => {
                  const sobreDenom = denominacionesSobre[d] || 0;
                  return sobreDenom > 0 ? (
                    <div key={d} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 110px', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid #E2DDD4' }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', color: '#6B6560', fontWeight: '500' }}>{fmt(d)}</div>
                      <input type="number" value={sobreDenom} readOnly style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E2DDD4', borderRadius: '8px', background: '#F0EDE6', color: '#6B6560', fontFamily: "'DM Mono', monospace" }} />
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', color: '#C8A84B', fontWeight: '600', textAlign: 'right' }}>{fmt(sobreDenom * d)}</div>
                    </div>
                  ) : null;
                });
              })()}
              <div style={{ marginTop: '14px', padding: '14px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', background: '#FBF6E9' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Fondo en caja</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '600', color: '#C8A84B' }}>{fmt(50000)}</span>
              </div>
              <div style={{ marginTop: '8px', padding: '16px 20px', background: '#2a78a5', color: 'white', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '600' }}>💰 Total al sobre</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '22px', fontWeight: '600' }}>{fmt(totalSobre)}</span>
              </div>
            </div>
          </div>

          {/* SECCIÓN 5: Dólares */}
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', background: '#F0EDE6' }}>
              <div style={{ width: '26px', height: '26px', background: '#2a78a5', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>5</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Dólares</div>
            </div>
            <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: '12px', alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Total dólares ($)</label>
                <input type="text" value={dolares === 0 ? '' : dolares.toLocaleString('es-CR')} onChange={(e) => setDolares(e.target.value === '' ? 0 : parseFloat(e.target.value.replace(/\s/g, '')) || 0)} placeholder="0" inputMode="decimal" style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px', fontFamily: "'DM Mono', monospace" }} />
              </div>
              <div style={{ padding: '10px 12px', background: '#E8F3EC', borderRadius: '8px', fontFamily: "'DM Mono', monospace", fontSize: '13px', color: '#2a78a5', fontWeight: '600', textAlign: 'center' }}>×{tc}</div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Equivalente en colones</label>
                <div style={{ padding: '10px 12px', background: '#E8F3EC', borderRadius: '8px', fontFamily: "'DM Mono', monospace", fontSize: '13px', color: '#2a78a5', fontWeight: '600' }}>{fmt(dolaresEnColones)}</div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 6: Tarjetas */}
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', background: '#F0EDE6' }}>
              <div style={{ width: '26px', height: '26px', background: '#2a78a5', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>6</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Tarjetas</div>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div style={{ border: '1.5px solid #E2DDD4', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#6B6560', marginBottom: '8px' }}>BAC</div>
                  <input type="number" step="0.01" value={tarjetaBac === 0 ? '' : tarjetaBac} onChange={(e) => setTarjetaBac(parseFloat(e.target.value) || 0)} onWheel={(e) => e.target.blur()} onKeyDown={(e) => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.preventDefault()} placeholder="0" style={{ width: '100%', border: 'none', padding: '0', fontSize: '20px', fontWeight: '600', fontFamily: "'DM Mono', monospace", outline: 'none' }} />
                  <div style={{ fontSize: '12px', color: '#9C9590', marginTop: '2px' }}>colones</div>
                </div>
                <div style={{ border: '1.5px solid #E2DDD4', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#6B6560', marginBottom: '8px' }}>BN</div>
                  <input type="number" step="0.01" value={tarjetaBn === 0 ? '' : tarjetaBn} onChange={(e) => setTarjetaBn(parseFloat(e.target.value) || 0)} onWheel={(e) => e.target.blur()} onKeyDown={(e) => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.preventDefault()} placeholder="0" style={{ width: '100%', border: 'none', padding: '0', fontSize: '20px', fontWeight: '600', fontFamily: "'DM Mono', monospace", outline: 'none' }} />
                  <div style={{ fontSize: '12px', color: '#9C9590', marginTop: '2px' }}>colones</div>
                </div>
              </div>
              <div style={{ padding: '14px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', background: '#E8F3EC' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Total tarjetas</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '600', color: '#2a78a5' }}>₡{fmtDecimal(totalTarjetas)}</span>
              </div>
            </div>
          </div>

          {/* SECCIÓN 7: SINPE */}
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', background: '#F0EDE6' }}>
              <div style={{ width: '26px', height: '26px', background: '#2a78a5', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>7</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>SINPE Móvil</div>
            </div>
            <div style={{ padding: '20px' }}>
              {sinpeList.map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#F7F5F0', borderRadius: '6px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#6B6560' }}>Ref: {item.referencia}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', fontWeight: '600', color: '#2a78a5' }}>{fmt(item.monto)}</span>
                </div>
              ))}
              <div style={{ marginTop: '12px', padding: '14px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', background: '#E8F3EC' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Total SINPE</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '600', color: '#2a78a5' }}>{fmt(totalSinpe)}</span>
              </div>
            </div>
          </div>

          {/* SECCIÓN 8: Depósitos */}
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', background: '#F0EDE6' }}>
              <div style={{ width: '26px', height: '26px', background: '#2a78a5', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>8</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Depósitos</div>
            </div>
            <div style={{ padding: '20px' }}>
              {depositoList.map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#F7F5F0', borderRadius: '6px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#6B6560' }}>{item.nombre || 'Transferencia'}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', fontWeight: '600', color: '#2a78a5' }}>{fmt(item.monto)}</span>
                </div>
              ))}
              <div style={{ marginTop: '12px', padding: '14px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', background: '#E8F3EC' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Total depósitos</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '600', color: '#2a78a5' }}>{fmt(totalDepositos)}</span>
              </div>
            </div>
          </div>

          {/* SECCIÓN 9: Salidas */}
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', background: '#F0EDE6' }}>
              <div style={{ width: '26px', height: '26px', background: '#2a78a5', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>9</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Salidas de caja</div>
            </div>
            <div style={{ padding: '20px' }}>
              {salidaList.map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: '#FDEDEC', borderRadius: '6px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#6B6560' }}>{item.descripcion || 'Salida'}</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', fontWeight: '600', color: '#C0392B' }}>-{fmt(item.monto)}</span>
                </div>
              ))}
              <div style={{ marginTop: '12px', padding: '14px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', background: '#FDEDEC' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Total salidas</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '18px', fontWeight: '600', color: '#C0392B' }}>{fmt(totalSalidas)}</span>
              </div>
            </div>
          </div>

          {/* SECCIÓN 10: Comentarios */}
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', display: 'flex', alignItems: 'center', gap: '10px', background: '#F0EDE6' }}>
              <div style={{ width: '26px', height: '26px', background: '#2a78a5', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '600' }}>10</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Comentarios / Observaciones</div>
            </div>
            <div style={{ padding: '20px' }}>
              <textarea value={comentarios} onChange={(e) => setComentarios(e.target.value)} rows="4" placeholder="Escribí cualquier observación o nota importante..." style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontFamily: "'DM Sans', sans-serif", fontSize: '14px', resize: 'vertical' }} />
            </div>
          </div>

          {/* Submit Button */}
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '16px', background: '#2a78a5', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s', marginBottom: '24px' }} onMouseEnter={(e) => e.target.style.background = '#1f5780'} onMouseLeave={(e) => e.target.style.background = '#2a78a5'}>
            {loading ? 'Guardando...' : 'Enviar cierre de caja'}
          </button>
        </form>
        ) : null}

        {cierreExistente && (
          <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2DDD4', background: '#F0EDE6' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>Datos del cierre registrado</div>
            </div>
            <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '4px' }}>Dólares</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#2a78a5' }}>{fmt(cierreExistente.dolares_total || 0)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '4px' }}>Tarjeta BAC</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#2a78a5' }}>{fmt(cierreExistente.tarjeta_bac || 0)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '4px' }}>Tarjeta BN</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#2a78a5' }}>{fmt(cierreExistente.tarjeta_bn || 0)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase', marginBottom: '4px' }}>TC</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#2a78a5' }}>₡{cierreExistente.tc}</div>
              </div>
            </div>
          </div>
        )}

        {!caja && (
          <div style={{ background: '#fff', border: '1.5px solid #E2DDD4', borderRadius: '12px', padding: '40px 20px', textAlign: 'center', marginTop: '24px' }}>
            <div style={{ fontSize: '16px', color: '#6B6560', fontWeight: '600' }}>Selecciona una caja para continuar</div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#2a78a5', color: 'white', padding: '12px 20px', borderRadius: '20px', fontSize: '14px', fontWeight: '600', zIndex: 9999 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
