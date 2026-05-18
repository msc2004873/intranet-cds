import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  try {
    const { data, error } = await supabase
      .from('colaboradores')
      .select('id, nombre, iniciales, rol, activo')
      .order('nombre');

    if (error) throw error;
    return Response.json(data);
  } catch (err) {
    console.error('Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { nombre, iniciales, pin, rol } = await req.json();

    if (!nombre || !iniciales || !pin) {
      return Response.json({ error: 'Faltan campos' }, { status: 400 });
    }

    if (!/^\d{4}$/.test(pin)) {
      return Response.json({ error: 'PIN debe ser 4 dígitos' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('colaboradores')
      .insert({
        nombre,
        iniciales: iniciales.toUpperCase(),
        pin,
        rol: rol || 'cajera',
        activo: true
      })
      .select();

    if (error) throw error;
    return Response.json(data[0], { status: 201 });
  } catch (err) {
    console.error('Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
