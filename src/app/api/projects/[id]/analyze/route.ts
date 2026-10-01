import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError, requireUser } from "@/lib/http";
import { enqueue } from "@/lib/queue";
import { stableHash } from "@/lib/hash";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request); const { id } = await params;
    await enforceRateLimit(user.id, "analyze", 10, 3600);
    const [project] = await db()`SELECT * FROM projects WHERE id=${id} AND user_id=${user.id}`;
    if (!project) return NextResponse.json({ error: "Không tìm thấy dự án." }, { status: 404 });
    if (!project.sourceVideoKey) return NextResponse.json({ error: "Bạn chưa tải video lên." }, { status: 409 });
    await db()`UPDATE projects SET status='ANALYZING',progress=18,status_message='Đang chuẩn hóa và phân tích video',updated_at=now() WHERE id=${id}`;
    const jobId = `analyze-${id}-${stableHash(project.sourceVideoKey)}`;
    await enqueue("analyze-video", { projectId: id, userId: user.id }, jobId);
    return NextResponse.json({ ok: true, jobId });
  } catch (e) { return apiError(e); }
}
