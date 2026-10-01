import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, requireUser } from "@/lib/http";

const createSchema = z.object({
  productName: z.string().trim().min(1).max(160),
  description: z.string().max(1000).optional().default(""),
  price: z.string().max(100).optional().default(""),
  offer: z.string().max(300).optional().default(""),
  targetCustomer: z.string().max(500).optional().default(""),
  highlights: z.string().max(1000).optional().default(""),
  cta: z.string().max(300).optional().default(""),
  forbiddenInfo: z.string().max(1000).optional().default(""),
  targetDuration: z.union([z.literal(15),z.literal(30),z.literal(45),z.literal(60),z.literal(90)]).default(30),
  styleKey: z.string().default("natural_intro"),
  subtitlesEnabled: z.boolean().default(true)
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const rows = await db()`SELECT p.*, (SELECT storage_key FROM render_outputs r WHERE r.project_id=p.id ORDER BY created_at DESC LIMIT 1) AS output_key FROM projects p WHERE user_id=${user.id} ORDER BY created_at DESC LIMIT 100`;
    return NextResponse.json({ projects: rows });
  } catch (e) { return apiError(e); }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const input = createSchema.parse(await request.json());
    const [project] = await db()`INSERT INTO projects (user_id,name,product_name,description,price,offer,target_customer,highlights,cta,forbidden_info,target_duration,style_key,subtitles_enabled,status,progress,status_message)
      VALUES (${user.id},${input.productName},${input.productName},${input.description},${input.price},${input.offer},${input.targetCustomer},${input.highlights},${input.cta},${input.forbiddenInfo},${input.targetDuration},${input.styleKey},${input.subtitlesEnabled},'UPLOADING',5,'Chờ tải video lên') RETURNING *`;
    return NextResponse.json({ project }, { status: 201 });
  } catch (e) { return apiError(e); }
}
