// @ts-nocheck
import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { Plus, Upload, Search } from "lucide-react";

export const metadata = { title: "Admin — Students" };
export const dynamic = "force-dynamic";

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; college?: string; branch?: string; section?: string }>;
}) {
  await requireAdmin();
  const { q, college, branch, section } = await searchParams;
  const supabase = await getSupabaseServiceClient();

  // Distinct values for filter chips
  const { data: filterData } = await supabase
    .from("profiles")
    .select("college, branch, section")
    .eq("role", "student");

  const colleges = [...new Set((filterData ?? []).map((r) => r.college).filter(Boolean))].sort();
  const branches = [...new Set(
    (filterData ?? [])
      .filter((r) => !college || r.college === college)
      .map((r) => r.branch).filter(Boolean)
  )].sort();
  const sections = [...new Set(
    (filterData ?? [])
      .filter((r) => (!college || r.college === college) && (!branch || r.branch === branch))
      .map((r) => r.section).filter(Boolean)
  )].sort();

  let query = supabase
    .from("profiles")
    .select(`
      id, full_name, college, branch, section, graduation_year, created_at, last_active,
      total_points,
      user_category_stats(category, tests_taken, avg_score)
    `)
    .eq("role", "student")
    .order("college", { ascending: true })
    .order("branch", { ascending: true })
    .order("section", { ascending: true })
    .order("full_name", { ascending: true });

  if (q) query = query.ilike("full_name", `%${q}%`);
  if (college) query = query.eq("college", college);
  if (branch) query = query.eq("branch", branch);
  if (section) query = query.eq("section", section);

  const { data: students } = await query;

  function filterHref(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (college) p.set("college", college);
    if (branch) p.set("branch", branch);
    if (section) p.set("section", section);
    Object.entries(overrides).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k));
    const s = p.toString();
    return `/admin/students${s ? `?${s}` : ""}`;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Students</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{students?.length ?? 0} students shown</p>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/students/bulk"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
            <Upload className="h-4 w-4" /> Bulk Import
          </Link>
          <Link href="/admin/students/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors">
            <Plus className="h-4 w-4" /> Add Student
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Name search */}
        <form method="GET" className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input name="q" defaultValue={q} placeholder="Search by name..."
            className="w-full rounded-lg border border-border bg-white pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          {college && <input type="hidden" name="college" value={college} />}
          {branch && <input type="hidden" name="branch" value={branch} />}
          {section && <input type="hidden" name="section" value={section} />}
        </form>

        {/* College chips */}
        {colleges.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-16">College</span>
            <Link href={filterHref({ college: undefined, branch: undefined, section: undefined })}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${!college ? "bg-primary text-white border-primary" : "border-border hover:bg-muted"}`}>
              All
            </Link>
            {colleges.map((c) => (
              <Link key={c} href={filterHref({ college: c, branch: undefined, section: undefined })}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${college === c ? "bg-primary text-white border-primary" : "border-border hover:bg-muted"}`}>
                {c}
              </Link>
            ))}
          </div>
        )}

        {/* Branch chips */}
        {branches.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-16">Branch</span>
            <Link href={filterHref({ branch: undefined, section: undefined })}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${!branch ? "bg-primary text-white border-primary" : "border-border hover:bg-muted"}`}>
              All
            </Link>
            {branches.map((b) => (
              <Link key={b} href={filterHref({ branch: b, section: undefined })}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${branch === b ? "bg-primary text-white border-primary" : "border-border hover:bg-muted"}`}>
                {b}
              </Link>
            ))}
          </div>
        )}

        {/* Section chips */}
        {sections.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-16">Section</span>
            <Link href={filterHref({ section: undefined })}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${!section ? "bg-primary text-white border-primary" : "border-border hover:bg-muted"}`}>
              All
            </Link>
            {sections.map((s) => (
              <Link key={s} href={filterHref({ section: s })}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${section === s ? "bg-primary text-white border-primary" : "border-border hover:bg-muted"}`}>
                Sec {s}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">College</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Branch</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Sec</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Tests</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Avg Score</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Points</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {students && students.length > 0 ? (
                students.map((s) => {
                  const stats = s.user_category_stats as Array<{ tests_taken: number; avg_score: number }> | null;
                  const totalTests = stats?.reduce((sum, c) => sum + c.tests_taken, 0) ?? 0;
                  const avgScore = totalTests > 0 && stats
                    ? (stats.reduce((sum, c) => sum + c.avg_score * c.tests_taken, 0) / totalTests).toFixed(1)
                    : "—";

                  return (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{s.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">Batch {s.graduation_year ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{s.college ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.branch ?? "—"}</td>
                      <td className="px-4 py-3 text-center">
                        {s.section
                          ? <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold">{s.section}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center font-medium">{totalTests}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-medium ${parseFloat(avgScore) >= 60 ? "text-green-600" : avgScore === "—" ? "text-muted-foreground" : "text-orange-600"}`}>
                          {avgScore}{avgScore !== "—" && "%"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-medium">{s.total_points}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {s.last_active ? new Date(s.last_active).toLocaleDateString() : "Never"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    {q || college || branch || section
                      ? "No students match the selected filters."
                      : "No students yet. Add your first student."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
