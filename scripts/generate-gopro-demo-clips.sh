#!/usr/bin/env bash
# Generate short, visually numbered GoPro-named MP4s for Video Tools testing.
# Requires: ffmpeg + python3 with Pillow (PIL).
#
# Usage:
#   bash scripts/generate-gopro-demo-clips.sh [output_dir]
#
# Default output: tmp/gopro-demo-clips/
# Also writes an offline concat smoke test (merged_smoke.MP4) in correct GoPro order.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/tmp/gopro-demo-clips}"
DURATION=2
WIDTH=640
HEIGHT=360
FPS=30

mkdir -p "$OUT"

# Render a still PNG with large step number (Pillow — works without ffmpeg drawtext).
render_frame() {
  local png="$1"
  local step="$2"
  local hex_color="$3"
  local label="$4"
  python3 - "$png" "$step" "$hex_color" "$label" "$WIDTH" "$HEIGHT" <<'PY'
import sys
from PIL import Image, ImageDraw, ImageFont

path, step, hex_color, label, w, h = sys.argv[1:7]
w, h = int(w), int(h)
rgb = tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4))
img = Image.new("RGB", (w, h), rgb)
draw = ImageDraw.Draw(img)

def load_font(size: int):
    for candidate in (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ):
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()

big = load_font(140)
small = load_font(36)

def centered(text, font, y):
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (w - tw) // 2
    # black outline for readability
    for dx, dy in ((-2, 0), (2, 0), (0, -2), (0, 2), (-2, -2), (2, 2), (-2, 2), (2, -2)):
        draw.text((x + dx, y + dy), text, font=font, fill=(0, 0, 0))
    draw.text((x, y), text, font=font, fill=(255, 255, 255))
    return th

centered(step, big, h // 2 - 90)
centered(label, small, h // 2 + 50)
img.save(path)
PY
}

make_clip() {
  local filename="$1"
  local step="$2"
  local hex_color="$3"
  local label="$4"
  local png="$OUT/_frame_${step}.png"
  local path="$OUT/$filename"

  render_frame "$png" "$step" "$hex_color" "$label"

  # Shared encode settings so worker ffmpeg -c copy concat stays compatible.
  ffmpeg -y -hide_banner -loglevel error \
    -loop 1 -i "$png" \
    -c:v libx264 -pix_fmt yuv420p -r "$FPS" -t "$DURATION" \
    -movflags +faststart \
    "$path"
  rm -f "$png"
  echo "  $filename  (step $step)"
}

echo "Generating demo clips → $OUT"
echo ""

# Session 0010 — chapters in GoPro order (upload these shuffled in the UI)
make_clip "GOPR0010.MP4" "1" "1E3A8A" "1 · GOPR0010"
make_clip "GX010010.MP4" "2" "166534" "2 · GX010010"
make_clip "GX020010.MP4" "3" "A16207" "3 · GX020010"
make_clip "GX030010.MP4" "4" "C2410C" "4 · GX030010"

# Session 0020 — sorts after 0010
make_clip "GX010020.MP4" "5" "6B21A8" "5 · GX010020"

# Non-GoPro — sorts after all GoPro sessions
make_clip "zzz_tail.mp4" "6" "374151" "6 · zzz_tail"

# Offline smoke: concat in correct GoPro order (not alphabetical / upload order)
LIST="$OUT/concat_list.txt"
MERGED="$OUT/merged_smoke.MP4"
{
  echo "file '$OUT/GOPR0010.MP4'"
  echo "file '$OUT/GX010010.MP4'"
  echo "file '$OUT/GX020010.MP4'"
  echo "file '$OUT/GX030010.MP4'"
  echo "file '$OUT/GX010020.MP4'"
  echo "file '$OUT/zzz_tail.mp4'"
} > "$LIST"

ffmpeg -y -hide_banner -loglevel error \
  -f concat -safe 0 -i "$LIST" -c copy "$MERGED"

echo ""
echo "Expected merge order (watch for steps 1 → 6):"
echo "  GOPR0010.MP4 → GX010010.MP4 → GX020010.MP4 → GX030010.MP4 → GX010020.MP4 → zzz_tail.mp4"
echo ""
echo "Offline smoke concat: $MERGED"
echo "Upload the six clips from $OUT via Video Tools (drop out of order)."
ls -lh "$OUT"/*.MP4 "$OUT"/*.mp4 2>/dev/null | awk '{print "  " $5 "\t" $9}'
