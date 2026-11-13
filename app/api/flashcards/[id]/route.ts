import { must, route } from "@/lib/api";
import { cleanImage, cleanText } from "@/lib/card-input";
import type { IdCtx } from "@/lib/route-types";
import type { Flashcard } from "@/lib/types";

export const PATCH = route<IdCtx>(async (req, repo, { params }) => {
  const { id } = await params;
  const card = await must(repo.get("flashcards", id));
  const b = (await req.json()) as Record<string, unknown>;
  const patch: Partial<Flashcard> = {};
  if ("front" in b) patch.front = cleanText(b.front);
  if ("back" in b) patch.back = cleanText(b.back);
  if ("front_image" in b) patch.front_image = cleanImage(b.front_image, card.kit_id);
  if ("back_image" in b) patch.back_image = cleanImage(b.back_image, card.kit_id);
  if ("topic_id" in b) patch.topic_id = typeof b.topic_id === "string" ? b.topic_id : null;
  return repo.update("flashcards", id, patch);
});

export const DELETE = route<IdCtx>(async (_req, repo, { params }) => {
  const { id } = await params;
  await must(repo.get("flashcards", id));
  await repo.remove("flashcards", id);
  return { ok: true };
});
