import { notFound } from "next/navigation";
import { getRepo } from "@/lib/data";
import { DiagramStudio } from "@/components/diagram/diagram-studio";

export default async function DiagramPage({ params }: { params: Promise<{ id: string; did: string }> }) {
  const { id, did } = await params;
  const repo = await getRepo();
  const d = await repo.get("diagrams", did);
  if (!d || d.kit_id !== id) notFound();
  const src = await repo.get("sources", d.source_id);
  return <DiagramStudio kitId={id} diagram={d} image={src?.storage_path ? `/api/files/${src.storage_path}` : ""} />;
}
