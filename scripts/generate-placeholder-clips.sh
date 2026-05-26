#!/usr/bin/env bash
# Generate short placeholder MP3s for local testing (macOS `say` + ffmpeg).
# Usage: ./scripts/generate-placeholder-clips.sh [output_dir]
# Then upload via /tournament in the app.

set -euo pipefail

OUT="${1:-./schedule_data/audio}"
mkdir -p "$OUT/teams" "$OUT/generic"

slugify() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed "s/'//g" | sed 's/&/and/g' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//'
}

make_clip() {
  local text="$1"
  local path="$2"
  local tmp
  tmp=$(mktemp).aiff
  say -o "$tmp" "$text"
  ffmpeg -y -i "$tmp" -q:a 9 "$path" 2>/dev/null
  rm -f "$tmp"
}

TEAMS=(
  "Black Panther" "Proud Family" "Fresh Prince" "Family Matters"
  "Abbott Elementary" "Fillmore" "That's So Raven" "Smart Guy"
  "The Boondocks" "Kenan and Kel" "The Cleveland Show" "The Parkers"
  "Sister Sister" "Static Shock" "Martin" "The Incredibles"
)

for team in "${TEAMS[@]}"; do
  slug=$(slugify "$team")
  make_clip "$team" "$OUT/teams/${slug}.mp3"
  echo "teams/${slug}.mp3"
done

declare -A GENERIC=(
  [court_1]="Court 1"
  [court_2]="Court 2"
  [court_3]="Court 3"
  [court_4]="Court 4"
  [vs]="versus"
  [head_to_courts]="Please make your way to your courts now"
  [match_soon]="Match begins in 30 seconds"
  [round_start]="Side ready, side ready, dodgeball"
  [two_minutes]="2 minutes until no blocking"
  [ninety_seconds]="90 seconds until no blocking"
  [one_minute]="1 minute until no blocking"
  [thirty_seconds]="30 seconds until no blocking"
  [twenty_seconds]="20 seconds until no blocking"
  [no_blocking_countdown]="No blocking in 10, 9, 8, 7, 6, 5, 4, 3, 2, 1"
  [buzzer]="Buzzer"
  [playoff_match]="Playoff match starting"
)

for key in "${!GENERIC[@]}"; do
  make_clip "${GENERIC[$key]}" "$OUT/generic/${key}.mp3"
  echo "generic/${key}.mp3"
done

echo "Done. Upload files from $OUT via /tournament"
