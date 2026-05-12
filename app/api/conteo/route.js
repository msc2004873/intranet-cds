import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();
    const { cajera, caja, fecha, hora, dolares, total_colones, ...denoms } = body;

    const { error } = await supabase.from('conteo_caja').insert({
      cajera,
      caja,
      fecha,
      hora,
      dolares,
      total_colones,
      ...denoms
    });

    if (error) throw error;

    return Response.json({ success: true });
  } catch (err) {
    console.error('Error conteo:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
