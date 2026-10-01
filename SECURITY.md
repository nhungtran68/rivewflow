# Security notes

- Provider keys live only in environment variables on server/worker.
- JWT session cookies are HttpOnly, SameSite=Lax and Secure in production.
- Next.js 16 `proxy.ts` rejects browser cross-origin writes to API routes while allowing server-to-server callbacks that carry no Origin header.
- Login/register and expensive AI/TTS/render routes have Redis-backed fixed-window rate limits.
- Every project/file/voice API checks authenticated ownership.
- Upload keys are generated server-side; the browser cannot choose another user's path.
- Upload MIME and declared size are allowlisted before a signed URL is issued. Source videos and clone samples are checked again with S3 `HeadObject` before the object is trusted.
- Source video limit is 500 MB; each voice sample is 25 MB and a clone request is capped at 50 MB total.
- Voice cloning requires explicit consent before an ElevenLabs job is queued; consent timestamp is stored with the saved voice.
- ElevenLabs voice deletion is propagated to the provider before the local row is deleted.
- VBee callback requires a server-side callback secret, is idempotent for completed audio, and rejects non-HTTPS/private-network audio URLs before the worker downloads them.
- Logs never intentionally write API secrets.
- For public production use, keep Cloudflare/Vercel WAF protections enabled and consider malware scanning for untrusted uploads.
