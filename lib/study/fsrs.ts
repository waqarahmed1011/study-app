import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from "ts-fsrs";
import type { Flashcard, FsrsState } from "@/lib/types";

// Thin wrapper over ts-fsrs so the rest of the app stores plain JSON.

const scheduler = fsrs({ enable_fuzz: true, request_retention: 0.9 });

export const RATINGS = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
} as const;
export type RatingName = keyof typeof RATINGS;

function toCard(s: FsrsState): Card {
  return {
    ...s,
    due: new Date(s.due),
    last_review: s.last_review ? new Date(s.last_review) : undefined,
  } as Card;
}

function fromCard(c: Card): FsrsState {
  return {
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review?.toISOString(),
  };
}

export function newFsrsState(now = new Date()): FsrsState {
  return fromCard(createEmptyCard(now));
}

export function review(state: FsrsState, rating: RatingName, now = new Date()): FsrsState {
  const res = scheduler.next(toCard(state), now, RATINGS[rating] as Grade);
  return fromCard(res.card);
}

/** Preview the next interval for each button, e.g. { again: "1m", good: "10m" }. */
export function previewIntervals(state: FsrsState, now = new Date()) {
  const out = {} as Record<RatingName, string>;
  for (const name of Object.keys(RATINGS) as RatingName[]) {
    const next = review(state, name, now);
    out[name] = formatInterval(Date.parse(next.due) - now.getTime());
  }
  return out;
}

export function formatInterval(ms: number) {
  const m = Math.max(1, Math.round(ms / 60_000));
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d}d`;
  const mo = Math.round(d / 30);
  return mo < 12 ? `${mo}mo` : `${(d / 365).toFixed(1)}y`;
}

export type CardBucket = "new" | "learning" | "review" | "mastered";

/** Buckets for the deck stats row. Mastered = in review with stability ≥ 21 days. */
export function bucketOf(card: Pick<Flashcard, "fsrs">): CardBucket {
  const s = card.fsrs;
  if (s.state === State.New) return "new";
  if (s.state === State.Learning || s.state === State.Relearning) return "learning";
  return s.stability >= 21 ? "mastered" : "review";
}

export function isCardDue(card: Pick<Flashcard, "fsrs">, now = new Date()) {
  return Date.parse(card.fsrs.due) <= now.getTime();
}
