// ============================================================
// Utils.gs — Funciones utilitarias compartidas
// ============================================================

/**
 * Formatea un número como moneda en colones: ₡1.234.567
 */
function formatColones(amount) {
  if (amount === null || amount === undefined) return '—';
  return '₡' + Number(amount).toLocaleString('es-CR');
}

/**
 * Formatea como dólares: $1,234.56
 */
function formatDolares(amount) {
  if (amount === null || amount === undefined) return '—';
  return '$' + Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Formatea una fecha Date a string 'YYYY-MM-DD' en zona Costa Rica.
 */
function formatDateCR(date) {
  const d = new Date(date);
  const tz = 'America/Costa_Rica';
  return d.toLocaleDateString('sv-SE', { timeZone: tz }); // sv-SE devuelve YYYY-MM-DD
}

/**
 * Devuelve el nombre del mes en español.
 */
function getNombreMes(month) {
  const nombres = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
  ];
  return nombres[month - 1] || '';
}

/**
 * Función helper para llamadas seguras a funciones de servidor desde el cliente.
 * Devuelve una Promise resuelta con el resultado o rechazada con el error.
 * (Esta función se copia al cliente — ver Scripts.html)
 */
function serverCall(fn, ...args) {
  return new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler(resolve)
      .withFailureHandler(reject)
      [fn](...args);
  });
}
