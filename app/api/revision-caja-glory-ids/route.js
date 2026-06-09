import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  try {
    const { data, error } = await supabase
      .from('revision_glory')
      .select('fecha, cajera');

    if (error) throw error;

    return Response.json(data || []);
  } catch (error) {
    console.error('Error fetching revision_glory IDs:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
