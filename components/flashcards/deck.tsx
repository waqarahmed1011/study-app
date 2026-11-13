"use client";
import { PartyPopper, RotateCcw, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client";
import { bucketOf, formatInterval, isCardDue, previewIntervals, type RatingName } from "@/lib/study/fsrs";
import type { Flashcard } from "@/lib/types";
import { InlineMd } from "@/components/markdown";
import { Button, Card, cx } from "@/components/ui";

const RATING_STYLE: Record<RatingName, string> = {
  again: "bg-bad text-white",
  hard: "bg-accent text-black",
  good: "bg-good text-white",
  easy: "bg-primary text-primary-ink",
};

function speak(text: string) {
  try {
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(text.replace(/[$*_#`]/g, "")));
  } catch {}
}

export function Deck({ initial }: { initial: Flashcard[] }) {
  const [cards, setCards] = useState(initial);
  const [cram, setCram] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);

  const queue = useMemo(() => {
    const now = new Date();
    const due = cards.filter((c) => isCardDue(c, now)).sort((a, b) => a.fsrs.due.localeCompare(b.fsrs.due));
    if (due.length || !cram) return due;
    return [...cards].sort((a, b) => a.fsrs.stability - b.fsrs.stability); // weakest first
  }, [cards, cram]);
  const card = queue[0];

  const counts = useMemo(() => {
    const c = { new: 0, learning: 0, review: 0, mastered: 0 };
    for (const x of cards) c[bucketOf(x)]++;
    return c;
  }, [cards]);

  const intervals = card ? previewIntervals(card.fsrs) : null;

  async function rate(r: RatingName) {
    if (!card) return;
    setFlipped(false);
    setDrag(0);
    const updated = await api<Flashcard>(`/api/flashcards/${card.id}/review`, { body: { rating: r } });
    setCards((cs) => cs.map((c) => (c.id === updated.id ? updated : c)));
    setReviewed((n) => n + 1);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card) return;
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        rate((["again", "hard", "good", "easy"] as RatingName[])[Number(e.key) - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const nextDue = cards.length ? cards.reduce((m, c) => (c.fsrs.due < m ? c.fsrs.due : m), cards[0].fsrs.due) : null;

  return (
    <div>
      <div className="mb-4 grid grid-cols-4 gap-2 text-center">
        {(
          [
            ["New", counts.new, "text-muted"],
            ["Learning", counts.learning, "text-accent"],
            ["Reviewing", counts.review, "text-primary"],
            ["Mastered", counts.mastered, "text-good"],
          ] as const
        ).map(([label, n, color]) => (
          <div key={label} className="rounded-xl bg-surface-2 py-2">
            <div className={cx("text-xl font-bold", color)}>{n}</div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
          </div>
        ))}
      </div>

      {!card ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <PartyPopper className="size-10 text-accent" />
          <div className="text-xl font-bold">All caught up</div>
          <p className="text-sm text-muted">
            {reviewed ? `You reviewed ${reviewed} card${reviewed === 1 ? "" : "s"}. ` : ""}
            {nextDue ? `Next card is due in ${formatInterval(Date.parse(nextDue) - Date.now())}.` : ""}
          </p>
          <Button variant="secondary" onClick={() => setCram(true)}>
            <RotateCcw className="size-4" /> Practice anyway
          </Button>
        </Card>
      ) : (
        <>
          <div
            className={cx("flip relative h-72 select-none sm:h-80", flipped && "flipped")}
            onClick={() => setFlipped((f) => !f)}
            onPointerDown={(e) => (start.current = e.clientX)}
            onPointerMove={(e) => start.current !== null && flipped && setDrag(e.clientX - start.current)}
            onPointerUp={() => {
              if (flipped && Math.abs(drag) > 90) rate(drag > 0 ? "good" : "again");
              else setDrag(0);
              start.current = null;
            }}
            style={{ transform: drag ? `translateX(${drag}px) rotate(${drag / 30}deg)` : undefined, touchAction: "pan-y" }}
            role="button"
            tabIndex={0}
            aria-label={flipped ? "Card answer. Press space to flip back" : "Card front. Press space to reveal"}
          >
            <div className="flip-inner relative h-full w-full">
              <Card className="flip-face absolute inset-0 grid place-items-center overflow-auto p-6 text-center">
                <div className="text-xl font-semibold sm:text-2xl"><InlineMd>{card.front}</InlineMd></div>
                <span className="absolute bottom-3 text-xs text-muted">Tap or press space to flip</span>
              </Card>
              <Card className="flip-face flip-back absolute inset-0 grid place-items-center overflow-auto p-6 text-center">
                <div className="text-base sm:text-lg"><InlineMd>{card.back}</InlineMd></div>
                {drag !== 0 && (
                  <span className={cx("absolute top-3 rounded-full px-3 py-1 text-sm font-bold", drag > 0 ? "right-3 bg-good text-white" : "left-3 bg-bad text-white")}>
                    {drag > 0 ? "Good" : "Again"}
                  </span>
                )}
              </Card>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2">
            {flipped && intervals ? (
              (["again", "hard", "good", "easy"] as RatingName[]).map((r, i) => (
                <button key={r} type="button" onClick={() => rate(r)} aria-label={`${r[0].toUpperCase() + r.slice(1)}, next in ${intervals[r]}`} className={cx("flex min-w-18 flex-col items-center rounded-2xl px-3 py-2 font-semibold active:scale-95", RATING_STYLE[r])}>
                  <span className="text-sm capitalize">{r}</span>
                  <span className="text-[11px] opacity-80">{intervals[r]} · {i + 1}</span>
                </button>
              ))
            ) : (
              <Button size="lg" onClick={() => setFlipped(true)}>Show answer</Button>
            )}
            <button type="button" onClick={() => speak(flipped ? card.back : card.front)} className="grid size-11 place-items-center rounded-full bg-surface-2 text-muted hover:text-text" aria-label="Read aloud">
              <Volume2 className="size-5" />
            </button>
          </div>
          <p className="mt-3 text-center text-xs text-muted">
            {queue.length} {cram ? "in practice queue" : "due"} · swipe right for Good, left for Again
          </p>
        </>
      )}
    </div>
  );
}
