ALTER TABLE publish_posts
  ADD COLUMN IF NOT EXISTS site_alert_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS news_publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_action_id uuid REFERENCES scheduled_actions(id) ON DELETE SET NULL;
