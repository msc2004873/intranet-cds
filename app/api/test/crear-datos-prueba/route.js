import supabase from '../../../../lib/supabase-server.js';

export async function POST(request) {
  try {
    const hoy = new Date();
    const ano = hoy.getFullYear();
    const mes = hoy.getMonth();

    // Crear datos para días 1-5 (período 1)
    const registros = [];

    for (let dia = 1; dia <= 5; dia++) {
      const fecha = new Date(ano, mes, dia);
      const fechaHora = new Date(fecha);
      fechaHora.setHours(14 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60), 0);

      // Datos SINPE
      const sinpes = [
        {
          referencia: `SINPE-${dia}-001`,
          monto: 25000 + Math.random() * 10000,
          archivo_url: 'https://via.placeholder.com/200x150?text=SINPE+Comprobante',
        },
        {
          referencia: `SINPE-${dia}-002`,
          monto: 15000 + Math.random() * 8000,
          archivo_url: 'https://via.placeholder.com/200x150?text=SINPE+Comprobante2',
        },
      ];

      // Datos Transferencias
      const transferencias = [
        {
          descripcion: `Transferencia día ${dia}`,
          monto: 50000,
          archivo_url: 'https://via.placeholder.com/200x150?text=Transferencia',
        },
      ];

      // Datos Salidas
      const salidas = [
        {
          descripcion: `Salida gastos operativos día ${dia}`,
          monto: 10000,
          archivo_url: 'https://via.placeholder.com/200x150?text=Salida',
        },
        {
          descripcion: `Salida supplies día ${dia}`,
          monto: 5000,
          archivo_url: null,
        },
      ];

      const cierre = {
        cajera: `Cajera ${dia}`,
        caja: 'Caja 1 (clínica)',
        fecha_hora: fechaHora.toISOString(),
        tc: 475,
        dolares_total: 50 + Math.random() * 50,
        tarjeta_bac: 100000 + Math.random() * 50000,
        tarjeta_bn: 80000 + Math.random() * 40000,
        c_20000: 2 + Math.floor(Math.random() * 3),
        c_10000: 1 + Math.floor(Math.random() * 2),
        c_5000: 2 + Math.floor(Math.random() * 3),
        c_2000: 3 + Math.floor(Math.random() * 4),
        c_1000: 5 + Math.floor(Math.random() * 5),
        c_500: 4 + Math.floor(Math.random() * 4),
        c_100: 10 + Math.floor(Math.random() * 10),
        c_50: 8 + Math.floor(Math.random() * 8),
        c_25: 6 + Math.floor(Math.random() * 6),
        c_10: 5 + Math.floor(Math.random() * 5),
        c_5: 3 + Math.floor(Math.random() * 3),
        sinpe_json: JSON.stringify(sinpes),
        depositos_json: JSON.stringify(transferencias),
        salidas_json: JSON.stringify(salidas),
        glory_json: JSON.stringify([]),
      };

      registros.push(cierre);
    }

    // Insertar todos los registros
    const { error } = await supabase
      .from('cierre_caja')
      .insert(registros);

    if (error) {
      console.error('Error insertando datos de prueba:', error);
      return Response.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      message: `${registros.length} cierres de prueba creados para el período actual`,
      registros: registros.length,
    }, { status: 201 });
  } catch (err) {
    console.error('Server error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
