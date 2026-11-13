import "server-only";
import type { z } from "zod";

export interface FilePart {
  mimeType: string;
  data: Uint8Array;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * The one place the app talks to an LLM. `task` names the job so the mock
 * provider can return realistic canned output in tests and demo mode.
 */
export interface AIProvider {
  name: string;
  json<S extends z.ZodType>(opts: {
    task: string;
    schema: S;
    system?: string;
    prompt: string;
    files?: FilePart[];
    lite?: boolean; // cheaper/faster model for small jobs (grading, hints)
  }): Promise<z.infer<S>>;
  text(opts: {
    task: string;
    system?: string;
    prompt: string;
    files?: FilePart[];
    lite?: boolean;
  }): Promise<string>;
  stream(opts: {
    task: string;
    system: string;
    messages: ChatTurn[];
  }): AsyncIterable<string>;
}

let cached: AIProvider | null = null;

export async function getAI(): Promise<AIProvider> {
  if (cached) return cached;
  const forced = process.env.AI_PROVIDER;
  if (forced === "mock" || (!forced && !process.env.GEMINI_API_KEY)) {
    const { createMockProvider } = await import("./mock");
    cached = createMockProvider();
  } else {
    const { createGeminiProvider } = await import("./gemini");
    cached = createGeminiProvider(process.env.GEMINI_API_KEY!);
  }
  return cached;
}

export function isDemoAI() {
  return process.env.AI_PROVIDER === "mock" || (!process.env.AI_PROVIDER && !process.env.GEMINI_API_KEY);
}
