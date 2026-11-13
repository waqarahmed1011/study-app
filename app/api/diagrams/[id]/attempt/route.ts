import { must, route } from "@/lib/api";
import { applyToTopic } from "@/lib/study/service";
import type { IdCtx } from "@/lib/route-types";

// Records a hide-label or tap-to-identify answer for one region.
export const POST = route<IdCtx>(async (req, repo, { params }) => {
  const { id } = await params;
  const d = await must(repo.get("diagrams", id));
  const { regionId, correct, response } = (await req.json()) as { regionId: string; correct: boolean; response?: unknown };
  const regions = d.regions.map((r) => (r.id === regionId ? { ...r, seen: r.seen + 1, correct: r.correct + (correct ? 1 : 0) } : r));
  await repo.update("diagrams", id, { regions });
  await repo.insert("attempts", {
    kit_id: d.kit_id, question_id: null, topic_id: d.topic_id, session_id: null, mode: "diagram",
    correct, score: correct ? 1 : 0, response: { regionId, response: response ?? null }, feedback: null,
  });
  const topic = await applyToTopic(repo, d.topic_id, 2, correct ? 1 : 0);
  return { mastery: topic?.mastery ?? null };
});
