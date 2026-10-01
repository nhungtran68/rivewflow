import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, requireUser } from "@/lib/http";
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){try{const u=await requireUser(request);const{id}=await params;const i=z.object({name:z.string().min(2).max(80),prompt:z.string().min(10).max(3000)}).parse(await request.json());const[s]=await db()`UPDATE custom_styles SET name=${i.name},prompt=${i.prompt},updated_at=now() WHERE id=${id} AND user_id=${u.id} RETURNING *`;if(!s)return NextResponse.json({error:"Không tìm thấy phong cách."},{status:404});return NextResponse.json({style:s})}catch(e){return apiError(e)}}
export async function DELETE(request:NextRequest,{params}:{params:Promise<{id:string}>}){try{const u=await requireUser(request);const{id}=await params;await db()`DELETE FROM custom_styles WHERE id=${id} AND user_id=${u.id}`;return NextResponse.json({ok:true})}catch(e){return apiError(e)}}
