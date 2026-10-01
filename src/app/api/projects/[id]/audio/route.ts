import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, requireUser } from "@/lib/http";
import { enqueue } from "@/lib/queue";
import { stableHash } from "@/lib/hash";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request); const { id } = await params;
    await enforceRateLimit(user.id, "audio", 30, 3600);
    const input = z.object({ voiceId: z.string().uuid() }).parse(await request.json());
    const [project] = await db()`SELECT id FROM projects WHERE id=${id} AND user_id=${user.id}`;
    const [voice] = await db()`SELECT * FROM voices WHERE id=${input.voiceId} AND user_id=${user.id} AND status='READY'`;
    const [script] = await db()`SELECT * FROM scripts WHERE project_id=${id} AND is_current=true ORDER BY version DESC LIMIT 1`;
    if (!project || !voice || !script) return NextResponse.json({ error: "Thiếu dự án, kịch bản hoặc giọng hợp lệ." }, { status: 409 });
    await db()`UPDATE projects SET status='GENERATING_AUDIO',progress=68,status_message='Đang tạo giọng nói',updated_at=now() WHERE id=${id}`;
    const inputHash = stableHash({ text: script.scriptText, voiceId: voice.id, speed: voice.speed, provider: voice.provider });
    const jobId = `audio-${id}-${inputHash}`;
    await enqueue("generate-audio", { projectId: id, userId: user.id, voiceId: voice.id, inputHash }, jobId);
    return NextResponse.json({ ok: true, jobId });
  } catch (e) { return apiError(e); }
}
