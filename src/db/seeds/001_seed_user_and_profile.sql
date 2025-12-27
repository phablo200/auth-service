-- Insert a profile
INSERT INTO profiles (id, name, deleted, created_at, created_by, updated_at, updated_by)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Default Profile',
    FALSE,
    NOW(),
    NULL,
    NOW(),
    NULL
);

-- Insert a user linked to the above profile
INSERT INTO users (id, name, email, password, deleted, profile_id, created_at, created_by, updated_at, updated_by)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'Admin User',
    'admin@example.com',
    -- This is a bcrypt hash of 'password' example, change as needed
    '$2b$10$JjQk3xTjEzF/1eEc9Lb/NeILi6dnOb8Bcoi4R8AXLTq1nRNP9nvae',
    FALSE,
    '00000000-0000-0000-0000-000000000001',
    NOW(),
    NULL,
    NOW(),
    NULL
);
