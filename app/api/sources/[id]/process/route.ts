import { must, route } from "@/lib/api";
import { extractSource } from "@/lib/ai/pipeline";
import type { IdCtx } from "@/lib/route-types";

export const maxDuration = 300;

// Read one upload right away (used for diagrams added to a finished kit).
export const POST = route<IdCtx>(async (_req, repo, { params }) => {
  const { id } = await params;
  const s = await must(repo.get("sources", id));
  const out = await extractSource(repo, s);
  const diagram = (await repo.list("diagrams", { source_id: id }))[0] ?? null;
  return { source: { id: out.id, status: out.status, error: out.error }, diagram };
});
