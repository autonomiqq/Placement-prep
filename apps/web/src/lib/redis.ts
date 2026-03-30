import Redis from "ioredis";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: 1,   // fail fast — Redis is a cache, not critical path
      enableReadyCheck: false,
      lazyConnect: true,
      connectTimeout: 3000,      // 3s max to establish connection on Vercel
      commandTimeout: 3000,      // 3s max per command
    });
    client.on("error", () => {
      // Suppress — all callers have try/catch
    });
  }
  return client;
}
