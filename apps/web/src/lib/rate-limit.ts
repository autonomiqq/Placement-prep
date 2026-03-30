/**
 * Sliding window rate limiter backed by Redis.
 * Falls back to allowing the request if Redis is unavailable.
 */
import { getRedis } from "@/lib/redis";
import { NextResponse } from "next/server";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSecs: number;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSecs: number
): Promise<RateLimitResult> {
  try {
    const redis = getRedis();
    const redisKey = `rl:${key}`;
    const pipeline = redis.pipeline();
    pipeline.incr(redisKey);
    pipeline.ttl(redisKey);
    const [[, count], [, ttl]] = (await pipeline.exec()) as [[null, number], [null, number]];

    if (ttl < 0) {
      await redis.expire(redisKey, windowSecs);
    }

    const remaining = Math.max(0, limit - count);
    return {
      allowed: count <= limit,
      remaining,
      resetInSecs: ttl > 0 ? ttl : windowSecs,
    };
  } catch {
    // Redis down — allow request
    return { allowed: true, remaining: limit, resetInSecs: windowSecs };
  }
}

export function rateLimitResponse(resetInSecs: number) {
  return NextResponse.json(
    { error: "Too many requests. Please slow down." },
    {
      status: 429,
      headers: {
        "Retry-After": String(resetInSecs),
        "X-RateLimit-Reset": String(Date.now() + resetInSecs * 1000),
      },
    }
  );
}
