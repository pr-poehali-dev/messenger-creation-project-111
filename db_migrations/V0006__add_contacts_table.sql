CREATE TABLE IF NOT EXISTS t_p31400750_messenger_creation_p.contacts (
  owner_id   INTEGER NOT NULL REFERENCES t_p31400750_messenger_creation_p.users(id),
  contact_id INTEGER NOT NULL REFERENCES t_p31400750_messenger_creation_p.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (owner_id, contact_id)
);