-- Los dólares que cuenta la revisora nunca se guardaban: FormularioRevision los
-- enviaba pero /api/revisionCaja los descartaba y no había columna donde ponerlos.
-- Sin esto, la auditoría no puede comparar el efectivo contra QVet (que reporta
-- todo en colones, con los dólares ya convertidos).
--
-- Queda NULLABLE a propósito, sin default 0: NULL = "esta revisión es vieja y nunca
-- se capturó"; 0 = "la revisora contó y no había dólares". generateAuditRows usa esa
-- diferencia para no inventar discrepancias en las revisiones ya hechas.
ALTER TABLE revision_caja
  ADD COLUMN IF NOT EXISTS dolares_revisado numeric;

COMMENT ON COLUMN revision_caja.dolares_revisado IS
  'Dólares (USD) contados por la revisora. Se convierten a colones con revision_caja.tc para comparar contra QVet. NULL = revisión anterior a agosto 2026, no se capturó.';
