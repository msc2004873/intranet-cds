-- Corregir a mano si una factura es mercadería o gasto, y que el robot lo aprenda.
-- Nace de un error real (2026-09-13): Mario no encontraba la factura 9097 de Thinko.
--
-- 🔍 QUÉ HABÍA PASADO: son **placas de identificación para mascotas** (corazón, hueso,
-- círculo, de aluminio) — mercadería del pet shop. Pero su código CABYS es `4153402990000`,
-- y el prefijo `41` está mapeado a «Ferretería y construcción» porque con él llegaron las
-- láminas de techo. Resultado: la factura quedó marcada como GASTO, y un gasto no pasa por
-- Recepción de mercadería. Se volvió invisible para quien la buscaba.
--
-- 🚨 LA LECCIÓN: **el CABYS no alcanza para decidir mercadería vs gasto.** El mismo código
-- de "artículo de metal" cubre una placa que se vende y un tornillo para arreglar un portón.
-- Con 55 proveedores esto iba a volver a pasar, y hoy la única forma de corregirlo era que
-- alguien editara el código del robot. Por eso:
--
--  1. `clasificacion_manual` marca la factura que una persona corrigió → el robot NO la
--     vuelve a pisar cuando se corre `--reclasificar`.
--  2. `proveedores_clasificacion` guarda la decisión **por proveedor**, así que las facturas
--     que ese proveedor mande DESPUÉS entran ya bien. El robot aprende de la corrección en
--     vez de repetir el error.

ALTER TABLE public.facturas_proveedor
  ADD COLUMN IF NOT EXISTS clasificacion_manual boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.proveedores_clasificacion (
  -- La cédula, nunca el nombre: el mismo proveedor lo escribe de varias formas.
  cedula           text PRIMARY KEY,
  proveedor_nombre text,
  es_mercaderia    boolean     NOT NULL,
  categoria        text,
  quien            text,
  nota             text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Mismo patrón que el resto del módulo: RLS prendido sin políticas. El service role (las
-- API routes y el robot) la usa; la anon key no toca nada.
ALTER TABLE public.proveedores_clasificacion ENABLE ROW LEVEL SECURITY;
