import supabase from '../../../../lib/supabase-server.js';

export async function POST(request) {
  try {
    const hoy = new Date();
    const anoActual = hoy.getFullYear();
    const mesActual = hoy.getMonth() + 1;

    const registros = [];

    // Generar TCs históricos para los últimos 2 meses y el mes actual
    for (let mesesAtras = 2; mesesAtras >= 0; mesesAtras--) {
      const fecha = new Date(anoActual, mesActual - 1 - mesesAtras, 1);
      const ano = fecha.getFullYear();
      const mes = fecha.getMonth() + 1;

      // TC base varia por mes (simulando fluctuaciones reales)
      const tcBase = 475 + Math.floor(Math.random() * 10);

      for (let periodo = 1; periodo <= 6; periodo++) {
        // Variar TC ligeramente por período dentro del mes
        const variacion = Math.floor(Math.random() * 4) - 2; // -2 a +2
        const tc = tcBase + (periodo - 1) * 1 + variacion;

        registros.push({
          ano,
          mes,
          periodo_num: periodo,
          tipo_cambio: tc,
          tipo_cambio_bruto: tc + 10,
        });
      }
    }

    // Insertar todos los registros con upsert para no duplicar
    const { error } = await supabase
      .from('periodo_tipos_cambio')
      .upsert(registros, { onConflict: 'ano,mes,periodo_num' });

    if (error) {
      console.error('Error insertando TC de prueba:', error);
      return Response.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      message: `${registros.length} TCs históricos creados para 3 meses`,
      registros: registros.length,
    }, { status: 201 });
  } catch (err) {
    console.error('Server error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
