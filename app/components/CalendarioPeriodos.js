'use client';

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
  const hoy = new Date();
  const ano = hoy.getFullYear();
  const mes = hoy.getMonth();
  const ultimoDiaMes = new Date(ano, mes + 1, 0).getDate();
  const primerDia = new Date(ano, mes, 1).getDay();
  const primerDiaLunes = (primerDia === 0 ? 6 : primerDia - 1);

  const nombreMes = hoy.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' });
  const diasSemana = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  const dias = [];
  for (let i = 0; i < primerDiaLunes; i++) {
    dias.push(null);
  }
  for (let i = 1; i <= ultimoDiaMes; i++) {
    dias.push(i);
  }

  const handleSelectPeriodo = (periodo) => {
    const inicio = new Date(ano, mes, periodo.inicio);
    const fin = new Date(ano, mes, periodo.fin);
    onSelectPeriodo({
      num: periodo.num,
      inicio,
      fin,
    });
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #E2DDD4', borderRadius: '16px', padding: '16px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1714', marginBottom: '12px', textAlign: 'center' }}>
        {nombreMes.toUpperCase()}
      </div>

      {/* Encabezados días de la semana */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0', marginBottom: '6px' }}>
        {diasSemana.map(d => (
          <div key={d} style={{ fontSize: '10px', fontWeight: '700', color: '#6B6560', textAlign: 'center', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid de días */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {dias.map((dia, idx) => {
          if (dia === null) {
            return <div key={`empty-${idx}`} style={{ minHeight: '28px' }} />;
          }

          const periodo = obtenerPeriodo(dia);
          return (
            <div
              key={dia}
              onClick={() => periodo && handleSelectPeriodo(periodo)}
              style={{
                minHeight: '28px',
                background: periodo?.color || '#F0EDE6',
                textAlign: 'center',
                cursor: periodo ? 'pointer' : 'default',
                fontSize: '11px',
                fontWeight: '600',
                color: '#1A1714',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'opacity 0.2s',
                borderRadius: '6px'
              }}
              onMouseEnter={(e) => {
                if (periodo) {
                  e.currentTarget.style.opacity = '0.8';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
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
