import { NextRequest, NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/session";

export async function requireUser(request: NextRequest) {
  const user = await sessionFromRequest(request);
  if (!user) throw new Response("Unauthorized", { status: 401 });
  return user;
}

export function apiError(error: unknown) {
  if (error instanceof Response) return error;
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(error);
  return NextResponse.json({ error: "Không thể xử lý yêu cầu.", detail: process.env.NODE_ENV === "development" ? message : undefined }, { status: 500 });
}
