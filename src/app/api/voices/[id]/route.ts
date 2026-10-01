import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, requireUser } from "@/lib/http";
import { ElevenLabsProvider } from "@/lib/tts/elevenlabs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request); const { id } = await params;
    const input = z.object({ displayName: z.string().min(1).max(80).optional(), speed: z.number().min(0.5).max(2).optional(), isDefault: z.boolean().optional() }).parse(await request.json());
    const [voice] = await db()`SELECT * FROM voices WHERE id=${id} AND user_id=${user.id}`;
    if (!voice) return NextResponse.json({ error: "Không tìm thấy giọng." }, { status: 404 });
    if (input.isDefault) await db()`UPDATE voices SET is_default=false WHERE user_id=${user.id}`;
    const [updated] = await db()`UPDATE voices SET display_name=COALESCE(${input.displayName ?? null},display_name),speed=COALESCE(${input.speed ?? null},speed),is_default=COALESCE(${input.isDefault ?? null},is_default),updated_at=now() WHERE id=${id} RETURNING *`;
    return NextResponse.json({ voice: updated });
  } catch (e) { return apiError(e); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request); const { id } = await params;
    const [voice] = await db()`SELECT * FROM voices WHERE id=${id} AND user_id=${user.id}`;
    if (!voice) return NextResponse.json({ error: "Không tìm thấy giọng." }, { status: 404 });
    if (voice.provider === "ELEVENLABS") await new ElevenLabsProvider().deleteVoice(voice.externalVoiceId);
    await db()`DELETE FROM voices WHERE id=${id} AND user_id=${user.id}`;
    return NextResponse.json({ ok: true });
  } catch (e) { return apiError(e); }
}
