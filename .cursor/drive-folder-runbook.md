# Google Drive Templates Folder Runbook

## Folder

**URL:** https://drive.google.com/drive/folders/1Xnd7hzIzs2QE2IOnPBfQPO8jTXwvsABj  
**ID:** `1Xnd7hzIzs2QE2IOnPBfQPO8jTXwvsABj`

This folder is the single source of truth for all league schedule sheets shown in
the Schedules viewer, the Create League template picker, and the Timer page.

---

## Files to Upload / Keep in the Folder

Upload each local `.xlsx` file via **Google Drive → New → File upload**, then
**right-click → Open with Google Sheets** so Drive stores it as a native Google
Sheet (required for the Sheets API endpoints the app uses).

| Local file | Suggested Google Sheet name | Purpose |
|---|---|---|
| `public/league_templates/Four Team She_They League.xlsx` | `Four Team She/They League` | 4-team she/they template |
| `public/league_templates/Six Team League.xlsx` | `Six Team League` | 6-team template (matches Winter 2026 BYOT structure with color names) |
| `public/league_templates/Seven Team League.xlsx` | `Seven Team League` | 7-team template (18 rounds, R18 single-court) |
| Any future active league spreadsheet | `<Season> <Name> League` | Add new seasons here |

**Do NOT upload:**
- `Public * Standings.xlsx` (standings-only, no week tabs)
- `*.backup-pre-*.xlsx` (backup snapshots)
- `*_Import.xlsx` or `*_Week*_Import.xlsx` (import helpers)

The `/api/drive-folder` route also filters these out server-side by name pattern
for safety.

---

## Required Environment Variables

Set these in `.env.local` (local dev) and in Vercel project settings (production):

```
GOOGLE_DRIVE_FOLDER_ID=1Xnd7hzIzs2QE2IOnPBfQPO8jTXwvsABj
GOOGLE_DRIVE_API_KEY=<your Google Cloud API key>
```

### Getting a Google API key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable **Google Drive API** and **Google Sheets API** on your project
3. Create an API key under **Credentials → + Create Credentials → API key**
4. Restrict the key to those two APIs and your production domain (optional but recommended)
5. Make the Drive folder **public / Anyone with the link can view**

---

## Folder Access

For the Drive API and Sheets gviz endpoints to work without OAuth:

1. Open the Drive folder
2. Share → Change to "Anyone with the link" → Viewer
3. Each individual Google Sheet inside also inherits this sharing, but confirm the
   first time you upload.

---

## Verification Checklist

After changing folder contents or env vars, check:

| Route | Expected result |
|---|---|
| `GET /api/drive-folder` | JSON array with `{id, name}` for each sheet in the folder; no standings/backup entries |
| `/schedules` | League dropdown populated from Drive; selecting a sheet loads week tabs and game cards |
| `/create-league` (Step 1) | Template dropdown shows same sheets; submitting Step 3 downloads a `.xlsx` |
| `/timer` | League dropdown populated; selecting a sheet + week loads game list for the timer |

---

## Syncing a template after editing `public/league_templates/*.xlsx`

The **app does not need code changes** — it lists whatever Google Sheets files live in the
configured folder.

1. **`Seven Team League` (and other templates)**  
   - Local edits (round reorder, partial swaps) must be **published** by updating the matching
     Google Sheet in the folder. Typical flow: upload the refreshed `.xlsx` → **Open with Google
     Sheets** → confirm tab names stay `Week N Schedule` → name the spreadsheet so it stays
     discoverable (e.g. **Seven Team League**). Remove or hide an older duplicate in the folder
     so dropdowns stay unambiguous.

2. **Sheet IDs change when you upload a *new* file** (`/d/<id>/...`). Existing bookmarked URLs
   or saved `templateId` values refresh automatically if users pick the new entry from the
   dropdown (`/schedules`, `/create-league`, `/timer`).

3. **Seven Team template tweaks in this repo** use:
   - `python3 scripts/seven_team_balance_idle_reserve_g18.py --write` (round swaps inside Games **1–17** only — Game **18** single-court preserved).
   - Optional follow-up: `suggest_idle_swaps.py --deep-partial` / `--apply-partial` **per week**
     when noted in that script’s docstring — re-run `--deep-partial` after regeneration; do not apply old partial indices blindly.

Nothing in **Google Drive folder settings**, **sharing**, or **env vars** must change unless
you move the folder or rotate the API key.

---

## Adding a New League Mid-Season

1. Create the schedule XLSX locally (e.g., with `create_new_league.sh`).
2. Upload to the Drive folder and open with Google Sheets.
3. No code or env changes needed — the folder listing refreshes every 60 seconds
   (Next.js `revalidate: 60` in the Drive folder route).
