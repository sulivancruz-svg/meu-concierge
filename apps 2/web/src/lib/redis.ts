import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as { redis: Redis | undefined };

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL ?? 'redis://localhost:6380', {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;
