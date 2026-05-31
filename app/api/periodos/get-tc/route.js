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
    const ano = fechaObj.getFullYear();
    const mes = fechaObj.getMonth() + 1;
    const periodo_num = parseInt(periodo);

    const { data, error } = await supabase
      .from('periodos_tipo_cambio')
      .select('tipo_cambio, tipo_cambio_ajustado')
      .eq('ano', ano)
      .eq('mes', mes)
      .eq('periodo_num', periodo_num)
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
