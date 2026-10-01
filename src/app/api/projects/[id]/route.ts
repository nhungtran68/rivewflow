import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, requireUser } from "@/lib/http";
import { headObject } from "@/lib/storage";
import { segmentsFromText } from "@/lib/script-segments";

async function ownProject(userId: string, id: string) {
  const [project] = await db()`SELECT * FROM projects WHERE id=${id} AND user_id=${userId} LIMIT 1`;
  if (!project) throw new Response("Not found", { status: 404 });
  return project;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request); const { id } = await params; const project = await ownProject(user.id, id); const sql = db();
    const [analysis, angles, scripts, audios, outputs] = await Promise.all([
      sql`SELECT * FROM video_analysis WHERE project_id=${id} LIMIT 1`,
      sql`SELECT * FROM content_angles WHERE project_id=${id} ORDER BY sort_order`,
      sql`SELECT * FROM scripts WHERE project_id=${id} ORDER BY version DESC`,
      sql`SELECT a.*,v.display_name AS voice_name FROM audio_generations a JOIN voices v ON v.id=a.voice_id WHERE a.project_id=${id} ORDER BY a.created_at DESC`,
      sql`SELECT * FROM render_outputs WHERE project_id=${id} ORDER BY created_at DESC`
    ]);
    return NextResponse.json({ project, analysis: analysis[0] || null, angles, scripts, audios, outputs });
  } catch (e) { return apiError(e); }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request); const { id } = await params; await ownProject(user.id, id);
    const input = z.object({ sourceVideoKey: z.string().optional(), selectedAngleId: z.string().uuid().optional(), styleKey: z.string().optional(), targetDuration: z.number().int().optional(), subtitlesEnabled: z.boolean().optional(), scriptText: z.string().max(10000).optional() }).parse(await request.json());
    const sql = db();
    if (input.sourceVideoKey) {
      const prefix = `users/${user.id}/projects/${id}/source/`;
      if (!input.sourceVideoKey.startsWith(prefix)) return NextResponse.json({ error: "File không thuộc dự án." }, { status: 403 });
      const object = await headObject(input.sourceVideoKey);
      const contentLength = Number(object.ContentLength || 0);
      const contentType = String(object.ContentType || "");
      if (!contentLength || contentLength > 500 * 1024 * 1024) return NextResponse.json({ error: "Video không hợp lệ hoặc vượt giới hạn 500 MB." }, { status: 413 });
      if (!new Set(["video/mp4","video/webm","video/quicktime","video/x-m4v"]).has(contentType)) return NextResponse.json({ error: "MIME type của video không hợp lệ." }, { status: 415 });
      await sql`UPDATE projects SET source_video_key=${input.sourceVideoKey},status='UPLOADED',progress=12,status_message='Video đã sẵn sàng',updated_at=now() WHERE id=${id}`;
      await sql`INSERT INTO videos (project_id,storage_key,kind,mime_type,metadata) VALUES (${id},${input.sourceVideoKey},'SOURCE',${contentType},${JSON.stringify({ contentLength })}::jsonb)`;
    }
    if (input.selectedAngleId) await sql`UPDATE projects SET selected_angle_id=${input.selectedAngleId},updated_at=now() WHERE id=${id}`;
    if (input.styleKey) await sql`UPDATE projects SET style_key=${input.styleKey},updated_at=now() WHERE id=${id}`;
    if (input.targetDuration) await sql`UPDATE projects SET target_duration=${input.targetDuration},updated_at=now() WHERE id=${id}`;
    if (typeof input.subtitlesEnabled === "boolean") await sql`UPDATE projects SET subtitles_enabled=${input.subtitlesEnabled},updated_at=now() WHERE id=${id}`;
    if (input.scriptText) {
      const [current] = await sql`SELECT * FROM scripts WHERE project_id=${id} AND is_current=true ORDER BY version DESC LIMIT 1`;
      if (!current) return NextResponse.json({ error: "Chưa có kịch bản." }, { status: 409 });
      const segments = segmentsFromText(input.scriptText, Number(current.targetDuration));
      await sql`UPDATE scripts SET is_current=false WHERE project_id=${id}`;
      await sql`INSERT INTO scripts (project_id,angle_id,style_key,target_duration,script_text,segments,estimated_duration,version,is_current) VALUES (${id},${current.angleId},${current.styleKey},${current.targetDuration},${input.scriptText},${JSON.stringify(segments)}::jsonb,${current.estimatedDuration},${Number(current.version)+1},true)`;
    }
    const [project] = await sql`SELECT * FROM projects WHERE id=${id}`;
    return NextResponse.json({ project });
  } catch (e) { return apiError(e); }
}
