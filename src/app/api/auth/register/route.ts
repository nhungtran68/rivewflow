import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { hashPassword } from "@/lib/passwords";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import { enforcePublicRateLimit } from "@/lib/rate-limit";
import { stableHash } from "@/lib/hash";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email().transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(128)
});

export async function POST(request: NextRequest) {
  try {
    const input = schema.parse(await request.json());
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    await enforcePublicRateLimit(stableHash(ip), "register", 5, 3600);
    const sql = db();
    const existing = await sql`SELECT id FROM users WHERE email=${input.email} LIMIT 1`;
    if (existing.length) return NextResponse.json({ error: "Email đã được sử dụng." }, { status: 409 });
    const passwordHash = await hashPassword(input.password);
    const [user] = await sql`INSERT INTO users (name,email,password_hash) VALUES (${input.name},${input.email},${passwordHash}) RETURNING id,email,name`;
    const sessionUser = { id: String(user.id), email: String(user.email), name: String(user.name) };
    const response = NextResponse.json({ user: sessionUser });
    setSessionCookie(response, await createSessionToken(sessionUser));
    return response;
  } catch (e) { return apiError(e); }
}
