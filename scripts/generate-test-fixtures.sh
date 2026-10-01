#!/usr/bin/env bash
set -euo pipefail
OUT="${1:-./fixtures}"
mkdir -p "$OUT"
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=360x640:rate=30" -t 5 -c:v libx264 -pix_fmt yuv420p "$OUT/video-5s.mp4"
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=360x640:rate=30" -t 30 -c:v libx264 -preset ultrafast -pix_fmt yuv420p "$OUT/video-30s.mp4"
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=360x640:rate=30" -t 60 -c:v libx264 -preset ultrafast -pix_fmt yuv420p "$OUT/video-60s.mp4"
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=360x640:rate=24" -t 8 -c:v libvpx-vp9 "$OUT/video-webm.webm"
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=360x640:rate=30" -t 8 -c:v libx264 -f mov "$OUT/video-mov.mov"
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=360x640:rate=30" -f lavfi -i "sine=frequency=440" -t 8 -c:v libx264 -c:a aac "$OUT/video-with-audio.mp4"
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "testsrc2=size=360x640:rate=30" -t 8 -an -c:v libx264 "$OUT/video-no-audio.mp4"
printf 'Generated fixtures in %s\n' "$OUT"
