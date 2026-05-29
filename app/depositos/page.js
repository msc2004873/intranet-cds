'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';

export default function DepositosPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState('');
  const [loading, setLoading] = useState(true);

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
    setLoading(false);
  }, [router]);

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando...</div>;
  }

  if (userRole !== 'admin') {
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FDFBF7' }}>
      <Header />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ marginBottom: '48px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#1A1714', marginBottom: '12px' }}>Depósitos</h1>
          <p style={{ fontSize: '16px', color: '#6B6560' }}>Registra y monitorea los depósitos bancarios</p>
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1.5px solid #E2DDD4', padding: '40px', textAlign: 'center', color: '#9C9590' }}>
          <p style={{ fontSize: '16px', marginBottom: '20px' }}>Módulo de depósitos en construcción</p>
          <p style={{ fontSize: '14px', color: '#B3A99F' }}>Esta sección estará disponible próximamente</p>
        </div>
      </div>
    </div>
  );
}
