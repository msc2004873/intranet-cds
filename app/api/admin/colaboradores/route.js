import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  try {
    const { data, error } = await supabase
      .from('colaboradores')
      .select('id, nombre, iniciales, rol, activo, created_at')
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error fetching colaboradores:', error);
      return Response.json({ error: 'Error al obtener colaboradores' }, { status: 500 });
    }

    return Response.json({ colaboradores: data || [] });
  } catch (err) {
    console.error('Error en GET /api/admin/colaboradores:', err);
    return Response.json({ error: 'Error al procesar solicitud' }, { status: 500 });
  }
}
