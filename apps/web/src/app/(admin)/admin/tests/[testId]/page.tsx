// @ts-nocheck
import { requireAdmin } from "@/lib/supabase/admin-guard";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import TestManagerClient from "./_components/TestManagerClient";
import TestAssignmentPanel from "./_components/TestAssignmentPanel";

export const dynamic = "force-dynamic";

export default async function AdminTestDetailPage({ params }: { params: Promise<{ testId: string }> }) {
  await requireAdmin();
  const { testId } = await params;
  const supabase = await getSupabaseServiceClient();

  const { data: test } = await supabase
    .from("tests")
    .select("*")
    .eq("id", testId)
    .single();

  if (!test) notFound();

  const [
    { data: questions },
    { data: attemptStats },
    { data: assignments },
    { data: colleges },
  ] = await Promise.all([
    supabase.from("questions").select("*, mcq_options(*)").eq("test_id", testId).order("question_number"),
    supabase.from("test_attempts").select("percentage, score").eq("test_id", testId).eq("status", "submitted"),
    supabase.from("test_assignments").select("*").eq("test_id", testId).order("created_at"),
    supabase.from("colleges").select("id, name, code").order("name"),
  ]);

  const avgScore = attemptStats && attemptStats.length > 0
    ? (attemptStats.reduce((s, a) => s + (a.percentage ?? 0), 0) / attemptStats.length).toFixed(1)
    : null;

  // Distinct branches and sections from students for the dropdowns
  const { data: profileData } = await supabase
    .from("profiles")
    .select("college, branch, section")
    .eq("role", "student");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/tests" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{test.title}</h1>
          <p className="text-sm text-muted-foreground capitalize">
            {test.category} · {test.difficulty} · {test.duration_mins} mins · {questions?.length ?? 0} questions
          </p>
        </div>
      </div>

      <TestManagerClient
        test={test}
        questions={questions ?? []}
        attemptCount={attemptStats?.length ?? 0}
        avgScore={avgScore}
      />

      <TestAssignmentPanel
        testId={testId}
        assignments={assignments ?? []}
        colleges={colleges ?? []}
        profileData={profileData ?? []}
      />
    </div>
  );
}
