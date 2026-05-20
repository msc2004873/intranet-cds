export async function GET(request) {
  try {
    const hoy = new Date();
    const ano = hoy.getFullYear();
    const mes = hoy.getMonth();

    // Generar períodos con tipos de cambio
    const periodos = [
      {
        periodo_num: 1,
        fecha_inicio: `1 de ${hoy.toLocaleDateString('es-CR', { month: 'short' })}`,
        fecha_fin: `5 de ${hoy.toLocaleDateString('es-CR', { month: 'short' })}`,
        tipo_cambio: 475,
      },
      {
        periodo_num: 2,
        fecha_inicio: `6 de ${hoy.toLocaleDateString('es-CR', { month: 'short' })}`,
        fecha_fin: `10 de ${hoy.toLocaleDateString('es-CR', { month: 'short' })}`,
        tipo_cambio: 475,
      },
      {
        periodo_num: 3,
        fecha_inicio: `11 de ${hoy.toLocaleDateString('es-CR', { month: 'short' })}`,
        fecha_fin: `15 de ${hoy.toLocaleDateString('es-CR', { month: 'short' })}`,
        tipo_cambio: 475,
      },
      {
        periodo_num: 4,
        fecha_inicio: `16 de ${hoy.toLocaleDateString('es-CR', { month: 'short' })}`,
        fecha_fin: `20 de ${hoy.toLocaleDateString('es-CR', { month: 'short' })}`,
        tipo_cambio: 475,
      },
      {
        periodo_num: 5,
        fecha_inicio: `21 de ${hoy.toLocaleDateString('es-CR', { month: 'short' })}`,
        fecha_fin: `25 de ${hoy.toLocaleDateString('es-CR', { month: 'short' })}`,
        tipo_cambio: 475,
      },
      {
        periodo_num: 6,
        fecha_inicio: `26 de ${hoy.toLocaleDateString('es-CR', { month: 'short' })}`,
        fecha_fin: hoy.toLocaleDateString('es-CR', { day: 'numeric', month: 'short' }),
        tipo_cambio: 475,
      },
    ];

    return Response.json({ periodos });
  } catch (err) {
    console.error('Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
