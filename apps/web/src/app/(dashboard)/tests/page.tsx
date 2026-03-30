// @ts-nocheck
import Link from "next/link";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils/cn";
import { Clock, BookOpen, BarChart2, ChevronRight, Zap } from "lucide-react";

export const metadata = { title: "Practice Tests" };
export const dynamic = "force-dynamic";

const CATEGORIES = ["aptitude", "verbal", "technical", "coding"] as const;
const DIFFICULTIES = ["easy", "medium", "hard"] as const;

const categoryColors: Record<string, string> = {
  aptitude: "bg-blue-100 text-blue-700 border-blue-200",
  verbal: "bg-purple-100 text-purple-700 border-purple-200",
  technical: "bg-orange-100 text-orange-700 border-orange-200",
  coding: "bg-green-100 text-green-700 border-green-200",
};

const difficultyColors: Record<string, string> = {
  easy: "text-green-600",
  medium: "text-amber-600",
  hard: "text-red-600",
};

interface SearchParams {
  category?: string;
  difficulty?: string;
}

export default async function TestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { category, difficulty } = await searchParams;
  const supabase = await getSupabaseServerClient();
  const serviceClient = await getSupabaseServiceClient();

  // Get current user to filter by assignment visibility
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch visible test IDs via DB function (respects college/branch/section assignments)
  const { data: visibleRows } = await serviceClient.rpc("get_visible_test_ids", {
    p_user_id: user!.id,
  });
  const visibleIds = (visibleRows ?? []) as string[];

  let query = serviceClient
    .from("tests")
    .select("id, title, description, category, difficulty, duration_mins, total_marks, passing_marks, tags, is_ai_generated")
    .in("id", visibleIds.length > 0 ? visibleIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: false });

  if (category && CATEGORIES.includes(category as typeof CATEGORIES[number])) {
    query = query.eq("category", category);
  }
  if (difficulty && DIFFICULTIES.includes(difficulty as typeof DIFFICULTIES[number])) {
    query = query.eq("difficulty", difficulty);
  }

  const { data: tests } = await query;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Practice Tests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a test category and start practicing
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/tests"
          className={cn(
            "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
            !category && !difficulty
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border hover:bg-muted"
          )}
        >
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/tests?category=${c}`}
            className={cn(
              "rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors",
              category === c
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted"
            )}
          >
            {c}
          </Link>
        ))}
        <div className="w-px bg-border mx-1" />
        {DIFFICULTIES.map((d) => (
          <Link
            key={d}
            href={`/tests?difficulty=${d}`}
            className={cn(
              "rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors",
              difficulty === d
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:bg-muted"
            )}
          >
            {d}
          </Link>
        ))}
      </div>

      {/* Test grid */}
      {tests && tests.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tests.map((test) => (
            <Link
              key={test.id}
              href={`/tests/${test.id}`}
              className="group rounded-xl border border-border bg-card p-6 hover:shadow-md hover:border-primary/30 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <span
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold capitalize",
                    categoryColors[test.category]
                  )}
                >
                  {test.category}
                </span>
                {test.is_ai_generated && (
                  <span className="flex items-center gap-1 text-xs text-primary font-medium">
                    <Zap className="h-3 w-3" />
                    AI Generated
                  </span>
                )}
              </div>

              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
                {test.title}
              </h3>
              {test.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-4">{test.description}</p>
              )}

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {test.duration_mins} min
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5" />
                  {test.total_marks} marks
                </span>
                <span className={cn("font-medium capitalize", difficultyColors[test.difficulty])}>
                  {test.difficulty}
                </span>
              </div>

              {test.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {test.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center justify-end text-xs font-semibold text-primary gap-1">
                Start test
                <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No tests found for the selected filters.</p>
          <Link href="/tests" className="mt-3 text-sm font-semibold text-primary hover:underline">
            Clear filters
          </Link>
        </div>
      )}
    </div>
  );
}
