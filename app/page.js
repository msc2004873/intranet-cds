'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [tc, setTc] = useState(null);

  useEffect(() => {
    fetchTipoCambio();
  }, []);

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
      setTc(475); // Valor por defecto si falla
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={{
        background: '#2a78a5',
        color: 'white',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        boxShadow: '0 2px 12px rgba(42,120,165,0.2)',
      }}>
        <div style={{ fontSize: '28px' }}>🐾</div>
        <div>
          <div style={{ fontSize: '20px', fontWeight: '600', letterSpacing: '-0.3px' }}>Corral del Sol</div>
          <div style={{ fontSize: '12px', opacity: 0.65, fontFamily: "'DM Mono', monospace", marginTop: '1px' }}>Sistema interno</div>
        </div>
      </div>

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
        {/* TC del día */}
        <div style={{
          background: '#2a78a5',
          color: 'white',
          padding: '20px 32px',
          borderRadius: '16px',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(42,120,165,0.2)',
          minWidth: '200px',
        }}>
          <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: '600' }}>Tipo de cambio del día</div>
          <div style={{ fontSize: '36px', fontWeight: '700', fontFamily: "'DM Mono', monospace", letterSpacing: '-1px' }}>₡{tc || '—'}</div>
          <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '6px' }}>USD 1 = ₡{tc || '—'} (internet - 10)</div>
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
      </div>

      <div style={{
        textAlign: 'center',
        padding: '20px',
        fontSize: '11px',
        color: '#9C9590',
        fontFamily: "'DM Mono', monospace",
      }}>Corral del Sol © 2025 — Solo para uso interno</div>
    </div>
  );
}
