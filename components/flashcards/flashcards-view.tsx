"use client";
import { useState } from "react";
import type { Flashcard } from "@/lib/types";
import { cx, EmptyState } from "@/components/ui";
import { Deck } from "./deck";
import { CardList } from "./card-list";
import { Games } from "./games";

type Tab = "deck" | "list" | "games";

export function FlashcardsView({ cards, topics }: { cards: Flashcard[]; topics: { id: string; name: string }[] }) {
  const [tab, setTab] = useState<Tab>("deck");
  if (!cards.length) return <EmptyState title="No flashcards yet">Add material in the Materials tab to generate cards.</EmptyState>;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex justify-center">
        <div className="flex gap-1 rounded-full bg-surface-2 p-1 text-sm" role="tablist">
          {(["list", "deck", "games"] as Tab[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx("rounded-full px-4 py-1.5 font-semibold capitalize", tab === t ? "bg-surface text-text shadow-card" : "text-muted")}>
              {t}
            </button>
          ))}
        </div>
      </div>
      {tab === "deck" && <Deck initial={cards} />}
      {tab === "list" && <CardList cards={cards} topics={topics} />}
      {tab === "games" && <Games cards={cards} />}
    </div>
  );
}
