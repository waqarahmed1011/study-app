import { route } from "@/lib/api";
import { describeAnswer } from "@/lib/study/questions";
import type { IdCtx } from "@/lib/route-types";

// Question history: recent answers with the question and the right answer.
export const GET = route<IdCtx>(async (_req, repo, { params }) => {
  const { id } = await params;
  const attempts = await repo.list("attempts", { kit_id: id }, { orderBy: "created_at", ascending: false, limit: 200 });
  const questions = new Map((await repo.list("questions", { kit_id: id })).map((q) => [q.id, q]));
  return {
    items: attempts
      .filter((a) => a.question_id && questions.has(a.question_id))
      .map((a) => {
        const q = questions.get(a.question_id!)!;
        return { id: a.id, at: a.created_at, mode: a.mode, correct: a.correct, score: a.score, prompt: q.prompt, type: q.type, answer: describeAnswer(q), feedback: a.feedback };
      }),
  };
});
