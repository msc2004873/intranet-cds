'use client';

import { useState } from 'react';

const PERIODOS = [
  { num: 1, inicio: 1, fin: 5, color: '#FF6B6B' },
  { num: 2, inicio: 6, fin: 10, color: '#4ECDC4' },
  { num: 3, inicio: 11, fin: 15, color: '#45B7D1' },
  { num: 4, inicio: 16, fin: 20, color: '#FFA07A' },
  { num: 5, inicio: 21, fin: 25, color: '#98D8C8' },
  { num: 6, inicio: 26, fin: 31, color: '#F7DC6F' },
];

const obtenerPeriodo = (dia) => {
  return PERIODOS.find(p => dia >= p.inicio && dia <= p.fin);
};

export default function CalendarioPeriodos({ onSelectPeriodo }) {
  const [mesOffset, setMesOffset] = useState(0);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(null);

  const hoy = new Date();
  const diaHoy = hoy.getDate();
  const mesHoy = hoy.getMonth();
  const anoHoy = hoy.getFullYear();

  const fechaActual = new Date(anoHoy, mesHoy + mesOffset, 1);
  const ano = fechaActual.getFullYear();
  const mes = fechaActual.getMonth();
  const ultimoDiaMes = new Date(ano, mes + 1, 0).getDate();
  const primerDia = new Date(ano, mes, 1).getDay();
  const primerDiaLunes = (primerDia === 0 ? 6 : primerDia - 1);

  // Detectar período actual (solo si es el mes actual)
  const esMessActual = mesOffset === 0 && ano === anoHoy;
  const periodoActual = esMessActual ? obtenerPeriodo(diaHoy) : null;

  const nombreMes = fechaActual.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' });
  const diasSemana = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  const dias = [];
  for (let i = 0; i < primerDiaLunes; i++) {
    dias.push(null);
  }
  for (let i = 1; i <= ultimoDiaMes; i++) {
    dias.push(i);
  }

  const handleSelectPeriodo = (periodo) => {
    setPeriodoSeleccionado(periodo.num);
    const inicio = new Date(ano, mes, periodo.inicio);
    const fin = new Date(ano, mes, periodo.fin);
    onSelectPeriodo({
      num: periodo.num,
      inicio,
      fin,
    });
  };

  const getRadiusStyle = (dia, periodo) => {
    if (!periodo) return {};

    const esInicio = dia === periodo.inicio;
    const esFin = dia === periodo.fin;

    if (esInicio && esFin) return { borderRadius: '6px' };
    if (esInicio) return { borderRadius: '6px 0 0 6px' };
    if (esFin) return { borderRadius: '0 6px 6px 0' };
    return {};
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '16px', padding: '16px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      {/* Header con navegación */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <button
          onClick={() => setMesOffset(mesOffset - 1)}
          style={{
            background: '#F0EDE6',
            border: '1px solid #E2DDD4',
            borderRadius: '6px',
            padding: '4px 8px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
            color: '#6B6560'
          }}
        >
          ← Anterior
        </button>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1714' }}>
          {nombreMes.toUpperCase()}
        </div>
        <button
          onClick={() => setMesOffset(mesOffset + 1)}
          style={{
            background: '#F0EDE6',
            border: '1px solid #E2DDD4',
            borderRadius: '6px',
            padding: '4px 8px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
            color: '#6B6560'
          }}
        >
          Siguiente →
        </button>
      </div>

      {/* Encabezados días de la semana */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0', marginBottom: '6px' }}>
        {diasSemana.map(d => (
          <div key={d} style={{ fontSize: '10px', fontWeight: '700', color: '#6B6560', textAlign: 'center', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid de días con períodos agrupados */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0' }}>
        {/* Espacios vacíos al inicio */}
        {dias.map((dia, idx) => {
          if (dia === null) {
            return <div key={`empty-${idx}`} style={{ minHeight: '28px' }} />;
          }

          const periodo = obtenerPeriodo(dia);
          const esHoy = periodoActual && periodo?.num === periodoActual.num;
          const esSeleccionado = periodoSeleccionado === periodo?.num && !esHoy;
          const borderColor = esHoy ? '#27AE60' : esSeleccionado ? '#E74C3C' : '#E2DDD4';
          const bgColor = esHoy ? '#27AE60' : esSeleccionado ? '#E74C3C' : '#fff';
          const esInicioPeriodo = periodo?.inicio === dia;
          const esFinPeriodo = periodo?.fin === dia;

          return (
            <div
              key={dia}
              onClick={() => periodo && handleSelectPeriodo(periodo)}
              style={{
                minHeight: '28px',
                background: bgColor,
                textAlign: 'center',
                cursor: periodo ? 'pointer' : 'default',
                fontSize: '11px',
                fontWeight: '600',
                color: (esHoy || esSeleccionado) ? '#fff' : '#1A1714',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                // Borde: completo en inicio, derecho en fin, arriba y abajo en todos del período
                borderTop: `2px solid ${borderColor}`,
                borderBottom: `2px solid ${borderColor}`,
                borderLeft: esInicioPeriodo ? `2px solid ${borderColor}` : 'none',
                borderRight: esFinPeriodo ? `2px solid ${borderColor}` : 'none',
                borderRadius: esInicioPeriodo ? '8px 0 0 8px' : esFinPeriodo ? '0 8px 8px 0' : '0',
                boxShadow: (esHoy || esSeleccionado) ? '0 2px 6px rgba(0,0,0,0.15)' : 'none'
              }}
            >
              {dia}
            </div>
          );
        })}
      </div>
    </div>
  );
}
