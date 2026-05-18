-- Update AD to 2 chars if needed
UPDATE colaboradores SET iniciales = SUBSTRING(iniciales, 1, 2) WHERE LENGTH(iniciales) > 2;

-- Add check constraint for iniciales length (2 chars)
ALTER TABLE colaboradores ADD CONSTRAINT check_iniciales_length CHECK (LENGTH(iniciales) = 2);
