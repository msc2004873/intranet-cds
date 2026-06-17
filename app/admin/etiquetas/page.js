'use client';

import { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';

// ============================================================
// CONSTANTES DE ETIQUETA — calibrar según impresora física
// Todas las medidas en mm
// ============================================================
const TAMANOS = {
  grande: {
    label: 'Grande (50 × 26 mm)',
    ancho: 50,
    alto: 26,
    nombre:     { fontSize: 6.5, maxChars: 36 },
    barcode:    { ancho: 40, alto: 12, y: 5.5, lineWidth: 1.2, textFontSize: 7 },
    precio:     { y: 22, fontSize: 9 },
    codInterno: { y: 25.2, fontSize: 4.5 },
  },
  pequena: {
    label: 'Pequeña (32 × 19 mm)',
    ancho: 32,
    alto: 19,
    nombre:     { fontSize: 5.5, maxChars: 28 },
    barcode:    { ancho: 26, alto: 8.5, y: 4.5, lineWidth: 0.9, textFontSize: 5 },
    precio:     { y: 15.5, fontSize: 7 },
    codInterno: { y: 18.5, fontSize: 4 },
  },
};

// ============================================================
// HELPERS
// ============================================================
function detectarFormato(codigo) {
  const c = String(codigo).replace(/\s/g, '');
  if (/^\d{12}$/.test(c)) return 'UPC';
  if (/^\d{13}$/.test(c)) return 'EAN13';
  if (/^\d{8}$/.test(c))  return 'EAN8';
  return 'CODE128';
}

function esCodValido(c) {
  return c && String(c).trim().length > 0;
}

function fmtPrecio(n) {
  return '₡' + Number(n).toLocaleString('es-CR');
}

let _uid = 1;
function mkId() { return String(_uid++); }

function parseNumero(str) {
  const s = String(str).replace(/[₡$\s]/g, '').replace(/,/g, '.');
  return parseFloat(s) || 0;
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
      const found = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.trim().toLowerCase());
      return found ? String(row[found]).trim() : '';
    };

    const nombre = g('CONCEPTO');
    if (!nombre) continue;

    const cantidad = Math.max(1, parseInt(g('CANTIDAD')) || 1);
    const pvp = parseNumero(g('PVP'));
    const codigoBarras = g('codigobarras');
    const codigoInterno = g('codigointerno');

    // Agrupar por codigobarras > codigointerno > nombre
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
// LAYOUT DE ETIQUETA — función fácil de ajustar
// ============================================================
async function dibujarEtiqueta(doc, producto, cfg, JsBarcode) {
  const cx = cfg.ancho / 2;

  // 1. Nombre (truncado si es muy largo)
  let nombre = producto.nombre;
  if (nombre.length > cfg.nombre.maxChars) {
    nombre = nombre.substring(0, cfg.nombre.maxChars - 1) + '…';
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(cfg.nombre.fontSize);
  doc.setTextColor(0, 0, 0);
  const nombreY = cfg.nombre.fontSize * 0.3528 + 1.2;
  doc.text(nombre, cx, nombreY, { align: 'center', maxWidth: cfg.ancho - 2 });

  // 2. Código de barras
  const bc = cfg.barcode;
  const bx = cx - bc.ancho / 2;

  if (esCodValido(producto.codigoBarras)) {
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, String(producto.codigoBarras).replace(/\s/g, ''), {
        format: detectarFormato(producto.codigoBarras),
        displayValue: true,
        fontSize: bc.textFontSize * 3,
        textMargin: 1,
        margin: 0,
        lineColor: '#000000',
        background: '#ffffff',
        width: bc.lineWidth,
        height: 60,
      });
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', bx, bc.y, bc.ancho, bc.alto);
    } catch {
      doc.setFontSize(4.5);
      doc.setFont('helvetica', 'normal');
      doc.text(String(producto.codigoBarras), cx, bc.y + bc.alto / 2, { align: 'center' });
    }
  } else {
    doc.setFontSize(4.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 0, 0);
    doc.text('[ sin código de barras ]', cx, bc.y + bc.alto / 2, { align: 'center' });
    doc.setTextColor(0, 0, 0);
  }

  // 3. Precio
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(cfg.precio.fontSize);
  doc.text(fmtPrecio(producto.pvp), cx, cfg.precio.y, { align: 'center' });

  // 4. Código interno
  if (producto.codigoInterno) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(cfg.codInterno.fontSize);
    doc.text(`Cód: ${producto.codigoInterno}`, cx, cfg.codInterno.y, { align: 'center' });
  }
}

// ============================================================
// GENERACIÓN DE PDF
// ============================================================
async function generarPDF(productos, seleccionados, tamano) {
  const { jsPDF } = await import('jspdf');
  const JsBarcode = (await import('jsbarcode')).default;

  const cfg = TAMANOS[tamano];
  const lista = productos.filter(p => seleccionados.has(p.id));
  const paginas = lista.flatMap(p => Array.from({ length: Math.max(1, p.cantidad) }, () => p));

  if (paginas.length === 0) return;

  const ori = cfg.ancho >= cfg.alto ? 'l' : 'p';
  const doc = new jsPDF({ unit: 'mm', format: [cfg.ancho, cfg.alto], orientation: ori });

  for (let i = 0; i < paginas.length; i++) {
    if (i > 0) doc.addPage([cfg.ancho, cfg.alto], ori);
    await dibujarEtiqueta(doc, paginas[i], cfg, JsBarcode);
  }

  const fecha = new Date().toLocaleDateString('es-CR').replace(/\//g, '-');
  doc.save(`etiquetas_${fecha}.pdf`);
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function EtiquetasPage() {
  const router = useRouter();
  const [userRole, setUserRole] = useState('');
  const [productos, setProductos] = useState([]);
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [editando, setEditando] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [busqueda, setBusqueda] = useState('');
  const [tamano, setTamano] = useState('grande');
  const [generando, setGenerando] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError] = useState('');
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

  // Filtro de búsqueda
  const productosFiltrados = productos.filter(p =>
    !busqueda ||
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.codigoBarras && p.codigoBarras.includes(busqueda)) ||
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
          setError('No se encontraron productos. Verificá que el Excel tenga las columnas: CONCEPTO, CANTIDAD, PVP, codigobarras, codigointerno.');
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
      nombre: p.nombre,
      pvp: p.pvp,
      codigoBarras: p.codigoBarras,
      codigoInterno: p.codigoInterno,
      cantidad: p.cantidad,
    });
  }

  function guardarEdicion(id) {
    setProductos(prev => prev.map(p => {
      if (p.id !== id) return p;
      const cb = String(editValues.codigoBarras || '').trim();
      return {
        ...p,
        nombre: editValues.nombre,
        pvp: parseNumero(editValues.pvp),
        codigoBarras: cb,
        codigoInterno: String(editValues.codigoInterno || '').trim(),
        cantidad: Math.max(1, parseInt(editValues.cantidad) || 1),
        sinCodigo: !esCodValido(cb),
      };
    }));
    setEditando(null);
  }

  async function handleGenerarPDF() {
    if (seleccionados.size === 0) { setError('Seleccioná al menos un producto.'); return; }
    setGenerando(true);
    setError('');
    try {
      await generarPDF(productos, seleccionados, tamano);
    } catch (e) {
      setError('Error generando PDF: ' + e.message);
    } finally {
      setGenerando(false);
    }
  }

  // ── Estilos ───────────────────────────────────────────────

  const card = {
    background: '#fff', borderRadius: '12px',
    border: '1.5px solid #E2DDD4', marginBottom: '16px',
  };
  const th = {
    padding: '10px 12px', textAlign: 'left',
    borderBottom: '2px solid #E2DDD4', fontWeight: '600',
    fontSize: '12px', color: '#6B6560', background: '#F7F5F0',
    whiteSpace: 'nowrap',
  };
  const td = {
    padding: '9px 12px', borderBottom: '1px solid #F0EDE6',
    verticalAlign: 'middle', fontSize: '13px',
  };
  const inp = {
    border: '1.5px solid #E2DDD4', borderRadius: '6px',
    padding: '5px 8px', fontSize: '12px', width: '100%',
    background: '#fff', outline: 'none', boxSizing: 'border-box',
  };
  const btnPrimary = {
    background: '#2a78a5', color: '#fff', border: 'none',
    borderRadius: '8px', padding: '11px 24px', cursor: 'pointer',
    fontSize: '14px', fontWeight: '600', transition: 'background 0.15s',
  };
  const btnSec = {
    background: '#F0EDE6', color: '#1A1714', border: '1px solid #E2DDD4',
    borderRadius: '8px', padding: '8px 14px', cursor: 'pointer',
    fontSize: '13px', fontWeight: '500',
  };
  const btnXS = {
    background: '#F0EDE6', color: '#1A1714', border: '1px solid #E2DDD4',
    borderRadius: '6px', padding: '4px 10px', cursor: 'pointer',
    fontSize: '11px', fontWeight: '600',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#F7F5F0', color: '#1A1714' }}>
      <Header title="Etiquetas" subtitle="Impresión de etiquetas de productos" showLogout showModuleSelector />

      <div style={{ flex: 1, padding: '24px 16px', maxWidth: '1140px', margin: '0 auto', width: '100%' }}>

        {/* ── UPLOAD ─────────────────────────────────────────── */}
        {productos.length === 0 && (
          <div style={{ ...card, padding: '28px 28px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '20px', color: '#1A1714' }}>
              Subir Excel de Q-VET
            </h2>

            <div
              style={{
                border: `2px dashed ${arrastrando ? '#2a78a5' : '#C8C0B4'}`,
                borderRadius: '12px', padding: '52px 24px', textAlign: 'center',
                cursor: 'pointer', transition: 'all 0.2s',
                background: arrastrando ? '#EDF5FA' : '#FAFAF8',
              }}
              onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div style={{ fontSize: '44px', marginBottom: '12px' }}>📄</div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: '#1A1714', marginBottom: '6px' }}>
                Arrastrá el Excel aquí o hacé click para seleccionar
              </div>
              <div style={{ fontSize: '12px', color: '#9C9590', marginTop: '12px', lineHeight: 1.8 }}>
                Columnas requeridas: CONCEPTO · CANTIDAD · PVP · codigobarras · codigointerno
              </div>
            </div>

            <input
              ref={fileInputRef} type="file" accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => cargarArchivo(e.target.files[0])}
            />
          </div>
        )}

        {/* ── ERROR ──────────────────────────────────────────── */}
        {error && (
          <div style={{
            background: '#FEE2E2', border: '1px solid #FCA5A5',
            borderRadius: '8px', padding: '12px 16px', marginBottom: '16px',
            color: '#7F1D1D', fontSize: '13px',
          }}>
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
                type="text" value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar producto, código..."
                style={{ ...inp, width: '220px', flex: 'none' }}
              />
              <button style={btnSec} onClick={() => setSeleccionados(new Set(productosFiltrados.map(p => p.id)))}>
                Seleccionar todos
              </button>
              <button style={btnSec} onClick={() => setSeleccionados(prev => { const n = new Set(prev); productosFiltrados.forEach(p => n.delete(p.id)); return n; })}>
                Deseleccionar todos
              </button>
              <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#6B6560', whiteSpace: 'nowrap' }}>
                {productos.length} productos&nbsp;·&nbsp;{seleccionados.size} seleccionados
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
                      <input
                        type="checkbox"
                        checked={todosSeleccionados}
                        onChange={toggleTodos}
                        style={{ cursor: 'pointer' }}
                      />
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
                    const bg = seleccionados.has(p.id) ? '#fff' : '#FAFAF8';
                    const isEdit = editando === p.id;

                    return (
                      <tr key={p.id} style={{ background: bg }}>
                        {/* Checkbox */}
                        <td style={{ ...td, textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={seleccionados.has(p.id)}
                            onChange={() => toggleSeleccion(p.id)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>

                        {isEdit ? (
                          /* ── Modo edición ── */
                          <>
                            <td style={td}>
                              <input style={inp} value={editValues.nombre}
                                onChange={(e) => setEditValues(v => ({ ...v, nombre: e.target.value }))} />
                            </td>
                            <td style={td}>
                              <input style={{ ...inp, width: '58px' }}
                                type="text" inputMode="numeric"
                                value={editValues.cantidad}
                                onChange={(e) => setEditValues(v => ({ ...v, cantidad: e.target.value }))} />
                            </td>
                            <td style={td}>
                              <input style={inp} type="text" inputMode="numeric"
                                value={editValues.pvp}
                                onChange={(e) => setEditValues(v => ({ ...v, pvp: e.target.value }))} />
                            </td>
                            <td style={td}>
                              <input style={{ ...inp, fontFamily: 'monospace' }}
                                value={editValues.codigoBarras}
                                onChange={(e) => setEditValues(v => ({ ...v, codigoBarras: e.target.value }))} />
                            </td>
                            <td style={td}>
                              <input style={{ ...inp, fontFamily: 'monospace' }}
                                value={editValues.codigoInterno}
                                onChange={(e) => setEditValues(v => ({ ...v, codigoInterno: e.target.value }))} />
                            </td>
                            <td style={td}></td>
                            <td style={{ ...td, display: 'flex', gap: '6px' }}>
                              <button
                                style={{ ...btnXS, background: '#2a78a5', color: '#fff', border: 'none' }}
                                onClick={() => guardarEdicion(p.id)}
                              >
                                Guardar
                              </button>
                              <button style={btnXS} onClick={() => setEditando(null)}>✕</button>
                            </td>
                          </>
                        ) : (
                          /* ── Modo lectura ── */
                          <>
                            <td style={td}>{p.nombre}</td>
                            <td style={td}>{p.cantidad}</td>
                            <td style={td}>{fmtPrecio(p.pvp)}</td>
                            <td style={{ ...td, fontFamily: 'monospace', fontSize: '11px', color: p.sinCodigo ? '#9C9590' : 'inherit' }}>
                              {p.codigoBarras || '—'}
                              {p.codigoBarras && (
                                <span style={{ marginLeft: '6px', fontSize: '10px', color: '#9C9590' }}>
                                  {detectarFormato(p.codigoBarras)}
                                </span>
                              )}
                            </td>
                            <td style={{ ...td, fontFamily: 'monospace', fontSize: '11px' }}>
                              {p.codigoInterno || '—'}
                            </td>
                            <td style={td}>
                              <span style={{
                                display: 'inline-block', padding: '2px 9px', borderRadius: '20px',
                                fontSize: '11px', fontWeight: '600',
                                background: p.sinCodigo ? '#FEF3CD' : '#E8F3EC',
                                color: p.sinCodigo ? '#856404' : '#1a7a4a',
                              }}>
                                {p.sinCodigo ? '⚠ sin código' : '✓ ok'}
                              </span>
                            </td>
                            <td style={td}>
                              <button style={btnXS} onClick={() => iniciarEdicion(p)}>Editar</button>
                            </td>
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

        {/* ── BARRA INFERIOR: tamaño + generar ───────────────── */}
        {productos.length > 0 && (
          <div style={{ ...card, padding: '20px 24px' }}>
            <div style={{ display: 'flex', gap: '32px', alignItems: 'center', flexWrap: 'wrap' }}>

              {/* Selector de tamaño */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#6B6560', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
                  Tamaño de etiqueta
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {Object.entries(TAMANOS).map(([key, t]) => (
                    <button
                      key={key}
                      onClick={() => setTamano(key)}
                      style={{
                        padding: '9px 18px', borderRadius: '8px', cursor: 'pointer',
                        fontSize: '13px', fontWeight: '600', transition: 'all 0.15s',
                        background: tamano === key ? '#2a78a5' : '#F0EDE6',
                        color: tamano === key ? '#fff' : '#1A1714',
                        border: tamano === key ? 'none' : '1px solid #E2DDD4',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contador + botón generar */}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: '#1A1714', fontFamily: "'DM Mono', monospace", letterSpacing: '-1px' }}>
                    {totalEtiquetas}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6B6560' }}>páginas en el PDF</div>
                </div>
                <button
                  style={{
                    ...btnPrimary,
                    padding: '13px 32px', fontSize: '15px',
                    opacity: (generando || seleccionados.size === 0) ? 0.6 : 1,
                    cursor: (generando || seleccionados.size === 0) ? 'not-allowed' : 'pointer',
                  }}
                  disabled={generando || seleccionados.size === 0}
                  onClick={handleGenerarPDF}
                  onMouseEnter={(e) => { if (!generando) e.currentTarget.style.background = '#1f5780'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#2a78a5'; }}
                >
                  {generando ? 'Generando…' : '🖨 Generar PDF'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
