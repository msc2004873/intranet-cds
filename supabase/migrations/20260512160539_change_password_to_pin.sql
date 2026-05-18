-- Add pin column and set default for existing records
ALTER TABLE colaboradores ADD COLUMN pin TEXT;
UPDATE colaboradores SET pin = '1234' WHERE pin IS NULL;
ALTER TABLE colaboradores ALTER COLUMN pin SET NOT NULL;

-- Drop old password_hash column
ALTER TABLE colaboradores DROP COLUMN password_hash;
