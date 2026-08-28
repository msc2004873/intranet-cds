import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const inicio = searchParams.get('inicio');
    const fin = searchParams.get('fin');

    if (!inicio || !fin) {
      return Response.json(
        { error: 'Missing inicio and fin parameters' },
        { status: 400 }
      );
    }

    // CRITICAL: Filter by CLOSURE DATE (fecha_hora) in COSTA RICA timezone, not UTC
    // A day in CR (2026-06-05 00:00 CR) spans from 06:00 UTC that day to 05:59 UTC next day
    // MUST use UTC explicitly (Z suffix) to avoid timezone ambiguity

    // Inicio del día en CR = 06:00 UTC (CR es UTC-6).
    //
    // Antes esto era T00:00:00Z "para capturar cierres nocturnos", pero 00:00 UTC del
    // día `inicio` son las 18:00 CR del día ANTERIOR: el cierre de la tarde del último
    // día del período pasado se colaba en este. El cierre del 5/8 a las 18:48 CR
    // (= 06/08 00:48 UTC) aparecía dentro del período 6-10 y también dentro del 1-5.
    //
    // No hace falta ese margen: un cierre de las 18:54 CR del día D es 00:54 UTC del
    // día D+1, y eso ya cae dentro de [D 06:00Z, D+1 05:59Z].
    const crDayStart = new Date(`${inicio}T06:00:00Z`).toISOString();

    // End of day in CR = 05:59:59 UTC next day
    const finDate = new Date(`${fin}T05:59:59Z`);
    finDate.setUTCDate(finDate.getUTCDate() + 1);
    const crDayEnd = finDate.toISOString();

    // Get ALL audit rows with related closure info
    const { data, error } = await supabase
      .from('revision_auditoria')
      .select(`
        *,
        revision_caja!inner (
          id,
          cierre_caja_id,
          qvet_data,
          tc,
          dolares_revisado,
          cierre_caja!inner (
            id,
            fecha_hora,
            caja,
            tc,
            dolares_total
          )
        )
      `);

    if (error) throw error;

    // Filter by closure date in client (Supabase doesn't support nested filters well)
    const filtered = data.filter(row => {
      const fechaCierre = new Date(row.revision_caja?.cierre_caja?.fecha_hora);
      return fechaCierre >= new Date(crDayStart) && fechaCierre <= new Date(crDayEnd);
    });

    // Sort by closure date
    filtered.sort((a, b) => {
      const fechaA = new Date(a.revision_caja?.cierre_caja?.fecha_hora);
      const fechaB = new Date(b.revision_caja?.cierre_caja?.fecha_hora);
      return fechaA - fechaB;
    });

    return Response.json(filtered || []);
  } catch (error) {
    console.error('Error fetching audit rows by period:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
