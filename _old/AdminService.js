// ============================================================
// AdminService.gs — Lógica del panel de administración
// ============================================================

/**
 * Devuelve el resumen de 5 días para preparar el depósito bancario.
 * @param {string} startDate  Fecha inicio 'YYYY-MM-DD'
 * @param {string} endDate    Fecha fin 'YYYY-MM-DD' (inclusive)
 */
function getResumen5Dias(startDate, endDate) {
  requireRole([ROLES.ADMIN]);

  const start = new Date(startDate + 'T00:00:00');
  const end   = new Date(endDate   + 'T23:59:59');

  const rows = getAllRows(SHEETS.RESPUESTAS_CAJERAS).filter(r => {
    const fecha = new Date(r['Fecha Cierre'] + 'T12:00:00');
    return fecha >= start && fecha <= end;
  });

  const totales = rows.reduce((acc, r) => ({
    efectivo:   acc.efectivo   + (Number(r['Colones al Sobre'])  || 0),
    dolares:    acc.dolares    + (Number(r['Total Dólares ($)']) || 0),
    dolaresCol: acc.dolaresCol + (Number(r['Total Dólares (₡)'])|| 0),
    tarjetas:   acc.tarjetas   + (Number(r['Total Tarjetas'])    || 0),
    sinpe:      acc.sinpe      + (Number(r['Total SINPE'])       || 0),
    depositos:  acc.depositos  + (Number(r['Total Depósitos'])   || 0),
    salidas:    acc.salidas    + (Number(r['Total Salidas'])      || 0),
    glory:      acc.glory      + (Number(r['Total Glory'])       || 0),
  }), {
    efectivo: 0, dolares: 0, dolaresCol: 0,
    tarjetas: 0, sinpe: 0, depositos: 0, salidas: 0, glory: 0,
  });

  totales.totalGeneral = totales.efectivo + totales.dolaresCol +
                         totales.tarjetas + totales.sinpe - totales.salidas;

  return {
    periodo: { inicio: startDate, fin: endDate },
    dias: rows,
    totales,
  };
}

/**
 * Guarda el resumen de 5 días en la pestaña correspondiente.
 */
function saveResumen5Dias(startDate, endDate, observaciones) {
  requireRole([ROLES.ADMIN]);
  const resumen = getResumen5Dias(startDate, endDate);
  const t = resumen.totales;

  appendRowToSheet(SHEETS.RESUMEN_5_DIAS, [
    startDate,
    endDate,
    t.efectivo,
    t.tarjetas,
    t.sinpe,
    t.depositos,
    t.totalGeneral,
    observaciones || '',
  ]);

  return { success: true, resumen };
}

/**
 * Reporte mensual completo para el admin.
 */
function getReporteMensual(year, month) {
  requireRole([ROLES.ADMIN]);

  const cierres    = getCierresByMonth(year, month);
  const comparison = getMonthlyComparison(year, month);

  const totales = cierres.reduce((acc, r) => ({
    efectivo:  acc.efectivo  + (Number(r['Colones al Sobre'])  || 0),
    dolares:   acc.dolares   + (Number(r['Total Dólares ($)']) || 0),
    tarjetas:  acc.tarjetas  + (Number(r['Total Tarjetas'])    || 0),
    sinpe:     acc.sinpe     + (Number(r['Total SINPE'])       || 0),
    depositos: acc.depositos + (Number(r['Total Depósitos'])   || 0),
    salidas:   acc.salidas   + (Number(r['Total Salidas'])     || 0),
    glory:     acc.glory     + (Number(r['Total Glory'])       || 0),
  }), { efectivo: 0, dolares: 0, tarjetas: 0, sinpe: 0, depositos: 0, salidas: 0, glory: 0 });

  return {
    year, month,
    totalDias: cierres.length,
    totales,
    dias: comparison,
  };
}
