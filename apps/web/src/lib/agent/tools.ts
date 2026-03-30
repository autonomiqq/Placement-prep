import { ToolDefinition } from "@/lib/ollama/client";
import { retrieve, findSimilarQuestions } from "@/lib/rag/retriever";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export type ToolHandler = (args: Record<string, unknown>, userId: string) => Promise<ToolResult>;

export interface AgentTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool definitions
// ─────────────────────────────────────────────────────────────────────────────

export const PLACEMENT_AGENT_TOOLS: Record<string, AgentTool> = {

  search_knowledge: {
    definition: {
      type: "function",
      function: {
        name: "search_knowledge",
        description:
          "Search the knowledge base for concepts, study notes, and practice questions relevant to a topic.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Topic or question to search for" },
            source_type: {
              type: "string",
              description: "Filter: 'question', 'concept', or 'study_note'",
              enum: ["question", "concept", "study_note"],
            },
          },
          required: ["query"],
        },
      },
    },
    handler: async (args) => {
      try {
        const chunks = await retrieve(args.query as string, {
          topK: 4,
          sourceType: args.source_type as "question" | "concept" | "study_note" | undefined,
        });
        if (chunks.length === 0) return { success: true, data: "No relevant content found." };
        return {
          success: true,
          data: chunks.map((c) => `[${c.source_type}] ${c.content}`).join("\n\n"),
        };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    },
  },

  get_student_performance: {
    definition: {
      type: "function",
      function: {
        name: "get_student_performance",
        description:
          "Get the student's performance stats across aptitude, verbal, technical, and coding categories.",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    handler: async (_args, userId) => {
      try {
        const supabase = getSupabaseServiceClient();
        const [{ data: stats }, { data: profile }] = await Promise.all([
          supabase
            .from("user_category_stats")
            .select("category, tests_taken, avg_score, best_score, correct_count, questions_seen")
            .eq("user_id", userId),
          supabase
            .from("profiles")
            .select("total_points, rank, streak_days")
            .eq("id", userId)
            .single(),
        ]);
        return {
          success: true,
          data: {
            category_stats: stats ?? [],
            total_points: profile?.total_points ?? 0,
            rank: profile?.rank,
            streak_days: profile?.streak_days ?? 0,
          },
        };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    },
  },

  find_similar_questions: {
    definition: {
      type: "function",
      function: {
        name: "find_similar_questions",
        description: "Find practice questions similar to a given topic. Returns question previews.",
        parameters: {
          type: "object",
          properties: {
            topic: { type: "string", description: "Topic or question text to match against" },
            count: { type: "string", description: "Number of results (1-10, default 5)" },
          },
          required: ["topic"],
        },
      },
    },
    handler: async (args) => {
      try {
        const count = Math.min(10, Math.max(1, parseInt(String(args.count ?? "5"), 10)));
        const results = await findSimilarQuestions(args.topic as string, count);
        if (results.length === 0) {
          return { success: true, data: "No similar questions found. Question bank may be empty." };
        }
        return { success: true, data: results };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    },
  },

  get_recent_tests: {
    definition: {
      type: "function",
      function: {
        name: "get_recent_tests",
        description: "Get the student's recent test attempts with scores and categories.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "string", description: "Number of attempts (default 5, max 10)" },
          },
          required: [],
        },
      },
    },
    handler: async (args, userId) => {
      try {
        const limit = Math.min(10, parseInt(String(args.limit ?? "5"), 10));
        const supabase = getSupabaseServiceClient();
        const { data } = await supabase
          .from("test_attempts")
          .select("score, percentage, time_taken_secs, submitted_at, tests(title, category, difficulty)")
          .eq("user_id", userId)
          .eq("status", "submitted")
          .order("submitted_at", { ascending: false })
          .limit(limit);
        return { success: true, data: data ?? [] };
      } catch (e) {
        return { success: false, error: String(e) };
      }
    },
  },

  calculate: {
    definition: {
      type: "function",
      function: {
        name: "calculate",
        description:
          "Evaluate arithmetic expressions for aptitude problems. Supports +, -, *, /, **, %, parentheses.",
        parameters: {
          type: "object",
          properties: {
            expression: {
              type: "string",
              description: "Math expression, e.g. '(15 * 4) / 100 + 37'",
            },
          },
          required: ["expression"],
        },
      },
    },
    handler: async (args) => {
      const expr = String(args.expression ?? "");
      // Strict allow-list to prevent code injection
      if (!/^[\d\s\+\-\*\/\%\(\)\.\,]+$/.test(expr)) {
        return { success: false, error: "Invalid expression — only arithmetic operators allowed." };
      }
      try {
        // eslint-disable-next-line no-new-func
        const result = Function(`"use strict"; return (${expr})`)() as number;
        return { success: true, data: { expression: expr, result: +result.toFixed(8) } };
      } catch {
        return { success: false, error: "Could not evaluate expression." };
      }
    },
  },
};

export function getToolDefinitions(): ToolDefinition[] {
  return Object.values(PLACEMENT_AGENT_TOOLS).map((t) => t.definition);
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  userId: string
): Promise<string> {
  const tool = PLACEMENT_AGENT_TOOLS[name];
  if (!tool) return JSON.stringify({ error: `Unknown tool: ${name}` });
  const result = await tool.handler(args, userId);
  return JSON.stringify(result.success ? result.data : { error: result.error });
}
