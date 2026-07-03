'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';

const DENOMS_CRC = [20000, 10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5];

const fmtCRC = n => '₡' + Math.round(n).toLocaleString('es-CR');
const fmtUSD = n => 'US$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// fecha date-only → CR (NUNCA toISOString para date-only)
const fmtFecha = f => f ? new Date(f + 'T00:00:00').toLocaleDateString('es-CR') : '—';
const dM = f => { const d = new Date(f + 'T00:00:00'); return `${d.getDate()}/${d.getMonth() + 1}`; };
const rango = (ini, fin) => `${dM(ini)} – ${dM(fin)}`;
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const mesNombre = ini => MESES[new Date(ini + 'T00:00:00').getMonth()];
const periodoNum = ini => { const d = new Date(ini + 'T00:00:00').getDate(); return d <= 5 ? 1 : d <= 10 ? 2 : d <= 15 ? 3 : d <= 20 ? 4 : d <= 25 ? 5 : 6; };
const periodoLabel = ini => `${mesNombre(ini)} · P${periodoNum(ini)}`;
const hoyCR = () => {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function DepositosPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState('');
  const [usuario, setUsuario] = useState(null);

  const [periodos, setPeriodos] = useState([]);
  const [depositos, setDepositos] = useState([]);
  const [loadingPeriodos, setLoadingPeriodos] = useState(true);
  const [loadingDepositos, setLoadingDepositos] = useState(true);

  // Selección + conteo del depositante
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [denomsColones, setDenomsColones] = useState({});
  const [usdContado, setUsdContado] = useState(0);
  const [registrando, setRegistrando] = useState(false);

  // Completar depósito
  const [completandoId, setCompletandoId] = useState(null);
  const [compReferencia, setCompReferencia] = useState('');
  const [compFecha, setCompFecha] = useState(hoyCR());
  const [compArchivo, setCompArchivo] = useState(null);
  const [compPreview, setCompPreview] = useState(null);
  const [completando, setCompletando] = useState(false);

  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const u = JSON.parse(userData);
      setUsuario(u);
      setUserRole(u.rol || '');
      if (u.rol !== 'admin') router.push('/');
    } else {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    if (userRole === 'admin') { cargarPeriodos(); cargarDepositos(); }
  }, [userRole]);

  async function cargarPeriodos() {
    setLoadingPeriodos(true);
    try {
      const res = await fetch('/api/depositos-cds');
      const data = await res.json();
      setPeriodos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando períodos:', err);
    } finally {
      setLoadingPeriodos(false);
    }
  }

  async function cargarDepositos() {
    setLoadingDepositos(true);
    try {
      const res = await fetch('/api/depositos-bancarios');
      const data = await res.json();
      setDepositos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando depósitos:', err);
    } finally {
      setLoadingDepositos(false);
    }
  }

  const estadoPeriodo = (p) => {
    if (!p.deposito_bancario_id) return 'pendiente';
    return p.depositos_bancarios?.estado === 'completado' ? 'depositado' : 'en_progreso';
  };

  const pendientes = periodos.filter(p => estadoPeriodo(p) === 'pendiente');
  const enProgreso = depositos.filter(d => d.estado === 'en_progreso');
  const completados = depositos.filter(d => d.estado === 'completado');

  const toggleSeleccion = (id) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Totales de referencia (suma de los períodos seleccionados)
  const seleccionadosArr = periodos.filter(p => seleccionados.has(p.id));
  const refCRC = seleccionadosArr.reduce((s, p) => s + (Number(p.total_colones) || 0), 0);
  const refUSD = seleccionadosArr.reduce((s, p) => s + (Number(p.total_usd) || 0), 0);

  // Conteo del depositante
  const contadoCRC = DENOMS_CRC.reduce((s, d) => s + ((denomsColones[d] || 0) * d), 0);
  const contadoUSD = Number(usdContado) || 0;

  const diffCRC = contadoCRC - refCRC;
  const colorCRC = Math.abs(diffCRC) < 5 ? '#27AE60' : Math.abs(diffCRC) < 500 ? '#F39C12' : '#E74C3C';
  const diffUSD = contadoUSD - refUSD;
  const colorUSD = Math.abs(diffUSD) < 1 ? '#27AE60' : Math.abs(diffUSD) < 50 ? '#F39C12' : '#E74C3C';

  async function registrar() {
    if (seleccionados.size === 0) { showToast('❌ Selecciona al menos un período', 'error'); return; }
    if (contadoCRC === 0 && contadoUSD === 0) { showToast('❌ Ingresa tu conteo', 'error'); return; }
    setRegistrando(true);
    try {
      const res = await fetch('/api/depositos-bancarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodo_ids: [...seleccionados],
          total_contado_colones: contadoCRC,
          total_contado_usd: contadoUSD,
          contado_por: usuario?.nombre || 'Sistema',
          fecha_conteo: hoyCR(),
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error al registrar'); }
      showToast(`✅ Depósito registrado: ${fmtCRC(contadoCRC)}`, 'success');
      setSeleccionados(new Set());
      setDenomsColones({});
      setUsdContado(0);
      await Promise.all([cargarPeriodos(), cargarDepositos()]);
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    } finally {
      setRegistrando(false);
    }
  }

  const handleArchivo = (file) => {
    if (!file) return;
    setCompArchivo(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setCompPreview(ev.target?.result);
      reader.readAsDataURL(file);
    } else {
      setCompPreview(`📄 ${file.name}`);
    }
  };

  const abrirCompletar = (id) => {
    setCompletandoId(id);
    setCompReferencia('');
    setCompFecha(hoyCR());
    setCompArchivo(null);
    setCompPreview(null);
  };

  async function completar(id) {
    if (!compReferencia.trim()) { showToast('❌ Falta el # de boleta', 'error'); return; }
    setCompletando(true);
    try {
      const fd = new FormData();
      fd.append('banco', 'BAC');
      fd.append('referencia', compReferencia.trim());
      fd.append('fecha_deposito', compFecha);
      fd.append('completado_por', usuario?.nombre || 'Sistema');
      if (compArchivo) fd.append('comprobante', compArchivo);

      const res = await fetch(`/api/depositos-bancarios?id=${id}`, { method: 'PATCH', body: fd });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error al completar'); }
      showToast('✅ Depósito completado', 'success');
      setCompletandoId(null);
      await Promise.all([cargarPeriodos(), cargarDepositos()]);
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    } finally {
      setCompletando(false);
    }
  }

  async function deshacer(id) {
    if (!confirm('¿Deshacer este depósito? Los períodos vuelven a Pendiente.')) return;
    try {
      const res = await fetch(`/api/depositos-bancarios?id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Error al deshacer'); }
      showToast('ℹ️ Depósito deshecho', 'info');
      await Promise.all([cargarPeriodos(), cargarDepositos()]);
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  }

  if (!userRole || userRole !== 'admin') return null;

  const toastBg = toast?.type === 'success' ? '#27AE60' : toast?.type === 'error' ? '#E74C3C' : '#9C9590';
  const chipEstado = { pendiente: { bg: '#FFF3CD', fg: '#8B6914', t: 'Pendiente' }, en_progreso: { bg: '#E8F0F7', fg: '#2a78a5', t: 'En progreso' }, depositado: { bg: '#E8F3EC', fg: '#27AE60', t: 'Depositado' } };
  const cardStyle = { background: '#fff', borderRadius: '12px', border: '1.5px solid #E2DDD4', overflow: 'hidden', marginBottom: '20px' };
  const cardHead = { padding: '14px 20px', borderBottom: '1px solid #E2DDD4', background: '#F0EDE6', fontSize: '14px', fontWeight: '700', color: '#1A1714' };

  return (
    <div style={{ minHeight: '100vh', background: '#FDFBF7' }}>
      <Header title="Depósitos" subtitle="Gestión de depósitos" showLogout={false} showModuleSelector={true} homeLink="/admin" />

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '32px 16px' }}>
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1A1714', marginBottom: '6px' }}>Gestión de Depósitos</h2>
          <p style={{ fontSize: '14px', color: '#6B6560' }}>Unificá períodos, contá y registrá el depósito al banco</p>
        </div>

        {/* (a) Períodos */}
        <div style={cardStyle}>
          <div style={cardHead}>Períodos</div>
          <div style={{ padding: '16px 20px' }}>
            {loadingPeriodos ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#9C9590' }}>Cargando períodos...</div>
            ) : periodos.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#9C9590' }}>No hay períodos contados. Contá un período en la revisión primero.</div>
            ) : (
              periodos.map(p => {
                const est = estadoPeriodo(p);
                const sel = seleccionados.has(p.id);
                const clickable = est === 'pendiente';
                const chip = chipEstado[est];
                return (
                  <div
                    key={p.id}
                    onClick={clickable ? () => toggleSeleccion(p.id) : undefined}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                      padding: '12px 14px', marginBottom: '8px', borderRadius: '10px',
                      border: sel ? '2px solid #2a78a5' : '1.5px solid #E2DDD4',
                      background: sel ? '#E8F3EC' : '#fff',
                      cursor: clickable ? 'pointer' : 'default',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div style={{ width: '20px', textAlign: 'center', color: '#2a78a5', fontWeight: '700', fontSize: '15px' }}>{sel ? '✓' : ''}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1714' }}>{periodoLabel(p.periodo_inicio)}</div>
                        <div style={{ fontSize: '11px', color: '#9C9590' }}><span style={{ fontFamily: "'DM Mono', monospace" }}>{rango(p.periodo_inicio, p.periodo_fin)}</span> · Contado por {p.contado_por || '—'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A1714', fontFamily: "'DM Mono', monospace" }}>{fmtCRC(p.total_colones)}</div>
                        {Number(p.total_usd) > 0 && <div style={{ fontSize: '12px', fontWeight: '600', color: '#C8A84B', fontFamily: "'DM Mono', monospace" }}>{fmtUSD(p.total_usd)}</div>}
                      </div>
                      <span style={{ padding: '4px 10px', borderRadius: '20px', background: chip.bg, color: chip.fg, fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>{chip.t}</span>
                    </div>
                  </div>
                );
              })
            )}

            {seleccionados.size > 0 && (
              <div style={{ marginTop: '12px', padding: '12px 16px', borderRadius: '10px', background: '#E8F3EC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#6B6560', textTransform: 'uppercase' }}>Referencia combinada ({seleccionados.size})</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: '700', color: '#1A1714' }}>
                  {fmtCRC(refCRC)}{refUSD > 0 ? ` · ${fmtUSD(refUSD)}` : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* (b) Registrar conteo */}
        {seleccionados.size > 0 && (
          <div style={cardStyle}>
            <div style={cardHead}>Registrar conteo del depósito</div>
            <div style={{ padding: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#6B6560', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.5px' }}>Colones — conteo del depositante</div>
              {DENOMS_CRC.map((d, idx) => (
                <div key={d} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 120px', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid #E2DDD4' }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', color: '#6B6560', fontWeight: '500' }}>₡{d.toLocaleString('es-CR')}</div>
                  <input
                    type="text"
                    inputMode="numeric"
                    ref={el => { if (typeof window !== 'undefined') window[`inputDep${idx}`] = el; }}
                    value={denomsColones[d] === 0 || !denomsColones[d] ? '' : denomsColones[d].toLocaleString('es-CR')}
                    placeholder="0"
                    onChange={(e) => {
                      const val = parseInt(e.target.value.replace(/\s/g, '')) || 0;
                      setDenomsColones(prev => ({ ...prev, [d]: val }));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); window[`inputDep${idx + 1}`]?.focus(); }
                      if (e.key === 'ArrowUp') { e.preventDefault(); window[`inputDep${idx - 1}`]?.focus(); }
                    }}
                    style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '15px', fontWeight: '500', textAlign: 'center', fontFamily: "'DM Mono', monospace" }}
                  />
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', color: '#2a78a5', fontWeight: '600', textAlign: 'right' }}>
                    {(denomsColones[d] || 0) > 0 ? fmtCRC((denomsColones[d] || 0) * d) : '—'}
                  </div>
                </div>
              ))}

              <div style={{ fontSize: '12px', fontWeight: '700', color: '#6B6560', textTransform: 'uppercase', margin: '20px 0 10px', letterSpacing: '0.5px' }}>Dólares — total</div>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 120px', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid #E2DDD4' }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', color: '#6B6560', fontWeight: '500' }}>Total US$</div>
                <input
                  type="text"
                  inputMode="decimal"
                  value={usdContado === 0 || !usdContado ? '' : usdContado.toLocaleString('en-US')}
                  placeholder="0"
                  onChange={(e) => setUsdContado(parseFloat(e.target.value.replace(/,/g, '')) || 0)}
                  style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '15px', fontWeight: '500', textAlign: 'center', fontFamily: "'DM Mono', monospace" }}
                />
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', color: '#C8A84B', fontWeight: '600', textAlign: 'right' }}>
                  {contadoUSD > 0 ? fmtUSD(contadoUSD) : '—'}
                </div>
              </div>

              {/* Cuadre */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', margin: '18px 0' }}>
                <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#F0EDE6' }}>
                  <div style={{ fontSize: '10px', color: '#6B6560', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px' }}>Cuadre colones</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', color: '#6B6560' }}>Contado {fmtCRC(contadoCRC)} · Ref {fmtCRC(refCRC)}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '16px', fontWeight: '700', color: colorCRC, marginTop: '4px' }}>
                    {Math.abs(diffCRC) < 5 ? '✓ Cuadra' : (diffCRC > 0 ? '+' : '−') + fmtCRC(Math.abs(diffCRC))}
                  </div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#F0EDE6' }}>
                  <div style={{ fontSize: '10px', color: '#6B6560', fontWeight: '700', textTransform: 'uppercase', marginBottom: '6px' }}>Cuadre dólares</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', color: '#6B6560' }}>Contado {fmtUSD(contadoUSD)} · Ref {fmtUSD(refUSD)}</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '16px', fontWeight: '700', color: colorUSD, marginTop: '4px' }}>
                    {Math.abs(diffUSD) < 1 ? '✓ Cuadra' : (diffUSD > 0 ? '+' : '−') + fmtUSD(Math.abs(diffUSD))}
                  </div>
                </div>
              </div>

              <button
                onClick={registrar}
                disabled={registrando}
                style={{ width: '100%', padding: '12px', background: '#2a78a5', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: registrando ? 'wait' : 'pointer' }}
              >
                {registrando ? 'Registrando...' : 'Registrar depósito (queda en progreso)'}
              </button>
            </div>
          </div>
        )}

        {/* (c) En progreso */}
        {enProgreso.length > 0 && (
          <div style={cardStyle}>
            <div style={cardHead}>Depósitos en progreso</div>
            <div style={{ padding: '16px 20px' }}>
              {enProgreso.map(dep => {
                const periodosStr = (dep.depositos_cds || []).map(x => `${periodoLabel(x.periodo_inicio)} · ${rango(x.periodo_inicio, x.periodo_fin)}`).join(', ') || '—';
                const dCRC = (Number(dep.total_contado_colones) || 0) - (Number(dep.total_referencia_colones) || 0);
                const cCRC = Math.abs(dCRC) < 5 ? '#27AE60' : Math.abs(dCRC) < 500 ? '#F39C12' : '#E74C3C';
                return (
                  <div key={dep.id} style={{ border: '1.5px solid #E2DDD4', borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#1A1714', fontFamily: "'DM Mono', monospace" }}>{periodosStr}</div>
                        <div style={{ fontSize: '11px', color: '#9C9590', marginTop: '2px' }}>Contó {dep.contado_por || '—'} · {fmtFecha(dep.fecha_conteo)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '15px', fontWeight: '700', color: '#1A1714' }}>{fmtCRC(dep.total_contado_colones)}</div>
                        {Number(dep.total_contado_usd) > 0 && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '12px', fontWeight: '600', color: '#C8A84B' }}>{fmtUSD(dep.total_contado_usd)}</div>}
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', fontWeight: '700', color: cCRC, marginTop: '2px' }}>
                          {Math.abs(dCRC) < 5 ? '✓ Cuadra' : (dCRC > 0 ? '+' : '−') + fmtCRC(Math.abs(dCRC))}
                        </div>
                      </div>
                    </div>

                    {completandoId === dep.id ? (
                      <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #E2DDD4' }}>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                          <div>
                            <label style={{ fontSize: '10px', fontWeight: '700', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Banco</label>
                            <div style={{ padding: '9px 16px', borderRadius: '8px', background: '#E8F3EC', border: '2px solid #2a78a5', fontWeight: '700', color: '#1A1714', fontSize: '13px' }}>BAC</div>
                          </div>
                          <div style={{ flex: 1, minWidth: '140px' }}>
                            <label style={{ fontSize: '10px', fontWeight: '700', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}># Boleta / referencia</label>
                            <input type="text" value={compReferencia} onChange={e => setCompReferencia(e.target.value)} placeholder="Número de boleta"
                              style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: '10px', fontWeight: '700', color: '#6B6560', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Fecha</label>
                            <input type="date" value={compFecha} onChange={e => setCompFecha(e.target.value)}
                              style={{ padding: '9px 12px', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '14px', fontFamily: "'DM Mono', monospace" }} />
                          </div>
                        </div>

                        <label style={{ display: 'block', border: '2px dashed #E2DDD4', borderRadius: '8px', padding: '16px', textAlign: 'center', cursor: 'pointer', background: '#F0EDE6', marginBottom: '12px' }}
                          onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                          onDrop={e => { e.preventDefault(); e.stopPropagation(); handleArchivo(e.dataTransfer.files?.[0]); }}>
                          <div style={{ fontSize: '18px', marginBottom: '4px' }}>📎</div>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: '#6B6560' }}>Foto del comprobante (opcional)</div>
                          <div style={{ fontSize: '10px', color: '#9C9590', marginTop: '2px' }}>JPG, PNG o PDF</div>
                          <input type="file" accept="image/*,.pdf" capture="environment" onChange={e => handleArchivo(e.target.files?.[0])} style={{ display: 'none' }} />
                        </label>

                        {compPreview && (
                          <div style={{ marginBottom: '12px', padding: '10px', background: '#E8F3EC', borderRadius: '8px', border: '1px solid #A8E6C6' }}>
                            {typeof compPreview === 'string' && compPreview.startsWith('data:')
                              ? <img src={compPreview} alt="preview" style={{ width: '100%', borderRadius: '6px', maxHeight: '180px', objectFit: 'cover' }} />
                              : <div style={{ fontSize: '12px', color: '#2a78a5', fontWeight: '600' }}>{compPreview}</div>}
                            <button type="button" onClick={() => { setCompArchivo(null); setCompPreview(null); }}
                              style={{ marginTop: '8px', fontSize: '11px', padding: '4px 8px', background: '#FDEDEC', color: '#C0392B', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}>Quitar</button>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button onClick={() => completar(dep.id)} disabled={completando}
                            style={{ flex: 1, padding: '10px', background: '#27AE60', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: completando ? 'wait' : 'pointer' }}>
                            {completando ? 'Completando...' : 'Completar depósito'}
                          </button>
                          <button onClick={() => setCompletandoId(null)} disabled={completando}
                            style={{ padding: '10px 16px', background: '#fff', color: '#6B6560', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                        <button onClick={() => abrirCompletar(dep.id)}
                          style={{ padding: '8px 16px', background: '#2a78a5', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>Completar</button>
                        <button onClick={() => deshacer(dep.id)}
                          style={{ padding: '8px 16px', background: '#fff', color: '#C0392B', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Deshacer</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* (d) Completados */}
        <div style={cardStyle}>
          <div style={cardHead}>Depósitos realizados</div>
          <div style={{ padding: '16px 20px' }}>
            {loadingDepositos ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#9C9590' }}>Cargando...</div>
            ) : completados.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#9C9590' }}>Aún no hay depósitos realizados</div>
            ) : (
              completados.map(dep => {
                const periodosStr = (dep.depositos_cds || []).map(x => `${periodoLabel(x.periodo_inicio)} · ${rango(x.periodo_inicio, x.periodo_fin)}`).join(', ') || '—';
                return (
                  <div key={dep.id} style={{ border: '1.5px solid #E2DDD4', borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#EDE9F6', color: '#5B35B5', fontSize: '11px', fontWeight: '700' }}>{dep.banco}</span>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', fontWeight: '700', color: '#1A1714' }}>#{dep.referencia}</span>
                          <span style={{ fontSize: '12px', color: '#6B6560' }}>{fmtFecha(dep.fecha_deposito)}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#6B6560', marginTop: '4px', fontFamily: "'DM Mono', monospace" }}>{periodosStr}</div>
                        <div style={{ fontSize: '11px', color: '#9C9590', marginTop: '2px' }}>Contó {dep.contado_por || '—'} · Depositó {dep.completado_por || '—'}</div>
                      </div>
                      <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '15px', fontWeight: '700', color: '#1A1714' }}>{fmtCRC(dep.total_contado_colones)}</div>
                        {Number(dep.total_contado_usd) > 0 && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '12px', fontWeight: '600', color: '#C8A84B' }}>{fmtUSD(dep.total_contado_usd)}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '12px', alignItems: 'center' }}>
                      {dep.comprobante_url
                        ? <a href={dep.comprobante_url} target="_blank" rel="noreferrer" style={{ fontSize: '13px', fontWeight: '700', color: '#2a78a5', textDecoration: 'none' }}>Ver comprobante ↗</a>
                        : <span style={{ fontSize: '12px', color: '#9C9590' }}>Sin comprobante</span>}
                      <button onClick={() => deshacer(dep.id)}
                        style={{ marginLeft: 'auto', padding: '6px 12px', background: '#fff', color: '#C0392B', border: '1.5px solid #E2DDD4', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Deshacer</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: toastBg, color: '#fff', padding: '12px 20px', borderRadius: '20px', fontSize: '14px', fontWeight: '600', zIndex: 9999 }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
