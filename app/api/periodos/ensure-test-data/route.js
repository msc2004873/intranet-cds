import supabase from '../../../../lib/supabase-server.js';

export async function GET(request) {
  try {
    const hoy = new Date();
    const anoActual = hoy.getFullYear();
    const mesActual = hoy.getMonth() + 1;

    // Solo llenar el mes actual con TC de la API
    const tcAPI = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
      .then(r => r.json())
      .then(d => d.rates?.CRC ? Math.round(d.rates.CRC) - 10 : 475)
      .catch(() => 475);

    const ultimoDiaDelMes = new Date(anoActual, mesActual, 0).getDate();
    const registros = [];

    // Generar TCs solo para el mes actual si no existen
    for (let periodo = 1; periodo <= 6; periodo++) {
      const inicio = (periodo - 1) * 5 + 1;
      const fin = periodo === 6 ? ultimoDiaDelMes : periodo * 5;

      const fechaInicio = new Date(anoActual, mesActual - 1, inicio).toISOString().split('T')[0];
      const fechaFin = new Date(anoActual, mesActual - 1, fin).toISOString().split('T')[0];

      registros.push({
        ano: anoActual,
        mes: mesActual,
        periodo_num: periodo,
        tipo_cambio: tcAPI,
        tipo_cambio_ajustado: tcAPI - 10,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
      });
    }

    // Insertar/actualizar solo si no existen
    const { error } = await supabase
      .from('periodos_tipo_cambio')
      .upsert(registros, { onConflict: 'ano,mes,periodo_num' });

    if (error) {
      console.error('Error creando datos de prueba:', error);
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({
      success: true,
      registros: registros.length
    });
  } catch (err) {
    console.error('Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
