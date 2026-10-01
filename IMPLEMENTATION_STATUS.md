# Implementation status

## Implemented

- Next.js App Router web/API, TypeScript, Tailwind and PWA shell.
- Email/password auth with HttpOnly session cookie, ownership checks, origin protection and Redis rate limits.
- Mobile-first 9:16 camera flow plus upload fallback.
- PostgreSQL schema for projects, media, analysis, content angles, scripts, styles, voices, audio, render jobs/outputs and job logs.
- S3-compatible presigned uploads with allowlisted MIME/size checks before signing and `HeadObject` validation before media is accepted into a project/clone job.
- Redis/BullMQ queues with retry and deterministic job IDs.
- Separate Docker worker for FFmpeg/FFprobe and provider calls.
- Video normalize -> representative frames -> DeepSeek Vision -> content angles -> script pipeline.
- 8 built-in writing styles and per-user custom styles.
- VBee async TTS adapter/callback and ElevenLabs TTS/Instant Voice Cloning adapter.
- Voice-clone consent gate and persisted consent timestamp.
- Audio duration probe and one automatic script-duration correction pass.
- Optional subtitle burn-in.
- Final render contract: MP4, H.264 High/yuv420p, 1080x1920, CFR 30fps, AAC 48kHz stereo, faststart, zero-based timestamps.
- Post-render FFprobe validation plus one repair transcode before output is marked completed.
- GitHub Actions CI definition and FFmpeg smoke tests.

## Verified in this sandbox

- `scripts/video-smoke-test.sh` passed with a generated browser-like WebM source.
- Verified final test output profile: H.264/yuv420p, 1080x1920, CFR 30fps, AAC 48kHz stereo and valid duration metadata.
- JSON files parse successfully.
- Shell scripts pass `bash -n`.
- Local `@/` imports resolve to files in the repository.
- TypeScript syntax parsing found no parser-level errors.
- Secret-pattern scan found no committed provider keys/private keys.

## Must be verified after cloning/installing dependencies

This sandbox has no npm registry/network access and no Docker daemon/PostgreSQL executable, so these checks could not be honestly completed here:

1. `npm install`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run build`
5. `docker compose up -d ...` integration test with PostgreSQL/Redis/MinIO
6. Live DeepSeek, VBee and ElevenLabs calls with your own API credentials
7. VBee callback from a public HTTPS `APP_URL`
8. Physical Android/iPhone camera tests
9. Import of produced files into the exact target versions of CapCut/Facebook/Instagram/TikTok

The included GitHub Actions workflow runs typecheck, lint, build and the FFmpeg smoke test once the repository is pushed to GitHub.
