import { redisConnection } from "@/lib/queue";

async function fixedWindow(identity: string, scope: string, max: number, windowSeconds: number) {
  const redis = redisConnection();
  const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `rl:${scope}:${identity}:${bucket}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSeconds + 5);
  if (count > max) {
    throw new Response("Too Many Requests", {
      status: 429,
      headers: { "Retry-After": String(windowSeconds) }
    });
  }
}

/** Fixed-window limiter for expensive authenticated endpoints. */
export async function enforceRateLimit(userId: string, scope: string, max: number, windowSeconds: number) {
  return fixedWindow(userId, scope, max, windowSeconds);
}

/** Limiter for unauthenticated surfaces such as login/register. Never pass secrets here. */
export async function enforcePublicRateLimit(identityHash: string, scope: string, max: number, windowSeconds: number) {
  return fixedWindow(identityHash, scope, max, windowSeconds);
}
