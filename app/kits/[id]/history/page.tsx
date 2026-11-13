"use client";
import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import { use, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { QUESTION_TYPE_LABEL, type QuestionType } from "@/lib/types";
import { InlineMd } from "@/components/markdown";
import { Badge, Card, cx, EmptyState } from "@/components/ui";

interface Item { id: string; at: string; mode: string; correct: boolean; score: number; prompt: string; type: QuestionType; answer: string; feedback: string | null }

export default function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [items, setItems] = useState<Item[] | null>(null);
  const [filter, setFilter] = useState<"all" | "wrong" | "right">("all");

  useEffect(() => {
    api<{ items: Item[] }>(`/api/kits/${id}/history`).then((r) => setItems(r.items));
  }, [id]);

  const shown = (items ?? []).filter((i) => filter === "all" || (filter === "wrong" ? !i.correct : i.correct));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Question history</h2>
        <div className="flex gap-1 rounded-full bg-surface-2 p-1 text-sm">
          {(["all", "wrong", "right"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={cx("rounded-full px-3 py-1 font-semibold capitalize", filter === f ? "bg-surface text-text shadow-card" : "text-muted")}>
              {f === "wrong" ? "Missed" : f === "right" ? "Correct" : "All"}
            </button>
          ))}
        </div>
      </div>
      {items && !shown.length ? (
        <EmptyState title="Nothing here yet">Answer some questions in Smart Study or a practice test.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {shown.map((i) => (
            <Card key={i.id} className="p-4">
              <div className="flex items-start gap-3">
                {i.correct ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-good" /> : i.score > 0 ? <CircleDashed className="mt-0.5 size-5 shrink-0 text-accent" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-bad" />}
                <div className="min-w-0 flex-1">
                  <div className="font-medium"><InlineMd>{i.prompt}</InlineMd></div>
                  <div className="mt-1 text-sm text-muted"><span className="font-semibold">Answer:</span> <InlineMd>{i.answer}</InlineMd></div>
                  {i.feedback && <div className="mt-1 text-sm text-muted">{i.feedback}</div>}
                  <div className="mt-2 flex gap-2 text-xs">
                    <Badge>{QUESTION_TYPE_LABEL[i.type]}</Badge>
                    <Badge>{i.mode === "test" ? "Practice test" : "Smart Study"}</Badge>
                    <span className="text-muted">{new Date(i.at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
