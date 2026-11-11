import supabase from '../../../../lib/supabase-server.js';

// Buscador del catálogo para etiquetas (2026-11-11).
// La tabla `catalogo_etiquetas` la llena cada madrugada el robot `cds-agentes/catalogo-etiquetas.js`
// con la copia de QVet de la noche (productos de TIENDA, MEDICAMENTOS y SUMINISTROS activos).
//
//   GET /api/etiquetas/catalogo           → solo el estado (de cuándo es la copia, cuántos hay)
//   GET /api/etiquetas/catalogo?q=texto   → hasta 60 productos que calzan
//
// Busca por palabras sueltas en cualquier orden ("pro plan cat 3") contra nombre + código +
// código de barras, sin importar tildes ni mayúsculas. Un código o código de barras EXACTO va
// primero (así funciona la pistola: escanea y queda arriba).

const CAMPOS = 'codigo, codigo_barras, nombre, precio, seccion, familia, existencias';
const MAX = 60;
const CANDIDATOS = 400;

// ⚠️ Igual que `normalizar` del robot (cds-agentes/catalogo-etiquetas.js), que arma `busqueda`.
const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/['’`´]/g, '').replace(/\s+/g, ' ').trim();
// En un patrón ILIKE, % _ \ son comodines: se quitan de lo que escribió la persona.
const limpiar = (p) => p.replace(/[%_\\*]/g, '');

// QVet mezcla español e inglés ("Pro Plan Cat", "Lata Gato"). Si alguien escribe una de estas
// palabras ENTERA, se busca cualquiera del grupo como palabra entera (así "gato" no trae "catéter").
const SINONIMOS = [
  ['gato', 'gatos', 'gata', 'cat', 'cats', 'felino', 'felina', 'felinos', 'feline'],
  ['perro', 'perros', 'perra', 'dog', 'dogs', 'canino', 'canina', 'caninos', 'canine'],
  ['cachorro', 'cachorros', 'puppy', 'puppies'],
  ['gatito', 'gatitos', 'kitten', 'kittens'],
  ['adulto', 'adultos', 'adult'],
  ['pollo', 'chicken'],
  ['cordero', 'lamb'],
  ['pescado', 'fish'],
  ['arroz', 'rice'],
];
// Marcas que en QVet se escriben abreviadas (solo en un sentido: "hills" trae los SD y PD,
// pero "sd" no trae los PD). En QVet ningún Hill's dice "Hill's": son "SD …" y "PD …" (122, 2026-11-11).
const MARCAS = {
  hills: ['sd', 'pd', 'hills', 'hill'],
  hill:  ['sd', 'pd', 'hills', 'hill'],
};
const grupoDe = (p) => MARCAS[p] || SINONIMOS.find((g) => g.includes(p));

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = normalizar(searchParams.get('q')).slice(0, 80);

    const { data: estado, error: errEstado } = await supabase
      .from('catalogo_etiquetas_estado').select('actualizado, copia_de, filas').eq('id', 1).maybeSingle();
    if (errEstado) throw errEstado;

    if (!q) return Response.json({ estado, productos: [], total: 0 });

    // 1) Exacto por código interno o código de barras (lo que manda la pistola).
    let exactos = [];
    if (/^[0-9a-z-]+$/.test(q)) {
      const { data, error } = await supabase.from('catalogo_etiquetas').select(CAMPOS)
        .or(`codigo.eq.${q},codigo_barras.eq.${q}`).limit(10);
      if (error) throw error;
      exactos = data || [];
    }

    // 2) Por palabras: cada una tiene que aparecer (en cualquier orden).
    const palabras = q.split(' ').map(limpiar).filter(Boolean).slice(0, 6);
    let candidatos = [];
    if (palabras.length) {
      let consulta = supabase.from('catalogo_etiquetas').select(CAMPOS);
      for (const p of palabras) {
        const grupo = grupoDe(p);
        consulta = grupo
          ? consulta.filter('busqueda', 'imatch', `\\m(${grupo.join('|')})\\M`)
          : consulta.ilike('busqueda', `%${p}%`);
      }
      // Primero lo que hay en tienda: si hay más de 400 que calzan, que no se queden por fuera.
      const { data, error } = await consulta
        .order('existencias', { ascending: false, nullsFirst: false }).order('nombre').limit(CANDIDATOS);
      if (error) throw error;
      candidatos = data || [];
    }

    // Orden: exactos → nombre que empieza con lo buscado → con existencias → el resto (por nombre).
    const vistos = new Set(exactos.map((p) => p.codigo));
    const nivel = (p) => {
      if (normalizar(p.nombre).startsWith(q)) return 1;
      return Number(p.existencias) > 0 ? 2 : 3;
    };
    const resto = candidatos.filter((p) => !vistos.has(p.codigo))
      .sort((a, b) => nivel(a) - nivel(b) || a.nombre.localeCompare(b.nombre, 'es'));
    const productos = [...exactos, ...resto].slice(0, MAX);

    return Response.json({
      estado,
      productos,
      total: exactos.length + resto.length,
      hayMas: candidatos.length >= CANDIDATOS,
      exactos: exactos.map((p) => p.codigo),
    });
  } catch (error) {
    console.error('catalogo etiquetas:', error);
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}
