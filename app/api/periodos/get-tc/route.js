import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const fecha = searchParams.get('fecha');
    const periodo = searchParams.get('periodo');

    if (!fecha || !periodo) {
      return Response.json({ error: 'fecha y periodo requeridos' }, { status: 400 });
    }

    const fechaObj = new Date(fecha);
    const year = fechaObj.getFullYear();
    const month = fechaObj.getMonth() + 1;
    const num_periodo = parseInt(periodo);

    const { data, error } = await supabase
      .from('periodos_tipo_cambio')
      .select('tipo_cambio, tipo_cambio_ajustado')
      .eq('year', year)
      .eq('month', month)
      .eq('num_periodo', num_periodo)
      .single();

    if (error || !data) {
      return Response.json({ tipo_cambio: 475, tipo_cambio_ajustado: 465 }, { status: 200 });
    }

    return Response.json(data);
  } catch (err) {
    console.error('Error obteniendo TC:', err);
    return Response.json({ tipo_cambio: 475, tipo_cambio_ajustado: 465 }, { status: 200 });
  }
}
