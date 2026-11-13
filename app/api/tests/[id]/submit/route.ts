import { HttpError, must, route } from "@/lib/api";
import { applyToTopic, gradeTest } from "@/lib/study/service";
import type { IdCtx } from "@/lib/route-types";
import type { Question } from "@/lib/types";

export const maxDuration = 120;

export const POST = route<IdCtx>(async (req, repo, { params }) => {
  const { id } = await params;
  const test = await must(repo.get("tests", id));
  if (test.status === "submitted") throw new HttpError(409, "Already submitted.");
  const { responses } = (await req.json()) as { responses: Record<string, unknown> };

  const questions = (await Promise.all(test.question_ids.map((qid) => repo.get("questions", qid)))).filter(Boolean) as Question[];
  const graded = await gradeTest(questions, responses ?? {});

  const results = questions.map((q) => ({ question_id: q.id, ...graded.get(q.id)! }));
  for (const q of questions) {
    const r = graded.get(q.id)!;
    await repo.insert("attempts", {
      kit_id: q.kit_id, question_id: q.id, topic_id: q.topic_id, session_id: test.id, mode: "test",
      correct: r.correct, score: r.score, response: responses?.[q.id] ?? null, feedback: r.feedback,
    });
    await applyToTopic(repo, q.topic_id, q.difficulty, r.score);
  }
  const score = results.length ? results.reduce((s, r) => s + r.score, 0) / results.length : 0;
  return repo.update("tests", id, { status: "submitted", score, results, responses, submitted_at: new Date().toISOString() });
});

export const DELETE = route<IdCtx>(async (_req, repo, { params }) => {
  const { id } = await params;
  await repo.remove("tests", id);
  return { ok: true };
});
