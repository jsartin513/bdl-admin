# Drizzle migrations (prevent / debug)

Deploy applies pending migrations automatically: `npm run build` → `db:migrate:deploy` → `drizzle-kit migrate` when `DATABASE_URL` is set (see [`scripts/migrate-on-deploy.mjs`](../scripts/migrate-on-deploy.mjs)).

**Only journaled migrations run.** A SQL file under `drizzle/` that is missing from `drizzle/meta/_journal.json` is ignored forever. That is how prod can ship schema/code that expects a column the DB never got.

## Adding a schema change (checklist)

1. Update [`app/db/schema.ts`](../app/db/schema.ts).
2. Prefer generating the migration (keeps journal + SQL in sync):

   ```bash
   npm run db:generate
   ```

3. If you must hand-write SQL:
   - Use the **next unused** numeric prefix (`0000` …). Never reuse a number already on another tag.
   - Add a matching entry to [`drizzle/meta/_journal.json`](../drizzle/meta/_journal.json):
     - `idx`: next integer (0-based)
     - `tag`: filename without `.sql` (e.g. `0011_event_pairing_enabled`)
     - `breakpoints`: `true` (same as existing entries)
   - Confirm `ls drizzle/*.sql` has **exactly one** file per journal `tag`.
4. Before merging, verify locally:

   ```bash
   # journal tags must match SQL basenames
   node -e "
   const j=require('./drizzle/meta/_journal.json');
   const fs=require('fs');
   const tags=new Set(j.entries.map(e=>e.tag));
   const files=fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).map(f=>f.replace(/\\.sql$/,''));
   const unjournaled=files.filter(t=>!tags.has(t));
   const missing=j.entries.map(e=>e.tag).filter(t=>!files.includes(t));
   if (unjournaled.length||missing.length) {
     console.error({unjournaled, missing});
     process.exit(1);
   }
   console.log('ok', j.entries.length, 'migrations');
   "
   ```

5. After merge: check the Vercel **Production** build log for `[db:migrate:deploy] Applying pending Drizzle migrations…` and no drizzle errors. Then hit an endpoint that reads the new column/table.

## Symptoms of a missing / unjournaled migration

| Symptom | Likely cause |
|--------|----------------|
| Prod 500 on `/events` or event APIs right after a schema PR | Code selects a new column; DB never altered |
| Postgres: `column "…" does not exist` / `relation "…" does not exist` | Migration SQL never applied |
| SQL file exists in repo but prod DB lacks the change | Tag missing from `_journal.json`, or wrong/duplicate prefix so you thought it shipped |
| `drizzle-kit migrate` says nothing to do | Journal has no pending entries (unjournaled SQL does not count) |

## Debug steps

1. Compare schema field ↔ latest SQL ↔ journal tag for that change.
2. Confirm Production deploy used the merge commit SHA that includes the journal entry.
3. In Neon (or any SQL client on `DATABASE_URL`): `\d events` / `information_schema.columns` for the expected column.
4. If the column is missing but SQL+journal are correct: re-run migrate with Production `DATABASE_URL` (`npm run db:migrate`) or redeploy `main`.
5. If SQL exists but is unjournaled: add the journal entry (new `idx`/`tag`), ship a follow-up PR, redeploy. Prefer renaming if the prefix already collides (`0010_*` twice is invalid).

## Do not

- Drop a lone `.sql` file into `drizzle/` without updating `_journal.json`.
- Reuse a migration number already used by another tag (e.g. two `0010_*.sql` files).
- Change CI/workflows to skip migrate failures in order to “make the build green.”
- Assume Preview success proves Production schema: Preview and Production are separate DBs unless configured otherwise; both need migrate on their own deploys.

## Related

- Env / Neon setup: [players-and-auth-runbook.md](./players-and-auth-runbook.md)
- Migrations live in [`drizzle/`](../drizzle/); journal in [`drizzle/meta/_journal.json`](../drizzle/meta/_journal.json)
