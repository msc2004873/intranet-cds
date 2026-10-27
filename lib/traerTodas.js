// Supabase entrega como máximo 1000 filas por consulta y corta el resto SIN AVISAR
// (no da error: simplemente faltan filas). Para las tablas que crecen todos los días,
// pedir por páginas hasta que no quede nada.
//
// `armarConsulta` tiene que devolver una consulta NUEVA cada vez y con un .order()
// fijo (por id), para que las páginas no se crucen.
export async function traerTodas(armarConsulta, tamano = 1000) {
  const filas = [];
  for (let desde = 0; ; desde += tamano) {
    const { data, error } = await armarConsulta().range(desde, desde + tamano - 1);
    if (error) throw error;
    filas.push(...(data || []));
    if (!data || data.length < tamano) return filas;
  }
}
