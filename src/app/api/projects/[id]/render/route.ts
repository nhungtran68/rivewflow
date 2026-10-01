import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError, requireUser } from "@/lib/http";
import { enqueue } from "@/lib/queue";
import { stableHash } from "@/lib/hash";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request); const { id } = await params;
    await enforceRateLimit(user.id, "render", 20, 3600);
    const [project] = await db()`SELECT * FROM projects WHERE id=${id} AND user_id=${user.id}`;
    const [audio] = await db()`SELECT * FROM audio_generations WHERE project_id=${id} AND status='READY' ORDER BY created_at DESC LIMIT 1`;
    if (!project || !audio?.storageKey) return NextResponse.json({ error: "Chưa có audio sẵn sàng để ghép." }, { status: 409 });
    await db()`UPDATE projects SET status='RENDERING',progress=82,status_message='Đang dựng video chuẩn mạng xã hội',updated_at=now() WHERE id=${id}`;
    const inputHash = stableHash({ source: project.normalizedVideoKey || project.sourceVideoKey, audio: audio.storageKey, subtitles: project.subtitlesEnabled });
    const jobId = `render-${id}-${inputHash}`;
    await enqueue("render-video", { projectId: id, userId: user.id, audioId: audio.id, inputHash }, jobId);
    return NextResponse.json({ ok: true, jobId });
  } catch (e) { return apiError(e); }
}
