import { must, route } from "@/lib/api";
import type { IdCtx } from "@/lib/route-types";

// Thumbs up/down and "verified" toggles. A thumbs-down removes the question from Smart Study.
export const PATCH = route<IdCtx>(async (req, repo, { params }) => {
  const { id } = await params;
  await must(repo.get("questions", id));
  const body = (await req.json()) as { rating?: number; verified?: boolean };
  return repo.update("questions", id, {
    ...(typeof body.rating === "number" ? { rating: Math.max(-1, Math.min(1, Math.round(body.rating))) } : {}),
    ...(typeof body.verified === "boolean" ? { verified: body.verified } : {}),
  });
});

export const DELETE = route<IdCtx>(async (_req, repo, { params }) => {
  const { id } = await params;
  await repo.removeWhere("attempts", { question_id: id });
  await repo.remove("questions", id);
  return { ok: true };
});
