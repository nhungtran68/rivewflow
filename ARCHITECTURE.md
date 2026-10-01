# ReviewFlow AI Architecture

```text
Mobile/Desktop Browser (Next.js PWA)
           |
           v
Next.js Web/API (auth + ownership + orchestration)
     |          |             |
     |          |             +--> DeepSeek API (text/vision called by worker)
     |          +--> S3/R2/MinIO (signed upload/download)
     +--> PostgreSQL
     +--> Redis/BullMQ -----> Docker Worker
                                |
                                +--> FFmpeg/FFprobe
                                +--> DeepSeek Vision/Text
                                +--> VBee async TTS/callback
                                +--> ElevenLabs IVC/TTS
                                +--> S3/R2 output
```

## Why the video worker is separate

Vercel/serverless requests should orchestrate short operations only. Transcoding, frame extraction and long media work run in a Docker worker with FFmpeg. Jobs are retried by BullMQ and use deterministic job IDs to limit duplicate work.

## Video output contract

Every final render is re-encoded, never merely renamed/remuxed:

- MP4 container
- H.264 High profile
- yuv420p
- 1080x1920
- Constant 30 FPS
- AAC 48 kHz stereo
- timestamps reset to zero
- negative timestamps avoided
- moov atom moved to the front (`+faststart`)

The worker runs FFprobe after rendering. A failed profile triggers a repair transcode. Only a validated file is marked `COMPLETED`.

## AI cost control

The worker detects scene-change timestamps, adds time-based samples, extracts only representative frames, computes a low-resolution visual hash, discards near-duplicates and caps AI input at 24 frames. Analysis is stored and reused when the user changes style or rewrites the script.
