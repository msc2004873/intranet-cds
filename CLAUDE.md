# CLAUDE.md — Reglas de Piedra para intranet-cds

## 🔐 REGLAS CRÍTICAS (no negociar)

### 1. TIMEZONES — Costa Rica es UTC-6, SIEMPRE

**Regla**: Todo el sistema usa hora Costa Rica. Ninguna excepción.

- **FE (React)**: Usar `new Date()` local sin conversión. Es CR automáticamente.
- **DB (Supabase)**: Se guarda en UTC internamente. OK. Pero NUNCA mostrar hora UTC en la UI.
- **Display**: Siempre `.toLocaleDateString('es-CR')` y `.toLocaleTimeString('es-CR')`
- **API queries**: Si necesitás filtrar por fecha CR, convertir a rango UTC:
  ```js
  // Fecha CR → rango UTC para buscar en created_at
  const fechaObj = new Date(`${fecha}T00:00:00`);
  const inicio = new Date(fechaObj.getTime() + 6*60*60*1000).toISOString();
  const fin = new Date(fechaObj.getTime() + 30*60*60*1000).toISOString();
  ```
- **Nunca**: Mostrar `2026-05-30T00:01:24Z` al user. Eso es error.

**Por qué**: Bug pasado: SINPE a las 6:01 PM CR (próximo día UTC) no aparecía en cierre porque filtraba solo ese día UTC.

---

### 2. MONTOS EN INTERFAZ — Separador de miles, sin redondeo

**Regla**: Todo monto en la UI tiene separador de miles. Nunca redondear.

**Display correcto** (siempre con `toLocaleString('es-CR')` que usa ESPACIO):
```jsx
(5000).toLocaleString('es-CR')  // '5 000' ✅ CORRECTO
```

Ejemplos:
- `5000` → `₡5 000` (espacio como separador)
- `5000.50` → `₡5 000.50`
- `5000.9999` → `₡5 000.9999`

**Inputs numéricos**: 
```jsx
value={monto === 0 ? '' : monto.toLocaleString('es-CR')}
onChange={(e) => setMonto(parseFloat(e.target.value.replace(/\s/g, '')) || 0)}
```

**Por qué**: Separador de espacio es estándar en Costa Rica. Sin separador `₡100000` es ilegible.

---

### 3. INPUTS NUMÉRICOS — Sin spinners, type="text" con formatter

**Regla**: Los inputs deben ser `type="text"` (nunca `type="number"`). Valor 0 se ve como placeholder opaco.

**CSS obligatorio** (en `globals.css`):
```css
input::placeholder {
  opacity: 0.4;
  color: currentColor;
}
```

**Implementación correcta**:
```jsx
<input
  type="text"
  value={monto === 0 ? '' : monto.toLocaleString('es-CR')}
  onChange={(e) => setMonto(parseFloat(e.target.value.replace(/\s/g, '')) || 0)}
  placeholder="0"
  inputMode="numeric"
/>
```

Resultado:
- Campo vacío: aparece un "0" muy atenuado (placeholder opaco)
- User tipea: el "0" desaparece, ve lo que escribe formateado con espacios
- Ejemplo: tipea "1000" → ve "1 000" automáticamente

**Por qué**: 
- `type="number"` trae spinners (flechitas) que causan cambios accidentales con rueda del mouse
- Placeholder opaco es mejor que "0" visible: visualmente presente pero no confunde
- Formateo automático con espacios es más legible

**Aplica a**: Todos los inputs de montos, cantidad, denominaciones, etc.

---

### 4. NAVEGACIÓN EN INPUTS — Enter y Flechas para navegar

**Regla**: En formularios con múltiples inputs numéricos, puedes navegar con:
- **Enter** o **↓** = siguiente input
- **↑** = input anterior

```jsx
onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === 'ArrowDown') {
    e.preventDefault();
    const nextInput = window[`inputDenom${idx + 1}`];
    if (nextInput) nextInput.focus();
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prevInput = window[`inputDenom${idx - 1}`];
    if (prevInput) prevInput.focus();
  }
}}
```

**Por qué**: Entrada rápida sin mouse. Cajeras con prisa lo usan. Las flechas son naturales para navegar listas.

---

### 5. MONEDA — Lo que se guarda es lo que se muestra

**Regla**: No hay conversión automática.
- Si se guarda `monto: 5000, moneda: 'colones'` → mostrar `₡5000`
- Si se guarda `monto: 100, moneda: 'usd'` → mostrar `US$100`
- Campo `moneda` es obligatorio en toda tabla de movimientos.

**Por qué**: Evita confusiones. El user sabe exactamente qué guardó.

---

### 5.5. VALIDACIONES SERVER-SIDE (en la API)

**Regla**: Toda API que guarde datos DEBE validar que sean correctos, aunque el navegador también valide.

```js
// En /api/movimientos POST:
if (!cajera || cajera === '') throw new Error('Falta cajera');
if (!caja || caja === '') throw new Error('Falta caja');
if (!tipo) throw new Error('Falta tipo');
if (!moneda || !['colones', 'usd'].includes(moneda)) throw new Error('Moneda inválida');
if (monto < 0) throw new Error('Monto no puede ser negativo');
```

**Por qué**: Si alguien manipula la request (DevTools, Postman), se rechaza igual. Es el "seguro" del sistema.

**Aplica a**: POST/PUT en `/api/movimientos`, `/api/conteo`, `/api/cobros-glory`, `/api/cierreCaja`

---

## ✅ ESTÁNDARES (aplica a módulos nuevos y existentes)

### 6. VALIDACIONES MÍNIMAS

- **Montos**: Siempre positivos o cero. El campo `tipo` define si es ingreso/egreso.
- **Campos obligatorios**: `tipo`, `cajera`, `caja`, `moneda` siempre requeridos
- **Rango de fechas**: Inicio ≤ Fin. Si no, error.

### 7. FEEDBACK AL USER

- **Éxito**: Toast verde con `✅ Mensaje`
- **Error**: Toast rojo con `❌ Mensaje`
- **Info**: Toast gris con `ℹ️ Mensaje`
- **Duración**: 3 segundos (o hasta user cierre)

```jsx
const showToast = (msg, type = 'info') => {
  setToast({ msg, type });
  setTimeout(() => setToast(null), 3000);
};
```

### 8. ESTRUCTURA DE DATOS (Movimientos)

Campos obligatorios:
- `tipo` (string: 'ingreso' | 'egreso' | etc) — **Define si sube o baja**
- `monto` (number, siempre positivo) — Cantidad, nunca negativo
- `moneda` (string: 'colones' | 'usd')
- `cajera` (string)
- `caja` (string)
- `created_at` (datetime, guardado como `new Date()` local)

Campos opcionales:
- `referencia` (string)
- `archivo_url` (string)

### 9. COLORES POR MÓDULO

- **Clínica** (cajas): Azul `#2a78a5`
- **Glory** (cobros): Dorado `#C8A84B`
- **Movimientos**: Verde `#2a78a5`
- **Neutro/error**: Gris/rojo `#9C9590` / `#E74C3C`

---

## 🚫 PROHIBIDO

- ❌ Mostrar horas UTC al user
- ❌ Spinners en inputs numéricos
- ❌ "0" visible en campos vacíos
- ❌ Montos negativos (usa `tipo` para definir ingreso/egreso)
- ❌ Conversiones de moneda automáticas
- ❌ Checkboxes + botones de acción en la misma vista (usar modo toggle)

---

## 📋 CHECKLIST para nuevos módulos

- [ ] Timezones: Usa `new Date()` local, display con `.toLocaleDateString('es-CR')`
- [ ] Inputs numéricos: Sin spinners, 0 = vacío, Enter navigation
- [ ] Validaciones: Montos no negativos, campos obligatorios presentes
- [ ] Feedback: Toast para éxito/error
- [ ] Colores: Usa paleta del módulo, consistente con existentes
- [ ] Moneda: Campo `moneda` guardado, no conversión automática
