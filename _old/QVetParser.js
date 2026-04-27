// ============================================================
// QVetParser.gs — Parser de PDF de cierre QVet
//
// Prioridad de extracción:
//   1. Texto nativo del PDF (sin OCR)
//   2. OCR solo como fallback si el texto nativo es insuficiente
//   Se registra qué método se usó (metodo_extraccion).
//
// Filosofía:
//   - Mejor fallar que devolver datos incorrectos.
//   - No inventar valores.
//   - Si hay ambigüedad en un campo requerido → error, no auto-seleccionar.
// ============================================================

const QVET_PARSER_VERSION = '1.1';
const TEXTO_MINIMO_CHARS  = 50; // mínimo de chars para considerar texto nativo válido

const QVET_LABELS = {
  efectivo:       ['efectivo', 'cash', 'dinero efectivo', 'contado'],
  tarjetas:       ['tarjeta', 'tarjetas', 'tarjeta crédito', 'tarjeta débito',
                   'crédito', 'débito', 'pos', 'datafono', 'datáfono',
                   'tarjeta de crédito', 'tarjeta de débito'],
  sinpe:          ['sinpe', 'sinpe móvil', 'sinpe movil'],
  transferencias: ['transferencia', 'transferencias', 'depósito', 'deposito',
                   'depósito bancario'],
  total_general:  ['total', 'total general', 'gran total', 'total del día',
                   'total del dia', 'total ventas', 'total cobrado'],
};

// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================

/**
 * Parsea un PDF de QVet desde base64.
 *
 * Retorna SIEMPRE un objeto — nunca lanza excepción al caller.
 * Si hay errores graves, confidence_score = 0 y errores describe qué falló.
 *
 * @param {string} base64Data
 * @param {string} fileName
 * @returns {{
 *   efectivo, tarjetas, sinpe, transferencias, total_general,
 *   confidence_score, metodo_extraccion, errores
 * }}
 */
function parseQVetPDF(base64Data, fileName) {
  const errores = [];
  let tempPdfId = null;

  try {
    tempPdfId = saveTempPDF(base64Data, fileName || 'qvet_temp.pdf');

    // Intentar texto nativo primero, OCR solo como fallback
    const { texto, metodo } = extraerTexto(tempPdfId);

    if (!texto || texto.trim().length < TEXTO_MINIMO_CHARS) {
      return fallar('El PDF no tiene texto legible después de intentar texto nativo y OCR.');
    }

    Logger.log('[QVetParser] Método: ' + metodo + ' — chars: ' + texto.length);

    const resultado = parsearTexto(texto, errores);
    validarResultado(resultado, errores);

    const score = calcularConfianza(resultado, errores);

    return {
      efectivo:          resultado.efectivo,
      tarjetas:          resultado.tarjetas,
      sinpe:             resultado.sinpe,
      transferencias:    resultado.transferencias,
      total_general:     resultado.total_general,
      confidence_score:  score,
      metodo_extraccion: metodo,
      errores,
    };

  } catch (err) {
    Logger.log('[QVetParser] Excepción inesperada: ' + err.message);
    return fallar('Error interno del parser: ' + err.message);
  } finally {
    if (tempPdfId) {
      try { DriveApp.getFileById(tempPdfId).setTrashed(true); } catch (e) {}
    }
  }
}

function fallar(mensaje) {
  return {
    efectivo: null, tarjetas: null, sinpe: null,
    transferencias: null, total_general: null,
    confidence_score: 0,
    metodo_extraccion: 'fallido',
    errores: [mensaje],
  };
}

// ============================================================
// EXTRACCIÓN DE TEXTO — nativo primero, OCR como fallback
// ============================================================

function extraerTexto(pdfFileId) {
  let docIdNativo = null;
  let docIdOcr    = null;

  try {
    // Intento 1: texto nativo (sin OCR)
    docIdNativo = crearDoc(pdfFileId, false);
    const textoNativo = leerDoc(docIdNativo);

    if (textoNativo && textoNativo.trim().length >= TEXTO_MINIMO_CHARS) {
      Logger.log('[QVetParser] Texto nativo OK.');
      return { texto: textoNativo, metodo: 'texto_nativo' };
    }

    Logger.log('[QVetParser] Texto nativo insuficiente, usando OCR como fallback.');

    // Intento 2: OCR
    docIdOcr = crearDoc(pdfFileId, true);
    const textoOcr = leerDoc(docIdOcr);

    return { texto: textoOcr || '', metodo: 'ocr' };

  } finally {
    if (docIdNativo) { try { DriveApp.getFileById(docIdNativo).setTrashed(true); } catch (e) {} }
    if (docIdOcr)    { try { DriveApp.getFileById(docIdOcr).setTrashed(true);    } catch (e) {} }
  }
}

function crearDoc(pdfFileId, conOcr) {
  const resource = {
    title:    'qvet_parse_' + (conOcr ? 'ocr' : 'nativo') + '_' + new Date().getTime(),
    mimeType: 'application/vnd.google-apps.document',
    parents:  [{ id: CONFIG.DRIVE_FOLDER_ID }],
  };
  const options = conOcr
    ? { ocr: true, ocrLanguage: 'es' }
    : { ocr: false };

  const file = Drive.Files.copy(resource, pdfFileId, options);
  return file.id;
}

function leerDoc(docId) {
  try {
    return DocumentApp.openById(docId).getBody().getText();
  } catch (e) {
    return '';
  }
}

function saveTempPDF(base64Data, fileName) {
  const bytes  = Utilities.base64Decode(base64Data);
  const blob   = Utilities.newBlob(bytes, 'application/pdf', fileName);
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  return folder.createFile(blob).getId();
}

// ============================================================
// PARSER DE TEXTO
// ============================================================

function parsearTexto(texto, errores) {
  const lineas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const resultado = {
    efectivo: null, tarjetas: null, sinpe: null,
    transferencias: null, total_general: null,
  };

  const CAMPOS_REQUERIDOS = new Set(['efectivo', 'tarjetas', 'sinpe']);

  for (const campo of Object.keys(QVET_LABELS)) {
    const labels  = QVET_LABELS[campo];
    const matches = [];

    for (let i = 0; i < lineas.length; i++) {
      const lineaLower = lineas[i].toLowerCase();
      for (const label of labels) {
        if (lineaLower.includes(label)) {
          const monto = extraerMonto(lineas[i]) ?? extraerMonto(lineas[i + 1] || '');
          if (monto !== null && !matches.some(m => m.monto === monto && m.linea === lineas[i])) {
            matches.push({ monto, linea: lineas[i], label });
          }
        }
      }
    }

    if (matches.length === 0) {
      // Campos opcionales no generan error
      if (CAMPOS_REQUERIDOS.has(campo)) {
        errores.push('No se encontró el campo "' + campo + '" en el PDF.');
      }

    } else if (matches.length > 1) {
      const montos = [...new Set(matches.map(m => m.monto))];

      if (montos.length === 1) {
        // Mismo valor repetido — OK
        resultado[campo] = montos[0];
      } else if (CAMPOS_REQUERIDOS.has(campo)) {
        // Ambigüedad en campo requerido → FALLAR, no auto-seleccionar
        errores.push(
          'Campo "' + campo + '" es ambiguo: se encontraron múltiples valores distintos [' +
          montos.join(', ') + ']. No se puede determinar cuál es correcto. Verificá el PDF.'
        );
        // resultado[campo] queda null → fallará validación posterior
      } else {
        // Campo opcional con ambigüedad → advertir, usar el mayor
        resultado[campo] = Math.max(...montos);
        errores.push(
          'Campo opcional "' + campo + '" tiene múltiples valores [' +
          montos.join(', ') + ']. Se usó el mayor (' + resultado[campo] + ').'
        );
      }

    } else {
      resultado[campo] = matches[0].monto;
    }
  }

  return resultado;
}

// ============================================================
// EXTRACCIÓN DE MONTOS
// ============================================================

function extraerMonto(linea) {
  if (!linea) return null;
  const limpia = linea.replace(/₡/g, '').trim();

  const patrones = [
    /(\d{1,3}(?:\.\d{3})+(?:,\d{2})?)/,
    /(\d{1,3}(?:,\d{3})+(?:\.\d{2})?)/,
    /(\d{1,3}(?:\s\d{3})+)/,
    /(\d{5,})/,
  ];

  for (const patron of patrones) {
    const match = limpia.match(patron);
    if (match) {
      const monto = parseCRC(match[1]);
      if (monto > 0) return monto;
    }
  }
  return null;
}

function parseCRC(str) {
  if (!str) return 0;
  let s = str.replace(/₡/g, '').replace(/\s/g, '');
  const tienePunto = s.includes('.');
  const tieneComma = s.includes(',');

  if (tienePunto && tieneComma) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (tienePunto) {
    const partes = s.split('.');
    if (partes[partes.length - 1].length === 3) s = s.replace(/\./g, '');
  } else if (tieneComma) {
    const partes = s.split(',');
    if (partes[partes.length - 1].length === 3) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
  }
  return Math.round(parseFloat(s)) || 0;
}

// ============================================================
// VALIDACIONES
// ============================================================

function validarResultado(resultado, errores) {
  // Campos obligatorios — si falta alguno ya fue registrado en parsearTexto
  // Aquí validamos consistencia interna si hay total_general
  if (resultado.total_general !== null) {
    const camposPresentes = ['efectivo', 'tarjetas', 'sinpe', 'transferencias']
      .filter(c => resultado[c] !== null);

    if (camposPresentes.length >= 2) {
      const suma = camposPresentes.reduce((s, c) => s + resultado[c], 0);
      const diff = Math.abs(suma - resultado.total_general);

      // Tolerancia cero: si el PDF tiene total_general, debe coincidir exactamente
      // Se permite hasta ₡100 por redondeo
      if (diff > 100) {
        errores.push(
          'Inconsistencia interna del PDF: total_general=' + resultado.total_general +
          ', suma de categorías=' + suma +
          ', diferencia=' + diff + '. El PDF parece tener un error.'
        );
      }
    }
  }
}

// ============================================================
// CONFIANZA
// ============================================================

function calcularConfianza(resultado, errores) {
  const CAMPOS_REQUERIDOS = ['efectivo', 'tarjetas', 'sinpe'];
  const encontrados = CAMPOS_REQUERIDOS.filter(c => resultado[c] !== null).length;

  // Si falta cualquier campo requerido → confianza 0 directamente
  if (encontrados < CAMPOS_REQUERIDOS.length) return 0;

  // Con todos los campos: 1.0 - penalización por errores/advertencias
  const score = 1.0 - (errores.length * 0.15);
  return Math.max(0, Math.round(score * 100) / 100);
}
