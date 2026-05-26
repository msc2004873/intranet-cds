import supabase from '../../../../lib/supabase-server.js';

export async function GET(request) {
  try {
    // Obtener todos los registros
    const { data, error } = await supabase
      .from('periodos_tipo_cambio')
      .select('*');

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return Response.json({ message: 'No hay registros', updated: 0 });
    }

    // Actualizar cada registro
    let updated = 0;
    for (const reg of data) {
      const tcReal = reg.tipo_cambio;
      const tcAjustado = tcReal - 10;

      try {
        await supabase
          .from('periodos_tipo_cambio')
          .update({
            tipo_cambio_ajustado: tcAjustado,
          })
          .eq('id', reg.id);

        updated++;
      } catch (err) {
        console.log(`Error actualizando ${reg.id}:`, err.message);
      }
    }

    return Response.json({
      success: true,
      updated,
      total: data.length,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
