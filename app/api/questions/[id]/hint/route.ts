import { must, route } from "@/lib/api";
import { getAI } from "@/lib/ai/provider";
import { hintPrompt } from "@/lib/ai/prompts";
import { HintSchema } from "@/lib/ai/schemas";
import { describeAnswer } from "@/lib/study/questions";
import type { IdCtx } from "@/lib/route-types";

export const POST = route<IdCtx>(async (_req, repo, { params }) => {
  const { id } = await params;
  const q = await must(repo.get("questions", id));
  const ai = await getAI();
  const { hint } = await ai.json({ task: "hint", schema: HintSchema, prompt: hintPrompt(q.prompt, describeAnswer(q)), lite: true });
  return { hint };
});
