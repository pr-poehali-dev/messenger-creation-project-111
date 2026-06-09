CREATE TABLE IF NOT EXISTS t_p31400750_messenger_creation_p.blocked_users (
  blocker_id INTEGER NOT NULL REFERENCES t_p31400750_messenger_creation_p.users(id),
  blocked_id INTEGER NOT NULL REFERENCES t_p31400750_messenger_creation_p.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);