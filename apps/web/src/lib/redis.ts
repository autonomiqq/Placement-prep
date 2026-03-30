import Redis from "ioredis";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    client.on("error", (err) => {
      // Log but don't crash — Redis is a performance layer, not critical path
      console.error("[Redis] connection error:", err.message);
    });
  }
  return client;
}
