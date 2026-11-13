import { must, route } from "@/lib/api";
import { cleanImage, cleanText } from "@/lib/card-input";
import { newFsrsState } from "@/lib/study/fsrs";
import type { IdCtx } from "@/lib/route-types";

// Create a card by hand (card editor).
export const POST = route<IdCtx>(async (req, repo, { params }) => {
  const { id } = await params;
  await must(repo.get("kits", id), "Kit not found");
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const cards = await repo.list("flashcards", { kit_id: id });
  const position = Math.max(0, ...cards.map((c) => c.position ?? 0)) + 1;
  return repo.insert("flashcards", {
    kit_id: id,
    topic_id: typeof b.topic_id === "string" ? b.topic_id : null,
    front: cleanText(b.front),
    back: cleanText(b.back),
    front_image: cleanImage(b.front_image, id),
    back_image: cleanImage(b.back_image, id),
    position,
    diagram_id: null,
    region_id: null,
    gen_kind: null,
    fsrs: newFsrsState(),
  });
});
