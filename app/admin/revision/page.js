'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';

export default function RevisionPage() {
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
    <div style={{ minHeight: '100vh', background: '#FDFBF7' }}>
      <Header title="Revisión de Caja" subtitle="Validación de cierres" showLogout={true} showModuleSelector={true} />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1A1714', marginBottom: '8px' }}>Revisión de Caja</h2>
          <p style={{ fontSize: '14px', color: '#6B6560' }}>Revisa y valida los cierres de caja realizados</p>
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1.5px solid #E2DDD4', padding: '40px', textAlign: 'center', color: '#9C9590' }}>
          <p style={{ fontSize: '16px', marginBottom: '20px' }}>Módulo de revisión de caja en construcción</p>
          <p style={{ fontSize: '14px', color: '#B3A99F' }}>Esta sección estará disponible próximamente</p>
        </div>
      </div>
    </div>
  );
}
