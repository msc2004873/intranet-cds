# Intranet Corral del Sol — Documento de Contexto Completo

## 1. Contexto del negocio

Corral del Sol es una clínica veterinaria en Costa Rica con 6-15 empleados. Usan Google Workspace con dominio propio y QVet como software veterinario (no tocar). El equipo es básico en tecnología.

El objetivo es construir una intranet interna como Google Apps Script Web App que centralice las operaciones del negocio, principalmente el sistema de cierre de caja diario.

---

## 2. Stack técnico

- **Google Apps Script** — backend y hosting (doGet, doPost)
- **Google Sheets** — base de datos
- **HTML/CSS/JS vanilla** — frontend
- **Google Drive** — almacenamiento de archivos (PDFs, fotos)
- **Google OAuth** — autenticación con cuentas del dominio CDS

---

## 3. Roles y permisos

| Rol | Acceso |
|-----|--------|
| Cajera | Solo app de cierre de caja |
| Revisora | Vista de revisión + form de revisora |
| Admin (Mario) | Todo lo anterior + reportes + resumen depósito |

---

## 4. Estructura del Google Sheet

El Sheet se llama "Sistema de Caja — Corral del Sol" y tiene estas pestañas:

- **Respuestas Cajeras** — recibe datos del form de cajeras
- **Respuestas Revisora** — recibe datos del form de revisora
- **Vista Revisora** — fórmulas que comparan ambas fuentes
- **Resumen 5 Días** — para preparar depósitos bancarios

### Columnas de Respuestas Cajeras:
FECHA/HORA, CAJERA, CAJA, TC, ₡20000, ₡10000, ₡5000, ₡2000, ₡1000, ₡500, ₡100, ₡50, ₡25, ₡10, ₡5, QUEDA_₡20000, QUEDA_₡10000, QUEDA_₡5000, QUEDA_₡2000, QUEDA_₡1000, QUEDA_₡500, QUEDA_₡100, QUEDA_₡50, QUEDA_₡25, QUEDA_₡10, QUEDA_₡5, DOLARES_TOTAL, TARJETA_BAC, TARJETA_BN, SINPE_JSON, DEPOSITOS_JSON, SALIDAS_JSON, GLORY_JSON, QVET_PDF_URL, FOTOS_SINPE_URLS

### Columnas de Respuestas Revisora:
FECHA/HORA, REVISORA, CAJA_REVISADA, FECHA_CIERRE_REVISADO, EFECTIVO_CONTADO, TARJETA_VERIFICADA, SINPE_VERIFICADO, ESTADO, OBSERVACIONES

---

## 5. Lógica de negocio del cierre de caja

### Denominaciones costarricenses:
₡20.000, ₡10.000, ₡5.000, ₡2.000, ₡1.000, ₡500, ₡100, ₡50, ₡25, ₡10, ₡5

### Fórmula del sobre:
```
Total cierre (suma denominaciones × cantidades)
- Total queda en caja (siempre debe ser ~₡50,000)
= Colones al sobre (lo que va al depósito)
```

### Secciones del form de cajeras:
1. Info general: cajera (Kristel/María/Jenashy/Andrea/Otro), caja (Caja 1/Caja 2), fecha, TC
2. Cierre de caja: 11 denominaciones con cantidad → total automático
3. Queda en caja: mismas 11 denominaciones → total automático + muestra "Colones al sobre"
4. Dólares: total en $ con conversión automática según TC
5. Tarjetas: BAC y BN por separado
6. SINPE: múltiples entradas (monto + foto cada una)
7. Depósitos: múltiples (nombre + monto + foto comprobante)
8. Salidas de caja: múltiples (descripción + monto)
9. Glory (groomer): múltiples transacciones (método de pago + monto)
10. Cierre QVet: PDF obligatorio

### Glory:
Es la groomer del negocio. Registra todas sus transacciones por método de pago (Efectivo, Tarjeta BAC, Tarjeta BN, SINPE, Transferencia).

### Proceso de revisión:
1. Cajera llena el form y queda bloqueado
2. Revisora ve los datos, cuenta físicamente el efectivo y bouchers
3. Revisora llena su form con su conteo + la fecha del cierre que está revisando
4. El Sheet compara automáticamente y muestra diferencias en verde (cuadra) o rojo (diferencia)
5. Cada 5 días se hace resumen para depósito bancario con comprobante obligatorio

---

## 6. Diseño visual de la app de cajeras

### Paleta de colores:
```css
--bg: #F7F5F0
--surface: #FFFFFF
--surface2: #F0EDE6
--border: #E2DDD4
--text: #1A1714
--text2: #6B6560
--accent: #1A5C3A (verde oscuro principal)
--accent-light: #E8F3EC
--accent2: #C8A84B (dorado para el sobre)
--accent2-light: #FBF6E9
--danger: #C0392B
--danger-light: #FDEDEC
```

### Tipografía:
- DM Sans para texto general
- DM Mono para números y montos

### Elementos clave del diseño:
- Header sticky verde oscuro con badge dorado que muestra "Sobre: ₡X" en tiempo real
- Barra de progreso en el header
- Secciones con número circular verde
- Denominaciones en tabla con total calculado en tiempo real
- Caja verde especial para "Colones al sobre" que se actualiza al escribir
- Tarjetas tipo card para BAC y BN
- Filas dinámicas para SINPE, depósitos, salidas y Glory (agregar/eliminar)
- Áreas de upload con drag & drop visual
- Botón submit verde que valida cajera, caja, fecha y PDF QVet obligatorio

---

## 7. HTML completo de la app de cajeras

IMPORTANTE: Usar EXACTAMENTE este diseño. No cambiarlo. Solo agregar la integración con Apps Script.

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cierre de Caja — Corral del Sol</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #F7F5F0;
    --surface: #FFFFFF;
    --surface2: #F0EDE6;
    --border: #E2DDD4;
    --text: #1A1714;
    --text2: #6B6560;
    --text3: #9C9590;
    --accent: #1A5C3A;
    --accent-light: #E8F3EC;
    --accent2: #C8A84B;
    --accent2-light: #FBF6E9;
    --danger: #C0392B;
    --danger-light: #FDEDEC;
    --radius: 12px;
    --radius-sm: 8px;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; padding-bottom: 60px; }
  .header { background: var(--accent); color: white; padding: 20px 24px 16px; position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 12px rgba(26,92,58,0.2); }
  .header-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
  .header h1 { font-size: 18px; font-weight: 600; letter-spacing: -0.3px; }
  .header-sub { font-size: 12px; opacity: 0.7; font-family: 'DM Mono', monospace; }
  .sobre-badge { background: var(--accent2); color: #1A1714; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; font-family: 'DM Mono', monospace; white-space: nowrap; transition: all 0.3s ease; }
  .progress-bar { height: 3px; background: rgba(255,255,255,0.2); margin-top: 12px; border-radius: 2px; overflow: hidden; }
  .progress-fill { height: 100%; background: var(--accent2); border-radius: 2px; transition: width 0.4s ease; width: 0%; }
  .main { max-width: 720px; margin: 0 auto; padding: 24px 16px; }
  .section { background: var(--surface); border-radius: var(--radius); border: 1px solid var(--border); margin-bottom: 16px; overflow: hidden; }
  .section-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; background: var(--surface2); }
  .section-num { width: 26px; height: 26px; background: var(--accent); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0; }
  .section-title { font-size: 14px; font-weight: 600; color: var(--text); letter-spacing: -0.2px; }
  .section-body { padding: 20px; }
  .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .field { display: flex; flex-direction: column; gap: 5px; }
  label { font-size: 11px; font-weight: 600; color: var(--text2); text-transform: uppercase; letter-spacing: 0.5px; }
  input, select { width: 100%; padding: 10px 12px; border: 1.5px solid var(--border); border-radius: var(--radius-sm); font-family: 'DM Sans', sans-serif; font-size: 14px; color: var(--text); background: var(--surface); transition: border-color 0.2s; appearance: none; }
  input:focus, select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }
  input[type="number"] { font-family: 'DM Mono', monospace; }
  .denom-row { display: grid; grid-template-columns: 100px 1fr 110px; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--border); }
  .denom-row:last-child { border-bottom: none; }
  .denom-label { font-family: 'DM Mono', monospace; font-size: 13px; color: var(--text2); font-weight: 500; }
  .denom-input { padding: 8px 10px; text-align: center; font-size: 15px; font-weight: 500; }
  .denom-total { font-family: 'DM Mono', monospace; font-size: 13px; color: var(--accent); font-weight: 600; text-align: right; }
  .total-box { margin-top: 14px; padding: 14px 16px; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center; }
  .total-box.green { background: var(--accent-light); }
  .total-box.yellow { background: var(--accent2-light); }
  .total-box.red { background: var(--danger-light); }
  .total-label { font-size: 12px; font-weight: 600; color: var(--text2); text-transform: uppercase; letter-spacing: 0.4px; }
  .total-value { font-family: 'DM Mono', monospace; font-size: 18px; font-weight: 600; color: var(--text); }
  .total-value.accent { color: var(--accent); }
  .total-value.accent2 { color: var(--accent2); }
  .total-value.danger { color: var(--danger); }
  .sobre-box { background: var(--accent); color: white; padding: 16px 20px; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
  .sobre-box .total-label { color: rgba(255,255,255,0.7); }
  .sobre-box .total-value { color: white; font-size: 22px; }
  .tarjeta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .tarjeta-card { border: 1.5px solid var(--border); border-radius: var(--radius-sm); padding: 14px; }
  .tarjeta-name { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text2); margin-bottom: 8px; }
  .tarjeta-card input { border: none; padding: 0; font-size: 20px; font-weight: 600; font-family: 'DM Mono', monospace; color: var(--text); }
  .tarjeta-card input:focus { box-shadow: none; border: none; }
  .tarjeta-prefix { font-size: 12px; color: var(--text3); margin-top: 2px; }
  .repeat-list { display: flex; flex-direction: column; gap: 10px; }
  .repeat-row { display: grid; gap: 8px; align-items: start; background: var(--surface2); border-radius: var(--radius-sm); padding: 12px; position: relative; }
  .repeat-row-sinpe { grid-template-columns: 1fr 1fr auto; }
  .repeat-row-deposito { grid-template-columns: 1fr 1fr 1fr auto; }
  .repeat-row-salida { grid-template-columns: 2fr 1fr auto; }
  .repeat-row-glory { grid-template-columns: 1fr 1fr auto; }
  .btn-remove { width: 28px; height: 28px; background: var(--danger-light); border: none; border-radius: 6px; color: var(--danger); cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background 0.15s; align-self: flex-end; margin-bottom: 2px; }
  .btn-remove:hover { background: #f5c6c2; }
  .btn-add { display: flex; align-items: center; gap: 6px; padding: 9px 14px; background: var(--surface2); border: 1.5px dashed var(--border); border-radius: var(--radius-sm); color: var(--text2); font-size: 13px; font-weight: 500; cursor: pointer; width: 100%; margin-top: 8px; transition: all 0.15s; font-family: 'DM Sans', sans-serif; }
  .btn-add:hover { background: var(--accent-light); border-color: var(--accent); color: var(--accent); }
  .upload-area { border: 2px dashed var(--border); border-radius: var(--radius-sm); padding: 20px; text-align: center; cursor: pointer; transition: all 0.2s; background: var(--surface2); display: block; }
  .upload-area:hover { border-color: var(--accent); background: var(--accent-light); }
  .upload-area input[type="file"] { display: none; }
  .upload-icon { font-size: 28px; margin-bottom: 6px; }
  .upload-text { font-size: 13px; color: var(--text2); font-weight: 500; }
  .upload-sub { font-size: 11px; color: var(--text3); margin-top: 2px; }
  .file-list { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
  .file-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--accent-light); border-radius: 6px; font-size: 12px; color: var(--accent); font-weight: 500; }
  .btn-submit { width: 100%; padding: 16px; background: var(--accent); color: white; border: none; border-radius: var(--radius); font-family: 'DM Sans', sans-serif; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s; letter-spacing: -0.2px; }
  .btn-submit:hover { background: #145030; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(26,92,58,0.3); }
  .btn-submit:disabled { background: var(--text3); cursor: not-allowed; transform: none; box-shadow: none; }
  .submit-note { text-align: center; font-size: 12px; color: var(--text3); margin-top: 10px; }
  .dolares-row { display: grid; grid-template-columns: 1fr 80px 1fr; gap: 12px; align-items: end; }
  .tc-result { padding: 10px 12px; background: var(--accent-light); border-radius: var(--radius-sm); font-family: 'DM Mono', monospace; font-size: 13px; color: var(--accent); font-weight: 600; }
</style>
</head>
<body>
<div class="header">
  <div class="header-top">
    <div>
      <h1>🐾 Corral del Sol</h1>
      <div class="header-sub">Cierre de Caja</div>
    </div>
    <div class="sobre-badge" id="sobre-badge">Sobre: ₡0</div>
  </div>
  <div class="progress-bar"><div class="progress-fill" id="progress"></div></div>
</div>
<div class="main">
  <div class="section">
    <div class="section-header"><div class="section-num">1</div><div class="section-title">Información general</div></div>
    <div class="section-body">
      <div class="field-grid">
        <div class="field"><label>Cajera</label><select id="cajera" onchange="updateProgress()"><option value="">Seleccionar...</option><option>Kristel</option><option>María</option><option>Jenashy</option><option>Andrea</option><option>Otro</option></select></div>
        <div class="field"><label>Caja</label><select id="caja" onchange="updateProgress()"><option value="">Seleccionar...</option><option>Caja 1</option><option>Caja 2</option></select></div>
        <div class="field"><label>Fecha</label><input type="date" id="fecha" onchange="updateProgress()"></div>
        <div class="field"><label>Tipo de cambio (TC)</label><input type="number" id="tc" value="475" oninput="calcDolares()"></div>
      </div>
    </div>
  </div>
  <div class="section">
    <div class="section-header"><div class="section-num">2</div><div class="section-title">Cierre de caja — denominaciones</div></div>
    <div class="section-body">
      <div id="cierre-table"></div>
      <div class="total-box green"><span class="total-label">Total en caja</span><span class="total-value accent" id="total-cierre">₡0</span></div>
    </div>
  </div>
  <div class="section">
    <div class="section-header"><div class="section-num">3</div><div class="section-title">Queda en caja — denominaciones</div></div>
    <div class="section-body">
      <div id="queda-table"></div>
      <div class="total-box yellow"><span class="total-label">Total queda en caja</span><span class="total-value accent2" id="total-queda">₡0</span></div>
      <div class="sobre-box"><span class="total-label">💰 Colones al sobre</span><span class="total-value" id="total-sobre">₡0</span></div>
    </div>
  </div>
  <div class="section">
    <div class="section-header"><div class="section-num">4</div><div class="section-title">Dólares</div></div>
    <div class="section-body">
      <div class="dolares-row">
        <div class="field"><label>Total dólares ($)</label><input type="number" id="dolares" placeholder="0.00" step="0.01" oninput="calcDolares()"></div>
        <div class="field"><label>TC</label><div class="tc-result" id="tc-display">×475</div></div>
        <div class="field"><label>Equivalente en colones</label><div class="tc-result" id="dolares-colones">₡0</div></div>
      </div>
    </div>
  </div>
  <div class="section">
    <div class="section-header"><div class="section-num">5</div><div class="section-title">Tarjetas</div></div>
    <div class="section-body">
      <div class="tarjeta-grid">
        <div class="tarjeta-card"><div class="tarjeta-name">BAC</div><input type="number" id="tarjeta-bac" placeholder="0" oninput="calcTarjetas()"><div class="tarjeta-prefix">colones</div></div>
        <div class="tarjeta-card"><div class="tarjeta-name">BN</div><input type="number" id="tarjeta-bn" placeholder="0" oninput="calcTarjetas()"><div class="tarjeta-prefix">colones</div></div>
      </div>
      <div class="total-box green" style="margin-top:12px"><span class="total-label">Total tarjetas</span><span class="total-value accent" id="total-tarjetas">₡0</span></div>
    </div>
  </div>
  <div class="section">
    <div class="section-header"><div class="section-num">6</div><div class="section-title">SINPE Móvil</div></div>
    <div class="section-body">
      <div class="repeat-list" id="sinpe-list"></div>
      <button class="btn-add" onclick="addSinpe()">+ Agregar SINPE</button>
      <div class="total-box green" style="margin-top:12px"><span class="total-label">Total SINPE</span><span class="total-value accent" id="total-sinpe">₡0</span></div>
    </div>
  </div>
  <div class="section">
    <div class="section-header"><div class="section-num">7</div><div class="section-title">Depósitos</div></div>
    <div class="section-body">
      <div class="repeat-list" id="deposito-list"></div>
      <button class="btn-add" onclick="addDeposito()">+ Agregar depósito</button>
    </div>
  </div>
  <div class="section">
    <div class="section-header"><div class="section-num">8</div><div class="section-title">Salidas de caja</div></div>
    <div class="section-body">
      <div class="repeat-list" id="salida-list"></div>
      <button class="btn-add" onclick="addSalida()">+ Agregar salida</button>
      <div class="total-box red" style="margin-top:12px"><span class="total-label">Total salidas</span><span class="total-value danger" id="total-salidas">₡0</span></div>
    </div>
  </div>
  <div class="section">
    <div class="section-header"><div class="section-num">9</div><div class="section-title">Glory — Groomer</div></div>
    <div class="section-body">
      <div class="repeat-list" id="glory-list"></div>
      <button class="btn-add" onclick="addGlory()">+ Agregar transacción Glory</button>
      <div class="total-box green" style="margin-top:12px"><span class="total-label">Total Glory</span><span class="total-value accent" id="total-glory">₡0</span></div>
    </div>
  </div>
  <div class="section">
    <div class="section-header"><div class="section-num">10</div><div class="section-title">Cierre QVet</div></div>
    <div class="section-body">
      <label class="upload-area" for="qvet-upload">
        <input type="file" id="qvet-upload" accept=".pdf" onchange="showFiles(this,'qvet-files')">
        <div class="upload-icon">📄</div>
        <div class="upload-text">Subir cierre QVet (PDF)</div>
        <div class="upload-sub">Obligatorio</div>
      </label>
      <div class="file-list" id="qvet-files"></div>
    </div>
  </div>
  <div style="padding: 8px 0 24px;">
    <button class="btn-submit" id="btn-submit" onclick="submitForm()">Enviar cierre de caja</button>
    <div class="submit-note">Una vez enviado no se puede modificar</div>
  </div>
</div>
<script>
const DENOMS = [20000,10000,5000,2000,1000,500,100,50,25,10,5];
const fmt = n => '₡' + Math.round(n).toLocaleString('es-CR');
function buildDenomTable(containerId, prefix) {
  const container = document.getElementById(containerId);
  DENOMS.forEach(d => {
    const row = document.createElement('div');
    row.className = 'denom-row';
    row.innerHTML = `<div class="denom-label">${fmt(d)}</div><input type="number" class="denom-input" id="${prefix}-${d}" placeholder="0" min="0" oninput="calcDenoms()"><div class="denom-total" id="${prefix}-total-${d}">₡0</div>`;
    container.appendChild(row);
  });
}
buildDenomTable('cierre-table', 'c');
buildDenomTable('queda-table', 'q');
function calcDenoms() {
  let totalC = 0, totalQ = 0;
  DENOMS.forEach(d => {
    const vc = parseInt(document.getElementById(`c-${d}`).value)||0;
    const vq = parseInt(document.getElementById(`q-${d}`).value)||0;
    const tc = vc*d, tq = vq*d;
    document.getElementById(`c-total-${d}`).textContent = tc > 0 ? fmt(tc) : '—';
    document.getElementById(`q-total-${d}`).textContent = tq > 0 ? fmt(tq) : '—';
    totalC += tc; totalQ += tq;
  });
  document.getElementById('total-cierre').textContent = fmt(totalC);
  document.getElementById('total-queda').textContent = fmt(totalQ);
  const sobre = totalC - totalQ;
  document.getElementById('total-sobre').textContent = fmt(sobre);
  document.getElementById('sobre-badge').textContent = 'Sobre: ' + fmt(sobre);
  updateProgress();
}
function calcDolares() {
  const tc = parseFloat(document.getElementById('tc').value)||475;
  const dol = parseFloat(document.getElementById('dolares').value)||0;
  document.getElementById('tc-display').textContent = '×'+tc;
  document.getElementById('dolares-colones').textContent = fmt(dol*tc);
}
function calcTarjetas() {
  const bac = parseFloat(document.getElementById('tarjeta-bac').value)||0;
  const bn = parseFloat(document.getElementById('tarjeta-bn').value)||0;
  document.getElementById('total-tarjetas').textContent = fmt(bac+bn);
}
let sinpeCount=0, depCount=0, salidaCount=0, gloryCount=0;
function addSinpe() {
  sinpeCount++;
  const id = sinpeCount;
  const row = document.createElement('div');
  row.className = 'repeat-row repeat-row-sinpe';
  row.id = `sinpe-row-${id}`;
  row.innerHTML = `<div class="field"><label>Monto (₡)</label><input type="number" placeholder="0" oninput="calcSinpeTotal()"></div><div class="field"><label>Foto captura</label><input type="file" accept="image/*" style="padding:6px"></div><button class="btn-remove" onclick="removeRow('sinpe-row-${id}',calcSinpeTotal)">×</button>`;
  document.getElementById('sinpe-list').appendChild(row);
}
function calcSinpeTotal() {
  let total = 0;
  document.querySelectorAll('#sinpe-list input[type="number"]').forEach(i => total += parseFloat(i.value)||0);
  document.getElementById('total-sinpe').textContent = fmt(total);
}
function addDeposito() {
  depCount++;
  const id = depCount;
  const row = document.createElement('div');
  row.className = 'repeat-row repeat-row-deposito';
  row.id = `dep-row-${id}`;
  row.innerHTML = `<div class="field"><label>Nombre / origen</label><input type="text" placeholder="Ej: Jenashy Noguera"></div><div class="field"><label>Monto (₡)</label><input type="number" placeholder="0"></div><div class="field"><label>Foto comprobante</label><input type="file" accept="image/*,.pdf" style="padding:6px"></div><button class="btn-remove" onclick="removeRow('dep-row-${id}',()=>{})">×</button>`;
  document.getElementById('deposito-list').appendChild(row);
}
function addSalida() {
  salidaCount++;
  const id = salidaCount;
  const row = document.createElement('div');
  row.className = 'repeat-row repeat-row-salida';
  row.id = `sal-row-${id}`;
  row.innerHTML = `<div class="field"><label>Descripción</label><input type="text" placeholder="Ej: Compra de suministros"></div><div class="field"><label>Monto (₡)</label><input type="number" placeholder="0" oninput="calcSalidas()"></div><button class="btn-remove" onclick="removeRow('sal-row-${id}',calcSalidas)">×</button>`;
  document.getElementById('salida-list').appendChild(row);
}
function calcSalidas() {
  let total = 0;
  document.querySelectorAll('#salida-list input[type="number"]').forEach(i => total += parseFloat(i.value)||0);
  document.getElementById('total-salidas').textContent = fmt(total);
}
function addGlory() {
  gloryCount++;
  const id = gloryCount;
  const row = document.createElement('div');
  row.className = 'repeat-row repeat-row-glory';
  row.id = `glory-row-${id}`;
  row.innerHTML = `<div class="field"><label>Método de pago</label><select><option value="">Seleccionar...</option><option>Efectivo</option><option>Tarjeta BAC</option><option>Tarjeta BN</option><option>SINPE</option><option>Transferencia</option></select></div><div class="field"><label>Monto (₡)</label><input type="number" placeholder="0" oninput="calcGlory()"></div><button class="btn-remove" onclick="removeRow('glory-row-${id}',calcGlory)">×</button>`;
  document.getElementById('glory-list').appendChild(row);
}
function calcGlory() {
  let total = 0;
  document.querySelectorAll('#glory-list input[type="number"]').forEach(i => total += parseFloat(i.value)||0);
  document.getElementById('total-glory').textContent = fmt(total);
}
function removeRow(id, recalc) { document.getElementById(id).remove(); recalc(); }
function showFiles(input, listId) {
  const list = document.getElementById(listId);
  list.innerHTML = '';
  Array.from(input.files).forEach(f => { const item = document.createElement('div'); item.className = 'file-item'; item.innerHTML = `📎 ${f.name}`; list.appendChild(item); });
}
function updateProgress() {
  let filled = 0;
  if (document.getElementById('cajera').value) filled++;
  if (document.getElementById('caja').value) filled++;
  if (document.getElementById('fecha').value) filled++;
  const cierre = DENOMS.reduce((s,d) => s + (parseInt(document.getElementById(`c-${d}`).value)||0)*d, 0);
  if (cierre > 0) filled++;
  document.getElementById('progress').style.width = (filled/4*100)+'%';
}
document.getElementById('fecha').valueAsDate = new Date();
addSinpe(); addDeposito(); addSalida(); addGlory();
function submitForm() {
  const cajera = document.getElementById('cajera').value;
  const caja = document.getElementById('caja').value;
  const fecha = document.getElementById('fecha').value;
  const qvet = document.getElementById('qvet-upload').files.length;
  if (!cajera || !caja || !fecha) { alert('Por favor completá la información general.'); return; }
  if (!qvet) { alert('Por favor subí el PDF del cierre QVet.'); return; }
  // AQUI VA LA INTEGRACIÓN CON APPS SCRIPT
  // google.script.run.withSuccessHandler(onSuccess).submitCierre(getData());
}
</script>
</body>
</html>
```

---

## 8. Instrucciones para Claude Code

1. Crear proyecto de Google Apps Script con CLASP
2. Crear archivo `Index.html` con el HTML exacto de arriba
3. Crear `Code.gs` con funciones `doGet()`, `submitCierre()`, `submitRevision()`
4. La función `submitCierre()` escribe en la pestaña "Respuestas Cajeras" del Sheet
5. La función `submitRevision()` escribe en "Respuestas Revisora"
6. Publicar como Web App accesible solo para usuarios del dominio de CDS
7. NO cambiar el diseño visual bajo ninguna circunstancia

---

## 9. ID del Google Sheet

El Sheet ya existe. Cuando lo crees con el script, obtenés el ID de la URL:
`https://docs.google.com/spreadsheets/d/[ESTE_ES_EL_ID]/edit`

Reemplazá `SHEET_ID` en el código con ese ID real.
