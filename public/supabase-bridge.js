// Puente para convertir google.script.run (Google Apps Script)
// en llamadas a API REST (Next.js + Supabase)

window.google = window.google || {};
window.google.script = window.google.script || {};
window.google.script.run = {
  _successHandlers: [],
  _failureHandlers: [],
  _currentCall: null,

  withSuccessHandler(fn) {
    this._successHandlers.push(fn);
    return this;
  },

  withFailureHandler(fn) {
    this._failureHandlers.push(fn);
    return this;
  },

  async _executeAPI(endpoint, data) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        this._successHandlers.forEach((fn) => fn(result));
      } else {
        throw new Error(result.error || 'Error en servidor');
      }
    } catch (error) {
      console.error('API Error:', error);
      this._failureHandlers.forEach((fn) => fn(error));
    }

    // Reset para la siguiente llamada
    this._successHandlers = [];
    this._failureHandlers = [];
  },

  // Métodos que Cajera.html y Revisora.html llaman
  submitCierre(data) {
    console.log('📤 Enviando cierre de caja a Supabase:', data);
    this._executeAPI('/api/cierreCaja', data);
  },

  submitRevision(data) {
    console.log('📤 Enviando revisión a Supabase:', data);
    this._executeAPI('/api/revision', data);
  },
};

console.log('✅ Supabase bridge loaded. google.script.run está listo.');
