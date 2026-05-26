import supabase from '../../../../lib/supabase-server.js';

export async function GET(request) {
  try {
    // Intenta un select simple para ver qué retorna
    const { data, error } = await supabase
      .from('periodos_tipo_cambio')
      .select('*')
      .limit(1);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    // Si hay datos, devuelve la estructura
    if (data && data.length > 0) {
      const columnas = Object.keys(data[0]);
      return Response.json({
        columnas,
        primerRegistro: data[0]
      });
    }

    return Response.json({
      columnas: [],
      mensaje: 'No hay registros en la tabla'
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
