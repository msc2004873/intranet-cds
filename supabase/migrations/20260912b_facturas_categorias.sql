-- Clasificación de facturas: separar mercadería de gastos (2026-09-12).
--
-- Lo pidió Mario: "¿cómo separamos lo que es mercadería y servicios o productos que no van
-- para la vete, como gasolina, pagos de leasing? ¿cómo con código las dividimos?".
--
-- 🔑 LA RESPUESTA ES EL CÓDIGO CABYS, y viene en el 100% de las líneas (comprobado sobre
-- 506 líneas reales): en facturas v4.3 la etiqueta se llama <Codigo> y en v4.4 <CodigoCABYS>.
-- Es el catálogo oficial de Hacienda, así que NADIE tiene que teclear ni escoger nada.
--
-- Estructura: el PRIMER DÍGITO separa bienes de servicios (1-4 = cosa física, 5 =
-- construcción, 6-9 = servicio). Los dos primeros dígitos dan la categoría fina, y el mapa
-- de categorías se armó LEYENDO LAS FACTURAS DE LA CLÍNICA, no adivinando.
--
-- ⚠️ Existe una tabla vieja `cabys_categorias` (julio 2026) con 9 prefijos que su propia
-- descripción admite que eran adivinados ("ajustar con facturas reales"). NO se usa: el mapa
-- vive en `cds-agentes/facturas.js` (constante CATEGORIAS_CABYS), que es donde se puede
-- reprocesar. Si se cambia el mapa, se reprocesa con `node facturas.js --reclasificar`,
-- que lee el `xml_crudo` guardado y NO vuelve a tocar el correo.

ALTER TABLE public.facturas_lineas
  ADD COLUMN IF NOT EXISTS cabys     text,
  ADD COLUMN IF NOT EXISTS categoria text;

ALTER TABLE public.facturas_proveedor
  -- categoría dominante de la factura (la que más plata pesa entre sus líneas)
  ADD COLUMN IF NOT EXISTS categoria     text,
  -- ¿es mercadería que entra al inventario de la clínica? Esto es lo que decide si la
  -- factura pasa por "recibir mercadería" o si es un gasto que solo hay que pagar.
  ADD COLUMN IF NOT EXISTS es_mercaderia boolean NOT NULL DEFAULT true,
  -- true cuando la factura mezcla mercadería y gastos: hay que mirarla con más cuidado
  ADD COLUMN IF NOT EXISTS categoria_mixta boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_facturas_categoria    ON public.facturas_proveedor (categoria);
CREATE INDEX IF NOT EXISTS idx_facturas_mercaderia   ON public.facturas_proveedor (es_mercaderia);
CREATE INDEX IF NOT EXISTS idx_facturas_lineas_cabys ON public.facturas_lineas (cabys);
