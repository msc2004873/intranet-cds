# CLAUDE.md — Reglas de Piedra para intranet-cds

> **Qué es**: Intranet de la clínica veterinaria **Corral del Sol**. Maneja cajas
> clínicas, cobros Glory, depósitos, conteo de efectivo, cierres de caja y el flujo de
> revisión/auditoría. Todo en español de Costa Rica.
>
> Este archivo son las **notas/reglas para Claude** (no es código, no se despliega, la
> app no lo lee). Mantenerlo al día hace que Claude trabaje sin romper convenciones.

---

## 🚀 Stack y cómo correr

**Stack**: Next.js 16 (App Router) + React 19 + Supabase (`supabase-js` + `pg`).
Librerías: `jsbarcode` (etiquetas), `xlsx` (import de Excel QVet), `jspdf` (declarado pero **no** usado), `dotenv`. Node 20+.

**Correr local**:
1. `npm install`
2. Crear `.env.local` con: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
3. `npm run dev` → http://localhost:3000 (sin cookies de sesión, el middleware redirige a `/login`)

**Migraciones DB**: `npx supabase db push`.

**Trampas del `package.json`** (ignorar, están desactualizadas):
- `"main": "AdminService.js"` → ese archivo no existe.
- `db:test` apunta a `test-connection.js` → no existe.
- `db:push` corre `npx supabase push` (comando incorrecto; usar `db push`).

---

## 🗺️ Mapa de módulos (UI → tabla)

| Módulo (página) | Hace | Tabla principal |
|---|---|---|
| `/cierredecaja` | Cierre de caja de la cajera | `cierre_caja` |
| `/conteo` | Conteo de denominaciones | `conteo_caja` |
| `/cobros-glory` | Cobros del módulo Glory | `cobros_glory` |
| `/depositos` + `/admin/depositos` | Depósitos bancarios | `depositos_cds` |
| `/registros` | Movimientos de caja (ingresos/egresos) | `movimientos` |
| `/admin/revision/clinica` | **Pantalla canónica** de revisión/auditoría de cierres | `revision_caja`, `revision_auditoria` |
| `/revisora/[periodId]` | Revisión por período | `revision_*` |
| `/admin/etiquetas` | Impresión de etiquetas con código de barras | — |
| `/admin/colaboradores` | Alta/baja de personal y PIN | `colaboradores` |
| `/login`, `/module-selection` | Login y selección de módulo | `colaboradores` |

> ⚠️ `/revision/*` y el enlace a `/revisora/clinica` están legacy/rotos. Usar `/admin/revision/clinica`.

---

## 🔐 REGLAS CRÍTICAS (no negociar)

### 1. TIMEZONES — Costa Rica es UTC-6, SIEMPRE

**Regla**: Todo el sistema usa hora Costa Rica. Ninguna excepción.

- **FE (React, navegador en CR)**: `new Date()` local sin conversión. Es CR automáticamente.
- **Backend (API routes en Vercel = UTC)**: NO confiar en hora local. Derivar CR sumando 6h o con `Intl.DateTimeFormat(..., { timeZone: 'America/Costa_Rica' })`. Ya se hace así en `api/cierreCaja` y `api/conteo`.
- **DB (Supabase)**: guarda en UTC internamente. OK. Pero NUNCA mostrar hora UTC en la UI.
- **Display**: siempre `.toLocaleDateString('es-CR')` y `.toLocaleTimeString('es-CR')`.
- **API queries**: para filtrar por fecha CR, convertir a rango UTC (DD 06:00 → DD+1 06:00):
  ```js
  const fechaObj = new Date(`${fecha}T00:00:00`);
  const inicio = new Date(fechaObj.getTime() + 6*60*60*1000).toISOString();
  const fin = new Date(fechaObj.getTime() + 30*60*60*1000).toISOString();
  ```
- **Nunca**: mostrar `2026-05-30T00:01:24Z` al user. Eso es error.

**Por qué**: Bug pasado — SINPE a las 6:01 PM CR (ya es el próximo día en UTC) no aparecía en el cierre porque la query filtraba solo ese día UTC.

---

### 2. MONTOS EN INTERFAZ — Separador de miles

**Regla**: Todo monto en la UI lleva separador de miles.

- **Colones**: `toLocaleString('es-CR')` → usa **ESPACIO** como separador. `(5000).toLocaleString('es-CR')` → `'5 000'`. En display los colones se muestran **redondeados a entero** con el helper estándar `fmt = n => '₡' + Math.round(n).toLocaleString('es-CR')`.
- **Dólares**: `toLocaleString('en-US')` (coma) + `.toFixed(2)`. Ej: `US$1,234.56`.

```jsx
₡5 000        // colones: espacio, entero
US$1,234.56   // dólares: coma, 2 decimales
```

> ⚠️ "No redondear" aplica al **almacenamiento y cálculo**, NO al display de colones. En cálculos internos no redondear; al mostrar colones sí (`Math.round`).

**Por qué**: el espacio es el separador estándar en CR. Sin separador `₡100000` es ilegible. Para inputs, ver Regla 3.

---

### 3. INPUTS NUMÉRICOS — Sin spinners, `type="text"` con formatter

**Regla**: Los inputs editables son `type="text"` (no `type="number"`). Valor 0 se ve como placeholder opaco.

**CSS obligatorio** (en `globals.css`):
```css
input::placeholder { opacity: 0.4; color: currentColor; }
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
- Campo vacío → "0" muy atenuado (placeholder). User tipea → ve el formato con espacios.

**Por qué**: `type="number"` trae spinners que cambian valores con la rueda del mouse; el placeholder opaco es más claro que un "0" visible.

**⚠️ Excepción ya existente** (no es bug): `type="number"` se permite SOLO en:
- (a) campos **readOnly** (tipo de cambio, sobrante) — ej. `FormularioRevision.js`.
- (b) **tarjetas BAC/BN** en `cierredecaja/page.js` y `revisora/[periodId]/page.js`, siempre con `onWheel={e => e.target.blur()}` + `onKeyDown` que bloquea ArrowUp/Down.

Todo input editable **nuevo** usa `type="text"` con formatter.

---

### 4. NAVEGACIÓN EN INPUTS — Enter y Flechas

**Regla**: En formularios con varios inputs numéricos: **Enter** o **↓** = siguiente, **↑** = anterior.

```jsx
onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === 'ArrowDown') {
    e.preventDefault();
    window[`inputDenom${idx + 1}`]?.focus();
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    window[`inputDenom${idx - 1}`]?.focus();
  }
}}
```

**Por qué**: entrada rápida sin mouse. Cajeras con prisa lo usan.

---

### 5. MONEDA — Lo que se guarda es lo que se muestra

**Regla**: No hay conversión automática de moneda.
- `monto: 5000, moneda: 'colones'` → `₡5 000`
- `monto: 100, moneda: 'usd'` → `US$100`

**Dónde vive `moneda`**:
- La columna `moneda` ('colones' | 'usd') aplica SOLO a la tabla **`movimientos`** (una moneda por fila).
- `cierre_caja`, `conteo_caja` y `cobros_glory` NO tienen columna `moneda`: modelan las monedas como columnas separadas (`total_colones`, `dolares`, etc.). NO agregar `moneda` ahí.

**Por qué**: evita confusiones. El user sabe exactamente qué guardó.

---

### 6. VALIDACIONES SERVER-SIDE (en la API)

**Regla**: Toda API que guarde datos DEBE validar server-side, aunque el navegador también valide.

```js
// En /api/movimientos POST:
if (!cajera || cajera === '') throw new Error('Falta cajera');
if (!caja || caja === '') throw new Error('Falta caja');
if (!tipo) throw new Error('Falta tipo');
if (!moneda || !['colones', 'usd'].includes(moneda)) throw new Error('Moneda inválida');
if (monto < 0) throw new Error('Monto no puede ser negativo');
```

**Por qué**: si alguien manipula la request (DevTools/Postman), se rechaza igual. Es el "seguro" del sistema.

**Estado actual**:
- ✅ Validan server-side: `/api/movimientos`, `/api/conteo`, `/api/cierreCaja`.
- ❌ `cobros_glory` se escribe **directo desde el navegador** (la ruta `/api/cobros-glory` solo tiene GET). Sin seguro server-side → ver "Deuda técnica".

---

### 7. ETIQUETAS / BARCODE — Canvas→PNG, NUNCA SVG

**Regla**: En impresoras térmicas el código de barras SOLO funciona renderizado como **Canvas→PNG** dentro de un `<img>`:
```js
JsBarcode(canvas, codigo, { width: 4, height: 220, ... });
const png = canvas.toDataURL('image/png');   // → <img src={png} />
```
**PROHIBIDO** renderizar el barcode como SVG: SIEMPRE se recorta (clipping) en la térmica.

**Por qué**: lección cara (muchas iteraciones). El SVG clippea sí o sí; el canvas de alta resolución imprime nítido.

**Detalles** (`app/admin/etiquetas/page.js`):
- Objeto `TAMANOS`: pequeña 32×19 mm, grande 50×26 mm. Coordenadas absolutas en mm/pt calibradas (BarTender + `offsetX` por impresora). Es el único punto de calibración.
- Grande muestra dígitos (`displayValue:true`); pequeña los oculta (evita pixelación).
- Evaluar el CSS/`@page` SOLO del tamaño seleccionado (evita TypeError).
- La impresión usa print nativo del navegador vía `<iframe>` + `@page`. NO usa jspdf.

---

## 🗄️ Datos y Supabase

**Cliente Supabase**:
- **API routes (server)**: usar el cliente con **service role** (bypassa RLS) desde `app/lib/`. Evitar `createClient()` inline en rutas nuevas (varias legacy aún lo hacen).
- **Componentes cliente**: anon key vía `NEXT_PUBLIC_*`. NUNCA hardcodear claves (`cobros-glory/page.js` las tiene hardcodeadas — deuda).

**Tablas**: `cierre_caja`, `conteo_caja`, `movimientos`, `cobros_glory`, `colaboradores`, `depositos_cds`, `revision_caja`, `revision_glory`, `revision_auditoria`, `periodos_tipo_cambio`.

**⚠️ Gotchas de datos**:
- `conteo_caja` tiene **dos escritores**: `/api/conteo` (total real) y `/api/cierreCaja` (inserta con `total_colones: 0`). Las filas con total 0 vienen de cierres, **no son datos corruptos**.
- Tabla canónica de TC = **`periodos_tipo_cambio`**. Si ves `periodo_tipos_cambio` (en rutas test/debug) es un nombre **erróneo/legacy**.
- Las claves (`cierre_caja`, `conteo_caja`) usan `GENERATED ALWAYS AS IDENTITY` — no insertar `id` a mano.

> 📌 Insertar un cierre atrasado (fecha pasada): el formulario `/cierredecaja` **no sirve** (la API estampa la fecha de HOY). Hay que hacer INSERT directo. Receta en `memory/reference_agregar_cierre_atrasado.md`.

---

## 💱 Sistema de Tipo de Cambio (TC)

**Regla**: cada mes tiene **6 períodos de 5 días** (el 6º va del día 26 a fin de mes).
- Tabla `periodos_tipo_cambio` (campos: `ano`, `mes`, `periodo_num`, `tipo_cambio`, `tipo_cambio_ajustado`, `fecha_inicio`, `fecha_fin`), clave única `(ano, mes, periodo_num)`.
- Fuente del TC: API Hacienda `https://api.hacienda.go.cr/indicadores/tc/dolar` (campo compra).
- **La UI consume SIEMPRE `tipo_cambio_ajustado`**, no `tipo_cambio`.

**⚠️ Contradicción sin resolver**: `auto-sync` y `get-actual` calculan `ajustado = compra − 10`, pero `update-adjusted-rates` está deshabilitado con el comentario "el ajustado debe ser MANUAL por período". **Confirmar la fuente de verdad antes de tocar.** Además `auto-sync` no tiene cron — se invoca manual.

---

## 🔑 Autenticación, roles y revisión

**Auth (NO es Supabase Auth)**: login = iniciales (2 letras) + PIN (4 dígitos) contra la tabla `colaboradores` (`activo = true`). Sesión = cookies httpOnly `user` (JSON) + `authToken` (base64 `id:timestamp`, no es JWT) + copia en localStorage. Endpoint: `POST /api/auth/login`.

**Roles**: solo `'admin'` y `'cajera'` (minúscula, campo `rol`). "revisora" NO es un rol, es un módulo.

**Flujo de revisión (3 etapas, ligadas por `cierre_caja_id` → `revision_caja_id`)**:
1. **Cierre**: la cajera crea `cierre_caja` (`POST /api/cierreCaja`).
2. **Revisión**: la revisora recuenta → `revision_caja` (estado `'revisado'`).
3. **Auditoría**: se sube Excel QVet → compara cajera/revisora/QVet → `revision_auditoria` (`estado_auditoria: 'EN_REVISION'`). Re-subir = delete+insert.

Pantalla canónica: `/admin/revision/clinica`.

---

## ✅ ESTÁNDARES (módulos nuevos y existentes)

### Validaciones mínimas
- **Montos**: positivos o cero. El campo `tipo` define ingreso/egreso.
- **Campos obligatorios** (tabla `movimientos`): `tipo`, `cajera`, `caja`, `moneda`.
- **Rango de fechas**: Inicio ≤ Fin. Si no, error.

### Feedback al user
- Éxito: toast verde `✅`. Error: toast rojo `❌`. Info: toast gris `ℹ️`. Duración 3 s.
```jsx
const showToast = (msg, type = 'info') => {
  setToast({ msg, type });
  setTimeout(() => setToast(null), 3000);
};
```

### Estructura de datos — tabla `movimientos` (referencia)
Obligatorios: `tipo` ('ingreso'|'egreso'), `monto` (number ≥ 0), `moneda` ('colones'|'usd'), `cajera`, `caja`, `created_at`.
Opcionales: `referencia`, `archivo_url`.
> `created_at` lo asigna el **default UTC de la DB** si la API no lo manda. `cajera`/`caja` aplican a `movimientos`, no a todas las tablas.

### Colores por módulo (paleta real)
| Uso | Hex |
|---|---|
| Clínica / cajas | `#2a78a5` (azul) |
| Glory / cobros | `#C8A84B` (dorado) |
| Éxito / cierre / guardar | `#27AE60` (hover `#1E8449`) |
| Admin | `#5B35B5` (morado) |
| Transferencias | `#8B6914` |
| Warning | `#F39C12` |
| Deshabilitado | `#95A5A6` |
| Error / diferencias | `#E74C3C` |
| Destructivo / salidas | `#C0392B` |
| Neutro | `#9C9590` |

> Los tokens `--accent`, `--accent2`, `--danger` en `globals.css` están **muertos** (0 usos). Los colores hoy están hardcodeados. Si se ordena la paleta, adoptar tokens o borrarlos.

---

## ⚠️ DEUDA TÉCNICA CONOCIDA (anotada, no urgente)

Esto NO se arregla editando este archivo — son cambios de código para hacer aparte, con cuidado:

- **Auth/roles 100% client-side**: el guard de rol vive en localStorage + `router.push`; el middleware solo verifica que existan cookies, no el rol ni la firma. Las APIs no autorizan por rol/sesión.
- **PIN en texto plano**: se compara sin hash.
- **`cobros_glory` sin seguro server-side**: se inserta/actualiza desde el navegador (no hay POST en la API). Manipulable con DevTools.
- **Rutas `/api/test/*` y `/api/debug/*`**: insertan datos falsos en tablas reales y exponen datos sin auth. No deberían estar accesibles en prod.
- **Claves Supabase hardcodeadas** en `cobros-glory/page.js`.
- **Contradicción del TC ajustado** (manual vs `compra − 10`): ver sección TC.

---

## 🚫 PROHIBIDO

- ❌ Mostrar horas UTC al user
- ❌ Spinners en inputs numéricos (salvo la excepción de la Regla 3)
- ❌ "0" visible en campos vacíos
- ❌ Montos negativos (usa `tipo` para definir ingreso/egreso)
- ❌ Conversiones de moneda automáticas
- ❌ Checkboxes + botones de acción en la misma vista (usar modo toggle)
- ❌ Renderizar barcodes como SVG (usar Canvas→PNG)
- ❌ Hardcodear claves de Supabase en código cliente

---

## 📋 CHECKLIST para nuevos módulos

- [ ] Timezones: `new Date()` local en FE / derivar CR en backend; display `.toLocaleDateString('es-CR')`
- [ ] Montos: colones es-CR (espacio, `Math.round`), dólares en-US (coma, 2 dec.)
- [ ] Inputs numéricos: `type="text"`, sin spinners, 0 = vacío, navegación Enter/flechas
- [ ] Validaciones server-side en la API (no solo en el navegador)
- [ ] Validaciones mínimas: montos ≥ 0, campos obligatorios presentes
- [ ] Feedback: toast para éxito/error
- [ ] Colores: usa la paleta real, consistente con módulos existentes
- [ ] Sin checkboxes + botones de acción juntos (usar toggle)
- [ ] Cliente Supabase: service role en API, anon en cliente, sin claves hardcodeadas
