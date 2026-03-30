// @ts-nocheck
import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { Plus, Eye, EyeOff } from "lucide-react";
import DeleteTestButton from "./_components/DeleteTestButton";

export const metadata = { title: "Admin — Tests" };

const CATEGORY_COLOR: Record<string, string> = {
  aptitude:  "bg-blue-100 text-blue-700",
  verbal:    "bg-purple-100 text-purple-700",
  technical: "bg-orange-100 text-orange-700",
  coding:    "bg-green-100 text-green-700",
};
const DIFF_COLOR: Record<string, string> = {
  easy:   "bg-emerald-100 text-emerald-700",
  medium: "bg-yellow-100 text-yellow-700",
  hard:   "bg-red-100 text-red-700",
};

export default async function AdminTestsPage() {
  await requireAdmin();
  const supabase = await getSupabaseServerClient();

  const { data: tests } = await supabase
    .from("tests")
    .select("*, questions(count), test_attempts(count)")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{tests?.length ?? 0} tests total</p>
        </div>
        <Link
          href="/admin/tests/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Test
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Test</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Difficulty</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Questions</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Attempts</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tests && tests.length > 0 ? (
                tests.map((t) => {
                  const qCount = (t.questions as unknown as Array<{ count: number }>)?.[0]?.count ?? 0;
                  const aCount = (t.test_attempts as unknown as Array<{ count: number }>)?.[0]?.count ?? 0;
                  return (
                    <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{t.title}</p>
                        <p className="text-xs text-muted-foreground">{t.duration_mins} mins · {t.total_marks} marks</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${CATEGORY_COLOR[t.category] ?? ""}`}>
                          {t.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${DIFF_COLOR[t.difficulty] ?? ""}`}>
                          {t.difficulty}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-medium">{qCount}</td>
                      <td className="px-4 py-3 text-center font-medium">{aCount}</td>
                      <td className="px-4 py-3 text-center">
                        {t.is_published ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                            <Eye className="h-3.5 w-3.5" /> Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-medium">
                            <EyeOff className="h-3.5 w-3.5" /> Draft
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <Link
                            href={`/admin/tests/${t.id}`}
                            className="text-xs text-primary font-medium hover:underline"
                          >
                            Manage →
                          </Link>
                          <DeleteTestButton testId={t.id} isPublished={t.is_published} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No tests yet. Create your first test.
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
