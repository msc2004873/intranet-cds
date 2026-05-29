'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';

const buttonStyle = {
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
};

const buttonHoverEnter = (e) => {
  e.currentTarget.style.borderColor = '#5B35B5';
  e.currentTarget.style.boxShadow = '0 4px 20px rgba(91,53,181,0.12)';
  e.currentTarget.style.transform = 'translateY(-2px)';
};

const buttonHoverLeave = (e) => {
  e.currentTarget.style.borderColor = '#E2DDD4';
  e.currentTarget.style.boxShadow = 'none';
  e.currentTarget.style.transform = 'translateY(0)';
};

export default function AdminPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState('');
  const [tcActual, setTcActual] = useState(null);
  const [periodo, setPeriodo] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setUserRole(user.rol || '');
      if (user.rol !== 'admin') {
        router.push('/');
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    if (userRole === 'admin') {
      fetchPeriodoActual();
    }
  }, [userRole]);

  async function fetchPeriodoActual() {
    try {
      const res = await fetch('/api/periodos/get-actual');
      const data = await res.json();
      setPeriodo(data.periodo);
      setTcActual(data.tipoCambio);
    } catch (err) {
      console.error('Error fetching período:', err);
    }
  }

  if (!userRole) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando...</div>;
  }

  if (userRole !== 'admin') {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header title="Administración" subtitle="Gestión del sistema" showLogout={true} showModuleSelector={true} />

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
        {/* TC y Período */}
        <div style={{
          display: 'flex',
          gap: '16px',
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}>
          <div style={{
            background: '#5B35B5',
            color: 'white',
            padding: '20px 32px',
            borderRadius: '16px',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(91,53,181,0.2)',
            minWidth: '200px',
          }}>
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: '600' }}>Tipo de cambio del período</div>
            <div style={{ fontSize: '36px', fontWeight: '700', fontFamily: "'DM Mono', monospace", letterSpacing: '-1px' }}>₡{tcActual || '—'}</div>
            <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '6px' }}>Período {periodo}</div>
          </div>

          <div style={{
            background: '#5B35B5',
            color: 'white',
            padding: '20px 32px',
            borderRadius: '16px',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(91,53,181,0.2)',
            minWidth: '200px',
          }}>
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: '600' }}>Período actual</div>
            <div style={{ fontSize: '28px', fontWeight: '700', fontFamily: "'DM Mono', monospace", letterSpacing: '-0.5px', marginBottom: '6px' }}>
              {new Date().getDate()} de {new Date().toLocaleDateString('es-CR', { month: 'short' })}
            </div>
            <div style={{ fontSize: '10px', opacity: 0.7 }}>Período {periodo}</div>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '600', color: '#1A1714', letterSpacing: '-0.4px' }}>¿Qué necesitás administrar?</h2>
          <p style={{ fontSize: '14px', color: '#6B6560', marginTop: '6px' }}>Selecciona la sección que deseas gestionar</p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '16px',
          maxWidth: '960px',
          width: '100%',
        }}>
          <a href="/admin/revision" style={buttonStyle} onMouseEnter={buttonHoverEnter} onMouseLeave={buttonHoverLeave}>
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
            <div style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.5 }}>Revisá y validá los cierres de caja</div>
            <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '20px', marginTop: '2px', background: '#FBF6E9', color: '#8B6914' }}>Revisión</span>
          </a>

          <a href="/admin/depositos" style={buttonStyle} onMouseEnter={buttonHoverEnter} onMouseLeave={buttonHoverLeave}>
            <div style={{
              width: '56px',
              height: '56px',
              background: '#FBF6E9',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: '26px' }}>🏦</span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#1A1714', letterSpacing: '-0.2px' }}>Depósitos</div>
            <div style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.5 }}>Registrá y seguí depósitos bancarios</div>
            <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '20px', marginTop: '2px', background: '#FBF6E9', color: '#8B6914' }}>Depósitos</span>
          </a>

          <a href="/admin/colaboradores" style={buttonStyle} onMouseEnter={buttonHoverEnter} onMouseLeave={buttonHoverLeave}>
            <div style={{
              width: '56px',
              height: '56px',
              background: '#EDE9F6',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: '26px' }}>👥</span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#1A1714', letterSpacing: '-0.2px' }}>Colaboradores</div>
            <div style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.5 }}>Gestiona usuarios y permisos del sistema</div>
            <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', padding: '3px 10px', borderRadius: '20px', marginTop: '2px', background: '#EDE9F6', color: '#5B35B5' }}>Usuarios</span>
          </a>
        </div>
      </div>
    </div>
  );
}
