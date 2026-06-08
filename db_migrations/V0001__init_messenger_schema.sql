
CREATE TABLE IF NOT EXISTS t_p31400750_messenger_creation_p.users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  bio           TEXT DEFAULT '',
  phone         TEXT DEFAULT '',
  avatar_seed   TEXT DEFAULT '1',
  online        BOOLEAN DEFAULT FALSE,
  last_seen     TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p31400750_messenger_creation_p.sessions (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES t_p31400750_messenger_creation_p.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE TABLE IF NOT EXISTS t_p31400750_messenger_creation_p.chats (
  id           SERIAL PRIMARY KEY,
  type         TEXT NOT NULL CHECK (type IN ('direct','group','channel')),
  name         TEXT,
  avatar_seed  TEXT DEFAULT 'group1',
  description  TEXT DEFAULT '',
  created_by   INTEGER REFERENCES t_p31400750_messenger_creation_p.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p31400750_messenger_creation_p.chat_members (
  chat_id   INTEGER NOT NULL REFERENCES t_p31400750_messenger_creation_p.chats(id),
  user_id   INTEGER NOT NULL REFERENCES t_p31400750_messenger_creation_p.users(id),
  role      TEXT DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS t_p31400750_messenger_creation_p.messages (
  id         SERIAL PRIMARY KEY,
  chat_id    INTEGER NOT NULL REFERENCES t_p31400750_messenger_creation_p.chats(id),
  sender_id  INTEGER REFERENCES t_p31400750_messenger_creation_p.users(id),
  text       TEXT NOT NULL,
  type       TEXT DEFAULT 'text' CHECK (type IN ('text','image','file')),
  file_url   TEXT,
  file_name  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p31400750_messenger_creation_p.message_reads (
  message_id INTEGER NOT NULL REFERENCES t_p31400750_messenger_creation_p.messages(id),
  user_id    INTEGER NOT NULL REFERENCES t_p31400750_messenger_creation_p.users(id),
  read_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON t_p31400750_messenger_creation_p.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON t_p31400750_messenger_creation_p.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON t_p31400750_messenger_creation_p.chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON t_p31400750_messenger_creation_p.sessions(user_id);
