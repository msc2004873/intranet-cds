import supabase from '../../../lib/supabase-server.js';

// Ingresos cobrados en cajas (cierre_caja), agrupados por los 6 períodos de 5 días del mes.
// Ingreso por cierre = efectivo (denominaciones_sobre) + tarjeta BAC + tarjeta BN
//                       + Σ sinpe_json.monto + dolares_total × tc
// NO se restan las salidas (es ingreso bruto) y NO se suma glory_json (solo cajas).

const DENOMS = [20000, 10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5];

function efectivoFromSobre(sobre) {
  if (!sobre || typeof sobre !== 'object') return 0;
  return DENOMS.reduce((sum, d) => sum + d * (parseInt(sobre[d]) || 0), 0);
}

function sumSinpe(arr) {
  if (!Array.isArray(arr)) return 0;
  return arr.reduce((sum, x) => sum + (parseFloat(x?.monto) || 0), 0);
}

function periodoDeDia(dia) {
  if (dia <= 5) return 1;
  if (dia <= 10) return 2;
  if (dia <= 15) return 3;
  if (dia <= 20) return 4;
  if (dia <= 25) return 5;
  return 6;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const ano = parseInt(searchParams.get('ano'));
    const mes = parseInt(searchParams.get('mes'));

    if (!ano || !mes || mes < 1 || mes > 12) {
      return Response.json({ error: 'Parámetros ano y mes son requeridos' }, { status: 400 });
    }

    // Ventana UTC que cubre todo el mes en hora CR (CR = UTC-6).
    // Día 1 00:00 CR = día 1 06:00 UTC; usamos buffer para no perder cierres en bordes.
    const pad = (n) => String(n).padStart(2, '0');
    const inicioUTC = `${ano}-${pad(mes)}-01T00:00:00Z`;
    const sigMes = mes === 12 ? 1 : mes + 1;
    const sigAno = mes === 12 ? ano + 1 : ano;
    const finUTC = `${sigAno}-${pad(sigMes)}-01T12:00:00Z`;

    const { data, error } = await supabase
      .from('cierre_caja')
      .select('fecha_hora, tc, dolares_total, tarjeta_bac, tarjeta_bn, sinpe_json, denominaciones_sobre')
      .gte('fecha_hora', inicioUTC)
      .lt('fecha_hora', finUTC);

    if (error) throw error;

    const ultimoDia = new Date(ano, mes, 0).getDate();
    const periodos = [1, 2, 3, 4, 5, 6].map((p) => {
      const dIni = (p - 1) * 5 + 1;
      const dFin = p === 6 ? ultimoDia : p * 5;
      return { periodo_num: p, dia_inicio: dIni, dia_fin: dFin, total: 0, cierres: 0 };
    });

    let totalMes = 0;

    for (const row of data || []) {
      // Fecha calendario CR = fecha_hora (UTC) − 6h
      const crMs = new Date(row.fecha_hora).getTime() - 6 * 60 * 60 * 1000;
      const cr = new Date(crMs);
      if (cr.getUTCFullYear() !== ano || cr.getUTCMonth() + 1 !== mes) continue;

      const ingreso =
        efectivoFromSobre(row.denominaciones_sobre) +
        (parseFloat(row.tarjeta_bac) || 0) +
        (parseFloat(row.tarjeta_bn) || 0) +
        sumSinpe(row.sinpe_json) +
        (parseFloat(row.dolares_total) || 0) * (parseFloat(row.tc) || 0);

      const p = periodoDeDia(cr.getUTCDate());
      const bucket = periodos[p - 1];
      bucket.total += ingreso;
      bucket.cierres += 1;
      totalMes += ingreso;
    }

    return Response.json({ ano, mes, totalMes, periodos });
  } catch (err) {
    console.error('Error en ingresos-periodo:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
