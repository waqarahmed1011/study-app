import { HttpError, must, route } from "@/lib/api";
import { generateMoreQuestions } from "@/lib/ai/pipeline";
import { seededShuffle } from "@/lib/study/questions";
import type { IdCtx } from "@/lib/route-types";
import type { Question, QuestionType, TestConfig } from "@/lib/types";

// Create a practice test from the question bank. If the bank is short for the
// requested mix, ask the AI for more first.
export const POST = route<IdCtx>(async (req, repo, { params }) => {
  const { id } = await params;
  const kit = await must(repo.get("kits", id), "Kit not found");
  const config = (await req.json()) as TestConfig;
  const total = Object.values(config.counts).reduce((s, n) => s + (n ?? 0), 0);
  if (total < 1) throw new HttpError(400, "Pick at least one question.");
  if (total > 100) throw new HttpError(400, "Keep it to 100 questions or fewer.");

  const eligible = (qs: Question[]) =>
    qs.filter((q) => q.verified && q.rating >= 0 && (!config.topicIds.length || (q.topic_id && config.topicIds.includes(q.topic_id))));

  let bank = eligible(await repo.list("questions", { kit_id: id }));
  const short = (Object.entries(config.counts) as [QuestionType, number][]).some(([t, n]) => bank.filter((q) => q.type === t).length < n);
  if (short) {
    try {
      await generateMoreQuestions(repo, id, Math.min(30, total));
      bank = eligible(await repo.list("questions", { kit_id: id }));
    } catch {
      // fall through with what we have
    }
  }

  const seed = String(Date.now());
  const picked: Question[] = [];
  for (const [type, n] of Object.entries(config.counts) as [QuestionType, number][]) {
    if (!n) continue;
    // closest difficulty first, shuffled within each difficulty
    const ofType = seededShuffle(bank.filter((q) => q.type === type), seed + type).sort(
      (a, b) => Math.abs(a.difficulty - config.difficulty) - Math.abs(b.difficulty - config.difficulty),
    );
    picked.push(...ofType.slice(0, n));
  }
  if (!picked.length) throw new HttpError(409, "Not enough questions in this kit for that test yet. Try different question types.");

  const existing = await repo.list("tests", { kit_id: id });
  return repo.insert("tests", {
    kit_id: id,
    title: `${kit.title} · Test ${existing.length + 1}`,
    config,
    question_ids: seededShuffle(picked, seed).map((q) => q.id),
    status: "ready",
    score: null,
    results: null,
    responses: null,
    started_at: new Date().toISOString(),
    submitted_at: null,
  });
});
