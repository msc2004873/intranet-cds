import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const body = await req.json();
    const { cajera, caja, fecha, hora, dolares, total_colones, ...denoms } = body;

    // Validaciones
    if (!cajera || cajera === '') throw new Error('Falta cajera');
    if (!caja || caja === '') throw new Error('Falta caja');
    if (typeof total_colones !== 'number' || total_colones < 0) throw new Error('total_colones debe ser número positivo');
    if (typeof dolares !== 'number' || dolares < 0) throw new Error('dolares debe ser número positivo');

    // Validar denominaciones no negativas
    for (const [key, value] of Object.entries(denoms)) {
      if (key.startsWith('c_') && (typeof value !== 'number' || value < 0)) {
        throw new Error(`Denominación ${key} debe ser número positivo`);
      }
    }

    // Convertir hora CR a UTC para guardar
    // hora viene como "YYYY-MM-DDTHH:MM:SS" en hora CR
    const crDate = new Date(hora + 'Z'); // Parsear como si fuera UTC
    const horaUTC = new Date(crDate.getTime() + (6 * 60 * 60 * 1000)).toISOString(); // Sumar 6 horas para convertir CR a UTC

    const { error } = await supabase.from('conteo_caja').insert({
      cajera,
      caja,
      fecha,
      hora: horaUTC,
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
