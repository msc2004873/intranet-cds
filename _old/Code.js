// ============================================================
// SISTEMA SIMPLE: FORMULARIOS → SHEET
// ============================================================

let SHEET_ID = '';

// Obtener o crear el Sheet
function initializeSheet() {
  const props = PropertiesService.getUserProperties();
  SHEET_ID = props.getProperty('SHEET_ID');

  if (!SHEET_ID) {
    // Crear nuevo Sheet
    const ss = SpreadsheetApp.create('Datos Corral del Sol');
    SHEET_ID = ss.getId();
    props.setProperty('SHEET_ID', SHEET_ID);

    // Crear pestañas
    createSheet(ss, 'Cajera', ['FECHA', 'CAJERA', 'CAJA', 'TC', '₡20k', '₡10k', '₡5k', '₡2k', '₡1k', '₡500', '₡100', '₡50', '₡25', '₡10', '₡5', 'TARJETA_BAC', 'TARJETA_BN', 'COMENTARIOS']);
    createSheet(ss, 'Revisora', ['FECHA', 'REVISORA', 'CAJA', 'FECHA_CIERRE', 'EFECTIVO_CONTADO', 'TARJETA_BAC', 'TARJETA_BN', 'SINPE', 'OBSERVACIONES']);
    createSheet(ss, 'Admin', ['FECHA', 'TIPO', 'DATOS']);
  }

  return SHEET_ID;
}

function createSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  sheet.clearContents();
  sheet.appendRow(headers);
}

// ============================================================
// GUARDAR EN SHEET
// ============================================================

function guardarCajera(data) {
  try {
    initializeSheet();
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('Cajera');

    const row = [
      new Date(),
      data.cajera,
      data.caja,
      data.tc,
      data.denom20k || 0,
      data.denom10k || 0,
      data.denom5k || 0,
      data.denom2k || 0,
      data.denom1k || 0,
      data.denom500 || 0,
      data.denom100 || 0,
      data.denom50 || 0,
      data.denom25 || 0,
      data.denom10 || 0,
      data.denom5 || 0,
      data.tarjetaBac || 0,
      data.tarjetaBn || 0,
      data.comentarios || ''
    ];

    sheet.appendRow(row);
    return { success: true, message: '✅ Guardado en el Sheet', sheetId: SHEET_ID };
  } catch(err) {
    return { success: false, message: '❌ Error: ' + err.message };
  }
}

function guardarRevisora(data) {
  try {
    initializeSheet();
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName('Revisora');

    const row = [
      new Date(),
      data.revisora,
      data.caja,
      data.fechaCierre,
      data.efectivo || 0,
      data.tarjetaBac || 0,
      data.tarjetaBn || 0,
      data.sinpe || 0,
      data.observaciones || ''
    ];

    sheet.appendRow(row);
    return { success: true, message: '✅ Revisión guardada' };
  } catch(err) {
    return { success: false, message: '❌ Error: ' + err.message };
  }
}

// ============================================================
// ENTRY POINT
// ============================================================

function doGet(e) {
  try {
    initializeSheet();

    const page = (e.parameter && e.parameter.page) ? e.parameter.page : 'index';
    let html;

    if (page === 'cajera') {
      html = HtmlService.createHtmlOutputFromFile('Cajera');
    } else if (page === 'revisora') {
      html = HtmlService.createHtmlOutputFromFile('Revisora');
    } else {
      html = HtmlService.createHtmlOutputFromFile('Index');
    }

    return html
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);

  } catch(err) {
    return HtmlService.createHtmlOutput('<h2>Error: ' + err.message + '</h2>');
  }
}
