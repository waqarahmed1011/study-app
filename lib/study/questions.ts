import type { RawQuestion } from "@/lib/ai/schemas";
import type { Question, QuestionAnswer, QuestionPayload, QuestionType } from "@/lib/types";

export type NormalisedQuestion = Pick<
  Question,
  "type" | "prompt" | "payload" | "answer" | "explanation" | "difficulty"
> & { topic: string };

/** Deterministic shuffle so tests are stable; seeded by the text itself. */
export function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Turn the model's flat question into our payload/answer shape, shuffling
 * options so the right answer isn't always first. Returns null for questions
 * that are unusable (e.g. an MCQ with no correct option) so they get dropped.
 */
export function normaliseQuestion(q: RawQuestion): NormalisedQuestion | null {
  const difficulty = Math.min(3, Math.max(1, Math.round(q.difficulty || 2))) as 1 | 2 | 3;
  const base = { prompt: q.prompt.trim(), explanation: q.explanation?.trim() ?? "", difficulty, topic: q.topic };
  if (!base.prompt) return null;

  switch (q.type) {
    case "mcq":
    case "multi_select":
    case "true_false": {
      let options = q.options.map((o) => o.trim()).filter(Boolean);
      let correct = [...new Set(q.correct_indices)].filter((i) => i >= 0 && i < options.length);
      if (q.type === "true_false") {
        options = ["True", "False"];
        // models sometimes give ["False","True"]; map by text
        const said = q.options[q.correct_indices[0]]?.toLowerCase();
        correct = [said === "false" ? 1 : 0];
      }
      if (options.length < 2 || correct.length === 0) return null;
      if (q.type === "mcq" && correct.length !== 1) correct = [correct[0]];
      if (q.type !== "true_false") {
        const idx = seededShuffle(options.map((_, i) => i), base.prompt);
        const newOptions = idx.map((i) => options[i]);
        correct = correct.map((c) => idx.indexOf(c)).sort((a, b) => a - b);
        options = newOptions;
      }
      return { ...base, type: q.type, payload: { options }, answer: { correct } };
    }
    case "matching": {
      const pairs = q.pairs.filter((p) => p.left?.trim() && p.right?.trim());
      if (pairs.length < 2) return null;
      const left = pairs.map((p) => p.left.trim());
      const rightIdx = seededShuffle(pairs.map((_, i) => i), base.prompt);
      const right = rightIdx.map((i) => pairs[i].right.trim());
      // pairs[i] = position in `right` of left[i]'s match
      const answerPairs = pairs.map((_, i) => rightIdx.indexOf(i));
      return { ...base, type: "matching", payload: { left, right }, answer: { pairs: answerPairs } };
    }
    case "ordering": {
      const order = q.order.map((o) => o.trim()).filter(Boolean);
      if (order.length < 3) return null;
      let idx = seededShuffle(order.map((_, i) => i), base.prompt);
      // a shuffle that lands on the correct order would give the answer away
      if (idx.every((v, i) => v === i)) idx = [...idx.slice(1), idx[0]];
      const items = idx.map((i) => order[i]);
      // answer.order[k] = index in items of the k-th correct item
      const correctOrder = order.map((_, k) => idx.indexOf(k));
      return { ...base, type: "ordering", payload: { items }, answer: { order: correctOrder } };
    }
    case "short_answer": {
      const text = q.answer_text?.trim();
      if (!text) return null;
      return { ...base, type: "short_answer", payload: {}, answer: { text } };
    }
  }
  return null;
}

/** Grade objective question types. Short answers need the AI and return null here. */
export function gradeObjective(
  type: QuestionType,
  answer: QuestionAnswer,
  response: unknown,
): { correct: boolean; score: number } | null {
  if (type === "short_answer") return null;
  if (type === "mcq" || type === "true_false") {
    const want = (answer as { correct: number[] }).correct[0];
    const got = Array.isArray(response) ? response[0] : response;
    const ok = got === want;
    return { correct: ok, score: ok ? 1 : 0 };
  }
  if (type === "multi_select") {
    const want = new Set((answer as { correct: number[] }).correct);
    const got = new Set(Array.isArray(response) ? (response as number[]) : []);
    const hits = [...got].filter((g) => want.has(g)).length;
    const wrong = got.size - hits;
    const score = Math.max(0, (hits - wrong) / want.size);
    return { correct: hits === want.size && wrong === 0, score };
  }
  if (type === "matching") {
    const want = (answer as { pairs: number[] }).pairs;
    const got = Array.isArray(response) ? (response as number[]) : [];
    const hits = want.filter((w, i) => got[i] === w).length;
    return { correct: hits === want.length, score: hits / want.length };
  }
  if (type === "ordering") {
    const want = (answer as { order: number[] }).order;
    const got = Array.isArray(response) ? (response as number[]) : [];
    const hits = want.filter((w, i) => got[i] === w).length;
    return { correct: hits === want.length, score: hits / want.length };
  }
  return null;
}

/** Human-readable correct answer, used in feedback and test review. */
export function describeAnswer(q: Pick<Question, "type" | "payload" | "answer">): string {
  const p = q.payload as Record<string, string[]>;
  switch (q.type) {
    case "mcq":
    case "true_false":
    case "multi_select":
      return (q.answer as { correct: number[] }).correct.map((i) => p.options[i]).join("; ");
    case "matching":
      return (q.answer as { pairs: number[] }).pairs.map((r, i) => `${p.left[i]} → ${p.right[r]}`).join("; ");
    case "ordering":
      return (q.answer as { order: number[] }).order.map((i, k) => `${k + 1}. ${p.items[i]}`).join("  ");
    case "short_answer":
      return (q.answer as { text: string }).text;
  }
}

export function emptyPayload(): QuestionPayload {
  return {};
}
