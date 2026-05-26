#!/usr/bin/env bash
# Generate short placeholder MP3s for local testing (macOS `say` + ffmpeg).
# Usage: ./scripts/generate-placeholder-clips.sh [output_dir]
# Then upload via /tournament in the app.
# Compatible with macOS default Bash 3.2 (no associative arrays).

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

GENERIC_KEYS=(
  court_1 court_2 court_3 court_4 vs head_to_courts match_soon round_start
  two_minutes ninety_seconds one_minute thirty_seconds twenty_seconds
  no_blocking_countdown buzzer playoff_match
)

GENERIC_TEXTS=(
  "Court 1" "Court 2" "Court 3" "Court 4" "versus"
  "Please make your way to your courts now"
  "Match begins in 30 seconds"
  "Side ready, side ready, dodgeball"
  "2 minutes until no blocking"
  "90 seconds until no blocking"
  "1 minute until no blocking"
  "30 seconds until no blocking"
  "20 seconds until no blocking"
  "No blocking in 10, 9, 8, 7, 6, 5, 4, 3, 2, 1"
  "Buzzer"
  "Playoff match starting"
)

i=0
while [ "$i" -lt "${#GENERIC_KEYS[@]}" ]; do
  key="${GENERIC_KEYS[$i]}"
  text="${GENERIC_TEXTS[$i]}"
  make_clip "$text" "$OUT/generic/${key}.mp3"
  echo "generic/${key}.mp3"
  i=$((i + 1))
done

echo "Done. Upload files from $OUT via /tournament"
