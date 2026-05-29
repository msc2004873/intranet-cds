'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';

export default function ColaboradoresPage() {
  const router = useRouter();
  const [colaboradores, setColaboradores] = useState([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    if (userRole === 'admin') {
      fetchColaboradores();
    }
  }, [userRole]);

  async function fetchColaboradores() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/colaboradores');
      const data = await res.json();
      setColaboradores(data.colaboradores || []);
    } catch (err) {
      console.error('Error fetching colaboradores:', err);
    } finally {
      setLoading(false);
    }
  }

  if (!userRole) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando...</div>;
  }

  if (userRole !== 'admin') {
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FDFBF7' }}>
      <Header title="Colaboradores" subtitle="Gestión de usuarios" showLogout={false} showModuleSelector={true} homeLink="/admin" />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1A1714', marginBottom: '8px' }}>Gestión de Colaboradores</h2>
          <p style={{ fontSize: '14px', color: '#6B6560' }}>Administra usuarios y permisos del sistema</p>
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1.5px solid #E2DDD4', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9C9590' }}>Cargando colaboradores...</div>
          ) : colaboradores.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9C9590' }}>No hay colaboradores</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2DDD4', background: '#FDFBF7' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Nombre</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Iniciales</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Rol</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6B6560', textTransform: 'uppercase' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {colaboradores.map((col) => (
                  <tr key={col.id} style={{ borderBottom: '1px solid #E2DDD4' }}>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1A1714' }}>{col.nombre}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1A1714', fontFamily: "'DM Mono', monospace", fontWeight: '600' }}>{col.iniciales}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1A1714' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        background: col.rol === 'admin' ? '#EDE9F6' : '#E8F3EC',
                        color: col.rol === 'admin' ? '#5B35B5' : '#2a78a5',
                        fontSize: '12px',
                        fontWeight: '600',
                        textTransform: 'capitalize'
                      }}>
                        {col.rol}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#1A1714' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        background: col.activo ? '#E8F3EC' : '#FDEDEC',
                        color: col.activo ? '#2a78a5' : '#C0392B',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {col.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
