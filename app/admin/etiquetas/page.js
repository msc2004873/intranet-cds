'use client';

import { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';

// ============================================================
// ETIQUETAS (2026-11-11: catálogo completo de QVet)
//
// Dos maneras de llenar la lista para imprimir, y las dos suman a la MISMA lista:
//   · Buscar en el catálogo: cualquier producto de QVet (copia de la noche, tabla
//     catalogo_etiquetas vía /api/etiquetas/catalogo). Sirve con la pistola: escanea y Enter.
//   · Subir el Excel de una factura de QVet (como antes).
// Cada producto lleva su cantidad de etiquetas. Lo que tenga 0 no se imprime.
// La lista se guarda en este navegador para que no se pierda si se recarga la página.
// ============================================================

// ============================================================
// CONSTANTES DE ETIQUETA — posicionamiento absoluto en mm/pt
// Fácil de calibrar: cada campo tiene top/left/right/fontSize
// ============================================================
// Coordenadas exactas de BarTender (mm/pt). offsetX compensa margen físico de impresora.
const TAMANOS = {
  pequena: {
    label:      'Pequeña (32 × 19 mm)',
    ancho:      32,
    alto:       19,
    offsetX:    2,
    nombre:     { top: 1.2, left: 1.0, width: 22,   fontSize: 5.5 },
    rightCol:   { top: 0.8, right: 0.4, width: 7.5,  logoH: 8,   gap: 0.8, codFontSize: 7   },
    precio:     { top: 9.0, left: 1.0,  width: 15,   fontSize: 8  },
    barcode:    { top: 13,  left: 1.5,  width: 28,   height: 6,    barWidth: 1.5, textSize: 11 },
  },
  grande: {
    label:      'Grande (50 × 26 mm)',
    ancho:      50,
    alto:       26,
    offsetX:    1.5,
    nombre:     { top: 1.0,  left: 1.0,  width: 29,  fontSize: 7.5 },
    logo:       { top: 1.0,  right: 1.0,  width: 16,  maxH: 11 },
    codInterno: { top: 13.0, right: 2.5,  width: 13,  fontSize: 6 },
    precio:     { top: 17.0, right: 1.0,  width: 17,  fontSize: 13 },
    barcode:    { top: 12.0, left: 1.0,   width: 28,  height: 11,  barWidth: 1.5 },
  },
};

const LISTA_GUARDADA = 'etiquetas.lista.v1';   // localStorage: la lista en curso de este navegador
const MUCHAS_ETIQUETAS = 300;                  // arriba de esto se pregunta antes de imprimir
const COPIA_VIEJA_HORAS = 36;                  // la copia de QVet se marca vieja después de esto

// ============================================================
// HELPERS
// ============================================================
function detectarFormato(codigo) {
  const c = String(codigo).replace(/\s/g, '');
  if (/^\d{13}$/.test(c)) return 'EAN13';
  if (/^\d{12}$/.test(c)) return 'UPC';
  if (/^\d{8}$/.test(c))  return 'EAN8';
  return 'CODE128';
}

function esCodValido(c) {
  return c && String(c).trim().length > 0;
}

function fmtPrecio(n) {
  return '₡' + Number(n).toLocaleString('es-CR');
}

function fmtCantidad(n) {
  if (n === null || n === undefined) return '';
  return Number(n).toLocaleString('es-CR', { maximumFractionDigits: 2 });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseNumero(str) {
  return parseFloat(String(str).replace(/[₡$\s]/g, '').replace(/,/g, '.')) || 0;
}

function parseCantidad(str) {
  const n = parseInt(String(str).replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? Math.min(n, 9999) : 0;
}

// Una sola clave por producto, venga del catálogo o del Excel: así no se duplica.
function claveDe({ codigoInterno, codigoBarras, nombre }) {
  if (esCodValido(codigoInterno)) return 'cod:' + String(codigoInterno).trim();
  if (esCodValido(codigoBarras))  return 'cb:' + String(codigoBarras).replace(/\s/g, '');
  return 'n:' + String(nombre).trim().toLowerCase();
}

function desdeCatalogo(p, cantidad) {
  const item = {
    nombre:        p.nombre,
    pvp:           Number(p.precio) || 0,
    codigoBarras:  p.codigo_barras || '',
    codigoInterno: String(p.codigo),
    cantidad,
    existencias:   p.existencias === null || p.existencias === undefined ? null : Number(p.existencias),
    origen:        'catalogo',
  };
  return { ...item, key: claveDe(item), sinCodigo: !esCodValido(item.codigoBarras) };
}

function fmtFechaHora(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' }) +
    ', ' + d.toLocaleTimeString('es-CR', { hour: 'numeric', minute: '2-digit' });
}

// fetch que no se deja engañar por una sesión vencida (ver CLAUDE.md, regla 8 y middleware).
async function pedirJSON(url) {
  const res = await fetch(url, { redirect: 'manual', credentials: 'same-origin' });
  if (res.type === 'opaqueredirect' || res.status === 401) {
    throw new Error('Tu sesión expiró. Volvé a iniciar sesión.');
  }
  const txt = await res.text();
  let json;
  try { json = JSON.parse(txt); } catch { throw new Error('El servidor no respondió bien. Probá de nuevo.'); }
  if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
  return json;
}

// ============================================================
// PARSEO DEL EXCEL (Productos en facturas ingresadas, de QVet)
// ============================================================
function parsearExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'array', raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });

  const mapa = new Map();

  for (const row of rows) {
    const g = (k) => {
      const found = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.toLowerCase());
      return found ? String(row[found]).trim() : '';
    };

    const nombre = g('concepto');
    if (!nombre) continue;

    const cantidad      = Math.max(1, parseInt(g('cantidad')) || 1);
    const pvp           = parseNumero(g('pvp'));
    const codigoBarras  = g('codigobarras');
    const codigoInterno = g('codigointerno');
    const key = claveDe({ codigoInterno, codigoBarras, nombre });

    if (mapa.has(key)) {
      mapa.get(key).cantidad += cantidad;
    } else {
      mapa.set(key, {
        key,
        nombre,
        cantidad,
        pvp,
        codigoBarras,
        codigoInterno,
        existencias: null,
        origen: 'factura',
        sinCodigo: !esCodValido(codigoBarras),
      });
    }
  }

  return Array.from(mapa.values());
}

// ============================================================
// IMPRESIÓN — layout absoluto, logo embedido como base64
// (no tocar las medidas: están calibradas con la térmica)
// ============================================================
async function fetchBase64(url) {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return new Promise(resolve => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
}

async function imprimir(lista, tamano) {
  const JsBarcode = (await import('jsbarcode')).default;
  const logoSrc   = await fetchBase64('/corral-del-sol-logo-negro.png');
  const c         = TAMANOS[tamano];
  const isGrande  = tamano === 'grande';

  const paginas = lista.flatMap(p =>
    Array.from({ length: Math.max(0, p.cantidad) }, () => p)
  );
  if (paginas.length === 0) return;

  // Grande muestra dígitos (más espacio), pequeña no (evita pixelación)
  const barcodeOpts = isGrande ? {
    displayValue: true,
    fontSize:     28,
    margin:       6,
    lineColor:    '#000',
    background:   '#fff',
    width:        4,
    height:       180,
  } : {
    displayValue: false,
    margin:       8,
    lineColor:    '#000',
    background:   '#fff',
    width:        4,
    height:       220,
  };

  // El código de barras se dibuja UNA vez por producto, no una vez por etiqueta.
  const pngPorProducto = new Map();
  const barcodeDe = (p) => {
    if (pngPorProducto.has(p.key)) return pngPorProducto.get(p.key);
    let barcodePng = '';
    if (esCodValido(p.codigoBarras)) {
      const codigo = String(p.codigoBarras).replace(/\s/g, '');
      const renderPng = (format) => {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, codigo, { ...barcodeOpts, format });
        return `<img src="${canvas.toDataURL('image/png')}" style="width:100%;height:100%;display:block;" />`;
      };
      try {
        barcodePng = renderPng(detectarFormato(codigo));
      } catch {
        try { barcodePng = renderPng('CODE128'); } catch {
          barcodePng = `<span style="font-size:6pt;color:#999;">${escapeHtml(codigo)}</span>`;
        }
      }
    } else {
      barcodePng = `<span style="font-size:6pt;color:#c00;">(sin código)</span>`;
    }
    pngPorProducto.set(p.key, barcodePng);
    return barcodePng;
  };

  const labelHtml = paginas.map((p, i) => {
    const barcodePng = barcodeDe(p);
    const isLast = i === paginas.length - 1;

    if (isGrande) {
      return `<div class="etiqueta${isLast ? ' last' : ''}">
  <div class="nombre">${escapeHtml(p.nombre)}</div>
  <img class="logo" src="${logoSrc}" alt="" />
  ${p.codigoInterno ? `<div class="cod-interno">${escapeHtml(p.codigoInterno)}</div>` : ''}
  <div class="precio">${fmtPrecio(p.pvp)}</div>
  <div class="barcode">${barcodePng}</div>
</div>`;
    }
    return `<div class="etiqueta${isLast ? ' last' : ''}">
  <div class="nombre">${escapeHtml(p.nombre)}</div>
  <div class="right-col">
    <img class="logo" src="${logoSrc}" alt="" />
    ${p.codigoInterno ? `<div class="cod-interno">${escapeHtml(p.codigoInterno)}</div>` : ''}
  </div>
  <div class="precio">${fmtPrecio(p.pvp)}</div>
  <div class="barcode">${barcodePng}</div>
</div>`;
  }).join('\n');

  const layoutCSS = isGrande ? `
  .nombre {
    position: absolute;
    top: ${c.nombre.top}mm; left: ${c.nombre.left}mm; width: ${c.nombre.width}mm;
    font-family: Arial, sans-serif; font-size: ${c.nombre.fontSize}pt; font-weight: bold;
    line-height: 1.25; word-wrap: break-word; overflow-wrap: break-word;
    border: 1.5pt solid #82C4E8; border-radius: 2mm; padding: 1.2mm 1.5mm;
  }
  .logo {
    position: absolute;
    top: ${c.logo.top}mm; right: ${c.logo.right}mm; width: ${c.logo.width}mm;
    max-height: ${c.logo.maxH}mm; object-fit: contain;
  }
  .cod-interno {
    position: absolute;
    top: ${c.codInterno.top}mm; right: ${c.codInterno.right}mm; width: ${c.codInterno.width}mm;
    font-family: Arial, sans-serif; font-size: ${c.codInterno.fontSize}pt; font-weight: bold;
    text-align: center; border: 1.5pt solid #000; border-radius: 8mm;
    padding: 0.4mm 2mm; white-space: nowrap;
  }
  .precio {
    position: absolute;
    top: ${c.precio.top}mm; right: ${c.precio.right}mm; width: ${c.precio.width}mm;
    font-family: Arial, sans-serif; font-size: ${c.precio.fontSize}pt; font-weight: bold;
    text-align: right;
  }` : `
  .nombre {
    position: absolute;
    top: ${c.nombre.top}mm; left: ${c.nombre.left}mm; width: ${c.nombre.width}mm;
    font-family: Arial, sans-serif; font-size: ${c.nombre.fontSize}pt; font-weight: bold;
    line-height: 1.2; word-wrap: break-word; overflow-wrap: break-word;
  }
  .right-col {
    position: absolute;
    top: ${c.rightCol.top}mm; right: ${c.rightCol.right}mm; width: ${c.rightCol.width}mm;
    display: flex; flex-direction: column; align-items: center; gap: ${c.rightCol.gap}mm;
  }
  .logo { width: 100%; max-height: ${c.rightCol.logoH}mm; object-fit: contain; }
  .cod-interno {
    font-family: Arial, sans-serif; font-size: ${c.rightCol.codFontSize}pt;
    font-weight: bold; text-align: center; white-space: nowrap;
  }
  .precio {
    position: absolute;
    top: ${c.precio.top}mm; left: ${c.precio.left}mm; width: ${c.precio.width}mm;
    font-family: Arial, sans-serif; font-size: ${c.precio.fontSize}pt; font-weight: bold;
  }`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page { size: ${c.ancho}mm ${c.alto}mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${c.ancho}mm; background: #fff; }
  .etiqueta {
    position: relative; width: ${c.ancho}mm; height: ${c.alto}mm;
    overflow: hidden; transform: translateX(${c.offsetX}mm);
    page-break-after: always; break-after: page;
  }
  .etiqueta.last { page-break-after: avoid; break-after: avoid; }
  ${layoutCSS}
  .barcode {
    position: absolute;
    top: ${c.barcode.top}mm; left: ${c.barcode.left}mm;
    width: ${c.barcode.width}mm; height: ${c.barcode.height}mm;
  }
  .barcode img { width: 100%; height: 100%; display: block; }
</style>
</head>
<body>${labelHtml}</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:0;height:0;border:0;';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  iframe.contentWindow.onafterprint = () => document.body.removeChild(iframe);
  setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); }, 400);
}

// ============================================================
// ESTILOS (paleta de la intranet)
// ============================================================
const AZUL = '#2a78a5';
const card = { background: '#fff', borderRadius: '12px', border: '1.5px solid #E2DDD4', marginBottom: '16px' };
const th   = { padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #E2DDD4', fontWeight: '600', fontSize: '12px', color: '#6B6560', background: '#F7F5F0', whiteSpace: 'nowrap' };
const td   = { padding: '9px 12px', borderBottom: '1px solid #F0EDE6', verticalAlign: 'middle', fontSize: '13px' };
const inp  = { border: '1.5px solid #E2DDD4', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', width: '100%', background: '#fff', outline: 'none', boxSizing: 'border-box' };
const btnPrimary = { background: AZUL, color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 24px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' };
const btnSec = { background: '#F0EDE6', color: '#1A1714', border: '1px solid #E2DDD4', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' };
const btnXS  = { background: '#F0EDE6', color: '#1A1714', border: '1px solid #E2DDD4', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' };
const chip = (bg, color) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: bg, color, whiteSpace: 'nowrap' });
const mono = { fontFamily: "'DM Mono', ui-monospace, monospace" };

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function EtiquetasPage() {
  const router = useRouter();
  const [userRole, setUserRole]   = useState('');
  const [modo, setModo]           = useState('buscar');          // 'buscar' | 'factura'

  // la lista para imprimir
  const [lista, setLista]         = useState([]);
  const [listaLista, setListaLista] = useState(false);          // ya se leyó lo guardado
  const [filtroLista, setFiltroLista] = useState('');
  const [editando, setEditando]   = useState(null);
  const [editValues, setEditValues] = useState({});
  const [recien, setRecien]       = useState(null);              // último agregado (se resalta)

  // el buscador
  const [texto, setTexto]         = useState('');
  const [resultado, setResultado] = useState(null);              // { q, productos, total, hayMas, exactos }
  const [buscando, setBuscando]   = useState(false);
  const [estadoCatalogo, setEstadoCatalogo] = useState(undefined); // undefined = cargando, null = vacío
  const [cantAgregar, setCantAgregar] = useState({});            // codigo → cuántas agregar

  // impresión y avisos
  const [imprimiendo, setImprimiendo] = useState(false);
  const [showModalTamano, setShowModalTamano] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError]         = useState('');
  const [aviso, setAviso]         = useState(null);              // { msg, type }

  const fileInputRef = useRef();
  const buscadorRef  = useRef();
  const textoActual  = useRef('');
  const avisoTimer   = useRef();
  const recienTimer  = useRef();

  // ── Sesión ────────────────────────────────────────────────
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) { router.push('/login'); return; }
    const user = JSON.parse(userData);
    setUserRole(user.rol || '');
    if (user.rol !== 'admin') router.push('/');
  }, [router]);

  // ── La lista guardada en este navegador ───────────────────
  useEffect(() => {
    try {
      const guardada = JSON.parse(localStorage.getItem(LISTA_GUARDADA) || '[]');
      if (Array.isArray(guardada)) setLista(guardada.filter(p => p && p.key && p.nombre));
    } catch { /* sin almacenamiento: se arranca vacío */ }
    setListaLista(true);
  }, []);

  useEffect(() => {
    if (!listaLista) return;
    try { localStorage.setItem(LISTA_GUARDADA, JSON.stringify(lista)); } catch { /* no pasa nada */ }
  }, [lista, listaLista]);

  // ── Estado del catálogo (de cuándo es la copia) ───────────
  useEffect(() => {
    if (userRole !== 'admin') return;
    pedirJSON('/api/etiquetas/catalogo')
      .then(r => setEstadoCatalogo(r.estado || null))
      .catch(e => { setEstadoCatalogo(null); setError('No se pudo leer el catálogo: ' + e.message); });
  }, [userRole]);

  // ── Búsqueda mientras se escribe ──────────────────────────
  async function buscar(q) {
    setBuscando(true);
    try {
      const r = await pedirJSON('/api/etiquetas/catalogo?q=' + encodeURIComponent(q));
      if (r.estado !== undefined) setEstadoCatalogo(r.estado || null);
      const res = { q, productos: r.productos || [], total: r.total || 0, hayMas: !!r.hayMas, exactos: r.exactos || [] };
      if (textoActual.current.trim() === q) setResultado(res);   // si ya escribió otra cosa, se ignora
      return res;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBuscando(false);
    }
  }

  useEffect(() => {
    textoActual.current = texto;
    const q = texto.trim();
    if (q.length < 2) { setResultado(null); return; }
    const t = setTimeout(() => buscar(q), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  if (!userRole) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando...</div>;
  if (userRole !== 'admin') return null;

  // ── Cálculos ──────────────────────────────────────────────
  const totalEtiquetas = lista.reduce((s, p) => s + Math.max(0, p.cantidad || 0), 0);
  const productosConEtiquetas = lista.filter(p => p.cantidad > 0).length;
  const sinCodigo = lista.filter(p => p.cantidad > 0 && p.sinCodigo).length;
  const enLista = new Map(lista.map(p => [p.key, p.cantidad]));

  const f = filtroLista.trim().toLowerCase();
  const listaVisible = !f ? lista : lista.filter(p =>
    p.nombre.toLowerCase().includes(f) ||
    (p.codigoBarras && p.codigoBarras.includes(f)) ||
    (p.codigoInterno && String(p.codigoInterno).includes(f))
  );

  const horasCopia = estadoCatalogo?.copia_de ? (Date.now() - new Date(estadoCatalogo.copia_de)) / 36e5 : null;
  const copiaVieja = horasCopia !== null && horasCopia > COPIA_VIEJA_HORAS;

  // ── Avisos ────────────────────────────────────────────────
  function mostrarAviso(msg, type = 'ok') {
    clearTimeout(avisoTimer.current);
    setAviso({ msg, type });
    avisoTimer.current = setTimeout(() => setAviso(null), 3000);
  }

  function resaltar(key) {
    clearTimeout(recienTimer.current);
    setRecien(key);
    recienTimer.current = setTimeout(() => setRecien(null), 1800);
  }

  // ── Agregar a la lista ────────────────────────────────────
  function agregar(p, cantidad = 1) {
    const nuevo = desdeCatalogo(p, cantidad);
    const total = (lista.find(x => x.key === nuevo.key)?.cantidad || 0) + cantidad;   // solo para el aviso
    setLista(prev => {
      const i = prev.findIndex(x => x.key === nuevo.key);
      if (i >= 0) {
        const copia = [...prev];
        const suma = copia[i].cantidad + cantidad;
        // se refresca precio/existencias con lo del catálogo, salvo que alguien lo haya editado
        copia[i] = copia[i].editado
          ? { ...copia[i], cantidad: suma }
          : { ...nuevo, cantidad: suma };
        return copia;
      }
      return [nuevo, ...prev];
    });
    resaltar(nuevo.key);
    setCantAgregar(c => { const n = { ...c }; delete n[p.codigo]; return n; });
    mostrarAviso(`✓ ${p.nombre} · ${total} etiqueta${total !== 1 ? 's' : ''}`);
  }

  // Enter en el buscador (o la pistola, que escribe el código y manda Enter).
  async function enterEnBuscador() {
    const q = texto.trim();
    if (!q) return;
    const listo = resultado && resultado.q === q ? resultado : null;
    // Un código escaneado: la caja se vacía YA, para que el siguiente escaneo no se mezcle con
    // este mientras se busca (con internet lento, la pistola es más rápida que la respuesta).
    const pareceCodigo = /^\d{4,}$/.test(q);
    if (!listo && pareceCodigo) setTexto('');
    const r = listo || await buscar(q);
    if (!r) { if (pareceCodigo && !textoActual.current) setTexto(q); return; }
    const exactos = r.productos.filter(p => r.exactos.includes(p.codigo));
    const elegido = exactos.length === 1 ? exactos[0]
      : (exactos.length === 0 && r.productos.length === 1 ? r.productos[0] : null);
    if (elegido) {
      agregar(elegido, 1);
      if (textoActual.current.trim() === q) { setTexto(''); setResultado(null); }
      buscadorRef.current?.focus();
      return;
    }
    // No se agregó: se vuelve a mostrar lo escaneado para que se vea qué pasó.
    if (pareceCodigo && !textoActual.current) setTexto(q);
    if (exactos.length > 1) {
      mostrarAviso('Ese código lo tienen varios productos: escogé cuál abajo.', 'info');
    } else if (r.productos.length === 0) {
      mostrarAviso('No hay ningún producto con eso.', 'info');
    }
  }

  // ── Excel de factura ──────────────────────────────────────
  function cargarArchivo(file) {
    if (!file) return;
    setError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parsearExcel(new Uint8Array(e.target.result));
        if (parsed.length === 0) {
          setError('No se encontraron productos. Verificá columnas: CONCEPTO, CANTIDAD, PVP, codigobarras, codigointerno.');
          return;
        }
        setLista(prev => {
          const copia = [...prev];
          for (const p of parsed) {
            const i = copia.findIndex(x => x.key === p.key);
            if (i >= 0) copia[i] = { ...copia[i], cantidad: copia[i].cantidad + p.cantidad };
            else copia.push(p);
          }
          return copia;
        });
        mostrarAviso(`✓ ${parsed.length} productos de la factura agregados a la lista`);
      } catch (err) {
        setError('Error al leer el archivo: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function onDrop(e) {
    e.preventDefault();
    setArrastrando(false);
    cargarArchivo(e.dataTransfer.files[0]);
  }

  // ── Editar la lista ───────────────────────────────────────
  function ponerCantidad(key, cantidad) {
    setLista(prev => prev.map(p => (p.key === key ? { ...p, cantidad: Math.max(0, Math.min(9999, cantidad)) } : p)));
  }

  function quitar(key) {
    setLista(prev => prev.filter(p => p.key !== key));
    if (editando === key) setEditando(null);
  }

  function vaciar() {
    if (!lista.length) return;
    if (!window.confirm(`¿Vaciar la lista? Se quitan los ${lista.length} productos.`)) return;
    setLista([]);
    setEditando(null);
    setFiltroLista('');
  }

  function iniciarEdicion(p) {
    setEditando(p.key);
    setEditValues({
      nombre:        p.nombre,
      pvp:           p.pvp,
      codigoBarras:  p.codigoBarras,
      codigoInterno: p.codigoInterno,
    });
  }

  function guardarEdicion(key) {
    setLista(prev => prev.map(p => {
      if (p.key !== key) return p;
      const cb = String(editValues.codigoBarras || '').trim();
      return {
        ...p,
        nombre:        String(editValues.nombre || '').trim() || p.nombre,
        pvp:           parseNumero(editValues.pvp),
        codigoBarras:  cb,
        codigoInterno: String(editValues.codigoInterno || '').trim(),
        sinCodigo:     !esCodValido(cb),
        editado:       true,
      };
    }));
    setEditando(null);
  }

  // Enter/↓ = siguiente cantidad, ↑ = anterior (regla 4 de la intranet).
  function navegarCantidad(e, idx) {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      document.querySelector(`[data-cant="${idx + 1}"]`)?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      document.querySelector(`[data-cant="${idx - 1}"]`)?.focus();
    }
  }

  // ── Imprimir ──────────────────────────────────────────────
  function handleImprimir() {
    if (totalEtiquetas === 0) { setError('Poné al menos una etiqueta.'); return; }
    if (totalEtiquetas > MUCHAS_ETIQUETAS &&
        !window.confirm(`Son ${totalEtiquetas.toLocaleString('es-CR')} etiquetas. ¿Seguro que querés imprimir todas?`)) return;
    setShowModalTamano(true);
  }

  async function handleImprimirConTamano(t) {
    setShowModalTamano(false);
    setImprimiendo(true);
    setError('');
    try {
      await imprimir(lista.filter(p => p.cantidad > 0), t);
    } catch (e) {
      setError('Error al imprimir: ' + e.message);
    } finally {
      setImprimiendo(false);
    }
  }

  // ── Piezas de la pantalla ─────────────────────────────────
  const pestana = (id, icono, titulo) => (
    <button
      onClick={() => { setModo(id); if (id === 'buscar') setTimeout(() => buscadorRef.current?.focus(), 0); }}
      style={{
        flex: 1, padding: '12px 16px', border: 'none', cursor: 'pointer', borderRadius: '9px',
        fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        background: modo === id ? '#fff' : 'transparent',
        color: modo === id ? '#1A1714' : '#6B6560',
        boxShadow: modo === id ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
      }}
    >
      <span style={{ fontSize: '16px' }}>{icono}</span>{titulo}
    </button>
  );

  const lineaCatalogo = () => {
    if (estadoCatalogo === undefined) return <span>Cargando catálogo…</span>;
    if (!estadoCatalogo) return <span style={{ color: '#856404' }}>⚠ El catálogo todavía no se ha cargado.</span>;
    return (
      <span style={{ color: copiaVieja ? '#856404' : '#6B6560' }}>
        {copiaVieja ? '⚠ ' : ''}{Number(estadoCatalogo.filas).toLocaleString('es-CR')} productos · precios y existencias de QVet del{' '}
        <b>{fmtFechaHora(estadoCatalogo.copia_de || estadoCatalogo.actualizado)}</b>
        {copiaVieja ? ' (copia vieja)' : ''}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F7F5F0', color: '#1A1714' }}>
      <Header title="Etiquetas" subtitle="Impresión de etiquetas de productos" showLogout showModuleSelector />

      <div style={{ flex: 1, padding: '24px 16px', maxWidth: '1140px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* ── DE DÓNDE SALEN LOS PRODUCTOS ───────────────────── */}
        <div style={{ display: 'flex', gap: '4px', background: '#ECE8E0', padding: '4px', borderRadius: '12px', marginBottom: '16px' }}>
          {pestana('buscar', '🔍', 'Buscar en el catálogo')}
          {pestana('factura', '📄', 'Desde una factura (Excel)')}
        </div>

        {/* ── BUSCADOR ───────────────────────────────────────── */}
        {modo === 'buscar' && (
          <div style={{ ...card, padding: '20px' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', opacity: 0.55, pointerEvents: 'none' }}>🔍</span>
              <input
                ref={buscadorRef}
                autoFocus
                type="text"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); enterEnBuscador(); } if (e.key === 'Escape') setTexto(''); }}
                placeholder="Nombre, código o escaneá el código de barras…"
                style={{ ...inp, fontSize: '16px', padding: '14px 44px 14px 46px', borderRadius: '10px', border: `2px solid ${texto ? AZUL : '#E2DDD4'}` }}
              />
              {buscando && <span style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#9C9590' }}>buscando…</span>}
              {!buscando && texto && (
                <button onClick={() => { setTexto(''); buscadorRef.current?.focus(); }} title="Borrar"
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '16px', color: '#9C9590' }}>✕</button>
              )}
            </div>
            <div style={{ fontSize: '12px', marginTop: '10px', lineHeight: 1.6 }}>
              {lineaCatalogo()}
              <span style={{ color: '#9C9590' }}> · Con la pistola: escaneá y se agrega solo (escanear otra vez suma 1).</span>
            </div>

            {resultado && (
              <div style={{ marginTop: '16px', border: '1.5px solid #E2DDD4', borderRadius: '10px', overflow: 'hidden' }}>
                {resultado.productos.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#9C9590', fontSize: '13px' }}>
                    No hay ningún producto con «{resultado.q}». Probá con menos palabras o con el código.
                  </div>
                ) : (
                  <>
                    <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                      {resultado.productos.map((p) => {
                        const exacto = resultado.exactos.includes(p.codigo);
                        const ya = enLista.get('cod:' + p.codigo);
                        const cant = cantAgregar[p.codigo] ?? '';
                        const hay = p.existencias === null ? null : Number(p.existencias);
                        return (
                          <div key={p.codigo} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderBottom: '1px solid #F0EDE6', background: exacto ? '#EDF5FA' : '#fff', flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                              <div style={{ fontSize: '14px', fontWeight: '600', lineHeight: 1.35 }}>
                                {p.nombre}
                                {exacto && <span style={{ ...chip('#D6EAF5', AZUL), marginLeft: '8px' }}>código exacto</span>}
                              </div>
                              <div style={{ fontSize: '11px', color: '#9C9590', marginTop: '3px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                <span style={mono}>#{p.codigo}</span>
                                {p.codigo_barras
                                  ? <span style={mono}>{p.codigo_barras}</span>
                                  : <span style={{ color: '#856404' }}>⚠ sin código de barras</span>}
                                {p.familia && <span>{p.familia}</span>}
                              </div>
                            </div>
                            <span style={hay > 0 ? chip('#E8F3EC', '#1a7a4a') : chip('#F0EDE6', '#9C9590')} title="Lo que decía QVet anoche">
                              {hay === null ? '—' : `hay ${fmtCantidad(hay)}`}
                            </span>
                            <div style={{ width: '92px', textAlign: 'right', fontWeight: '700', fontSize: '14px', ...mono }}>
                              {Number(p.precio) > 0 ? fmtPrecio(p.precio) : <span style={{ color: '#C0392B', fontSize: '12px' }}>sin precio</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="text" inputMode="numeric" placeholder="1" value={cant}
                                onChange={(e) => setCantAgregar(c => ({ ...c, [p.codigo]: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(p, parseCantidad(cant) || 1); } }}
                                title="Cuántas etiquetas"
                                style={{ ...inp, width: '52px', textAlign: 'center', fontSize: '14px', padding: '7px 4px' }}
                              />
                              <button
                                onClick={() => agregar(p, parseCantidad(cant) || 1)}
                                style={{ ...btnPrimary, padding: '8px 14px', fontSize: '13px', whiteSpace: 'nowrap' }}
                              >
                                + Agregar
                              </button>
                            </div>
                            {ya !== undefined && (
                              <span style={{ ...chip('#FFF4D6', '#8B6914'), flexBasis: '100%', width: 'fit-content', marginTop: '-4px' }}>
                                ya en la lista: {ya}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {(resultado.total > resultado.productos.length || resultado.hayMas) && (
                      <div style={{ padding: '10px 14px', fontSize: '12px', color: '#6B6560', background: '#FAFAF8' }}>
                        Se muestran los primeros {resultado.productos.length}{resultado.hayMas ? '' : ` de ${resultado.total}`}. Escribí otra palabra para afinar (ej. «pro plan gato 3»).
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── EXCEL DE FACTURA ───────────────────────────────── */}
        {modo === 'factura' && (
          <div style={{ ...card, padding: '24px' }}>
            <div style={{ background: '#F0F7FF', border: '1px solid #C3DDF0', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '12px', color: '#1A4A6B', lineHeight: 1.9 }}>
              <div style={{ fontWeight: '700', marginBottom: '4px', color: AZUL }}>¿Dónde descargar el archivo?</div>
              <div>
                <span style={{ fontWeight: '600' }}>Documentos</span>
                <span style={{ margin: '0 5px', color: '#6B9AB8' }}>›</span>
                <span style={{ fontWeight: '600' }}>Listados</span>
                <span style={{ margin: '0 5px', color: '#6B9AB8' }}>›</span>
                <span style={{ fontWeight: '600' }}>Compras</span>
                <span style={{ margin: '0 5px', color: '#6B9AB8' }}>›</span>
                <span style={{ fontWeight: '600' }}>Productos en facturas ingresadas</span>
              </div>
              <div style={{ marginTop: '4px', color: '#4A7A9B' }}>Filtrá por número de factura y descargá el listado en Excel. Los productos se suman a la lista de abajo.</div>
            </div>
            <div
              style={{ border: `2px dashed ${arrastrando ? AZUL : '#C8C0B4'}`, borderRadius: '12px', padding: '40px 24px', textAlign: 'center', cursor: 'pointer', background: arrastrando ? '#EDF5FA' : '#FAFAF8', transition: 'all 0.2s' }}
              onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>📄</div>
              <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '6px' }}>Arrastrá el Excel aquí o hacé click para seleccionar</div>
              <div style={{ fontSize: '12px', color: '#9C9590', marginTop: '10px', lineHeight: 1.8 }}>
                Columnas requeridas: CONCEPTO · CANTIDAD · PVP · codigobarras · codigointerno
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={(e) => cargarArchivo(e.target.files[0])} />
          </div>
        )}

        {/* ── ERROR (se queda hasta cerrarlo) ────────────────── */}
        {error && (
          <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: '#7F1D1D', fontSize: '13px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <span style={{ flex: 1 }}>❌ {error}</span>
            <button onClick={() => setError('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#7F1D1D', fontSize: '14px' }}>✕</button>
          </div>
        )}

        {/* ── LA LISTA PARA IMPRIMIR ─────────────────────────── */}
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', borderBottom: lista.length ? '1px solid #F0EDE6' : 'none' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', marginRight: '6px' }}>Lista para imprimir</div>
            {lista.length > 0 && (
              <>
                <span style={{ fontSize: '12px', color: '#6B6560' }}>
                  {lista.length} producto{lista.length !== 1 ? 's' : ''}
                  {sinCodigo > 0 && <span style={{ marginLeft: '8px', color: '#856404', fontWeight: '600' }}>⚠ {sinCodigo} sin código de barras</span>}
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {lista.length > 8 && (
                    <input type="text" value={filtroLista} onChange={(e) => setFiltroLista(e.target.value)}
                      placeholder="Filtrar la lista…" style={{ ...inp, width: '180px', padding: '7px 10px' }} />
                  )}
                  <button style={{ ...btnSec, color: '#C0392B' }} onClick={vaciar}>Vaciar</button>
                </div>
              </>
            )}
          </div>

          {lista.length === 0 ? (
            <div style={{ padding: '36px 24px', textAlign: 'center', color: '#9C9590' }}>
              <div style={{ fontSize: '34px', marginBottom: '8px' }}>🏷️</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#6B6560' }}>Todavía no hay nada para imprimir</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>Buscá un producto o escaneá su código y tocá «Agregar».</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th style={th}>Producto</th>
                    <th style={{ ...th, width: '110px', textAlign: 'right' }}>Precio</th>
                    <th style={{ ...th, width: '90px' }}>En QVet</th>
                    <th style={{ ...th, width: '150px', textAlign: 'center' }}>Etiquetas</th>
                    <th style={{ ...th, width: '110px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {listaVisible.map((p, idx) => {
                    const isEdit = editando === p.key;
                    const cero = !(p.cantidad > 0);
                    const hay = p.existencias === null || p.existencias === undefined ? null : Number(p.existencias);
                    return (
                      <tr key={p.key} style={{ background: recien === p.key ? '#FFF8DC' : cero ? '#FAFAF8' : '#fff', transition: 'background 0.6s' }}>
                        {isEdit ? (
                          <>
                            <td style={td} colSpan={2}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: '6px' }}>
                                <input style={inp} value={editValues.nombre} onChange={(e) => setEditValues(v => ({ ...v, nombre: e.target.value }))} placeholder="Nombre" />
                                <input style={inp} type="text" inputMode="numeric" value={editValues.pvp} onChange={(e) => setEditValues(v => ({ ...v, pvp: e.target.value }))} placeholder="Precio" />
                                <input style={{ ...inp, ...mono }} value={editValues.codigoBarras} onChange={(e) => setEditValues(v => ({ ...v, codigoBarras: e.target.value }))} placeholder="Código de barras" />
                                <input style={{ ...inp, ...mono }} value={editValues.codigoInterno} onChange={(e) => setEditValues(v => ({ ...v, codigoInterno: e.target.value }))} placeholder="Código interno" />
                              </div>
                              <div style={{ fontSize: '11px', color: '#9C9590', marginTop: '6px' }}>Esto cambia solo la etiqueta, no QVet.</div>
                            </td>
                            <td style={td}></td>
                            <td style={td}></td>
                            <td style={td}>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button style={{ ...btnXS, background: AZUL, color: '#fff', border: 'none' }} onClick={() => guardarEdicion(p.key)}>Guardar</button>
                                <button style={btnXS} onClick={() => setEditando(null)}>✕</button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ ...td, opacity: cero ? 0.55 : 1 }}>
                              <div style={{ fontWeight: '600' }}>
                                {p.nombre}
                                {p.editado && <span style={{ ...chip('#EDE9F6', '#5B35B5'), marginLeft: '8px' }}>editado</span>}
                              </div>
                              <div style={{ fontSize: '11px', color: '#9C9590', marginTop: '2px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                {p.codigoInterno && <span style={mono}>#{p.codigoInterno}</span>}
                                {p.sinCodigo
                                  ? <span style={chip('#FEF3CD', '#856404')}>⚠ sin código de barras</span>
                                  : <span style={mono}>{p.codigoBarras}</span>}
                                {p.origen === 'factura' && <span>de factura</span>}
                              </div>
                            </td>
                            <td style={{ ...td, textAlign: 'right', fontWeight: '700', ...mono, opacity: cero ? 0.55 : 1 }}>
                              {p.pvp > 0 ? fmtPrecio(p.pvp) : <span style={{ color: '#C0392B', fontSize: '12px' }}>sin precio</span>}
                            </td>
                            <td style={td}>
                              {hay === null ? <span style={{ color: '#C8C0B4' }}>—</span> : (
                                <button
                                  onClick={() => ponerCantidad(p.key, Math.max(0, Math.round(hay)))}
                                  title="Poner esta cantidad de etiquetas"
                                  style={{ ...chip(hay > 0 ? '#E8F3EC' : '#F0EDE6', hay > 0 ? '#1a7a4a' : '#9C9590'), border: 'none', cursor: 'pointer' }}
                                >
                                  hay {fmtCantidad(hay)}
                                </button>
                              )}
                            </td>
                            <td style={td}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                <button style={{ ...btnXS, width: '28px', padding: '5px 0', fontSize: '14px' }} onClick={() => ponerCantidad(p.key, (p.cantidad || 0) - 1)} aria-label="Una menos">−</button>
                                <input
                                  data-cant={idx}
                                  type="text" inputMode="numeric" placeholder="0"
                                  value={p.cantidad ? String(p.cantidad) : ''}
                                  onChange={(e) => ponerCantidad(p.key, parseCantidad(e.target.value))}
                                  onKeyDown={(e) => navegarCantidad(e, idx)}
                                  onFocus={(e) => e.target.select()}
                                  style={{ ...inp, width: '54px', textAlign: 'center', fontSize: '15px', fontWeight: '700', padding: '6px 4px', ...mono }}
                                />
                                <button style={{ ...btnXS, width: '28px', padding: '5px 0', fontSize: '14px' }} onClick={() => ponerCantidad(p.key, (p.cantidad || 0) + 1)} aria-label="Una más">+</button>
                              </div>
                            </td>
                            <td style={td}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                <button style={btnXS} onClick={() => iniciarEdicion(p)}>Editar</button>
                                <button style={{ ...btnXS, color: '#C0392B' }} onClick={() => quitar(p.key)} title="Quitar de la lista">✕</button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                  {listaVisible.length === 0 && (
                    <tr><td style={{ ...td, textAlign: 'center', color: '#9C9590' }} colSpan={5}>Nada en la lista calza con «{filtroLista}».</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── BARRA DE IMPRIMIR (siempre a la vista) ───────────── */}
      {lista.length > 0 && (
        <div style={{ position: 'sticky', bottom: 0, background: 'rgba(255,255,255,0.97)', borderTop: '1.5px solid #E2DDD4', boxShadow: '0 -4px 16px rgba(0,0,0,0.06)', zIndex: 50 }}>
          <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '20px', justifyContent: 'flex-end', flexWrap: 'wrap', boxSizing: 'border-box' }}>
            <div style={{ fontSize: '12px', color: '#6B6560', marginRight: 'auto' }}>
              {productosConEtiquetas} de {lista.length} producto{lista.length !== 1 ? 's' : ''} con etiquetas
              {productosConEtiquetas < lista.length && <span style={{ color: '#9C9590' }}> · los que están en 0 no se imprimen</span>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '26px', fontWeight: '700', ...mono, letterSpacing: '-1px', lineHeight: 1 }}>
                {totalEtiquetas.toLocaleString('es-CR')}
              </div>
              <div style={{ fontSize: '11px', color: '#6B6560' }}>etiquetas a imprimir</div>
            </div>
            <button
              style={{ ...btnPrimary, padding: '13px 32px', fontSize: '15px', opacity: (imprimiendo || totalEtiquetas === 0) ? 0.6 : 1, cursor: (imprimiendo || totalEtiquetas === 0) ? 'not-allowed' : 'pointer' }}
              disabled={imprimiendo || totalEtiquetas === 0}
              onClick={handleImprimir}
              onMouseEnter={(e) => { if (!imprimiendo) e.currentTarget.style.background = '#1f5780'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = AZUL; }}
            >
              {imprimiendo ? 'Preparando…' : '🖨 Imprimir'}
            </button>
          </div>
        </div>
      )}

      {/* ── AVISO CORTO (3 s) ────────────────────────────────── */}
      {aviso && (
        <div style={{
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 10000,
          background: aviso.type === 'ok' ? '#27AE60' : '#6B6560', color: '#fff', padding: '10px 18px',
          borderRadius: '10px', fontSize: '13px', fontWeight: '600', boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
          maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box',
        }}>
          {aviso.type === 'ok' ? '' : 'ℹ️ '}{aviso.msg}
        </div>
      )}

      {/* ── MODAL SELECCIÓN TAMAÑO ─────────────────────────── */}
      {showModalTamano && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setShowModalTamano(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: '16px', padding: '32px 28px', width: '340px', boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#1A1714', marginBottom: '6px' }}>¿Qué tamaño de etiqueta?</div>
            <div style={{ fontSize: '12px', color: '#9C9590', marginBottom: '24px' }}>
              {totalEtiquetas} etiqueta{totalEtiquetas !== 1 ? 's' : ''} de {productosConEtiquetas} producto{productosConEtiquetas !== 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(TAMANOS).map(([key, t]) => (
                <button
                  key={key}
                  onClick={() => handleImprimirConTamano(key)}
                  style={{
                    padding: '16px 20px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                    border: '1.5px solid #E2DDD4', background: '#F7F5F0', transition: 'all 0.15s',
                    fontSize: '14px', fontWeight: '600', color: '#1A1714',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#EDF5FA'; e.currentTarget.style.borderColor = AZUL; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#F7F5F0'; e.currentTarget.style.borderColor = '#E2DDD4'; }}
                >
                  <div>{t.label}</div>
                  <div style={{ fontSize: '11px', color: '#9C9590', fontWeight: '400', marginTop: '3px' }}>
                    {key === 'pequena' ? 'Código de barras sin dígitos' : 'Código de barras con dígitos visibles'}
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowModalTamano(false)}
              style={{ marginTop: '16px', width: '100%', padding: '10px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#9C9590' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
