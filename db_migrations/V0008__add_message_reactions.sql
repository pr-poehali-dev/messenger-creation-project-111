CREATE TABLE IF NOT EXISTS t_p31400750_messenger_creation_p.message_reactions (
  id         SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES t_p31400750_messenger_creation_p.messages(id),
  user_id    INTEGER NOT NULL REFERENCES t_p31400750_messenger_creation_p.users(id),
  emoji      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON t_p31400750_messenger_creation_p.message_reactions(message_id);
