import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      deleted BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by UUID,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by UUID
    );

    CREATE TABLE applications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by UUID,
      updated_at TIMESTAMPTZ,
      updated_by UUID,
      deleted BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password VARCHAR(255),
      deleted BOOLEAN NOT NULL DEFAULT FALSE,
      profile_id UUID,
      application_id UUID,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by UUID,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by UUID,
      CONSTRAINT fk_users_profile_id
        FOREIGN KEY (profile_id) REFERENCES profiles(id),
      CONSTRAINT fk_users_application_id
        FOREIGN KEY (application_id) REFERENCES applications(id),
      CONSTRAINT fk_users_created_by
        FOREIGN KEY (created_by) REFERENCES users(id),
      CONSTRAINT fk_users_updated_by
        FOREIGN KEY (updated_by) REFERENCES users(id)
    );

    ALTER TABLE profiles
      ADD CONSTRAINT fk_profiles_created_by
      FOREIGN KEY (created_by)
      REFERENCES users(id);

    ALTER TABLE profiles
      ADD CONSTRAINT fk_profiles_updated_by
      FOREIGN KEY (updated_by)
      REFERENCES users(id);

    ALTER TABLE applications
      ADD CONSTRAINT fk_applications_created_by
      FOREIGN KEY (created_by)
      REFERENCES users(id);

    ALTER TABLE applications
      ADD CONSTRAINT fk_applications_updated_by
      FOREIGN KEY (updated_by)
      REFERENCES users(id);

    CREATE UNIQUE INDEX idx_users_application_email_unique
      ON users (application_id, lower(email))
      WHERE application_id IS NOT NULL;

    CREATE TABLE password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_password_reset_tokens_user_id
      ON password_reset_tokens(user_id);

    CREATE INDEX idx_password_reset_tokens_token_hash
      ON password_reset_tokens(token_hash);

    CREATE TABLE auth_otps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      application_id UUID NOT NULL REFERENCES applications(id),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      used BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_auth_otps_user_id
      ON auth_otps(user_id);

    CREATE INDEX idx_auth_otps_expires_at
      ON auth_otps(expires_at);

    CREATE TABLE oauth_states (
      state_hash TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      application_id UUID NOT NULL REFERENCES applications(id),
      redirect_uri TEXT NOT NULL,
      code_verifier TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_oauth_states_expires_at
      ON oauth_states(expires_at);

    CREATE TABLE oauth_identities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      application_id UUID NOT NULL REFERENCES applications(id),
      user_id UUID NOT NULL REFERENCES users(id),
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT oauth_identities_application_provider_user_unique
        UNIQUE (application_id, provider, provider_user_id)
    );

    CREATE INDEX idx_oauth_identities_user_id
      ON oauth_identities(user_id);

    CREATE INDEX idx_oauth_identities_application_email
      ON oauth_identities(application_id, lower(email));

    CREATE TABLE oauth_login_exchanges (
      code_hash TEXT PRIMARY KEY,
      application_id UUID NOT NULL REFERENCES applications(id),
      user_id UUID NOT NULL REFERENCES users(id),
      provider TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_oauth_login_exchanges_expires_at
      ON oauth_login_exchanges(expires_at);
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DROP TABLE IF EXISTS oauth_login_exchanges;
    DROP TABLE IF EXISTS oauth_identities;
    DROP TABLE IF EXISTS oauth_states;
    DROP TABLE IF EXISTS auth_otps;
    DROP TABLE IF EXISTS password_reset_tokens;

    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS fk_profiles_updated_by;
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS fk_profiles_created_by;
    ALTER TABLE applications DROP CONSTRAINT IF EXISTS fk_applications_updated_by;
    ALTER TABLE applications DROP CONSTRAINT IF EXISTS fk_applications_created_by;

    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS applications;
    DROP TABLE IF EXISTS profiles;
  `);
}
