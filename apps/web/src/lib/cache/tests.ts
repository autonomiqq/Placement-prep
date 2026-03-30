/**
 * Redis cache for test questions.
 * With 2000 students starting the same exam simultaneously, this prevents
 * 2000 identical DB reads — they all hit cache after the first fetch.
 *
 * TTL: 10 minutes. Invalidated when admin publishes/updates a test.
 */
import { getRedis } from "@/lib/redis";

const QUESTIONS_TTL = 600; // 10 minutes
const TEST_TTL = 600;

// v2: questions stored as camelCase after schema transformation
function questionsKey(testId: string) {
  return `test:questions:v2:${testId}`;
}
function testKey(testId: string) {
  return `test:meta:v2:${testId}`;
}

export async function getCachedQuestions(testId: string): Promise<unknown[] | null> {
  try {
    const redis = getRedis();
    const raw = await redis.get(questionsKey(testId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // Cache miss on error — fall through to DB
  }
}

export async function setCachedQuestions(testId: string, questions: unknown[]): Promise<void> {
  try {
    const redis = getRedis();
    await redis.setex(questionsKey(testId), QUESTIONS_TTL, JSON.stringify(questions));
  } catch {
    // Non-fatal
  }
}

export async function getCachedTest(testId: string): Promise<unknown | null> {
  try {
    const redis = getRedis();
    const raw = await redis.get(testKey(testId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setCachedTest(testId: string, test: unknown): Promise<void> {
  try {
    const redis = getRedis();
    await redis.setex(testKey(testId), TEST_TTL, JSON.stringify(test));
  } catch {
    // Non-fatal
  }
}

export async function invalidateTestCache(testId: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del(questionsKey(testId), testKey(testId));
  } catch {
    // Non-fatal
  }
}
