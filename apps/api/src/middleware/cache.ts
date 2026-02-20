import { Request, Response, NextFunction } from "express";
import { cacheGet, cacheSet } from "../lib/redis";

/**
 * Express middleware for per-route response caching via Redis.
 * When Redis is unavailable, requests pass through without caching.
 */
export function cacheMiddleware(ttlSeconds: number, keyPrefix: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const cacheKey = `${keyPrefix}:${req.originalUrl}`;

    const cached = await cacheGet<{ status: number; body: unknown }>(cacheKey);
    if (cached) {
      res.status(cached.status).json(cached.body);
      return;
    }

    // Override res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheSet(cacheKey, { status: res.statusCode, body }, ttlSeconds).catch(() => {});
      }
      return originalJson(body);
    };

    next();
  };
}
