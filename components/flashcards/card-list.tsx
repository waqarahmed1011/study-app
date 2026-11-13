"use client";
import { Search } from "lucide-react";
import { useState } from "react";
import { bucketOf } from "@/lib/study/fsrs";
import type { Flashcard } from "@/lib/types";
import { InlineMd } from "@/components/markdown";
import { Badge, Card } from "@/components/ui";

export function CardList({ cards, topics }: { cards: Flashcard[]; topics: { id: string; name: string }[] }) {
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState("");
  const names = new Map(topics.map((t) => [t.id, t.name]));
  const shown = cards.filter(
    (c) => (!topic || c.topic_id === topic) && (!q || (c.front + " " + c.back).toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3">
          <Search className="size-4 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cards" className="w-full bg-transparent py-2 outline-none" />
        </label>
        <select value={topic} onChange={(e) => setTopic(e.target.value)} className="rounded-xl border border-border bg-surface px-3 py-2">
          <option value="">All topics</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <p className="mb-2 text-sm text-muted">{shown.length} cards</p>
      <div className="space-y-2">
        {shown.map((c) => (
          <Card key={c.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_2fr]">
            <div className="font-semibold"><InlineMd>{c.front}</InlineMd></div>
            <div className="text-sm text-muted">
              <InlineMd>{c.back}</InlineMd>
              <div className="mt-2 flex gap-2">
                {c.topic_id && names.get(c.topic_id) && <Badge>{names.get(c.topic_id)}</Badge>}
                <Badge tone={bucketOf(c) === "mastered" ? "good" : bucketOf(c) === "learning" ? "accent" : "muted"}>{bucketOf(c)}</Badge>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
