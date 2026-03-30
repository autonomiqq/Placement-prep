/**
 * PlacementAgent — Agentic AI orchestrator for placement preparation.
 *
 * Uses Ollama's native tool-calling API with llama3.1:8b (smart tier).
 * Executes a ReAct-style loop: think → act (tool call) → observe → repeat.
 * Falls back to fast tier if smart tier is not running.
 *
 * Future extensions:
 *  - Add more tools (web search, code execution sandbox, company-specific patterns)
 *  - Persist agent memory across sessions via agent_memory table
 *  - Multi-agent: coordinator + specialist agents (aptitude, coding, verbal)
 */

import { chat, ChatMessage, ToolCall } from "@/lib/ollama/client";
import { resolveSmartRoute } from "@/lib/ollama/router";
import { getToolDefinitions, executeTool } from "./tools";

const MAX_ITERATIONS = 6;

const AGENT_SYSTEM_PROMPT = `You are PlacementAgent, an advanced AI assistant specialized in helping engineering students in India prepare for campus placement tests at companies like TCS, Infosys, Wipro, Amazon, and Google.

You have access to tools that let you:
- Search the knowledge base for relevant study content
- Look up the student's actual performance data
- Find similar practice questions
- Retrieve recent test history
- Perform precise arithmetic calculations

Guidelines:
- Always check the student's performance before giving generic advice — personalize your response
- Use the knowledge base before answering factual questions about topics
- For aptitude problems, use the calculate tool to verify your math
- Be concise, specific, and actionable
- When recommending practice, reference actual questions from the database when available
- Format code with markdown code blocks
- Mention time/space complexity for algorithm explanations`;

export interface AgentRunOptions {
  userId: string;
  message: string;
  context?: {
    testId?: string;
    questionId?: string;
    category?: string;
  };
  onChunk?: (text: string) => void;
  onToolCall?: (name: string, args: Record<string, unknown>) => void;
}

export interface AgentResult {
  response: string;
  toolCallsMade: string[];
  iterations: number;
}

export async function runPlacementAgent(opts: AgentRunOptions): Promise<AgentResult> {
  const { userId, message, context, onChunk, onToolCall } = opts;

  const route = await resolveSmartRoute();
  const tools = getToolDefinitions();
  const toolCallsMade: string[] = [];

  const contextNote = context
    ? `\n[Context: category=${context.category ?? "none"}, testId=${context.testId ?? "none"}]`
    : "";

  const messages: ChatMessage[] = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
    { role: "user", content: message + contextNote },
  ];

  let iterations = 0;
  let finalResponse = "";

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const result = await chat(messages, {
      baseUrl: route.baseUrl,
      model: route.model,
      temperature: 0.4,
      maxTokens: 2048,
      tools,
    });

    // No tool calls → final answer
    if (!result.tool_calls || result.tool_calls.length === 0) {
      finalResponse = result.content;
      if (onChunk) onChunk(result.content);
      break;
    }

    // Add assistant message with tool calls to history
    messages.push({ role: "assistant", content: result.content ?? "" });

    // Execute all tool calls in parallel
    const toolResults = await Promise.all(
      result.tool_calls.map(async (tc: ToolCall) => {
        const name = tc.function.name;
        const args = tc.function.arguments as Record<string, unknown>;

        toolCallsMade.push(name);
        if (onToolCall) onToolCall(name, args);

        const output = await executeTool(name, args, userId);
        return { call: tc, output };
      })
    );

    // Feed tool results back as tool messages
    for (const { call, output } of toolResults) {
      messages.push({
        role: "tool",
        content: output,
        tool_call_id: call.id,
      });
    }
  }

  if (!finalResponse && iterations >= MAX_ITERATIONS) {
    // Force a final answer if we hit the iteration limit
    const finishResult = await chat(
      [
        ...messages,
        {
          role: "user",
          content: "Based on the information gathered, provide your final answer now.",
        },
      ],
      { baseUrl: route.baseUrl, model: route.model, temperature: 0.4, maxTokens: 1024 }
    );
    finalResponse = finishResult.content;
    if (onChunk) onChunk(finalResponse);
  }

  return { response: finalResponse, toolCallsMade, iterations };
}

/**
 * Stream version — returns a ReadableStream for SSE responses.
 * The agent runs tool calls non-streaming, then streams the final answer.
 */
export async function streamPlacementAgent(
  opts: AgentRunOptions
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        const result = await runPlacementAgent({
          ...opts,
          onToolCall: (name) => {
            // Send a lightweight status event so the UI can show "Using tool: ..."
            const status = encoder.encode(`\x00[tool:${name}]`);
            controller.enqueue(status);
          },
        });
        controller.enqueue(encoder.encode(result.response));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
