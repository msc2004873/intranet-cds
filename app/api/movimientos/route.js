import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get('tipo');
    const fecha = searchParams.get('fecha');
    const caja = searchParams.get('caja');

    let query = supabase.from('movimientos').select('*');

    if (tipo) {
      query = query.eq('tipo', tipo);
    }

    if (fecha) {
      // Filtrar por fecha usando el campo created_at
      const fechaInicio = `${fecha}T00:00:00`;
      const fechaFin = `${fecha}T23:59:59`;
      query = query.gte('created_at', fechaInicio).lte('created_at', fechaFin);
    }

    if (caja) {
      query = query.eq('caja', caja);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return Response.json(data || []);
  } catch (err) {
    console.error('Error movimientos:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();

    const tipo = formData.get('tipo');
    const monto = formData.get('monto');
    const moneda = formData.get('moneda') || 'colones';
    const referencia = formData.get('referencia');
    const cajera = formData.get('cajera');
    const caja = formData.get('caja');
    const archivo = formData.get('archivo');

    let archivoUrl = null;

    // Guardar archivo si existe
    if (archivo) {
      try {
        const buffer = await archivo.arrayBuffer();
        const sanitizedCaja = caja.replace(/[^a-zA-Z0-9-]/g, '_').toLowerCase();
        const fileName = `${tipo.toLowerCase()}_${Date.now()}_${archivo.name}`;
        const filePath = `${sanitizedCaja}/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('movimientos')
          .upload(filePath, buffer, {
            contentType: archivo.type,
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw uploadError;
        }

        const { data: urlData } = supabase.storage
          .from('movimientos')
          .getPublicUrl(filePath);

        archivoUrl = urlData?.publicUrl || null;
        console.log('Archivo guardado:', { filePath, archivoUrl });
      } catch (err) {
        console.error('Error guardando archivo:', err.message);
      }
    }

    const { data, error } = await supabase
      .from('movimientos')
      .insert([
        {
          tipo,
          monto: parseFloat(monto),
          moneda,
          referencia: referencia || null,
          cajera,
          caja,
          archivo_url: archivoUrl
        }
      ])
      .select();

    if (error) throw error;

    return Response.json(data[0], { status: 201 });
  } catch (err) {
    console.error('Error guardando movimiento:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
