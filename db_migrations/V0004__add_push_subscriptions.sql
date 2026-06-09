CREATE TABLE t_p31400750_messenger_creation_p.push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);
CREATE INDEX idx_push_subscriptions_user ON t_p31400750_messenger_creation_p.push_subscriptions(user_id);
