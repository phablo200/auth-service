ALTER TABLE users
ALTER COLUMN password DROP NOT NULL;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT c.conname
  INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'users'
    AND c.contype = 'u'
    AND (
      SELECT array_agg(a.attname ORDER BY a.attname)
      FROM unnest(c.conkey) AS cols(attnum)
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = cols.attnum
    ) = ARRAY['email']::name[]
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_application_email_unique
ON users (application_id, lower(email))
WHERE application_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  application_id UUID NOT NULL REFERENCES applications(id),
  redirect_uri TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at
ON oauth_states(expires_at);

CREATE TABLE IF NOT EXISTS oauth_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id),
  user_id UUID NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_identities_user_id
ON oauth_identities(user_id);

CREATE INDEX IF NOT EXISTS idx_oauth_identities_application_email
ON oauth_identities(application_id, lower(email));

CREATE TABLE IF NOT EXISTS oauth_login_exchanges (
  code_hash TEXT PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES applications(id),
  user_id UUID NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_login_exchanges_expires_at
ON oauth_login_exchanges(expires_at);
