// Auto-generated types — run `npm run gen-types` to refresh from Supabase

export type TestCategory = "aptitude" | "verbal" | "technical" | "coding";
export type DifficultyLevel = "easy" | "medium" | "hard";
export type QuestionType = "mcq" | "coding";
export type AttemptStatus = "in_progress" | "submitted" | "timed_out" | "abandoned";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          full_name: string | null;
          college: string | null;
          branch: string | null;
          graduation_year: number | null;
          avatar_url: string | null;
          total_points: number;
          rank: number | null;
          streak_days: number;
          last_active: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      tests: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          category: TestCategory;
          difficulty: DifficultyLevel;
          duration_mins: number;
          total_marks: number;
          passing_marks: number;
          is_ai_generated: boolean;
          is_published: boolean;
          created_by: string | null;
          tags: string[];
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["tests"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["tests"]["Insert"]>;
      };
      questions: {
        Row: {
          id: string;
          test_id: string;
          question_number: number;
          type: QuestionType;
          category: TestCategory;
          difficulty: DifficultyLevel;
          content: string;
          code_snippet: string | null;
          language: string | null;
          marks: number;
          negative_marks: number;
          time_limit_secs: number | null;
          explanation: string | null;
          ai_explanation: string | null;
          tags: string[];
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["questions"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["questions"]["Insert"]>;
      };
      mcq_options: {
        Row: {
          id: string;
          question_id: string;
          option_key: "A" | "B" | "C" | "D" | "E";
          content: string;
          is_correct: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["mcq_options"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["mcq_options"]["Insert"]>;
      };
      test_attempts: {
        Row: {
          id: string;
          user_id: string;
          test_id: string;
          status: AttemptStatus;
          score: number | null;
          total_marks: number | null;
          percentage: number | null;
          time_taken_secs: number | null;
          started_at: string;
          submitted_at: string | null;
          metadata: Record<string, unknown>;
        };
        Insert: Omit<Database["public"]["Tables"]["test_attempts"]["Row"], "id" | "started_at">;
        Update: Partial<Database["public"]["Tables"]["test_attempts"]["Insert"]>;
      };
      answers: {
        Row: {
          id: string;
          attempt_id: string;
          question_id: string;
          selected_option: string | null;
          code_solution: string | null;
          is_correct: boolean | null;
          marks_awarded: number | null;
          time_spent_secs: number | null;
          is_skipped: boolean;
          submitted_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["answers"]["Row"], "id" | "submitted_at">;
        Update: Partial<Database["public"]["Tables"]["answers"]["Insert"]>;
      };
      user_category_stats: {
        Row: {
          id: string;
          user_id: string;
          category: TestCategory;
          tests_taken: number;
          questions_seen: number;
          correct_count: number;
          avg_score: number;
          best_score: number;
          total_time_secs: number;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["user_category_stats"]["Row"], "id" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["user_category_stats"]["Insert"]>;
      };
      tutor_sessions: {
        Row: {
          id: string;
          user_id: string;
          title: string | null;
          context: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["tutor_sessions"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["tutor_sessions"]["Insert"]>;
      };
      tutor_messages: {
        Row: {
          id: string;
          session_id: string;
          role: "user" | "assistant" | "system";
          content: string;
          tokens_used: number | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["tutor_messages"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["tutor_messages"]["Insert"]>;
      };
    };
    Views: {
      leaderboard: {
        Row: {
          id: string;
          username: string;
          full_name: string | null;
          avatar_url: string | null;
          college: string | null;
          branch: string | null;
          total_points: number;
          streak_days: number;
          rank: number;
        };
      };
    };
    Functions: {
      score_attempt: {
        Args: { p_attempt_id: string };
        Returns: Record<string, unknown>;
      };
      refresh_ranks: {
        Args: Record<string, never>;
        Returns: void;
      };
    };
    Enums: {
      test_category: TestCategory;
      difficulty_level: DifficultyLevel;
      question_type: QuestionType;
      attempt_status: AttemptStatus;
    };
  };
}
