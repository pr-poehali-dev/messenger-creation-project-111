
ALTER TABLE t_p31400750_messenger_creation_p.users
  ADD COLUMN IF NOT EXISTS email TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
  ON t_p31400750_messenger_creation_p.users(email)
  WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS t_p31400750_messenger_creation_p.email_codes (
  id         SERIAL PRIMARY KEY,
  email      TEXT NOT NULL,
  code       TEXT NOT NULL,
  name       TEXT NOT NULL,
  username   TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  phone      TEXT DEFAULT '',
  avatar_seed TEXT DEFAULT '1',
  attempts   INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_email_codes_email ON t_p31400750_messenger_creation_p.email_codes(email);
