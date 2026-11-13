import { getRepo } from "@/lib/data";
import { FlashcardsView } from "@/components/flashcards/flashcards-view";

export const metadata = { title: "Flashcards" };

export default async function FlashcardsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getRepo();
  const [cards, topics] = await Promise.all([
    repo.list("flashcards", { kit_id: id }, { orderBy: "created_at" }),
    repo.list("topics", { kit_id: id }),
  ]);
  // editor order first, then creation order for cards made before ordering existed
  const ordered = [...cards].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.created_at.localeCompare(b.created_at));
  return <FlashcardsView kitId={id} cards={ordered} topics={topics.map((t) => ({ id: t.id, name: t.name }))} />;
}
