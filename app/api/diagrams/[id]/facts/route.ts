import { HttpError, must, route } from "@/lib/api";
import { getAI } from "@/lib/ai/provider";
import { diagramFactsPrompt, SYSTEM_TUTOR } from "@/lib/ai/prompts";
import { QuestionsSchema } from "@/lib/ai/schemas";
import { normaliseQuestion } from "@/lib/study/questions";
import type { IdCtx } from "@/lib/route-types";

export const maxDuration = 120;

// AI fact questions about the diagram's structures. They start unverified and
// stay out of Smart Study until the student checks and verifies them.
export const POST = route<IdCtx>(async (_req, repo, { params }) => {
  const { id } = await params;
  const d = await must(repo.get("diagrams", id));
  const labels = d.regions.filter((r) => r.confirmed).map((r) => r.label);
  if (!labels.length) throw new HttpError(400, "Confirm some labels first.");
  const source = await repo.get("sources", d.source_id);
  const ai = await getAI();
  const res = await ai.json({
    task: "diagram_facts",
    schema: QuestionsSchema,
    system: SYSTEM_TUTOR,
    prompt: diagramFactsPrompt(d.title, labels, source?.extracted_md ?? ""),
  });
  await repo.removeWhere("questions", { diagram_id: d.id, verified: false });
  const rows = res.questions
    .map(normaliseQuestion)
    .filter((q): q is NonNullable<typeof q> => q !== null)
    .map((q) => ({
      kit_id: d.kit_id, topic_id: d.topic_id, type: q.type, prompt: q.prompt, payload: q.payload, answer: q.answer,
      explanation: q.explanation, difficulty: q.difficulty, origin: "diagram" as const, diagram_id: d.id, verified: false, rating: 0,
      image: null, region_id: null, gen_kind: "fact" as const,
    }));
  return { questions: await repo.insertMany("questions", rows) };
});

export const GET = route<IdCtx>(async (_req, repo, { params }) => {
  const { id } = await params;
  return { questions: await repo.list("questions", { diagram_id: id }, { orderBy: "created_at" }) };
});
