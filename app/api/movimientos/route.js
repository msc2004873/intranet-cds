import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get('tipo');
    const fecha = searchParams.get('fecha');

    let query = supabase.from('movimientos').select('*');

    if (tipo) {
      query = query.eq('tipo', tipo);
    }

    if (fecha) {
      query = query.eq('fecha', fecha);
    }

    const { data, error } = await query.order('hora_registro', { ascending: false });

    if (error) throw error;

    return Response.json(data || []);
  } catch (err) {
    console.error('Error movimientos:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    const { data, error } = await supabase
      .from('movimientos')
      .insert([
        {
          tipo: body.tipo,
          monto: body.monto,
          moneda: body.moneda || 'colones',
          comprobante: body.comprobante || null,
          descripcion: body.descripcion || null,
          cajera: body.cajera,
          caja: body.caja,
          fecha: body.fecha || new Date().toISOString().split('T')[0]
        }
      ])
      .select();

    if (error) throw error;

    return Response.json(data[0], { status: 201 });
  } catch (err) {
    console.error('Error guardando movimiento:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
