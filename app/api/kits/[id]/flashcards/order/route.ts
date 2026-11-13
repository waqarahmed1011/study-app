import { route } from "@/lib/api";
import type { IdCtx } from "@/lib/route-types";

// Save the card order from the editor: ids in display order.
export const POST = route<IdCtx>(async (req, repo, { params }) => {
  const { id } = await params;
  const { ids } = (await req.json()) as { ids: string[] };
  const cards = new Map((await repo.list("flashcards", { kit_id: id })).map((c) => [c.id, c]));
  let pos = 1;
  for (const cid of ids ?? []) {
    const c = cards.get(cid);
    if (!c) continue;
    if (c.position !== pos) await repo.update("flashcards", cid, { position: pos });
    pos++;
  }
  return { ok: true };
});
