import { NextRequest, NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/session";
export async function GET(request: NextRequest) {
  const user = await sessionFromRequest(request);
  return user ? NextResponse.json({ user }) : NextResponse.json({ user: null }, { status: 401 });
}
