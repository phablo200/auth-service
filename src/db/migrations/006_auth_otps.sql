CREATE TABLE auth_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL,
  user_id UUID NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  attempts INT DEFAULT 0,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT fk_auth_otps_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_auth_otps_user_id ON auth_otps(user_id);
CREATE INDEX idx_auth_otps_expires_at ON auth_otps(expires_at);
