"use client";
import { AlertTriangle, FileText, ImageIcon, Shapes, Trash2, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import type { Kit, SourceKind } from "@/lib/types";
import { GenerationPanel } from "./generation-panel";
import { Uploader } from "./uploader";
import { Markdown } from "@/components/markdown";
import { Badge, Button, Card, ProgressBar } from "@/components/ui";

interface Src { id: string; name: string; kind: SourceKind; status: string; error: string | null; chars: number; generated: boolean; preview: string }

export function MaterialsView({ kit, sources, topics, counts }: { kit: Kit; sources: Src[]; topics: { id: string; name: string; mastery: number }[]; counts: { cards: number; questions: number } }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const pending = sources.filter((s) => !s.generated || s.status === "pending").length;

  async function remove(s: Src) {
    if (!confirm(`Remove "${s.name}"? Questions already made from it stay in the kit.`)) return;
    await api(`/api/sources/${s.id}`, { method: "DELETE" });
    router.refresh();
  }

  if (updating) {
    return <GenerationPanel kit={kit} all onDone={() => { setUpdating(false); setAdding(false); }} />;
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div className="grid grid-cols-3 gap-3 text-center">
        <Card className="p-3"><div className="text-xl font-bold">{sources.length}</div><div className="text-xs text-muted">sources</div></Card>
        <Card className="p-3"><div className="text-xl font-bold">{counts.cards}</div><div className="text-xs text-muted">flashcards</div></Card>
        <Card className="p-3"><div className="text-xl font-bold">{counts.questions}</div><div className="text-xs text-muted">questions</div></Card>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Sources</h2>
          <Button variant="secondary" size="sm" onClick={() => setAdding((a) => !a)}>{adding ? "Done" : "Add material"}</Button>
        </div>
        {adding && (
          <div className="mb-4">
            <Uploader getKitId={async () => kit.id} onChange={() => router.refresh()} />
          </div>
        )}
        {pending > 0 && (
          <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-primary/50 p-4">
            <p className="text-sm">New material hasn&apos;t been turned into cards and questions yet.</p>
            <Button onClick={() => setUpdating(true)}><Wand2 className="size-4" /> Update kit</Button>
          </Card>
        )}
        <ul className="space-y-2">
          {sources.map((s) => (
            <Card key={s.id} className="p-3">
              <div className="flex items-center gap-3">
                {s.kind === "diagram" ? <Shapes className="size-5 text-accent" /> : s.kind === "image" ? <ImageIcon className="size-5 text-muted" /> : <FileText className="size-5 text-muted" />}
                <button type="button" onClick={() => setOpen(open === s.id ? null : s.id)} className="min-w-0 flex-1 text-left">
                  <div className="truncate font-medium">{s.name}</div>
                  <div className="text-xs text-muted">
                    {s.kind} · {s.status === "done" ? `${Math.round(s.chars / 5)} words read` : s.status}
                  </div>
                </button>
                {s.status === "error" && <Badge tone="bad"><AlertTriangle className="size-3" /> error</Badge>}
                <button type="button" onClick={() => remove(s)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-bad-soft hover:text-bad" aria-label={`Remove ${s.name}`}>
                  <Trash2 className="size-4" />
                </button>
              </div>
              {s.error && <p className="mt-2 text-xs text-bad">{s.error}</p>}
              {open === s.id && s.preview && (
                <div className="mt-3 max-h-80 overflow-auto rounded-xl bg-surface-2 p-3">
                  <Markdown className="text-sm">{s.preview + (s.chars > 1500 ? "\n\n…" : "")}</Markdown>
                </div>
              )}
            </Card>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Topics</h2>
        <div className="space-y-3">
          {topics.map((t) => (
            <div key={t.id}>
              <div className="flex justify-between text-sm"><span>{t.name}</span><span className="text-muted">{Math.round(t.mastery * 100)}%</span></div>
              <ProgressBar value={t.mastery} className="mt-1 h-1.5" tone={t.mastery >= 0.7 ? "good" : "primary"} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
