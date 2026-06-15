import supabase from '../../../lib/supabase-server.js';

export async function POST(request) {
  try {
    const data = await request.json();

    const { fecha, cajera, revisora, hora_revision, caja, denominaciones, datafono_glory, efectivo_revisado, sinpe_revisado, transferencias_revisadas, total_revisado, total_cajera } = data;

    if (!fecha || !cajera || !revisora) {
      return Response.json(
        { error: 'Falta información requerida' },
        { status: 400 }
      );
    }

    const revisionData = {
      fecha,
      cajera,
      revisora,
      hora_revision,
      caja,
      denominaciones_json: JSON.stringify(denominaciones || {}),
      datafono_glory: datafono_glory || 0,
      efectivo_revisado: efectivo_revisado || 0,
      sinpe_revisado: sinpe_revisado || 0,
      transferencias_revisadas: transferencias_revisadas || 0,
      total_revisado: total_revisado || 0,
      total_cajera: total_cajera || 0,
      estado: 'revisado',
    };

    // Guardar en tabla de revisiones glory
    const { error: insertError } = await supabase
      .from('revision_glory')
      .insert([revisionData]);

    if (insertError) {
      console.error('Error insertando revisión glory:', insertError);
      return Response.json(
        { error: insertError.message },
        { status: 400 }
      );
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('Server error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get('fecha');
    const mes = searchParams.get('mes'); // formato "2026-06"

    // Resumen del mes: devuelve todas las revisiones del mes
    if (mes) {
      const inicio = `${mes}-01`;
      const finDate = new Date(mes + '-01');
      finDate.setMonth(finDate.getMonth() + 1);
      finDate.setDate(0);
      const fin = finDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('revision_glory')
        .select('*')
        .gte('fecha', inicio)
        .lte('fecha', fin)
        .order('fecha', { ascending: true });

      if (error) throw error;
      return Response.json(data || [], { status: 200 });
    }

    if (!fecha) {
      return Response.json({ error: 'Falta fecha o mes' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('revision_glory')
      .select('*')
      .eq('fecha', fecha)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      return Response.json(
        { id: null, fecha, total_revisado: 0, total_cajera: 0 },
        { status: 200 }
      );
    }

    return Response.json(data, { status: 200 });
  } catch (error) {
    console.error('Error fetching revision:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
