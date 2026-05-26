-- Agregar columnas tipo_cambio_real y tipo_cambio_ajustado
ALTER TABLE public.periodos_tipo_cambio
ADD COLUMN tipo_cambio_real INT,
ADD COLUMN tipo_cambio_ajustado INT;

-- Copiar datos existentes: tipo_cambio actual contiene el ajustado
-- tipo_cambio_real = tipo_cambio + 10
UPDATE public.periodos_tipo_cambio
SET
  tipo_cambio_real = tipo_cambio + 10,
  tipo_cambio_ajustado = tipo_cambio
WHERE tipo_cambio_real IS NULL;
