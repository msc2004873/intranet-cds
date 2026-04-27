import supabase from '../../../lib/supabase-server.js';

export async function POST(request) {
  try {
    const data = await request.json();

    const { data: result, error } = await supabase
      .from('respuestas_revisora')
      .insert([
        {
          revisora: data.revisora,
          caja_revisada: data.caja,
          fecha_cierre_revisado: new Date(data.fechaCierre).toISOString(),
          efectivo_contado: data.efectivoContado || 0,
          tarjeta_verificada: data.tarjetaVerificada || 0,
          sinpe_verificado: data.sinpeVerificado || 0,
          estado: data.estado || 'pendiente',
          observaciones: data.observaciones || null,
        },
      ])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json(
      { success: true, message: '✅ Revisión guardada exitosamente', data: result },
      { status: 200 }
    );
  } catch (err) {
    console.error('Server error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
