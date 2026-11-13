import "server-only";
import { GoogleGenAI, type Part } from "@google/genai";
import { z } from "zod";
import type { AIProvider, FilePart } from "./provider";

// Free-tier models (Nov 2026). Override with env vars if Google renames them.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const LITE_MODEL = process.env.GEMINI_LITE_MODEL || "gemini-3.5-flash-lite";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toParts(prompt: string, files?: FilePart[]): Part[] {
  const parts: Part[] = (files ?? []).map((f) => ({
    inlineData: { mimeType: f.mimeType, data: Buffer.from(f.data).toString("base64") },
  }));
  parts.push({ text: prompt });
  return parts;
}

function isRetryable(err: unknown) {
  const msg = String((err as Error)?.message ?? err);
  return /429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|overloaded|500|INTERNAL/i.test(msg);
}

/** Retries rate limits / overloads with exponential backoff (free tier hits these). */
async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let delay = 2000;
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= attempts - 1 || !isRetryable(err)) throw err;
      await sleep(delay + Math.random() * 500);
      delay *= 2;
    }
  }
}

/**
 * Gemini accepts a subset of JSON Schema. Drop the "$schema" header and the
 * +-2^53 bounds zod adds to every integer, which add nothing and can be rejected.
 */
export function toGeminiSchema(schema: z.ZodType): unknown {
  const clean = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(clean);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "$schema") continue;
      if ((k === "minimum" || k === "maximum") && typeof v === "number" && Math.abs(v) >= Number.MAX_SAFE_INTEGER) continue;
      out[k] = clean(v);
    }
    return out;
  };
  return clean(z.toJSONSchema(schema, { target: "draft-7" }));
}

function stripFences(s: string) {
  return s.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
}

export function createGeminiProvider(apiKey: string): AIProvider {
  const ai = new GoogleGenAI({ apiKey });

  return {
    name: `gemini (${MODEL})`,

    async json({ schema, system, prompt, files, lite }) {
      const jsonSchema = toGeminiSchema(schema);
      let lastErr: unknown;
      // one retry on invalid JSON, with the validation error fed back
      for (let attempt = 0; attempt < 2; attempt++) {
        const extra =
          attempt === 0 ? "" : `\n\nYour previous reply was invalid: ${String(lastErr).slice(0, 500)}. Return valid JSON only.`;
        const res = await withRetry(() =>
          ai.models.generateContent({
            model: lite ? LITE_MODEL : MODEL,
            contents: [{ role: "user", parts: toParts(prompt + extra, files) }],
            config: {
              systemInstruction: system,
              responseMimeType: "application/json",
              responseJsonSchema: jsonSchema,
              temperature: 0.4,
            },
          }),
        );
        try {
          return schema.parse(JSON.parse(stripFences(res.text ?? "")));
        } catch (err) {
          lastErr = err;
        }
      }
      throw new Error(`The AI returned malformed output: ${String(lastErr).slice(0, 300)}`);
    },

    async text({ system, prompt, files, lite }) {
      const res = await withRetry(() =>
        ai.models.generateContent({
          model: lite ? LITE_MODEL : MODEL,
          contents: [{ role: "user", parts: toParts(prompt, files) }],
          config: { systemInstruction: system, temperature: 0.3 },
        }),
      );
      return res.text ?? "";
    },

    async *stream({ system, messages }) {
      const stream = await withRetry(() =>
        ai.models.generateContentStream({
          model: MODEL,
          contents: messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          config: { systemInstruction: system, temperature: 0.5 },
        }),
      );
      for await (const chunk of stream) {
        if (chunk.text) yield chunk.text;
      }
    },
  };
}
