import supabase from '../../../lib/supabase-server.js';

export async function POST(request) {
  try {
    const data = await request.json();

    const { cierre_id, denominaciones, tarjetas, dolares, sinpeRevisado, transfRevisadas, salidEvaluadas } = data;

    if (!cierre_id) {
      return Response.json(
        { error: 'cierre_id es requerido' },
        { status: 400 }
      );
    }

    // Calcular totales
    const totalEnCaja = Object.entries(denominaciones).reduce((sum, [denom, cant]) => {
      return sum + (parseInt(denom) * cant);
    }, 0);

    const revisaData = {
      cierre_id,
      revision_completada: true,
      c_20000: denominaciones[20000] || 0,
      c_10000: denominaciones[10000] || 0,
      c_5000: denominaciones[5000] || 0,
      c_2000: denominaciones[2000] || 0,
      c_1000: denominaciones[1000] || 0,
      c_500: denominaciones[500] || 0,
      c_100: denominaciones[100] || 0,
      c_50: denominaciones[50] || 0,
      c_25: denominaciones[25] || 0,
      c_10: denominaciones[10] || 0,
      c_5: denominaciones[5] || 0,
      dolares_total: dolares,
      tarjeta_bac: tarjetas.bac || 0,
      tarjeta_bn: tarjetas.bn || 0,
      sinpe_json: JSON.stringify(sinpeRevisado || []),
      transferencias_json: JSON.stringify(transfRevisadas || []),
      salidas_json: JSON.stringify(salidEvaluadas || []),
      fecha_revision: new Date().toISOString(),
    };

    // Actualizar el cierre_caja marcándolo como revisado
    const { error: updateError } = await supabase
      .from('cierre_caja')
      .update({ revision_completada: true })
      .eq('id', cierre_id);

    if (updateError) {
      console.error('Error actualizando cierre:', updateError);
      return Response.json(
        { error: updateError.message },
        { status: 400 }
      );
    }

    // Intentar guardar en tabla de revisiones si existe
    try {
      const { error: insertError } = await supabase
        .from('revision_caja')
        .insert([revisaData]);

      if (insertError && !insertError.message.includes('relation')) {
        console.error('Error insertando revisión:', insertError);
      }
    } catch (err) {
      // Tabla no existe aún, solo actualizar cierre_caja
      console.log('Tabla revision_caja no existe, guardando en cierre_caja');
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('Server error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
