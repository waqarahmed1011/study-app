import { notFound } from "next/navigation";
import { getRepo } from "@/lib/data";
import { GenerationPanel } from "@/components/kit/generation-panel";
import { KitTabs } from "@/components/kit/kit-tabs";
import { KitHeader } from "@/components/kit/kit-header";


export default async function KitLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = await getRepo();
  const kit = await repo.get("kits", id);
  if (!kit) notFound();
  const built = kit.status === "ready";

  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 sm:pb-12">
      <KitHeader kit={kit} />
      {built ? (
        <>
          <KitTabs kitId={kit.id} />
          <div className="pt-5">{children}</div>
        </>
      ) : (
        <div className="pt-6">
          <GenerationPanel kit={kit} />
        </div>
      )}
    </div>
  );
}
