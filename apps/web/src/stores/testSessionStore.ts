import { create } from "zustand";
import type { TestSessionState, Question, Test, AttemptResult } from "@/types/test";

interface TestSessionActions {
  startSession: (test: Test, questions: Question[], attemptId: string, expiresAt: string) => void;
  answerQuestion: (questionId: string, value: string | null) => void;
  toggleFlag: (questionId: string) => void;
  navigateTo: (index: number) => void;
  tick: () => void;
  setSubmitting: () => void;
  completeSession: (result: AttemptResult) => void;
  resumeSession: () => void;
  resetSession: () => void;
}

const initialState: TestSessionState = {
  status: "idle",
  attemptId: null,
  test: null,
  questions: [],
  answers: {},
  flagged: new Set(),
  currentIndex: 0,
  timeRemainingSeconds: 0,
  result: null,
  expiresAt: null,
};

export const useTestSessionStore = create<TestSessionState & TestSessionActions>()((set, get) => ({
    ...initialState,

    startSession: (test, questions, attemptId, expiresAt) => {
      const secondsRemaining = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      );
      set({
        status: "active",
        test,
        questions,
        attemptId,
        expiresAt,
        timeRemainingSeconds: secondsRemaining,
        answers: {},
        flagged: new Set(),
        currentIndex: 0,
        result: null,
      });
    },

    answerQuestion: (questionId, value) => {
      set((state) => ({
        answers: { ...state.answers, [questionId]: value },
      }));
    },

    toggleFlag: (questionId) => {
      set((state) => {
        const flagged = new Set(state.flagged);
        if (flagged.has(questionId)) {
          flagged.delete(questionId);
        } else {
          flagged.add(questionId);
        }
        return { flagged };
      });
    },

    navigateTo: (index) => {
      const { questions } = get();
      if (index >= 0 && index < questions.length) {
        set({ currentIndex: index });
      }
    },

    tick: () => {
      set((state) => ({
        timeRemainingSeconds: Math.max(0, state.timeRemainingSeconds - 1),
      }));
    },

    setSubmitting: () => set({ status: "submitting" }),

    completeSession: (result) => set({ status: "completed", result }),

    resumeSession: () => set({ status: "active" }),

    resetSession: () => set(initialState),
  }));


// Selectors
export const selectCurrentQuestion = (state: TestSessionState) =>
  state.questions[state.currentIndex] ?? null;

export const selectAnsweredCount = (state: TestSessionState) =>
  Object.values(state.answers).filter((v) => v !== null).length;

export const selectProgress = (state: TestSessionState) => ({
  answered: Object.values(state.answers).filter((v) => v !== null).length,
  flagged: state.flagged.size,
  total: state.questions.length,
  skipped:
    state.questions.length -
    Object.values(state.answers).filter((v) => v !== null).length,
});
