import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError, requireUser } from "@/lib/http";
import { createDownloadUrl } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const key = request.nextUrl.searchParams.get("key") || "";
    if (!key.startsWith(`users/${user.id}/`)) return NextResponse.json({ error: "Không có quyền truy cập file." }, { status: 403 });
    const ownership = await db()`SELECT 1 FROM projects WHERE user_id=${user.id} AND (source_video_key=${key} OR normalized_video_key=${key}) UNION ALL SELECT 1 FROM render_outputs r JOIN projects p ON p.id=r.project_id WHERE p.user_id=${user.id} AND r.storage_key=${key} UNION ALL SELECT 1 FROM audio_generations a JOIN projects p ON p.id=a.project_id WHERE p.user_id=${user.id} AND a.storage_key=${key} LIMIT 1`;
    if (!ownership.length) return NextResponse.json({ error: "File không thuộc tài khoản." }, { status: 404 });
    return NextResponse.json({ url: await createDownloadUrl(key) });
  } catch (e) { return apiError(e); }
}
