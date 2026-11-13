import "server-only";
import type { Repo } from "@/lib/data/repo";
import { getAI } from "@/lib/ai/provider";
import { batchGradePrompt, gradePrompt, SYSTEM_TUTOR } from "@/lib/ai/prompts";
import { BatchGradeSchema, GradeSchema } from "@/lib/ai/schemas";
import type { Question, StudyMode, Topic } from "@/lib/types";
import { averageMastery, levelFromMastery, updateMastery } from "./mastery";
import { describeAnswer, gradeObjective } from "./questions";

export interface AnswerResult {
  correct: boolean;
  score: number;
  feedback: string | null;
  correctAnswer: string;
  answer: Question["answer"];
  explanation: string;
  mastery: number | null;
  level: { level: number; pct: number };
}

/** Bump a topic's mastery and counters after an answer. */
export async function applyToTopic(repo: Repo, topicId: string | null, difficulty: 1 | 2 | 3, score: number) {
  if (!topicId) return null;
  const t = await repo.get("topics", topicId);
  if (!t) return null;
  const mastery = updateMastery(t.mastery, difficulty, score, t.attempts);
  return repo.update("topics", t.id, {
    mastery,
    attempts: t.attempts + 1,
    correct: t.correct + (score >= 0.999 ? 1 : 0),
  });
}

export async function kitLevel(repo: Repo, kitId: string, topics?: Topic[]) {
  const ts = topics ?? (await repo.list("topics", { kit_id: kitId }));
  return levelFromMastery(averageMastery(ts));
}

export async function gradeShortAnswer(q: Question, response: string) {
  if (!response.trim()) return { score: 0, feedback: "No answer given." };
  const ai = await getAI();
  const g = await ai.json({
    task: "grade",
    schema: GradeSchema,
    system: SYSTEM_TUTOR,
    prompt: gradePrompt(q.prompt, (q.answer as { text: string }).text, response),
    lite: true,
  });
  return { score: g.score >= 0.75 ? 1 : g.score >= 0.25 ? 0.5 : 0, feedback: g.feedback };
}

export async function answerQuestion(
  repo: Repo,
  q: Question,
  response: unknown,
  opts: { sessionId: string | null; mode: StudyMode },
): Promise<AnswerResult> {
  let correct: boolean;
  let score: number;
  let feedback: string | null = null;

  const objective = gradeObjective(q.type, q.answer, response);
  if (objective) {
    ({ correct, score } = objective);
  } else {
    const g = await gradeShortAnswer(q, String(response ?? ""));
    score = g.score;
    correct = score >= 1;
    feedback = g.feedback;
  }

  // record the attempt and update the topic at the same time
  const [, topic] = await Promise.all([
    repo.insert("attempts", {
      kit_id: q.kit_id,
      question_id: q.id,
      topic_id: q.topic_id,
      session_id: opts.sessionId,
      mode: opts.mode,
      correct,
      score,
      response: response ?? null,
      feedback,
    }),
    applyToTopic(repo, q.topic_id, q.difficulty, score),
  ]);

  return {
    correct,
    score,
    feedback,
    correctAnswer: describeAnswer(q),
    answer: q.answer,
    explanation: q.explanation,
    mastery: topic?.mastery ?? null,
    level: await kitLevel(repo, q.kit_id),
  };
}

/** Grade a whole practice test: objective questions locally, short answers in one AI call. */
export async function gradeTest(questions: Question[], responses: Record<string, unknown>) {
  const results = new Map<string, { correct: boolean; score: number; feedback: string | null }>();
  const short: { id: string; question: string; model: string; answer: string }[] = [];
  for (const q of questions) {
    const r = responses[q.id];
    const g = gradeObjective(q.type, q.answer, r);
    if (g) results.set(q.id, { ...g, feedback: null });
    else if (!String(r ?? "").trim()) results.set(q.id, { correct: false, score: 0, feedback: "No answer given." });
    else short.push({ id: q.id, question: q.prompt, model: (q.answer as { text: string }).text, answer: String(r) });
  }
  if (short.length) {
    const ai = await getAI();
    const res = await ai.json({ task: "grade_batch", schema: BatchGradeSchema, system: SYSTEM_TUTOR, prompt: batchGradePrompt(short), lite: true });
    for (const s of short) {
      const g = res.grades.find((x) => x.id === s.id);
      const score = !g ? 0 : g.score >= 0.75 ? 1 : g.score >= 0.25 ? 0.5 : 0;
      results.set(s.id, { correct: score >= 1, score, feedback: g?.feedback ?? "Couldn't grade this one." });
    }
  }
  return results;
}

/** Days in a row (ending today or yesterday) with at least one answer. */
export function streakFrom(dates: string[], now = new Date()) {
  const days = new Set(dates.map((d) => new Date(d).toLocaleDateString("en-CA")));
  let streak = 0;
  const cursor = new Date(now);
  if (!days.has(cursor.toLocaleDateString("en-CA"))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.toLocaleDateString("en-CA"))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
