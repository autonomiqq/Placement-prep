import { isOllamaReady } from "@/lib/ollama/client";
import { NextResponse } from "next/server";

export async function GET() {
  const ollamaOk = await isOllamaReady();
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    services: { ollama: ollamaOk ? "up" : "down" },
  });
}
