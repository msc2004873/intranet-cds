import supabase from '../../../../lib/supabase-server.js';

const getPeriodosDelMes = (fecha = new Date()) => {
  const ano = fecha.getFullYear();
  const mes = fecha.getMonth() + 1;
  const ultimoDiaMes = new Date(ano, mes, 0).getDate();

  const periodos = [
    { num: 1, inicio: 1, fin: 5 },
    { num: 2, inicio: 6, fin: 10 },
    { num: 3, inicio: 11, fin: 15 },
    { num: 4, inicio: 16, fin: 20 },
    { num: 5, inicio: 21, fin: 25 },
    { num: 6, inicio: 26, fin: ultimoDiaMes },
  ];

  return periodos.map(p => ({
    num: p.num,
    inicio: new Date(ano, mes - 1, p.inicio),
    fin: new Date(ano, mes - 1, p.fin),
  }));
};

const getPeriodoActual = (fecha = new Date()) => {
  const dia = fecha.getDate();

  if (dia <= 5) return { num: 1, inicio: 1, fin: 5 };
  if (dia <= 10) return { num: 2, inicio: 6, fin: 10 };
  if (dia <= 15) return { num: 3, inicio: 11, fin: 15 };
  if (dia <= 20) return { num: 4, inicio: 16, fin: 20 };
  if (dia <= 25) return { num: 5, inicio: 21, fin: 25 };

  const ultimoDia = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate();
  return { num: 6, inicio: 26, fin: ultimoDia };
};

export async function GET(request) {
  try {
    const hoy = new Date();
    const ano = hoy.getFullYear();
    const mes = hoy.getMonth() + 1;
    const dia = hoy.getDate();

    const periodoActual = getPeriodoActual(hoy);
    const esPrimerDia = dia === periodoActual.inicio;

    // Buscar TC bloqueado para este período
    const { data: periodoTC } = await supabase
      .from('periodos_tipo_cambio')
      .select('tipo_cambio')
      .eq('ano', ano)
      .eq('mes', mes)
      .eq('periodo_num', periodoActual.num)
      .single();

    let tipoCambio = periodoTC?.tipo_cambio || null;

    // Si es primer día y no hay TC registrado, traer el del día y guardarlo
    if (esPrimerDia && !tipoCambio) {
      try {
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await res.json();
        if (data.rates && data.rates.CRC) {
          tipoCambio = Math.round(data.rates.CRC) - 10;

          // Guardar en la BD
          await supabase
            .from('periodos_tipo_cambio')
            .insert([
              {
                ano,
                mes,
                periodo_num: periodoActual.num,
                fecha_inicio: new Date(ano, mes - 1, periodoActual.inicio).toISOString().split('T')[0],
                fecha_fin: new Date(ano, mes - 1, periodoActual.fin).toISOString().split('T')[0],
                tipo_cambio: tipoCambio,
              },
            ]);
        }
      } catch (err) {
        console.error('Error fetching TC:', err);
        tipoCambio = 475; // Default
      }
    }

    return Response.json(
      {
        hoy: hoy.toISOString().split('T')[0],
        periodo: periodoActual.num,
        esPrimerDia,
        tipoCambio: tipoCambio || 475,
        periodos: getPeriodosDelMes(hoy),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
