import { must, route } from "@/lib/api";
import { detectDiagram } from "@/lib/ai/pipeline";
import type { IdCtx } from "@/lib/route-types";

export const maxDuration = 300;

// Re-run AI detection (replaces the current draft regions).
export const POST = route<IdCtx>(async (_req, repo, { params }) => {
  const { id } = await params;
  const d = await must(repo.get("diagrams", id));
  const source = await must(repo.get("sources", d.source_id));
  return detectDiagram(repo, source);
});
