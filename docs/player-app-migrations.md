# Player app — database migration plan

Operational Neon (`DATABASE_URL`) and sensitive Neon (`SENSITIVE_DATABASE_URL`) are separate. The player app never receives `DATABASE_URL`.

## Stage 0 (this branch)

- **Operational** `drizzle/0026_player_app_stage0.sql`: adds `players.self_reported_skill`, `players.player_app_account_id`.
- **Sensitive** `drizzle-sensitive/0000_sensitive_player_data.sql`: creates `player_official_skill`, `player_personality`, `player_person_notes`, and `player_changes` on the sensitive database.
- App code dual-writes `player_changes` and official skill/personality updates when `SENSITIVE_DATABASE_URL` is set; reads prefer sensitive rows when present.

Apply sensitive SQL manually (or via a future `db:migrate:sensitive` script) against the sensitive Neon project:

```bash
# Example: psql "$SENSITIVE_DATABASE_URL" -f drizzle-sensitive/0000_sensitive_player_data.sql
```

## Stage 1+ (planned)

1. Backfill sensitive tables from operational `players` and `player_changes`.
2. Verify admin + player sync against sensitive-only reads.
3. **Operational** migration (future `0027+`): drop `skill_level`, `skill_level_fib`, `skill_areas`, `has_strong_personality`, `strong_personality_notes` from `players`; drop operational `player_changes` after cutover.

Do not drop operational columns until backfill and dual-write verification are complete in preview.
