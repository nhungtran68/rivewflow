import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, requireUser } from "@/lib/http";
export async function GET(request:NextRequest){try{const u=await requireUser(request);return NextResponse.json({styles:await db()`SELECT * FROM custom_styles WHERE user_id=${u.id} ORDER BY created_at DESC`})}catch(e){return apiError(e)}}
export async function POST(request:NextRequest){try{const u=await requireUser(request);const i=z.object({name:z.string().min(2).max(80),prompt:z.string().min(10).max(3000)}).parse(await request.json());const[s]=await db()`INSERT INTO custom_styles (user_id,name,prompt) VALUES (${u.id},${i.name},${i.prompt}) RETURNING *`;return NextResponse.json({style:s},{status:201})}catch(e){return apiError(e)}}
