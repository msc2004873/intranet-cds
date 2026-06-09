import supabase from '../../../lib/supabase-server.js';

export async function POST(request) {
  try {
    const data = await request.json();

    const { cierre_id, revisora, caja_revisada, fecha_cierre_revisado, tc, denominaciones, tarjetas, dolares, sinpeRevisado, transfRevisadas, salidEvaluadas } = data;

    if (!cierre_id) {
      return Response.json(
        { error: 'cierre_id es requerido' },
        { status: 400 }
      );
    }

    if (!revisora || revisora === '') {
      return Response.json(
        { error: 'revisora es requerida' },
        { status: 400 }
      );
    }

    if (!caja_revisada || caja_revisada === '') {
      return Response.json(
        { error: 'caja_revisada es requerida' },
        { status: 400 }
      );
    }

    // Calcular totales
    const totalEnCaja = Object.entries(denominaciones).reduce((sum, [denom, cant]) => {
      return sum + (parseInt(denom) * cant);
    }, 0);

    const revisaData = {
      cierre_caja_id: cierre_id,
      revisora,
      caja_revisada,
      fecha_cierre_revisado,
      tc: tc || 475,
      revision_completada: true,
      efectivo_revisado: Object.entries(denominaciones).reduce((sum, [denom, cant]) => {
        return sum + (parseInt(denom) * cant);
      }, 0),
      tarjeta_bac_revisado: tarjetas.bac || 0,
      tarjeta_bn_revisado: tarjetas.bn || 0,
      sinpe_revisado_json: JSON.stringify(sinpeRevisado || []),
      depositos_revisados_json: JSON.stringify(transfRevisadas || []),
      salidas_revisadas_json: JSON.stringify(salidEvaluadas || []),
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
