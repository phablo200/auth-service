INSERT INTO applications (name, created_at, created_by, updated_at, updated_by, deleted)
SELECT
    'MeLabs',
    NOW(),
    NULL,
    NOW(),
    NULL,
    FALSE
WHERE NOT EXISTS (
    SELECT 1
    FROM applications
    WHERE name = 'MeLabs'
);

UPDATE applications
SET
    deleted = FALSE,
    updated_at = NOW()
WHERE name = 'MeLabs';
