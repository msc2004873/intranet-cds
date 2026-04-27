// ============================================================
// AUTH.gs — Gestión de roles y usuarios
// ============================================================

const ROLES = {
  ADMIN:    'admin',
  REVISORA: 'revisora',
  CAJERA:   'cajera',
};

const SHEETS = {
  CONFIG:              'Config',
  RESPUESTAS_CAJERAS:  'Respuestas Cajeras',
  RESPUESTAS_REVISORA: 'Respuestas Revisora',
  CIERRE_QVET:         'Cierre QVet',
  QVET_LISTADO:        'QVet Listado',
  CONCILIACION_FINAL:  'Conciliación Final',
  VISTA_REVISORA:      'Vista Revisora',
  RESUMEN_5_DIAS:      'Resumen 5 Días',
};

// Columnas del sheet Config (índice 0)
const CONFIG_COL = {
  EMAIL:  0,
  NOMBRE: 1,
  ROL:    2,
  ACTIVO: 3,
};

/**
 * Devuelve { nombre, rol } para el email dado, o null si no existe/inactivo.
 */
function getUserRole(email) {
  if (!email) return null;

  const sheet = getSheet(SHEETS.CONFIG);
  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {  // fila 0 = encabezados
    const row = data[i];
    if (row[CONFIG_COL.EMAIL].toString().toLowerCase() === email.toLowerCase()) {
      const activo = row[CONFIG_COL.ACTIVO];
      if (activo === false || activo === 'FALSE' || activo === 0) return null;
      return {
        nombre: row[CONFIG_COL.NOMBRE] || email,
        rol:    row[CONFIG_COL.ROL].toString().toLowerCase(),
      };
    }
  }
  return null;
}

/**
 * Devuelve la lista de usuarios activos (para el panel de admin).
 */
function getEquipo() {
  requireRole([ROLES.ADMIN]);
  const sheet = getSheet(SHEETS.CONFIG);
  const data  = sheet.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).map(row => ({
    email:  row[CONFIG_COL.EMAIL],
    nombre: row[CONFIG_COL.NOMBRE],
    rol:    row[CONFIG_COL.ROL],
    activo: row[CONFIG_COL.ACTIVO],
  }));
}

/**
 * Agrega o actualiza un miembro del equipo.
 * data = { email, nombre, rol, activo }
 */
function upsertEquipoMember(data) {
  requireRole([ROLES.ADMIN]);
  const sheet = getSheet(SHEETS.CONFIG);
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (values[i][CONFIG_COL.EMAIL].toString().toLowerCase() === data.email.toLowerCase()) {
      const row = i + 1;
      sheet.getRange(row, CONFIG_COL.NOMBRE + 1).setValue(data.nombre);
      sheet.getRange(row, CONFIG_COL.ROL    + 1).setValue(data.rol);
      sheet.getRange(row, CONFIG_COL.ACTIVO + 1).setValue(data.activo);
      return { success: true, action: 'updated' };
    }
  }

  sheet.appendRow([data.email, data.nombre, data.rol, data.activo !== false]);
  return { success: true, action: 'created' };
}

/**
 * Lanza error si el usuario actual no tiene uno de los roles permitidos.
 */
function requireRole(allowedRoles) {
  const email    = Session.getActiveUser().getEmail();
  const roleData = getUserRole(email);
  if (!roleData || !allowedRoles.includes(roleData.rol)) {
    throw new Error('No tenés permiso para ejecutar esta acción.');
  }
}
