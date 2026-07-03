-- Módulo de depósitos bancarios: tabla padre + FK en depositos_cds.
-- Un depósito bancario agrupa N períodos (filas de depositos_cds). El período queda
-- "pendiente" mientras deposito_bancario_id IS NULL; su estado (En progreso / Depositado)
-- se deriva del estado del depósito ligado.
-- NOTA: depositos_cds ya existía en la DB viva sin migración en el repo; esta migración
-- solo agrega la capa nueva y se aplicó vía Supabase MCP (no `db push`).

CREATE TABLE IF NOT EXISTS public.depositos_bancarios (
  id                       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  estado                   text        NOT NULL DEFAULT 'en_progreso', -- 'en_progreso' | 'completado'
  -- conteo del depositante (se cuenta por denominación en la UI, pero SOLO se guarda el total)
  total_contado_colones    numeric     NOT NULL DEFAULT 0,
  total_contado_usd        numeric     NOT NULL DEFAULT 0,
  -- snapshot del conteo de referencia (suma de depositos_cds de los períodos unificados)
  total_referencia_colones numeric     NOT NULL DEFAULT 0,
  total_referencia_usd     numeric     NOT NULL DEFAULT 0,
  contado_por              text,                        -- depositante que contó al registrar
  fecha_conteo             date,                        -- fecha del conteo (registro), CR
  -- datos del depósito físico (se llenan al completar)
  banco                    text,                        -- 'BAC'
  referencia               text,                        -- # boleta / referencia
  comprobante_url          text,                        -- foto en Storage (opcional)
  fecha_deposito           date,
  completado_por           text,                        -- quién depositó
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);

ALTER TABLE public.depositos_cds
  ADD COLUMN IF NOT EXISTS deposito_bancario_id bigint;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'depositos_cds_deposito_bancario_id_fkey') THEN
    ALTER TABLE public.depositos_cds
      ADD CONSTRAINT depositos_cds_deposito_bancario_id_fkey
      FOREIGN KEY (deposito_bancario_id) REFERENCES public.depositos_bancarios(id)
      ON DELETE SET NULL;                                -- borrar depósito libera los períodos
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_depositos_cds_deposito_bancario_id
  ON public.depositos_cds (deposito_bancario_id);

-- RLS habilitado sin políticas: el service role (usado por las API routes) la bypassa;
-- el anon key no puede tocarla. Toda escritura pasa por /api/depositos-bancarios.
ALTER TABLE public.depositos_bancarios ENABLE ROW LEVEL SECURITY;
