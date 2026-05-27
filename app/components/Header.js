'use client';

import { useRouter } from 'next/navigation';

export default function Header({ title, subtitle, showLogout = false }) {
  const router = useRouter();

  const handleBack = () => {
    if (showLogout) {
      localStorage.removeItem('user');
      router.push('/login');
    } else {
      router.push('/');
    }
  };

  return (
    <div style={{ background: '#2a78a5', color: 'white', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 12px rgba(42,120,165,0.2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img src="/corral-del-sol-logo.png" alt="Corral del Sol" style={{ height: '40px' }} />
        <div>
          <div style={{ fontSize: '18px', fontWeight: '600' }}>{title}</div>
          {subtitle && <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>{subtitle}</div>}
        </div>
      </div>
      <button
        onClick={handleBack}
        style={{
          padding: '6px 12px',
          background: 'rgba(255,255,255,0.2)',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: '6px',
          color: 'white',
          fontSize: '12px',
          fontWeight: '600',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        {showLogout ? 'Salir' : (
          <>
            <img src="/home-icon.svg" alt="Inicio" style={{ width: '16px', height: '16px' }} />
            Inicio
          </>
        )}
      </button>
    </div>
  );
}
