-- Create user table without FK constraints
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE,
    profile_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID
);

-- Create profile table without FK constraints
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID
);

-- Add FK constraints after both tables are created

-- users.profile_id → profiles(id)
ALTER TABLE users
    ADD CONSTRAINT fk_users_profile_id
    FOREIGN KEY (profile_id)
    REFERENCES profiles(id);

-- users.created_by → users(id)
ALTER TABLE users
    ADD CONSTRAINT fk_users_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id);

-- users.updated_by → users(id)
ALTER TABLE users
    ADD CONSTRAINT fk_users_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES users(id);

-- profiles.created_by → users(id)
ALTER TABLE profiles
    ADD CONSTRAINT fk_profiles_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id);

-- profiles.updated_by → users(id)
ALTER TABLE profiles
    ADD CONSTRAINT fk_profiles_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES users(id);
