import { NextRequest, NextResponse } from "next/server";
import { requireAdminAPI } from "@/lib/supabase/admin-guard";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

function generatePassword() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return "PP@" + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function parseCSV(csv: string): Record<string, string>[] {
  const lines = csv.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdminAPI(req);
  if (error) return error;

  const { csv } = await req.json();
  if (!csv || typeof csv !== "string") {
    return NextResponse.json({ error: "CSV content required" }, { status: 400 });
  }

  const rows = parseCSV(csv);
  if (rows.length === 0) {
    return NextResponse.json({ error: "No data rows found in CSV" }, { status: 400 });
  }

  const supabase = await getSupabaseServiceClient();
  const results = [];

  for (const row of rows) {
    const email = row.email?.trim();
    const full_name = row.full_name?.trim() || row.name?.trim();

    if (!email || !full_name) {
      results.push({ email: email ?? "?", full_name: full_name ?? "?", status: "error", message: "Missing email or full_name" });
      continue;
    }

    const password = row.password?.trim() || generatePassword();
    const college = row.college?.trim() || undefined;
    const branch = row.branch?.trim() || undefined;
    const graduation_year = row.graduation_year ? parseInt(row.graduation_year) : undefined;

    // Pass role:"admin" to skip the broken trigger stats insert, fix manually after
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role: "admin" },
    });

    if (authError || !authData.user) {
      results.push({ email, full_name, status: "error", message: authError?.message ?? "Auth error" });
      continue;
    }

    const userId = authData.user.id;

    // Fix role to student and apply profile fields
    await supabase
      .from("profiles")
      .update({ role: "student", college: college ?? null, branch: branch ?? null, graduation_year: graduation_year ?? null })
      .eq("id", userId);

    // Insert category stats manually
    for (const category of ["aptitude", "verbal", "technical", "coding"]) {
      await supabase
        .from("user_category_stats")
        .upsert({ user_id: userId, category }, { onConflict: "user_id,category" });
    }

    results.push({
      email, full_name, status: "success",
      message: `Account created. Temp password: ${password}`,
    });
  }

  return NextResponse.json({ results, total: rows.length, created: results.filter((r) => r.status === "success").length });
}
