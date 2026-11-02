CREATE TABLE IF NOT EXISTS scheduled_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_admin_email text NOT NULL,
  run_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'America/New_York',
  action_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'scheduled',
  idempotency_key text,
  error_message text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scheduled_actions_status_run_at_idx
  ON scheduled_actions (status, run_at);

CREATE UNIQUE INDEX IF NOT EXISTS scheduled_actions_idempotency_key_uidx
  ON scheduled_actions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
