import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireUser } from "@/lib/http";
import { enqueue } from "@/lib/queue";
import { stableHash } from "@/lib/hash";
import { headObject } from "@/lib/storage";
import { enforceRateLimit } from "@/lib/rate-limit";

const allowedAudio = new Set(["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/webm", "audio/ogg", "video/webm"]);
const MAX_SAMPLE_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    await enforceRateLimit(user.id, "voice-clone", 5, 3600);
    const input = z.object({
      displayName: z.string().min(1).max(80),
      sampleKeys: z.array(z.string()).min(1).max(5),
      consent: z.literal(true),
      removeBackgroundNoise: z.boolean().optional().default(false)
    }).parse(await request.json());

    const prefix = `users/${user.id}/voice-samples/`;
    if (input.sampleKeys.some((key) => !key.startsWith(prefix))) {
      return NextResponse.json({ error: "Mẫu giọng không thuộc tài khoản." }, { status: 403 });
    }

    let total = 0;
    for (const key of input.sampleKeys) {
      const object = await headObject(key);
      const bytes = Number(object.ContentLength || 0);
      const type = String(object.ContentType || "");
      if (!bytes || bytes > MAX_SAMPLE_BYTES) return NextResponse.json({ error: "Mỗi mẫu giọng tối đa 25 MB." }, { status: 413 });
      if (!allowedAudio.has(type)) return NextResponse.json({ error: "MIME type của mẫu giọng không hợp lệ." }, { status: 415 });
      total += bytes;
    }
    if (total > MAX_TOTAL_BYTES) return NextResponse.json({ error: "Tổng mẫu giọng tối đa 50 MB." }, { status: 413 });

    const jobId = `clone-${user.id}-${stableHash({ name: input.displayName, keys: input.sampleKeys })}`;
    await enqueue("clone-voice", { userId: user.id, ...input }, jobId);
    return NextResponse.json({ ok: true, jobId });
  } catch (e) { return apiError(e); }
}
