import type { TestCategory, DifficultyLevel, QuestionType, AttemptStatus } from "./database";

export interface McqOption {
  key: "A" | "B" | "C" | "D";
  content: string;
}

export interface Question {
  id: string;
  questionNumber: number;
  type: QuestionType;
  category: TestCategory;
  difficulty: DifficultyLevel;
  content: string;
  codeSnippet: string | null;
  language: string | null;
  marks: number;
  negativeMarks: number;
  timeLimitSecs: number | null;
  tags: string[];
  options?: McqOption[]; // MCQ only, is_correct stripped during active attempt
}

export interface Test {
  id: string;
  title: string;
  description: string | null;
  category: TestCategory;
  difficulty: DifficultyLevel;
  durationMins: number;
  totalMarks: number;
  passingMarks: number;
  isAiGenerated: boolean;
  tags: string[];
  questionCount?: number;
}

export interface AttemptResult {
  id: string;
  testId: string;
  status: AttemptStatus;
  score: number;
  totalMarks: number;
  percentage: number;
  timeTakenSecs: number;
  startedAt: string;
  submittedAt: string;
  answers: AnswerResult[];
}

export interface AnswerResult {
  questionId: string;
  selectedOption: string | null;
  isCorrect: boolean | null;
  marksAwarded: number;
  isSkipped: boolean;
  correctOption?: string;
  explanation?: string;
}

export interface TestSessionState {
  status: "idle" | "loading" | "active" | "submitting" | "completed";
  attemptId: string | null;
  test: Test | null;
  questions: Question[];
  answers: Record<string, string | null>; // questionId -> selectedOption
  flagged: Set<string>;
  currentIndex: number;
  timeRemainingSeconds: number;
  result: AttemptResult | null;
  expiresAt: string | null;
}
