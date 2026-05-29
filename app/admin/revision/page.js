'use client';

import Link from 'next/link';
import Header from '../../components/Header';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RevisionDashboard() {
  const router = useRouter();
  const [userRole, setUserRole] = useState('');

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

  if (!userRole || userRole !== 'admin') {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Header title="Revisión de Cajas" subtitle="Selecciona qué revisar" showLogout={false} showModuleSelector={true} homeLink="/admin" />

      {/* Main */}
      <div style={{ flex: 1, maxWidth: '720px', margin: '0 auto', padding: '24px 16px', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '24px' }}>

        {/* Botón Clínica */}
        <Link href="/admin/revision/clinica" style={{ textDecoration: 'none' }}>
          <div
            style={{
              padding: '48px 24px',
              background: 'linear-gradient(135deg, #E8F3EC 0%, #D4E8E0 100%)',
              border: '2px solid #2a78a5',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.3s',
              textAlign: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(42, 120, 165, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏥</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#1A1714', marginBottom: '8px' }}>Cajas Clínica</div>
            <div style={{ fontSize: '13px', color: '#6B6560' }}>Revisar cajas del período</div>
          </div>
        </Link>

        {/* Botón Glory */}
        <Link href="/admin/revision/glory" style={{ textDecoration: 'none' }}>
          <div
            style={{
              padding: '48px 24px',
              background: 'linear-gradient(135deg, #FBF6E9 0%, #F7F0DB 100%)',
              border: '2px solid #C8A84B',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.3s',
              textAlign: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(200, 168, 75, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✨</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#1A1714', marginBottom: '8px' }}>Caja Glory</div>
            <div style={{ fontSize: '13px', color: '#6B6560' }}>Revisar cobros del período</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
