import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, requireUser } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    return NextResponse.json({ voices: await db()`SELECT * FROM voices WHERE user_id=${user.id} ORDER BY is_default DESC,created_at DESC` });
  } catch (e) { return apiError(e); }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const input = z.object({ provider: z.literal("VBEE"), displayName: z.string().min(1).max(80), externalVoiceId: z.string().min(2).max(255), speed: z.number().min(0.5).max(2).default(1) }).parse(await request.json());
    const [voice] = await db()`INSERT INTO voices (user_id,provider,display_name,external_voice_id,speed,status) VALUES (${user.id},${input.provider},${input.displayName},${input.externalVoiceId},${input.speed},'READY') ON CONFLICT (user_id,provider,external_voice_id) DO UPDATE SET display_name=excluded.display_name,speed=excluded.speed,updated_at=now() RETURNING *`;
    return NextResponse.json({ voice }, { status: 201 });
  } catch (e) { return apiError(e); }
}
