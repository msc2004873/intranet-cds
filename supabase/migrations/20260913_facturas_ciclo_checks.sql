-- El ciclo de facturas como lo dictó Mario el 2026-09-13 (ver FACTURAS.md §8).
--
-- Qué cambia: el ciclo deja de ser "alguien empuja estados desde /admin" y pasa a ser
-- TRES BANDEJAS con checks — Recepción, Gerencia (QVet + marcado) y Administración (pago).
--
-- 🔑 NO HAY TABLAS NUEVAS y el CHECK de `estado` NO se toca: el estado lo calcula el
-- servidor a partir de los checks. Todo esto es aditivo, no migra ni borra un solo dato.
--
--  · `marcado_por` / `fecha_marcado`: faltaba el tercer check. `etiquetas_impresas` ya
--    existía como booleano suelto, pero sin quién ni cuándo no reemplaza al sello de papel.
--  · `facturas_lineas.tiene_error`: el error es POR PRODUCTO. Antes el problema era un texto
--    suelto para toda la factura (`problema_detalle`, escrito en un prompt), y con eso no se
--    le puede reclamar nada a un proveedor. La anotación de cada producto va en `observacion`,
--    que ya existía.
--
-- ⚠️ Los comentarios NO llevan tabla nueva: son filas de `facturas_eventos` con
--    `evento = 'comentario'`. Esa tabla ya guarda quién y cuándo.

ALTER TABLE public.facturas_proveedor
  ADD COLUMN IF NOT EXISTS marcado_por   text,
  ADD COLUMN IF NOT EXISTS fecha_marcado timestamptz;

ALTER TABLE public.facturas_lineas
  -- true = Recepción marcó este producto como malo (dañado, vencido, no era lo pedido…).
  -- Es distinto de que falte cantidad: puede llegar completo y estar malo.
  ADD COLUMN IF NOT EXISTS tiene_error boolean NOT NULL DEFAULT false;

-- La bandeja de Recepción pregunta siempre lo mismo: mercadería que nadie ha recibido.
CREATE INDEX IF NOT EXISTS idx_facturas_bandeja_recepcion
  ON public.facturas_proveedor (fecha_emision DESC)
  WHERE estado = 'recibida' AND es_mercaderia AND es_de_corral_del_sol;

-- Los productos con error se consultan para armar el reclamo al proveedor.
CREATE INDEX IF NOT EXISTS idx_facturas_lineas_error
  ON public.facturas_lineas (factura_id) WHERE tiene_error;
