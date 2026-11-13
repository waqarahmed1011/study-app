import { must, route } from "@/lib/api";
import { syncDiagramItems } from "@/lib/diagram/sync";
import type { IdCtx } from "@/lib/route-types";

// Rebuild this diagram's picture flashcards and questions from its confirmed labels.
export const POST = route<IdCtx>(async (_req, repo, { params }) => {
  const { id } = await params;
  const d = await must(repo.get("diagrams", id));
  return syncDiagramItems(repo, d);
});
