import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, requireUser } from "@/lib/http";
import { createUploadUrl } from "@/lib/storage";
import { randomUUID } from "node:crypto";

const allowedVideo = new Set(["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"]);
const allowedAudio = new Set(["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/webm", "audio/ogg", "video/webm"]);
const MAX_SOURCE_VIDEO_BYTES = 500 * 1024 * 1024;
const MAX_VOICE_SAMPLE_BYTES = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const input = z.object({
      projectId: z.string().uuid().optional(),
      purpose: z.enum(["source-video", "voice-sample"]),
      contentType: z.string(),
      extension: z.string().regex(/^[a-zA-Z0-9]{1,8}$/),
      sizeBytes: z.number().int().positive()
    }).parse(await request.json());

    if (input.purpose === "source-video") {
      if (!input.projectId) return NextResponse.json({ error: "Thiếu projectId." }, { status: 400 });
      if (!allowedVideo.has(input.contentType)) return NextResponse.json({ error: "Định dạng video chưa được hỗ trợ." }, { status: 415 });
      if (input.sizeBytes > MAX_SOURCE_VIDEO_BYTES) return NextResponse.json({ error: "Video vượt giới hạn 500 MB." }, { status: 413 });
      const [p] = await db()`SELECT id FROM projects WHERE id=${input.projectId} AND user_id=${user.id}`;
      if (!p) return NextResponse.json({ error: "Không tìm thấy dự án." }, { status: 404 });
    } else {
      if (!allowedAudio.has(input.contentType)) return NextResponse.json({ error: "Định dạng audio chưa được hỗ trợ." }, { status: 415 });
      if (input.sizeBytes > MAX_VOICE_SAMPLE_BYTES) return NextResponse.json({ error: "Mỗi mẫu giọng tối đa 25 MB." }, { status: 413 });
    }

    const key = input.purpose === "source-video"
      ? `users/${user.id}/projects/${input.projectId}/source/${randomUUID()}.${input.extension.toLowerCase()}`
      : `users/${user.id}/voice-samples/${randomUUID()}.${input.extension.toLowerCase()}`;
    return NextResponse.json({ key, uploadUrl: await createUploadUrl(key, input.contentType), expiresIn: 900 });
  } catch (e) { return apiError(e); }
}
