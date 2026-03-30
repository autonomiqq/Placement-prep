import { getRedis } from "@/lib/redis";
import { SupabaseClient } from "@supabase/supabase-js";

export function bufKey(attemptId: string) {
  return `answers:buf:${attemptId}`;
}

/**
 * Reads the Redis answer buffer for an attempt and batch-upserts to DB.
 * Returns the number of rows flushed.
 */
export async function flushBuffer(
  attemptId: string,
  supabase: SupabaseClient
): Promise<number> {
  try {
    const redis = getRedis();
    const raw = await redis.hgetall(bufKey(attemptId));
    if (!raw || Object.keys(raw).length === 0) return 0;

    const rows = Object.entries(raw).map(([questionId, json]) => {
      const { selectedOption, isSkipped, timeSpentSecs } = JSON.parse(json);
      return {
        attempt_id: attemptId,
        question_id: questionId,
        selected_option: selectedOption,
        is_skipped: isSkipped,
        time_spent_secs: timeSpentSecs,
      };
    });

    await supabase
      .from("answers")
      .upsert(rows, { onConflict: "attempt_id,question_id" });

    return rows.length;
  } catch {
    return 0;
  }
}
