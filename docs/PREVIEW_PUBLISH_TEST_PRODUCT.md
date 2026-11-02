# Preview Neon — publish a test league product

Use this on **admin preview** operational Neon (`DATABASE_URL` for `admin-preview.bostondodgeballleague.com`) so the player app catalog can list at least one sellable league product.

## Prerequisites

1. **Migration `0028_event_player_public_product` must be applied** on preview Neon before any `UPDATE`/`INSERT` below. The migration adds player-facing product columns on `events` (`published_to_player_app`, `public_description`, `location`, `event_end_date`, `session_time_label`, `price_cents`, `capacity`, `registration_opens_at`, `registration_closes_at`).

   - **Automatic:** Vercel preview builds run `npm run db:migrate:deploy` when `DATABASE_URL` is set.
   - **Manual:** from a machine with preview `DATABASE_URL`:

     ```bash
     npm run db:migrate
     # or: psql "$DATABASE_URL" -f drizzle/0028_event_player_public_product.sql
     ```

2. Confirm the column exists (should return one row):

   ```sql
   SELECT column_name
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'events'
     AND column_name = 'published_to_player_app';
   ```

   If this returns no rows, stop and apply migration 0028 first.

## Option A — Publish an existing event (preferred)

Pick a **league** event you already use in preview admin (drafts, schedules, etc.):

```sql
-- Candidates (not yet published)
SELECT id, name, event_date, event_type, event_format
FROM events
WHERE published_to_player_app = false
  AND event_type = 'league'
ORDER BY event_date DESC
LIMIT 10;
```

Replace `:event_id` with a chosen `id`, then:

```sql
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
WHERE id = ':event_id'::uuid;
```

To **unpublish** the same row later:

```sql
UPDATE events
SET published_to_player_app = false, updated_at = now()
WHERE id = ':event_id'::uuid;
```

## Option B — Insert a minimal test event

Use only if preview has no suitable league event. Generates a dedicated row (safe to delete when done).

```sql
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
VALUES (
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
)
RETURNING id, name, event_date;
```

Remove the test row:

```sql
DELETE FROM events
WHERE name = '[PREVIEW] Player catalog test league'
  AND published_to_player_app = true;
```

## Verify

1. **SQL** — at least one published row:

   ```sql
   SELECT id, name, event_date, price_cents, capacity
   FROM events
   WHERE published_to_player_app = true
   ORDER BY event_date DESC;
   ```

2. **HTTP** — catalog includes `products` (version 2):

   ```bash
   curl -sS 'https://admin-preview.bostondodgeballleague.com/api/public/leagues' | jq '.version, .products | length, .products[0]'
   ```

   Expect `version` **2** and `products` length **≥ 1**. Each product exposes only allowlisted fields (`id`, `name`, `startDate`, `endDate`, `time`, `location`, `format`, `priceCents`, `capacity`, registration windows, `publicDescription`) — see `app/lib/player-public/league-products.ts`.

## Scripted copy

The same SQL lives in [`scripts/preview-publish-test-league-product.sql`](../scripts/preview-publish-test-league-product.sql) for `psql -f` (no secrets in the file; connection string stays in your env).

## Related docs

- Migration journal entry: `drizzle/0028_event_player_public_product.sql`
- Operational vs sensitive DB plan: [player-app-migrations.md](./player-app-migrations.md)
- Player catalog URL: [player-app-kickoff.md](./player-app-kickoff.md)
