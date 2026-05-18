import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const { iniciales, pin } = await req.json();

    if (!iniciales || !pin) {
      return Response.json({ error: 'Iniciales y PIN requeridos' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('colaboradores')
      .select('id, nombre, iniciales, rol, pin')
      .eq('iniciales', iniciales.toUpperCase())
      .eq('activo', true)
      .single();

    if (error || !data) {
      return Response.json({ error: 'Iniciales o PIN incorrectos' }, { status: 401 });
    }

    if (data.pin !== pin) {
      return Response.json({ error: 'Iniciales o PIN incorrectos' }, { status: 401 });
    }

    return Response.json({
      id: data.id,
      nombre: data.nombre,
      iniciales: data.iniciales,
      rol: data.rol
    });
  } catch (err) {
    console.error('Error login:', err);
    return Response.json({ error: 'Error al procesar solicitud' }, { status: 500 });
  }
}
