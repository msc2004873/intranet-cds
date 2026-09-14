'use client';

// Piezas compartidas del ciclo de facturas (FACTURAS.md §8).
// Las usa la pantalla de Administración (/admin/facturas), que también tiene el Centro de pagos.
// Viven acá para que el hilo de comentarios se vea IGUAL en las dos: quien paga tiene que
// leer exactamente lo mismo que escribió Recepción, sin traducciones por el camino.

import { useState } from 'react';

const fechaHora = (s) => s
  ? new Date(s).toLocaleString('es-CR', {
      timeZone: 'America/Costa_Rica', day: 'numeric', month: 'short',
      hour: 'numeric', minute: '2-digit',
    })
  : '—';

// Un check del ciclo. `bloqueado` = se ve pero no se puede tocar (todavía no le toca,
// o la factura está trancada con un error).
export function Check({ hecho, titulo, pie, bloqueado, onToggle }) {
  const clickeable = !bloqueado && typeof onToggle === 'function';
  return (
    <div
      onClick={clickeable ? onToggle : undefined}
      style={{
        // `flex: 1 1 140px` = los tres caben en una fila y se apilan solos en un teléfono.
        flex: '1 1 140px', minWidth: 0,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 9px', borderRadius: 9,
        border: '1.5px solid ' + (hecho ? '#BFE0CD' : '#E2DDD4'),
        background: hecho ? '#F2F9F5' : (bloqueado ? '#FAF9F7' : '#FFFFFF'),
        cursor: clickeable ? 'pointer' : 'default',
        opacity: bloqueado && !hecho ? 0.62 : 1,
      }}>
      <span style={{
        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800, color: '#FFFFFF',
        background: hecho ? '#1a7a4a' : '#FFFFFF',
        border: '1.5px solid ' + (hecho ? '#1a7a4a' : '#D8D2C9'),
      }}>{hecho ? '✓' : ''}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: hecho ? '#1a7a4a' : '#1A1714',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{titulo}</div>
        <div style={{
          fontSize: 10.5, color: '#8A837C',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }} title={pie}>{pie}</div>
      </div>
    </div>
  );
}

// Cómo se pinta cada cosa que pasó. El comentario de una persona se ve distinto de un
// paso del sistema: son dos cosas distintas y mezclarlas hace ilegible el hilo.
const EVENTOS = {
  creada:           { icono: '🤖', texto: 'La bajó del correo' },
  comentario:       { icono: '💬', texto: null },
  recibida:         { icono: '📦', texto: 'Recibió la mercadería' },
  mercaderia_recibida: { icono: '📦', texto: 'Recibió la mercadería' },
  problema:         { icono: '🔴', texto: 'Recibió con productos malos', color: '#C0392B' },
  con_problema:     { icono: '🔴', texto: 'Marcó un problema', color: '#C0392B' },
  resuelto:         { icono: '✅', texto: 'Cerró el problema con el proveedor', color: '#1a7a4a' },
  qvet:             { icono: '📥', texto: 'Subió la factura a QVet' },
  qvet_deshecho:    { icono: '↩️', texto: 'Desmarcó QVet' },
  marcado:          { icono: '🏷️', texto: 'Marcó el producto' },
  marcado_deshecho: { icono: '↩️', texto: 'Desmarcó el marcado' },
  en_inventario:    { icono: '📥', texto: 'Entró al inventario' },
  a_pago:           { icono: '💸', texto: 'Aprobó el gasto para pago' },
  por_pagar:        { icono: '💸', texto: 'Pasó a pago' },
  pagada:           { icono: '💰', texto: 'Pagó la factura', color: '#1a7a4a' },
  nota_aplicada:    { icono: '➖', texto: 'Restó la nota de crédito en un pago', color: '#5B35B5' },
  anulada:          { icono: '🚫', texto: 'Anuló la factura' },
};

// El historial completo, del más viejo al más nuevo. Esto es lo que Administración lee
// antes de pagar: quién recibió, qué vino mal, qué contestó el proveedor.
export function Hilo({ eventos, titulo = 'Historial' }) {
  const lista = (eventos || []).slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  if (!lista.length) return null;

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 10.5, color: '#8A837C', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 7 }}>
        {titulo}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {lista.map(e => {
          const meta = EVENTOS[e.evento] || { icono: '•', texto: e.evento };
          const esComentario = e.evento === 'comentario';
          return (
            <div key={e.id} style={{
              display: 'flex', gap: 9, alignItems: 'flex-start',
              padding: esComentario ? '8px 11px' : '3px 2px',
              background: esComentario ? '#FFFFFF' : 'transparent',
              border: esComentario ? '1.5px solid #EFEBE4' : 'none',
              borderRadius: 9,
            }}>
              <span style={{ fontSize: 13, flexShrink: 0, lineHeight: 1.4 }}>{meta.icono}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, color: meta.color || '#1A1714', lineHeight: 1.5 }}>
                  <strong style={{ fontWeight: 700 }}>{e.quien || 'alguien'}</strong>
                  {meta.texto ? ` — ${meta.texto}` : ''}
                  {e.detalle && !meta.texto && <span>: «{e.detalle}»</span>}
                </div>
                {e.detalle && meta.texto && (
                  <div style={{ fontSize: 11.5, color: '#6B6560', marginTop: 1 }}>{e.detalle}</div>
                )}
                <div style={{ fontSize: 10.5, color: '#B5AFA8', marginTop: 1 }}>{fechaHora(e.created_at)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Una caja para escribir algo y mandarlo. Se limpia sola al enviar y se bloquea mientras
// va en camino: sin eso, dos clicks seguidos mandan el comentario dos veces.
export function CajaTexto({ placeholder, boton, color, onEnviar }) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    try {
      const ok = await onEnviar(t);
      if (ok !== false) setTexto('');
    } finally { setEnviando(false); }
  }

  return (
    <div style={{ display: 'flex', gap: 7, marginTop: 9, flexWrap: 'wrap' }}>
      <input
        type="text"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); enviar(); } }}
        placeholder={placeholder}
        style={{
          flex: 1, minWidth: 200, padding: '8px 11px', border: '1.5px solid #E2DDD4',
          borderRadius: 9, fontSize: 13,
        }} />
      <button
        onClick={enviar}
        disabled={enviando || !texto.trim()}
        style={{
          background: enviando || !texto.trim() ? '#C9C4BC' : color, color: '#FFFFFF', border: 'none',
          borderRadius: 9, padding: '8px 15px', fontSize: 12.5, fontWeight: 700,
          cursor: enviando || !texto.trim() ? 'default' : 'pointer',
        }}>
        {enviando ? '…' : boton}
      </button>
    </div>
  );
}
