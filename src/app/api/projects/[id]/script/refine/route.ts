import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, requireUser } from "@/lib/http";
import { refineScriptText } from "@/lib/ai/deepseek";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    const user=await requireUser(request);const{id}=await params;
    await enforceRateLimit(user.id,"script-refine",60,3600);
    const input=z.object({text:z.string().min(5).max(10000),action:z.enum(["rewrite","shorter","longer","stronger_hook","natural","sales"])}).parse(await request.json());
    const[project]=await db()`SELECT * FROM projects WHERE id=${id} AND user_id=${user.id}`;
    if(!project)return NextResponse.json({error:"Không tìm thấy dự án."},{status:404});
    const text=await refineScriptText(input.text,input.action,Number(project.targetDuration));
    return NextResponse.json({text});
  }catch(e){return apiError(e)}
}
