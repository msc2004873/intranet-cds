// ============================================================
// RevisoraService.gs — Lógica de la revisora
// ============================================================

/**
 * Guarda el formulario de revisión.
 * @param {Object} formData { fechaCierreRevisado, caja, efectivoContado,
 *                            tarjetaVerificada, sinpeVerificado, observaciones }
 */
function saveRevision(formData) {
  try {
    requireRole([ROLES.REVISORA, ROLES.ADMIN]);

    const row = [
      new Date(),
      Session.getActiveUser().getEmail(),
      formData.fechaCierreRevisado,
      formData.caja,
      formData.efectivoContado    || 0,
      formData.tarjetaVerificada  || 0,
      formData.sinpeVerificado    || 0,
      formData.observaciones      || '',
    ];

    appendRowToSheet(SHEETS.RESPUESTAS_REVISORA, row);

    return { success: true, message: 'Revisión guardada correctamente.' };

  } catch (err) {
    Logger.log('saveRevision error: ' + err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Devuelve la comparación mensual para la vista de la revisora.
 * Cruza Respuestas Cajeras vs Respuestas Revisora.
 *
 * @param {number} year
 * @param {number} month  1-based
 * @returns {Array} Una fila por cada día/caja del mes
 */
function getMonthlyComparison(year, month) {
  requireRole([ROLES.REVISORA, ROLES.ADMIN]);

  const cierres   = getCierresByMonth(year, month);
  const revisiones = getAllRows(SHEETS.RESPUESTAS_REVISORA).filter(r => {
    const fecha = new Date(r['Fecha Cierre Revisado'] + 'T12:00:00');
    return fecha.getFullYear() === year && (fecha.getMonth() + 1) === month;
  });

  // Indexar revisiones por "fecha|caja"
  const revIdx = {};
  revisiones.forEach(r => {
    const key = `${r['Fecha Cierre Revisado']}|${r['Caja']}`;
    revIdx[key] = r;  // si hay varias, queda la última
  });

  // Unir cierres con revisiones
  return cierres.map(c => {
    const key = `${c['Fecha Cierre']}|${c['Caja']}`;
    const rev = revIdx[key] || null;

    const cajEfectivo  = Number(c['Colones al Sobre'])          || 0;
    const cajTarjetas  = Number(c['Total Tarjetas'])             || 0;
    const cajSinpe     = Number(c['Total SINPE'])                || 0;

    const revEfectivo  = rev ? (Number(rev['Efectivo Contado (₡)'])    || 0) : null;
    const revTarjetas  = rev ? (Number(rev['Tarjeta Verificada (₡)'])  || 0) : null;
    const revSinpe     = rev ? (Number(rev['SINPE Verificado (₡)'])    || 0) : null;

    return {
      fecha:          c['Fecha Cierre'],
      caja:           c['Caja'],
      cajera:         c['Cajera'],
      // Cajera
      cajEfectivo,
      cajTarjetas,
      cajSinpe,
      cajTotal:       cajEfectivo + cajTarjetas + cajSinpe,
      // Revisora
      revEfectivo,
      revTarjetas,
      revSinpe,
      revTotal:       rev ? ((revEfectivo + revTarjetas + revSinpe) || 0) : null,
      revisado:       !!rev,
      observaciones:  rev ? rev['Observaciones'] : '',
      // Diferencias
      diffEfectivo: revEfectivo !== null ? (revEfectivo - cajEfectivo) : null,
      diffTarjetas: revTarjetas !== null ? (revTarjetas - cajTarjetas) : null,
      diffSinpe:    revSinpe    !== null ? (revSinpe    - cajSinpe)    : null,
    };
  });
}

/**
 * Detalle completo de un cierre para que la revisora lo vea.
 */
function getDetalleCierre(fechaCierre, caja) {
  requireRole([ROLES.REVISORA, ROLES.ADMIN]);
  return getCierreByDateAndCaja(fechaCierre, caja);
}
