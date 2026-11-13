import { must, route } from "@/lib/api";
import { answerQuestion } from "@/lib/study/service";
import type { IdCtx } from "@/lib/route-types";
import type { StudyMode } from "@/lib/types";

export const POST = route<IdCtx>(async (req, repo, { params }) => {
  const { id } = await params;
  const q = await must(repo.get("questions", id));
  const { response, sessionId = null, mode = "smart" } = (await req.json()) as { response: unknown; sessionId?: string | null; mode?: StudyMode };
  return answerQuestion(repo, q, response, { sessionId, mode });
});
