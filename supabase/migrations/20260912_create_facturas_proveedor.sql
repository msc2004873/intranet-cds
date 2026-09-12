-- Módulo de facturas de proveedor — Corral del Sol (2026-09-12).
--
-- Pedido de Mario: "un agente que vea el correo de facturación y una interfaz en la intranet
-- donde se pueda hacer el ciclo de facturas". El diseño completo está en
-- ~/projectsm1/corral-del-sol/FACTURAS.md — leerlo antes de tocar esto.
--
-- Las facturas las mete el robot `cds-agentes/facturas.js`, que lee
-- facturacion@corraldelsol.com por IMAP (SOLO LECTURA) y parsea el XML de Hacienda.
--
-- 🚨 DECISIONES QUE VIENEN DE MEDIR 102 FACTURAS REALES (no de suponer):
--  · `clave` es UNIQUE porque las facturas LLEGAN REPETIDAS: 6 de cada 102 llegan dos veces.
--    Es el número único de Hacienda; el consecutivo NO sirve (se repite entre emisores).
--  · `condicion_venta` se guarda como TEXTO CRUDO y no como booleano contado/crédito:
--    en el correo real aparecen 6 códigos distintos (01, 02, 05, 06, 10, 99), no 2.
--  · `fecha_vencimiento` NO viene en la factura — se calcula (emisión + plazo). Por eso
--    `vencimiento_calculado` deja dicho que es un cálculo nuestro, no un dato del proveedor.
--  · NO se guardan archivos (ni XML ni PDF): el correo ya los conserva desde 2020 y los PDF
--    pesan 178 KB c/u (450 MB al año). Se guarda `xml_crudo` como TEXTO (12 KB) por si hay
--    que reprocesar, y `correo_*` para poder ir a traer el PDF original cuando se pida.
--  · `es_de_corral_del_sol` existe porque al correo llegan facturas a nombre de OTROS
--    (recibos del ICE y Claro a nombre de Adrián Solano). Esas NO se botan: se marcan.

-- ---------------------------------------------------------------- facturas_proveedor
CREATE TABLE IF NOT EXISTS public.facturas_proveedor (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- identidad del documento (de Hacienda)
  clave                  text        NOT NULL UNIQUE,   -- 50 dígitos, único en todo el país
  consecutivo            text        NOT NULL,
  tipo_documento         text        NOT NULL DEFAULT 'factura',   -- 'factura' | 'nota_credito'
  version_xml            text,                                     -- '4.3' | '4.4'

  -- proveedor (Emisor del XML). ⚠️ Agrupar SIEMPRE por cédula: el mismo proveedor
  -- escribe su nombre de varias formas (Corpeco aparece de 2 maneras distintas).
  proveedor_cedula       text        NOT NULL,
  proveedor_nombre       text        NOT NULL,

  -- receptor: ¿esta factura es de la clínica?
  receptor_cedula        text        NOT NULL,
  receptor_nombre        text,
  es_de_corral_del_sol   boolean     NOT NULL DEFAULT true,

  -- fechas
  fecha_emision          timestamptz NOT NULL,
  fecha_vencimiento      date,                            -- calculada, NULL si es contado
  vencimiento_calculado  boolean     NOT NULL DEFAULT true,

  -- condición de pago
  condicion_venta        text        NOT NULL,            -- código crudo: '01','02','05',…
  condicion_venta_nombre text,                            -- 'Contado', 'Crédito', …
  plazo_credito          integer,                         -- días, tal como vienen

  -- plata
  moneda                 text        NOT NULL DEFAULT 'CRC',
  tipo_cambio            numeric,
  total_venta            numeric     NOT NULL DEFAULT 0,
  total_descuentos       numeric     NOT NULL DEFAULT 0,
  total_impuesto         numeric     NOT NULL DEFAULT 0,
  total_comprobante      numeric     NOT NULL DEFAULT 0,

  -- el ciclo (ver el diagrama de FACTURAS.md §3)
  estado                 text        NOT NULL DEFAULT 'recibida',

  -- quién hizo qué (esto reemplaza el sello de papel)
  recibida_por           text,
  fecha_recepcion        timestamptz,
  problema_detalle       text,
  en_qvet_por            text,
  fecha_qvet             timestamptz,
  etiquetas_impresas     boolean     NOT NULL DEFAULT false,
  soltada_a_pago_por     text,
  fecha_soltada_a_pago   timestamptz,
  pagada_por             text,
  fecha_pago             date,
  referencia_pago        text,
  comprobante_pago_url   text,

  -- nota de crédito → a cuál factura corrige (viene en InformacionReferencia del XML)
  corrige_clave          text,
  corrige_razon          text,

  -- de dónde salió (para poder ir por el PDF original al correo)
  correo_carpeta         text,
  correo_uid             text,
  correo_message_id      text,
  correo_asunto          text,
  correo_fecha           timestamptz,
  correo_de              text,

  -- el seguro barato: el XML tal cual, como texto. NO es un archivo.
  xml_crudo              text,

  -- lo que el robot no entendió
  necesita_revision      boolean     NOT NULL DEFAULT false,
  motivo_revision        text,

  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT facturas_estado_valido CHECK (estado IN (
    'recibida',              -- el robot la bajó del correo, nadie la ha tocado
    'mercaderia_recibida',   -- Recepción contó el producto contra la factura
    'con_problema',          -- faltó algo o llegó mal → Gerencia habla con el proveedor
    'en_inventario',         -- Gerencia la metió a QVet
    'por_pagar',             -- lista para Administración
    'pagada',                -- pagada, con comprobante
    'anulada'                -- una nota de crédito la dejó sin efecto
  )),
  CONSTRAINT facturas_tipo_valido CHECK (tipo_documento IN ('factura', 'nota_credito'))
);

CREATE INDEX IF NOT EXISTS idx_facturas_estado        ON public.facturas_proveedor (estado);
CREATE INDEX IF NOT EXISTS idx_facturas_vencimiento   ON public.facturas_proveedor (fecha_vencimiento)
  WHERE estado = 'por_pagar';
CREATE INDEX IF NOT EXISTS idx_facturas_proveedor_ced ON public.facturas_proveedor (proveedor_cedula);
CREATE INDEX IF NOT EXISTS idx_facturas_emision       ON public.facturas_proveedor (fecha_emision DESC);
CREATE INDEX IF NOT EXISTS idx_facturas_es_nuestra    ON public.facturas_proveedor (es_de_corral_del_sol);

-- ---------------------------------------------------------------- facturas_lineas
-- Una fila por producto. `cantidad` es lo que la factura DICE que viene;
-- `cantidad_recibida` es lo que de verdad llegó. La diferencia ES el faltante.
CREATE TABLE IF NOT EXISTS public.facturas_lineas (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  factura_id        bigint  NOT NULL REFERENCES public.facturas_proveedor(id) ON DELETE CASCADE,
  numero_linea      integer,
  codigo_comercial  text,                       -- código del proveedor (puente futuro con QVet)
  detalle           text    NOT NULL,           -- el nombre del producto
  cantidad          numeric NOT NULL DEFAULT 0,
  unidad_medida     text,
  precio_unitario   numeric NOT NULL DEFAULT 0,
  monto_descuento   numeric NOT NULL DEFAULT 0,
  monto_impuesto    numeric NOT NULL DEFAULT 0,
  monto_total_linea numeric NOT NULL DEFAULT 0,
  -- lo que Recepción marca con el producto en la mano
  cantidad_recibida numeric,                    -- NULL = todavía nadie la contó
  observacion       text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facturas_lineas_factura ON public.facturas_lineas (factura_id);

-- ---------------------------------------------------------------- facturas_eventos
-- La bitácora del recorrido. Esto es lo que hoy NO existe en ningún lado: hoy el sello de
-- papel dice quién recibió, y nada más. Acá queda todo el camino, con fecha y nombre.
CREATE TABLE IF NOT EXISTS public.facturas_eventos (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  factura_id  bigint NOT NULL REFERENCES public.facturas_proveedor(id) ON DELETE CASCADE,
  evento      text   NOT NULL,     -- 'creada', 'mercaderia_recibida', 'problema', 'qvet', 'pago'…
  quien       text,                -- nombre del colaborador, o 'robot'
  detalle     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facturas_eventos_factura ON public.facturas_eventos (factura_id, created_at DESC);

-- ---------------------------------------------------------------- seguridad
-- Mismo patrón que depositos_bancarios: RLS prendido SIN políticas. El service role (que usan
-- las API routes) la bypassa; la anon key no puede tocar nada. Toda escritura pasa por /api.
ALTER TABLE public.facturas_proveedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas_lineas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas_eventos   ENABLE ROW LEVEL SECURITY;
