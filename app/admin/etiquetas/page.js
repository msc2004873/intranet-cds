'use client';

import { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';

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
    codInterno: { top: 13.5, right: 2.5,  width: 13,  fontSize: 8 },
    precio:     { top: 17.0, right: 1.0,  width: 17,  fontSize: 13 },
    barcode:    { top: 12.0, left: 1.0,   width: 28,  height: 11,  barWidth: 1.5 },
  },
};

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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let _uid = 1;
function mkId() { return String(_uid++); }

function parseNumero(str) {
  return parseFloat(String(str).replace(/[₡$\s]/g, '').replace(/,/g, '.')) || 0;
}

// ============================================================
// PARSEO DEL EXCEL
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

    const cantidad    = Math.max(1, parseInt(g('cantidad')) || 1);
    const pvp         = parseNumero(g('pvp'));
    const codigoBarras  = g('codigobarras');
    const codigoInterno = g('codigointerno');
    const key = codigoBarras || codigoInterno || nombre;

    if (mapa.has(key)) {
      mapa.get(key).cantidad += cantidad;
    } else {
      mapa.set(key, {
        id: mkId(),
        nombre,
        cantidad,
        pvp,
        codigoBarras,
        codigoInterno,
        sinCodigo: !esCodValido(codigoBarras),
      });
    }
  }

  return Array.from(mapa.values());
}

// ============================================================
// IMPRESIÓN — layout absoluto, logo embedido como base64
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

async function imprimir(productos, seleccionados, tamano) {
  const JsBarcode = (await import('jsbarcode')).default;
  const logoSrc   = await fetchBase64('/corral-del-sol-logo-negro.png');
  const c         = TAMANOS[tamano];
  const isGrande  = tamano === 'grande';

  const lista   = productos.filter(p => seleccionados.has(p.id));
  const paginas = lista.flatMap(p =>
    Array.from({ length: Math.max(1, p.cantidad) }, () => p)
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

  const labelHtml = paginas.map((p, i) => {
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
    text-align: center; border: 2pt solid #000; border-radius: 8mm;
    padding: 0.8mm 2mm; white-space: nowrap;
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
// COMPONENTE PRINCIPAL
// ============================================================
export default function EtiquetasPage() {
  const router = useRouter();
  const [userRole, setUserRole]       = useState('');
  const [productos, setProductos]     = useState([]);
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [editando, setEditando]       = useState(null);
  const [editValues, setEditValues]   = useState({});
  const [busqueda, setBusqueda]       = useState('');
  const [tamano, setTamano]               = useState('grande');
  const [imprimiendo, setImprimiendo]     = useState(false);
  const [showModalTamano, setShowModalTamano] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError]             = useState('');
  const fileInputRef = useRef();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) { router.push('/login'); return; }
    const user = JSON.parse(userData);
    setUserRole(user.rol || '');
    if (user.rol !== 'admin') router.push('/');
  }, [router]);

  if (!userRole) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando...</div>;
  if (userRole !== 'admin') return null;

  const productosFiltrados = productos.filter(p =>
    !busqueda ||
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.codigoBarras  && p.codigoBarras.includes(busqueda)) ||
    (p.codigoInterno && p.codigoInterno.includes(busqueda))
  );

  const todosSeleccionados =
    productosFiltrados.length > 0 &&
    productosFiltrados.every(p => seleccionados.has(p.id));

  const totalEtiquetas = productos
    .filter(p => seleccionados.has(p.id))
    .reduce((sum, p) => sum + Math.max(1, p.cantidad), 0);

  // ── Handlers ──────────────────────────────────────────────

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
        setProductos(parsed);
        setSeleccionados(new Set(parsed.map(p => p.id)));
        setEditando(null);
        setBusqueda('');
      } catch (err) {
        setError('Error al leer el archivo: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function onDrop(e) {
    e.preventDefault();
    setArrastrando(false);
    cargarArchivo(e.dataTransfer.files[0]);
  }

  function toggleSeleccion(id) {
    setSeleccionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    if (todosSeleccionados) {
      setSeleccionados(prev => {
        const next = new Set(prev);
        productosFiltrados.forEach(p => next.delete(p.id));
        return next;
      });
    } else {
      setSeleccionados(prev => {
        const next = new Set(prev);
        productosFiltrados.forEach(p => next.add(p.id));
        return next;
      });
    }
  }

  function iniciarEdicion(p) {
    setEditando(p.id);
    setEditValues({
      nombre:       p.nombre,
      pvp:          p.pvp,
      codigoBarras: p.codigoBarras,
      codigoInterno:p.codigoInterno,
      cantidad:     p.cantidad,
    });
  }

  function guardarEdicion(id) {
    setProductos(prev => prev.map(p => {
      if (p.id !== id) return p;
      const cb = String(editValues.codigoBarras || '').trim();
      return {
        ...p,
        nombre:       editValues.nombre,
        pvp:          parseNumero(editValues.pvp),
        codigoBarras: cb,
        codigoInterno:String(editValues.codigoInterno || '').trim(),
        cantidad:     Math.max(1, parseInt(editValues.cantidad) || 1),
        sinCodigo:    !esCodValido(cb),
      };
    }));
    setEditando(null);
  }

  function handleImprimir() {
    if (seleccionados.size === 0) { setError('Seleccioná al menos un producto.'); return; }
    setShowModalTamano(true);
  }

  async function handleImprimirConTamano(t) {
    setShowModalTamano(false);
    setTamano(t);
    setImprimiendo(true);
    setError('');
    try {
      await imprimir(productos, seleccionados, t);
    } catch (e) {
      setError('Error al imprimir: ' + e.message);
    } finally {
      setImprimiendo(false);
    }
  }

  // ── Estilos ───────────────────────────────────────────────

  const card = { background: '#fff', borderRadius: '12px', border: '1.5px solid #E2DDD4', marginBottom: '16px' };
  const th   = { padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #E2DDD4', fontWeight: '600', fontSize: '12px', color: '#6B6560', background: '#F7F5F0', whiteSpace: 'nowrap' };
  const td   = { padding: '9px 12px', borderBottom: '1px solid #F0EDE6', verticalAlign: 'middle', fontSize: '13px' };
  const inp  = { border: '1.5px solid #E2DDD4', borderRadius: '6px', padding: '5px 8px', fontSize: '12px', width: '100%', background: '#fff', outline: 'none', boxSizing: 'border-box' };
  const btnPrimary = { background: '#2a78a5', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 24px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' };
  const btnSec = { background: '#F0EDE6', color: '#1A1714', border: '1px solid #E2DDD4', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' };
  const btnXS  = { background: '#F0EDE6', color: '#1A1714', border: '1px solid #E2DDD4', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F7F5F0', color: '#1A1714' }}>
      <Header title="Etiquetas" subtitle="Impresión de etiquetas de productos" showLogout showModuleSelector />

      <div style={{ flex: 1, padding: '24px 16px', maxWidth: '1140px', margin: '0 auto', width: '100%' }}>

        {/* ── UPLOAD ─────────────────────────────────────────── */}
        {productos.length === 0 && (
          <div style={{ ...card, padding: '28px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Subir Excel de Q-VET</h2>
            <div style={{ background: '#F0F7FF', border: '1px solid #C3DDF0', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '12px', color: '#1A4A6B', lineHeight: 1.9 }}>
              <div style={{ fontWeight: '700', marginBottom: '4px', color: '#2a78a5' }}>¿Dónde descargar el archivo?</div>
              <div>
                <span style={{ fontWeight: '600' }}>Documentos</span>
                <span style={{ margin: '0 5px', color: '#6B9AB8' }}>›</span>
                <span style={{ fontWeight: '600' }}>Listados</span>
                <span style={{ margin: '0 5px', color: '#6B9AB8' }}>›</span>
                <span style={{ fontWeight: '600' }}>Compras</span>
                <span style={{ margin: '0 5px', color: '#6B9AB8' }}>›</span>
                <span style={{ fontWeight: '600' }}>Productos en facturas ingresadas</span>
              </div>
              <div style={{ marginTop: '4px', color: '#4A7A9B' }}>Filtrá por número de factura y descargá el listado en Excel.</div>
            </div>
            <div
              style={{ border: `2px dashed ${arrastrando ? '#2a78a5' : '#C8C0B4'}`, borderRadius: '12px', padding: '52px 24px', textAlign: 'center', cursor: 'pointer', background: arrastrando ? '#EDF5FA' : '#FAFAF8', transition: 'all 0.2s' }}
              onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div style={{ fontSize: '44px', marginBottom: '12px' }}>📄</div>
              <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '6px' }}>Arrastrá el Excel aquí o hacé click para seleccionar</div>
              <div style={{ fontSize: '12px', color: '#9C9590', marginTop: '12px', lineHeight: 1.8 }}>
                Columnas requeridas: CONCEPTO · CANTIDAD · PVP · codigobarras · codigointerno
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={(e) => cargarArchivo(e.target.files[0])} />
          </div>
        )}

        {/* ── ERROR ──────────────────────────────────────────── */}
        {error && (
          <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: '#7F1D1D', fontSize: '13px' }}>
            ❌ {error}
          </div>
        )}

        {/* ── TOOLBAR ────────────────────────────────────────── */}
        {productos.length > 0 && (
          <div style={{ ...card, padding: '14px 20px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button style={btnSec} onClick={() => { setProductos([]); setSeleccionados(new Set()); setEditando(null); setError(''); }}>
                ← Cambiar archivo
              </button>
              <input
                type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar producto, código..."
                style={{ ...inp, width: '220px', flex: 'none' }}
              />
              <button style={btnSec} onClick={() => setSeleccionados(new Set(productosFiltrados.map(p => p.id)))}>Seleccionar todos</button>
              <button style={btnSec} onClick={() => setSeleccionados(prev => { const n = new Set(prev); productosFiltrados.forEach(p => n.delete(p.id)); return n; })}>Deseleccionar todos</button>
              <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#6B6560', whiteSpace: 'nowrap' }}>
                {productos.length} productos · {seleccionados.size} seleccionados
                {productos.some(p => p.sinCodigo) && (
                  <span style={{ marginLeft: '10px', color: '#856404', fontWeight: '600' }}>
                    ⚠ {productos.filter(p => p.sinCodigo).length} sin código
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TABLA ──────────────────────────────────────────── */}
        {productos.length > 0 && (
          <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th style={{ ...th, width: '36px', textAlign: 'center' }}>
                      <input type="checkbox" checked={todosSeleccionados} onChange={toggleTodos} style={{ cursor: 'pointer' }} />
                    </th>
                    <th style={th}>Producto</th>
                    <th style={{ ...th, width: '72px' }}>Cant.</th>
                    <th style={{ ...th, width: '110px' }}>Precio</th>
                    <th style={th}>Cód. Barras</th>
                    <th style={th}>Cód. Interno</th>
                    <th style={{ ...th, width: '100px' }}>Estado</th>
                    <th style={{ ...th, width: '80px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {productosFiltrados.map(p => {
                    const isEdit = editando === p.id;
                    return (
                      <tr key={p.id} style={{ background: seleccionados.has(p.id) ? '#fff' : '#FAFAF8' }}>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <input type="checkbox" checked={seleccionados.has(p.id)} onChange={() => toggleSeleccion(p.id)} style={{ cursor: 'pointer' }} />
                        </td>
                        {isEdit ? (
                          <>
                            <td style={td}><input style={inp} value={editValues.nombre} onChange={(e) => setEditValues(v => ({ ...v, nombre: e.target.value }))} /></td>
                            <td style={td}><input style={{ ...inp, width: '58px' }} type="text" inputMode="numeric" value={editValues.cantidad} onChange={(e) => setEditValues(v => ({ ...v, cantidad: e.target.value }))} /></td>
                            <td style={td}><input style={inp} type="text" inputMode="numeric" value={editValues.pvp} onChange={(e) => setEditValues(v => ({ ...v, pvp: e.target.value }))} /></td>
                            <td style={td}><input style={{ ...inp, fontFamily: 'monospace' }} value={editValues.codigoBarras} onChange={(e) => setEditValues(v => ({ ...v, codigoBarras: e.target.value }))} /></td>
                            <td style={td}><input style={{ ...inp, fontFamily: 'monospace' }} value={editValues.codigoInterno} onChange={(e) => setEditValues(v => ({ ...v, codigoInterno: e.target.value }))} /></td>
                            <td style={td}></td>
                            <td style={{ ...td, display: 'flex', gap: '6px' }}>
                              <button style={{ ...btnXS, background: '#2a78a5', color: '#fff', border: 'none' }} onClick={() => guardarEdicion(p.id)}>Guardar</button>
                              <button style={btnXS} onClick={() => setEditando(null)}>✕</button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={td}>{p.nombre}</td>
                            <td style={td}>{p.cantidad}</td>
                            <td style={td}>{fmtPrecio(p.pvp)}</td>
                            <td style={{ ...td, fontFamily: 'monospace', fontSize: '11px', color: p.sinCodigo ? '#9C9590' : 'inherit' }}>
                              {p.codigoBarras || '—'}
                            </td>
                            <td style={{ ...td, fontFamily: 'monospace', fontSize: '11px' }}>{p.codigoInterno || '—'}</td>
                            <td style={td}>
                              <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: p.sinCodigo ? '#FEF3CD' : '#E8F3EC', color: p.sinCodigo ? '#856404' : '#1a7a4a' }}>
                                {p.sinCodigo ? '⚠ sin código' : '✓ ok'}
                              </span>
                            </td>
                            <td style={td}><button style={btnXS} onClick={() => iniciarEdicion(p)}>Editar</button></td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── BARRA INFERIOR ─────────────────────────────────── */}
        {productos.length > 0 && (
          <div style={{ ...card, padding: '20px 24px' }}>
            <div style={{ display: 'flex', gap: '32px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#1A1714', fontFamily: "'DM Mono', monospace", letterSpacing: '-1px' }}>
                    {totalEtiquetas}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6B6560' }}>etiquetas a imprimir</div>
                </div>
                <button
                  style={{ ...btnPrimary, padding: '13px 32px', fontSize: '15px', opacity: (imprimiendo || seleccionados.size === 0) ? 0.6 : 1, cursor: (imprimiendo || seleccionados.size === 0) ? 'not-allowed' : 'pointer' }}
                  disabled={imprimiendo || seleccionados.size === 0}
                  onClick={handleImprimir}
                  onMouseEnter={(e) => { if (!imprimiendo) e.currentTarget.style.background = '#1f5780'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#2a78a5'; }}
                >
                  {imprimiendo ? 'Preparando…' : '🖨 Imprimir'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

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
              {totalEtiquetas} etiqueta{totalEtiquetas !== 1 ? 's' : ''} a imprimir
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
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#EDF5FA'; e.currentTarget.style.borderColor = '#2a78a5'; }}
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
