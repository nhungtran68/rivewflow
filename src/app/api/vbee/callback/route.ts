import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { enqueue } from "@/lib/queue";
import { env } from "@/lib/config";

export async function POST(request: NextRequest) {
  try {
    const secret = request.nextUrl.searchParams.get("secret");
    const expected = env("VBEE_CALLBACK_SECRET");
    if (!expected || secret !== expected) return NextResponse.json({ error: "Invalid callback." }, { status: 401 });
    const body = await request.json();
    const requestId = body?.result?.request_id || body?.request_id;
    const audioUrl = body?.result?.audio_link || body?.result?.audio_url || body?.audio_link || body?.audio_url;
    const status = String(body?.result?.status || body?.status || "").toUpperCase();
    if (!requestId) return NextResponse.json({ error: "Missing request id." }, { status: 400 });
    const [audio] = await db()`SELECT * FROM audio_generations WHERE provider='VBEE' AND provider_request_id=${String(requestId)} LIMIT 1`;
    if (!audio) return NextResponse.json({ ok: true, ignored: true });
    if (audio.status === "READY") return NextResponse.json({ ok: true, duplicate: true });
    if (status.includes("FAIL")) {
      await db()`UPDATE audio_generations SET status='FAILED',error_code='VBEE_CALLBACK_FAILED',updated_at=now() WHERE id=${audio.id}`;
      await db()`UPDATE projects SET status='FAILED',status_message='Không tạo được giọng. Hãy thử lại.',updated_at=now() WHERE id=${audio.projectId}`;
      return NextResponse.json({ ok: true });
    }
    if (audioUrl) {
      let parsed: URL;
      try { parsed = new URL(String(audioUrl)); } catch { return NextResponse.json({ error: "Invalid audio URL." }, { status: 400 }); }
      const host = parsed.hostname.toLowerCase();
      const privateHost = host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local") || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
      if (parsed.protocol !== "https:" || privateHost) return NextResponse.json({ error: "Unsafe audio URL." }, { status: 400 });
      await enqueue("finalize-vbee-audio", { audioId: audio.id, projectId: audio.projectId, audioUrl: parsed.toString() }, `vbee-finalize-${audio.id}`);
    }
    return NextResponse.json({ ok: true });
  } catch (e) { return apiError(e); }
}
