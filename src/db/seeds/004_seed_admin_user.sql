-- Stable fixture ID used by DEFAULT_USER_ID.
INSERT INTO users (
    id,
    application_id,
    name,
    email,
    password,
    deleted,
    profile_id,
    created_at,
    created_by,
    updated_at,
    updated_by
)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    'Admin User',
    'admin@example.com',
    -- bcrypt hash for the local fixture password.
    '$2b$10$JjQk3xTjEzF/1eEc9Lb/NeILi6dnOb8Bcoi4R8AXLTq1nRNP9nvae',
    FALSE,
    '00000000-0000-0000-0000-000000000001',
    NOW(),
    NULL,
    NOW(),
    NULL
)
ON CONFLICT (id) DO UPDATE SET
    application_id = EXCLUDED.application_id,
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    password = EXCLUDED.password,
    deleted = EXCLUDED.deleted,
    profile_id = EXCLUDED.profile_id,
    updated_at = NOW();
