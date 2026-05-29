'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ModuleSelection() {
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setUserName(user.nombre || '');
      setUserRole(user.rol || 'cajera');
      
      // Si es cajera, redirigir directamente al dashboard
      if (user.rol === 'cajera') {
        router.push('/');
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  const handleModuleSelect = (module) => {
    if (module === 'cajera') {
      router.push('/');
    } else if (module === 'admin') {
      router.push('/admin');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#FDFBF7',
      padding: '20px'
    }}>
      <div style={{
        textAlign: 'center',
        marginBottom: '48px'
      }}>
        <img src="/corral-del-sol-logo-principal.png" alt="Corral del Sol" style={{ height: '80px', marginBottom: '24px' }} />
        <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1A1714', marginBottom: '8px' }}>Bienvenido, {userName}</h1>
        <p style={{ fontSize: '16px', color: '#6B6560' }}>Selecciona el módulo que deseas usar</p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '24px',
        maxWidth: '900px',
        width: '100%'
      }}>
        <button
          onClick={() => handleModuleSelect('cajera')}
          style={{
            background: '#FFFFFF',
            border: '2px solid #2a78a5',
            borderRadius: '16px',
            padding: '48px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            cursor: 'pointer',
            textDecoration: 'none',
            color: 'inherit',
            transition: 'all 0.2s ease',
            textAlign: 'center',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#1f5780';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(42,120,165,0.2)';
            e.currentTarget.style.transform = 'translateY(-4px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#2a78a5';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{
            width: '80px',
            height: '80px',
            background: '#E8F3EC',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ fontSize: '40px' }}>💰</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#1A1714' }}>Módulo Cajera</div>
          <div style={{ fontSize: '14px', color: '#6B6560', lineHeight: 1.6 }}>
            Registra movimientos, conteos, cierres de caja y cobros
          </div>
        </button>

        {userRole === 'admin' && (
          <button
            onClick={() => handleModuleSelect('admin')}
            style={{
              background: '#FFFFFF',
              border: '2px solid #5B35B5',
              borderRadius: '16px',
              padding: '48px 32px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              cursor: 'pointer',
              textDecoration: 'none',
              color: 'inherit',
              transition: 'all 0.2s ease',
              textAlign: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#4A2A8F';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(91,53,181,0.2)';
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#5B35B5';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{
              width: '80px',
              height: '80px',
              background: '#EDE9F6',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: '40px' }}>⚙️</span>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#1A1714' }}>Módulo Administración</div>
            <div style={{ fontSize: '14px', color: '#6B6560', lineHeight: 1.6 }}>
              Gestiona colaboradores, depósitos y configuración del sistema
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
