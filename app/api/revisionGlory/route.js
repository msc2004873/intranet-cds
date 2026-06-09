import supabase from '../../../lib/supabase-server.js';

export async function POST(request) {
  try {
    const data = await request.json();

    const { fecha, cajera, revisora, hora_revision, caja, denominaciones, bac, efectivo_revisado, total_revisado, total_cajera } = data;

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
      bac_revisado: bac || 0,
      efectivo_revisado: efectivo_revisado || 0,
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
    const cajera = searchParams.get('cajera');

    if (!fecha || !cajera) {
      return Response.json(
        { error: 'Falta fecha o cajera' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('revision_glory')
      .select('*')
      .eq('fecha', fecha)
      .eq('cajera', cajera)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      return Response.json(
        { id: null, fecha, cajera, total_revisado: 0, total_cajera: 0 },
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
