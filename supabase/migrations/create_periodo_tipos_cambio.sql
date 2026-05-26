CREATE TABLE IF NOT EXISTS public.periodo_tipos_cambio (
  id BIGSERIAL PRIMARY KEY,
  ano INT NOT NULL,
  mes INT NOT NULL,
  periodo_num INT NOT NULL,
  tipo_cambio INT NOT NULL,
  tipo_cambio_bruto INT,
  fecha_registro TIMESTAMP DEFAULT NOW(),
  UNIQUE(ano, mes, periodo_num)
);
