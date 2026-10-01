import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { verifyPassword } from "@/lib/passwords";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import { enforcePublicRateLimit } from "@/lib/rate-limit";
import { stableHash } from "@/lib/hash";

export async function POST(request: NextRequest) {
  try {
    const input = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(await request.json());
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    await enforcePublicRateLimit(stableHash(`${ip}:${input.email.toLowerCase()}`), "login", 10, 900);
    const [user] = await db()`SELECT id,email,name,password_hash FROM users WHERE email=${input.email.toLowerCase()} LIMIT 1`;
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) return NextResponse.json({ error: "Email hoặc mật khẩu không đúng." }, { status: 401 });
    const response = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
    setSessionCookie(response, await createSessionToken(user));
    return response;
  } catch (e) { return apiError(e); }
}
