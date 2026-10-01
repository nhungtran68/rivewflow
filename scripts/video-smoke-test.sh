#!/usr/bin/env bash
set -euo pipefail
FFMPEG_BIN="${FFMPEG_BIN:-ffmpeg}"
FFPROBE_BIN="${FFPROBE_BIN:-ffprobe}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "[1/4] Generate browser-like WebM source"
"$FFMPEG_BIN" -hide_banner -loglevel error -y \
  -f lavfi -i "testsrc2=size=540x960:rate=24" -f lavfi -i "sine=frequency=440:sample_rate=44100" \
  -t 4.2 -c:v libvpx-vp9 -b:v 700k -c:a libopus "$TMP/source.webm"

echo "[2/4] Normalize source"
"$FFMPEG_BIN" -hide_banner -loglevel error -y -fflags +genpts -i "$TMP/source.webm" -map 0:v:0 -an \
  -vf "setpts=PTS-STARTPTS,fps=30,scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black" \
  -c:v libx264 -preset ultrafast -crf 24 -profile:v high -level:v 4.1 -pix_fmt yuv420p -r 30 -fps_mode cfr -movflags +faststart -avoid_negative_ts make_zero "$TMP/normalized.mp4"

echo "[3/4] Generate AI-like audio and render final MP4"
"$FFMPEG_BIN" -hide_banner -loglevel error -y -f lavfi -i "sine=frequency=620:sample_rate=48000" -t 3.6 -c:a libmp3lame "$TMP/voice.mp3"
"$FFMPEG_BIN" -hide_banner -loglevel error -y -i "$TMP/normalized.mp4" -i "$TMP/voice.mp3" \
  -filter_complex "[0:v]setpts=PTS-STARTPTS,fps=30[v]" -map "[v]" -map 1:a:0 -t 3.6 \
  -c:v libx264 -preset ultrafast -crf 23 -profile:v high -level:v 4.1 -pix_fmt yuv420p -r 30 -fps_mode cfr \
  -c:a aac -b:a 160k -ar 48000 -ac 2 -movflags +faststart -avoid_negative_ts make_zero "$TMP/final.mp4"

"$FFPROBE_BIN" -v error -print_format json -show_format -show_streams "$TMP/final.mp4" > "$TMP/probe.json"

echo "[4/4] Assert social-video profile"
python3 - "$TMP/probe.json" <<'PY'
import json,sys,math
p=json.load(open(sys.argv[1]))
v=next(x for x in p['streams'] if x.get('codec_type')=='video')
a=next(x for x in p['streams'] if x.get('codec_type')=='audio')
def rate(s):
    x,y=map(float,s.split('/')); return x/y
assert v['codec_name']=='h264',v
assert v['pix_fmt']=='yuv420p',v
assert (v['width'],v['height'])==(1080,1920),v
assert abs(rate(v['avg_frame_rate'])-30)<0.05,v['avg_frame_rate']
assert a['codec_name']=='aac',a
assert int(a['sample_rate'])==48000,a
assert int(a['channels'])==2,a
assert 3.45<float(p['format']['duration'])<3.8,p['format']['duration']
assert abs(float(p['format'].get('start_time','0'))) < 0.15,p['format'].get('start_time')
print('PASS: MP4 H.264/yuv420p 1080x1920 CFR30 + AAC 48kHz stereo; duration metadata valid')
PY
