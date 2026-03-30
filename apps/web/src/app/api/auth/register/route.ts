// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1).max(100),
  username: z.string().min(2).max(50),
  college: z.string().max(150).optional(),
  branch: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  const parseResult = schema.safeParse(await req.json());
  if (!parseResult.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { email, password, fullName, username, college, branch } = parseResult.data;
  const service = await getSupabaseServiceClient();

  // Create auth user — pass role:"admin" in metadata to skip the broken
  // user_category_stats insert inside the handle_new_user trigger.
  const { data, error: createErr } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // no email verification needed for local dev
    user_metadata: {
      full_name: fullName,
      username: username.toLowerCase().replace(/\s+/g, "_"),
      college: college ?? null,
      branch: branch ?? null,
      role: "admin", // trick: prevents broken stats insert in trigger
    },
  });

  if (createErr) {
    return NextResponse.json({ error: createErr.message }, { status: 400 });
  }

  const userId = data.user.id;

  // Fix role back to student and set college/branch
  await service.from("profiles").update({
    role: "student",
    college: college ?? null,
    branch: branch ?? null,
  }).eq("id", userId);

  // Insert category stats manually
  const categories = ["aptitude", "verbal", "technical", "coding"];
  for (const category of categories) {
    await service.from("user_category_stats")
      .upsert({ user_id: userId, category }, { onConflict: "user_id,category" });
  }

  return NextResponse.json({ success: true });
}
