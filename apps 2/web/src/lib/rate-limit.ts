import { redis } from './redis';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export async function checkRateLimit({
  key,
  limit,
  windowSecs,
}: {
  key: string;
  limit: number;
  windowSecs: number;
}): Promise<RateLimitResult> {
  try {
    const now = Date.now();
    const windowMs = windowSecs * 1000;
    const redisKey = `rl:${key}`;

    const pipe = redis.pipeline();
    pipe.zremrangebyscore(redisKey, 0, now - windowMs);
    pipe.zadd(redisKey, now, `${now}-${Math.random()}`);
    pipe.zcard(redisKey);
    pipe.pexpire(redisKey, windowMs);
    const results = await pipe.exec();

    const count = (results?.[2]?.[1] as number) ?? 0;
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt: now + windowMs,
    };
  } catch {
    // Fail open se Redis estiver fora
    return { allowed: true, remaining: 1, resetAt: Date.now() + windowSecs * 1000 };
  }
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}
