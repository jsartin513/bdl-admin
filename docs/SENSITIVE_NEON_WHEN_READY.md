# Sensitive Neon — when you are ready

Use this only after operational player-app work is in place on preview (Stage 0+). No schema work lives in this file.

**Full migration plan, SQL paths, and cutover order:** [player-app-migrations.md](./player-app-migrations.md)

**At a glance:**

1. Provision the sensitive Neon project and set `SENSITIVE_DATABASE_URL` on admin (preview first).
2. Apply `drizzle-sensitive/0000_sensitive_player_data.sql` against that database (see the migrations doc).
3. Run backfill and dual-write verification before dropping operational columns (Stage 1+ in the migrations doc).
