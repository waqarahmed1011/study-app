"use client";
import { Loader2, Plus, Shapes } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { Uploader } from "@/components/kit/uploader";
import { Badge, Button, Card, EmptyState, ErrorNote, ProgressBar } from "@/components/ui";

interface Row { id: string; title: string; status: string; regions: number; confirmed: number; image: string | null; mastery: number }

export function DiagramList({ kitId, diagrams, failed }: { kitId: string; diagrams: Row[]; failed: { id: string; name: string; error: string | null }[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(diagrams.length === 0);
  const [processing, setProcessing] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function process(src: { id: string }) {
    setProcessing((n) => n + 1);
    try {
      const res = await api<{ source: { status: string; error: string | null }; diagram: { id: string } | null }>(`/api/sources/${src.id}/process`, { body: {} });
      if (res.source.status === "error") setError(res.source.error);
      else if (res.diagram) router.push(`/kits/${kitId}/diagrams/${res.diagram.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setProcessing((n) => n - 1);
      router.refresh();
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Label quizzes for anatomy figures, maps, circuits, anything with parts to name.</p>
        <Button variant="secondary" size="sm" onClick={() => setAdding((a) => !a)}>
          <Plus className="size-4" /> Add diagram
        </Button>
      </div>
      {adding && (
        <div className="mb-6">
          <Uploader diagramOnly getKitId={async () => kitId} onUploaded={process} />
          {processing > 0 && (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" /> Finding the labelled structures…</p>
          )}
        </div>
      )}
      {error && <div className="mb-4"><ErrorNote>{error}</ErrorNote></div>}
      {failed.map((f) => (
        <div key={f.id} className="mb-2"><ErrorNote>{f.name}: {f.error}</ErrorNote></div>
      ))}
      {!diagrams.length && !adding ? (
        <EmptyState icon={<Shapes className="size-8" />} title="No diagrams yet">Upload a figure and the AI will find its labels. You check them, then quiz yourself.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {diagrams.map((d) => (
            <Link key={d.id} href={`/kits/${kitId}/diagrams/${d.id}`}>
              <Card className="h-full overflow-hidden hover:border-primary/60">
                {d.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.image} alt="" className="h-40 w-full bg-white object-contain" />
                )}
                <div className="p-4">
                  <div className="truncate font-semibold">{d.title}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                    {d.status === "draft" ? <Badge tone="accent">Check labels</Badge> : <Badge tone="good">Ready</Badge>}
                    {d.confirmed}/{d.regions} labels
                  </div>
                  <ProgressBar value={d.mastery} className="mt-3 h-1.5" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
