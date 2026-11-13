import { getRepo } from "@/lib/data";
import { SmartStudy } from "./smart-study";

export const metadata = { title: "Smart Study" };

export default async function SmartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getRepo();
  const topics = await repo.list("topics", { kit_id: id }, { orderBy: "created_at" });
  return <SmartStudy kitId={id} topics={topics.map((t) => ({ id: t.id, name: t.name }))} />;
}
