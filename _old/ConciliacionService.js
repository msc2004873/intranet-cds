// ============================================================
// ConciliacionService.gs — Conciliación final de los 3 cierres
//
// Fuentes:
//   1. cierre de la cajera   → pestaña Cierre_Cajera
//   2. cierre de la revisora → pestaña Cierre_Revisora
//   3. cierre de QVet        → pestaña Cierre_QVet
//
// Salida:
//   → pestaña Conciliacion_Final
//
// Regla fundamental:
//   Nunca sobreescribir datos originales.
//   Solo comparar y registrar.
// ============================================================

const TOLERANCE_CRC = 500; // diferencia aceptable en colones para CUADRA_CON_AJUSTE

const ESTADOS = {
  CUADRA_TOTAL:       'CUADRA_TOTAL',
  CUADRA_CON_AJUSTE:  'CUADRA_CON_AJUSTE',
  NO_CUADRA:          'NO_CUADRA',
  PENDIENTE_QVET:     'PENDIENTE_QVET',
  CERRADO_APROBADO:   'CERRADO_APROBADO',
};

// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================

/**
 * Ejecuta la conciliación para una fecha y caja dados.
 * Busca los 3 cierres y genera (o actualiza) la fila en Conciliacion_Final.
 *
 * @param {string} fechaCierre  'YYYY-MM-DD'
 * @param {string} caja         'Caja 1 (Clínica)' | 'Caja 2'
 * @returns {Object} resultado de la conciliación
 */
function runConciliacion(fechaCierre, caja) {
  const cajera   = getCierreCajera(fechaCierre, caja);
  const revisora = getCierreRevisora(fechaCierre, caja);
  const qvet     = getCierreQVet(fechaCierre, caja);

  // Necesitamos al menos cajera + revisora para conciliar
  if (!cajera)   throw new Error('No hay cierre de cajera para ' + fechaCierre + ' / ' + caja);
  if (!revisora) throw new Error('No hay cierre de revisora para ' + fechaCierre + ' / ' + caja);

  // Extraer valores comparables de cada fuente
  const c = normalizarCajera(cajera);
  const r = normalizarRevisora(revisora);
  const q = qvet ? normalizarQVet(qvet) : null;

  // Calcular diferencias
  const difs = calcularDiferencias(c, r, q);

  // Determinar estado
  const estado = determinarEstado(difs, q);

  const conciliacion = {
    fechaCierre,
    caja,
    // Valores por fuente
    cajera_efectivo:       c.efectivo,
    revisora_efectivo:     r.efectivo,
    qvet_efectivo:         q ? q.efectivo        : null,
    cajera_tarjetas:       c.tarjetas,
    revisora_tarjetas:     r.tarjetas,
    qvet_tarjetas:         q ? q.tarjetas        : null,
    cajera_sinpe:          c.sinpe,
    revisora_sinpe:        r.sinpe,
    qvet_sinpe:            q ? q.sinpe           : null,
    cajera_total:          c.total,
    revisora_total:        r.total,
    qvet_total:            q ? q.total_general   : null,
    // Diferencias
    ...difs,
    // Estado y gestión
    estado,
    observaciones:        '',
    motivo_diferencia:    '',
    accion_tomada:        '',
    responsable:          '',
    aprobado:             false,
    fecha_cierre_final:   null,
    fecha_generado:       new Date(),
  };

  appendRowToSheet(SHEETS.CONCILIACION_FINAL, buildConciliacionRow(conciliacion));

  return conciliacion;
}

// ============================================================
// NORMALIZACIÓN — extraer campos comparables de cada fuente
// ============================================================

function normalizarCajera(row) {
  return {
    efectivo: Number(row['EFECTIVO_SOBRE']) || 0,
    tarjetas: Number(row['TOTAL_TARJETAS']) || 0,
    sinpe:    Number(row['TOTAL_SINPE'])    || 0,
    total:    (Number(row['EFECTIVO_SOBRE']) || 0)
            + (Number(row['TOTAL_TARJETAS']) || 0)
            + (Number(row['TOTAL_SINPE'])    || 0),
  };
}

function normalizarRevisora(row) {
  return {
    efectivo: Number(row['EFECTIVO_CONTADO'])   || 0,
    tarjetas: Number(row['TARJETA_VERIFICADA']) || 0,
    sinpe:    Number(row['SINPE_VERIFICADO'])   || 0,
    total:    (Number(row['EFECTIVO_CONTADO'])   || 0)
            + (Number(row['TARJETA_VERIFICADA']) || 0)
            + (Number(row['SINPE_VERIFICADO'])   || 0),
  };
}

function normalizarQVet(row) {
  return {
    efectivo:      Number(row['EFECTIVO'])      || 0,
    tarjetas:      Number(row['TARJETAS'])      || 0,
    sinpe:         Number(row['SINPE'])         || 0,
    transferencias:Number(row['TRANSFERENCIAS'])|| 0,
    total_general: Number(row['TOTAL_GENERAL']) || null,
  };
}

// ============================================================
// DIFERENCIAS
// ============================================================

function calcularDiferencias(c, r, q) {
  const difs = {
    dif_cajera_revisora_ef:    c.efectivo - r.efectivo,
    dif_cajera_revisora_tar:   c.tarjetas - r.tarjetas,
    dif_cajera_revisora_sinpe: c.sinpe    - r.sinpe,
    dif_cajera_revisora_total: c.total    - r.total,
  };

  if (q) {
    difs.dif_revisora_qvet_ef    = r.efectivo - q.efectivo;
    difs.dif_revisora_qvet_tar   = r.tarjetas - q.tarjetas;
    difs.dif_revisora_qvet_sinpe = r.sinpe    - q.sinpe;
    difs.dif_cajera_qvet_ef      = c.efectivo - q.efectivo;
    difs.dif_cajera_qvet_tar     = c.tarjetas - q.tarjetas;
    difs.dif_cajera_qvet_sinpe   = c.sinpe    - q.sinpe;
  } else {
    difs.dif_revisora_qvet_ef    = null;
    difs.dif_revisora_qvet_tar   = null;
    difs.dif_revisora_qvet_sinpe = null;
    difs.dif_cajera_qvet_ef      = null;
    difs.dif_cajera_qvet_tar     = null;
    difs.dif_cajera_qvet_sinpe   = null;
  }

  return difs;
}

// ============================================================
// ESTADO
// ============================================================

function determinarEstado(difs, q) {
  if (!q) return ESTADOS.PENDIENTE_QVET;

  const difsCajeraRevisora = [
    Math.abs(difs.dif_cajera_revisora_ef),
    Math.abs(difs.dif_cajera_revisora_tar),
    Math.abs(difs.dif_cajera_revisora_sinpe),
  ];

  const difsConQVet = [
    Math.abs(difs.dif_revisora_qvet_ef),
    Math.abs(difs.dif_revisora_qvet_tar),
    Math.abs(difs.dif_revisora_qvet_sinpe),
    Math.abs(difs.dif_cajera_qvet_ef),
    Math.abs(difs.dif_cajera_qvet_tar),
    Math.abs(difs.dif_cajera_qvet_sinpe),
  ];

  const todasLasDifs = [...difsCajeraRevisora, ...difsConQVet];
  const maxDif = Math.max(...todasLasDifs);

  if (maxDif === 0)                   return ESTADOS.CUADRA_TOTAL;
  if (maxDif <= TOLERANCE_CRC)        return ESTADOS.CUADRA_CON_AJUSTE;
  return ESTADOS.NO_CUADRA;
}

// ============================================================
// LOOKUP — buscar filas en las pestañas
// ============================================================

function getCierreCajera(fechaCierre, caja) {
  return findLastRow(SHEETS.RESPUESTAS_CAJERAS, 'FECHA_CIERRE', fechaCierre, 'CAJA', caja);
}

function getCierreRevisora(fechaCierre, caja) {
  return findLastRow(SHEETS.RESPUESTAS_REVISORA, 'FECHA_CIERRE_REVISADO', fechaCierre, 'CAJA_REVISADA', caja);
}

function getCierreQVet(fechaCierre, caja) {
  return findLastRow(SHEETS.CIERRE_QVET, 'FECHA_CIERRE', fechaCierre, 'CAJA', caja);
}

/**
 * Busca la última fila que coincida con dos filtros de columna.
 * @returns {Object|null} fila como objeto {header: value} o null
 */
function findLastRow(sheetName, col1, val1, col2, val2) {
  try {
    const sheet = getSheet(sheetName);
    if (sheet.getLastRow() < 2) return null;
    const data    = sheet.getDataRange().getValues();
    const headers = data[0];
    const idx1    = headers.indexOf(col1);
    const idx2    = headers.indexOf(col2);
    if (idx1 < 0 || idx2 < 0) return null;

    let lastMatch = null;
    for (let i = 1; i < data.length; i++) {
      const v1 = String(data[i][idx1]).trim();
      const v2 = String(data[i][idx2]).trim();
      if (v1 === String(val1).trim() && v2 === String(val2).trim()) {
        lastMatch = data[i];
      }
    }
    if (!lastMatch) return null;

    const obj = {};
    headers.forEach((h, i) => { obj[h] = lastMatch[i]; });
    return obj;

  } catch (err) {
    Logger.log('findLastRow error: ' + err.message);
    return null;
  }
}

// ============================================================
// BUILDER DE FILA
// ============================================================

function buildConciliacionRow(c) {
  return [
    c.fechaCierre,
    c.caja,
    // Efectivo
    c.cajera_efectivo,
    c.revisora_efectivo,
    c.qvet_efectivo,
    c.dif_cajera_revisora_ef,
    c.dif_revisora_qvet_ef,
    c.dif_cajera_qvet_ef,
    // Tarjetas
    c.cajera_tarjetas,
    c.revisora_tarjetas,
    c.qvet_tarjetas,
    c.dif_cajera_revisora_tar,
    c.dif_revisora_qvet_tar,
    c.dif_cajera_qvet_tar,
    // SINPE
    c.cajera_sinpe,
    c.revisora_sinpe,
    c.qvet_sinpe,
    c.dif_cajera_revisora_sinpe,
    c.dif_revisora_qvet_sinpe,
    c.dif_cajera_qvet_sinpe,
    // Totales
    c.cajera_total,
    c.revisora_total,
    c.qvet_total,
    c.dif_cajera_revisora_total,
    // Estado y gestión
    c.estado,
    c.observaciones,
    c.motivo_diferencia,
    c.accion_tomada,
    c.responsable,
    c.aprobado,
    c.fecha_cierre_final,
    c.fecha_generado,
  ];
}

// ============================================================
// HELPERS — Búsquedas por fecha/mes
// ============================================================

/**
 * Devuelve todos los cierres de la cajera de un mes dado.
 * @param {number} year   (ej: 2024)
 * @param {number} month  1-based (ej: 1 = enero)
 */
function getCierresByMonth(year, month) {
  try {
    const sheet = getSheet(SHEETS.RESPUESTAS_CAJERAS);
    if (sheet.getLastRow() < 2) return [];

    const data    = sheet.getDataRange().getValues();
    const headers = data[0];

    return data.slice(1)
      .filter(row => {
        const fechaStr = row[headers.indexOf('FECHA_CIERRE')];
        if (!fechaStr) return false;
        const d = new Date(fechaStr + 'T12:00:00');
        return d.getFullYear() === year && (d.getMonth() + 1) === month;
      })
      .map(row => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = row[i]; });
        return obj;
      });
  } catch (err) {
    Logger.log('getCierresByMonth error: ' + err.message);
    return [];
  }
}

/**
 * Devuelve el cierre de una fecha y caja específicas.
 * @param {string} fechaCierre  'YYYY-MM-DD'
 * @param {string} caja         'Caja 1' o similar
 */
function getCierreByDateAndCaja(fechaCierre, caja) {
  try {
    const sheet = getSheet(SHEETS.RESPUESTAS_CAJERAS);
    if (sheet.getLastRow() < 2) return null;

    const data    = sheet.getDataRange().getValues();
    const headers = data[0];
    const idxFecha = headers.indexOf('FECHA_CIERRE');
    const idxCaja  = headers.indexOf('CAJA');

    if (idxFecha < 0 || idxCaja < 0) return null;

    for (let i = 1; i < data.length; i++) {
      const fila = data[i];
      if (String(fila[idxFecha]).trim() === String(fechaCierre).trim() &&
          String(fila[idxCaja]).trim()  === String(caja).trim()) {
        const obj = {};
        headers.forEach((h, j) => { obj[h] = fila[j]; });
        return obj;
      }
    }
    return null;
  } catch (err) {
    Logger.log('getCierreByDateAndCaja error: ' + err.message);
    return null;
  }
}
