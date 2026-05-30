import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

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

    const userData = {
      id: data.id,
      nombre: data.nombre,
      iniciales: data.iniciales,
      rol: data.rol
    };

    // Establecer cookies seguras
    try {
      const cookieStore = await cookies();
      cookieStore.set('user', JSON.stringify(userData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 días
      });

      // Token simple (se puede mejorar con JWT)
      const authToken = Buffer.from(`${data.id}:${Date.now()}`).toString('base64');
      cookieStore.set('authToken', authToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 días
      });
    } catch (cookieErr) {
      console.error('Error setting cookies:', cookieErr);
      // Continuar de todas formas, retornar success pero sin cookies
    }

    // Retornar con headers para asegurar cookies
    const response = Response.json(userData);
    return response;
  } catch (err) {
    console.error('Error login:', err);
    return Response.json({ error: 'Error al procesar solicitud' }, { status: 500 });
  }
}
