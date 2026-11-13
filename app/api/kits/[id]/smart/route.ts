import { must, publicQuestion, route } from "@/lib/api";
import { generateMoreQuestions } from "@/lib/ai/pipeline";
import { freshCount, buildStats, pickNextQuestion } from "@/lib/study/scheduler";
import { kitLevel } from "@/lib/study/service";
import type { IdCtx } from "@/lib/route-types";

// Returns the next Smart Study question. Tops up the bank with new AI questions
// when the student has worked through most of it.
export const POST = route<IdCtx>(async (req, repo, { params }) => {
  const { id } = await params;
  await must(repo.get("kits", id), "Kit not found");
  const { recentIds = [], topicId } = (await req.json().catch(() => ({}))) as { recentIds?: string[]; topicId?: string };

  let questions = await repo.list("questions", { kit_id: id });
  const topics = await repo.list("topics", { kit_id: id });
  const attempts = await repo.list("attempts", { kit_id: id });
  const stats = buildStats(attempts);
  const now = Date.now();

  let toppedUp = false;
  const usable = questions.filter((q) => q.verified && q.rating >= 0);
  if (usable.length > 0 && freshCount(usable, stats, now) < 3 && recentIds.length >= 3) {
    try {
      const added = await generateMoreQuestions(repo, id, 10);
      questions = [...questions, ...added];
      toppedUp = added.length > 0;
    } catch {
      // keep going with spaced review if the AI is rate-limited
    }
  }

  const pool = topicId ? questions.filter((q) => q.topic_id === topicId) : questions;
  const next = pickNextQuestion({ questions: pool, topics, stats, recentIds, now });
  const topic = next ? topics.find((t) => t.id === next.topic_id) : null;
  return {
    question: next ? publicQuestion(next) : null,
    topic: topic ? { id: topic.id, name: topic.name, mastery: topic.mastery } : null,
    seenBefore: next ? stats.has(next.id) : false,
    level: await kitLevel(repo, id, topics),
    toppedUp,
  };
});
