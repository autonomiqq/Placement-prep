import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { streamPlacementAgent } from "@/lib/agent/PlacementAgent";

const bodySchema = z.object({
  message: z.string().min(1).max(4000),
  context: z
    .object({
      testId: z.string().uuid().optional(),
      questionId: z.string().uuid().optional(),
      category: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parseResult = bodySchema.safeParse(await req.json());
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.flatten() }, { status: 400 });
  }

  const { message, context } = parseResult.data;

  const stream = await streamPlacementAgent({
    userId: user.id,
    message,
    context,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
