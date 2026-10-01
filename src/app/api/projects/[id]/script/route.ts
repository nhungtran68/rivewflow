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
    await enforceRateLimit(user.id, "script", 30, 3600);
    const input = z.object({ angleId: z.string().uuid(), styleKey: z.string(), targetDuration: z.union([z.literal(15),z.literal(30),z.literal(45),z.literal(60),z.literal(90)]) }).parse(await request.json());
    const [project] = await db()`SELECT id FROM projects WHERE id=${id} AND user_id=${user.id}`;
    if (!project) return NextResponse.json({ error: "Không tìm thấy dự án." }, { status: 404 });
    const [angle] = await db()`SELECT id FROM content_angles WHERE id=${input.angleId} AND project_id=${id}`;
    if (!angle) return NextResponse.json({ error: "Góc nội dung không hợp lệ." }, { status: 400 });
    await db()`UPDATE projects SET selected_angle_id=${input.angleId},style_key=${input.styleKey},target_duration=${input.targetDuration},status='GENERATING_SCRIPT',progress=52,status_message='AI đang viết kịch bản',updated_at=now() WHERE id=${id}`;
    const jobId = `script-${id}-${stableHash(input)}`;
    await enqueue("generate-script", { projectId: id, userId: user.id }, jobId);
    return NextResponse.json({ ok: true, jobId });
  } catch (e) { return apiError(e); }
}
