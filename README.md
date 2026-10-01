# ReviewFlow AI

Web app production-oriented để tạo video review sản phẩm bằng AI: quay/upload video → phân tích frame → chọn góc nội dung → viết kịch bản → VBee/ElevenLabs → render MP4 chuẩn mạng xã hội.

## Stack

- Next.js 16 + TypeScript + Tailwind CSS 4 + PWA
- PostgreSQL
- Redis + BullMQ
- S3-compatible storage (Cloudflare R2, AWS S3 hoặc MinIO local)
- Docker worker riêng chạy FFmpeg/FFprobe
- DeepSeek Vision (`deepseek-flash`) + DeepSeek text model
- VBee asynchronous TTS + callback
- ElevenLabs Instant Voice Cloning + Text-to-Speech

## Chức năng đã dựng

- Đăng ký/đăng nhập bằng session cookie HttpOnly.
- Mobile-first camera 9:16, ưu tiên camera sau, start/stop/review/re-record/upload.
- Presigned upload; browser không nhận storage secret.
- Project state machine và progress.
- Worker normalize video, reset timestamp, CFR 30 FPS.
- Scene-change detection + time sampling + visual dedup, tối đa 24 frame cho Vision.
- Structured video analysis, 5 content angles, 8 style mặc định + style riêng.
- Script editor và 6 nút refine: viết lại, ngắn hơn, dài hơn, hook mạnh hơn, tự nhiên hơn, bán hàng hơn.
- VBee voice code per user.
- ElevenLabs IVC với explicit consent và voice ID tái sử dụng.
- Audio được tải về storage và FFprobe lấy duration thật.
- Tự chỉnh lại độ dài lời thoại một lần nếu audio lệch target đáng kể.
- Render subtitles tùy chọn.
- Re-encode MP4 H.264/yuv420p 1080x1920 CFR30 + AAC 48 kHz stereo + faststart.
- FFprobe validation sau render và repair transcode nếu profile sai.
- File ownership checks ở backend.
- BullMQ retry + deterministic job IDs để hạn chế duplicate generation.
- PWA shell + service worker.
- GitHub Actions CI và FFmpeg smoke test.

## Chạy local

### 1) Cài dependency

```bash
npm install
cp .env.example .env
```

Điền `SESSION_SECRET` tối thiểu 32 ký tự. Provider key có thể thêm sau.

### 2) Chạy Postgres, Redis, MinIO

```bash
docker compose up -d postgres redis minio minio-init
```

Schema được mount vào Postgres lần khởi tạo đầu. Nếu DB đã tồn tại:

```bash
npm run db:init
```

### 3) Chạy web và worker

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run worker
```

Mở `http://localhost:3000`, tạo tài khoản rồi tạo video đầu tiên.

## Production deployment

### Web/API

Deploy Next.js lên Vercel. Không chạy FFmpeg render dài trong Vercel request.

### Worker

Build `Dockerfile.worker` và deploy lên dịch vụ chạy container lâu dài như Cloud Run, Fly.io, Railway, ECS hoặc VPS Docker. Worker và web phải dùng chung:

- `DATABASE_URL`
- `REDIS_URL`
- S3/R2 bucket
- provider keys

### Storage

Với Cloudflare R2:

```env
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_REGION=auto
S3_FORCE_PATH_STYLE=false
S3_BUCKET=reviewflow
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

## Provider configuration

### DeepSeek

```env
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_VISION_MODEL=deepseek-flash
DEEPSEEK_TEXT_MODEL=deepseek-flash
```

### ElevenLabs

```env
ELEVENLABS_API_KEY=...
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128
```

The app uses current API shapes:

- IVC: `POST https://api.elevenlabs.io/v1/voices/add`
- TTS: `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`
- delete cloned voice: `DELETE https://api.elevenlabs.io/v1/voices/{voice_id}`

### VBee

```env
VBEE_APP_ID=...
VBEE_TOKEN=...
VBEE_API_URL=https://api.vbee.vn/v1/tts
VBEE_CALLBACK_SECRET=<random-secret>
APP_URL=https://your-domain.com
```

`APP_URL` phải public để VBee gọi callback.

## Video compatibility contract

Final video chỉ được đánh dấu `COMPLETED` khi FFprobe xác nhận:

- video codec `h264`
- pixel format `yuv420p`
- resolution `1080x1920`
- avg frame rate ~ `30/1`
- audio codec `aac`
- sample rate `48000`
- channels `2`
- `start_time` gần 0
- duration metadata khớp audio/output mong muốn

Chạy test nhanh:

```bash
npm run test:video
```

## Test matrix nên chạy trước release

Repo có script sinh fixture cho 5s, 30s, 60s, WebM, MOV, video có/không audio. Với thiết bị thật, bổ sung fixture quay Android, iPhone và VFR:

```bash
bash scripts/generate-test-fixtures.sh ./fixtures
```

Sau đó chạy mỗi fixture qua worker và thử import file cuối vào CapCut/Facebook/Reels/TikTok trên thiết bị mục tiêu.

## Đưa lên GitHub

```bash
git init
git add .
git commit -m "Initial ReviewFlow AI app"
git branch -M main
git remote add origin <GITHUB_REPOSITORY_URL>
git push -u origin main
```

Không commit `.env` hoặc API key. `.gitignore` đã chặn `.env`.

## Tài liệu kỹ thuật

- `ARCHITECTURE.md`: kiến trúc và video output contract.
- `SECURITY.md`: bảo mật, ownership và voice consent.
- `db/schema.sql`: schema PostgreSQL.
- `worker/video.ts`: normalize, frame extraction, render, validation, repair.
- `worker/index.ts`: BullMQ pipeline.

## CORS cho upload trực tiếp

Browser upload trực tiếp vào S3/R2 bằng presigned URL, vì vậy bucket production phải cho phép `PUT` từ domain web của bạn và cho phép header `Content-Type`. Không mở wildcard origin nếu không cần thiết.

## Trạng thái kiểm thử

Xem `IMPLEMENTATION_STATUS.md` để biết phần nào đã được kiểm chứng trực tiếp trong môi trường này và phần nào cần chạy lại bằng API key/hạ tầng thật trước production.
