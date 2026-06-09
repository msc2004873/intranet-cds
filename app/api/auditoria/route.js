import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  try {
    const { revision_caja_id, audit_rows, qvet_data, qvet_archivo_url } = await req.json();

    if (!revision_caja_id || !audit_rows || !Array.isArray(audit_rows)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: revision_caja_id, audit_rows' }),
        { status: 400 }
      );
    }

    // 1. Actualizar revision_caja con QVet data
    const { error: updateError } = await supabase
      .from('revision_caja')
      .update({
        qvet_data: qvet_data,
        qvet_archivo_url: qvet_archivo_url,
        estado_auditoria: 'EN_REVISION',
      })
      .eq('id', revision_caja_id);

    if (updateError) throw updateError;

    // 2. Insertar filas de auditoría
    const { error: insertError } = await supabase
      .from('revision_auditoria')
      .insert(audit_rows);

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Audit saved successfully',
        rows_created: audit_rows.length,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error saving audit:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const revision_caja_id = searchParams.get('revision_caja_id');

    if (!revision_caja_id) {
      return new Response(
        JSON.stringify({ error: 'Missing revision_caja_id parameter' }),
        { status: 400 }
      );
    }

    // Fetch audit rows for a specific revision
    const { data, error } = await supabase
      .from('revision_auditoria')
      .select('*')
      .eq('revision_caja_id', revision_caja_id)
      .order('tipo_movimiento', { ascending: true });

    if (error) throw error;

    return new Response(JSON.stringify(data), { status: 200 });
  } catch (error) {
    console.error('Error fetching audit:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  try {
    const { id, comentario_auditoria, archivo_url_comprobante } = await req.json();

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Missing audit row id' }),
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('revision_auditoria')
      .update({
        comentario_auditoria,
        archivo_url_comprobante,
      })
      .eq('id', id);

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating audit:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}
