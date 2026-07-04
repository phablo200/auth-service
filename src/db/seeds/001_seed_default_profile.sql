-- Stable fixture ID used by DEFAULT_PROFILE_ID.
INSERT INTO profiles (id, name, deleted, created_at, created_by, updated_at, updated_by)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Default Profile',
    FALSE,
    NOW(),
    NULL,
    NOW(),
    NULL
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    deleted = EXCLUDED.deleted,
    updated_at = NOW();
