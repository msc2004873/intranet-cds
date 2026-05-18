'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';

const generarPeriodos = () => {
  const hoy = new Date();
  const periodos = [];
  
  for (let i = 0; i < 6; i++) {
    const inicio = new Date(hoy);
    inicio.setDate(hoy.getDate() - (hoy.getDate() % 5) - (i * 5));
    
    const fin = new Date(inicio);
    fin.setDate(inicio.getDate() + 4);
    
    periodos.push({
      id: `${inicio.toISOString().split('T')[0]}_${fin.toISOString().split('T')[0]}`,
      inicio,
      fin
    });
  }
  
  return periodos;
};

const formatFecha = (date) => {
  return date.toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: '2-digit' });
};

export default function RevisoraListPage() {
  const router = useRouter();
  const [periodos, setPeriodos] = useState([]);

  useEffect(() => {
    setPeriodos(generarPeriodos());
  }, []);

  const handleRevisar = (periodId) => {
    router.push(`/revisora/${periodId}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'DM Sans', sans-serif" }}>
      <Header title="Revisión de Caja" subtitle="Períodos pendientes" showLogout={false} />

      <div style={{ flex: 1, maxWidth: '720px', margin: '0 auto', padding: '24px 16px', width: '100%' }}>
        {['Caja 1 (clínica)', 'Caja 2'].map((caja) => (
          <div key={caja} style={{ marginBottom: '32px' }}>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#1A1714', marginBottom: '16px', paddingBottom: '12px', borderBottom: '2px solid #E2DDD4' }}>
              {caja === 'Caja 1 (clínica)' ? '🏥' : '💳'} {caja}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {periodos.map((periodo) => (
                <div
                  key={`${caja}_${periodo.id}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px',
                    background: '#F7F5F0',
                    border: '1.5px solid #E2DDD4',
                    borderRadius: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#E2DDD4';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#F7F5F0';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input type="checkbox" disabled style={{ width: '20px', height: '20px', cursor: 'not-allowed' }} />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1714' }}>
                        {formatFecha(periodo.inicio)} — {formatFecha(periodo.fin)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#9C9590', marginTop: '2px' }}>Período de 5 días</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevisar(periodo.id)}
                    style={{
                      padding: '8px 16px',
                      background: '#2a78a5',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#1f5780';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#2a78a5';
                    }}
                  >
                    Revisar
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
