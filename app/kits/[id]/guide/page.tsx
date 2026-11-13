import { getRepo } from "@/lib/data";
import { GuideView } from "@/components/kit/guide-view";

export const metadata = { title: "Study guide" };

export default async function GuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getRepo();
  const [docs, kit] = await Promise.all([repo.list("documents", { kit_id: id }), repo.get("kits", id)]);
  return (
    <GuideView
      kitId={id}
      title={kit?.title ?? "study-guide"}
      guide={docs.find((d) => d.kind === "guide")?.content_md ?? null}
      summary={docs.find((d) => d.kind === "summary")?.content_md ?? null}
    />
  );
}
