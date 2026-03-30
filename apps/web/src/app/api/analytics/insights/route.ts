import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface CategoryInsight {
  category: string;
  label: string;
  avgScore: number;
  accuracy: number | null; // correct / seen, null if no questions seen
  questionsSeen: number;
  correctCount: number;
  testsTaken: number;
  weaknessScore: number; // 0–100, higher = weaker
}

export interface TopicInsight {
  tag: string;
  wrongCount: number;
  totalCount: number;
  accuracy: number; // 0–100
}

export interface RecommendedTest {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  durationMins: number;
  totalMarks: number;
  tags: string[];
  alreadyTaken: boolean;
}

export interface InsightsPayload {
  hasData: boolean;
  weakCategories: CategoryInsight[];
  strongCategories: CategoryInsight[];
  weakTopics: TopicInsight[];
  recommendedTests: RecommendedTest[];
  overallAccuracy: number | null;
  totalQuestionsAttempted: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  aptitude: "Aptitude",
  verbal: "Verbal",
  technical: "Technical",
  coding: "Coding",
};

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Category-level stats
  const { data: categoryStats } = await supabase
    .from("user_category_stats")
    .select("category, avg_score, best_score, tests_taken, questions_seen, correct_count, total_time_secs")
    .eq("user_id", user.id);

  // 2. All submitted attempt IDs for this user
  const { data: attempts } = await supabase
    .from("test_attempts")
    .select("id, test_id")
    .eq("user_id", user.id)
    .eq("status", "submitted");

  const attemptIds = (attempts ?? []).map((a) => a.id);
  const takenTestIds = [...new Set((attempts ?? []).map((a) => a.test_id))];

  // 3. Wrong answers with question tags (topic-level weakness)
  let weakTopics: TopicInsight[] = [];
  if (attemptIds.length > 0) {
    const { data: allAnswers } = await supabase
      .from("answers")
      .select("is_correct, question_id, questions(tags)")
      .in("attempt_id", attemptIds)
      .limit(500);

    // Aggregate tag stats
    const tagStats: Record<string, { wrong: number; total: number }> = {};
    for (const ans of allAnswers ?? []) {
      const q = ans.questions as { tags: string[] } | null;
      for (const tag of q?.tags ?? []) {
        if (!tagStats[tag]) tagStats[tag] = { wrong: 0, total: 0 };
        tagStats[tag].total += 1;
        if (!ans.is_correct) tagStats[tag].wrong += 1;
      }
    }

    weakTopics = Object.entries(tagStats)
      .filter(([, s]) => s.total >= 3) // only meaningful if seen at least 3 times
      .map(([tag, s]) => ({
        tag,
        wrongCount: s.wrong,
        totalCount: s.total,
        accuracy: Math.round(((s.total - s.wrong) / s.total) * 100),
      }))
      .sort((a, b) => a.accuracy - b.accuracy) // worst accuracy first
      .slice(0, 8);
  }

  // 4. Compute category insights
  const categoryInsights: CategoryInsight[] = (categoryStats ?? []).map((s) => {
    const accuracy =
      s.questions_seen > 0
        ? Math.round((s.correct_count / s.questions_seen) * 100)
        : null;

    // Weakness score: weighted combo of low avg_score and low accuracy
    // Range 0–100. Higher = weaker.
    const scoreComponent = s.tests_taken > 0 ? 100 - s.avg_score : 50;
    const accuracyComponent = accuracy !== null ? 100 - accuracy : 50;
    const dataWeight = Math.min(s.tests_taken / 3, 1); // fully weight after 3 tests
    const weaknessScore =
      s.tests_taken === 0
        ? 0 // no data — not considered weak
        : Math.round(scoreComponent * 0.5 + accuracyComponent * 0.5) * dataWeight;

    return {
      category: s.category,
      label: CATEGORY_LABELS[s.category] ?? s.category,
      avgScore: Math.round(s.avg_score ?? 0),
      accuracy,
      questionsSeen: s.questions_seen ?? 0,
      correctCount: s.correct_count ?? 0,
      testsTaken: s.tests_taken ?? 0,
      weaknessScore,
    };
  });

  const activeCategories = categoryInsights.filter((c) => c.testsTaken > 0);
  const sortedByWeakness = [...categoryInsights].sort(
    (a, b) => b.weaknessScore - a.weaknessScore
  );
  const weakCategories = sortedByWeakness.filter((c) => c.testsTaken > 0).slice(0, 2);
  const strongCategories = [...activeCategories]
    .sort((a, b) => a.weaknessScore - b.weaknessScore)
    .filter((c) => c.weaknessScore < 40)
    .slice(0, 2);

  // 5. Recommended tests — prioritize weak categories, prefer untaken
  const weakCategoryKeys = weakCategories.map((c) => c.category);
  const targetCategories =
    weakCategoryKeys.length > 0 ? weakCategoryKeys : ["aptitude", "verbal", "technical", "coding"];

  const { data: candidateTests } = await supabase
    .from("tests")
    .select("id, title, category, difficulty, duration_mins, total_marks, tags")
    .eq("is_published", true)
    .in("category", targetCategories)
    .limit(20);

  const recommendedTests: RecommendedTest[] = (candidateTests ?? [])
    .map((t) => ({
      id: t.id,
      title: t.title,
      category: t.category,
      difficulty: t.difficulty,
      durationMins: t.duration_mins,
      totalMarks: t.total_marks,
      tags: t.tags ?? [],
      alreadyTaken: takenTestIds.includes(t.id),
    }))
    .sort((a, b) => {
      // Untaken first, then by weakness priority
      if (a.alreadyTaken !== b.alreadyTaken) return a.alreadyTaken ? 1 : -1;
      const aWeak = weakCategoryKeys.indexOf(a.category);
      const bWeak = weakCategoryKeys.indexOf(b.category);
      return (aWeak === -1 ? 99 : aWeak) - (bWeak === -1 ? 99 : bWeak);
    })
    .slice(0, 4);

  // 6. Overall accuracy
  const totalSeen = activeCategories.reduce((s, c) => s + c.questionsSeen, 0);
  const totalCorrect = activeCategories.reduce((s, c) => s + c.correctCount, 0);
  const overallAccuracy =
    totalSeen > 0 ? Math.round((totalCorrect / totalSeen) * 100) : null;

  const payload: InsightsPayload = {
    hasData: activeCategories.length > 0,
    weakCategories,
    strongCategories,
    weakTopics,
    recommendedTests,
    overallAccuracy,
    totalQuestionsAttempted: totalSeen,
  };

  return NextResponse.json(payload);
}
