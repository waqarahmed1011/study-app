"use client";
import { useState } from "react";
import type { Flashcard } from "@/lib/types";
import { cx, EmptyState } from "@/components/ui";
import { Deck } from "./deck";
import { CardEditor } from "./card-editor";
import { Games } from "./games";

type Tab = "deck" | "list" | "games";

export function FlashcardsView({ kitId, cards: initial, topics }: { kitId: string; cards: Flashcard[]; topics: { id: string; name: string }[] }) {
  const [tab, setTab] = useState<Tab>("deck");
  // one copy of the cards shared by all three tabs, so edits show up in the deck straight away
  const [cards, setCards] = useState(initial);
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex justify-center">
        <div className="flex gap-1 rounded-full bg-surface-2 p-1 text-sm" role="tablist">
          {(["list", "deck", "games"] as Tab[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx("rounded-full px-4 py-1.5 font-semibold capitalize", tab === t ? "bg-surface text-text shadow-card" : "text-muted")}>
              {t === "list" ? "Edit" : t}
            </button>
          ))}
        </div>
      </div>
      {tab === "list" && <CardEditor kitId={kitId} cards={cards} setCards={setCards} topics={topics} />}
      {tab !== "list" && !cards.length ? (
        <EmptyState title="No flashcards yet">Add material in the Materials tab, or make your own cards in Edit.</EmptyState>
      ) : (
        <>
          {tab === "deck" && <Deck cards={cards} setCards={setCards} />}
          {tab === "games" && <Games cards={cards} />}
        </>
      )}
    </div>
  );
}
