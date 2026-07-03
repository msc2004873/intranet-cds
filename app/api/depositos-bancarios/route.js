import supabase from '../../../lib/supabase-server.js';

// Bancos permitidos (whitelist server-side). Por ahora solo BAC.
const BANCOS = ['BAC'];

// GET — lista de depósitos con sus períodos (para estados En progreso / Depositado e historial)
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('depositos_bancarios')
      .select('*, depositos_cds(id, periodo_inicio, periodo_fin, total_colones, total_usd, contado_por)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return Response.json(data || []);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST — registrar conteo / unificar períodos → depósito "en_progreso"
export async function POST(req) {
  try {
    const { periodo_ids, total_contado_colones, total_contado_usd, contado_por, fecha_conteo } = await req.json();

    // --- Validaciones server-side ---
    if (!Array.isArray(periodo_ids) || periodo_ids.length === 0) {
      return Response.json({ error: 'Selecciona al menos un período' }, { status: 400 });
    }
    const ids = periodo_ids.map(n => parseInt(n, 10)).filter(n => Number.isInteger(n));
    if (ids.length !== periodo_ids.length) {
      return Response.json({ error: 'periodo_ids inválidos' }, { status: 400 });
    }

    const contadoCRC = Number(total_contado_colones) || 0;
    const contadoUSD = Number(total_contado_usd) || 0;
    if (contadoCRC < 0 || contadoUSD < 0) {
      return Response.json({ error: 'El conteo no puede ser negativo' }, { status: 400 });
    }
    if (contadoCRC === 0 && contadoUSD === 0) {
      return Response.json({ error: 'El conteo no puede ser 0' }, { status: 400 });
    }

    // Cargar y validar los períodos
    const { data: periodos, error: pErr } = await supabase
      .from('depositos_cds')
      .select('id, total_colones, total_usd, deposito_bancario_id')
      .in('id', ids);
    if (pErr) throw pErr;
    if (!periodos || periodos.length !== ids.length) {
      return Response.json({ error: 'Uno o más períodos no existen' }, { status: 400 });
    }
    if (periodos.some(p => p.deposito_bancario_id != null)) {
      return Response.json({ error: 'Un período ya está en un depósito' }, { status: 409 });
    }

    // Recalcular la referencia (snapshot) server-side — no confiar en el cliente
    const refCRC = periodos.reduce((s, p) => s + (Number(p.total_colones) || 0), 0);
    const refUSD = periodos.reduce((s, p) => s + (Number(p.total_usd) || 0), 0);

    // 1) Crear el depósito padre
    const { data: deposito, error: dErr } = await supabase
      .from('depositos_bancarios')
      .insert({
        estado: 'en_progreso',
        total_contado_colones: contadoCRC,
        total_contado_usd: contadoUSD,
        total_referencia_colones: refCRC,
        total_referencia_usd: refUSD,
        contado_por: contado_por || null,
        fecha_conteo: fecha_conteo || null,
      })
      .select()
      .single();
    if (dErr) throw dErr;

    // 2) Ligar los períodos (candado optimista: solo los que siguen NULL)
    const { data: linked, error: lErr } = await supabase
      .from('depositos_cds')
      .update({ deposito_bancario_id: deposito.id, updated_at: new Date().toISOString() })
      .in('id', ids)
      .is('deposito_bancario_id', null)
      .select('id');
    if (lErr) throw lErr;

    // 3) Si no se ligaron todos (carrera), compensar: borrar el padre libera lo ligado (ON DELETE SET NULL)
    if (!linked || linked.length !== ids.length) {
      await supabase.from('depositos_bancarios').delete().eq('id', deposito.id);
      return Response.json({ error: 'Un período fue tomado por otro depósito, intentá de nuevo' }, { status: 409 });
    }

    return Response.json(deposito, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// PATCH — completar depósito (banco + boleta + foto) → "completado"
export async function PATCH(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get('id'), 10);
    if (!Number.isInteger(id)) {
      return Response.json({ error: 'id inválido' }, { status: 400 });
    }

    const formData = await req.formData();
    const banco = formData.get('banco');
    const referencia = (formData.get('referencia') || '').toString().trim();
    const fecha_deposito = formData.get('fecha_deposito');
    const completado_por = formData.get('completado_por');
    const comprobante = formData.get('comprobante');

    if (!BANCOS.includes(banco)) {
      return Response.json({ error: 'Banco inválido' }, { status: 400 });
    }
    if (!referencia) {
      return Response.json({ error: 'Falta el número de boleta / referencia' }, { status: 400 });
    }
    if (!fecha_deposito || !/^\d{4}-\d{2}-\d{2}$/.test(fecha_deposito)) {
      return Response.json({ error: 'Fecha de depósito inválida' }, { status: 400 });
    }

    // El depósito debe existir y estar en progreso
    const { data: dep, error: getErr } = await supabase
      .from('depositos_bancarios')
      .select('id, estado')
      .eq('id', id)
      .maybeSingle();
    if (getErr) throw getErr;
    if (!dep) return Response.json({ error: 'Depósito no existe' }, { status: 404 });
    if (dep.estado === 'completado') {
      return Response.json({ error: 'El depósito ya está completado' }, { status: 409 });
    }

    // Subir comprobante (opcional)
    let comprobanteUrl = null;
    if (comprobante && typeof comprobante === 'object' && comprobante.name) {
      const buffer = await comprobante.arrayBuffer();
      const safeName = comprobante.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `deposito_${id}_${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from('depositos')
        .upload(filePath, buffer, { contentType: comprobante.type, upsert: false });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('depositos').getPublicUrl(filePath);
      comprobanteUrl = urlData?.publicUrl || null;
    }

    const updateData = {
      estado: 'completado',
      banco,
      referencia,
      fecha_deposito,
      completado_por: completado_por || null,
      updated_at: new Date().toISOString(),
    };
    if (comprobanteUrl) updateData.comprobante_url = comprobanteUrl;

    const { data, error } = await supabase
      .from('depositos_bancarios')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — deshacer depósito. ON DELETE SET NULL libera los períodos a "pendiente".
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get('id'), 10);
    if (!Number.isInteger(id)) {
      return Response.json({ error: 'id inválido' }, { status: 400 });
    }

    // Best-effort: borrar el archivo del comprobante del bucket
    const { data: dep } = await supabase
      .from('depositos_bancarios')
      .select('comprobante_url')
      .eq('id', id)
      .maybeSingle();
    if (dep?.comprobante_url) {
      const marker = '/depositos/';
      const idx = dep.comprobante_url.indexOf(marker);
      if (idx !== -1) {
        const path = dep.comprobante_url.slice(idx + marker.length);
        await supabase.storage.from('depositos').remove([path]);
      }
    }

    const { error } = await supabase.from('depositos_bancarios').delete().eq('id', id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
