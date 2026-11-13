import { must, route } from "@/lib/api";
import type { IdCtx } from "@/lib/route-types";

export const DELETE = route<IdCtx>(async (_req, repo, { params }) => {
  const { id } = await params;
  const s = await must(repo.get("sources", id));
  if (s.storage_path) await repo.removeFile(s.storage_path).catch(() => {});
  for (const d of await repo.list("diagrams", { source_id: id })) {
    await repo.removeWhere("questions", { diagram_id: d.id });
    await repo.remove("diagrams", d.id);
  }
  await repo.remove("sources", id);
  return { ok: true };
});
