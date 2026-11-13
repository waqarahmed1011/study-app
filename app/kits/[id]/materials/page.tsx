import { getRepo } from "@/lib/data";
import { MaterialsView } from "@/components/kit/materials-view";

export const metadata = { title: "Materials" };

export default async function MaterialsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getRepo();
  const [kit, sources, topics, cards, questions] = await Promise.all([
    repo.get("kits", id),
    repo.list("sources", { kit_id: id }, { orderBy: "created_at" }),
    repo.list("topics", { kit_id: id }, { orderBy: "created_at" }),
    repo.list("flashcards", { kit_id: id }),
    repo.list("questions", { kit_id: id }),
  ]);
  return (
    <MaterialsView
      kit={kit!}
      sources={sources.map((s) => ({ id: s.id, name: s.name, kind: s.kind, status: s.status, error: s.error, chars: s.extracted_md?.length ?? 0, generated: s.generated, preview: s.extracted_md?.slice(0, 1500) ?? "" }))}
      topics={topics.map((t) => ({ id: t.id, name: t.name, mastery: t.mastery }))}
      counts={{ cards: cards.length, questions: questions.length }}
    />
  );
}
