import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const cierre_id = searchParams.get('cierre_id');

    if (!cierre_id) {
      return new Response(
        JSON.stringify({ error: 'Missing cierre_id parameter' }),
        { status: 400 }
      );
    }

    // Fetch revision_caja by cierre_caja_id
    const { data, error } = await supabase
      .from('revision_caja')
      .select('*')
      .eq('cierre_caja_id', cierre_id)
      .single();

    if (error) {
      // If no revision exists yet, return empty object with default values
      if (error.code === 'PGRST116') {
        return new Response(
          JSON.stringify({
            id: null,
            cierre_caja_id: cierre_id,
            efectivo_revisado: 0,
            tarjeta_bac_revisado: 0,
            tarjeta_bn_revisado: 0,
            sinpe_revisado_json: [],
            depositos_revisados_json: [],
            salidas_revisadas_json: [],
          }),
          { status: 200 }
        );
      }
      throw error;
    }

    return new Response(JSON.stringify(data), { status: 200 });
  } catch (error) {
    console.error('Error fetching revision:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
}
