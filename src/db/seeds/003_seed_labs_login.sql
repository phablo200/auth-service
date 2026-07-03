INSERT INTO applications (id, name, created_at, created_by, updated_at, updated_by, deleted)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'Labs Login',
    NOW(),
    NULL,
    NOW(),
    NULL,
    FALSE
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    deleted = EXCLUDED.deleted,
    updated_at = NOW();
