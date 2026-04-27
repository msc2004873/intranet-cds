// ============================================================
// SheetsService.gs — Operaciones sobre Google Sheets
// ============================================================

/**
 * Devuelve la hoja de cálculo principal.
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/**
 * Devuelve una pestaña por nombre; lanza error si no existe.
 */
function getSheet(name) {
  const ss    = getSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Pestaña no encontrada: ' + name);
  return sheet;
}

// ============================================================
// SETUP DE PESTAÑAS
// ============================================================

function setupSheets() {
  const ss = getSpreadsheet();
  createSheetIfMissing(ss, SHEETS.CONFIG,              getConfigHeaders());
  createSheetIfMissing(ss, SHEETS.RESPUESTAS_CAJERAS,  getCajeraHeaders());
  createSheetIfMissing(ss, SHEETS.RESPUESTAS_REVISORA, getRevisoraHeaders());
  createSheetIfMissing(ss, SHEETS.CIERRE_QVET,         getCierreQVetHeaders());
  createSheetIfMissing(ss, SHEETS.QVET_LISTADO,        getQVetListadoHeaders());
  createSheetIfMissing(ss, SHEETS.CONCILIACION_FINAL,  getConciliacionHeaders());
  createSheetIfMissing(ss, SHEETS.VISTA_REVISORA,      getVistaRevisoraHeaders());
  createSheetIfMissing(ss, SHEETS.RESUMEN_5_DIAS,      getResumen5DiasHeaders());

  // Agrega un admin inicial si Config está vacío
  const configSheet = ss.getSheetByName(SHEETS.CONFIG);
  if (configSheet.getLastRow() <= 1) {
    configSheet.appendRow([
      Session.getActiveUser().getEmail(),
      'Administrador',
      ROLES.ADMIN,
      true,
    ]);
  }

  Logger.log('Pestañas creadas/verificadas correctamente.');
}

function createSheetIfMissing(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    // Formato visual del encabezado
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#1a73e8')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    Logger.log('Creada pestaña: ' + name);
  }
  return sheet;
}

// ============================================================
// ENCABEZADOS
// ============================================================

function getConfigHeaders() {
  return ['Email', 'Nombre', 'Rol', 'Activo'];
}

function getCajeraHeaders() {
  return [
    'FECHA/HORA', 'CAJERA', 'CAJA', 'TC', 'FECHA_CIERRE',
    // Cierre de caja — cantidades
    '₡20000', '₡10000', '₡5000', '₡2000', '₡1000', '₡500', '₡100', '₡50', '₡25', '₡10', '₡5',
    // Queda en caja — cantidades
    'QUEDA_₡20000', 'QUEDA_₡10000', 'QUEDA_₡5000', 'QUEDA_₡2000', 'QUEDA_₡1000',
    'QUEDA_₡500', 'QUEDA_₡100', 'QUEDA_₡50', 'QUEDA_₡25', 'QUEDA_₡10', 'QUEDA_₡5',
    // Totales calculados (usados por la conciliación)
    'EFECTIVO_SOBRE', 'DOLARES_TOTAL', 'TARJETA_BAC', 'TARJETA_BN', 'TOTAL_TARJETAS',
    'TOTAL_SINPE', 'TOTAL_DEPOSITOS', 'TOTAL_SALIDAS', 'TOTAL_GLORY',
    // Datos estructurados
    'SINPE_JSON', 'DEPOSITOS_JSON', 'SALIDAS_JSON', 'GLORY_JSON',
    // Archivos y notas
    'QVET_PDF_URL', 'FOTOS_SINPE_URLS', 'COMENTARIOS',
  ];
}

function getCierreQVetHeaders() {
  return [
    'FECHA/HORA', 'FECHA_CIERRE', 'CAJA',
    'EFECTIVO', 'TARJETAS', 'SINPE', 'TRANSFERENCIAS', 'TOTAL_GENERAL',
    'CONFIDENCE_SCORE', 'ERRORES_JSON', 'PDF_URL',
  ];
}

function getQVetListadoHeaders() {
  return [
    'FECHA', 'CAJA', 'PERSONAL', 'FORMA_PAGO',
    'VENTA', 'TOTAL_CIERRE', 'CIERRE_ANTERIOR', 'COBRADO', 'COBROS_DEL_DIA',
    'DATOS_COMPLETOS_JSON',
  ];
}

function getConciliacionHeaders() {
  return [
    'FECHA_CIERRE', 'CAJA',
    // Efectivo
    'CAJERA_EFECTIVO', 'REVISORA_EFECTIVO', 'QVET_EFECTIVO',
    'DIF_CAJERA_REVISORA_EF', 'DIF_REVISORA_QVET_EF', 'DIF_CAJERA_QVET_EF',
    // Tarjetas
    'CAJERA_TARJETAS', 'REVISORA_TARJETAS', 'QVET_TARJETAS',
    'DIF_CAJERA_REVISORA_TAR', 'DIF_REVISORA_QVET_TAR', 'DIF_CAJERA_QVET_TAR',
    // SINPE
    'CAJERA_SINPE', 'REVISORA_SINPE', 'QVET_SINPE',
    'DIF_CAJERA_REVISORA_SINPE', 'DIF_REVISORA_QVET_SINPE', 'DIF_CAJERA_QVET_SINPE',
    // Totales
    'CAJERA_TOTAL', 'REVISORA_TOTAL', 'QVET_TOTAL', 'DIF_CAJERA_REVISORA_TOTAL',
    // Estado y gestión
    'ESTADO', 'OBSERVACIONES', 'MOTIVO_DIFERENCIA', 'ACCION_TOMADA',
    'RESPONSABLE', 'APROBADO', 'FECHA_CIERRE_FINAL', 'FECHA_GENERADO',
  ];
}

function getRevisoraHeaders() {
  return [
    'FECHA/HORA', 'REVISORA', 'CAJA_REVISADA', 'FECHA_CIERRE_REVISADO',
    'EFECTIVO_CONTADO', 'TARJETA_VERIFICADA', 'SINPE_VERIFICADO',
    'ESTADO', 'OBSERVACIONES',
  ];
}

function getVistaRevisoraHeaders() {
  return [
    'Fecha', 'Caja',
    'Cajera — Efectivo al Sobre', 'Revisora — Efectivo Contado', 'Diferencia Efectivo',
    'Cajera — Tarjetas', 'Revisora — Tarjeta Verificada', 'Diferencia Tarjetas',
    'Cajera — SINPE', 'Revisora — SINPE Verificado', 'Diferencia SINPE',
    'Observaciones',
  ];
}

function getResumen5DiasHeaders() {
  return [
    'Período (Inicio)', 'Período (Fin)',
    'Total Efectivo Días', 'Total Tarjetas Días', 'Total SINPE Días',
    'Total Depósitos', 'Total General',
    'Observaciones Admin',
  ];
}

// ============================================================
// OPERACIONES GENÉRICAS
// ============================================================

/**
 * Agrega una fila al sheet indicado.
 * @param {string} sheetName
 * @param {Array}  values
 */
function appendRowToSheet(sheetName, values) {
  const sheet = getSheet(sheetName);
  sheet.appendRow(values);
}

/**
 * Devuelve todas las filas de un sheet como array de objetos,
 * usando la primera fila como claves.
 */
function getAllRows(sheetName) {
  const sheet   = getSheet(sheetName);
  const data    = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

/**
 * Busca filas donde la columna 'colIndex' (0-based) contiene 'value'.
 */
function findRowsByValue(sheetName, colIndex, value) {
  const sheet = getSheet(sheetName);
  const data  = sheet.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1)
    .filter(row => row[colIndex] === value)
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
}
