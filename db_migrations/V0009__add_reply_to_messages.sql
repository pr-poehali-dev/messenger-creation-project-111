ALTER TABLE t_p31400750_messenger_creation_p.messages
  ADD COLUMN IF NOT EXISTS reply_to_id INTEGER REFERENCES t_p31400750_messenger_creation_p.messages(id);
