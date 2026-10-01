-- Preview Neon: publish one test league product for player app catalog smoke tests.
-- Requires migration 0028_event_player_public_product on the target database.
--
-- Usage (preview DATABASE_URL only — never commit credentials):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/preview-publish-test-league-product.sql
--
-- Idempotent: skips insert if [PREVIEW] test row already exists; otherwise inserts one.

\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'published_to_player_app'
  ) THEN
    RAISE EXCEPTION 'Missing events.published_to_player_app — run drizzle/0028_event_player_public_product.sql first';
  END IF;
END $$;

-- Optional: publish the newest unpublished league event instead of inserting.
-- Uncomment and set the UUID, then comment out the INSERT block below.
/*
UPDATE events
SET
  published_to_player_app = true,
  public_description = 'Preview-only test listing for player app catalog smoke. Not a real registration.',
  location = 'Preview Gym — Boston, MA',
  event_end_date = event_date + interval '8 weeks',
  session_time_label = 'Tuesdays 6:30–9:00 PM',
  price_cents = 7500,
  capacity = 48,
  registration_opens_at = now() - interval '1 day',
  registration_closes_at = event_date - interval '7 days',
  updated_at = now()
WHERE id = '00000000-0000-0000-0000-000000000000'::uuid;
*/

INSERT INTO events (
  name,
  event_date,
  event_type,
  event_format,
  ball_type,
  gender,
  published_to_player_app,
  public_description,
  location,
  event_end_date,
  session_time_label,
  price_cents,
  capacity,
  registration_opens_at,
  registration_closes_at
)
SELECT
  '[PREVIEW] Player catalog test league',
  (current_date + interval '14 days')::date,
  'league',
  'byot',
  'foam',
  'mixed',
  true,
  'Synthetic preview product for GET /api/public/leagues `products[]` smoke tests.',
  'Preview Gym — Boston, MA',
  (current_date + interval '70 days')::date,
  'Wednesdays 7:00–9:30 PM',
  6500,
  40,
  now() - interval '1 hour',
  (current_date + interval '7 days')::timestamptz
WHERE NOT EXISTS (
  SELECT 1 FROM events WHERE name = '[PREVIEW] Player catalog test league'
);

SELECT id, name, event_date, published_to_player_app
FROM events
WHERE name = '[PREVIEW] Player catalog test league'
   OR published_to_player_app = true
ORDER BY event_date DESC
LIMIT 5;
