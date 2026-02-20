import Redis from "ioredis";

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;

  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    redis.connect().catch((err) => {
      console.error("Redis connection failed:", err.message);
      redis = null;
    });
  }

  return redis;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;

  try {
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // Silently fail — cache is optional
  }
}

export async function cacheInvalidate(pattern: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch {
    // Silently fail
  }
}
