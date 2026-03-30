import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { flushBuffer } from "@/lib/exam/flush-buffer";

const bodySchema = z.object({ attemptId: z.string().uuid() });

/**
 * POST /api/tests/[testId]/answers/flush
 * Reads the Redis answer buffer and batch-upserts to DB.
 * Called every 30s by the exam page — 1 request per student vs N individual saves.
 */
export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parseResult = bodySchema.safeParse(await req.json());
  if (!parseResult.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { attemptId } = parseResult.data;
  const flushed = await flushBuffer(attemptId, supabase);
  return NextResponse.json({ ok: true, flushed });
}
