import { getRepo } from "@/lib/data";
import { DiagramList } from "@/components/diagram/diagram-list";

export const metadata = { title: "Diagrams" };

export default async function DiagramsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getRepo();
  const [diagrams, sources, topics] = await Promise.all([
    repo.list("diagrams", { kit_id: id }, { orderBy: "created_at" }),
    repo.list("sources", { kit_id: id, kind: "diagram" }),
    repo.list("topics", { kit_id: id }),
  ]);
  const paths = new Map(sources.map((s) => [s.id, s.storage_path]));
  const mastery = new Map(topics.map((t) => [t.id, t.mastery]));
  return (
    <DiagramList
      kitId={id}
      diagrams={diagrams.map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        regions: d.regions.length,
        confirmed: d.regions.filter((r) => r.confirmed).length,
        image: paths.get(d.source_id) ? `/api/files/${paths.get(d.source_id)}` : null,
        mastery: d.topic_id ? (mastery.get(d.topic_id) ?? 0) : 0,
      }))}
      failed={sources.filter((s) => s.status === "error").map((s) => ({ id: s.id, name: s.name, error: s.error }))}
    />
  );
}
