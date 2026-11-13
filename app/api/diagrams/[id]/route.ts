import { must, route } from "@/lib/api";
import { clampBox } from "@/lib/diagram/geometry";
import type { IdCtx } from "@/lib/route-types";
import type { Diagram, DiagramRegion } from "@/lib/types";

export const PATCH = route<IdCtx>(async (req, repo, { params }) => {
  const { id } = await params;
  const d = await must(repo.get("diagrams", id));
  const body = (await req.json()) as Partial<Pick<Diagram, "title" | "regions" | "status">>;
  const patch: Partial<Diagram> = {};
  if (body.title?.trim()) patch.title = body.title.trim().slice(0, 100);
  if (body.status) patch.status = body.status;
  if (body.regions) {
    patch.regions = body.regions
      .filter((r) => r.label?.trim())
      .map((r): DiagramRegion => ({
        id: r.id,
        label: r.label.trim().slice(0, 80),
        marker: r.marker?.trim().slice(0, 4) || undefined,
        box: clampBox(r.box),
        labelBox: r.labelBox ? clampBox(r.labelBox) : null,
        confirmed: Boolean(r.confirmed),
        seen: r.seen ?? 0,
        correct: r.correct ?? 0,
      }));
  }
  if (patch.title && d.topic_id) await repo.update("topics", d.topic_id, { name: `Diagram: ${patch.title}`.slice(0, 80) });
  return repo.update("diagrams", id, patch);
});
