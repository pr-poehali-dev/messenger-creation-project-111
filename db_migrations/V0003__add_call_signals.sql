CREATE TABLE t_p31400750_messenger_creation_p.call_signals (
  id SERIAL PRIMARY KEY,
  call_id TEXT NOT NULL,
  from_user_id INTEGER NOT NULL,
  to_user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_call_signals_to_user ON t_p31400750_messenger_creation_p.call_signals (to_user_id, created_at);
CREATE INDEX idx_call_signals_call_id ON t_p31400750_messenger_creation_p.call_signals (call_id);
