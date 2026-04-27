// ============================================================
// DriveService.gs — Manejo de archivos en Google Drive
// ============================================================

/**
 * Inicializa la carpeta raíz de la aplicación si no existe.
 */
function setupDriveFolder() {
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  Logger.log('Carpeta Drive: ' + folder.getName());
}

/**
 * Guarda un archivo en Drive y devuelve su URL pública (de visualización).
 *
 * @param {string} base64Data  Datos del archivo en base64
 * @param {string} fileName    Nombre del archivo
 * @param {string} mimeType    MIME type (e.g. 'image/jpeg', 'application/pdf')
 * @param {string} subfolder   Subcarpeta dentro de la carpeta raíz (e.g. '2024-01/SINPE')
 * @returns {string} URL de visualización del archivo
 */
function saveFileToDrive(base64Data, fileName, mimeType, subfolder) {
  const bytes   = Utilities.base64Decode(base64Data);
  const blob    = Utilities.newBlob(bytes, mimeType, fileName);
  const folder  = getOrCreateSubfolder(subfolder);
  const file    = folder.createFile(blob);

  // Hace el archivo visible para el dominio
  file.setSharing(DriveApp.Access.DOMAIN, DriveApp.Permission.VIEW);

  return file.getUrl();
}

/**
 * Obtiene o crea una subcarpeta dentro de la carpeta raíz de la app.
 * El path puede tener niveles: 'YYYY-MM/SINPE'
 */
function getOrCreateSubfolder(subpath) {
  let current = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  if (!subpath) return current;

  const parts = subpath.split('/');
  for (const part of parts) {
    if (!part) continue;
    const it = current.getFoldersByName(part);
    current  = it.hasNext() ? it.next() : current.createFolder(part);
  }
  return current;
}

/**
 * Genera el path de subcarpeta estándar para un cierre:
 * 'YYYY-MM/DD-Caja1/tipo'
 */
function buildSubfolderPath(fechaCierre, caja, tipo) {
  // fechaCierre es string 'YYYY-MM-DD' o Date
  const d = (fechaCierre instanceof Date) ? fechaCierre : new Date(fechaCierre + 'T12:00:00');
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');
  const cajaSlug = caja.replace(/\s+/g, '');
  return `${year}-${month}/${day}-${cajaSlug}/${tipo}`;
}
