#!/usr/bin/env bash
# Regenerates the full clip battery into test/clips/ with ffmpeg.
# Recipes transcribed from SPEC.md Appendix, with a few helpers added for
# clips the appendix describes but doesn't give an exact recipe for (S4-S7).
# Run via `npm run clips`.
#
# All clips are 640x480. The test page must display each clip at exactly
# 640x480 CSS px, because the area rule is in CSS pixels (SPEC.md §9.2).

set -euo pipefail

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found. Install it (e.g. 'brew install ffmpeg') and re-run." >&2
  exit 1
fi

OUT_DIR="$(dirname "$0")/../test/clips"
mkdir -p "$OUT_DIR"
cd "$OUT_DIR"

# --- Appendix recipes, verbatim ---------------------------------------

# Full-frame luminance square wave: gen_flash NAME HZ FPS SECS
gen_flash() {
  ffmpeg -y -f lavfi -i "color=size=640x480:rate=$3:duration=$4,geq=lum='if(lt(mod(T*$2\,1)\,0.5)\,255\,0)':cb=128:cr=128" \
    -pix_fmt yuv420p -c:v libx264 "$1.mp4"
}

# Region flash on a gray background: gen_region NAME HZ X0 X1 Y0 Y1
gen_region() {
  ffmpeg -y -f lavfi -i "color=size=640x480:rate=30:duration=6,format=gray,geq=lum='if(between(X\,$3\,$4)*between(Y\,$5\,$6)\,if(lt(mod(T*$2\,1)\,0.5)\,255\,0)\,128)'" \
    -pix_fmt yuv420p -c:v libx264 "$1.mp4"
}

# Saturated red <-> black: gen_red NAME HZ
gen_red() {
  ffmpeg -y -f lavfi -i "color=size=640x480:rate=30:duration=6,format=rgb24,geq=r='if(lt(mod(T*$2\,1)\,0.5)\,255\,0)':g='0':b='0'" \
    -pix_fmt yuv420p -c:v libx264 "$1.mp4"
}

# Triangle (ramped) wave: gen_tri NAME HZ FPS
gen_tri() {
  ffmpeg -y -f lavfi -i "color=size=640x480:rate=$3:duration=6,geq=lum='128+127*(2*abs(2*($2*T-floor($2*T+0.5)))-1)':cb=128:cr=128" \
    -pix_fmt yuv420p -c:v libx264 "$1.mp4"
}

# Soft-edged square (ramp ~ 1/GAIN of a half period): gen_soft NAME HZ FPS GAIN
gen_soft() {
  ffmpeg -y -f lavfi -i "color=size=640x480:rate=$3:duration=6,geq=lum='128+127*clip($4*(2*abs(2*($2*T-floor($2*T+0.5)))-1)\,-1\,1)':cb=128:cr=128" \
    -pix_fmt yuv420p -c:v libx264 "$1.mp4"
}

# --- Added helpers (not in the appendix, needed for S4-S7) ------------

# Full-frame square wave between two 8-bit luminance levels (not just 0/255):
# gen_flash_levels NAME HZ FPS SECS LO HI
gen_flash_levels() {
  ffmpeg -y -f lavfi -i "color=size=640x480:rate=$3:duration=$4,geq=lum='if(lt(mod(T*$2\,1)\,0.5)\,$6\,$5)':cb=128:cr=128" \
    -pix_fmt yuv420p -c:v libx264 "$1.mp4"
}

# Single hard cut from one level to another at the midpoint: gen_cut NAME SECS LO HI
gen_cut() {
  half=$(echo "$2 / 2" | bc -l)
  ffmpeg -y -f lavfi -i "color=size=640x480:rate=30:duration=$2,geq=lum='if(lt(T\,$half)\,$4\,$3)':cb=128:cr=128" \
    -pix_fmt yuv420p -c:v libx264 "$1.mp4"
}

# --- Hazard clips (H1-H9) — SPEC.md §9.2, expected: hazard -------------

echo "Generating hazard clips (H1-H9)..."
gen_flash H1_5hz 5 30 6
gen_flash H2_6hz 6 30 6
gen_flash H3_16hz 16 60 6
gen_flash H4_20hz 20 60 6
gen_flash H5_24hz 24 60 6
gen_red H6_red_5hz 5
gen_tri H7_tri_4hz 4 120
gen_soft H8_soft_5hz 5 60 4
gen_region H9_region_10hz 10 220 420 165 315 # 200x150 px

# --- Safe clips (S1-S9) — SPEC.md §9.2, expected: safe ------------------

echo "Generating safe clips (S1-S9)..."
gen_flash S1_1hz 1 30 6
gen_flash S2_2hz 2 30 6
gen_flash S3_3hz 3 30 6                     # boundary — never tune away from this at H1's expense
gen_tri S4_fade_0.25hz 0.25 30              # 2s fade each way = 4s period = 0.25 Hz
gen_cut S5_hardcut 2 255 0                  # single white(255)->black(0) cut at t=1s
gen_flash_levels S6_graydelta_5hz 5 30 6 128 146   # delta ~= 0.07, below the 0.10 "low" threshold
gen_flash_levels S7_brightexc_5hz 5 30 6 235 255   # darker state ~= 0.83, above the 0.80 "low" exception
gen_region S8_region_5hz 5 0 159 0 119      # 160x120 px
gen_region S9_region_5hz 5 0 79 0 79        # ~80x80 px

echo "Done. Clips written to $OUT_DIR"
